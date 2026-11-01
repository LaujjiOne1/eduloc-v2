import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/rate-limit.service';
import { PayGatewayClient } from './pay-gateway.client';
import { PaymentsController, PaymentsWebhookController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * Passerelle avec le service de paiement externe (eduloc-pay-subscriptions). Faible couplage : les deux services ne
 * partagent ni base ni code. Ils échangent un ticket signé (EduLoc → page de paiement), une notification signée
 * (service de paiement → EduLoc) et, de serveur à serveur, une requête de statut. Voir docs/payments-integration.md.
 */
@Module({
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService, PayGatewayClient, RateLimitService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
