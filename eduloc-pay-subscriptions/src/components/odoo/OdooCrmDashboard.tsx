import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  UserCheck,
  Send,
  Eye,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { OdooCrmRecord } from '@/types/payment';

export const OdooCrmDashboard: React.FC = () => {
  const [records, setRecords] = useState<OdooCrmRecord[]>(() => paymentService.getOdooRecords());
  const [userRole, setUserRole] = useState<'agent' | 'supervisor'>('agent');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<OdooCrmRecord | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSupervisorPin, setOverrideSupervisorPin] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const refreshData = () => {
    setRecords(paymentService.getOdooRecords());
  };

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reservationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.transactionRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.odooLeadId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Procédure de régularisation exceptionnelle (réservée au superviseur avec trace d'audit)
  const handleSupervisorOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (overrideSupervisorPin !== 'SUPERVISOR2026') {
      alert('Code superviseur invalide. Cette action est strictement réservée à l’équipe de conformité.');
      return;
    }

    selectedRecord.paymentStatus = 'SUCCEEDED';
    selectedRecord.hasAnomaly = false;
    selectedRecord.lastVerifiedAt = new Date().toISOString();

    paymentService.addAuditLog({
      eventType: 'ANOMALY_FLAGGED',
      ruleReference: 'SEC-10',
      actor: 'supervisor_odoo_crm',
      transactionId: selectedRecord.transactionRef,
      reservationId: selectedRecord.reservationId,
      details: {
        action: 'SUPERVISOR_MANUAL_REGULARIZATION',
        justification: overrideReason,
        auditorId: 'SUP_DIR_01',
        auditStamp: new Date().toISOString(),
      },
    });

    paymentService.saveOdooRecords(records);
    refreshData();
    setShowOverrideModal(false);
    setOverrideReason('');
    setOverrideSupervisorPin('');
    setFeedbackMsg(`Régularisation exceptionnelle enregistrée pour ${selectedRecord.odooLeadId}.`);
  };

  // Traitement d'un remboursement (réservé aux superviseurs)
  const handleRefund = (rec: OdooCrmRecord) => {
    if (userRole !== 'supervisor') {
      alert('Action restreinte : Seuls les superviseurs habilités peuvent initier un remboursement.');
      return;
    }

    if (confirm(`Confirmer le remboursement de ${rec.amount} Ar pour la transaction ${rec.transactionRef} ?`)) {
      rec.refundStatus = 'refunded';
      rec.refundAmount = rec.amount;
      rec.refundRef = `REFUND_${Date.now()}`;
      rec.paymentStatus = 'CANCELLED';

      paymentService.addAuditLog({
        eventType: 'PAYMENT_SETTLED',
        ruleReference: 'SEC-07',
        actor: 'supervisor_odoo_crm',
        transactionId: rec.transactionRef,
        details: {
          refundAmount: rec.amount,
          refundReference: rec.refundRef,
          status: 'REFUND_COMPLETED',
        },
      });

      paymentService.saveOdooRecords(records);
      refreshData();
      setFeedbackMsg(`Remboursement de ${rec.amount} Ar effectué avec succès.`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Role Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-ink">Intégration Odoo CRM & Suivi Client</h2>
          </div>
          <p className="text-xs text-ink-soft mt-0.5">
            Module de rapprochement des paiements EduLoc avec restrictions de conformité strictes.
          </p>
        </div>

        {/* Sélecteur de rôle (Agent vs Superviseur) */}
        <div className="flex items-center gap-2 rounded-2xl bg-paper border border-line p-1">
          <button
            onClick={() => setUserRole('agent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              userRole === 'agent'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Vue Conseiller (Agent)
          </button>
          <button
            onClick={() => setUserRole('supervisor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              userRole === 'supervisor'
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Vue Superviseur (Audit & Rbt)
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="rounded-xl border border-accent/30 bg-accent-tint p-3 text-xs text-accent font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-ink-soft hover:text-ink">
            ×
          </button>
        </div>
      )}

      {/* Bannière de respect des restrictions CRM (Section 4 du cahier des charges) */}
      <div className="rounded-2xl border border-line bg-surface p-4 grid sm:grid-cols-3 gap-4 text-xs">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <strong className="text-ink font-semibold">Zéro donnée sensible dans Odoo</strong>
            <p className="text-ink-soft text-[11px] leading-relaxed">
              Le CVV, le numéro complet de carte et les PIN Mobile Money ne sont jamais transmis ni stockés dans le CRM.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <strong className="text-ink font-semibold">Restriction de modification manuelle</strong>
            <p className="text-ink-soft text-[11px] leading-relaxed">
              Un agent ne peut pas transformer librement un échec en succès. Toute régularisation exige un visa superviseur.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <UserCheck className="h-5 w-5 text-violet shrink-0 mt-0.5" />
          <div>
            <strong className="text-ink font-semibold">Remboursements habilités</strong>
            <p className="text-ink-soft text-[11px] leading-relaxed">
              Rôle actuel : <span className="font-bold uppercase text-primary">{userRole}</span> (
              {userRole === 'supervisor' ? 'Habilitation active' : 'Consultation seule'}).
            </p>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher élève, lead, réf..."
            className="w-full rounded-xl border border-line bg-surface pl-9 pr-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-ink-soft" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="SUCCEEDED">Payés (SUCCEEDED)</option>
            <option value="PENDING">En attente (PENDING)</option>
            <option value="FAILED">Échoués (FAILED)</option>
            <option value="CANCELLED">Annulés / Remboursés</option>
          </select>

          <button
            onClick={refreshData}
            className="p-2 rounded-xl border border-line bg-surface text-ink-soft hover:text-ink transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table des Leads & Enregistrements Odoo CRM */}
      <div className="rounded-3xl border border-line bg-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-paper text-muted-foreground font-semibold">
                <th className="py-3 px-4">Lead Odoo</th>
                <th className="py-3 px-4">Client & Réservation</th>
                <th className="py-3 px-4">Moyen de paiement</th>
                <th className="py-3 px-4">Montant</th>
                <th className="py-3 px-4">Statut CRM</th>
                <th className="py-3 px-4">Dernière vérif.</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-paper/50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">
                    {r.odooLeadId}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-ink">{r.customerName}</div>
                    <div className="text-[11px] text-ink-soft">{r.tutorSubject}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-ink">{r.paymentProvider}</span>
                    <span className="block text-[11px] text-muted-foreground font-mono">
                      {r.transactionRef}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-ink">
                    {r.amount.toLocaleString()} {r.currency}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          r.paymentStatus === 'SUCCEEDED'
                            ? 'bg-accent'
                            : r.paymentStatus === 'PENDING'
                            ? 'bg-warning'
                            : 'bg-destructive'
                        }`}
                      />
                      <span className="font-semibold text-ink">{r.paymentStatus}</span>
                    </div>
                    {r.hasAnomaly && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning mt-0.5">
                        <AlertTriangle className="h-3 w-3" /> Anomalie à auditer
                      </span>
                    )}
                    {r.refundStatus === 'refunded' && (
                      <span className="block text-[10px] text-destructive font-bold">
                        Remboursé ({r.refundRef})
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-ink-soft">
                    {new Date(r.lastVerifiedAt).toLocaleDateString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1.5">
                    {/* Relance autorisée pour les agents */}
                    <button
                      onClick={() => alert(`Relance WhatsApp / Email envoyée à ${r.customerEmail}`)}
                      className="p-1.5 rounded-lg border border-line text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                      title="Envoyer une relance client"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>

                    {/* Si anomalie / échec : Procédure de régularisation exceptionnelle */}
                    {r.paymentStatus !== 'SUCCEEDED' && (
                      <button
                        onClick={() => {
                          setSelectedRecord(r);
                          setShowOverrideModal(true);
                        }}
                        className="px-2 py-1 rounded-lg bg-warning-tint text-warning font-semibold text-[11px] hover:bg-warning-tint/80"
                        title="Procédure de régularisation exceptionnelle"
                      >
                        Régulariser
                      </button>
                    )}

                    {/* Remboursement pour le superviseur */}
                    {r.paymentStatus === 'SUCCEEDED' && r.refundStatus !== 'refunded' && (
                      <button
                        onClick={() => handleRefund(r)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          userRole === 'supervisor'
                            ? 'border border-destructive/20 text-destructive hover:bg-error-tint'
                            : 'opacity-40 cursor-not-allowed text-muted-foreground'
                        }`}
                        title={userRole === 'supervisor' ? 'Rembourser' : 'Réservé au Superviseur'}
                      >
                        Rembourser
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-ink-soft">
                    Aucun enregistrement Odoo ne correspond aux critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de régularisation exceptionnelle (Règles Section 4) */}
      {showOverrideModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-4 text-xs animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-warning font-bold text-sm border-b border-line pb-3">
              <AlertOctagon className="h-5 w-5" />
              <span>Procédure de Régularisation Exceptionnelle</span>
            </div>

            <p className="text-ink-soft leading-relaxed">
              Conformément à la politique de sécurité EduLoc, un agent ne peut pas valider librement un paiement sans justificatif vérifiable et visa d'un responsable.
            </p>

            <form onSubmit={handleSupervisorOverride} className="space-y-3">
              <div>
                <label className="block font-semibold text-ink mb-1">
                  Justificatif de régularisation (obligatoire) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Ex : Rapprochement bancaire manuel n°REL-9812 validé par le DAF avec preuve du virement."
                  className="w-full rounded-xl border border-line bg-paper p-2.5 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Code d'autorisation Superviseur *
                </label>
                <input
                  type="password"
                  required
                  value={overrideSupervisorPin}
                  onChange={(e) => setOverrideSupervisorPin(e.target.value)}
                  placeholder="Tapez SUPERVISOR2026 pour le test"
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="flex-1 rounded-xl border border-line py-2 font-semibold text-ink hover:bg-paper"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-warning text-white py-2 font-bold shadow hover:bg-warning/90"
                >
                  Enregistrer l'audit & valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
