import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  async myProfile(userId: string) {
    const p = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      include: { applications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!p) throw new NotFoundException('TUTOR_PROFILE_NOT_FOUND');
    return p;
  }

  createProfile(userId: string, data: {
    displayName?: string; bio?: string; birthDate?: Date;
    profilePhoto?: string; experience?: string; educationBackground?: string;
  }) {
    return this.prisma.tutorProfile.create({ data: { userId, ...data } as never });
  }

  updateProfile(userId: string, data: {
    displayName?: string; bio?: string; birthDate?: string;
    profilePhoto?: string; experience?: string; educationBackground?: string;
  }) {
    const { birthDate, ...profileData } = data;
    return this.prisma.tutorProfile.update({
      where: { userId },
      data: { ...profileData, ...(birthDate ? { birthDate: new Date(birthDate) } : {}) } as never,
    });
  }

  async addSubject(userId: string, data: {
    subjectId: string; educationLevelId: string; competenceDescription?: string;
  }) {
    const p = await this.prisma.tutorProfile.findUniqueOrThrow({ where: { userId } });
    return this.prisma.tutorSubject.create({
      data: { tutorProfileId: p.id, ...data } as never,
    });
  }

  async removeSubject(userId: string, id: string) {
    const p = await this.prisma.tutorProfile.findUniqueOrThrow({ where: { userId } });
    return this.prisma.tutorSubject.deleteMany({ where: { id, tutorProfileId: p.id } });
  }

  /** UC-E11 : soumission de candidature (une seule PENDING par tuteur). */
  async submitApplication(userId: string) {
    const p = await this.prisma.tutorProfile.findUniqueOrThrow({
      where: { userId },
      include: { applications: true },
    });
    if (p.applications.some((a) => a.status === 'PENDING')) {
      throw new UnprocessableEntityException('APPLICATION_ALREADY_PENDING');
    }
    const app = await this.prisma.tutorApplication.create({
      data: { tutorProfileId: p.id, status: 'PENDING', submittedAt: new Date() },
    });
    const admins = await this.prisma.user.findMany({
      where: { isAdmin: true, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.prisma.outboxEvent.create({
      data: {
        aggregateType: 'tutorApplication',
        aggregateId: app.id,
        eventType: 'tutor.application.submitted',
        recipientIds: admins.map((a) => a.id),
        payload: { applicationId: app.id, tutorProfileId: p.id },
        pushTitle: 'Nouvelle candidature',
        pushBody: 'Un tuteur a soumis son dossier.',
      },
    });
    return app;
  }
}

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  private profile(userId: string) {
    return this.prisma.tutorProfile.findUniqueOrThrow({ where: { userId } });
  }

  async listMine(userId: string) {
    const p = await this.profile(userId);
    return this.prisma.offer.findMany({ where: { tutorProfileId: p.id } });
  }

  /** UC-E04 : cohérence offre / matières déclarées. */
  async create(userId: string, data: {
    subjectId: string; educationLevelId?: string; title: string; description: string;
    format?: string; durationMinutes?: number; price: number; currency?: string;
  }) {
    const p = await this.profile(userId);
    const declared = await this.prisma.tutorSubject.findFirst({
      where: { tutorProfileId: p.id, subjectId: data.subjectId },
    });
    if (!declared) throw new UnprocessableEntityException('SUBJECT_NOT_DECLARED');
    if (data.educationLevelId && declared.educationLevelId !== data.educationLevelId) {
      throw new UnprocessableEntityException('LEVEL_NOT_DECLARED');
    }
    return this.prisma.offer.create({ data: { tutorProfileId: p.id, ...data } as never });
  }

  async update(userId: string, id: string, data: Record<string, unknown>) {
    const p = await this.profile(userId);
    const offer = await this.prisma.offer.findFirst({ where: { id, tutorProfileId: p.id } });
    if (!offer) throw new NotFoundException('OFFER_NOT_FOUND');
    if (offer.disabledByAdminAt) throw new UnprocessableEntityException('OFFER_DISABLED_BY_ADMIN');
    return this.prisma.offer.update({ where: { id }, data: data as never });
  }

  async setActive(userId: string, id: string, isActive: boolean) {
    const p = await this.profile(userId);
    const offer = await this.prisma.offer.findFirst({ where: { id, tutorProfileId: p.id } });
    if (!offer) throw new NotFoundException('OFFER_NOT_FOUND');
    if (isActive && offer.disabledByAdminAt) throw new UnprocessableEntityException('OFFER_DISABLED_BY_ADMIN');
    return this.prisma.offer.update({ where: { id }, data: { isActive } });
  }
}

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  private profile(userId: string) {
    return this.prisma.tutorProfile.findUniqueOrThrow({ where: { userId } });
  }

  async listMine(userId: string) {
    const p = await this.profile(userId);
    return this.prisma.place.findMany({ where: { tutorProfileId: p.id } });
  }

  async create(userId: string, data: {
    label: string; address?: string; latitude?: number;
    longitude?: number; radius?: number; type: string;
  }) {
    const p = await this.profile(userId);
    if (data.type === 'ONLINE' && (data.latitude || data.longitude)) {
      throw new UnprocessableEntityException('ONLINE_PLACE_NO_GEO');
    }
    return this.prisma.place.create({ data: { tutorProfileId: p.id, ...data } as never });
  }

  async update(userId: string, id: string, data: Record<string, unknown>) {
    const p = await this.profile(userId);
    const res = await this.prisma.place.updateMany({
      where: { id, tutorProfileId: p.id },
      data: data as never,
    });
    if (!res.count) throw new NotFoundException('PLACE_NOT_FOUND');
    return this.prisma.place.findUnique({ where: { id } });
  }
}

