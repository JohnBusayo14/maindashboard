// src/pages/victory/VictoryDayEditor.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dedicated editor for a single day of the Victory Month bulletin.
//
// Sections:
//   • Header with day badge + breadcrumb + save state
//   • Two-column form: focus / date / scripture / status (left) + sidebar with
//     live preview of how the day renders in the mobile app (right)
//   • Inspirational message editor (long-form textarea with char count)
//   • Prayer points editor — repeating row builder (add / remove / reorder)
//   • Special intercession (short callout)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, ChevronLeft, ChevronRight, GripVertical, Plus, Trash2,
  CheckCircle2, BookOpen, CalendarDays, Sparkles, Copy, AlertCircle, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../auth.jsx';
import { makeReq } from '../../api.js';
import { useToast } from '../../components/Toast.jsx';
import Badge from '../../components/Badge.jsx';
import TranslationFields, { compactTranslations } from '../../components/TranslationFields.jsx';
import { loadDays, loadDay, saveDay, loadMeta } from './victoryData.js';

const BLANK = {
  day: 1, date: '', focus: '', scripture: '', message: '',
  prayer_points: [], intercession: '', published: true,
  translations: {},
};

export default function VictoryDayEditor() {
  const { dayId } = useParams();
  const nav    = useNavigate();
  const toast  = useToast();
  const { api, key } = useAuth();
  const req    = useMemo(() => makeReq(api, key), [api, key]);

  // Load the day list + the book id (needed for save) once, then resolve
  // which day to render based on the URL param.
  const [allDays, setAllDays] = useState([]);
  const [bookId,  setBookId]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm]   = useState(BLANK);
  const [dirty, setDirty] = useState(false);

  const dayNum = Math.max(1, Math.min(allDays.length || 30, Number(dayId) || 1));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [meta, list] = await Promise.all([
          loadMeta(req).catch(() => null),
          loadDays(req).catch(() => []),
        ]);
        if (cancelled) return;
        setBookId(meta?.bookId || null);
        setAllDays(list);
      } catch (e) {
        toast.error(e.message || 'Failed to load days.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [req, toast]);

  // Re-hydrate the form whenever the dayId in the URL changes (or the list
  // first loads). Use the lightweight list row if present so the form fills in
  // instantly, then refetch the full body in the background for message +
  // prayer_points + intercession.
  useEffect(() => {
    if (!allDays.length) return;
    const lite = allDays.find((d) => d.day === dayNum) || allDays[0] || BLANK;
    setForm({
      day:           lite.day,
      date:          lite.date || '',
      focus:         lite.focus || '',
      scripture:     lite.scripture || '',
      message:       lite.message || '',
      prayer_points: Array.isArray(lite.prayer_points) ? lite.prayer_points : [],
      intercession:  lite.intercession || '',
      published:     lite.published !== false,
      translations:  lite.translations && typeof lite.translations === 'object'
                       ? lite.translations
                       : {},
    });
    setDirty(false);

    loadDay(req, lite.day).then((full) => {
      // Only overwrite if the user hasn't started editing in the meantime.
      setForm((prev) => prev.day === full.day && !dirty ? {
        ...prev,
        focus:         full.focus || prev.focus,
        scripture:     full.scripture || prev.scripture,
        message:       full.message || '',
        prayer_points: Array.isArray(full.prayer_points) ? full.prayer_points : [],
        intercession:  full.intercession || '',
        translations:  full.translations && typeof full.translations === 'object'
                         ? full.translations
                         : prev.translations,
      } : prev);
    }).catch(() => { /* keep the lightweight values */ });
  }, [allDays, dayNum, req]);

  const set = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : (e?.target?.value ?? e);
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const setPoint = (idx, value) => {
    setForm((f) => {
      const next = [...f.prayer_points];
      next[idx] = value;
      return { ...f, prayer_points: next };
    });
    setDirty(true);
  };
  const addPoint    = () => { setForm((f) => ({ ...f, prayer_points: [...f.prayer_points, ''] })); setDirty(true); };
  const removePoint = (idx) => {
    setForm((f) => ({ ...f, prayer_points: f.prayer_points.filter((_, i) => i !== idx) }));
    setDirty(true);
  };
  const movePoint = (idx, dir) => {
    setForm((f) => {
      const next = [...f.prayer_points];
      const tgt  = idx + dir;
      if (tgt < 0 || tgt >= next.length) return f;
      [next[idx], next[tgt]] = [next[tgt], next[idx]];
      return { ...f, prayer_points: next };
    });
    setDirty(true);
  };

  // `andThen` lets callers chain a follow-up action (e.g. navigate to next
  // day) after a successful save without showing an "unsaved changes" prompt.
  const save = useCallback(async (andThen) => {
    if (!form.focus.trim()) { toast.error('Focus is required.'); return false; }
    if (!bookId)            { toast.error('Book not loaded yet — try again in a moment.'); return false; }
    try {
      await saveDay(req, bookId, {
        ...form,
        prayer_points: form.prayer_points.filter((p) => p.trim()),
        translations:  compactTranslations(form.translations),
      });
      setDirty(false);
      toast.success(`Day ${form.day} saved.`);
      if (typeof andThen === 'function') andThen();
      return true;
    } catch (e) {
      toast.error(e.message || 'Save failed.');
      return false;
    }
  }, [form, bookId, req, toast]);

  const goTo = useCallback((delta) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const next = Math.max(1, Math.min(allDays.length, form.day + delta));
    nav(`/victory/day/${next}`);
  }, [dirty, allDays.length, form.day, nav]);

  // "Save & next" — saves the current day then advances. Keeps content
  // editors in the flow without juggling two buttons + the dirty-prompt.
  const saveAndNext = useCallback(() => {
    if (form.day >= allDays.length) { save(); return; }
    save(() => nav(`/victory/day/${form.day + 1}`));
  }, [save, nav, form.day, allDays.length]);

  // Copy the previous day's body into this one — useful when consecutive days
  // share a focus / prayer structure and you just want to tweak rather than
  // start from scratch. Doesn't touch the day number or date.
  const duplicateFromPrev = useCallback(async () => {
    if (form.day <= 1) { toast.error('No previous day to copy from.'); return; }
    if (dirty && !window.confirm('Overwrite current edits with previous day?')) return;
    try {
      const prev = await loadDay(req, form.day - 1);
      if (!prev) return toast.error('Previous day not found.');
      setForm((f) => ({
        ...f,
        focus:         prev.focus || '',
        scripture:     prev.scripture || '',
        message:       prev.message || '',
        prayer_points: Array.isArray(prev.prayer_points) ? [...prev.prayer_points] : [],
        intercession:  prev.intercession || '',
      }));
      setDirty(true);
      toast.success(`Copied content from Day ${form.day - 1}. Don't forget to save.`);
    } catch (e) {
      toast.error(e.message || 'Copy failed.');
    }
  }, [form.day, dirty, req, toast]);

  // Keyboard shortcuts:
  //   Ctrl/⌘ + S         → save
  //   Ctrl/⌘ + Shift + → → save & next
  //   Ctrl/⌘ + Shift + ← → prev (with dirty-prompt)
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        save();
      } else if (e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        saveAndNext();
      } else if (e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, saveAndNext, goTo]);

  // Compute which required-ish fields are missing so the editor surfaces
  // gaps before the user navigates away thinking the day is complete.
  const missing = useMemo(() => {
    const out = [];
    if (!form.focus.trim())                                   out.push('Focus');
    if (!form.scripture.trim())                               out.push('Scripture');
    if (!form.date.trim())                                    out.push('Date');
    if (!form.message.trim())                                 out.push('Message');
    if (form.prayer_points.filter((p) => p.trim()).length === 0) out.push('Prayer points');
    return out;
  }, [form]);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      {/* ── HEADER + BREADCRUMB ────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/victory" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-600 hover:text-brand-700">
            <ArrowLeft className="h-3 w-3" /> Victory Month
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            Day {form.day} editor
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Edit the focus, scripture, inspirational message, prayer points and intercession
            shown to users on the mobile app for {form.date || `Day ${form.day}`}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={duplicateFromPrev} disabled={form.day === 1}
                  title="Copy focus / scripture / message / prayer points from Day N-1"
                  className="btn-ghost">
            <Copy className="h-3.5 w-3.5" /> Copy prev
          </button>
          <button onClick={() => goTo(-1)} disabled={form.day === 1} className="btn-ghost"
                  title="Previous day (Ctrl+Shift+←)">
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button onClick={() => goTo(1)} disabled={form.day === allDays.length} className="btn-ghost"
                  title="Next day">
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => save()} disabled={!dirty} className="btn-ghost"
                  title="Save (Ctrl+S)">
            <Save className="h-3.5 w-3.5" /> {dirty ? 'Save' : 'Saved'}
          </button>
          <button onClick={saveAndNext} disabled={!dirty && form.day === allDays.length}
                  className="btn-primary"
                  title="Save current day and go to the next (Ctrl+Shift+→)">
            Save & next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── KEYBOARD SHORTCUT HINT ─────────────────────────────────────────── */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-1.5 text-[11.5px] text-zinc-600 ring-1 ring-zinc-200">
        <Sparkles className="h-3 w-3 text-brand-600" />
        Shortcuts:
        <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-zinc-200">Ctrl+S</kbd> save
        <span className="text-zinc-300">·</span>
        <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-zinc-200">Ctrl+Shift+→</kbd> save &amp; next
        <span className="text-zinc-300">·</span>
        <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-zinc-200">Ctrl+Shift+←</kbd> prev
      </div>

      {/* ── MISSING-FIELDS BANNER ──────────────────────────────────────────── */}
      {missing.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-[12.5px] text-amber-900">
            <span className="font-bold">This day is incomplete.</span>{' '}
            Missing: <span className="font-semibold">{missing.join(' · ')}</span>.
            Users will see a partial entry until these are filled in.
          </div>
        </div>
      )}

      {/* ── TWO-COL LAYOUT ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ── MAIN FORM (col-span 2) ──────────────────────────────────────── */}
        <div className="space-y-5 xl:col-span-2">

          {/* Basics */}
          <section className="card p-5">
            <SectionHead title="Day basics" hint="Headline shown across the mobile app." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Focus *</label>
                <input className="input" value={form.focus} onChange={set('focus')}
                       placeholder="Personal Revival — Make Me an Agent of True Revival" />
              </div>
              <div>
                <label className="label">Scripture reference</label>
                <input className="input" value={form.scripture} onChange={set('scripture')}
                       placeholder="John 9:4-5; Romans 13:11-14" />
              </div>
              <div>
                <label className="label">Display date</label>
                <input className="input" value={form.date} onChange={set('date')}
                       placeholder="Sunday, January 4, 2026" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={form.published} onChange={set('published')} className="h-4 w-4 accent-brand-600" />
                  <span className="font-semibold">Published</span>
                  <span className="text-zinc-500"> — visible in the mobile app</span>
                </label>
              </div>
            </div>
          </section>

          {/* Message */}
          <section className="card p-5">
            <SectionHead
              title="Inspirational message"
              hint={`${form.message.length} characters · markdown is rendered as plain paragraphs on mobile.`}
            />
            <textarea
              className="input min-h-[180px] leading-relaxed"
              value={form.message}
              onChange={set('message')}
              placeholder="Write the day's inspirational message. Aim for 3–5 paragraphs, conversational, scripture-anchored…"
            />
          </section>

          {/* Prayer points */}
          <section className="card p-5">
            <SectionHead
              title="Prayer points"
              hint={`${form.prayer_points.length} ${form.prayer_points.length === 1 ? 'point' : 'points'} · numbered automatically on mobile.`}
              right={
                <button onClick={addPoint} className="btn-soft text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add point
                </button>
              }
            />
            {form.prayer_points.length === 0 ? (
              <div className="rounded-lg bg-zinc-50 py-6 text-center text-sm text-zinc-500">
                No prayer points yet. Click <span className="font-semibold">Add point</span> to start.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {form.prayer_points.map((p, i) => (
                  <PrayerRow
                    key={i}
                    index={i + 1}
                    value={p}
                    onChange={(v) => setPoint(i, v)}
                    onUp={() => movePoint(i, -1)}
                    onDown={() => movePoint(i, +1)}
                    onRemove={() => removePoint(i)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Intercession */}
          <section className="card p-5">
            <SectionHead
              title="Special intercession"
              hint="One concise sentence highlighted as the day's focal prayer."
            />
            <textarea
              className="input min-h-[100px] leading-relaxed"
              value={form.intercession}
              onChange={set('intercession')}
              placeholder="Father, let personal revival be my passion and portion…"
            />
          </section>

          {/* Translations */}
          <section className="card p-5">
            <SectionHead
              title="Translations"
              hint="Add Yorùbá / Igbo / Hausa versions of any field. Members reading in those languages will see your translation; missing fields fall back to English."
            />
            <TranslationFields
              fields={[
                { key: 'focus',         label: 'Focus',         type: 'text' },
                { key: 'scripture',     label: 'Scripture',     type: 'text' },
                { key: 'message',       label: 'Message',       type: 'textarea', rows: 6 },
                { key: 'prayer_points', label: 'Prayer points', type: 'array',    rows: 5 },
                { key: 'intercession',  label: 'Special intercession', type: 'textarea', rows: 3 },
              ]}
              english={{
                focus:         form.focus,
                scripture:     form.scripture,
                message:       form.message,
                prayer_points: form.prayer_points,
                intercession:  form.intercession,
              }}
              value={form.translations}
              onChange={(next) => { setForm((f) => ({ ...f, translations: next })); setDirty(true); }}
            />
          </section>

          {/* Sticky save bar */}
          <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl bg-white/95 px-4 py-3 ring-1 ring-zinc-200 shadow-card backdrop-blur">
            <div className="text-[12.5px] font-semibold text-zinc-600">
              {dirty
                ? <span className="text-amber-700">● Unsaved changes</span>
                : <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> All changes saved</span>}
            </div>
            <button onClick={save} disabled={!dirty} className="btn-primary">
              <Save className="h-4 w-4" /> {dirty ? 'Save day' : 'Saved'}
            </button>
          </div>
        </div>

        {/* ── LIVE PREVIEW (col-span 1) ───────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="card overflow-hidden p-0">
            <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-4 text-white">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
                DAY {form.day} OF {allDays.length}
              </div>
              <div className="mt-1 text-sm font-semibold text-white/90">{form.date || '—'}</div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600">Focus</div>
                <div className="mt-1 text-[17px] font-bold leading-tight text-ink">
                  {form.focus || <span className="text-zinc-400">— Untitled —</span>}
                </div>
              </div>
              {form.scripture && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[11.5px] font-bold text-indigo-700">
                  <BookOpen className="h-3 w-3" /> {form.scripture}
                </div>
              )}
              {form.message && (
                <div className="rounded-lg bg-zinc-50 p-3.5 text-[13px] leading-relaxed text-zinc-700 line-clamp-6">
                  {form.message}
                </div>
              )}
              {form.prayer_points.filter((p) => p.trim()).length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600">Prayer Points</div>
                  <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-zinc-700">
                    {form.prayer_points.filter((p) => p.trim()).slice(0, 4).map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-50 text-[10.5px] font-bold text-brand-700">{i + 1}</span>
                        <span className="line-clamp-2">{p}</span>
                      </li>
                    ))}
                    {form.prayer_points.filter((p) => p.trim()).length > 4 && (
                      <li className="text-[11.5px] font-semibold text-zinc-500">+ {form.prayer_points.filter((p) => p.trim()).length - 4} more</li>
                    )}
                  </ul>
                </div>
              )}
              {form.intercession && (
                <div className="rounded-lg bg-indigo-50 p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">★ Focus prayer</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-indigo-900 line-clamp-4">{form.intercession}</div>
                </div>
              )}
            </div>
            <div className="border-t border-zinc-100 bg-zinc-25 px-5 py-2.5 text-[11px] font-semibold text-zinc-500">
              Live preview · how this day will look on the GOFAMINT mobile app
            </div>
          </div>

          {/* Quick stats */}
          <div className="card p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Quick stats</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Mini accent="#1A56DB" value={form.prayer_points.filter((p) => p.trim()).length} label="Points" />
              <Mini accent="#10B981" value={form.message ? '✓' : '—'} label="Message" />
              <Mini accent="#F59E0B" value={form.published ? 'Live' : 'Draft'} label="Status" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function SectionHead({ title, hint, right }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] text-zinc-500">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

function PrayerRow({ index, value, onChange, onUp, onDown, onRemove }) {
  return (
    <div className="group flex items-start gap-2 rounded-lg ring-1 ring-zinc-200 bg-white p-2.5 transition focus-within:ring-brand-600/40">
      <div className="flex flex-col items-center gap-1 pt-1.5">
        <button onClick={onUp} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100" title="Move up">▲</button>
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-[11.5px] font-bold text-brand-700 tabular">
          {index}
        </span>
        <button onClick={onDown} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100" title="Move down">▼</button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="flex-1 resize-none bg-transparent px-1 py-1 text-sm text-ink placeholder:text-zinc-400 focus:outline-none"
        placeholder="Father, …"
      />
      <button onClick={onRemove} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Remove">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function Mini({ accent, label, value }) {
  return (
    <div className="rounded-lg bg-zinc-50 py-2">
      <div className="text-[18px] font-extrabold tabular" style={{ color: accent }}>{value}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</div>
    </div>
  );
}
