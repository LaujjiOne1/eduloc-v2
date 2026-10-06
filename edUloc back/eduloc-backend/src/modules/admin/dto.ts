import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UsersQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() page = 1;
}

export class SetUserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED']) status!: 'ACTIVE' | 'SUSPENDED';
}

export class RejectApplicationDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class SuspendTutorDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class ModerateOfferDto {
  @IsIn(['disable', 'enable']) action!: 'disable' | 'enable';
}

export class ResolveConflictDto {
  @IsString() @MaxLength(2000) resolution!: string;
}
