import { Injectable } from '@nestjs/common';
import { RedisService } from '../../core/redis/redis.service';

export const CacheKeys = {
  subjects: () => 'ref:subjects',
  levels: () => 'ref:levels',
  tutorPublic: (tutorProfileId: string) => `tutor:public:${tutorProfileId}`,
  search: (hash: string) => `search:${hash}`,
  slots: (tutorProfileId: string, date: string) => `slots:${tutorProfileId}:${date}`,
  adminDashboard: () => 'admin:dashboard',
  mediaUrl: (attachmentId: string) => `media:url:${attachmentId}`,
  upload: (uploadId: string) => `upload:${uploadId}`,
} as const;

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), ttlSeconds);
  }

  async wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;
    const value = await producer();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  async invalidate(...keys: string[]): Promise<void> {
    await this.redis.del(...keys);
  }
}
