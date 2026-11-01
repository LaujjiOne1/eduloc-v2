import { ApiEndpointDoc } from '@/types/payment';

export const API_DOCS: ApiEndpointDoc[] = [
  {
    method: 'POST',
    path: '/api/v1/payments/create-intent',
    title: 'Création d’intention de paiement sécurisée',
    category: 'Payments',
    description: 'Initialise une session de paiement avec calcul strict du montant côté serveur (SEC-03) et garantie d’idempotence (SEC-07).',
    securityRules: ['SEC-01', 'SEC-03', 'SEC-04', 'SEC-07'],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sec_live_eduloc_...',
      'Idempotency-Key': 'idem_9182a7f012b',
      'X-CSRF-Token': 'csrf_token_string',
    },
    requestBody: {
      reservation_id: 'res_maths_4e',
      customer_name: 'Aina Rakotoarisoa',
      customer_email: 'aina.rakoto@gmail.com',
      payment_method_type: 'visa_stripe', // ou 'mobile_money'
      currency: 'MGA',
    },
    responseExample: {
      status: 'success',
      payment_intent: {
        id: 'pi_eduloc_1730283921_ab4f',
        reservation_id: 'res_maths_4e',
        amount: 47000,
        currency: 'MGA',
        status: 'REQUIRES_PAYMENT_METHOD',
        created_at: '2026-10-30T09:20:00.000Z',
      },
      client_secret: 'pi_eduloc_1730283921_secret_9941a8',
    },
  },
  {
    method: 'POST',
    path: '/api/v1/payments/visa/confirm',
    title: 'Confirmation Visa / Stripe avec support 3D Secure',
    category: 'Payments',
    description: 'Valide le paiement par carte bancaire. Si Visa Secure est exigé par la banque émettrice, renvoie un statut requires_action avec URL 3DS (VISA-01, VISA-03). Aucun CVV n’est enregistré (VISA-02).',
    securityRules: ['VISA-01', 'VISA-02', 'VISA-03', 'VISA-04', 'SEC-02'],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sec_live_eduloc_...',
    },
    requestBody: {
      payment_intent_id: 'pi_eduloc_1730283921_ab4f',
      payment_method_token: 'pm_card_1Nq8Xy2eZvKYlo2CSom8',
      return_url: 'https://eduloc.mg/payment/complete',
    },
    responseExample: {
      status: 'requires_action',
      three_d_secure: {
        required: true,
        protocol: 'EMV_3DS_v2',
        challenge_url: 'https://bank-auth.visa.com/acs/challenge?session=...',
      },
    },
  },
  {
    method: 'POST',
    path: '/api/v1/payments/mobile-money/initiate',
    title: 'Initiation Mobile Money avec Push USSD',
    category: 'Mobile Money',
    description: 'Déclenche un push USSD vers le téléphone du client. Renvoie immédiatement 202 Accepted (MM-02). Ne collecte JAMAIS le code PIN (MM-01).',
    securityRules: ['MM-01', 'MM-02', 'SEC-01', 'SEC-03'],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sec_live_eduloc_...',
    },
    requestBody: {
      payment_intent_id: 'pi_eduloc_1730283921_ab4f',
      operator: 'orange-money', // 'orange-money' | 'mvola' | 'airtel-money'
      phone_number: '0341234567',
      country_code: '+261',
    },
    responseExample: {
      http_status: 202,
      status: 'PENDING',
      transaction_id: 'pi_eduloc_1730283921_ab4f',
      operator_reference: 'OM_MG_20261030_10928',
      message: 'Demande USSD envoyée au client. Ne jamais demander le PIN.',
      poll_url: '/api/v1/payments/mobile-money/status/pi_eduloc_1730283921_ab4f',
    },
  },
  {
    method: 'GET',
    path: '/api/v1/payments/mobile-money/status/:transactionId',
    title: 'Vérification du statut Mobile Money côté serveur',
    category: 'Mobile Money',
    description: 'Interroge l’agrégateur/opérateur pour vérifier le résultat financier final avant de confirmer la réservation (MM-03). Couvre les cas où le callback n’a pas été reçu.',
    securityRules: ['MM-02', 'MM-03', 'SEC-04', 'SEC-06'],
    headers: {
      'Authorization': 'Bearer sec_live_eduloc_...',
    },
    responseExample: {
      transaction_id: 'pi_eduloc_1730283921_ab4f',
      operator: 'orange-money',
      state: 'SUCCEEDED', // 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
      verified_amount: 47000,
      currency: 'MGA',
      verified_at: '2026-10-30T09:21:15.000Z',
    },
  },
  {
    method: 'POST',
    path: '/api/v1/subscriptions/subscribe',
    title: 'Création d’un abonnement récurrent',
    category: 'Subscriptions',
    description: 'Abonne l’utilisateur à un Pass EduLoc (Pass Élève, Famille, Prépa Examens) avec facturation récurrente Stripe et cycle paramétrable.',
    securityRules: ['SEC-01', 'SEC-02', 'SEC-07'],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sec_live_eduloc_...',
    },
    requestBody: {
      plan_id: 'plan_eleve_standard',
      customer_name: 'Sarah Rasoanaivo',
      customer_email: 'sarah.rasoa@yahoo.fr',
      payment_method_id: 'pm_card_1Nq8Xy2eZvKYlo2CSom8',
    },
    responseExample: {
      subscription_id: 'sub_eduloc_1730284000',
      plan: 'Pass Mensuel Élève',
      status: 'active',
      current_period_end: '2026-11-30T09:20:00.000Z',
      billing_amount_mga: 45000,
    },
  },
  {
    method: 'POST',
    path: '/api/v1/odoo/update-payment',
    title: 'Synchronisation CRM Odoo restreinte',
    category: 'Odoo CRM',
    description: 'Transmet à Odoo CRM uniquement les métadonnées de suivi autorisées. Strictement interdit de transmettre CVV, PAN complet, code PIN ou secrets API (Section 4 du cahier des charges).',
    securityRules: ['SEC-02', 'SEC-10', 'VISA-02', 'MM-01'],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer odoo_sync_token_...',
    },
    requestBody: {
      reservation_id: 'res_maths_4e',
      payment_status: 'SUCCEEDED',
      payment_method: 'Carte Bancaire (**** 4242)',
      amount: 47000,
      currency: 'MGA',
      transaction_reference: 'pi_eduloc_1730283921_ab4f',
    },
    responseExample: {
      success: true,
      odoo_lead_id: 'LEAD-2026-089',
      message: 'Enregistrement Odoo mis à jour. Aucune donnée sensible transmise.',
    },
  },
  {
    method: 'GET',
    path: '/api/v1/reconciliation/report',
    title: 'Rapport d’audit de rapprochement comptable',
    category: 'Security',
    description: 'Contrôle quotidien entre les écritures du grand livre interne et les relevés bancaires/opérateurs pour détecter les discordances (SEC-11).',
    securityRules: ['SEC-11'],
    headers: {
      'Authorization': 'Bearer sec_live_eduloc_audit_...',
    },
    responseExample: {
      timestamp: '2026-10-30T09:22:00.000Z',
      total_internal: 42,
      total_gateway: 42,
      matched_count: 42,
      discrepancies_count: 0,
      status: 'BALANCED',
    },
  },
];
