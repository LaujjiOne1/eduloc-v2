import { useEffect, useState } from "react";

/**
 * Temps restant avant une échéance ISO (null = pas d'échéance). Simple affichage : le serveur reste seul juge
 * de l'expiration. Rafraîchi chaque seconde sous l'heure, chaque 20 s au-delà.
 */
export function useCountdown(deadlineIso: string | null) {
  const deadline = deadlineIso ? Date.parse(deadlineIso) : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, deadline - Date.now() < 3_600_000 ? 1000 : 20_000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (deadline === null) return { msLeft: null, expired: false };
  const msLeft = Math.max(0, deadline - now);
  return { msLeft, expired: msLeft === 0 };
}
