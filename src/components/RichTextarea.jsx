// components/RichTextarea.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Lesson text box with a formatting toolbar. Formatting is saved as light
// markers inside the plain text, which the mobile app renders:
//   **bold**   *italic*   __underline__   "- " at the start of a line → bullet
// Capitalisation buttons change the letters themselves, so they need no
// support in the app. Edits go through execCommand('insertText') so Ctrl+Z
// still undoes them.
//
// Usage:
//   <RichTextarea value={v} onChange={(next) => …} className="min-h-[80px]" />
//   <RichTextarea single value={v} onChange={…} />   // one-line input, case tools only
// ─────────────────────────────────────────────────────────────────────────────

import { useLayoutEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, RemoveFormatting, Eye, EyeOff } from 'lucide-react';

const FORMAT_PATTERN =
  /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*(?!\*)|__(?=\S)([\s\S]+?)(?<=\S)__(?!_)|\*(?=[^\s*])([\s\S]+?)(?<=[^\s*])\*/g;

// Same rules as the app's parser (frontend/components/BibleVerseLink.jsx).
function parseFormatting(text, marks = {}, out = []) {
  const re = new RegExp(FORMAT_PATTERN.source, 'g');
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), ...marks });
    if (m[1] != null)      parseFormatting(m[1], { ...marks, bold: true }, out);
    else if (m[2] != null) parseFormatting(m[2], { ...marks, underline: true }, out);
    else                   parseFormatting(m[3], { ...marks, italic: true }, out);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), ...marks });
  return out;
}

const stripMarks = (text) => parseFormatting(text).map((r) => r.text).join('');
const bulletize  = (text) => String(text).replace(/^[ \t]*[-*][ \t]+/gm, '•  ');

const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const CASES = [
  { id: 'upper',    label: 'AA', title: 'UPPERCASE',     fn: (s) => s.toUpperCase() },
  { id: 'lower',    label: 'aa', title: 'lowercase',     fn: (s) => s.toLowerCase() },
  { id: 'title',    label: 'Aa', title: 'Title Case',
    fn: (s) => s.replace(WORD, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) },
  { id: 'sentence', label: 'A.', title: 'Sentence case',
    fn: (s) => s.toLowerCase().replace(/(^|[.!?]\s+|\n\s*)([^\p{L}]*)(\p{L})/gu,
      (_, pre, mid, ch) => pre + mid + ch.toUpperCase()) },
];

