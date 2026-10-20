export function ShieldMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.5 4.5 6.8v8.4c0 7.2 4.9 12.4 11.5 14.3 6.6-1.9 11.5-7.1 11.5-14.3V6.8L16 2.5Z" fill="currentColor" />
      <path d="m10.6 16.2 3.9 3.9 7.2-7.6" fill="none" stroke="#74c3a3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ onClick, inverted = false }: { onClick?: () => void; inverted?: boolean }) {
  const content = (
    <span className={`flex items-center gap-2.5 ${inverted ? 'text-white' : 'text-navy-900'}`}>
      <ShieldMark className="h-8 w-8" />
      <span className="flex items-baseline gap-1.5">
        <span className="font-serif text-[22px] leading-none font-bold tracking-[0.14em]">ADAL</span>
        <span className={`text-[11px] font-semibold tracking-[0.12em] ${inverted ? 'text-emerald-300' : 'text-emerald-700'}`}>AI</span>
      </span>
    </span>
  );
  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} aria-label="ADAL AI" className="rounded-lg">
      {content}
    </button>
  );
}
