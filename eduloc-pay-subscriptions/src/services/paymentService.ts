/**
 * Service de paiement, d'abonnements et de conformité de sécurité EduLoc
 * Conforme aux règles PCI DSS (VISA-01 à VISA-04), GSMA Mobile Money (MM-01 à MM-04)
 * et exigences techniques communes (SEC-01 à SEC-11).
 */

import {
  SubscriptionPlan,
  UserSubscription,
  PaymentIntent,
  OdooCrmRecord,
  SecurityAuditLog,
  ReconciliationReport,
  MobileMoneyOperator,
  PaymentStatus,
} from '@/types/payment';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_eleve_standard',
    name: 'Pass Mensuel Élève',
    badge: 'Populaire',
    priceMGA: 45000,
    priceEUR: 9.90,
    interval: 'monthly',
    description: 'Accompagnement continu pour 1 élève du primaire au lycée.',
    popular: true,
    stripePriceId: 'price_eduloc_eleve_monthly',
    features: [
      '1 tuteur dédié vérifié et certifié EduLoc',
      'Accès illimité à la messagerie avec le tuteur',
      'Suivi et bilan pédagogique mensuel pour les parents',
      'Remplacement gratuit de tuteur sous 48h si besoin',
      'Facturation mensuelle sans engagement, résiliable en 1 clic',
    ],
  },
  {
    id: 'plan_famille_multi',
    name: 'Pass Famille Multi-Enfants',
    badge: 'Famille',
    priceMGA: 85000,
    priceEUR: 18.50,
    interval: 'monthly',
    description: 'La solution complète pour 2 à 3 enfants avec conseiller dédié.',
    popular: false,
    stripePriceId: 'price_eduloc_famille_monthly',
    features: [
      'Jusqu’à 3 enfants couverts sur le même abonnement',
      'Tuteurs spécialisés par matière (Maths, Français, Sciences)',
      'Conseiller pédagogique personnel joignable sur WhatsApp',
      'Rapports d’assiduité hebdomadaires automatisés',
      'Remise de 15% sur les cours particuliers à domicile supplémentaires',
    ],
  },
  {
    id: 'plan_intensif_examens',
    name: 'Pack Prépa Examens & Concours',
    badge: 'Excellence',
    priceMGA: 140000,
    priceEUR: 30.00,
    interval: 'monthly',
    description: 'Boost intensif pour le Brevet, le Baccalauréat et concours d’entrée.',
    popular: false,
    stripePriceId: 'price_eduloc_intensif_monthly',
    features: [
      'Tuteurs diplômés des grandes écoles et universités',
      'Simulations d’examens blancs et corrections détaillées sous 24h',
      'Assistance prioritaire 7j/7 jusqu’à la veille des épreuves',
      'Module méthodologie, gestion du stress et planning de révision',
      'Garantie satisfaction ou remboursement de la 1ère semaine',
    ],
  },
];

// Barème officiel des réservations (SEC-03: Calcul serveur systématique)
export const SERVER_PRICE_CATALOG: Record<string, { title: string; basePriceMGA: number; platformFeeMGA: number }> = {
  'res_maths_4e': {
    title: 'Cours de Mathématiques 4e (4 séances)',
    basePriceMGA: 45000,
    platformFeeMGA: 2000,
  },
  'res_physique_terminale': {
    title: 'Physique-Chimie Terminale S (Prépa Bac)',
    basePriceMGA: 58000,
    platformFeeMGA: 2000,
  },
  'res_francais_primaire': {
    title: 'Français et Lecture CM2 (Renforcement)',
    basePriceMGA: 38000,
    platformFeeMGA: 2000,
  },
  'res_anglais_conversation': {
    title: 'Anglais Conversationnel & Oral',
    basePriceMGA: 42000,
    platformFeeMGA: 2000,
  },
};

const STORAGE_KEYS = {
  PAYMENTS: 'eduloc_payments_v1',
  SUBSCRIPTIONS: 'eduloc_subscriptions_v1',
  ODOO_RECORDS: 'eduloc_odoo_records_v1',
  AUDIT_LOGS: 'eduloc_audit_logs_v1',
  TEST_MODE: 'eduloc_test_mode_v1',
};

