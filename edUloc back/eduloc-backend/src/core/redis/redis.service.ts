import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/app.config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(cfg: AppConfig) {
    this.client = new Redis(cfg.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 });
  }

  get raw(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
    else await this.client.set(key, value);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  }

  async getDel(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  /** Fenêtre fixe : INCR + EXPIRE. Retourne le compteur courant. */
  async hit(key: string, windowSeconds: number): Promise<number> {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, windowSeconds);
    return n;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
