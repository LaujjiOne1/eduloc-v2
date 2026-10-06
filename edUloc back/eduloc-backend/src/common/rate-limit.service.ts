import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../core/redis/redis.service';

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Fenêtre fixe. Lève 429 si la limite est dépassée.
   * Ex: consume(`rl:otp:${bookingId}`, 5, 3600)
   */
  async consume(key: string, limit: number, windowSeconds: number): Promise<void> {
    const n = await this.redis.hit(key, windowSeconds);
    if (n > limit) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
