/**
 * Dégradé de marque des bandeaux (en-tête d'accueil, calendrier) : primaire foncé → primaire de la charte (#211C5E → #332E86).
 * Le splash, l'en-tête d'accueil qui en prend la suite et le bouton « Commencer » partagent ces deux teintes.
 */
export const BRAND_GRADIENT = ["#211C5E", "#332E86"] as const;
/** Dégradé du bouton « Ouvrir » du splash : violet éclatant → primaire (sans émeraude). */
export const BRAND_VIOLET = ["#8D7FE3", "#332E86"] as const;
/** Dégradé signature « glow » de la charte (90°) : primaire → violet éclatant → émeraude. Barres de chargement, effets lumineux. */
export const BRAND_GLOW = ["#332E86", "#8D7FE3", "#0E9C82"] as const;
export const BRAND_GRADIENT_START = { x: 0, y: 0 } as const;
export const BRAND_GRADIENT_END = { x: 1, y: 1 } as const;