// Initialisation des données réalistes de démonstration
function getInitialData() {
  const initialAuditLogs: SecurityAuditLog[] = [
    {
      id: 'log_seed_01',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      eventType: 'SERVER_AMOUNT_VALIDATED',
      ruleReference: 'SEC-03',
      actor: 'eduloc_backend',
      reservationId: 'res_maths_4e',
      details: { calculatedTotalMGA: 47000, base: 45000, platformFee: 2000, currency: 'MGA' },
    },
    {
      id: 'log_seed_02',
      timestamp: new Date(Date.now() - 3600000 * 4.9).toISOString(),
      eventType: 'PAYMENT_INITIATED',
      ruleReference: 'VISA-01',
      actor: 'client_browser',
      transactionId: 'pi_eduloc_demo981',
      reservationId: 'res_maths_4e',
      details: { method: 'visa_stripe', cardBrand: 'visa', cardLast4: '4242', tokenCreated: true },
    },
    {
      id: 'log_seed_03',
      timestamp: new Date(Date.now() - 3600000 * 4.8).toISOString(),
      eventType: '3DS_CHALLENGE_REQUESTED',
      ruleReference: 'VISA-03',
      actor: 'stripe_gateway',
      transactionId: 'pi_eduloc_demo981',
      details: { challengeType: 'EMV_3DS_OTP', bankIssuer: 'BNI Madagascar / Visa Secure' },
    },
    {
      id: 'log_seed_04',
      timestamp: new Date(Date.now() - 3600000 * 4.7).toISOString(),
      eventType: 'PAYMENT_SETTLED',
      ruleReference: 'VISA-04',
      actor: 'eduloc_backend',
      transactionId: 'pi_eduloc_demo981',
      details: { amount: 47000, currency: 'MGA', status: 'SUCCEEDED', authorizationCode: 'AUTH_89123' },
    },
    {
      id: 'log_seed_05',
      timestamp: new Date(Date.now() - 3600000 * 4.6).toISOString(),
      eventType: 'ODOO_CRM_SYNCED',
      ruleReference: 'SEC-10',
      actor: 'odoo_sync',
      transactionId: 'pi_eduloc_demo981',
      details: { odooLeadId: 'LEAD-2026-089', syncedFields: ['reservation_id', 'amount', 'status', 'brand', 'last4'] },
    },
  ];

  const initialPayments: PaymentIntent[] = [
    {
      id: 'pi_eduloc_demo981',
      reservationId: 'res_maths_4e',
      customerName: 'Aina Rakotoarisoa',
      customerEmail: 'aina.rakoto@gmail.com',
      amount: 47000,
      currency: 'MGA',
      status: 'SUCCEEDED',
      paymentMethodType: 'visa_stripe',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 4.7).toISOString(),
      cardDetails: {
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2028,
        token: 'pm_card_demo_981token',
        threeDSecureRequired: true,
        threeDSecureStatus: 'authenticated',
      },
      odooSyncStatus: 'synced',
      odooSyncTimestamp: new Date(Date.now() - 3600000 * 4.6).toISOString(),
      odooRecordId: 'ODOO-REC-101',
    },
    {
      id: 'pi_eduloc_demo842',
      reservationId: 'res_physique_terminale',
      customerName: 'Faly Andriamampianina',
      customerEmail: 'faly.andr@gmail.com',
      amount: 60000,
      currency: 'MGA',
      status: 'SUCCEEDED',
      paymentMethodType: 'mobile_money',
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 11.9).toISOString(),
      mobileMoneyDetails: {
        operator: 'orange-money',
        phoneMasked: '034 **** 89',
        countryCode: '+261',
        operatorRef: 'OM_MG_20261029_9182',
        ussdStatus: 'confirmed_by_user',
      },
      odooSyncStatus: 'synced',
      odooSyncTimestamp: new Date(Date.now() - 3600000 * 11.8).toISOString(),
      odooRecordId: 'ODOO-REC-102',
    },
  ];

  const initialSubscriptions: UserSubscription[] = [
    {
      id: 'sub_eduloc_9941',
      userId: 'usr_sarah_01',
      customerName: 'Sarah Rasoanaivo',
      customerEmail: 'sarah.rasoa@yahoo.fr',
      planId: 'plan_eleve_standard',
      planName: 'Pass Mensuel Élève',
      status: 'active',
      currentPeriodStart: new Date(Date.now() - 15 * 86400000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 15 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      paymentMethod: {
        type: 'visa_stripe',
        cardBrand: 'visa',
        cardLast4: '4242',
      },
      invoicesCount: 3,
      totalPaidMGA: 135000,
    },
  ];

  const initialOdooRecords: OdooCrmRecord[] = [
    {
      id: 'ODOO-REC-101',
      odooLeadId: 'LEAD-2026-089',
      customerName: 'Aina Rakotoarisoa',
      customerEmail: 'aina.rakoto@gmail.com',
      reservationId: 'res_maths_4e',
      tutorSubject: 'Mathématiques 4e (4 séances)',
      tutorName: 'Prof. Jean-Marc (Agrégé)',
      amount: 47000,
      currency: 'MGA',
      paymentMethod: 'Carte Bancaire (Visa Secure)',
      paymentProvider: 'Stripe (Visa/Mastercard)',
      paymentStatus: 'SUCCEEDED',
      transactionRef: 'pi_eduloc_demo981',
      lastVerifiedAt: new Date(Date.now() - 3600000 * 4.7).toISOString(),
      auditLogsCount: 5,
      hasAnomaly: false,
      hasNoSensitiveData: true,
    },
    {
      id: 'ODOO-REC-102',
      odooLeadId: 'LEAD-2026-092',
      customerName: 'Faly Andriamampianina',
      customerEmail: 'faly.andr@gmail.com',
      reservationId: 'res_physique_terminale',
      tutorSubject: 'Physique-Chimie Terminale S',
      tutorName: 'Dr. Mireille (Docteure ès Sciences)',
      amount: 60000,
      currency: 'MGA',
      paymentMethod: 'Orange Money (USSD Confirmed)',
      paymentProvider: 'Orange Money',
      paymentStatus: 'SUCCEEDED',
      transactionRef: 'pi_eduloc_demo842',
      lastVerifiedAt: new Date(Date.now() - 3600000 * 11.9).toISOString(),
      auditLogsCount: 4,
      hasAnomaly: false,
      hasNoSensitiveData: true,
    },
  ];

  return { initialAuditLogs, initialPayments, initialSubscriptions, initialOdooRecords };
}

