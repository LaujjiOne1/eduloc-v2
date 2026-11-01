import React from 'react';

/** Toque de diplômé : même tracé que GraduationCapIcon du front mobile (src/components/icons.tsx). */
export const GraduationCap: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = '#332e86' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4 2.5 9 12 14l9.5-5Z" />
    <path d="M6.5 11.4V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.6" />
  </svg>
);

/** Emblème de la charte : toque primaire dans un carré aux angles adoucis, toujours sur le fond clair #ECEAF9 (comme sur fond sombre). */
export const LogoMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <div
    className="flex items-center justify-center shrink-0"
    style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#eceaf9' }}
  >
    <GraduationCap size={size * 0.62} />
  </div>
);

/** Emblème + mot-symbole bicolore (« edU » encre, « loc » primaire) ; `suffix` ajoute une étiquette, par ex. « Admin ». */
export const Logo: React.FC<{ size?: number; suffix?: string; className?: string }> = ({ size = 40, suffix, className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <LogoMark size={size} />
    <div className="flex items-baseline gap-1.5">
      <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.55 }}>
        <span className="text-ink">edU</span><span className="text-brand">loc</span>
      </span>
      {suffix && <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">{suffix}</span>}
    </div>
  </div>
);
