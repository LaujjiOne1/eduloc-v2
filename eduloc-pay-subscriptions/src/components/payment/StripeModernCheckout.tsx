import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Star,
  Calendar,
  Download,
  Share2,
  RefreshCw,
  Clock,
  Sparkles,
  Award,
  HeartHandshake,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Logo } from '@/components/site/Logo';
import { VisaLogo, MastercardLogo, MVolaLogo, OrangeMoneyLogo, AirtelMoneyLogo } from './PaymentLogos';
import { paymentService, SERVER_PRICE_CATALOG } from '@/services/paymentService';
import { PaymentIntent } from '@/types/payment';

interface Props {
  onBackToCatalogue?: () => void;
  initialReservationId?: string;
}

export const StripeModernCheckout: React.FC<Props> = ({
  onBackToCatalogue,
  initialReservationId = 'res_maths_4e',
}) => {
  // Stepper state: 1 = Choix de l'offre, 2 = Coordonnées & Paiement, 3 = Confirmation
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(2);

  // Reservation selection
  const [reservationKey, setReservationKey] = useState<string>(initialReservationId);
  const courseDetails = SERVER_PRICE_CATALOG[reservationKey] || SERVER_PRICE_CATALOG['res_maths_4e'];
  const totalAmount = courseDetails.basePriceMGA + courseDetails.platformFeeMGA;

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobile_money'>('card');
  const [mobileOperator, setMobileOperator] = useState<'mvola' | 'orange-money' | 'airtel-money'>('mvola');

  // Form inputs
  const [parentName, setParentName] = useState('Aina Rakotoarisoa');
  const [parentEmail, setParentEmail] = useState('aina.rakoto@gmail.com');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [phoneNumber, setPhoneNumber] = useState('034 12 345 67');

  // UI state
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUssdWaiting, setIsUssdWaiting] = useState(false);
  const [ussdSecondsLeft, setUssdSecondsLeft] = useState(60);
  const [settledPayment, setSettledPayment] = useState<PaymentIntent | null>(null);

  // USSD Countdown timer
  useEffect(() => {
    let timer: any;
    if (isUssdWaiting && ussdSecondsLeft > 0) {
      timer = setInterval(() => {
        setUssdSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (ussdSecondsLeft === 0) {
      // Timeout reached
    }
    return () => clearInterval(timer);
  }, [isUssdWaiting, ussdSecondsLeft]);

  // Format card number with spaces
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
  };

  // Format phone number (ex: 034 12 345 67)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    // Auto detect operator
    if (raw.startsWith('032') || raw.startsWith('033')) {
      setMobileOperator('mvola');
    } else if (raw.startsWith('034')) {
      setMobileOperator('orange-money');
    } else if (raw.startsWith('031')) {
      setMobileOperator('airtel-money');
    }

    let formatted = raw;
    if (raw.length > 3 && raw.length <= 5) {
      formatted = `${raw.slice(0, 3)} ${raw.slice(3)}`;
    } else if (raw.length > 5 && raw.length <= 8) {
      formatted = `${raw.slice(0, 3)} ${raw.slice(3, 5)} ${raw.slice(5)}`;
    } else if (raw.length > 8) {
      formatted = `${raw.slice(0, 3)} ${raw.slice(3, 5)} ${raw.slice(5, 8)} ${raw.slice(8)}`;
    }
    setPhoneNumber(formatted);
  };

  // Submit payment
  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    if (paymentMethod === 'card') {
      setTimeout(() => {
        // Create server-side payment intent
        const intent = paymentService.createPaymentIntent({
          reservationId: reservationKey,
          customerName: parentName,
          customerEmail: parentEmail,
          paymentMethodType: 'visa_stripe',
          idempotencyKey: `idem_stripe_${Date.now()}`,
        });

        // Settle directly
        const settled = paymentService.confirmVisaPayment({
          intentId: intent.id,
          cardBrand: 'visa',
          cardLast4: cardNumber.slice(-4) || '4242',
          expMonth: 12,
          expYear: 2028,
          stripeToken: `tok_${Date.now()}`,
          requires3DS: false,
        });

        setIsProcessing(false);
        setSettledPayment(settled.intent);
        setCurrentStep(3);
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        } catch {}
      }, 1200);
    } else {
      // Mobile Money flow: start USSD waiting radar
      setTimeout(() => {
        const intent = paymentService.createPaymentIntent({
          reservationId: reservationKey,
          customerName: parentName,
          customerEmail: parentEmail,
          paymentMethodType: 'mobile_money',
          idempotencyKey: `idem_mm_${Date.now()}`,
        });

        paymentService.initiateMobileMoney({
          intentId: intent.id,
          operator: mobileOperator,
          phoneNumber,
        });

        setIsProcessing(false);
        setIsUssdWaiting(true);
        setUssdSecondsLeft(60);
        setSettledPayment(intent);
      }, 800);
    }
  };

  // Simulate user confirming on their mobile phone
  const handleSimulateMobileConfirm = () => {
    if (!settledPayment) return;
    setIsProcessing(true);

    setTimeout(() => {
      const confirmed = paymentService.simulateUssdResponse(settledPayment.id, 'confirm');
      setIsProcessing(false);
      setIsUssdWaiting(false);
      setSettledPayment(confirmed);
      setCurrentStep(3);
      try {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      } catch {}
    }, 600);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-4 sm:py-8 space-y-6">
      {/* 1. Header de réassurance épuré (Zéro jargon) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          <Logo size="md" />
        </div>

        {/* Badge unique et universel demandé */}
        <div className="flex items-center gap-3 rounded-full bg-slate-100/90 border border-slate-200 px-4 py-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Lock className="h-3.5 w-3.5 text-[#0E9C82]" />
            <span>Paiement 100% sécurisé et garanti par edUloc</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-300">
            <VisaLogo className="h-3.5 w-auto" />
            <MastercardLogo className="h-3.5 w-auto" />
            <MVolaLogo className="h-3 w-auto" />
            <OrangeMoneyLogo className="h-3 w-auto" />
          </div>
        </div>
      </div>

      {/* 2. Fil d'Ariane en 3 étapes animées (Stepper) */}
      <div className="py-2">
        <div className="flex items-center justify-center max-w-xl mx-auto text-xs font-semibold">
          {/* Étape 1 */}
          <div className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs transition-all ${
                currentStep > 1
                  ? 'bg-[#0E9C82] text-white'
                  : 'bg-[#332E86] text-white shadow-sm ring-4 ring-[#332E86]/10'
              }`}
            >
              {currentStep > 1 ? <CheckCircle2 className="h-4 w-4" /> : '1'}
            </span>
            <span className={currentStep >= 1 ? 'text-slate-900 font-bold' : 'text-slate-400'}>
              Choix du cours
            </span>
          </div>

          <div
            className={`h-0.5 w-12 sm:w-20 mx-2 sm:mx-4 transition-colors ${
              currentStep > 1 ? 'bg-[#0E9C82]' : 'bg-slate-200'
            }`}
          />

          {/* Étape 2 */}
          <div className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs transition-all ${
                currentStep > 2
                  ? 'bg-[#0E9C82] text-white'
                  : currentStep === 2
                  ? 'bg-[#332E86] text-white shadow-sm ring-4 ring-[#332E86]/10'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {currentStep > 2 ? <CheckCircle2 className="h-4 w-4" /> : '2'}
            </span>
            <span className={currentStep >= 2 ? 'text-slate-900 font-bold' : 'text-slate-400'}>
              Coordonnées & Paiement
            </span>
          </div>

          <div
            className={`h-0.5 w-12 sm:w-20 mx-2 sm:mx-4 transition-colors ${
              currentStep === 3 ? 'bg-[#0E9C82]' : 'bg-slate-200'
            }`}
          />

          {/* Étape 3 */}
          <div className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs transition-all ${
                currentStep === 3
                  ? 'bg-[#0E9C82] text-white ring-4 ring-[#0E9C82]/20'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {currentStep === 3 ? <CheckCircle2 className="h-4 w-4" /> : '3'}
            </span>
            <span className={currentStep === 3 ? 'text-slate-900 font-bold' : 'text-slate-400'}>
              Confirmation
            </span>
          </div>
        </div>
      </div>

      {/* Accordéon mobile pour le récapitulatif */}
      {currentStep !== 3 && (
        <div className="lg:hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <button
            type="button"
            onClick={() => setIsMobileSummaryOpen(!isMobileSummaryOpen)}
            className="w-full flex items-center justify-between text-left text-sm font-bold text-slate-900"
          >
            <div className="flex items-center gap-2">
              <span>Détails de la réservation :</span>
              <span className="text-[#332E86] font-extrabold">{totalAmount.toLocaleString()} Ar</span>
            </div>
            {isMobileSummaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {isMobileSummaryOpen && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">{courseDetails.title}</span>
                <span className="font-semibold text-slate-900">{courseDetails.basePriceMGA.toLocaleString()} Ar</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Garantie & frais de plateforme</span>
                <span className="font-semibold text-slate-900">{courseDetails.platformFeeMGA.toLocaleString()} Ar</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#332E86] text-white font-bold grid place-items-center text-xs">
                  LR
                </div>
                <div>
                  <strong className="block text-slate-900">Lova Ranaivoson</strong>
                  <span className="text-[11px] text-slate-500">Tuteur certifié · Mathématiques (4.9 ★)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Écran Étape 3 : Confirmation & Succès */}
      {currentStep === 3 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto space-y-6">
          <div className="inline-grid h-20 w-20 place-items-center rounded-3xl bg-emerald-50 text-[#0E9C82] shadow-sm animate-in zoom-in-75 duration-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div>
            <span className="text-xs font-bold text-[#0E9C82] uppercase tracking-wider">
              Paiement confirmé avec succès
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-1">Votre séance est réservée !</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              Un e-mail de confirmation avec votre reçu a été envoyé à <strong>{parentEmail}</strong>. Votre tuteur a été immédiatement notifié.
            </p>
          </div>

          {/* Carte Tuteur & Séance */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 text-left space-y-3.5">
            <div className="flex items-center gap-3.5 border-b border-slate-200/70 pb-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#332E86] to-[#8D7FE3] text-white font-extrabold grid place-items-center text-base shadow-sm">
                LR
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-slate-900 text-sm">Lova Ranaivoson</h4>
                  <span className="rounded-full bg-emerald-100 text-[#0E9C82] text-[10px] font-bold px-2 py-0.2">
                    Vérifié EduLoc
                  </span>
                </div>
                <p className="text-xs text-slate-500">Professeur de Mathématiques · 4 séances à domicile ou en ligne</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Montant réglé</span>
                <span className="text-base font-extrabold text-[#332E86]">{totalAmount.toLocaleString()} Ar</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Référence de commande :</span>
                <span className="font-mono font-bold text-slate-800">
                  {settledPayment?.id || `EDULOC-${Date.now().toString().slice(-6)}`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Moyen de règlement :</span>
                <span className="font-semibold text-slate-800">
                  {paymentMethod === 'card'
                    ? `Carte bancaire (**** ${cardNumber.slice(-4)})`
                    : `Mobile Money (${mobileOperator.toUpperCase()} - ${phoneNumber})`}
                </span>
              </div>
            </div>
          </div>

          {/* Boutons d'agenda & reçu */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                alert('Ajouté à votre Google Agenda pour samedi prochain à 14h !');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-semibold transition-colors shadow-xs"
            >
              <Calendar className="h-4 w-4" />
              <span>Ajouter à Google Agenda</span>
            </button>

            <button
              onClick={() => {
                window.print();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2.5 text-xs font-semibold transition-colors shadow-xs"
            >
              <Download className="h-4 w-4" />
              <span>Télécharger mon reçu (PDF)</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setCurrentStep(2);
                setSettledPayment(null);
                setIsUssdWaiting(false);
              }}
              className="text-xs font-semibold text-[#332E86] hover:underline"
            >
              ← Réserver un autre cours ou modifier
            </button>
          </div>
        </div>
      ) : (
        /* 3. Structure en 2 Colonnes (Modèle Checkout Moderne 50/50 Desktop) */
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* ======================================================== */}
          {/* COLONNE GAUCHE (Réassurance & Total) - 5 colonnes sur 12 */}
          {/* ======================================================== */}
          <div className="hidden lg:block lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xs space-y-6">
            <div>
              <button
                type="button"
                onClick={onBackToCatalogue}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-4"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour aux cours</span>
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Récapitulatif de votre séance
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-1">{courseDetails.title}</h2>
            </div>

            {/* Fiche Tuteur avec avatar & note */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#332E86] to-[#8D7FE3] text-white font-extrabold grid place-items-center text-sm shadow-xs shrink-0">
                LR
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-slate-900 text-sm truncate">Lova Ranaivoson</h4>
                  <span className="flex items-center text-[11px] font-bold text-amber-500 shrink-0">
                    <Star className="h-3 w-3 fill-amber-400 stroke-amber-400 mr-0.5" />
                    4.9
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">Mathématiques · 12 ans d'expérience</p>
              </div>
            </div>

            {/* Garanties rassurantes edUloc */}
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <HeartHandshake className="h-4 w-4 text-[#0E9C82] shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900">Garantie satisfaction :</strong> si le premier cours ne vous convient pas, nous vous remplaçons gratuitement de tuteur sous 48h ou vous remboursons.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#0E9C82] shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900">Paiement sous séquestre :</strong> vos fonds sont conservés en sécurité et ne sont versés au professeur qu'après votre accord.
                </p>
              </div>
            </div>

            {/* Décomposition tarifaire détaillée */}
            <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>4 séances particulières de 1h30</span>
                <span className="font-semibold text-slate-900">{courseDetails.basePriceMGA.toLocaleString()} Ar</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Suivi pédagogique & plateforme</span>
                <span className="font-semibold text-slate-900">{courseDetails.platformFeeMGA.toLocaleString()} Ar</span>
              </div>
              <div className="border-t border-slate-200/80 pt-3 flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Total à régler</span>
                  <span className="text-[11px] text-slate-500">Toutes taxes comprises</span>
                </div>
                <span className="text-3xl font-black text-[#332E86]">
                  {totalAmount.toLocaleString()} Ar
                </span>
              </div>
            </div>

            {/* Témoignage parent */}
            <div className="rounded-xl bg-[#ECEAF9]/50 p-3.5 border border-[#ECEAF9] text-[11px] text-slate-700 italic">
              « Lova est un enseignant patient et très pédagogue. Notre fils a gagné 4 points sur sa moyenne de maths dès le premier mois ! »
              <span className="block not-italic font-bold text-slate-900 mt-1.5">— Mialy R., maman d'un élève de 4ème</span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* COLONNE DROITE (Formulaire épuré moderne) - 7 colonnes   */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            {isUssdWaiting ? (
              /* ÉTAT D'ATTENTE USSD SCÉNARISÉ & ANIMÉ (Sans le faux smartphone) */
              <div className="text-center py-6 sm:py-10 space-y-6">
                {/* Radar pulsé animé avec logo au centre */}
                <div className="relative mx-auto h-28 w-28 grid place-items-center">
                  <div className="absolute inset-0 rounded-full bg-[#8D7FE3]/15 animate-ping" style={{ animationDuration: '2.5s' }} />
                  <div className="absolute inset-2 rounded-full bg-[#332E86]/10 animate-pulse" />
                  <div className="relative h-16 w-16 rounded-2xl bg-white shadow-md border border-slate-100 grid place-items-center z-10">
                    {mobileOperator === 'mvola' && <MVolaLogo className="h-7 w-auto" />}
                    {mobileOperator === 'orange-money' && <OrangeMoneyLogo className="h-7 w-auto" />}
                    {mobileOperator === 'airtel-money' && <AirtelMoneyLogo className="h-7 w-auto" />}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">Consultez votre téléphone</h3>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto mt-2 leading-relaxed">
                    Une invitation de validation USSD vient d'être envoyée sur le <strong className="text-slate-900">{phoneNumber}</strong>.
                    Entrez votre code secret confidentiel sur votre mobile pour valider le règlement de <strong className="text-[#332E86]">{totalAmount.toLocaleString()} Ar</strong>.
                  </p>
                </div>

                {/* Compte à rebours circulaire 60s */}
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-4 py-1.5 text-xs text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-[#332E86]" />
                  <span>Délai restant : <strong className="text-slate-900 font-mono">{ussdSecondsLeft}s</strong></span>
                </div>

                {/* Bouton de simulation / confirmation */}
                <div className="pt-2 max-w-sm mx-auto space-y-2.5">
                  <button
                    type="button"
                    onClick={handleSimulateMobileConfirm}
                    disabled={isProcessing}
                    className="w-full rounded-xl bg-[#0E9C82] hover:bg-[#0c8a73] text-white py-3 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>Simuler la validation sur mon mobile</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUssdSecondsLeft(60)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Renvoyer la demande
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUssdWaiting(false)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Annuler
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Votre code PIN ne vous sera jamais demandé sur ce site. La confirmation est strictement effectuée sur votre téléphone.
                </p>
              </div>
            ) : (
              /* FORMULAIRE DE PAIEMENT ÉPURÉ */
              <form onSubmit={handlePay} className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Moyen de paiement</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Choisissez comment vous souhaitez régler votre réservation en toute sécurité.
                  </p>

                  {/* 1. Sélecteur visuel inspiré de Stripe & de l'image de référence */}
                  <div className="space-y-3">
                    {/* Carte Bancaire */}
                    <label
                      onClick={() => setPaymentMethod('card')}
                      className={`flex items-center justify-between rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                        paymentMethod === 'card'
                          ? 'border-[#332E86] bg-[#ECEAF9]/25 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-50 border border-slate-100">
                          <VisaLogo className="h-4 w-auto" />
                          <MastercardLogo className="h-4 w-auto" />
                        </div>
                        <div>
                          <strong className="block text-slate-900 text-sm">Carte Bancaire</strong>
                          <span className="text-xs text-slate-500">Visa, Mastercard</span>
                        </div>
                      </div>

                      <div
                        className={`h-5 w-5 rounded-full border-2 grid place-items-center transition-all ${
                          paymentMethod === 'card' ? 'border-[#332E86]' : 'border-slate-300'
                        }`}
                      >
                        {paymentMethod === 'card' && (
                          <div className="h-2.5 w-2.5 rounded-full bg-[#332E86]" />
                        )}
                      </div>
                    </label>

                    {/* Mobile Money */}
                    <label
                      onClick={() => setPaymentMethod('mobile_money')}
                      className={`flex items-center justify-between rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                        paymentMethod === 'mobile_money'
                          ? 'border-[#332E86] bg-[#ECEAF9]/25 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-50 border border-slate-100">
                          <MVolaLogo className="h-4 w-auto" />
                          <OrangeMoneyLogo className="h-4 w-auto" />
                        </div>
                        <div>
                          <strong className="block text-slate-900 text-sm">Mobile Money</strong>
                          <span className="text-xs text-slate-500">Mvola, Orange Money, Airtel</span>
                        </div>
                      </div>

                      <div
                        className={`h-5 w-5 rounded-full border-2 grid place-items-center transition-all ${
                          paymentMethod === 'mobile_money' ? 'border-[#332E86]' : 'border-slate-300'
                        }`}
                      >
                        {paymentMethod === 'mobile_money' && (
                          <div className="h-2.5 w-2.5 rounded-full bg-[#332E86]" />
                        )}
                      </div>
                    </label>
                  </div>
                </div>

                {/* Saisie Coordonnées Parent */}
                <div className="grid sm:grid-cols-2 gap-3.5 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Nom et prénom du parent *
                    </label>
                    <input
                      type="text"
                      required
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Ex : Aina Rakotoarisoa"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#332E86] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Email pour recevoir le reçu *
                    </label>
                    <input
                      type="email"
                      required
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="aina.rakoto@gmail.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#332E86] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Si CARTE BANCAIRE sélectionnée */}
                {paymentMethod === 'card' && (
                  <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Numéro de carte *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          placeholder="4242 4242 4242 4242"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-3.5 pr-12 py-2.5 text-xs font-mono tracking-wider text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#332E86] focus:outline-none"
                        />
                        <div className="absolute right-3 top-2.5 flex items-center gap-1">
                          <VisaLogo className="h-3.5 w-auto" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Expiration (MM/AA) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="12/28"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono text-center text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#332E86] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          CVC / CVV *
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            required
                            maxLength={4}
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            placeholder="•••"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono text-center text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#332E86] focus:outline-none"
                          />
                          <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Si MOBILE MONEY sélectionné */}
                {paymentMethod === 'mobile_money' && (
                  <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-2">
                        Sélectionnez votre opérateur *
                      </label>
                      {/* 3 cartes carrées avec les vrais logos colorés */}
                      <div className="grid grid-cols-3 gap-2.5">
                        {/* MVola */}
                        <div
                          onClick={() => setMobileOperator('mvola')}
                          className={`cursor-pointer rounded-2xl border-2 p-3 text-center transition-all ${
                            mobileOperator === 'mvola'
                              ? 'border-[#332E86] bg-white shadow-sm ring-2 ring-[#332E86]/10'
                              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                          }`}
                        >
                          <div className="h-8 flex items-center justify-center mb-1">
                            <MVolaLogo className="h-5 w-auto" />
                          </div>
                          <span className="block text-[11px] font-bold text-[#008542]">Mvola</span>
                          <span className="text-[10px] text-slate-400">032 / 033</span>
                        </div>

                        {/* Orange Money */}
                        <div
                          onClick={() => setMobileOperator('orange-money')}
                          className={`cursor-pointer rounded-2xl border-2 p-3 text-center transition-all ${
                            mobileOperator === 'orange-money'
                              ? 'border-[#332E86] bg-white shadow-sm ring-2 ring-[#332E86]/10'
                              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                          }`}
                        >
                          <div className="h-8 flex items-center justify-center mb-1">
                            <OrangeMoneyLogo className="h-5 w-auto" />
                          </div>
                          <span className="block text-[11px] font-bold text-[#FF7900]">Orange</span>
                          <span className="text-[10px] text-slate-400">034</span>
                        </div>

                        {/* Airtel Money */}
                        <div
                          onClick={() => setMobileOperator('airtel-money')}
                          className={`cursor-pointer rounded-2xl border-2 p-3 text-center transition-all ${
                            mobileOperator === 'airtel-money'
                              ? 'border-[#332E86] bg-white shadow-sm ring-2 ring-[#332E86]/10'
                              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                          }`}
                        >
                          <div className="h-8 flex items-center justify-center mb-1">
                            <AirtelMoneyLogo className="h-5 w-auto" />
                          </div>
                          <span className="block text-[11px] font-bold text-[#ED1C24]">Airtel</span>
                          <span className="text-[10px] text-slate-400">031</span>
                        </div>
                      </div>
                    </div>

                    {/* Champ téléphone pré-formaté */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Numéro de téléphone mobile *
                      </label>
                      <div className="flex rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden focus-within:bg-white focus-within:border-[#332E86]">
                        <span className="flex items-center gap-1.5 px-3 bg-slate-100/70 border-r border-slate-200 text-xs font-semibold text-slate-700">
                          <span>🇲🇬</span>
                          <span>+261</span>
                        </span>
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={handlePhoneChange}
                          placeholder="034 12 345 67"
                          className="w-full px-3.5 py-2.5 text-xs font-mono tracking-wider text-slate-900 bg-transparent focus:outline-none"
                        />
                      </div>
                      <span className="block mt-1 text-[11px] text-slate-500">
                        Vous recevrez une notification sur ce mobile pour confirmer la transaction.
                      </span>
                    </div>
                  </div>
                )}

                {/* Bouton d'action signature avec dégradé subtil */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full rounded-xl bg-gradient-to-r from-[#332E86] via-[#3d37a1] to-[#332E86] hover:from-[#2a266f] hover:to-[#2a266f] text-white py-3.5 px-6 font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Sécurisation en cours...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>Valider le paiement ({totalAmount.toLocaleString()} Ar) →</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-slate-500 mt-2.5">
                    {paymentMethod === 'card'
                      ? '🔒 Vos informations sont chiffrées de bout en bout et protégées.'
                      : '📱 La validation s’effectue en direct sur votre téléphone sans frais supplémentaires.'}
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
