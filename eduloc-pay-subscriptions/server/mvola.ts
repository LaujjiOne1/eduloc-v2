import { randomUUID } from 'node:crypto';

/**
 * Adaptateur MVola (Madagascar, Telma) — flux « merchant pay » : le serveur demande le paiement, le CLIENT le confirme sur son
 * téléphone dans le canal officiel de l'opérateur. EduLoc ne demande ni ne reçoit JAMAIS le code secret (MM-01).
 *
 * ⚠ Écrit d'après le flux publié de l'API MVola (jeton client_credentials, POST merchantpay → 202 + serverCorrelationId, puis
 * consultation du statut). À valider contre vos identifiants SANDBOX avant toute mise en production : les noms exacts de
 * champs et d'en-têtes dépendent de la version de l'API qui vous est ouverte.
 */
export type MobileMoneyState = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface MobileMoneyStatus {
  state: MobileMoneyState;
  /** Référence de la transaction chez l'opérateur, disponible une fois la transaction terminée. */
  transactionRef: string | null;
  /** Montant et devise réellement constatés chez l'opérateur (vérifiés avant de valider, MM-03). */
  verifiedAmount: string | null;
  currency: string | null;
}

type FetchLike = typeof fetch;

export class MobileMoneyError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
    this.name = 'MobileMoneyError';
  }
}

export interface MvolaConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  merchantMsisdn: string;
  partnerName: string;
}

const PATH = '/mvola/mm/transactions/type/merchantpay/1.0.0';

/** « 034 12 345 67 » ou « +261 34 12 345 67 » → « 0341234567 ». null si le numéro n'est pas un numéro malgache plausible. */
export function normalizeMsisdn(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const local = digits.startsWith('+261') ? `0${digits.slice(4)}` : digits.startsWith('261') ? `0${digits.slice(3)}` : digits;
  return /^03\d{8}$/.test(local) ? local : null;
}

export class MvolaClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly cfg: MvolaConfig,
    private readonly http: FetchLike = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 15_000) return this.token.value;
    let response: Response;
    try {
      response = await this.http(`${this.cfg.baseUrl}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'EXT_INT_MVOLA_SCOPE' }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new MobileMoneyError(`MVola injoignable : ${error instanceof Error ? error.message : String(error)}`);
    }
    const body = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!response.ok || !body?.access_token) throw new MobileMoneyError('MVola a refusé l’authentification.', response.status);
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3000) * 1000 };
    return body.access_token;
  }

  private headers(token: string, extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Version: '1.0',
      'X-CorrelationID': randomUUID(),
      UserLanguage: 'FR',
      UserAccountIdentifier: `msisdn;${this.cfg.merchantMsisdn}`,
      partnerName: this.cfg.partnerName,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...extra,
    };
  }

  /**
   * Demande le paiement : MVola répond « 202 accepté » (pas un succès, MM-02) et envoie une demande de confirmation au téléphone
   * du client. `reference` = identifiant du paiement EduLoc (clé d'idempotence côté opérateur).
   */
  async requestPayment(args: { amount: string; reference: string; description: string; payerMsisdn: string; callbackUrl: string | null }): Promise<{ correlationId: string }> {
    const token = await this.accessToken();
    const body = {
      amount: String(Math.round(Number(args.amount))),
      currency: 'Ar',
      descriptionText: args.description.slice(0, 50).replace(/[^\w .,'-]/g, ''),
      requestingOrganisationTransactionReference: args.reference,
      requestDate: new Date().toISOString(),
      originalTransactionReference: args.reference,
      debitParty: [{ key: 'msisdn', value: args.payerMsisdn }],
      creditParty: [{ key: 'msisdn', value: this.cfg.merchantMsisdn }],
      metadata: [
        { key: 'partnerName', value: this.cfg.partnerName },
        { key: 'fc', value: 'USD' },
        { key: 'amountFc', value: '1' },
      ],
    };
    let response: Response;
    try {
      response = await this.http(`${this.cfg.baseUrl}${PATH}/`, {
        method: 'POST',
        headers: this.headers(token, args.callbackUrl ? { 'X-Callback-URL': args.callbackUrl } : {}),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new MobileMoneyError(`MVola injoignable : ${error instanceof Error ? error.message : String(error)}`);
    }
    const result = (await response.json().catch(() => null)) as { serverCorrelationId?: string; status?: string } | null;
    if (response.status !== 202 && !response.ok) throw new MobileMoneyError('MVola a refusé la demande de paiement.', response.status);
    if (!result?.serverCorrelationId) throw new MobileMoneyError('Réponse MVola inattendue (référence de suivi absente).', response.status);
    return { correlationId: result.serverCorrelationId };
  }

  /** Interroge l'opérateur sur le résultat FINANCIER : c'est la seule source de vérité (jamais le corps d'un rappel). */
  async status(correlationId: string): Promise<MobileMoneyStatus> {
    const token = await this.accessToken();
    const read = async (path: string) => {
      let response: Response;
      try {
        response = await this.http(`${this.cfg.baseUrl}${PATH}/${path}`, { method: 'GET', headers: this.headers(token), signal: AbortSignal.timeout(10_000) });
      } catch (error) {
        throw new MobileMoneyError(`MVola injoignable : ${error instanceof Error ? error.message : String(error)}`);
      }
      const body = (await response.json().catch(() => null)) as Record<string, any> | null;
      if (!response.ok) throw new MobileMoneyError('MVola a refusé la consultation du statut.', response.status);
      return body ?? {};
    };

    const summary = await read(`status/${encodeURIComponent(correlationId)}`);
    const raw = String(summary.status ?? '').toLowerCase();
    if (raw === 'failed' || raw === 'rejected') return { state: 'FAILED', transactionRef: null, verifiedAmount: null, currency: null };
    if (raw !== 'completed') return { state: 'PENDING', transactionRef: null, verifiedAmount: null, currency: null };

    // Terminé : on relit la transaction pour constater montant et devise chez l'opérateur avant de valider.
    const objectReference = String(summary.objectReference ?? '');
    if (!objectReference) return { state: 'PENDING', transactionRef: null, verifiedAmount: null, currency: null };
    const detail = await read(encodeURIComponent(objectReference));
    const amount = Number(detail.amount);
    return {
      state: 'SUCCEEDED',
      transactionRef: objectReference,
      verifiedAmount: Number.isFinite(amount) ? amount.toFixed(2) : null,
      currency: detail.currency ? (String(detail.currency).toLowerCase() === 'ar' ? 'MGA' : String(detail.currency).toUpperCase()) : null,
    };
  }
}
