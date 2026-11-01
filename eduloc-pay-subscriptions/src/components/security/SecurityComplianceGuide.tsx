import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  FileCheck2,
  ListFilter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Search,
} from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { SecurityAuditLog, ReconciliationReport } from '@/types/payment';

export const SecurityComplianceGuide: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'audit_logs' | 'reconciliation'>('rules');
  const [logs, setLogs] = useState<SecurityAuditLog[]>(() => paymentService.getAuditLogs());
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [searchLog, setSearchLog] = useState('');

  const refreshLogs = () => {
    setLogs(paymentService.getAuditLogs());
  };

  const handleRunReconciliation = () => {
    setIsReconciling(true);
    setTimeout(() => {
      const rep = paymentService.generateReconciliationReport();
      setReconciliation(rep);
      setIsReconciling(false);
      refreshLogs();
    }, 800);
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.ruleReference.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.eventType.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.actor.toLowerCase().includes(searchLog.toLowerCase()) ||
      (l.transactionId && l.transactionId.toLowerCase().includes(searchLog.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-bold text-ink">Conformité Sécurité & Audit de Contrôle</h2>
          </div>
          <p className="text-xs text-ink-soft mt-0.5">
            Cahier des charges officiel EduLoc · Normes PCI DSS Niveau 1 et GSMA Mobile Money.
          </p>
        </div>

        <div className="flex rounded-2xl bg-paper border border-line p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'rules' ? 'bg-surface text-primary shadow-sm' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Spécifications & Règles
          </button>
          <button
            onClick={() => {
              setActiveTab('audit_logs');
              refreshLogs();
            }}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'audit_logs' ? 'bg-surface text-primary shadow-sm' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Journaux d'Audit (SEC-10)
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'reconciliation' ? 'bg-surface text-primary shadow-sm' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Rapprochement (SEC-11)
          </button>
        </div>
      </div>

      {/* Tab 1: Règles & Spécifications */}
      {activeTab === 'rules' && (
        <div className="space-y-6 text-xs text-ink-soft">
          {/* Section Visa */}
          <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-primary" />
                <h3 className="text-base font-bold text-ink">1. Paiements par Carte Visa (PCI DSS)</h3>
              </div>
              <span className="text-[11px] font-bold text-primary bg-primary-tint px-2.5 py-1 rounded-lg">
                Conforme PCI DSS Level 1
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">VISA-01 : Externalisation de saisie</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Champs hébergés par le prestataire conforme PCI DSS. Aucune donnée brute de carte ne transite sur nos serveurs.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">VISA-02 : Interdiction stockage CVV</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Le CVV n'est jamais enregistré dans le backend, les logs ou Odoo, même chiffré. Seuls la marque et les 4 derniers chiffres sont conservés.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">VISA-03 : Visa Secure (3D Secure)</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Prise en charge native EMV 3DS via le prestataire. Authentification bancaire renforcée (SMS OTP ou application bancaire).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">VISA-04 : Contrôle financier distinct</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Une authentification 3DS réussie ne suffit pas. Le backend contrôle systématiquement le résultat financier final avant confirmation.
                </p>
              </div>
            </div>
          </div>

          {/* Section Mobile Money */}
          <div className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-accent" />
                <h3 className="text-base font-bold text-ink">2. Paiements Mobile Money (GSMA)</h3>
              </div>
              <span className="text-[11px] font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-lg">
                Orange Money · MVola · Airtel
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">MM-01 : Protection absolue du PIN</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  EduLoc ne demande jamais le code PIN Mobile Money. L'authentification se fait exclusivement sur le terminal mobile du client via USSD.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">MM-02 : Distinction 202 Accepted</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Un accusé de réception n'équivaut pas à un paiement réussi. États stricts : PENDING, SUCCEEDED, FAILED, CANCELLED, EXPIRED.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">MM-03 : Vérification serveur</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Le backend interroge directement l'API de statut opérateur en cas de retard de notification avant de valider la réservation.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-paper border border-line space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-ink font-semibold">MM-04 : Preuve client non suffisante</strong>
                  <span className="text-[10px] font-bold text-accent">VÉRIFIÉ</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Une capture SMS ouvre une procédure de vérification, mais n'active pas automatiquement la réservation sans validation opérateur.
                </p>
              </div>
            </div>
          </div>

          {/* Section Règles communes SEC-01 à SEC-11 */}
          <div className="rounded-3xl border border-line bg-surface p-6 space-y-3 shadow-sm">
            <h3 className="text-base font-bold text-ink border-b border-line pb-3">
              3. Matrice des exigences techniques communes (SEC-01 à SEC-11)
            </h3>
            <div className="grid sm:grid-cols-3 gap-3 pt-2 text-[11px]">
              {[
                { ref: 'SEC-01', title: 'HTTPS / TLS', desc: 'Chiffrement systématique des échanges et webhooks en production.' },
                { ref: 'SEC-02', title: 'Secrets serveur', desc: 'Clés API hébergées uniquement côté serveur (jamais dans le frontend).' },
                { ref: 'SEC-03', title: 'Calcul serveur', desc: 'Montants calculés par le backend à partir de la grille tarifaire officielle.' },
                { ref: 'SEC-04', title: 'Contrôle d’accès', desc: 'Vérification de l’autorisation avant toute action sur la réservation.' },
                { ref: 'SEC-05', title: 'Signature webhooks', desc: 'Authentification cryptographique de chaque notification entrante.' },
                { ref: 'SEC-06', title: 'Page retour non fiable', desc: 'Le succès affiché à l’écran ne constitue pas une preuve de paiement.' },
                { ref: 'SEC-07', title: 'Idempotence', desc: 'Clés d’idempotence pour prévenir les doubles débits ou validations.' },
                { ref: 'SEC-08', title: 'Protection abus', desc: 'Limitation du rythme de requêtes et surveillance des comportements anormaux.' },
                { ref: 'SEC-09', title: 'Séparation test/prod', desc: 'Jeux d’identifiants et environnements strictement isolés.' },
                { ref: 'SEC-10', title: 'Journalisation assainie', desc: 'Logs d’audit sans secrets, CVV ni codes PIN confidentiels.' },
                { ref: 'SEC-11', title: 'Rapprochement régulier', desc: 'Réconciliation quotidienne entre grand livre et relevés bancaires.' },
              ].map((item) => (
                <div key={item.ref} className="p-3 rounded-xl bg-paper border border-line">
                  <div className="flex items-center gap-1.5 font-bold text-primary mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                    <span>{item.ref} · {item.title}</span>
                  </div>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Journaux d'audit (SEC-10) */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Filtrer par règle (ex: VISA-01, SEC-03, MM-01)..."
                className="w-full rounded-xl border border-line bg-surface pl-9 pr-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={refreshLogs}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-surface text-xs font-semibold text-ink hover:bg-paper"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Actualiser les journaux</span>
            </button>
          </div>

          <div className="rounded-3xl border border-line bg-surface overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-paper text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Horodatage</th>
                    <th className="py-3 px-4">Événement & Règle</th>
                    <th className="py-3 px-4">Acteur</th>
                    <th className="py-3 px-4">Réf. Transaction</th>
                    <th className="py-3 px-4">Données Assainies (Zéro CVV / PIN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-paper/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-soft">
                        {new Date(log.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-ink block">{log.eventType}</span>
                        <span className="inline-block mt-0.5 rounded bg-primary-tint text-primary font-bold px-1.5 py-0.2 text-[10px]">
                          {log.ruleReference}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-primary">
                        {log.actor}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-ink">
                        {log.transactionId || log.reservationId || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <pre className="text-[10px] font-mono text-ink-soft bg-paper p-1.5 rounded border border-line max-w-xs overflow-x-auto">
                          {JSON.stringify(log.details)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-ink-soft">
                        Aucun journal ne correspond au filtre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Rapprochement comptable (SEC-11) */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-ink">Moteur de Rapprochement (SEC-11)</h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Contrôle automatique de conciliation entre le journal des transactions EduLoc, Stripe et les agrégateurs Mobile Money.
                </p>
              </div>

              <button
                onClick={handleRunReconciliation}
                disabled={isReconciling}
                className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-dark text-white px-5 py-2.5 text-xs font-bold shadow transition-colors disabled:opacity-60"
              >
                {isReconciling ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Audit en cours...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="h-4 w-4" />
                    <span>Lancer le rapprochement bancaire</span>
                  </>
                )}
              </button>
            </div>

            {reconciliation ? (
              <div className="space-y-4 pt-4 border-t border-line text-xs">
                <div className="grid sm:grid-cols-4 gap-3 text-center">
                  <div className="p-4 rounded-2xl bg-paper border border-line">
                    <span className="text-muted-foreground block mb-1">Total écritures EduLoc</span>
                    <span className="text-xl font-bold text-ink">
                      {reconciliation.totalInternalTransactions}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-paper border border-line">
                    <span className="text-muted-foreground block mb-1">Passerelle Stripe</span>
                    <span className="text-xl font-bold text-primary">
                      {reconciliation.totalStripeTransactions}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-paper border border-line">
                    <span className="text-muted-foreground block mb-1">Mobile Money</span>
                    <span className="text-xl font-bold text-accent">
                      {reconciliation.totalMobileMoneyTransactions}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-paper border border-line">
                    <span className="text-muted-foreground block mb-1">Écarts détectés</span>
                    <span
                      className={`text-xl font-black ${
                        reconciliation.discrepanciesCount === 0 ? 'text-accent' : 'text-destructive'
                      }`}
                    >
                      {reconciliation.discrepanciesCount}
                    </span>
                  </div>
                </div>

                {reconciliation.discrepanciesCount === 0 ? (
                  <div className="p-4 rounded-2xl bg-accent-tint/60 border border-accent/30 text-accent font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>Rapprochement parfait : 100% des transactions sont réconciliées avec les relevés bancaires et télécoms.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="font-bold text-destructive">Écarts à traiter :</span>
                    {reconciliation.discrepancies.map((disc, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-error-tint border border-destructive/20 text-destructive">
                        <strong className="block font-bold">{disc.type} sur {disc.transactionId}</strong>
                        <p className="text-[11px]">{disc.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-ink-soft bg-paper/50 rounded-2xl border border-dashed border-line">
                Cliquez sur "Lancer le rapprochement bancaire" pour effectuer un audit instantané sur l'ensemble des encaissements.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
