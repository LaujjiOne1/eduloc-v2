import React, { useState } from 'react';
import { adminApi } from '../../lib/api';
import { useAsync } from '../../lib/hooks';
import { applicationStatus, documentStatus, formatDate, fullName, highestDegree } from '../../lib/labels';
import type { ApplicationStatus } from '../../types';
import { Badge, Card, Empty, ErrorBox, Loading, Segmented, Table } from '../ui/kit';
import { ApplicationDetail } from './ApplicationDetail';

const FILTERS: { value: ApplicationStatus; label: string }[] = [
  { value: 'PENDING', label: 'À examiner' },
  { value: 'APPROVED', label: 'Approuvés' },
  { value: 'REJECTED', label: 'Refusés' },
];

export const ApplicationsView: React.FC<{ refreshKey: number; onChanged: () => void }> = ({ refreshKey, onChanged }) => {
  const [status, setStatus] = useState<ApplicationStatus>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const apps = useAsync(() => adminApi.applications(status), [status, refreshKey]);
  const levels = useAsync(() => adminApi.educationLevels(), []);

  const selected = apps.data?.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={status} options={FILTERS} onChange={(v) => { setStatus(v); setSelectedId(null); }} />
        <span className="text-xs text-ink-soft">100 dossiers les plus récents par statut</span>
      </Card>

      {apps.error && <ErrorBox message={apps.error} onRetry={apps.reload} />}

      <Card className="overflow-hidden">
        {apps.loading && !apps.data ? <Loading /> : !apps.data || apps.data.length === 0 ? (
          <Empty>Aucun dossier {FILTERS.find((f) => f.value === status)?.label.toLowerCase()}.</Empty>
        ) : (
          <Table head={['Tuteur', 'Diplôme', 'Niveau validé', 'Justificatifs', 'Dossier', 'Statut']}>
            {apps.data.map((a) => {
              const p = a.tutorProfile;
              const pending = a.documents.filter((d) => d.status === 'PENDING').length;
              const st = applicationStatus(a.status);
              return (
                <tr key={a.id} className="hover:bg-paper-alt cursor-pointer" onClick={() => setSelectedId(a.id)}>
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-ink">{p.displayName || fullName(p.user)}</p>
                    <p className="text-[11px] font-mono text-ink-soft">{p.user.email}</p>
                  </td>
                  <td className="px-4 py-3.5">{highestDegree(p.highestDegree)}{p.degreeTitle ? <span className="block text-[11px] text-ink-soft truncate max-w-[220px]">{p.degreeTitle}</span> : null}</td>
                  <td className="px-4 py-3.5">{p.academicLevel ? <Badge tone="indigo">{p.academicLevel.name}</Badge> : <span className="text-ink-faint">Non validé</span>}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="slate">{a.documents.length}</Badge>
                      {pending > 0 && <Badge tone={documentStatus('PENDING').tone}>{pending} à contrôler</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-ink-soft">{formatDate(a.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {p.suspendedAt && <Badge tone="rose">Suspendu</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {selected && (
        <ApplicationDetail
          app={selected}
          levels={levels.data ?? []}
          onChanged={() => { apps.reload(); onChanged(); }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
};
