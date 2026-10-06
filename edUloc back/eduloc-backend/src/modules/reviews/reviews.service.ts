import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OutboxWriter } from '../../infrastructure/outbox/outbox-writer';
import { CacheKeys, CacheService } from '../../infrastructure/cache/cache.service';
import { CreateReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxWriter,
    private readonly cache: CacheService,
  ) {}

  async create(requesterId: string, dto: CreateReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: dto.bookingId, requesterId } });
      if (!booking) throw new NotFoundException('BOOKING_NOT_FOUND');
      if (booking.status !== 'COMPLETED') throw new UnprocessableEntityException('BOOKING_NOT_COMPLETED');
      const existing = await tx.review.findUnique({ where: { bookingId: dto.bookingId } });
      if (existing) return existing;

      // Verrou de ligne sur le profil tuteur : agrégat recalculé sans race.
      await tx.$executeRaw`SELECT id FROM tutor_profiles WHERE id = ${booking.tutorProfileId} FOR UPDATE`;
      const review = await tx.review.create({
        data: {
          bookingId: dto.bookingId,
          tutorProfileId: booking.tutorProfileId,
          requesterId,
          rating: dto.rating,
          text: dto.text ?? null,
        },
      });
      const agg = await tx.review.aggregate({
        where: { tutorProfileId: booking.tutorProfileId },
        _avg: { rating: true },
        _count: true,
      });
      await tx.tutorProfile.update({
        where: { id: booking.tutorProfileId },
        data: { rating: agg._avg.rating ?? 0, reviewsCount: agg._count },
      });
      await this.outbox.write(tx, {
        aggregateType: 'review',
        aggregateId: review.id,
        eventType: 'review.created',
        recipientIds: [booking.tutorProfileId],
        payload: { reviewId: review.id, bookingId: dto.bookingId, rating: dto.rating },
        cacheKeys: [CacheKeys.tutorPublic(booking.tutorProfileId)],
      });
      return review;
    });
  }

  async tutorReviews(tutorProfileId: string) {
    return this.prisma.review.findMany({
      where: { tutorProfileId, hiddenAt: null },
      orderBy: { createdAt: 'desc' },
      include: { requester: { select: { firstName: true, lastName: true } } },
    });
  }
}
