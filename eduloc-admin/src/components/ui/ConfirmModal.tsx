import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'primary' | 'success';
  /** Affiche un champ de texte (motif, note, décision…). */
  noteLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  busy?: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

/** Confirmation d'une action sensible, avec un motif obligatoire ou facultatif. Le champ est vide à chaque ouverture. */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title, description, confirmLabel = 'Confirmer', variant = 'primary', noteLabel, notePlaceholder,
  noteRequired = true, busy = false, onConfirm, onCancel,
}) => {
  const [note, setNote] = useState('');
  const isDanger = variant === 'danger';
  const isSuccess = variant === 'success';
  const blocked = busy || (noteLabel !== undefined && noteRequired && !note.trim());

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-scrim backdrop-blur-md">
      <div className="w-full max-w-lg bg-surface rounded-2xl shadow-soft border border-line text-ink">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  isDanger ? 'bg-error-tint text-error border-error/30'
                  : isSuccess ? 'bg-accent-tint text-accent border-accent/30'
                  : 'bg-primary-tint text-brand border-primary/30'
                }`}
              >
                {isSuccess ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-ink">{title}</h3>
            </div>
            <button onClick={onCancel} className="p-1.5 text-ink-soft hover:text-ink rounded-lg hover:bg-paper-alt">
              <X className="w-5 h-5" />
            </button>
          </div>

          {description && <div className="mt-3 text-sm text-ink-soft leading-relaxed">{description}</div>}

          {noteLabel !== undefined && (
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1.5">
                {noteLabel}{noteRequired ? ' (obligatoire)' : ' (facultatif)'}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={notePlaceholder}
                rows={3}
                autoFocus
                className="w-full text-sm rounded-xl border border-line bg-surface text-ink placeholder-ink-faint p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-ink-soft hover:text-ink hover:bg-paper-alt rounded-full"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => onConfirm(note.trim())}
              disabled={blocked}
              className={`px-5 py-2.5 text-sm font-semibold rounded-full border disabled:opacity-50 disabled:cursor-not-allowed ${
                isDanger ? 'bg-error hover:bg-error/90 text-white border-error/30'
                : isSuccess ? 'bg-accent hover:bg-accent/90 text-white border-accent/30'
                : 'bg-primary hover:bg-primary-dark text-white border-primary/30'
              }`}
            >
              {busy ? 'En cours…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
