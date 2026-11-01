import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ShieldCheck, Smartphone, AlertCircle, Database } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string | React.ReactNode;
}

interface FaqCategory {
  title: string;
  icon: React.ReactNode;
  items: FaqItem[];
}

export const PaymentFaq: React.FC = () => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'cat-0-item-0': true,
    'cat-1-item-1': true,
  });

  const toggle = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories: FaqCategory[] = [
    {
      title: 'Sécurité et Confidentialité (PCI DSS)',
      icon: <ShieldCheck className="h-5 w-5 text-primary" />,
      items: [
        {
          q: 'Mes données bancaires sont-elles en sécurité ?',
          a: 'Oui, absolument. edUloc utilise un prestataire de paiement certifié PCI DSS Niveau 1, le plus haut niveau de certification mondial pour la sécurité des cartes bancaires. Vos numéros de carte ne transitent jamais par nos serveurs, le code CVV n’est jamais stocké (interdiction absolue PCI DSS) et toutes les transactions sont chiffrées en HTTPS/TLS avec authentification Visa Secure obligatoire.',
        },
        {
          q: 'Puis-je enregistrer ma carte pour mes prochains paiements ?',
          a: 'Par mesure de sécurité stricte, edUloc ne conserve pas les numéros de carte complets. Nous ne stockons qu’un jeton (token) sécurisé fourni par le prestataire, la marque (Visa/Mastercard) et les 4 derniers chiffres. Le code CVV ne sera jamais enregistré.',
        },
        {
          q: 'Qu’est-ce que le protocole Visa Secure / 3D Secure ?',
          a: 'Le Visa Secure (EMV 3-D Secure) est un protocole qui ajoute une couche d’authentification supplémentaire gérée directement par votre banque (par exemple un code SMS à usage unique ou une validation dans votre application bancaire). EduLoc ne développe aucun formulaire pour recueillir ces codes secrets.',
        },
      ],
    },
    {
      title: 'Paiements Mobile Money (Orange Money, MVola, Airtel)',
      icon: <Smartphone className="h-5 w-5 text-accent" />,
      items: [
        {
          q: 'Quels opérateurs Mobile Money acceptez-vous ?',
          a: 'Nous acceptons Orange Money (034), MVola Telma (032, 033) et Airtel Money (031). L’opérateur est automatiquement détecté à partir de votre préfixe téléphonique.',
        },
        {
          q: 'Dois-je communiquer mon code secret PIN Mobile Money ?',
          a: (
            <div>
              <strong className="text-destructive font-bold block mb-1">
                NON, JAMAIS !
              </strong>
              <span>
                edUloc et ses conseillers ne vous demanderont <strong>JAMAIS</strong> votre code PIN Mobile Money. La saisie du code PIN se fait exclusivement dans le menu USSD qui apparaît sur votre téléphone mobile ou dans l’application officielle de l’opérateur. Si une personne se présentant comme agent edUloc vous demande votre PIN, il s’agit d’une tentative de fraude.
              </span>
            </div>
          ),
        },
        {
          q: 'Que faire si je reçois un SMS de confirmation mais que ma réservation reste en attente ?',
          a: 'Conformément à la règle MM-04, un SMS ou une capture d’écran ne suffit pas à valider automatiquement votre réservation : notre système doit recevoir la confirmation officielle de l’API de l’opérateur ou procéder à un rapprochement comptable sécurisé. Vous pouvez transmettre la référence pour examen prioritaire par nos superviseurs.',
        },
      ],
    },
    {
      title: 'Intégration et Suivi dans Odoo CRM',
      icon: <Database className="h-5 w-5 text-violet" />,
      items: [
        {
          q: 'Les conseillers du support client peuvent-ils voir mes numéros de carte ?',
          a: 'Non. Dans Odoo CRM, les agents ont accès uniquement à la référence de transaction, au montant, au moyen de paiement et aux 4 derniers chiffres masqués. Ils n’ont JAMAIS accès au CVV, au numéro complet ni au code PIN Mobile Money.',
        },
        {
          q: 'Un agent peut-il transformer manuellement un paiement échoué en succès ?',
          a: 'Non. Une restriction logicielle empêche toute modification arbitraire. Toute régularisation exceptionnelle doit suivre une procédure stricte avec justificatif écrit, visa d’un superviseur et enregistrement dans la piste d’audit infalsifiable.',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-ink">Foire Aux Questions sur les Paiements</h2>
        </div>
        <p className="text-xs text-ink-soft mt-0.5">
          Toutes les réponses relatives à la sécurité bancaire, au Mobile Money et à vos abonnements.
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((cat, catIdx) => (
          <div key={catIdx} className="rounded-3xl border border-line bg-surface p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-sm text-ink pb-2 border-b border-line">
              {cat.icon}
              <span>{cat.title}</span>
            </div>

            <div className="divide-y divide-line">
              {cat.items.map((item, itemIdx) => {
                const id = `cat-${catIdx}-item-${itemIdx}`;
                const isOpen = openItems[id];
                return (
                  <div key={itemIdx} className="py-3">
                    <button
                      onClick={() => toggle(id)}
                      className="w-full flex items-center justify-between text-left text-xs font-bold text-ink hover:text-primary transition-colors py-1"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-ink-soft transition-transform duration-200 shrink-0 ml-2 ${
                          isOpen ? 'rotate-180 text-primary' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="mt-2 text-xs text-ink-soft leading-relaxed pr-6 animate-in fade-in duration-200">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