export default function RichTextarea({ value, onChange, single = false, className = '', placeholder, ...rest }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);
  const text = value || '';

  // Grow the box with its text (up to most of the screen) so long paragraphs
  // are visible without scrolling inside the box.
  useLayoutEffect(() => {
    const el = ref.current;
    if (single || !el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, window.innerHeight * 0.7)}px`;
  }, [text, single, preview]);

  // Replace text[start,end) and then select [selStart, selEnd).
  const replace = (start, end, insert, selStart, selEnd) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    const ok = document.queryCommandSupported?.('insertText') && document.execCommand('insertText', false, insert);
    if (!ok) onChange(text.slice(0, start) + insert + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  // The selection, trimmed of surrounding spaces (markers must hug the text).
  const selection = () => {
    const el = ref.current;
    let s = el.selectionStart;
    let e = el.selectionEnd;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    return [s, e];
  };

  const toggleMark = (mark) => {
    const [s, e] = selection();
    const n = mark.length;
    const inner = text.slice(s, e);
    // Already wrapped just outside the selection → unwrap.
    if (s >= n && text.slice(s - n, s) === mark && text.slice(e, e + n) === mark
        && !(mark === '*' && text.slice(s - 2, s) === '**' && text.slice(e, e + 2) === '**' && text.slice(s - 3, s) !== '***')) {
      return replace(s - n, e + n, inner, s - n, e - n);
    }
    // Selection itself includes the markers → unwrap.
    if (inner.length > 2 * n && inner.startsWith(mark) && inner.endsWith(mark)) {
      const un = inner.slice(n, -n);
      return replace(s, e, un, s, s + un.length);
    }
    if (s === e) return replace(s, e, mark + mark, s + n, s + n);
    return replace(s, e, mark + inner + mark, s + n, e + n);
  };

  // Whole lines touched by the selection.
  const lineRange = () => {
    const el = ref.current;
    const s = text.lastIndexOf('\n', el.selectionStart - 1) + 1;
    let e = text.indexOf('\n', Math.max(el.selectionEnd - (el.selectionEnd > el.selectionStart ? 1 : 0), el.selectionStart));
    if (e < 0) e = text.length;
    return [s, e];
  };

  const toggleList = (ordered) => {
    const [s, e] = lineRange();
    const lines = text.slice(s, e).split('\n');
    const has = ordered ? (l) => /^\s*\d+[.)]\s+/.test(l) : (l) => /^\s*[-*•]\s+/.test(l);
    const strip = (l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '');
    const allOn = lines.filter((l) => l.trim()).every(has);
    let num = 0;
    const out = lines.map((l) => {
      if (!l.trim()) return l;
      if (allOn) return strip(l);
      num++;
      return (ordered ? `${num}. ` : '- ') + strip(l);
    }).join('\n');
    replace(s, e, out, s, s + out.length);
  };

  // Case and clear-formatting work on the selection, or the whole field if
  // nothing is selected.
  const transform = (fn) => {
    const el = ref.current;
    let s = el.selectionStart;
    let e = el.selectionEnd;
    if (s === e) { s = 0; e = text.length; }
    const out = fn(text.slice(s, e));
    if (out !== text.slice(s, e)) replace(s, e, out, s, s + out.length);
  };

  const onKeyDown = (ev) => {
    if (single || !(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    const mark = k === 'b' ? '**' : k === 'i' ? '*' : k === 'u' ? '__' : null;
    if (mark) { ev.preventDefault(); toggleMark(mark); }
  };

  const Btn = ({ title, onClick, children }) => (
    <button
      type="button"
      title={title}
      disabled={preview}
      // Keep focus (and the selection) in the text box.
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={onClick}
      className="flex h-6 min-w-[24px] items-center justify-center rounded px-1 text-[11px] font-bold text-zinc-600 hover:bg-zinc-200 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );

  const Field = single ? 'input' : 'textarea';

  return (
    <div className="rounded-lg ring-1 ring-zinc-200 bg-white focus-within:ring-2 focus-within:ring-brand-600/40">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-zinc-25 px-1.5 py-1">
        {!single && (
          <>
            <Btn title="Bold (Ctrl+B)" onClick={() => toggleMark('**')}><Bold className="h-3.5 w-3.5" /></Btn>
            <Btn title="Italic (Ctrl+I)" onClick={() => toggleMark('*')}><Italic className="h-3.5 w-3.5" /></Btn>
            <Btn title="Underline (Ctrl+U)" onClick={() => toggleMark('__')}><Underline className="h-3.5 w-3.5" /></Btn>
            <span className="mx-1 h-4 w-px bg-zinc-200" />
            <Btn title="Bullet list" onClick={() => toggleList(false)}><List className="h-3.5 w-3.5" /></Btn>
            <Btn title="Numbered list" onClick={() => toggleList(true)}><ListOrdered className="h-3.5 w-3.5" /></Btn>
            <span className="mx-1 h-4 w-px bg-zinc-200" />
          </>
        )}
        {CASES.map((c) => (
          <Btn key={c.id} title={`${c.title} — selected text, or the whole box if nothing is selected`} onClick={() => transform(c.fn)}>
            {c.label}
          </Btn>
        ))}
        {!single && (
          <>
            <Btn title="Clear formatting — selected text, or the whole box" onClick={() => transform(stripMarks)}>
              <RemoveFormatting className="h-3.5 w-3.5" />
            </Btn>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="ml-auto flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-200 hover:text-ink"
            >
              {preview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {preview ? 'Edit' : 'Preview'}
            </button>
          </>
        )}
      </div>
      {preview ? (
        <div className={`min-h-[60px] whitespace-pre-wrap px-3 py-2 text-sm text-ink ${className}`}>
          {text ? <Formatted text={text} /> : <span className="text-zinc-400">Nothing to preview.</span>}
        </div>
      ) : (
        <Field
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`block w-full resize-y rounded-b-lg border-0 bg-transparent px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-zinc-400 focus:outline-none focus:ring-0 ${className}`}
          {...rest}
        />
      )}
    </div>
  );
}

/** Renders saved text the way the app shows it. */
export function Formatted({ text }) {
  return parseFormatting(bulletize(text)).map((r, i) => {
    let node = r.text;
    if (r.underline) node = <u>{node}</u>;
    if (r.italic)    node = <em>{node}</em>;
    if (r.bold)      node = <strong>{node}</strong>;
    return <span key={i}>{node}</span>;
  });
}
