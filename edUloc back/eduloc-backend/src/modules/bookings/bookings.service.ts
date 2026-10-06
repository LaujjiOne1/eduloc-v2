import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { AppConfig } from '../../core/config/app.config';
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from '../../common/errors/domain-errors';
import { RateLimitService } from '../../common/rate-limit.service';
import { OutboxWriter, type OutboxEventInput } from '../../infrastructure/outbox/outbox-writer';
import { BookingStateMachine, BookingActor, BookingState } from './domain/booking-state-machine';
import { SlotPolicy, TeachingMode, AvailabilityRule } from './domain/slot-policy';
import { SessionPolicy } from './domain/session-policy';
import { BookingPolicy } from './domain/booking-policy';
import { BookingsRepository, Tx } from './bookings.repository';
import { CancelBookingDto, CreateBookingDto, RefuseBookingDto } from './dto';

const toBookingState = (s: string): BookingState =>
  s as BookingState;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: BookingsRepository,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxWriter,
    private readonly rateLimit: RateLimitService,
    private readonly cfg: AppConfig,
  ) {}

  async createBooking(requesterId: string, dto: CreateBookingDto) {
    await this.rateLimit.consume(`rl:booking:${requesterId}`, 10, 3600);
    return this.prisma.$transaction(async (tx: Tx) => {
      const offer = await this.repo.findBookableOffer(tx, dto.offerId);
      if (!offer) throw new NotFoundError('OFFER_NOT_BOOKABLE');

      await this.repo.lockTutor(tx, offer.tutorProfileId);

      const beneficiary = await tx.beneficiary.findFirst({ where: { id: dto.beneficiaryId, requesterId } });
      if (!beneficiary) throw new ForbiddenError('BENEFICIARY_NOT_OWNED');

      const startAt = new Date(dto.startAt);
      const endAt = new Date(startAt.getTime() + offer.durationMinutes * 60_000);
      BookingPolicy.assertMinNotice(startAt, new Date(), this.cfg.bookingMinNoticeHours);

      const rawRules = await tx.availability.findMany({
        where: { tutorProfileId: offer.tutorProfileId, isActive: true },
        include: { place: true },
      });
      const rules: AvailabilityRule[] = rawRules.map((r) => ({
        id: r.id,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        timezone: r.timezone,
        validFrom: r.validFrom,
        validUntil: r.validUntil,
        isActive: r.isActive,
        offerId: r.offerId,
        placeId: r.placeId,
        placeType: r.place?.type ?? null,
      }));
      const rule = SlotPolicy.matchRule(rules, startAt, endAt, dto.teachingMode as TeachingMode, dto.placeId, offer.id);
      if (!rule) throw new UnprocessableError('SLOT_OUTSIDE_AVAILABILITY');

      const conflict = await this.repo.blockingOverlap(tx, offer.tutorProfileId, startAt, endAt);
      if (conflict) throw new ConflictError('SLOT_UNAVAILABLE');

      const place = rule.placeId ? await tx.place.findUnique({ where: { id: rule.placeId } }) : null;
      const booking = await tx.booking.create({
        data: {
          requesterId,
          beneficiaryId: beneficiary.id,
          tutorProfileId: offer.tutorProfileId,
          offerId: offer.id,
          availabilityId: rule.id,
          placeId: place?.id ?? null,
          startAt,
          endAt,
          status: 'PENDING',
          teachingMode: dto.teachingMode as never,
          price: offer.price,
          offerTitle: offer.title,
          locationLabel: place?.label ?? null,
          locationAddress: place?.address ?? null,
          latitude: place?.latitude ?? null,
          longitude: place?.longitude ?? null,
        },
      });
      await tx.bookingEvent.create({
        data: { bookingId: booking.id, toStatus: 'PENDING' as never, actor: 'REQUESTER' as never, actorUserId: requesterId },
      });

      const conversation = await tx.conversation.upsert({
        where: { requesterId_tutorProfileId: { requesterId, tutorProfileId: offer.tutorProfileId } },
        update: { bookingId: booking.id, status: 'OPEN' as never },
        create: { requesterId, tutorProfileId: offer.tutorProfileId, bookingId: booking.id },
      });
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: null,
          type: 'SYSTEM',
          systemText: 'Demande de réservation envoyée.',
        },
      });

      await this.outbox.write(tx, {
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'booking.requested',
        recipientIds: [offer.tutorProfile.userId],
        payload: { bookingId: booking.id, startAt: startAt.toISOString(), conversationId: conversation.id },
        pushTitle: 'Nouvelle demande',
        pushBody: 'Un demandeur souhaite réserver un créneau.',
        cacheKeys: [`slots:${offer.tutorProfileId}:${startAt.toISOString().slice(0, 10)}`],
      });
      return this.toResponse(booking);
    }, { timeout: 10_000 });
  }

  async acceptBooking(tutorUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const tutor = await tx.tutorProfile.findFirst({
        where: { userId: tutorUserId, isVisible: true, suspendedAt: null },
      });
      if (!tutor) throw new ForbiddenError('TUTOR_NOT_APPROVED');
      await this.repo.lockTutor(tx, tutor.id);

      const booking = await tx.booking.findFirst({ where: { id: bookingId, tutorProfileId: tutor.id } });
      if (!booking) throw new NotFoundError('BOOKING_NOT_FOUND');
      BookingStateMachine.assertCanTransition(toBookingState(booking.status as string), 'CONFIRMED', 'TUTOR');

      const conflict = await this.repo.blockingOverlap(tx, tutor.id, booking.startAt, booking.endAt, booking.id);
      if (conflict) throw new ConflictError('SLOT_NO_LONGER_AVAILABLE');

      const otp = this.crypto.generateOtp();
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          startOtpCipher: this.crypto.encrypt(otp),
          otpExpiresAt: booking.endAt,
          otpAttempts: 0,
        },
      });
      if (count !== 1) throw new ConflictError('BOOKING_STATE_CHANGED');
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'PENDING' as never,
          toStatus: 'CONFIRMED' as never,
          actor: 'TUTOR' as never,
          actorUserId: tutorUserId,
        },
      });

      const autoRefused = await this.repo.refuseOverlappingPending(tx, tutor.id, booking.startAt, booking.endAt, booking.id);
      const inputs: OutboxEventInput[] = [{
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'booking.confirmed',
        recipientIds: [booking.requesterId],
        payload: { bookingId: booking.id, startAt: booking.startAt.toISOString() },
        pushTitle: 'Réservation confirmée',
        pushBody: 'Le tuteur a accepté votre demande.',
        cacheKeys: [`slots:${tutor.id}:${booking.startAt.toISOString().slice(0, 10)}`],
      }];
      for (const b of autoRefused) {
        inputs.push({
          aggregateType: 'booking',
          aggregateId: b.id,
          eventType: 'booking.refused',
          recipientIds: [b.requesterId],
          payload: { bookingId: b.id, reason: 'SLOT_TAKEN', by: 'SYSTEM' },
          pushTitle: 'Créneau indisponible',
          pushBody: 'Ce créneau vient d’être réservé.',
        });
      }
      await this.outbox.writeMany(tx, inputs);
      return { ...this.toResponse(booking), startOtp: otp, status: 'CONFIRMED' };
    }, { timeout: 10_000 });
  }

  async refuseBooking(tutorUserId: string, bookingId: string, dto: RefuseBookingDto) {
    return this.transitionAsTutor(tutorUserId, bookingId, 'REFUSED', dto.reason ?? null);
  }

  async cancelBooking(userId: string, bookingId: string, dto: CancelBookingDto, isAdmin: boolean) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { tutorProfile: true } });
      if (!booking) throw new NotFoundError('BOOKING_NOT_FOUND');
      const isRequester = booking.requesterId === userId;
      const isTutor = booking.tutorProfile.userId === userId;
      if (!isRequester && !isTutor && !isAdmin) throw new ForbiddenError('BOOKING_NOT_OWNED');

      const actor: BookingActor = isAdmin && !isRequester && !isTutor ? 'ADMIN' : isRequester ? 'REQUESTER' : 'TUTOR';
      BookingStateMachine.assertCanTransition(toBookingState(booking.status as string), 'CANCELLED', actor);
      BookingPolicy.assertCancellationAllowed(booking.startAt, new Date(), dto.reason, this.cfg.cancellationFreeNoticeHours);

      const from = booking.status as string;
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: { in: ['PENDING', 'CONFIRMED'] } },
        data: { status: 'CANCELLED', cancelledBy: actor as never, cancellationReason: dto.reason ?? null },
      });
      if (count !== 1) throw new ConflictError('BOOKING_STATE_CHANGED');
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: from as never,
          toStatus: 'CANCELLED' as never,
          actor: actor as never,
          actorUserId: userId,
          reason: dto.reason,
        },
      });
      const other = actor === 'REQUESTER' ? booking.tutorProfile.userId : booking.requesterId;
      await this.outbox.write(tx, {
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'booking.cancelled',
        recipientIds: [other],
        payload: { bookingId: booking.id, by: actor },
        pushTitle: 'Rendez-vous annulé',
        pushBody: 'Une réservation a été annulée.',
        cacheKeys: [`slots:${booking.tutorProfileId}:${booking.startAt.toISOString().slice(0, 10)}`],
      });
      return { id: booking.id, status: 'CANCELLED' };
    }, { timeout: 10_000 });
  }

  async getOtp(requesterId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, requesterId } });
    if (!booking) throw new NotFoundError('BOOKING_NOT_FOUND');
    if (booking.status !== 'CONFIRMED' || !booking.startOtpCipher) {
      throw new UnprocessableError('OTP_NOT_AVAILABLE');
    }
    return { bookingId: booking.id, otp: this.crypto.decrypt(booking.startOtpCipher) };
  }

  async startSession(tutorUserId: string, bookingId: string, otp: string) {
    await this.rateLimit.consume(`rl:otp:${bookingId}`, 5, 3600);
    const result = await this.prisma.$transaction(async (tx: Tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tutorProfile: { userId: tutorUserId } },
      });
      if (!booking) throw new NotFoundError('BOOKING_NOT_FOUND');
      BookingStateMachine.assertCanTransition(toBookingState(booking.status as string), 'IN_PROGRESS', 'TUTOR');
      SessionPolicy.assertWithinStartWindow(booking.startAt, booking.endAt, new Date());
      if (booking.otpAttempts >= 5) throw new UnprocessableError('OTP_LOCKED');

      const valid = this.crypto.safeEqual(this.crypto.decrypt(booking.startOtpCipher!), otp);
      if (!valid) {
        await tx.booking.update({ where: { id: booking.id }, data: { otpAttempts: { increment: 1 } } });
        return { ok: false as const };
      }
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: 'CONFIRMED' },
        data: { status: 'IN_PROGRESS', startedAt: new Date(), startOtpCipher: null },
      });
      if (count !== 1) throw new ConflictError('BOOKING_STATE_CHANGED');
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'CONFIRMED' as never,
          toStatus: 'IN_PROGRESS' as never,
          actor: 'TUTOR' as never,
          actorUserId: tutorUserId,
        },
      });
      await this.outbox.write(tx, {
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'session.started',
        recipientIds: [booking.requesterId],
        payload: { bookingId: booking.id },
        pushTitle: 'Séance démarrée',
        pushBody: 'Le tuteur a démarré la séance.',
      });
      return { ok: true as const };
    });
    if (!result.ok) throw new UnprocessableError('OTP_INVALID');
    return { bookingId, status: 'IN_PROGRESS' };
  }

  async completeSession(tutorUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tutorProfile: { userId: tutorUserId } },
      });
      if (!booking) throw new NotFoundError('BOOKING_NOT_FOUND');
      BookingStateMachine.assertCanTransition(toBookingState(booking.status as string), 'COMPLETED', 'TUTOR');
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (count !== 1) throw new ConflictError('BOOKING_STATE_CHANGED');
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'IN_PROGRESS' as never,
          toStatus: 'COMPLETED' as never,
          actor: 'TUTOR' as never,
          actorUserId: tutorUserId,
        },
      });
      await this.outbox.write(tx, {
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'session.completed',
        recipientIds: [booking.requesterId],
        payload: { bookingId: booking.id, reviewable: true },
        pushTitle: 'Séance terminée',
        pushBody: 'Évaluez votre séance.',
      });
      return { id: booking.id, status: 'COMPLETED' };
    });
  }

  /** Clôture automatique par le SYSTEM 3 h après endAt (job planifié). */
  async autoCompleteStaleSessions(): Promise<number> {
    return this.prisma.$transaction(async (tx: Tx) => {
      const stale = await tx.booking.findMany({
        where: { status: 'IN_PROGRESS', endAt: { lt: new Date(Date.now() - 3 * 3_600_000) } },
      });
      for (const b of stale) {
        await tx.booking.update({ where: { id: b.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await tx.bookingEvent.create({
          data: {
            bookingId: b.id,
            fromStatus: 'IN_PROGRESS' as never,
            toStatus: 'COMPLETED' as never,
            actor: 'SYSTEM' as never,
            reason: 'AUTO_CLOSE',
          },
        });
        await this.outbox.write(tx, {
          aggregateType: 'booking',
          aggregateId: b.id,
          eventType: 'session.completed',
          recipientIds: [b.requesterId],
          payload: { bookingId: b.id, reviewable: true },
          pushTitle: 'Séance terminée',
          pushBody: 'Évaluez votre séance.',
        });
      }
      return stale.length;
    });
  }

  listMine(userId: string, role: 'requester' | 'tutor', status?: string, limit = 20) {
    const where = {
      ...(role === 'requester' ? { requesterId: userId } : { tutorProfile: { userId } }),
      ...(status ? { status: status as never } : {}),
    };
    return this.prisma.booking.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  getForUser(userId: string, bookingId: string) {
    return this.prisma.booking.findFirst({
      where: { id: bookingId, OR: [{ requesterId: userId }, { tutorProfile: { userId } }] },
    });
  }

  private async transitionAsTutor(tutorUserId: string, bookingId: string, to: 'REFUSED', reason: string | null) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const tutor = await tx.tutorProfile.findFirst({ where: { userId: tutorUserId } });
      const booking = await tx.booking.findFirst({ where: { id: bookingId, tutorProfileId: tutor?.id } });
      if (!booking) throw new NotFoundError('BOOKING_NOT_FOUND');
      BookingStateMachine.assertCanTransition(toBookingState(booking.status as string), to, 'TUTOR');
      const from = booking.status as string;
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: 'PENDING' },
        data: { status: to, refusalReason: reason },
      });
      if (count !== 1) throw new ConflictError('BOOKING_STATE_CHANGED');
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: from as never,
          toStatus: to as never,
          actor: 'TUTOR' as never,
          actorUserId: tutorUserId,
          reason,
        },
      });
      await this.outbox.write(tx, {
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'booking.refused',
        recipientIds: [booking.requesterId],
        payload: { bookingId: booking.id, reason, by: 'TUTOR' },
        pushTitle: 'Demande refusée',
        pushBody: 'Le tuteur a refusé votre demande.',
      });
      return { id: booking.id, status: to };
    });
  }

  private toResponse(b: {
    id: string; status: string; startAt: Date; endAt: Date; price: unknown;
    currency: string; offerTitle: string; teachingMode: string;
    locationLabel: string | null; createdAt: Date;
  }) {
    return {
      id: b.id,
      status: b.status,
      startAt: b.startAt,
      endAt: b.endAt,
      price: Number(b.price),
      currency: b.currency,
      offerTitle: b.offerTitle,
      teachingMode: b.teachingMode,
      locationLabel: b.locationLabel,
      createdAt: b.createdAt,
    };
  }
}
