import { Global, Module } from '@nestjs/common';
import { LiveKitProvider } from './livekit.provider';
import { CALL_PROVIDER } from './call-provider.port';

@Global()
@Module({
  providers: [{ provide: CALL_PROVIDER, useClass: LiveKitProvider }],
  exports: [CALL_PROVIDER],
})
export class CallsInfrastructureModule {}
