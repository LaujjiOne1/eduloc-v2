import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../core/redis/redis.service';

const WINDOW_SECONDS = 24 * 3600;

/**
 * Idempotence des créations (UC-D05) : en-tête Idempotency-Key.
 * Si la clé a déjà été vue, la réponse mémorisée (24 h) est renvoyée telle quelle.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { userId: string } }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.headers['idempotency-key'];
    if (req.method !== 'POST' || typeof key !== 'string' || key.length < 8 || !req.user) {
      return next.handle();
    }

    const redisKey = `idem:${req.user.userId}:${key}`;
    return new Observable((subscriber) => {
      void (async () => {
        const cached = await this.redis.get(redisKey);
        if (cached) {
          const saved = JSON.parse(cached) as { status: number; body: unknown };
          res.status(saved.status).json(saved.body);
          subscriber.complete();
          return;
        }
        next.handle()
          .pipe(
            tap((body) => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                void this.redis.set(
                  redisKey,
                  JSON.stringify({ status: res.statusCode, body }),
                  WINDOW_SECONDS,
                );
              }
            }),
          )
          .subscribe(subscriber);
      })();
    });
  }
}
