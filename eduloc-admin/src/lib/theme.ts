import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const KEY = 'eduloc-admin-theme';

/** Durée de la transition de couleurs lors d'un changement de mode (doit rester ≥ à celle de index.css). */
const SWITCH_MS = 450;
let switchTimer: ReturnType<typeof setTimeout> | undefined;

/** Active la transition douce uniquement le temps du changement : elle ne ralentit donc pas les survols ni le reste. */
const startSwitchAnimation = () => {
  const root = document.documentElement;
  root.setAttribute('data-theme-switching', '');
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => root.removeAttribute('data-theme-switching'), SWITCH_MS);
};

/** Le mode sombre est le mode par défaut ; seul un choix explicite « light » est mémorisé. */
const read = (): Theme => {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    startSwitchAnimation();
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch { /* stockage indisponible : le choix vaut pour cette session */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}
