import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString,
  IsUUID, Matches, Max, MaxLength, Min,
} from 'class-validator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import {
  AvailabilitiesService, OffersService, PlacesService, TutorsService,
} from './tutors.service';

class ProfileDto {
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @MaxLength(512) profilePhoto?: string;
  @IsOptional() @IsString() @MaxLength(2000) experience?: string;
  @IsOptional() @IsString() @MaxLength(2000) educationBackground?: string;
}

class SubjectDto {
  @IsUUID() subjectId!: string;
  @IsUUID() educationLevelId!: string;
  @IsOptional() @IsString() @MaxLength(1000) competenceDescription?: string;
}

class OfferDto {
  @IsUUID() subjectId!: string;
  @IsOptional() @IsUUID() educationLevelId?: string;
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(5000) description!: string;
  @IsOptional() @IsEnum(['ONLINE', 'IN_PERSON', 'BOTH']) format?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(480) durationMinutes?: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}

class SetActiveDto {
  @IsEnum(['true', 'false']) isActive!: 'true' | 'false';
}

class PlaceDto {
  @IsString() @MaxLength(200) label!: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) radius?: number;
  @IsEnum(['TUTOR_HOME', 'BENEFICIARY_HOME', 'PUBLIC_PLACE', 'ONLINE']) type!: string;
}

class AvailabilityDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsUUID() placeId?: string;
  @IsOptional() @IsUUID() offerId?: string;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
}

class BlockPeriodDto {
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

@ApiTags('tutors')
@ApiBearerAuth()
@Controller('tutors')
export class TutorsController {
  constructor(private readonly service: TutorsService) {}

  @Get('me/profile')
  me(@CurrentUser() u: AuthUser) {
    return this.service.myProfile(u.userId);
  }

  @Post('me/profile')
  create(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) {
    return this.service.createProfile(u.userId, {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
    });
  }

  @Patch('me/profile')
  update(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) {
    return this.service.updateProfile(u.userId, dto);
  }

  @Post('me/subjects')
  addSubject(@CurrentUser() u: AuthUser, @Body() dto: SubjectDto) {
    return this.service.addSubject(u.userId, dto);
  }

  @Delete('me/subjects/:id')
  removeSubject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeSubject(u.userId, id);
  }

  @Post('me/application/submit')
  submit(@CurrentUser() u: AuthUser) {
    return this.service.submitApplication(u.userId);
  }
}

@ApiTags('offers')
@ApiBearerAuth()
@Controller('tutors/me/offers')
export class OffersController {
  constructor(private readonly service: OffersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.service.listMine(u.userId); }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: OfferDto) { return this.service.create(u.userId, dto); }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<OfferDto>) {
    return this.service.update(u.userId, id, dto);
  }

  @Post(':id/active')
  setActive(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: SetActiveDto) {
    return this.service.setActive(u.userId, id, body.isActive === 'true');
  }
}

@ApiTags('places')
@ApiBearerAuth()
@Controller('tutors/me/places')
export class PlacesController {
  constructor(private readonly service: PlacesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.service.listMine(u.userId); }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: PlaceDto) { return this.service.create(u.userId, dto); }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<PlaceDto>) {
    return this.service.update(u.userId, id, dto);
  }
}

@ApiTags('availabilities')
@ApiBearerAuth()
@Controller('tutors/me/availabilities')
export class AvailabilitiesController {
  constructor(private readonly service: AvailabilitiesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.service.listMine(u.userId); }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: AvailabilityDto) {
    return this.service.create(u.userId, {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    });
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<AvailabilityDto>) {
    return this.service.update(u.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(u.userId, id);
  }

  @Post('blocks')
  block(@CurrentUser() u: AuthUser, @Body() dto: BlockPeriodDto) {
    return this.service.blockPeriod(u.userId, {
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      reason: dto.reason,
    });
  }

  @Get('blocks')
  blocks(@CurrentUser() u: AuthUser) { return this.service.listBlocked(u.userId); }
}
