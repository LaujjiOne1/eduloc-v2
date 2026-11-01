/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CreditCard,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Lock,
  ExternalLink,
  MessageCircle,
  Phone,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Logo } from '@/components/site/Logo';
import { CheckoutPage } from '@/checkout/CheckoutPage';
import { StripeModernCheckout } from '@/components/payment/StripeModernCheckout';
import { SubscriptionPortal } from '@/components/subscription/SubscriptionPortal';
import { OdooCrmDashboard } from '@/components/odoo/OdooCrmDashboard';
import { ApiExplorer } from '@/components/api/ApiExplorer';
import { SecurityComplianceGuide } from '@/components/security/SecurityComplianceGuide';
import { PaymentFaq } from '@/components/faq/PaymentFaq';
import { EduLocSecurityVault3D } from '@/components/3d/EduLocSecurityVault3D';
import { VisaLogo, MastercardLogo, MVolaLogo, OrangeMoneyLogo, AirtelMoneyLogo } from '@/components/payment/PaymentLogos';

/** Vitrine de démonstration (ancienne page d'accueil du service) : simulation locale, sans lien avec les vrais paiements. */
function Showcase() {
  const [activeTab, setActiveTab] = useState<
    'checkout' | 'subscriptions' | 'odoo' | 'api' | 'security' | 'vault3d' | 'faq'
  >('checkout');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-[#332E86]/10">
      {/* Header conforme à la charte graphique edUloc (identique au footer) */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#14162B]/95 backdrop-blur-md text-white">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="cursor-pointer"
              onClick={() => setActiveTab('checkout')}
              title="Retour à l'accueil edUloc"
            >
              <Logo inverted size="md" />
            </div>
            <span className="hidden sm:inline-block text-xs font-medium text-[#8D90AA] border-l border-white/15 pl-3">
              Le bon accompagnement, au bon endroit.
            </span>
          </div>

          {/* Navigation simple, rassurante et centrée sur l'expérience parent */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('checkout')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'checkout'
                  ? 'bg-[#332E86] text-white shadow-xs'
                  : 'text-[#8D90AA] hover:text-white hover:bg-white/5'
              }`}
            >
              Paiement en ligne
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'subscriptions'
                  ? 'bg-[#332E86] text-white shadow-xs'
                  : 'text-[#8D90AA] hover:text-white hover:bg-white/5'
              }`}
            >
              Formules & Abonnements
            </button>
            <button
              onClick={() => setActiveTab('odoo')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'odoo'
                  ? 'bg-[#332E86] text-white shadow-xs'
                  : 'text-[#8D90AA] hover:text-white hover:bg-white/5'
              }`}
            >
              Suivi de commande
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'faq'
                  ? 'bg-[#332E86] text-white shadow-xs'
                  : 'text-[#8D90AA] hover:text-white hover:bg-white/5'
              }`}
            >
              Questions fréquentes
            </button>
          </nav>

          {/* Support client direct pour les parents */}
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/261340000000?text=Bonjour%20EduLoc%2C%20j%27ai%20une%20question%20sur%20mon%20paiement"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/90 hover:border-white/30 hover:bg-white/10 transition-all shadow-xs"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#0E9C82]" />
              <span>Aide WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Navigation mobile compacte */}
        <div className="flex md:hidden overflow-x-auto px-4 py-2 border-t border-white/10 gap-2 text-xs font-medium bg-[#14162B]">
          <button
            onClick={() => setActiveTab('checkout')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${
              activeTab === 'checkout' ? 'bg-[#332E86] text-white font-bold' : 'text-[#8D90AA]'
            }`}
          >
            Paiement
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${
              activeTab === 'subscriptions' ? 'bg-[#332E86] text-white font-bold' : 'text-[#8D90AA]'
            }`}
          >
            Abonnements
          </button>
          <button
            onClick={() => setActiveTab('odoo')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${
              activeTab === 'odoo' ? 'bg-[#332E86] text-white font-bold' : 'text-[#8D90AA]'
            }`}
          >
            Suivi & Reçus
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${
              activeTab === 'faq' ? 'bg-[#332E86] text-white font-bold' : 'text-[#8D90AA]'
            }`}
          >
            FAQ
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8">
        {/* Tab 1: Paiement Moderne en 2 Colonnes (Stripe Style) */}
        {activeTab === 'checkout' && <StripeModernCheckout />}

        {/* Tab 2: Gestion des Abonnements */}
        {activeTab === 'subscriptions' && <SubscriptionPortal />}

        {/* Tab 3: Odoo CRM & Suivi des réservations */}
        {activeTab === 'odoo' && <OdooCrmDashboard />}

        {/* Tab 4: Documentation API REST (pour partenaires/développeurs) */}
        {activeTab === 'api' && <ApiExplorer />}

        {/* Tab 5: Conformité Sécurité & Audit de Contrôle */}
        {activeTab === 'security' && <SecurityComplianceGuide />}

        {/* Tab 6: Visualisation 3D */}
        {activeTab === 'vault3d' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900">
                Visualisation 3D · Architecture Procédurale edUloc
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rendu Three.js PBR avec éclairage studio RoomEnvironment et dock de contrôle ergonomique.
              </p>
            </div>
            <EduLocSecurityVault3D />
          </div>
        )}

        {/* Tab 7: FAQ sur les paiements */}
        {activeTab === 'faq' && <PaymentFaq />}
      </main>

      {/* Footer conforme à la charte graphique edUloc */}
      <footer className="mt-auto border-t border-white/10 bg-[#14162B] text-white/80 py-12 text-xs">
        <div className="container mx-auto px-4 space-y-10">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 border-b border-white/10 pb-10">
            {/* Logo et baseline conformes au footer officiel */}
            <div className="space-y-3 max-w-sm">
              <Logo inverted size="lg" />
              <p className="text-sm text-[#8D90AA] font-normal leading-relaxed">
                Le bon accompagnement, au bon endroit.
              </p>
              <p className="text-xs text-white/50 pt-1 leading-relaxed">
                Plateforme de soutien scolaire d'excellence avec mise en relation vérifiée et paiement sécurisé.
              </p>
            </div>

            {/* Liens du footer */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
              <div>
                <span className="block font-semibold text-white uppercase tracking-wider text-[11px] mb-3">
                  Paiements & Tarifs
                </span>
                <ul className="space-y-2 text-[#8D90AA]">
                  <li>
                    <button
                      onClick={() => setActiveTab('checkout')}
                      className="hover:text-white transition-colors"
                    >
                      Paiement de séance
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('subscriptions')}
                      className="hover:text-white transition-colors"
                    >
                      Abonnements mensuels
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('faq')}
                      className="hover:text-white transition-colors"
                    >
                      FAQ Paiements
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <span className="block font-semibold text-white uppercase tracking-wider text-[11px] mb-3">
                  Espace Parents
                </span>
                <ul className="space-y-2 text-[#8D90AA]">
                  <li>
                    <button
                      onClick={() => setActiveTab('odoo')}
                      className="hover:text-white transition-colors"
                    >
                      Suivi des séances & reçus
                    </button>
                  </li>
                  <li>
                    <a
                      href="https://wa.me/261340000000"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      Conseiller pédagogique
                    </a>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('faq')}
                      className="hover:text-white transition-colors"
                    >
                      Garantie satisfaction
                    </button>
                  </li>
                </ul>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="block font-semibold text-white uppercase tracking-wider text-[11px] mb-3">
                  Sécurité & Technique
                </span>
                <ul className="space-y-2 text-[#8D90AA]">
                  <li>
                    <button
                      onClick={() => setActiveTab('security')}
                      className="hover:text-white transition-colors"
                    >
                      Conformité bancaire
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('api')}
                      className="hover:text-white transition-colors"
                    >
                      Documentation API
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('vault3d')}
                      className="hover:text-white transition-colors"
                    >
                      Modèle 3D
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Logos des banques et opérateurs partenaires */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#8D90AA]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0E9C82]" />
                Paiement 100% sécurisé
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[#FFC600] font-medium">
                MVola
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[#FF7900] font-medium">
                Orange Money
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[#ED1C24] font-medium">
                Airtel Money
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/90 font-medium">
                Visa · Mastercard
              </span>
            </div>

            <p>© {new Date().getFullYear()} edUloc Madagascar · Tous droits réservés.</p>
          </div>

          <div className="text-[10px] text-white/40 text-center sm:text-left border-t border-white/5 pt-4">
            Vos informations de paiement sont protégées par chiffrement de bout en bout. edUloc ne stocke aucun code secret CVV ni code confidentiel Mobile Money.
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * `/checkout` = la vraie page de paiement, ouverte depuis l'application EduLoc avec un ticket signé (#ticket=…).
 * Tout le reste est la vitrine de démonstration.
 */
export default function App() {
  return window.location.pathname.startsWith('/checkout') ? <CheckoutPage /> : <Showcase />;
}
