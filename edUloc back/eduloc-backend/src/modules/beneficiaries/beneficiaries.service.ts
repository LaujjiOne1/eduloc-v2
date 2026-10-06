import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from './dto';

@Injectable()
export class BeneficiariesService {
  constructor(private readonly prisma: PrismaService) {}

  list(requesterId: string) {
    return this.prisma.beneficiary.findMany({ where: { requesterId, archivedAt: null } });
  }

  async get(requesterId: string, id: string) {
    const b = await this.prisma.beneficiary.findFirst({ where: { id, requesterId, archivedAt: null } });
    if (!b) throw new NotFoundException('BENEFICIARY_NOT_FOUND');
    return b;
  }

  create(requesterId: string, dto: CreateBeneficiaryDto) {
    return this.prisma.beneficiary.create({
      data: {
        requesterId,
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      } as never,
    });
  }

  async update(requesterId: string, id: string, dto: UpdateBeneficiaryDto) {
    await this.get(requesterId, id);
    return this.prisma.beneficiary.update({
      where: { id },
      data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined } as never,
    });
  }

  async archive(requesterId: string, id: string) {
    const b = await this.get(requesterId, id);
    const future = await this.prisma.booking.count({
      where: {
        beneficiaryId: b.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { gt: new Date() },
      },
    });
    if (future > 0) throw new ForbiddenException('BENEFICIARY_HAS_FUTURE_BOOKINGS');
    return this.prisma.beneficiary.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
