import React from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import type { Tone } from '../../lib/labels';

const TONES: Record<Tone, string> = {
  green: 'bg-accent-tint text-accent border-accent/30',
  amber: 'bg-warning-tint text-warning border-warning/30',
  rose: 'bg-error-tint text-error border-error/30',
  indigo: 'bg-primary-tint text-brand border-primary/30',
  blue: 'bg-violet-tint text-violet border-violet/30',
  slate: 'bg-paper-alt text-ink-soft border-line',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${TONES[tone]}`}>
    {children}
  </span>
);

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-surface rounded-2xl border border-line shadow-soft ${className}`}>{children}</div>
);

type BtnTone = 'primary' | 'danger' | 'neutral' | 'success';
const BTN: Record<BtnTone, string> = {
  primary: 'bg-primary hover:bg-primary-dark text-white border-primary/30',
  success: 'bg-accent hover:bg-accent/90 text-white border-accent/30',
  danger: 'bg-error-tint hover:bg-error text-error hover:text-white border-error/30',
  neutral: 'bg-surface hover:bg-paper-alt text-ink border-line',
};

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone; small?: boolean }> = ({
  tone = 'neutral', small = false, className = '', children, ...rest
}) => (
  <button
    type="button"
    {...rest}
    className={`inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
      small ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2 text-sm'
    } ${BTN[tone]} ${className}`}
  >
    {children}
  </button>
);

const FIELD = 'w-full text-sm bg-surface text-ink placeholder-ink-faint px-3 py-2 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-ink-soft mt-1">{hint}</span>}
  </label>
);

export const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`${FIELD} ${props.className ?? ''}`} />
);
export const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...props} className={`${FIELD} ${props.className ?? ''}`} />
);
export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`${FIELD} ${props.className ?? ''}`} />
);

export const Segmented = <T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; count?: number | null }[];
  onChange: (v: T) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
          value === o.value ? 'bg-primary-tint text-brand border border-primary/20' : 'text-ink-soft hover:text-ink hover:bg-paper-alt border border-transparent'
        }`}
      >
        {o.label}
        {o.count ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-error text-white text-[10px]">{o.count}</span> : null}
      </button>
    ))}
  </div>
);

export const Loading: React.FC<{ label?: string }> = ({ label = 'Chargement…' }) => (
  <div className="p-12 text-center text-ink-soft text-sm flex items-center justify-center gap-2">
    <Loader2 className="w-4 h-4 animate-spin" /> {label}
  </div>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-12 text-center text-ink-soft text-sm">{children}</div>
);

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="p-5 rounded-2xl bg-error-tint border border-error/30 text-error text-sm flex items-start gap-3">
    <AlertCircle className="w-5 h-5 shrink-0 text-error" />
    <div className="flex-1">
      <p>{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-2 text-xs font-semibold underline text-error">Réessayer</button>}
    </div>
  </div>
);

/** Pagination sans total : le serveur ne renvoie qu'une page de 50 ; « suivant » est possible si la page est pleine. */
export const Pager: React.FC<{ page: number; count: number; pageSize?: number; onChange: (p: number) => void }> = ({
  page, count, pageSize = 50, onChange,
}) => {
  if (page === 1 && count < pageSize) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-line text-xs text-ink-soft">
      <span>Page {page}</span>
      <div className="flex gap-1.5">
        <Btn small disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /> Précédente</Btn>
        <Btn small disabled={count < pageSize} onClick={() => onChange(page + 1)}>Suivante <ChevronRight className="w-3.5 h-3.5" /></Btn>
      </div>
    </div>
  );
};

/** Panneau latéral pour les fiches de détail. */
export const Drawer: React.FC<{ title: string; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({
  title, subtitle, onClose, children,
}) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-scrim backdrop-blur-sm" onClick={onClose}>
    <div
      className="w-full max-w-3xl h-full overflow-y-auto bg-surface border-l border-line shadow-soft"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 bg-surface/95 backdrop-blur border-b border-line">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink truncate">{title}</h2>
          {subtitle && <div className="text-xs text-ink-soft mt-1 flex flex-wrap items-center gap-2">{subtitle}</div>}
        </div>
        <button onClick={onClose} className="p-1.5 text-ink-soft hover:text-ink rounded-lg hover:bg-paper-alt" title="Fermer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </div>
  </div>
);

export const Section: React.FC<{ title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ title, aside, children }) => (
  <section>
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

export const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-line-soft last:border-0 text-sm">
    <span className="text-ink-soft shrink-0">{label}</span>
    <span className="text-ink text-right min-w-0 break-words">{children || '—'}</span>
  </div>
);

export const Table: React.FC<{ head: string[]; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-xs text-ink-soft">
      <thead className="bg-paper text-[11px] uppercase font-bold text-ink-soft border-b border-line">
        <tr>{head.map((h) => <th key={h} className="px-4 py-3.5 whitespace-nowrap">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-line-soft">{children}</tbody>
    </table>
  </div>
);
