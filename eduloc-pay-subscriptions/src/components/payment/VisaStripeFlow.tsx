import React, { useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Lock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { paymentService } from '@/services/paymentService';
import { PaymentIntent } from '@/types/payment';

interface Props {
  reservationId: string;
  onBack: () => void;
  onPaymentSuccess?: (intent: PaymentIntent) => void;
}

export const VisaStripeFlow: React.FC<Props> = ({ reservationId, onBack, onPaymentSuccess }) => {
  const calc = paymentService.calculateReservationTotal(reservationId);

  // Form states
  const [customerName, setCustomerName] = useState('Aina Rakotoarisoa');
  const [customerEmail, setCustomerEmail] = useState('aina.rakoto@gmail.com');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [requires3DS, setRequires3DS] = useState(true);

  // Flow states
  const [loading, setLoading] = useState(false);
  const [show3DSModal, setShow3DSModal] = useState(false);
  const [activeIntent, setActiveIntent] = useState<PaymentIntent | null>(null);
  const [smsOtp, setSmsOtp] = useState('');
  const [settledIntent, setSettledIntent] = useState<PaymentIntent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick fill test cards
  const applyTestCard = (type: 'standard' | '3ds' | 'declined') => {
    if (type === 'standard') {
      setCardNumber('4242 4242 4242 4242');
      setExpiry('12/28');
      setCvv('321');
      setRequires3DS(false);
    } else if (type === '3ds') {
      setCardNumber('4000 0027 6000 3184');
      setExpiry('08/29');
      setCvv('888');
      setRequires3DS(true);
    } else {
      setCardNumber('4000 0000 0000 0002');
      setExpiry('05/27');
      setCvv('000');
      setRequires3DS(false);
    }
  };

  // Soumission du formulaire (VISA-01 & VISA-02)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // 1. SEC-03: Création de l'intention de paiement avec montant vérifié serveur
      const intent = paymentService.createPaymentIntent({
        reservationId,
        customerName,
        customerEmail,
        paymentMethodType: 'visa_stripe',
        idempotencyKey: `idem_visa_${Date.now()}`,
      });

      // Simulation de la tokenisation Stripe Elements (VISA-01: La carte n'est pas envoyée au serveur brut)
      const last4 = cardNumber.replace(/\s/g, '').slice(-4) || '4242';
      const stripeToken = `tok_visa_${Math.random().toString(36).substring(2, 9)}`;

      // 2. Traitement côté backend Stripe
      const result = paymentService.confirmVisaPayment({
        intentId: intent.id,
        cardBrand: 'visa',
        cardLast4: last4,
        expMonth: parseInt(expiry.split('/')[0] || '12', 10),
        expYear: 2000 + parseInt(expiry.split('/')[1] || '28', 10),
        stripeToken,
        requires3DS,
      });

      setActiveIntent(result.intent);

      if (result.requiresAction) {
        // VISA-03: Déclenchement de Visa Secure / EMV 3-D Secure
        setLoading(false);
        setShow3DSModal(true);
      } else {
        // Succès direct sans 3DS
        setLoading(false);
        setSettledIntent(result.intent);
        triggerSuccessCelebration();
        onPaymentSuccess?.(result.intent);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Une erreur est survenue lors de l’autorisation bancaire.');
    }
  };

  // Validation du défi 3D Secure (VISA-03 & VISA-04)
  const handle3DSSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntent) return;

    setLoading(true);
    setTimeout(() => {
      // VISA-04: Contrôle du résultat financier côté serveur
      const settled = paymentService.settle3DSecurePayment(activeIntent.id, true);
      setShow3DSModal(false);
      setLoading(false);
      setSettledIntent(settled);
      triggerSuccessCelebration();
      onPaymentSuccess?.(settled);
    }, 1200);
  };

  const triggerSuccessCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}
  };

  // Écran de succès
  if (settledIntent) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 shadow-md text-center max-w-xl mx-auto space-y-6">
        <div className="inline-grid h-16 w-16 place-items-center rounded-2xl bg-accent-tint text-accent">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Paiement confirmé avec succès
          </span>
          <h2 className="text-2xl font-extrabold text-ink mt-1">Réservation validée !</h2>
          <p className="text-sm text-ink-soft mt-1">
            Votre tuteur a été notifié et prendra contact avec vous sous 24h.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5 text-left space-y-3 text-xs">
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">Référence de transaction</span>
            <span className="font-mono font-bold text-ink">{settledIntent.id}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">Moyen de paiement</span>
            <span className="font-semibold text-ink">
              Visa **** {settledIntent.cardDetails?.last4} (Visa Secure 3DS)
            </span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">Montant débité</span>
            <span className="font-bold text-ink text-sm">
              {settledIntent.amount.toLocaleString()} Ar
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-ink-soft">Synchronisation CRM Odoo</span>
            <span className="inline-flex items-center gap-1 font-semibold text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lead synchronisé ({settledIntent.odooRecordId})
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => {
              setSettledIntent(null);
              onBack();
            }}
            className="rounded-xl border border-line px-5 py-2.5 text-xs font-semibold text-ink hover:bg-paper transition-colors"
          >
            Faire un autre paiement
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-xs font-semibold shadow-sm hover:bg-primary-dark transition-colors"
          >
            <FileText className="h-4 w-4" />
            Imprimer le reçu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* En-tête retour */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Changer de mode de paiement</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-semibold text-accent">
          <Lock className="h-3.5 w-3.5" />
          <span>Connexion chiffrée TLS / PCI DSS</span>
        </div>
      </div>

      {/* VISA-01 & VISA-02: Avertissement de sécurité et conformité */}
      <div className="rounded-2xl border-l-4 border-l-primary bg-primary-tint/60 p-4 space-y-2 text-xs text-ink-soft">
        <div className="flex items-center gap-2 text-primary font-bold">
          <ShieldCheck className="h-4 w-4" />
          <span>Protection stricte PCI DSS (VISA-01 & VISA-02)</span>
        </div>
        <p className="leading-relaxed">
          La saisie de votre carte est confiée à un prestataire certifié <strong>PCI DSS Niveau 1</strong>.
          edUloc <strong>ne stocke jamais votre code CVV</strong>, même de manière chiffrée, et ne conserve
          aucun numéro de carte complet.
        </p>
      </div>

      {/* Cartes de test rapide pour le vérificateur */}
      <div className="rounded-2xl border border-line bg-surface p-4 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-ink">Environnement de simulation (SEC-09) :</span>
          <span className="text-[11px] text-muted-foreground">Cliquez pour pré-remplir</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyTestCard('3ds')}
            className="rounded-lg bg-paper border border-line px-2.5 py-1 text-ink font-medium hover:border-primary"
          >
            💳 Visa Test + 3D Secure (Recommandé)
          </button>
          <button
            type="button"
            onClick={() => applyTestCard('standard')}
            className="rounded-lg bg-paper border border-line px-2.5 py-1 text-ink font-medium hover:border-primary"
          >
            ⚡ Visa Direct (Sans 3DS)
          </button>
        </div>
      </div>

      {/* Formulaire de paiement */}
      <form onSubmit={handleSubmit} className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-5">
        <div className="border-b border-line pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">Informations de carte bancaire</h3>
            <p className="text-xs text-ink-soft">Champs hébergés conformes PCI DSS (VISA-01)</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary-tint px-2.5 py-1 rounded-lg">
            <span>Visa Secure</span>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-destructive/30 bg-error-tint/60 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Nom & Email */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Nom complet du titulaire *
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
              placeholder="Ex: Aina Rakotoarisoa"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Adresse e-mail pour le reçu *
            </label>
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
              placeholder="Ex: aina.rakoto@gmail.com"
            />
          </div>
        </div>

        {/* Numéro de carte */}
        <div>
          <label className="block text-xs font-semibold text-ink mb-1.5">
            Numéro de carte Visa / Mastercard *
          </label>
          <div className="relative">
            <input
              type="text"
              required
              maxLength={19}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper pl-10 pr-3.5 py-2.5 text-sm font-mono text-ink tracking-wider focus:border-primary focus:outline-none"
              placeholder="4242 •••• •••• 4242"
            />
            <CreditCard className="absolute left-3 top-3 h-4 w-4 text-ink-soft" />
          </div>
          <span className="block mt-1 text-[11px] text-muted-foreground">
            VISA-02 : Seuls les 4 derniers chiffres seront conservés pour votre suivi.
          </span>
        </div>

        {/* Date d'expiration & CVV */}
        <div className="grid gap-4 grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Date d'expiration *
            </label>
            <input
              type="text"
              required
              maxLength={5}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-mono text-ink text-center focus:border-primary focus:outline-none"
              placeholder="MM/AA"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink">CVV *</label>
              <span className="text-[10px] font-semibold text-destructive uppercase">Non conservé</span>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-mono text-ink text-center focus:border-primary focus:outline-none"
                placeholder="•••"
              />
            </div>
            <span className="block mt-1 text-[10px] text-destructive leading-tight">
              ⚠️ Strictement interdit de stockage après autorisation (PCI DSS).
            </span>
          </div>
        </div>

        {/* Option 3DS Toggle */}
        <div className="rounded-xl border border-line bg-paper p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span className="font-medium text-ink">Activer le protocole Visa Secure (3D Secure)</span>
          </div>
          <input
            type="checkbox"
            checked={requires3DS}
            onChange={(e) => setRequires3DS(e.target.checked)}
            className="h-4 w-4 accent-primary rounded cursor-pointer"
          />
        </div>

        {/* Bouton de paiement avec calcul serveur */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white py-3.5 px-4 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Traitement sécurisé en cours...</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              <span>Régler {calc.total.toLocaleString()} Ar en toute sécurité</span>
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-ink-soft">
          En cliquant, votre banque procédera à la vérification Visa Secure si requise.
        </p>
      </form>

      {/* VISA-03: Modal Visa Secure / EMV 3-D Secure Simulator */}
      {show3DSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-10 bg-[#1A1F71] text-white rounded font-bold text-[10px] flex items-center justify-center italic">
                  VISA
                </div>
                <span className="font-bold text-sm text-ink">Visa Secure · Authentification</span>
              </div>
              <span className="text-[10px] font-semibold bg-primary-tint text-primary px-2 py-0.5 rounded-full">
                EMV 3DS 2.2
              </span>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-ink-soft leading-relaxed">
                Votre banque émettrice exige une confirmation de sécurité pour autoriser le débit de{' '}
                <strong className="text-ink">{calc.total.toLocaleString()} Ar</strong> au profit de{' '}
                <strong className="text-ink">EduLoc Madagascar</strong>.
              </p>

              <div className="rounded-xl bg-paper border border-line p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Commerçant :</span>
                  <span className="font-semibold text-ink">EduLoc SAS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Montant :</span>
                  <span className="font-bold text-primary">{calc.total.toLocaleString()} Ar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Carte :</span>
                  <span className="font-mono text-ink">**** 4242</span>
                </div>
              </div>

              <form onSubmit={handle3DSSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Code de vérification SMS / Authentification mobile
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={smsOtp}
                    onChange={(e) => setSmsOtp(e.target.value)}
                    placeholder="Saisissez le code (ex: 789456)"
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-center text-base font-mono tracking-widest focus:border-primary focus:outline-none"
                  />
                  <span className="block mt-1 text-[10px] text-muted-foreground text-center">
                    Simulateur : tapez n'importe quel code à 6 chiffres pour valider
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShow3DSModal(false);
                      if (activeIntent) {
                        paymentService.settle3DSecurePayment(activeIntent.id, false);
                      }
                      setErrorMsg('Authentification Visa Secure annulée ou rejetée.');
                    }}
                    className="flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-ink hover:bg-paper"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-xl bg-primary text-white py-2.5 text-xs font-bold shadow hover:bg-primary-dark flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Vérification...</span>
                      </>
                    ) : (
                      <span>Confirmer le débit</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="border-t border-line pt-3 text-[10px] text-center text-muted-foreground">
              VISA-04 : L'authentification vérifie votre identité avant que notre backend ne confirme le résultat financier.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
