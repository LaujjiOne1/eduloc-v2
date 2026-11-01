import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  CreditCard,
  PauseCircle,
  PlayCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { paymentService, SUBSCRIPTION_PLANS } from '@/services/paymentService';
import { SubscriptionPlan, UserSubscription } from '@/types/payment';

export const SubscriptionPortal: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>(() =>
    paymentService.getSubscriptions()
  );
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SUBSCRIPTION_PLANS[0]);
  const [customerName, setCustomerName] = useState('Sarah Rasoanaivo');
  const [customerEmail, setCustomerEmail] = useState('sarah.rasoa@yahoo.fr');
  const [paymentType, setPaymentType] = useState<'visa_stripe' | 'mobile_money'>('visa_stripe');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeSub = subscriptions[0] || null;

  const refreshSubs = () => {
    setSubscriptions(paymentService.getSubscriptions());
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubscribing(true);

    setTimeout(() => {
      const newSub = paymentService.createSubscription({
        planId: selectedPlan.id,
        customerName,
        customerEmail,
        paymentMethod: {
          type: paymentType,
          cardBrand: paymentType === 'visa_stripe' ? 'visa' : undefined,
          cardLast4: paymentType === 'visa_stripe' ? '4242' : undefined,
          operator: paymentType === 'mobile_money' ? 'orange-money' : undefined,
          phoneMasked: paymentType === 'mobile_money' ? '034 **** 67' : undefined,
        },
      });

      refreshSubs();
      setIsSubscribing(false);
      setShowPlanModal(false);
      setActionNotice(`Abonnement "${selectedPlan.name}" activé avec succès !`);
      try {
        confetti({ particleCount: 70, spread: 60 });
      } catch {}
    }, 1000);
  };

  const handleTogglePause = (subId: string) => {
    const updated = paymentService.togglePauseSubscription(subId);
    refreshSubs();
    setActionNotice(
      updated.status === 'paused'
        ? 'Abonnement mis en pause pendant les vacances scolaires.'
        : 'Abonnement réactivé avec succès !'
    );
  };

  const handleCancel = (subId: string) => {
    if (confirm('Êtes-vous sûr de vouloir résilier votre abonnement ?')) {
      paymentService.cancelSubscription(subId);
      refreshSubs();
      setActionNotice('Abonnement résilié. Vous conserverez vos accès jusqu’à la fin de la période de facturation.');
    }
  };

  const handleChangePlan = (subId: string, newPlanId: string) => {
    const updated = paymentService.changeSubscriptionPlan(subId, newPlanId);
    refreshSubs();
    setActionNotice(`Formule mise à niveau vers "${updated.planName}" !`);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Bannière de notification */}
      {actionNotice && (
        <div className="rounded-2xl border border-accent/30 bg-accent-tint p-4 text-xs font-medium text-accent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-ink-soft hover:text-ink font-bold text-sm ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* État de l'abonnement en cours */}
      {activeSub && (
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Votre abonnement actif
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    activeSub.status === 'active'
                      ? 'bg-accent-tint text-accent'
                      : activeSub.status === 'paused'
                      ? 'bg-warning-tint text-warning'
                      : 'bg-error-tint text-destructive'
                  }`}
                >
                  {activeSub.status === 'active'
                    ? 'Actif'
                    : activeSub.status === 'paused'
                    ? 'En pause'
                    : 'Résilié'}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-ink mt-1">{activeSub.planName}</h2>
              <p className="text-xs text-ink-soft">
                Titulaire : {activeSub.customerName} ({activeSub.customerEmail})
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-ink-soft block">Facturation récurrente</span>
              <span className="text-xl font-black text-primary">
                {SUBSCRIPTION_PLANS.find((p) => p.id === activeSub.planId)?.priceMGA.toLocaleString()} Ar / mois
              </span>
            </div>
          </div>

          {/* Détails & Actions */}
          <div className="grid gap-4 sm:grid-cols-3 py-6 border-b border-line text-xs">
            <div className="p-3.5 rounded-2xl bg-paper border border-line">
              <span className="text-muted-foreground block mb-1">Moyen de paiement sécurisé</span>
              <div className="flex items-center gap-2 font-semibold text-ink">
                <CreditCard className="h-4 w-4 text-primary" />
                <span>
                  {activeSub.paymentMethod.type === 'visa_stripe'
                    ? `Visa **** ${activeSub.paymentMethod.cardLast4 || '4242'}`
                    : `Mobile Money ${activeSub.paymentMethod.phoneMasked || ''}`}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-paper border border-line">
              <span className="text-muted-foreground block mb-1">Période en cours</span>
              <div className="flex items-center gap-2 font-semibold text-ink">
                <Calendar className="h-4 w-4 text-accent" />
                <span>Renouvellement le {new Date(activeSub.currentPeriodEnd).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-paper border border-line">
              <span className="text-muted-foreground block mb-1">Factures acquittées</span>
              <div className="flex items-center gap-2 font-semibold text-ink">
                <FileText className="h-4 w-4 text-warning" />
                <span>{activeSub.invoicesCount} factures ({activeSub.totalPaidMGA.toLocaleString()} Ar au total)</span>
              </div>
            </div>
          </div>

          {/* Boutons d'administration d'abonnement */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTogglePause(activeSub.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-paper transition-colors"
              >
                {activeSub.status === 'paused' ? (
                  <>
                    <PlayCircle className="h-4 w-4 text-accent" />
                    <span>Reprendre l'abonnement</span>
                  </>
                ) : (
                  <>
                    <PauseCircle className="h-4 w-4 text-warning" />
                    <span>Mettre en pause (vacances)</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleCancel(activeSub.id)}
                disabled={activeSub.status === 'canceled'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/20 text-destructive px-4 py-2 text-xs font-semibold hover:bg-error-tint transition-colors disabled:opacity-40"
              >
                <XCircle className="h-4 w-4" />
                <span>Résilier sans frais</span>
              </button>
            </div>

            <button
              onClick={() => setShowPlanModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-4 py-2 text-xs font-semibold hover:bg-primary-dark transition-colors shadow-sm"
            >
              <Zap className="h-4 w-4 text-amber-300" />
              <span>Changer de formule</span>
            </button>
          </div>
        </div>
      )}

      {/* Grille des offres d'abonnements EduLoc */}
      <div>
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">
            Formules & Abonnements EduLoc
          </span>
          <h2 className="text-3xl font-bold text-ink mt-1">Le soutien continu en toute sérénité</h2>
          <p className="text-sm text-ink-soft mt-2">
            Paiements récurrents gérés en conformité bancaire Stripe et Mobile Money. Sans engagement, résiliable à tout moment.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = activeSub?.planId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border-2 p-6 flex flex-col justify-between transition-all ${
                  plan.popular
                    ? 'border-primary bg-surface shadow-xl ring-2 ring-primary/20'
                    : 'border-line bg-surface hover:border-primary/40'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary text-white px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">{plan.description}</p>

                  <div className="my-5 border-y border-line-soft py-4">
                    <span className="text-2xl font-black text-primary">
                      {plan.priceMGA.toLocaleString()} Ar
                    </span>
                    <span className="text-xs text-ink-soft"> / mois</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      (env. {plan.priceEUR.toFixed(2)} € / mois)
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-ink-soft mb-6">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-xl bg-accent-tint text-accent py-2.5 text-xs font-bold cursor-default"
                    >
                      Formule actuelle
                    </button>
                  ) : activeSub ? (
                    <button
                      onClick={() => handleChangePlan(activeSub.id, plan.id)}
                      className="w-full rounded-xl border-2 border-primary text-primary hover:bg-primary-tint py-2.5 text-xs font-bold transition-colors"
                    >
                      Basculer vers cette offre
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowPlanModal(true);
                      }}
                      className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white py-2.5 text-xs font-bold transition-colors shadow"
                    >
                      Souscrire à ce pass
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de souscription nouvelle formule */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="text-xs font-semibold text-accent uppercase">Nouvelle adhésion</span>
                <h4 className="text-lg font-bold text-ink">{selectedPlan.name}</h4>
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="h-8 w-8 rounded-full border border-line grid place-items-center text-ink-soft hover:text-ink"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubscribe} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-paper border border-line flex justify-between items-center">
                <span className="text-ink-soft">Tarif mensuel de l'abonnement :</span>
                <span className="text-base font-extrabold text-primary">
                  {selectedPlan.priceMGA.toLocaleString()} Ar / mois
                </span>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Nom et prénom du parent / élève</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-ink text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Adresse email pour la facturation</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-ink text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1.5">Moyen de prélèvement sécurisé</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('visa_stripe')}
                    className={`rounded-xl border-2 p-2.5 font-bold transition-all text-center ${
                      paymentType === 'visa_stripe'
                        ? 'border-primary bg-primary-tint text-primary'
                        : 'border-line bg-paper text-ink'
                    }`}
                  >
                    💳 Carte Visa / Stripe
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('mobile_money')}
                    className={`rounded-xl border-2 p-2.5 font-bold transition-all text-center ${
                      paymentType === 'mobile_money'
                        ? 'border-accent bg-accent-tint text-accent'
                        : 'border-line bg-paper text-ink'
                    }`}
                  >
                    📱 Mobile Money (Orange/MVola)
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-primary-tint/50 border border-line p-3 text-ink-soft text-[11px] leading-relaxed">
                <ShieldCheck className="h-4 w-4 text-primary inline mr-1" />
                Garantie sans engagement : vous pouvez interrompre, mettre en pause ou modifier votre forfait à tout moment depuis votre tableau de bord.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 rounded-xl border border-line py-2.5 font-semibold text-ink hover:bg-paper"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubscribing}
                  className="flex-1 rounded-xl bg-primary text-white py-2.5 font-bold shadow hover:bg-primary-dark flex items-center justify-center gap-1.5"
                >
                  {isSubscribing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Activation en cours...</span>
                    </>
                  ) : (
                    <span>Valider mon abonnement</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
