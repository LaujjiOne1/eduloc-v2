import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import { AppConfig } from '../../core/config/app.config';

export const BOOKING_EXPIRY_QUEUE = 'booking-expiry';

/** BullMQ gère sa propre connexion Redis (sans limite de tentatives par commande, requise par les workers). */
export function bullConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

/** Sans limite de tentatives, BullMQ attend indéfiniment un Redis absent : on borne l'attente pour ne jamais bloquer une requête. */
const within = <T>(work: Promise<T>, ms = 3000): Promise<T> =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis ne répond pas')), ms).unref())]);

/**
 * Producteur de la file « booking-expiry » : un job différé par demande en attente, qui se déclenche à `expiresAt`.
 * La base fait foi : le job ne fait que CONSTATER l'échéance (BookingsService.expireIfDue relit l'état), donc un job perdu
 * ou en double est sans conséquence ; le balayage du worker rattrape les oublis (docs/architecture/CHOIX-TECHNOLOGIQUES.md §4).
 */
@Injectable()
export class BookingExpiryQueue implements OnModuleDestroy {
  private readonly logger = new Logger(BookingExpiryQueue.name);
  private queue: Queue | null = null;

  constructor(private readonly cfg: AppConfig) {}

  /** Même mécanisme pour le délai de paiement d'une réservation confirmée. */
  static paymentJobId(bookingId: string): string {
    return `booking-${bookingId}-payment-expire`;
  }

  /** « : » est interdit dans un identifiant BullMQ : on garde l'idée `booking:<id>:expire` avec des tirets. */
  static jobId(bookingId: string): string {
    return `booking-${bookingId}-expire`;
  }

  private get q(): Queue {
    this.queue ??= new Queue(BOOKING_EXPIRY_QUEUE, { connection: bullConnection(this.cfg.redisUrl) });
    return this.queue;
  }

  /** Idempotent : l'identifiant est unique par demande, un second appel ne crée pas de second job actif. */
  async schedule(bookingId: string, expiresAt: Date): Promise<void> {
    await within(this.q.add('expire', { bookingId }, {
      jobId: BookingExpiryQueue.jobId(bookingId),
      delay: Math.max(0, expiresAt.getTime() - Date.now()),
      removeOnComplete: true,
      removeOnFail: 100,
    }));
  }

  /** Délai de paiement : annule la réservation confirmée restée impayée à `dueAt` (le job relit l'état avant d'agir). */
  async schedulePayment(bookingId: string, dueAt: Date): Promise<void> {
    await within(this.q.add('payment-expire', { bookingId }, {
      jobId: BookingExpiryQueue.paymentJobId(bookingId),
      delay: Math.max(0, dueAt.getTime() - Date.now()),
      removeOnComplete: true,
      removeOnFail: 100,
    }));
  }

  /** Meilleur effort : un job resté en file est de toute façon ignoré si la demande n'est plus en attente. */
  async cancel(bookingId: string): Promise<void> {
    try {
      await within((async () => (await this.q.getJob(BookingExpiryQueue.jobId(bookingId)))?.remove())());
    } catch (err) {
      this.logger.warn(`Job d'expiration de ${bookingId} non retiré : ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
