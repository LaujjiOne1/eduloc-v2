import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { AppConfig } from '../config/app.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(cfg: AppConfig) {
    const pool = new pg.Pool({
      connectionString: cfg.databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5_000,
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