@Injectable()
export class AvailabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private profile(userId: string) {
    return this.prisma.tutorProfile.findUniqueOrThrow({ where: { userId } });
  }

  async listMine(userId: string) {
    const p = await this.profile(userId);
    return this.prisma.availability.findMany({ where: { tutorProfileId: p.id } });
  }

  async create(userId: string, data: {
    dayOfWeek: number; startTime: string; endTime: string; timezone?: string;
    placeId?: string; offerId?: string; validFrom?: Date; validUntil?: Date;
  }) {
    const p = await this.profile(userId);
    return this.prisma.availability.create({ data: { tutorProfileId: p.id, ...data } as never });
  }

  async update(userId: string, id: string, data: Record<string, unknown>) {
    const p = await this.profile(userId);
    const res = await this.prisma.availability.updateMany({
      where: { id, tutorProfileId: p.id },
      data: data as never,
    });
    if (!res.count) throw new NotFoundException('AVAILABILITY_NOT_FOUND');
    return this.prisma.availability.findUnique({ where: { id } });
  }

  /** UC-E08 : désactivation douce — ne pas casser silencieusement les rendez-vous. */
  async remove(userId: string, id: string) {
    const p = await this.profile(userId);
    const av = await this.prisma.availability.findFirst({ where: { id, tutorProfileId: p.id } });
    if (!av) throw new NotFoundException('AVAILABILITY_NOT_FOUND');
    const future = await this.prisma.booking.count({
      where: {
        availabilityId: id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { gt: new Date() },
      },
    });
    if (future > 0) throw new UnprocessableEntityException('AVAILABILITY_HAS_FUTURE_BOOKINGS');
    return this.prisma.availability.update({ where: { id }, data: { isActive: false } });
  }

  async blockPeriod(userId: string, data: { startAt: Date; endAt: Date; reason?: string }) {
    const p = await this.profile(userId);
    return this.prisma.blockedPeriod.create({ data: { tutorProfileId: p.id, ...data } });
  }

  async listBlocked(userId: string) {
    const p = await this.profile(userId);
    return this.prisma.blockedPeriod.findMany({
      where: { tutorProfileId: p.id, endAt: { gt: new Date() } },
    });
  }
}
