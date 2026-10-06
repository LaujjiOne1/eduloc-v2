import { IsIn, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString() token!: string;
  @IsIn(['ANDROID', 'IOS', 'WEB']) platform!: string;
}
