import React from 'react';

// Logos authentiques des banques et opérateurs télécoms malgaches
export const VisaLogo = ({ className = "h-5 w-auto" }: { className?: string }) => (
  <svg viewBox="0 0 48 16" fill="none" className={className} aria-label="Visa">
    <path d="M19.125 15.176h-3.176l1.986-12.228h3.176l-1.986 12.228zM31.066 3.256c-.636-.252-1.636-.525-2.884-.525-3.178 0-5.419 1.684-5.438 4.103-.021 1.782 1.597 2.776 2.815 3.37 1.252.612 1.674 1.006 1.67 1.554-.007.842-.998 1.228-1.928 1.228-1.288 0-1.977-.189-3.048-.667l-.426-.203-.456 2.818c.762.35 2.169.654 3.63.67 3.37 0 5.56-1.66 5.586-4.23.012-1.41-.84-2.482-2.684-3.36-1.118-.557-1.802-.93-1.802-1.498 0-.514.577-1.05 1.83-1.05.99-.018 1.714.215 2.274.454l.273.125.438-2.735v-.029h-.18zM41.748 3.256h-2.463c-.767 0-1.344.22-1.68.1.026l-4.78 11.82h3.338s.547-1.52.67-1.855c.365 0 3.606.01 4.066.01.096.435.39 1.845.39 1.845h2.95l-2.49-11.82v-.1zm-4.04 7.472c.264-.71 1.272-3.45 1.272-3.45-.02.036.262-.716.422-1.183l.216 1.055s.614 2.97.747 3.578h-2.657zM14.887 3.256l-3.04 8.328-.328-1.68c-.563-1.91-2.32-3.98-4.288-5.016l2.776 10.59h3.344l4.982-12.222h-3.446z" fill="#1434CB"/>
    <path d="M9.13 3.256H3.844l-.048.228c4.086 1.042 6.792 3.56 7.915 6.596l-1.144-5.8c-.198-.795-.768-.996-1.437-1.024z" fill="#F8B11B"/>
  </svg>
);

export const MastercardLogo = ({ className = "h-5 w-auto" }: { className?: string }) => (
  <svg viewBox="0 0 36 24" fill="none" className={className} aria-label="Mastercard">
    <circle cx="14" cy="12" r="10" fill="#EB001B"/>
    <circle cx="22" cy="12" r="10" fill="#F79E1B" fillOpacity="0.88"/>
  </svg>
);

// MVola (Jaune or et Vert emblématique Telma Madagascar)
export const MVolaLogo = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <div className={`flex items-center gap-1.5 font-black tracking-tight ${className}`}>
    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#008542] text-[#FFC600] font-black text-xs shadow-sm">
      M
    </span>
    <span className="font-extrabold text-sm text-[#008542]">
      M<span className="text-[#FFC600]">Vola</span>
    </span>
  </div>
);

// Orange Money (Orange chaleureux & noir)
export const OrangeMoneyLogo = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <div className={`flex items-center gap-1.5 font-bold tracking-tight ${className}`}>
    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#FF7900] text-white font-black text-xs shadow-sm">
      OM
    </span>
    <span className="font-extrabold text-sm text-ink">
      <span className="text-[#FF7900]">orange</span> money
    </span>
  </div>
);

// Airtel Money (Rouge vif & blanc)
export const AirtelMoneyLogo = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <div className={`flex items-center gap-1.5 font-bold tracking-tight ${className}`}>
    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#ED1C24] text-white font-black text-xs shadow-sm">
      a
    </span>
    <span className="font-extrabold text-sm text-[#ED1C24]">
      airtel <span className="text-ink text-xs font-semibold">money</span>
    </span>
  </div>
);
