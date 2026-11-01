/**
 * Types & Interfaces pour le système de paiement et abonnements EduLoc
 * Conforme aux spécifications PCI DSS Niveau 1 (Visa) et GSMA Mobile Money API
 */

export type PaymentMethodType = 'visa_stripe' | 'mobile_money';

export type MobileMoneyOperator = 'orange-money' | 'mvola' | 'airtel-money' | 'mtn-momo';

export type PaymentStatus = 
  | 'REQUIRES_PAYMENT_METHOD'
  | 'REQUIRES_ACTION'    // 3D Secure / Visa Secure challenge
  | 'PENDING'            // MM-02: 202 Accepted en attente USSD
  | 'PROCESSING'
  | 'SUCCEEDED'          // MM-02 / VISA-04: Confirmé après validation serveur
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type SubscriptionInterval = 'monthly' | 'quarterly' | 'yearly';

export type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'past_due' | 'canceled';

export interface SubscriptionPlan {
  id: string;
  name: string;
  badge?: string;
  priceMGA: number;
  priceEUR: number;
  interval: SubscriptionInterval;
  description: string;
  features: string[];
  stripePriceId: string;
  popular?: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod: {
    type: PaymentMethodType;
    cardBrand?: string;
    cardLast4?: string;
    operator?: MobileMoneyOperator;
    phoneMasked?: string;
  };
  invoicesCount: number;
  totalPaidMGA: number;
}

export interface PaymentIntent {
  id: string; // ex: pi_eduloc_12345
  reservationId: string;
  customerName: string;
  customerEmail: string;
  amount: number; // Toujours calculé côté serveur (SEC-03)
  currency: 'MGA' | 'EUR' | 'USD';
  status: PaymentStatus;
  paymentMethodType: PaymentMethodType;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string; // SEC-07
  
  // Visa / Stripe metadata (Strictement conforme VISA-01 & VISA-02: AUCUN CVV, AUCUN PAN COMPLET)
  cardDetails?: {
    brand: 'visa' | 'mastercard' | 'amex';
    last4: string;
    expMonth: number;
    expYear: number;
    token: string; // Token Stripe généré côté client sécurisé
    threeDSecureRequired?: boolean;
    threeDSecureStatus?: 'pending' | 'authenticated' | 'failed';
  };
  
  // Mobile Money metadata (Strictement conforme MM-01: AUCUN CODE PIN)
  mobileMoneyDetails?: {
    operator: MobileMoneyOperator;
    phoneMasked: string; // ex: 034 **** 67
    countryCode: string;
    operatorRef?: string;
    ussdPushSentAt?: string;
    ussdStatus?: 'sent' | 'received_by_phone' | 'confirmed_by_user' | 'timeout' | 'rejected';
    failureReason?: string;
  };

  // Odoo CRM sync status
  odooSyncStatus: 'synced' | 'pending' | 'failed' | 'not_applicable';
  odooSyncTimestamp?: string;
  odooRecordId?: string;
}

export interface OdooCrmRecord {
  id: string;
  odooLeadId: string;
  customerName: string;
  customerEmail: string;
  reservationId: string;
  tutorSubject: string;
  tutorName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentProvider: 'Stripe (Visa/Mastercard)' | 'Orange Money' | 'MVola Telma' | 'Airtel Money';
  paymentStatus: PaymentStatus;
  transactionRef: string;
  lastVerifiedAt: string;
  refundStatus?: 'none' | 'requested' | 'approved' | 'rejected' | 'refunded';
  refundAmount?: number;
  refundRef?: string;
  auditLogsCount: number;
  hasAnomaly: boolean;
  anomalyDescription?: string;
  // Security guarantees
  hasNoSensitiveData: boolean; // Confirme qu'aucun CVV, PIN, ni clé secrète n'y réside
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  eventType: 
    | 'PAYMENT_INITIATED'
    | 'SERVER_AMOUNT_VALIDATED'
    | '3DS_CHALLENGE_REQUESTED'
    | '3DS_AUTHENTICATED'
    | 'PAYMENT_SETTLED'
    | 'PAYMENT_FAILED'
    | 'MOBILE_MONEY_USSD_PUSHED'
    | 'MOBILE_MONEY_CALLBACK_RECEIVED'
    | 'MOBILE_MONEY_STATUS_POLLED'
    | 'SUBSCRIPTION_CREATED'
    | 'SUBSCRIPTION_UPGRADED'
    | 'SUBSCRIPTION_PAUSED'
    | 'SUBSCRIPTION_CANCELLED'
    | 'ODOO_CRM_SYNCED'
    | 'RECONCILIATION_AUDIT'
    | 'ANOMALY_FLAGGED';
  ruleReference: string; // ex: VISA-01, VISA-02, MM-01, SEC-03, etc.
  actor: string; // 'client_browser', 'stripe_gateway', 'telco_aggregator', 'eduloc_backend', 'odoo_sync'
  transactionId?: string;
  reservationId?: string;
  details: Record<string, any>; // Sanitisé automatiquement (zéro CVV, zéro PIN)
}

export interface ReconciliationReport {
  timestamp: string;
  totalInternalTransactions: number;
  totalStripeTransactions: number;
  totalMobileMoneyTransactions: number;
  matchedCount: number;
  discrepanciesCount: number;
  discrepancies: Array<{
    transactionId: string;
    type: 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH' | 'MISSING_IN_GATEWAY' | 'UNRESOLVED_CUSTOMER_PROOF';
    internalStatus: string;
    gatewayStatus: string;
    details: string;
  }>;
}

export interface ApiEndpointDoc {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  title: string;
  category: 'Payments' | 'Subscriptions' | 'Mobile Money' | 'Odoo CRM' | 'Security';
  description: string;
  securityRules: string[];
  headers: Record<string, string>;
  requestBody?: Record<string, any>;
  responseExample: Record<string, any>;
}
