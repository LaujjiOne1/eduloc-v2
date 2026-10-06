import { Injectable } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { AppConfig } from '../../core/config/app.config';

@Injectable()
export class CentrifugoTokenService {
  constructor(private readonly cfg: AppConfig) {}

  connectionToken(userId: string): string {
    return sign({ sub: userId }, this.cfg.centrifugoTokenSecret, {
      algorithm: 'HS256',
      expiresIn: '15m',
    });
  }

  subscriptionToken(userId: string, channel: string): string {
    return sign({ sub: userId, channel }, this.cfg.centrifugoSubSecret, {
      algorithm: 'HS256',
      expiresIn: '15m',
    });
  }
}
