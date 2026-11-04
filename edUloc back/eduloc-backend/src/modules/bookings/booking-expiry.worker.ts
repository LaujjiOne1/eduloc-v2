import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Worker } from 'bullmq';
import { AppConfig } from '../../core/config/app.config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BOOKING_EXPIRY_QUEUE, BookingExpiryQueue, bullConnection } from './booking-expiry.queue';
import { BookingsService } from './bookings.service';

/**
 * Exécute les jobs d'expiration des demandes (BullMQ : un seul worker traite chaque job, même avec plusieurs instances)
 * et balaie toutes les 5 minutes les demandes échues dont le job aurait été perdu (Redis vidé, redémarrage…).
 * Au démarrage, replanifie les demandes encore valables : l'ajout est idempotent (même identifiant de job).
 */
@Injectable()
export class BookingExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpiryWorker.name);
  private worker: Worker | null = null;

  constructor(
    private readonly cfg: AppConfig,
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly queue: BookingExpiryQueue,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      BOOKING_EXPIRY_QUEUE,
      async (job) => {
        const bookingId = String(job.data.bookingId);
        if (job.name === 'payment-expire') {
          if (await this.bookings.expirePaymentIfDue(bookingId)) this.logger.log(`Réservation ${bookingId} annulée faute de paiement.`);
        } else if (await this.bookings.expireIfDue(bookingId)) {
          this.logger.log(`Demande ${bookingId} expirée.`);
        }
      },
      { connection: bullConnection(this.cfg.redisUrl), concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`Expiration ${job?.id} en échec : ${err.message}`));
    this.worker.on('error', (err) => this.logger.warn(`File d'expiration : ${err.message}`));
    void this.restore().catch((err: Error) => this.logger.warn(`Replanification des expirations impossible : ${err.message}`));
  }

  /** Replanifie les demandes en attente encore valables (file vidée ou instance redémarrée). */
  async restore(now = new Date()): Promise<number> {
    const pending = await this.prisma.booking.findMany({
      where: { status: 'PENDING', expiresAt: { gt: now } },
      select: { id: true, expiresAt: true },
      take: 1000,
    });
    for (const b of pending) await this.queue.schedule(b.id, b.expiresAt!);
    const unpaid = await this.prisma.booking.findMany({
      where: { status: 'CONFIRMED', paymentDueAt: { gt: now } },
      select: { id: true, paymentDueAt: true },
      take: 1000,
    });
    for (const b of unpaid) await this.queue.schedulePayment(b.id, b.paymentDueAt!);
    return pending.length + unpaid.length;
  }

  /** Visible pour les tests : expire les demandes échues dont le job n'est pas passé, renvoie leur nombre. */
  @Cron('*/5 * * * *')
  async sweep(now = new Date()): Promise<number> {
    const overdue = await this.prisma.booking.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      select: { id: true },
      take: 200,
    });
    let expired = 0;
    for (const b of overdue) if (await this.bookings.expireIfDue(b.id, now)) expired += 1;
    // Réservations confirmées dont le délai de paiement est écoulé sans paiement réussi.
    const unpaid = await this.prisma.booking.findMany({
      where: { status: 'CONFIRMED', paymentDueAt: { lte: now }, payments: { none: { status: 'SUCCEEDED' } } },
      select: { id: true },
      take: 200,
    });
    for (const b of unpaid) if (await this.bookings.expirePaymentIfDue(b.id, now)) expired += 1;
    if (expired > 0) this.logger.log(`${expired} échéance(s) rattrapée(s) par le balayage.`);
    return expired;
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