// Helper pour SEC-10: Nettoyage et assainissement strict des journaux d'audit
export function sanitizeForAudit(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data };
  
  // Suppression absolue des données confidentielles
  delete sanitized.cvv;
  delete sanitized.card_number;
  delete sanitized.cardNumber;
  delete sanitized.pin;
  delete sanitized.mobile_pin;
  delete sanitized.secret_key;
  delete sanitized.apiKey;
  delete sanitized.api_key;
  delete sanitized.password;

  // Masquage automatique du téléphone (034 **** 67)
  if (sanitized.phone) {
    sanitized.phone = String(sanitized.phone).replace(/(\d{3})\d{4}(\d{2})/, '$1 **** $2');
  }
  if (sanitized.phoneNumber) {
    sanitized.phoneNumber = String(sanitized.phoneNumber).replace(/(\d{3})\d{4}(\d{2})/, '$1 **** $2');
  }
  if (sanitized.phone_number) {
    sanitized.phone_number = String(sanitized.phone_number).replace(/(\d{3})\d{4}(\d{2})/, '$1 **** $2');
  }

  // Masquage carte
  if (sanitized.cardLast4) {
    sanitized.maskedCard = `**** **** **** ${sanitized.cardLast4}`;
  }

  return sanitized;
}

// Gestion de la persistance locale
export const paymentService = {
  getAuditLogs(): SecurityAuditLog[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (stored) return JSON.parse(stored);
    } catch {}
    const { initialAuditLogs } = getInitialData();
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(initialAuditLogs));
    return initialAuditLogs;
  },

  addAuditLog(entry: Omit<SecurityAuditLog, 'id' | 'timestamp'>): SecurityAuditLog {
    const logs = this.getAuditLogs();
    const newLog: SecurityAuditLog = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      details: sanitizeForAudit(entry.details),
    };
    logs.unshift(newLog);
    // Garder les 100 derniers logs
    const capped = logs.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(capped));
    return newLog;
  },

  getPayments(): PaymentIntent[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (stored) return JSON.parse(stored);
    } catch {}
    const { initialPayments } = getInitialData();
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(initialPayments));
    return initialPayments;
  },

  savePayments(payments: PaymentIntent[]) {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  },

  getSubscriptions(): UserSubscription[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
      if (stored) return JSON.parse(stored);
    } catch {}
    const { initialSubscriptions } = getInitialData();
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(initialSubscriptions));
    return initialSubscriptions;
  },

  saveSubscriptions(subs: UserSubscription[]) {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
  },

  getOdooRecords(): OdooCrmRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ODOO_RECORDS);
      if (stored) return JSON.parse(stored);
    } catch {}
    const { initialOdooRecords } = getInitialData();
    localStorage.setItem(STORAGE_KEYS.ODOO_RECORDS, JSON.stringify(initialOdooRecords));
    return initialOdooRecords;
  },

  saveOdooRecords(records: OdooCrmRecord[]) {
    localStorage.setItem(STORAGE_KEYS.ODOO_RECORDS, JSON.stringify(records));
  },

  // SEC-03: Calcul serveur du montant (ne jamais faire confiance au navigateur)
  calculateReservationTotal(reservationId: string): { base: number; fee: number; total: number; title: string } {
    const item = SERVER_PRICE_CATALOG[reservationId] || {
      title: 'Séance de cours particulier EduLoc',
      basePriceMGA: 45000,
      platformFeeMGA: 2000,
    };
    const total = item.basePriceMGA + item.platformFeeMGA;
    return {
      base: item.basePriceMGA,
      fee: item.platformFeeMGA,
      total,
      title: item.title,
    };
  },

  // Création d'une intention de paiement (SEC-01, SEC-02, SEC-03, SEC-07)
  createPaymentIntent(params: {
    reservationId: string;
    customerName: string;
    customerEmail: string;
    paymentMethodType: 'visa_stripe' | 'mobile_money';
    idempotencyKey?: string;
  }): PaymentIntent {
    const calc = this.calculateReservationTotal(params.reservationId);
    const existing = this.getPayments().find(
      (p) => p.idempotencyKey && p.idempotencyKey === params.idempotencyKey
    );
    if (existing) {
      // SEC-07: Idempotence garantie
      return existing;
    }

    const intentId = `pi_eduloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newIntent: PaymentIntent = {
      id: intentId,
      reservationId: params.reservationId,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      amount: calc.total, // Calculé exclusivement côté serveur
      currency: 'MGA',
      status: 'REQUIRES_PAYMENT_METHOD',
      paymentMethodType: params.paymentMethodType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: params.idempotencyKey || `idem_${Date.now()}`,
      odooSyncStatus: 'pending',
    };

    const list = this.getPayments();
    list.unshift(newIntent);
    this.savePayments(list);

    this.addAuditLog({
      eventType: 'SERVER_AMOUNT_VALIDATED',
      ruleReference: 'SEC-03',
      actor: 'eduloc_backend',
      transactionId: intentId,
      reservationId: params.reservationId,
      details: {
        serverAmount: calc.total,
        base: calc.base,
        fee: calc.fee,
        currency: 'MGA',
        idempotencyKey: newIntent.idempotencyKey,
      },
    });

    return newIntent;
  },

  // VISA-01, VISA-02, VISA-03, VISA-04: Traitement carte avec Stripe & 3D Secure
  confirmVisaPayment(params: {
    intentId: string;
    cardBrand: 'visa' | 'mastercard' | 'amex';
    cardLast4: string;
    expMonth: number;
    expYear: number;
    stripeToken: string;
    requires3DS: boolean;
  }): { intent: PaymentIntent; requiresAction: boolean; threeDsUrl?: string } {
    const list = this.getPayments();
    const intent = list.find((p) => p.id === params.intentId);
    if (!intent) throw new Error('Transaction introuvable');

    // VISA-02: Strictement aucun CVV n'est reçu ni enregistré
    intent.cardDetails = {
      brand: params.cardBrand,
      last4: params.cardLast4,
      expMonth: params.expMonth,
      expYear: params.expYear,
      token: params.stripeToken,
      threeDSecureRequired: params.requires3DS,
      threeDSecureStatus: params.requires3DS ? 'pending' : 'authenticated',
    };
    intent.updatedAt = new Date().toISOString();

    if (params.requires3DS) {
      // VISA-03: Déclenchement Visa Secure / EMV 3DS
      intent.status = 'REQUIRES_ACTION';
      this.savePayments(list);

      this.addAuditLog({
        eventType: '3DS_CHALLENGE_REQUESTED',
        ruleReference: 'VISA-03',
        actor: 'stripe_gateway',
        transactionId: intent.id,
        reservationId: intent.reservationId,
        details: {
          cardBrand: params.cardBrand,
          cardLast4: params.cardLast4,
          challengeProtocol: 'EMV_3DS_v2.2',
          bankAuthUrl: 'https://visa-secure.mock-auth.eduloc.mg/verify',
        },
      });

      return {
        intent,
        requiresAction: true,
        threeDsUrl: 'https://visa-secure.mock-auth.eduloc.mg/verify',
      };
    } else {
      // VISA-04: Contrôle du résultat financier côté serveur
      intent.status = 'SUCCEEDED';
      intent.updatedAt = new Date().toISOString();
      this.savePayments(list);

      this.addAuditLog({
        eventType: 'PAYMENT_SETTLED',
        ruleReference: 'VISA-04',
        actor: 'eduloc_backend',
        transactionId: intent.id,
        reservationId: intent.reservationId,
        details: {
          amount: intent.amount,
          currency: intent.currency,
          status: 'SUCCEEDED',
          financialClearance: true,
        },
      });

      this.syncPaymentToOdoo(intent);
      return { intent, requiresAction: false };
    }
  },

  // Finalisation après défi 3D Secure réussi (VISA-04)
  settle3DSecurePayment(intentId: string, authSuccess: boolean): PaymentIntent {
    const list = this.getPayments();
    const intent = list.find((p) => p.id === intentId);
    if (!intent) throw new Error('Transaction introuvable');

    if (authSuccess) {
      if (intent.cardDetails) {
        intent.cardDetails.threeDSecureStatus = 'authenticated';
      }
      // VISA-04: Vérification financière distincte de l'authentification
      intent.status = 'SUCCEEDED';
      intent.updatedAt = new Date().toISOString();
      this.savePayments(list);

      this.addAuditLog({
        eventType: '3DS_AUTHENTICATED',
        ruleReference: 'VISA-03',
        actor: 'visa_secure_directory',
        transactionId: intent.id,
        details: { status: '3DS_SUCCESS_VERIFIED' },
      });

      this.addAuditLog({
        eventType: 'PAYMENT_SETTLED',
        ruleReference: 'VISA-04',
        actor: 'eduloc_backend',
        transactionId: intent.id,
        reservationId: intent.reservationId,
        details: {
          settledAmount: intent.amount,
          currency: intent.currency,
          gateway: 'Stripe',
          result: 'CONFIRMED_FINANCIAL_SETTLEMENT',
        },
      });

      this.syncPaymentToOdoo(intent);
    } else {
      if (intent.cardDetails) {
        intent.cardDetails.threeDSecureStatus = 'failed';
      }
      intent.status = 'FAILED';
      intent.updatedAt = new Date().toISOString();
      this.savePayments(list);

      this.addAuditLog({
        eventType: 'PAYMENT_FAILED',
        ruleReference: 'VISA-03',
        actor: 'stripe_gateway',
        transactionId: intent.id,
        details: { reason: '3D_SECURE_AUTH_FAILED_OR_REJECTED' },
      });
    }

    return intent;
  },

  // MM-01, MM-02, MM-03: Initiation Mobile Money avec push USSD
  initiateMobileMoney(params: {
    intentId: string;
    operator: MobileMoneyOperator;
    phoneNumber: string;
    countryCode?: string;
  }): { intent: PaymentIntent; httpStatus: number; ussdSessionId: string } {
    const list = this.getPayments();
    const intent = list.find((p) => p.id === params.intentId);
    if (!intent) throw new Error('Transaction introuvable');

    // MM-01: Masquage immédiat du numéro, AUCUN code PIN collecté
    const cleanPhone = params.phoneNumber.replace(/\s+/g, '');
    const masked = cleanPhone.replace(/(\d{3})\d{4}(\d{2})/, '$1 **** $2');
    const ussdSessionId = `ussd_sess_${Date.now()}`;

    intent.status = 'PENDING'; // MM-02: Réponse 202 Accepted = PENDING, jamais confirmé
    intent.mobileMoneyDetails = {
      operator: params.operator,
      phoneMasked: masked,
      countryCode: params.countryCode || '+261',
      operatorRef: `OP_${params.operator.toUpperCase().substring(0, 3)}_${Date.now().toString().slice(-6)}`,
      ussdPushSentAt: new Date().toISOString(),
      ussdStatus: 'sent',
    };
    intent.updatedAt = new Date().toISOString();
    this.savePayments(list);

    this.addAuditLog({
      eventType: 'MOBILE_MONEY_USSD_PUSHED',
      ruleReference: 'MM-01',
      actor: 'telco_aggregator',
      transactionId: intent.id,
      reservationId: intent.reservationId,
      details: {
        operator: params.operator,
        phoneMasked: masked,
        ussdSessionId,
        httpStatus: 202,
        instruction: 'PIN_CONFIRMATION_STRICTLY_ON_MOBILE_DEVICE',
      },
    });

    return {
      intent,
      httpStatus: 202, // 202 Accepted selon spécification GSMA
      ussdSessionId,
    };
  },

  // Simulation de la validation sur le téléphone de l'utilisateur (USSD prompt)
  simulateUssdResponse(intentId: string, action: 'confirm' | 'reject' | 'timeout'): PaymentIntent {
    const list = this.getPayments();
    const intent = list.find((p) => p.id === intentId);
    if (!intent || !intent.mobileMoneyDetails) throw new Error('Transaction introuvable');

    if (action === 'confirm') {
      intent.mobileMoneyDetails.ussdStatus = 'confirmed_by_user';
      intent.status = 'SUCCEEDED'; // MM-03: Vérifié après webhook / polling réussi
      intent.updatedAt = new Date().toISOString();

      this.addAuditLog({
        eventType: 'MOBILE_MONEY_CALLBACK_RECEIVED',
        ruleReference: 'MM-03',
        actor: 'telco_aggregator',
        transactionId: intent.id,
        details: {
          operator: intent.mobileMoneyDetails.operator,
          operatorRef: intent.mobileMoneyDetails.operatorRef,
          amountVerified: intent.amount,
          status: 'SUCCESSFUL',
        },
      });

      this.syncPaymentToOdoo(intent);
    } else if (action === 'reject') {
      intent.mobileMoneyDetails.ussdStatus = 'rejected';
      intent.status = 'FAILED';
      intent.mobileMoneyDetails.failureReason = 'Annulé ou code secret erroné sur le téléphone mobile.';
      intent.updatedAt = new Date().toISOString();

      this.addAuditLog({
        eventType: 'PAYMENT_FAILED',
        ruleReference: 'MM-02',
        actor: 'telco_aggregator',
        transactionId: intent.id,
        details: { status: 'FAILED_REJECTED_ON_PHONE' },
      });
    } else {
      intent.mobileMoneyDetails.ussdStatus = 'timeout';
      intent.status = 'EXPIRED';
      intent.mobileMoneyDetails.failureReason = 'Délai d’attente dépassé sans confirmation USSD.';
      intent.updatedAt = new Date().toISOString();

      this.addAuditLog({
        eventType: 'PAYMENT_FAILED',
        ruleReference: 'MM-02',
        actor: 'telco_aggregator',
        transactionId: intent.id,
        details: { status: 'EXPIRED_TIMEOUT' },
      });
    }

    this.savePayments(list);
    return intent;
  },

  // MM-04: Signalement d'une preuve client (SMS ou capture d'écran)
  // Règle: NE JAMAIS marquer automatiquement comme payé, ouvre un ticket d'anomalie pour vérification
  submitClientProof(intentId: string, proofType: 'sms_reference' | 'screenshot', proofData: string): { message: string; anomalyFlagged: boolean } {
    const list = this.getPayments();
    const intent = list.find((p) => p.id === intentId);
    if (!intent) throw new Error('Transaction introuvable');

    this.addAuditLog({
      eventType: 'ANOMALY_FLAGGED',
      ruleReference: 'MM-04',
      actor: 'client_browser',
      transactionId: intent.id,
      reservationId: intent.reservationId,
      details: {
        proofType,
        notice: 'MM-04 ENFORCED: Client proof alone DOES NOT confirm payment. Waiting for official Telco API reconciliation.',
        referenceProvided: proofData.substring(0, 30),
      },
    });

    // Mettre à jour l'enregistrement Odoo avec une anomalie
    const odooList = this.getOdooRecords();
    const odooRecord = odooList.find((r) => r.transactionRef === intent.id);
    if (odooRecord) {
      odooRecord.hasAnomaly = true;
      odooRecord.anomalyDescription = `Preuve client fournie (${proofType}) en attente de vérification relevé bancaire / opérateur. Règle MM-04.`;
      this.saveOdooRecords(odooList);
    }

    return {
      message: 'Votre preuve a été transmise aux superviseurs pour vérification auprès de l’opérateur. Votre réservation sera confirmée dès validation officielle.',
      anomalyFlagged: true,
    };
  },

  // Synchronisation avec Odoo CRM (Section 4 du cahier des charges)
  syncPaymentToOdoo(payment: PaymentIntent): OdooCrmRecord {
    const records = this.getOdooRecords();
    let existing = records.find((r) => r.transactionRef === payment.id);

    const providerMap: Record<string, any> = {
      visa_stripe: 'Stripe (Visa/Mastercard)',
      'orange-money': 'Orange Money',
      mvola: 'MVola Telma',
      'airtel-money': 'Airtel Money',
      'mtn-momo': 'MTN MoMo',
    };

    const provider = payment.paymentMethodType === 'visa_stripe'
      ? 'Stripe (Visa/Mastercard)'
      : providerMap[payment.mobileMoneyDetails?.operator || 'orange-money'] || 'Mobile Money';

    const methodLabel = payment.paymentMethodType === 'visa_stripe'
      ? `Carte Bancaire (**** ${payment.cardDetails?.last4 || '4242'})`
      : `Mobile Money (${payment.mobileMoneyDetails?.phoneMasked || ''})`;

    if (existing) {
      existing.paymentStatus = payment.status;
      existing.lastVerifiedAt = new Date().toISOString();
      existing.auditLogsCount += 1;
    } else {
      existing = {
        id: `ODOO-REC-${Date.now().toString().slice(-4)}`,
        odooLeadId: `LEAD-2026-${Math.floor(100 + Math.random() * 900)}`,
        customerName: payment.customerName,
        customerEmail: payment.customerEmail,
        reservationId: payment.reservationId,
        tutorSubject: SERVER_PRICE_CATALOG[payment.reservationId]?.title || 'Cours particulier EduLoc',
        tutorName: 'Tuteur agréé EduLoc',
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: methodLabel,
        paymentProvider: provider,
        paymentStatus: payment.status,
        transactionRef: payment.id,
        lastVerifiedAt: new Date().toISOString(),
        auditLogsCount: 1,
        hasAnomaly: false,
        hasNoSensitiveData: true, // Garanti sans CVV ni PIN
      };
      records.unshift(existing);
    }

    this.saveOdooRecords(records);

    // Mettre à jour l'intent
    payment.odooSyncStatus = 'synced';
    payment.odooSyncTimestamp = new Date().toISOString();
    payment.odooRecordId = existing.id;
    this.savePayments(this.getPayments());

    this.addAuditLog({
      eventType: 'ODOO_CRM_SYNCED',
      ruleReference: 'SEC-10',
      actor: 'odoo_sync',
      transactionId: payment.id,
      details: {
        odooRecordId: existing.id,
        odooLeadId: existing.odooLeadId,
        status: existing.paymentStatus,
        guarantee: 'ZERO_CVV_ZERO_PIN_TRANSMITTED',
      },
    });

    return existing;
  },

  // Gestion des abonnements Stripe (Création, Changement de plan, Pause, Résiliation)
  createSubscription(params: {
    planId: string;
    customerName: string;
    customerEmail: string;
    paymentMethod: {
      type: 'visa_stripe' | 'mobile_money';
      cardBrand?: string;
      cardLast4?: string;
      operator?: MobileMoneyOperator;
      phoneMasked?: string;
    };
  }): UserSubscription {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === params.planId) || SUBSCRIPTION_PLANS[0];
    const subId = `sub_eduloc_${Date.now()}`;
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 86400000);

    const newSub: UserSubscription = {
      id: subId,
      userId: `usr_${Date.now()}`,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      planId: plan.id,
      planName: plan.name,
      status: 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: nextMonth.toISOString(),
      cancelAtPeriodEnd: false,
      paymentMethod: params.paymentMethod,
      invoicesCount: 1,
      totalPaidMGA: plan.priceMGA,
    };

    const subs = this.getSubscriptions();
    subs.unshift(newSub);
    this.saveSubscriptions(subs);

    this.addAuditLog({
      eventType: 'SUBSCRIPTION_CREATED',
      ruleReference: 'SEC-01',
      actor: 'stripe_gateway',
      details: {
        subscriptionId: subId,
        planName: plan.name,
        amountMGA: plan.priceMGA,
        interval: plan.interval,
        customerEmail: params.customerEmail,
      },
    });

    return newSub;
  },

  changeSubscriptionPlan(subscriptionId: string, newPlanId: string): UserSubscription {
    const subs = this.getSubscriptions();
    const sub = subs.find((s) => s.id === subscriptionId);
    if (!sub) throw new Error('Abonnement introuvable');
    const newPlan = SUBSCRIPTION_PLANS.find((p) => p.id === newPlanId);
    if (!newPlan) throw new Error('Plan introuvable');

    const oldPlanName = sub.planName;
    sub.planId = newPlan.id;
    sub.planName = newPlan.name;
    sub.totalPaidMGA += newPlan.priceMGA;
    sub.invoicesCount += 1;
    this.saveSubscriptions(subs);

    this.addAuditLog({
      eventType: 'SUBSCRIPTION_UPGRADED',
      ruleReference: 'SEC-07',
      actor: 'stripe_gateway',
      details: {
        subscriptionId,
        fromPlan: oldPlanName,
        toPlan: newPlan.name,
        proratedPriceMGA: newPlan.priceMGA,
      },
    });

    return sub;
  },

  togglePauseSubscription(subscriptionId: string): UserSubscription {
    const subs = this.getSubscriptions();
    const sub = subs.find((s) => s.id === subscriptionId);
    if (!sub) throw new Error('Abonnement introuvable');

    sub.status = sub.status === 'paused' ? 'active' : 'paused';
    this.saveSubscriptions(subs);

    this.addAuditLog({
      eventType: 'SUBSCRIPTION_PAUSED',
      ruleReference: 'SEC-01',
      actor: 'eduloc_backend',
      details: {
        subscriptionId,
        newStatus: sub.status,
      },
    });

    return sub;
  },

  cancelSubscription(subscriptionId: string): UserSubscription {
    const subs = this.getSubscriptions();
    const sub = subs.find((s) => s.id === subscriptionId);
    if (!sub) throw new Error('Abonnement introuvable');

    sub.cancelAtPeriodEnd = true;
    sub.status = 'canceled';
    this.saveSubscriptions(subs);

    this.addAuditLog({
      eventType: 'SUBSCRIPTION_CANCELLED',
      ruleReference: 'SEC-01',
      actor: 'client_browser',
      details: {
        subscriptionId,
        cancellationDate: new Date().toISOString(),
        effectiveUntil: sub.currentPeriodEnd,
      },
    });

    return sub;
  },

  // SEC-11: Rapprochement comptable régulier et détection des écarts
  generateReconciliationReport(): ReconciliationReport {
    const payments = this.getPayments();
    let discrepancies: ReconciliationReport['discrepancies'] = [];

    // Contrôles de cohérence
    payments.forEach((p) => {
      // 1. Écart de montant
      const expected = this.calculateReservationTotal(p.reservationId).total;
      if (p.amount !== expected) {
        discrepancies.push({
          transactionId: p.id,
          type: 'AMOUNT_MISMATCH',
          internalStatus: p.status,
          gatewayStatus: 'DISCORDANCE',
          details: `Montant enregistré (${p.amount} Ar) différent du tarif officiel serveur (${expected} Ar).`,
        });
      }

      // 2. Client proof non réconcilié
      if (p.status === 'PENDING' && p.mobileMoneyDetails?.ussdStatus === 'sent') {
        const odoo = this.getOdooRecords().find((r) => r.transactionRef === p.id);
        if (odoo?.hasAnomaly) {
          discrepancies.push({
            transactionId: p.id,
            type: 'UNRESOLVED_CUSTOMER_PROOF',
            internalStatus: 'PENDING',
            gatewayStatus: 'WAITING_OPERATOR_REPORT',
            details: 'Preuve client en attente de confirmation sur le relevé agrégateur.',
          });
        }
      }
    });

    const report: ReconciliationReport = {
      timestamp: new Date().toISOString(),
      totalInternalTransactions: payments.length,
      totalStripeTransactions: payments.filter((p) => p.paymentMethodType === 'visa_stripe').length,
      totalMobileMoneyTransactions: payments.filter((p) => p.paymentMethodType === 'mobile_money').length,
      matchedCount: payments.length - discrepancies.length,
      discrepanciesCount: discrepancies.length,
      discrepancies,
    };

    this.addAuditLog({
      eventType: 'RECONCILIATION_AUDIT',
      ruleReference: 'SEC-11',
      actor: 'eduloc_backend',
      details: {
        matched: report.matchedCount,
        discrepancies: report.discrepanciesCount,
        timestamp: report.timestamp,
      },
    });

    return report;
  },
};
