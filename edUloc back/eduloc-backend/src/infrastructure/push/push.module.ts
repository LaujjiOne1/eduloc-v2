import { Global, Module } from '@nestjs/common';
import { FcmProvider } from './fcm.provider';
import { PUSH_PROVIDER } from './push-provider.port';

@Global()
@Module({
  providers: [{ provide: PUSH_PROVIDER, useClass: FcmProvider }],
  exports: [PUSH_PROVIDER],
})
export class PushInfrastructureModule {}
