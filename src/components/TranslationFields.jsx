// components/TranslationFields.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable translation panel for any admin form that wants to expose Yoruba /
// Igbo / Hausa versions of the same fields the English form already has.
//
// Shape of the `value` prop:
//   { yo: { title: '…', prayer_points: [...] }, ig: {...}, ha: {...} }
//
// Empty / unset keys mean "no translation — fall back to English".
// The mobile app picks a language from user_profiles.lang_pref at read time
// and uses the matching block from this JSON, falling back to the English
// columns when a key is missing.
//
// Usage:
//   <TranslationFields
//     fields={[
//       { key: 'title',    label: 'Title',    type: 'text' },
//       { key: 'subtitle', label: 'Subtitle', type: 'text' },
//       { key: 'description', label: 'Description', type: 'textarea', minH: 80 },
//       { key: 'prayer_points', label: 'Prayer points', type: 'array',
//         placeholder: 'One per line…' },
//     ]}
//     value={form.translations}
//     onChange={(next) => setForm((f) => ({ ...f, translations: next }))}
//     english={form}    // for the side-by-side reference column (optional)
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Globe, Eye, EyeOff } from 'lucide-react';

export const TRANSLATION_LANGS = [
  { code: 'yo', label: 'Yoruba',  native: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig', label: 'Igbo',    native: 'Igbo',   flag: '🇳🇬' },
  { code: 'ha', label: 'Hausa',   native: 'Hausa',  flag: '🇳🇬' },
];

const linesToArray = (s) =>
  String(s || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const arrayToLines = (a) =>
  Array.isArray(a) ? a.join('\n') : (a || '');

/** A small badge that counts how many fields have a value for this language. */
function FilledCount({ block, fields }) {
  if (!block) return null;
  const filled = fields.reduce((n, f) => {
    const v = block[f.key];
    if (f.type === 'array') return n + (Array.isArray(v) && v.length ? 1 : 0);
    return n + (v && String(v).trim() ? 1 : 0);
  }, 0);
  if (!filled) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-bold text-brand-700">
      {filled}
    </span>
  );
}

export default function TranslationFields({
  fields,
  value = {},
  onChange,
  english,            // optional — pass the current English form so we can show "Source"
  langs = TRANSLATION_LANGS,
  defaultLang,
}) {
  const [activeLang, setActiveLang]   = useState(defaultLang || langs[0]?.code);
  const [showSource, setShowSource]   = useState(true);

  const block = value?.[activeLang] || {};

  const setField = (key, raw) => {
    const next = { ...(value || {}) };
    const blk  = { ...(next[activeLang] || {}) };
    if (raw === '' || raw == null) {
      delete blk[key];
    } else {
      blk[key] = raw;
    }
    if (Object.keys(blk).length === 0) {
      delete next[activeLang];
    } else {
      next[activeLang] = blk;
    }
    onChange?.(next);
  };

  const setArrayField = (key, text) => {
    const arr = linesToArray(text);
    setField(key, arr.length ? arr : '');
  };

  return (
    <div className="mt-2 rounded-xl ring-1 ring-zinc-200 bg-zinc-25/50">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-zinc-600">
          <Globe className="h-3.5 w-3.5 text-brand-600" />
          Translations
        </div>
        <div className="flex items-center gap-1">
          {langs.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setActiveLang(l.code)}
              className={`flex items-center rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activeLang === l.code
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
              }`}
              title={l.native}
            >
              <span className="mr-1">{l.flag}</span>
              {l.label}
              <FilledCount block={value?.[l.code]} fields={fields} />
            </button>
          ))}
          {english && (
            <button
              type="button"
              onClick={() => setShowSource((v) => !v)}
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100"
              title={showSource ? 'Hide English reference' : 'Show English reference'}
            >
              {showSource ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showSource ? 'Hide source' : 'Show source'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {fields.map((f) => {
          const englishVal = english?.[f.key];
          const translated = block[f.key];

          if (f.type === 'array') {
            const text = arrayToLines(translated || []);
            const englishText = arrayToLines(englishVal || []);
            return (
              <FieldRow
                key={f.key}
                label={f.label}
                showSource={showSource && english}
                source={englishText || '—'}
              >
                <textarea
                  rows={f.rows || 4}
                  className="input min-h-[80px] font-normal"
                  value={text}
                  onChange={(e) => setArrayField(f.key, e.target.value)}
                  placeholder={f.placeholder || 'One per line — leave blank to fall back to English'}
                />
              </FieldRow>
            );
          }

          if (f.type === 'textarea') {
            return (
              <FieldRow
                key={f.key}
                label={f.label}
                showSource={showSource && english}
                source={englishVal || '—'}
              >
                <textarea
                  rows={f.rows || 3}
                  className={`input ${f.minH ? `min-h-[${f.minH}px]` : 'min-h-[80px]'}`}
                  value={translated || ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder || 'Leave blank to fall back to English'}
                />
              </FieldRow>
            );
          }

          return (
            <FieldRow
              key={f.key}
              label={f.label}
              showSource={showSource && english}
              source={englishVal || '—'}
            >
              <input
                className="input"
                value={translated || ''}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.placeholder || 'Leave blank to fall back to English'}
              />
            </FieldRow>
          );
        })}
        <p className="text-[11px] text-zinc-500">
          Empty fields fall back to the English version automatically. Members reading
          in another language see the translation only when it's set.
        </p>
      </div>
    </div>
  );
}

function FieldRow({ label, source, showSource, children }) {
  return (
    <div className={`grid gap-2 ${showSource ? 'sm:grid-cols-2' : ''}`}>
      <div>
        <label className="label">{label}</label>
        {children}
      </div>
      {showSource && (
        <div>
          <label className="label flex items-center gap-1 opacity-70">
            <span>English source</span>
          </label>
          <div className="rounded-lg bg-white ring-1 ring-zinc-200 px-3 py-2.5 text-sm text-zinc-600 whitespace-pre-wrap min-h-[40px]">
            {String(source || '—')}
          </div>
        </div>
      )}
    </div>
  );
}

// Convenience: strip empty languages out of a translations object before
// sending to the server. Optional — the backend accepts whatever shape, but
// callers can use this to keep the JSONB compact.
export function compactTranslations(t) {
  const out = {};
  for (const [lang, block] of Object.entries(t || {})) {
    const blk = {};
    for (const [k, v] of Object.entries(block || {})) {
      if (Array.isArray(v)) {
        if (v.length) blk[k] = v;
      } else if (v != null && String(v).trim() !== '') {
        blk[k] = v;
      }
    }
    if (Object.keys(blk).length) out[lang] = blk;
  }
  return out;
}
