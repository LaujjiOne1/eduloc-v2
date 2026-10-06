import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CacheKeys, CacheService } from '../../infrastructure/cache/cache.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  subjects() {
    return this.cache.wrap(CacheKeys.subjects(), 86_400, () =>
      this.prisma.subject.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    );
  }

  levels() {
    return this.cache.wrap(CacheKeys.levels(), 86_400, () =>
      this.prisma.educationLevel.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }),
    );
  }
}
