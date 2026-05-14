// components/HymnPicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Multi-select hymn picker for the lesson editor.
//
// Lessons store "suggested_hymns" as a comma-separated string of MHB numbers
// (e.g. "290, 480, 512"). This component:
//   • parses that string into Array<number> on the way in
//   • renders the selection as chips that show the hymn's number + title
//   • opens a search modal to add new hymns (full hymn library w/ search)
//   • emits the canonical CSV string on every change via `onChange`
//
// The wire format stays "290, 480, 512" so backend storage and the mobile
// app's existing parsing don't have to change.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Music, Plus, X, Search } from 'lucide-react';
import Modal from './Modal.jsx';

// "290, 480, 512" → [290, 480, 512]. Lenient: pulls every digit run, ignores
// the rest. Survives stray punctuation, "MHB 290", "#480", etc.
export function parseHymnCsv(s) {
  if (!s) return [];
  const matches = String(s).match(/\d+/g) || [];
  const out = [];
  for (const m of matches) {
    const n = parseInt(m, 10);
    if (Number.isFinite(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

// [290, 480, 512] → "290, 480, 512"
export function serializeHymnCsv(nums) {
  return (Array.isArray(nums) ? nums : [])
    .filter((n) => Number.isFinite(Number(n)))
    .map((n) => Number(n))
    .join(', ');
}

export default function HymnPicker({ value, onChange, req, toast }) {
  // Internal selection as an array of numbers, derived from the incoming CSV
  // each render so callers can stay on the canonical string format.
  const selected = useMemo(() => parseHymnCsv(value), [value]);

  // Hymn catalogue — lazy-loaded the first time the modal opens. Cached for
  // the lifetime of the form so repeated opens don't hit the network.
  const [catalogue, setCatalogue]   = useState(null);   // null = not loaded yet
  const [loading, setLoading]       = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ]                   = useState('');

  // Lookup map for fast number → row resolution. Keys are strings so we don't
  // care whether the row's `number` is a string or int.
  const byNumber = useMemo(() => {
    const m = new Map();
    for (const h of catalogue || []) m.set(String(h.number), h);
    return m;
  }, [catalogue]);

  const loadCatalogue = useCallback(async () => {
    if (catalogue) return;
    setLoading(true);
    try {
      const data = await req('/api/admin/hymns');
      setCatalogue(Array.isArray(data) ? data : []);
    } catch (e) {
      toast?.error?.(e?.message || 'Failed to load hymns.');
      setCatalogue([]);
    } finally {
      setLoading(false);
    }
  }, [catalogue, req, toast]);

  // Open + ensure the catalogue is loaded.
  const open = () => {
    setPickerOpen(true);
    setQ('');
    loadCatalogue();
  };

  // Preload the catalogue on first mount IF a value is already set, so the
  // chips can show titles immediately instead of just numbers.
  useEffect(() => {
    if (selected.length && !catalogue && !loading) loadCatalogue();
  }, [selected.length, catalogue, loading, loadCatalogue]);

  const toggle = (num) => {
    const set = new Set(selected);
    if (set.has(num)) set.delete(num);
    else set.add(num);
    onChange?.(serializeHymnCsv([...set]));
  };

  const remove = (num) => {
    onChange?.(serializeHymnCsv(selected.filter((n) => n !== num)));
  };

  const filtered = useMemo(() => {
    if (!catalogue) return [];
    const term = q.trim().toLowerCase();
    if (!term) return catalogue;
    return catalogue.filter((h) =>
      String(h.number).includes(term)
      || h.title?.toLowerCase().includes(term)
      || h.author?.toLowerCase().includes(term),
    );
  }, [catalogue, q]);

  return (
    <div>
      {/* Selected chips + Add button */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg ring-1 ring-zinc-200 bg-white px-2 py-1.5 min-h-[42px]">
        {selected.length === 0 && (
          <span className="px-1.5 text-[12px] text-zinc-400">
            No hymns linked — click <span className="font-semibold">Add hymn</span> to pick from the library.
          </span>
        )}
        {selected.map((num) => {
          const row = byNumber.get(String(num));
          return (
            <span
              key={num}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-100"
              title={row?.title || `MHB ${num}`}
            >
              <Music className="h-3 w-3" />
              <span className="tabular">#{num}</span>
              {row?.title && (
                <span className="hidden max-w-[170px] truncate sm:inline text-brand-800/80 font-normal">
                  · {row.title}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(num)}
                className="ml-0.5 rounded p-0.5 text-brand-700 hover:bg-brand-100"
                aria-label={`Remove hymn ${num}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={open}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200"
        >
          <Plus className="h-3 w-3" /> Add hymn
        </button>
      </div>

      {/* Picker modal */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Pick hymns from the library"
        sub="Click any hymn to toggle it on or off."
        size="lg"
        footer={
          <button type="button" onClick={() => setPickerOpen(false)} className="btn-primary">
            Done ({selected.length} selected)
          </button>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by number, title or author…"
              className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
            />
          </div>

          {loading && !catalogue ? (
            <div className="flex flex-col gap-1.5 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 w-full animate-pulse rounded-md bg-zinc-100" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              {q.trim()
                ? `No hymns match "${q.trim()}".`
                : 'No hymns in the library yet. Add them in the Hymns submenu first.'}
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-200">
              {filtered.map((h) => {
                const isOn = selected.includes(h.number);
                return (
                  <li key={h.number}>
                    <button
                      type="button"
                      onClick={() => toggle(h.number)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                        isOn ? 'bg-brand-50/60 hover:bg-brand-50' : 'hover:bg-zinc-25'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular ${
                          isOn
                            ? 'bg-brand-600 text-white'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {h.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {h.title || '(untitled)'}
                        </span>
                        {h.author && (
                          <span className="block truncate text-[11px] text-zinc-500">
                            {h.author}
                          </span>
                        )}
                      </span>
                      <span className={`shrink-0 text-[11px] font-bold ${isOn ? 'text-brand-700' : 'text-zinc-400'}`}>
                        {isOn ? '✓ Selected' : 'Add'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] text-zinc-500">
            Library has {catalogue?.length ?? '…'} hymn{(catalogue?.length ?? 0) === 1 ? '' : 's'}.
            Missing a hymn? Add it in the <span className="font-semibold">Hymns</span> submenu.
          </p>
        </div>
      </Modal>
    </div>
  );
}
