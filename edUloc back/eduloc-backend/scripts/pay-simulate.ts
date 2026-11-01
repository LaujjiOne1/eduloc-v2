/**
 * Simule le service de paiement tant que son API n'est pas prête : envoie au backend une notification correctement signée.
 *
 *   npx tsx scripts/pay-simulate.ts <payment_id> <booking_id> <amount> [SUCCEEDED|FAILED|PENDING|CANCELLED] [visa|mobile]
 *
 * Lit API_URL et PAY_WEBHOOK_SECRET dans .env. À n'utiliser qu'en développement : en production le secret n'est pas sur ce poste.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { buildSignatureHeader } from '../src/modules/payments/domain/webhook-signature';

const [paymentId, bookingId, amount, status = 'SUCCEEDED', kind = 'visa'] = process.argv.slice(2);
const secret = process.env.PAY_WEBHOOK_SECRET ?? '';
const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

if (!paymentId || !bookingId || !amount) {
  console.error('Usage : npx tsx scripts/pay-simulate.ts <payment_id> <booking_id> <amount> [statut] [visa|mobile]');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Refusé : ce script de simulation est réservé au développement.');
  process.exit(1);
}
if (secret.length < 32) {
  console.error('PAY_WEBHOOK_SECRET (≥ 32 caractères) absent de l’environnement.');
  process.exit(1);
}

const data: Record<string, unknown> = { payment_id: paymentId, reservation_id: bookingId, status };
if (status === 'SUCCEEDED') {
  Object.assign(
    data,
    { amount: Number(amount).toFixed(2), currency: 'MGA' },
    kind === 'mobile'
      ? { method: 'mobile_money', provider: 'orange-money', provider_ref: `OM_SIM_${Date.now()}` }
      : { method: 'visa_stripe', provider: 'stripe', provider_ref: `pi_sim_${Date.now()}`, card_brand: 'visa', card_last4: '4242' },
  );
}

async function main(): Promise<void> {
  const body = JSON.stringify({ event_id: `evt_sim_${randomUUID()}`, type: 'payment.updated', data });
  const response = await fetch(`${apiUrl}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Eduloc-Pay-Signature': buildSignatureHeader(secret, body) },
    body,
  });
  console.log(response.status, await response.text());
}

void main();
