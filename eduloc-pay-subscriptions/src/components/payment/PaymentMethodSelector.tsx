import React from 'react';
import { CreditCard, Smartphone, ShieldCheck, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SERVER_PRICE_CATALOG } from '@/services/paymentService';

interface Props {
  selectedReservation: string;
  onSelectReservation: (id: string) => void;
  selectedMethod: 'visa_stripe' | 'mobile_money';
  onSelectMethod: (method: 'visa_stripe' | 'mobile_money') => void;
  onProceed: () => void;
}

export const PaymentMethodSelector: React.FC<Props> = ({
  selectedReservation,
  onSelectReservation,
  selectedMethod,
  onSelectMethod,
  onProceed,
}) => {
  const currentItem = SERVER_PRICE_CATALOG[selectedReservation] || Object.values(SERVER_PRICE_CATALOG)[0];
  const totalAmount = currentItem.basePriceMGA + currentItem.platformFeeMGA;

  return (
    <div className="space-y-8">
      {/* Récapitulatif de la réservation */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sélection de la réservation
            </span>
            <h2 className="text-xl font-bold text-ink mt-1">Récapitulatif de votre séance</h2>
          </div>
          {/* Dropdown choix de réservation */}
          <select
            value={selectedReservation}
            onChange={(e) => onSelectReservation(e.target.value)}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink focus:border-primary focus:outline-none"
          >
            {Object.entries(SERVER_PRICE_CATALOG).map(([key, val]) => (
              <option key={key} value={key}>
                {val.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">{currentItem.title}</span>
            <span className="font-semibold text-ink">{currentItem.basePriceMGA.toLocaleString()} Ar</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Frais de plateforme et garantie tuteur</span>
            <span className="font-semibold text-ink">{currentItem.platformFeeMGA.toLocaleString()} Ar</span>
          </div>
          <div className="border-t border-line-soft pt-3 flex items-center justify-between">
            <div>
              <span className="text-base font-bold text-ink">Total calculé serveur</span>
              <p className="text-xs text-muted-foreground">Règle SEC-03 : Montant vérifié et non modifiable par le client</p>
            </div>
            <span className="text-2xl font-extrabold text-primary">
              {totalAmount.toLocaleString()} Ar
            </span>
          </div>
        </div>
      </div>

      {/* Choix du mode de paiement */}
      <div>
        <h3 className="text-lg font-bold text-ink mb-1">Choisissez votre mode de paiement</h3>
        <p className="text-sm text-ink-soft mb-4">
          Toutes nos transactions respectent les normes internationales PCI DSS Niveau 1 et GSMA Mobile Money.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Carte Bancaire / Visa */}
          <div
            onClick={() => onSelectMethod('visa_stripe')}
            className={`cursor-pointer rounded-2xl border-2 p-5 transition-all ${
              selectedMethod === 'visa_stripe'
                ? 'border-primary bg-primary-tint/30 shadow-md ring-2 ring-primary/20'
                : 'border-line bg-surface hover:border-primary/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary-tint text-primary">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-base">Carte Bancaire</h4>
                  <p className="text-xs text-ink-soft">Visa, Mastercard sécurisées</p>
                </div>
              </div>
              {selectedMethod === 'visa_stripe' && (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-md bg-white border border-line px-2 py-0.5 text-primary">
                PCI DSS Niveau 1
              </span>
              <span className="rounded-md bg-white border border-line px-2 py-0.5 text-violet">
                Visa Secure (3DS)
              </span>
              <span className="rounded-md bg-emerald-tint text-accent px-2 py-0.5">
                Zéro CVV Stocké
              </span>
            </div>

            <p className="mt-3 text-xs text-ink-soft leading-relaxed">
              Paiement direct sans manipuler vos données sensibles. Authentification bancaire renforcée.
            </p>
          </div>

          {/* Mobile Money */}
          <div
            onClick={() => onSelectMethod('mobile_money')}
            className={`cursor-pointer rounded-2xl border-2 p-5 transition-all ${
              selectedMethod === 'mobile_money'
                ? 'border-primary bg-primary-tint/30 shadow-md ring-2 ring-primary/20'
                : 'border-line bg-surface hover:border-primary/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent-tint text-accent">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-base">Mobile Money</h4>
                  <p className="text-xs text-ink-soft">Orange Money, MVola, Airtel</p>
                </div>
              </div>
              {selectedMethod === 'mobile_money' && (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-md bg-white border border-line px-2 py-0.5 text-accent">
                Conforme GSMA
              </span>
              <span className="rounded-md bg-white border border-line px-2 py-0.5 text-warning">
                Push USSD Sécurisé
              </span>
              <span className="rounded-md bg-error-tint text-destructive px-2 py-0.5">
                Zéro PIN Demandé
              </span>
            </div>

            <p className="mt-3 text-xs text-ink-soft leading-relaxed">
              Validation directe sur votre mobile. Aucun code secret ne vous sera jamais demandé sur ce site.
            </p>
          </div>
        </div>
      </div>

      {/* Garantie de sécurité */}
      <div className="rounded-2xl border border-line bg-accent-tint/30 p-4 flex items-center gap-3.5">
        <ShieldCheck className="h-6 w-6 text-accent shrink-0" />
        <div className="text-xs text-ink-soft leading-relaxed">
          <strong className="text-ink font-semibold">Paiement 100% garanti par EduLoc :</strong> vos fonds sont conservés sous séquestre sécurisé jusqu'à confirmation de la première séance de cours avec votre tuteur.
        </div>
      </div>

      {/* Bouton de progression */}
      <div className="flex justify-end">
        <button
          onClick={onProceed}
          className="inline-flex items-center gap-2 rounded-xl bg-[#3f22ba] hover:bg-[#341b9c] text-white px-6 py-3 font-semibold shadow-md transition-all hover:translate-y-[-1px]"
        >
          <span>Continuer vers le paiement ({totalAmount.toLocaleString()} Ar)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
