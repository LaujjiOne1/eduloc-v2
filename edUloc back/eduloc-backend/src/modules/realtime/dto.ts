import { IsString, Matches } from 'class-validator';

export class SubscriptionQueryDto {
  @IsString()
  @Matches(/^(conv|slots):[a-zA-Z0-9-]+$/)
  channel!: string;
}
