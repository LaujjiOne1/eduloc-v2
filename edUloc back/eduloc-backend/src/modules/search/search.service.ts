import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CacheKeys, CacheService } from '../../infrastructure/cache/cache.service';
import { SlotPolicy, AvailabilityRule } from '../bookings/domain/slot-policy';

interface SearchRow {
  offerId: string;
  tutorProfileId: string;
  distanceM: number | null;
  title: string;
  price: string;
  durationMinutes: number;
  format: string;
  displayName: string | null;
  rating: number;
  reviewsCount: number;
  placeId: string | null;
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** UC-B03 : recherche géo PostGIS (ADR-11 — pas d'OSRM). Coordonnées arrondies ~500 m pour le cache. */
  async searchOffers(params: {
    subjectId: string;
    levelId?: string;
    lat: number;
    lng: number;
    radiusM: number;
    limit: number;
  }) {
    const latR = Math.round(params.lat * 2000) / 2000;
    const lngR = Math.round(params.lng * 2000) / 2000;
    const hash = createHash('sha1')
      .update(JSON.stringify({ ...params, lat: latR, lng: lngR }))
      .digest('hex');
    return this.cache.wrap(CacheKeys.search(hash), 90, async () => {
      const rows = await this.prisma.$queryRaw<SearchRow[]>`
        SELECT o.id AS "offerId", tp.id AS "tutorProfileId",
               ST_Distance(p.location, ST_MakePoint(${params.lng}, ${params.lat})::geography) AS "distanceM",
               o.title, o.price, o."durationMinutes", o.format,
               tp."displayName", tp.rating, tp."reviewsCount",
               p.id AS "placeId", p.label AS "placeLabel", p.latitude, p.longitude
        FROM offers o
        JOIN tutor_profiles tp ON tp.id = o."tutorProfileId" AND tp."isVisible" = true
        JOIN places p ON p."tutorProfileId" = tp.id AND p."isActive" = true
        WHERE o."isActive" = true AND o."disabledByAdminAt" IS NULL
          AND o."subjectId" = ${params.subjectId}
          AND (${params.levelId ?? null}::text IS NULL OR o."educationLevelId" = ${params.levelId ?? null})
          AND (p.type = 'ONLINE'
               OR ST_DWithin(p.location, ST_MakePoint(${params.lng}, ${params.lat})::geography,
                             GREATEST(${params.radiusM}, COALESCE(p.radius, 0))))
        ORDER BY "distanceM" NULLS LAST, tp.rating DESC
        LIMIT ${params.limit}`;
      return this.withSlots(rows.slice(0, 20));
    });
  }

  /** Anti-N+1 (TDD 2.6) : 2 requêtes pour 20 tuteurs, créneaux calculés en mémoire. */
  private async withSlots(rows: SearchRow[]) {
    if (!rows.length) return [];
    const tutorIds = rows.map((r) => r.tutorProfileId);
    const from = new Date(Date.now() + 2 * 3_600_000);
    const to = new Date(Date.now() + 14 * 86_400_000);
    const [rawRules, rawBusy, rawBlocked] = await Promise.all([
      this.prisma.availability.findMany({
        where: { tutorProfileId: { in: tutorIds }, isActive: true },
        include: { place: true },
      }),
      this.prisma.booking.findMany({
        where: {
          tutorProfileId: { in: tutorIds },
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          startAt: { lt: to },
          endAt: { gt: from },
        },
        select: { tutorProfileId: true, startAt: true, endAt: true },
      }),
      this.prisma.blockedPeriod.findMany({
        where: { tutorProfileId: { in: tutorIds }, startAt: { lt: to }, endAt: { gt: from } },
        select: { tutorProfileId: true, startAt: true, endAt: true },
      }),
    ]);
    const rulesByTutor = new Map<string, AvailabilityRule[]>();
    for (const r of rawRules) {
      const list = rulesByTutor.get(r.tutorProfileId) ?? [];
      list.push({
        id: r.id, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
        timezone: r.timezone, validFrom: r.validFrom, validUntil: r.validUntil,
        isActive: r.isActive, offerId: r.offerId, placeId: r.placeId,
        placeType: r.place?.type ?? null,
      });
      rulesByTutor.set(r.tutorProfileId, list);
    }
    const busyByTutor = new Map<string, { startAt: Date; endAt: Date }[]>();
    for (const b of rawBusy) {
      const list = busyByTutor.get(b.tutorProfileId) ?? [];
      list.push({ startAt: b.startAt, endAt: b.endAt });
      busyByTutor.set(b.tutorProfileId, list);
    }
    const blockedByTutor = new Map<string, { startAt: Date; endAt: Date }[]>();
    for (const b of rawBlocked) {
      const list = blockedByTutor.get(b.tutorProfileId) ?? [];
      list.push({ startAt: b.startAt, endAt: b.endAt });
      blockedByTutor.set(b.tutorProfileId, list);
    }
    return rows.map((r) => {
      const slots = SlotPolicy.computeSlots(
        (rulesByTutor.get(r.tutorProfileId) ?? []).filter((x) => !x.offerId || x.offerId === r.offerId),
        blockedByTutor.get(r.tutorProfileId) ?? [],
        busyByTutor.get(r.tutorProfileId) ?? [],
        from, 14, 60, 'ONLINE', r.offerId,
      ).slice(0, 5);
      return { ...r, price: Number(r.price), nextSlots: slots };
    });
  }

  /** UC-B05 : profil public complet (cache 10 min). */
  async tutorPublic(tutorProfileId: string) {
    return this.cache.wrap(CacheKeys.tutorPublic(tutorProfileId), 600, async () => {
      return this.prisma.tutorProfile.findFirst({
        where: { id: tutorProfileId, isVisible: true, suspendedAt: null },
        select: {
          id: true, displayName: true, bio: true, profilePhoto: true, experience: true,
          rating: true, reviewsCount: true,
          subjects: { include: { subject: true, educationLevel: true } },
          offers: { where: { isActive: true, disabledByAdminAt: null } },
          places: { where: { isActive: true } },
          reviews: {
            where: { hiddenAt: null },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { requester: { select: { firstName: true, lastName: true } } },
          },
        },
      });
    });
  }

  /** UC-D01 : créneaux calculés d'une journée (cache 60 s). */
  async daySlots(tutorProfileId: string, offerId: string, date: string, durationMinutes: number) {
    return this.cache.wrap(CacheKeys.slots(tutorProfileId, date), 60, async () => {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      const rules = await this.prisma.availability.findMany({
        where: {
          tutorProfileId,
          isActive: true,
          OR: [{ offerId }, { offerId: null }],
        },
        include: { place: true },
      });
      const blocked = await this.prisma.blockedPeriod.findMany({
        where: {
          tutorProfileId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
      });
      const busy = await this.prisma.booking.findMany({
        where: {
          tutorProfileId,
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
      });
      const mapped: AvailabilityRule[] = rules.map((r) => ({
        id: r.id, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
        timezone: r.timezone, validFrom: r.validFrom, validUntil: r.validUntil,
        isActive: r.isActive, offerId: r.offerId, placeId: r.placeId,
        placeType: r.place?.type ?? null,
      }));
      return SlotPolicy.computeSlots(mapped, blocked, busy, dayStart, 1, durationMinutes, 'ONLINE', offerId);
    });
  }
}
