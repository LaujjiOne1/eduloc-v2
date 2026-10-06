import { Global, Module } from '@nestjs/common';
import { OutboxWriter } from './outbox-writer';
import { OutboxRelayService } from './outbox-relay.service';

@Global()
@Module({
  providers: [OutboxWriter, OutboxRelayService],
  exports: [OutboxWriter],
})
export class OutboxInfrastructureModule {}
