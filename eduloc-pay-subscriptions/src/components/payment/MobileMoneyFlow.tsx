import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  PhoneCall,
  UploadCloud,
  FileCheck2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { paymentService } from '@/services/paymentService';
import { MobileMoneyOperator, PaymentIntent } from '@/types/payment';

interface Props {
  reservationId: string;
  onBack: () => void;
  onPaymentSuccess?: (intent: PaymentIntent) => void;
}

export const MobileMoneyFlow: React.FC<Props> = ({ reservationId, onBack, onPaymentSuccess }) => {
  const calc = paymentService.calculateReservationTotal(reservationId);

  // Form states
  const [operator, setOperator] = useState<MobileMoneyOperator>('orange-money');
  const [phoneNumber, setPhoneNumber] = useState('034 12 345 67');
  const [countryCode, setCountryCode] = useState('+261');

  // Flow states
  const [loading, setLoading] = useState(false);
  const [activeIntent, setActiveIntent] = useState<PaymentIntent | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string>('idle');
  const [pollingCount, setPollingCount] = useState<number>(0);
  const [settledIntent, setSettledIntent] = useState<PaymentIntent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // MM-04: Client proof simulator
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [smsReference, setSmsReference] = useState('');
  const [proofSubmittedMsg, setProofSubmittedMsg] = useState<string | null>(null);

  // Auto-détection de l'opérateur selon l'indicatif (MM-01)
  const handlePhoneChange = (val: string) => {
    setPhoneNumber(val);
    const cleaned = val.replace(/\s+/g, '');
    if (cleaned.startsWith('034')) {
      setOperator('orange-money');
    } else if (cleaned.startsWith('032') || cleaned.startsWith('033')) {
      setOperator('mvola');
    } else if (cleaned.startsWith('031')) {
      setOperator('airtel-money');
    }
  };

  // Soumission initiation MM (MM-02: Renvoie 202 Accepted)
  const handleInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // 1. Création intention de paiement (SEC-03: montant calculé côté serveur)
      const intent = paymentService.createPaymentIntent({
        reservationId,
        customerName: 'Utilisateur Mobile Money',
        customerEmail: 'client.mobile@eduloc.mg',
        paymentMethodType: 'mobile_money',
        idempotencyKey: `idem_mm_${Date.now()}`,
      });

      // 2. Déclenchement du push USSD (MM-01 & MM-02)
      const result = paymentService.initiateMobileMoney({
        intentId: intent.id,
        operator,
        phoneNumber,
        countryCode,
      });

      setActiveIntent(result.intent);
      setLoading(false);
      setPollingStatus('waiting_ussd');
      setPollingCount(1);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Erreur lors de l’envoi de la demande USSD.');
    }
  };

  // MM-03: Simulation de la validation sur le téléphone du client
  const handleSimulatePhoneAction = (action: 'confirm' | 'reject' | 'timeout') => {
    if (!activeIntent) return;

    setLoading(true);
    setTimeout(() => {
      const updated = paymentService.simulateUssdResponse(activeIntent.id, action);
      setLoading(false);

      if (action === 'confirm') {
        setActiveIntent(null);
        setSettledIntent(updated);
        triggerSuccessCelebration();
        onPaymentSuccess?.(updated);
      } else if (action === 'reject') {
        setErrorMsg('Paiement refusé ou annulé sur le téléphone mobile (code PIN erroné ou refus client).');
        setPollingStatus('idle');
      } else {
        setErrorMsg('Délai d’attente USSD expiré (3 minutes). Veuillez relancer la demande.');
        setPollingStatus('idle');
      }
    }, 800);
  };

  // MM-04: Soumission de preuve client
  const handleProofSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntent) return;

    const res = paymentService.submitClientProof(
      activeIntent.id,
      'sms_reference',
      smsReference || 'TX_SMS_91823901'
    );
    setProofSubmittedMsg(res.message);
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
            Paiement Mobile Money vérifié côté serveur
          </span>
          <h2 className="text-2xl font-extrabold text-ink mt-1">Réservation confirmée !</h2>
          <p className="text-sm text-ink-soft mt-1">
            La transaction a été validée par l'API officielle de l'opérateur ({settledIntent.mobileMoneyDetails?.operator}).
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5 text-left space-y-3 text-xs">
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">Référence transaction</span>
            <span className="font-mono font-bold text-ink">{settledIntent.id}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">Réf. Opérateur télécom</span>
            <span className="font-mono font-semibold text-ink">
              {settledIntent.mobileMoneyDetails?.operatorRef}
            </span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">Numéro débité</span>
            <span className="font-mono text-ink">
              {settledIntent.mobileMoneyDetails?.phoneMasked}
            </span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">Montant</span>
            <span className="font-bold text-ink text-sm">
              {settledIntent.amount.toLocaleString()} Ar
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-ink-soft">Synchronisation Odoo CRM</span>
            <span className="inline-flex items-center gap-1 font-semibold text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lead synchronisé ({settledIntent.odooRecordId})
            </span>
          </div>
        </div>

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => {
              setSettledIntent(null);
              onBack();
            }}
            className="rounded-xl border border-line px-5 py-2.5 text-xs font-semibold text-ink hover:bg-paper transition-colors"
          >
            Faire un autre paiement
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Conforme GSMA Mobile Money API</span>
        </div>
      </div>

      {/* MM-01: AVERTISSEMENT CRITIQUE DE SÉCURITÉ */}
      <div className="rounded-2xl border-2 border-destructive bg-error-tint/50 p-4 sm:p-5 flex items-start gap-3.5">
        <ShieldAlert className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-xs">
          <h4 className="text-destructive font-bold text-sm">
            Règle MM-01 : Ne communiquez JAMAIS votre code secret PIN
          </h4>
          <p className="text-ink-soft leading-relaxed">
            EduLoc et ses agents <strong>ne vous demanderont jamais votre code PIN Mobile Money</strong> ni aucun code secret par SMS, téléphone ou WhatsApp.
          </p>
          <ul className="list-disc pl-4 text-ink-soft space-y-1 font-medium">
            <li>La saisie du code PIN se fait <span className="text-destructive font-bold">exclusivement sur votre propre mobile</span> via l'invite USSD officielle.</li>
            <li>Aucun PIN n'est stocké dans nos systèmes ni dans notre CRM Odoo.</li>
          </ul>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-6 items-start">
        {/* Colonne gauche : Formulaire */}
        <div className="md:col-span-7 rounded-3xl border border-line bg-surface p-6 shadow-sm space-y-5">
          <div className="border-b border-line pb-3">
            <h3 className="text-lg font-bold text-ink">Paiement Mobile Money</h3>
            <p className="text-xs text-ink-soft">Validation par USSD push sur votre mobile</p>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-destructive/30 bg-error-tint/60 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!activeIntent ? (
            <form onSubmit={handleInitiate} className="space-y-4">
              {/* Choix opérateur */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Opérateur Mobile Money *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperator('orange-money')}
                    className={`rounded-xl border-2 p-2.5 text-xs font-bold text-center transition-all ${
                      operator === 'orange-money'
                        ? 'border-[#FF7900] bg-[#FFF2E6] text-[#FF7900]'
                        : 'border-line bg-paper text-ink hover:border-line-soft'
                    }`}
                  >
                    Orange Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperator('mvola')}
                    className={`rounded-xl border-2 p-2.5 text-xs font-bold text-center transition-all ${
                      operator === 'mvola'
                        ? 'border-[#008542] bg-[#E6F4ED] text-[#008542]'
                        : 'border-line bg-paper text-ink hover:border-line-soft'
                    }`}
                  >
                    MVola (Telma)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperator('airtel-money')}
                    className={`rounded-xl border-2 p-2.5 text-xs font-bold text-center transition-all ${
                      operator === 'airtel-money'
                        ? 'border-[#ED1C24] bg-[#FDE8E9] text-[#ED1C24]'
                        : 'border-line bg-paper text-ink hover:border-line-soft'
                    }`}
                  >
                    Airtel Money
                  </button>
                </div>
              </div>

              {/* Numéro de téléphone */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Numéro de téléphone mobile *
                </label>
                <div className="flex gap-2">
                  <span className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-ink flex items-center">
                    🇲🇬 +261
                  </span>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-mono text-ink tracking-wider focus:border-primary focus:outline-none"
                    placeholder="034 12 345 67"
                  />
                </div>
                <span className="block mt-1 text-[11px] text-muted-foreground">
                  L'opérateur est automatiquement détecté d'après le préfixe.
                </span>
              </div>

              {/* Bouton d'envoi du Push USSD */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white py-3.5 px-4 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Envoi de la demande USSD...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" />
                    <span>Envoyer la demande USSD ({calc.total.toLocaleString()} Ar)</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* État PENDING (MM-02) */
            <div className="space-y-4">
              <div className="rounded-2xl border border-warning/30 bg-warning-tint/50 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-warning">
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Statut : PENDING (Réponse HTTP 202 Accepted)</span>
                </div>
                <p className="text-ink-soft leading-relaxed">
                  Règle <strong>MM-02</strong> : La demande a été transmise à l'opérateur. La réservation ne sera confirmée
                  qu'après réception de la validation financière côté serveur (<strong>MM-03</strong>).
                </p>
              </div>

              <div className="rounded-xl bg-paper border border-line p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Réf. transaction :</span>
                  <span className="font-mono font-bold text-ink">{activeIntent.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Numéro débité :</span>
                  <span className="font-mono text-ink">{activeIntent.mobileMoneyDetails?.phoneMasked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Opérateur :</span>
                  <span className="font-semibold text-ink uppercase">{activeIntent.mobileMoneyDetails?.operator}</span>
                </div>
              </div>

              {/* MM-04: Section preuve client */}
              <div className="border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setShowProofUpload(!showProofUpload)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Vous avez déjà été débité par SMS ? (Règle MM-04)</span>
                </button>

                {showProofUpload && (
                  <form onSubmit={handleProofSubmit} className="mt-3 p-3 rounded-xl bg-paper border border-line space-y-2 text-xs">
                    <p className="text-muted-foreground leading-tight">
                      <strong>MM-04 :</strong> Un SMS ou une capture d'écran ouvre une vérification prioritaire, mais ne confirme pas automatiquement la réservation sans l'aval de l'opérateur.
                    </p>
                    <input
                      type="text"
                      value={smsReference}
                      onChange={(e) => setSmsReference(e.target.value)}
                      placeholder="Collez la référence du SMS reçu de l'opérateur"
                      className="w-full rounded-lg border border-line px-3 py-1.5 text-xs font-mono"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-secondary text-primary font-bold py-1.5 hover:bg-secondary/80"
                    >
                      Transmettre pour audit
                    </button>
                    {proofSubmittedMsg && (
                      <div className="p-2 rounded bg-accent-tint text-accent text-[11px] font-medium">
                        {proofSubmittedMsg}
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite : Simulateur de téléphone mobile physique (MM-01 & MM-03) */}
        <div className="md:col-span-5">
          <div className="rounded-[32px] border-4 border-slate-800 bg-slate-900 p-4 shadow-2xl text-white">
            {/* Haut de téléphone */}
            <div className="flex justify-between items-center px-2 pb-3 text-[10px] text-slate-400 border-b border-slate-800">
              <span>09:41</span>
              <div className="h-3.5 w-12 bg-slate-800 rounded-full" />
              <span>4G LTE 100%</span>
            </div>

            {/* Écran USSD */}
            <div className="my-6 min-h-[220px] rounded-2xl bg-slate-950 p-4 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-accent animate-ping" />
                  <span className="text-[11px] font-bold text-accent uppercase tracking-wider">
                    {operator.replace('-', ' ')}
                  </span>
                </div>

                <h5 className="text-xs font-bold text-slate-100">
                  {activeIntent ? 'Demande de paiement USSD' : 'En attente d’envoi USSD'}
                </h5>

                {activeIntent ? (
                  <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                    <p>
                      <strong>Marchand :</strong> EduLoc Madagascar
                    </p>
                    <p>
                      <strong>Montant :</strong> {calc.total.toLocaleString()} Ar
                    </p>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-amber-300">
                      🔒 Confirmez uniquement avec votre code secret confidentiel sur ce clavier mobile.
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
                    Cliquez sur "Envoyer la demande USSD" à gauche pour simuler l'affichage sur votre smartphone.
                  </p>
                )}
              </div>

              {/* Boutons d'action sur le mobile */}
              {activeIntent && (
                <div className="pt-4 border-t border-slate-800/80 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSimulatePhoneAction('confirm')}
                    disabled={loading}
                    className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white font-bold py-2 text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>✓ Confirmer mon paiement (Code PIN saisi)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulatePhoneAction('reject')}
                    disabled={loading}
                    className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-1.5 text-[11px] transition-colors"
                  >
                    Annuler / Rejeter la demande
                  </button>
                </div>
              )}
            </div>

            {/* Note pédagogique MM-01 */}
            <div className="px-2 text-[10px] text-slate-400 text-center leading-tight">
              Démonstration de la règle MM-01 : L'utilisateur n'expose jamais son PIN sur le Web, l'autorisation est strictement déléguée à la session USSD de l'opérateur.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
