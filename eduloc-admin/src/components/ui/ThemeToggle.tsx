import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';

/** Bascule mode sombre (par défaut) / mode clair. */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className={`p-2 text-ink-soft hover:text-ink bg-surface hover:bg-paper-alt border border-line rounded-full transition-all shrink-0 ${className}`}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
