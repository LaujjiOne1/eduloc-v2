import {
  Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req, UseInterceptors, type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { PaymentsService, SIGNATURE_HEADER } from './payments.service';

/** Côté application : émettre un ticket de paiement, suivre son statut. Aucune route n'accepte un montant ni une « preuve ». */
@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /** Émet un ticket (et le lien de la page de paiement) pour une réservation du demandeur. Idempotent via Idempotency-Key. */
  @Post('bookings/:bookingId/payments')
  @UseInterceptors(IdempotencyInterceptor)
  createTicket(@CurrentUser() u: AuthUser, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.service.createTicket(u.userId, bookingId);
  }

  @Get('bookings/:bookingId/payments')
  list(@CurrentUser() u: AuthUser, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.service.listForBooking(u.userId, bookingId);
  }

  /** Statut d'un paiement : la SEULE source de vérité pour l'application après son retour de la page de paiement (SEC-06). */
  @Get('payments/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(u.userId, id);
  }
}

/** Côté service de paiement : notification signée du résultat. Publique (pas de JWT) mais authentifiée par signature HMAC. */
@ApiTags('payments')
@Controller('payments')
export class PaymentsWebhookController {
  constructor(private readonly service: PaymentsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers(SIGNATURE_HEADER) signature: string | undefined) {
    return this.service.handleWebhook(req.rawBody?.toString('utf8'), signature);
  }
}
