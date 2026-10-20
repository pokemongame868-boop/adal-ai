import type { ReactNode } from 'react';

export function SectionHeader({ eyebrow, title, lead, center = false, as = 'h2' }: { eyebrow: string; title: ReactNode; lead?: string; center?: boolean; as?: 'h1' | 'h2' }) {
  const H = as;
  return (
    <div className={`max-w-2xl space-y-3 ${center ? 'mx-auto text-center' : ''}`}>
      <span className="eyebrow">
        <span className="h-px w-6 bg-emerald-600" aria-hidden="true" />
        {eyebrow}
      </span>
      <H className="h-section">{title}</H>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}
