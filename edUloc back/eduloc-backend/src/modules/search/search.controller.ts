import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { SearchService } from './search.service';

class SearchQueryDto {
  @IsUUID() subjectId!: string;
  @IsOptional() @IsUUID() levelId?: string;
  @Type(() => Number) @IsInt() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsInt() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(100) @Max(100_000) radiusM = 10_000;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Public()
  @Get('offers')
  offers(@Query() q: SearchQueryDto) {
    return this.service.searchOffers(q);
  }

  @Public()
  @Get('tutors/:id')
  tutor(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.tutorPublic(id);
  }

  @Public()
  @Get('tutors/:id/slots')
  slots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('offerId') offerId: string,
    @Query('date') date: string,
    @Query('duration') duration = '60',
  ) {
    return this.service.daySlots(id, offerId, date, parseInt(duration, 10) || 60);
  }
}
