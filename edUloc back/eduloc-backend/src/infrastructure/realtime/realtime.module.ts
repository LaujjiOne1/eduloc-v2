import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CentrifugoClient } from './centrifugo.client';
import { CentrifugoTokenService } from './centrifugo-token.service';
import { REALTIME_PUBLISHER } from './realtime-publisher.port';

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    CentrifugoTokenService,
    { provide: REALTIME_PUBLISHER, useClass: CentrifugoClient },
  ],
  exports: [CentrifugoTokenService, REALTIME_PUBLISHER],
})
export class RealtimeInfrastructureModule {}
