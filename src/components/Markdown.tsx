import { Fragment, type ReactNode } from 'react';

/**
 * Safe, minimal Markdown renderer. Produces React elements only — never injects HTML.
 * Supports: headings, bold, italic, inline code, numbered & bulleted lists,
 * paragraphs, and http(s) links (bare or [text](url)).
 */
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)<>"']+|`[^`]+`|(?<![\p{L}\p{N}*])\*[^*\n]+\*(?![\p{L}\p{N}])|(?<![\p{L}\p{N}_])_[^_\n]+_(?![\p{L}\p{N}]))/gu;

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function link(href: string, label: string, key: number) {
  const safe = safeHref(href);
  if (!safe) return <Fragment key={key}>{label}</Fragment>;
  return (
    <a key={key} href={safe} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 break-words hover:decoration-emerald-700">
      {label}
    </a>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (tok.startsWith('**')) out.push(<strong key={k++} className="font-semibold text-navy-900">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      out.push(mm ? link(mm[2], mm[1], k++) : tok);
    } else if (tok.startsWith('http')) {
      const trimmed = tok.replace(/[.,;:!?]+$/, '');
      out.push(link(trimmed, trimmed.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), k++));
      if (trimmed.length < tok.length) out.push(tok.slice(trimmed.length));
    } else if (tok.startsWith('`')) out.push(<code key={k++} className="rounded bg-navy-50 px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = i + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: 'h'; text: string }
  | { type: 'p'; lines: string[] }
  | { type: 'ol'; items: string[]; start: number }
  | { type: 'ul'; items: string[] };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', lines: para });
    para = [];
  };
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const prev = blocks[blocks.length - 1];
    if (h) {
      flush();
      blocks.push({ type: 'h', text: h[1].replace(/\*\*/g, '') });
    } else if (ol) {
      flush();
      if (prev?.type === 'ol') prev.items.push(ol[2]);
      else blocks.push({ type: 'ol', items: [ol[2]], start: Number(ol[1]) || 1 });
    } else if (ul) {
      flush();
      if (prev?.type === 'ul') prev.items.push(ul[1]);
      else blocks.push({ type: 'ul', items: [ul[1]] });
    } else if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-navy-800">
      {parse(text).map((b, i) => {
        if (b.type === 'h')
          return (
            <h4 key={i} className="pt-1 font-serif text-[17px] font-semibold text-navy-900">
              {inline(b.text)}
            </h4>
          );
        if (b.type === 'p')
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          );
        if (b.type === 'ol')
          return (
            <ol key={i} start={b.start} className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-emerald-700">
              {b.items.map((it, j) => (
                <li key={j} className="pl-1">{inline(it)}</li>
              ))}
            </ol>
          );
        return (
          <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-emerald-600">
            {b.items.map((it, j) => (
              <li key={j} className="pl-1">{inline(it)}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
