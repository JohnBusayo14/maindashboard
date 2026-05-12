// src/pages/victory/VictoryVigilEditor.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dedicated editor for a single Victory Month vigil guide.
//
// Layout mirrors the Day editor (header / two-column form / sticky save bar)
// but adds a "Discussion questions" section unique to the vigil guides plus a
// group/title metadata block since vigils don't follow the 1..30 sequence.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, Sparkles, BookOpen, Users, CheckCircle2,
  MessageCircle, Flame,
} from 'lucide-react';
import { useAuth } from '../../auth.jsx';
import { makeReq } from '../../api.js';
import { useToast } from '../../components/Toast.jsx';
import Badge from '../../components/Badge.jsx';
import {
  loadVigils, loadVigil, saveVigil, deleteVigil, loadMeta,
  GROUP_OPTIONS, GROUP_ACCENT,
} from './victoryData.js';

const BLANK = {
  id:            '',
  group:         'Family',
  title:         '',
  entry_number:  1,
  date:          '',
  focus:         '',
  scripture:     '',
  message:       '',
  discussion:    [],
  prayer_points: [],
  published:     true,
};

export default function VictoryVigilEditor() {
  const { vigilId } = useParams();
  const nav    = useNavigate();
  const toast  = useToast();
  const { api, key } = useAuth();
  const req    = useMemo(() => makeReq(api, key), [api, key]);
  const isNew  = !vigilId || vigilId === 'new';

  const [all,    setAll]    = useState([]);
  const [bookId, setBookId] = useState(null);
  const [form,   setForm]   = useState(BLANK);
  const [dirty,  setDirty]  = useState(false);

  // Initial load: book row (for bookId) + vigil list (so the sidebar can show
  // the other vigils too). The single-vigil full body is then fetched after
  // the list lands.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meta, list] = await Promise.all([
          loadMeta(req).catch(() => null),
          loadVigils(req).catch(() => []),
        ]);
        if (cancelled) return;
        setBookId(meta?.bookId || null);
        setAll(list);
      } catch (e) {
        toast.error(e.message || 'Failed to load vigils.');
      }
    })();
    return () => { cancelled = true; };
  }, [req, toast]);

  // Hydrate form whenever the URL or list changes. New-vigil flow uses BLANK;
  // existing vigils use the matching list row + a background full-body fetch.
  useEffect(() => {
    if (isNew) {
      setForm(BLANK);
      setDirty(false);
      return;
    }
    if (!all.length) return;
    const lite = all.find((v) => v.id === vigilId) || BLANK;
    setForm({
      ...BLANK,
      ...lite,
      discussion:    Array.isArray(lite.discussion) ? lite.discussion : [],
      prayer_points: Array.isArray(lite.prayer_points) ? lite.prayer_points : [],
    });
    setDirty(false);

    if (lite.entry_number) {
      loadVigil(req, lite).then((full) => {
        setForm((prev) => prev.id === full.id && !dirty ? {
          ...prev,
          message:       full.message || '',
          discussion:    Array.isArray(full.discussion) ? full.discussion : [],
          prayer_points: Array.isArray(full.prayer_points) ? full.prayer_points : [],
        } : prev);
      }).catch(() => { /* keep the lightweight values */ });
    }
  }, [vigilId, isNew, all, req]);

  const set = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : (e?.target?.value ?? e);
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const setListEntry = (key, idx, value) => {
    setForm((f) => {
      const next = [...f[key]];
      next[idx] = value;
      return { ...f, [key]: next };
    });
    setDirty(true);
  };
  const addEntry = (key) => () => {
    setForm((f) => ({ ...f, [key]: [...f[key], ''] }));
    setDirty(true);
  };
  const removeEntry = (key, idx) => {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
    setDirty(true);
  };
  const moveEntry = (key, idx, dir) => {
    setForm((f) => {
      const next = [...f[key]];
      const tgt  = idx + dir;
      if (tgt < 0 || tgt >= next.length) return f;
      [next[idx], next[tgt]] = [next[tgt], next[idx]];
      return { ...f, [key]: next };
    });
    setDirty(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error('Title is required.');
    if (!form.focus.trim()) return toast.error('Focus is required.');
    if (!bookId)            return toast.error('Book not loaded yet — try again in a moment.');
    // Pick an entry_number — for new Family vigils we need 1/2/3/…, other
    // groups always use 1. Reuse the existing number on update.
    let entry_number = form.entry_number;
    if (isNew) {
      if (form.group === 'Family') {
        const familyNums = all.filter((v) => v.group === 'Family').map((v) => v.entry_number);
        entry_number = (familyNums.length ? Math.max(...familyNums) : 0) + 1;
      } else {
        entry_number = 1;
      }
    }
    const payload = {
      ...form,
      entry_number,
      discussion:    form.discussion.filter((d) => d.trim()),
      prayer_points: form.prayer_points.filter((p) => p.trim()),
    };
    try {
      await saveVigil(req, bookId, payload);
      setDirty(false);
      toast.success(`${form.title} saved.`);
      if (isNew) {
        const newId = form.group === 'Family'
          ? `family-${entry_number}`
          : form.group.toLowerCase();
        nav(`/victory/vigil/${newId}`, { replace: true });
      }
    } catch (e) {
      toast.error(e.message || 'Save failed.');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    if (!bookId) return toast.error('Book not loaded yet.');
    try {
      await deleteVigil(req, bookId, form);
      toast.success('Vigil deleted.');
      nav('/victory', { replace: true });
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
    }
  };

  const accent = GROUP_ACCENT[form.group] || '#1A56DB';

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/victory" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-600 hover:text-brand-700">
            <ArrowLeft className="h-3 w-3" /> Victory Month
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            {isNew ? 'New vigil guide' : `${form.title || 'Vigil'} editor`}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Edit the focus, scripture, inspirational message, discussion questions and prayer points
            shown to {form.group?.toLowerCase()} groups when they open this vigil in the mobile app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button onClick={remove} className="btn-ghost text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button onClick={save} disabled={!dirty && !isNew} className="btn-primary">
            <Save className="h-4 w-4" /> {dirty || isNew ? 'Save vigil' : 'Saved'}
          </button>
        </div>
      </div>

      {/* ── TWO-COL LAYOUT ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* MAIN */}
        <div className="space-y-5 xl:col-span-2">

          {/* Basics */}
          <section className="card p-5">
            <SectionHead
              title="Vigil basics"
              hint="Group, title and scheduling shown on the mobile vigil list."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Audience group *</label>
                <select className="input" value={form.group} onChange={set('group')}>
                  {GROUP_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Title *</label>
                <input className="input" value={form.title} onChange={set('title')}
                       placeholder="Family Vigil 1" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Focus *</label>
                <input className="input" value={form.focus} onChange={set('focus')}
                       placeholder="Victory Over Family Challenges and Household Battles" />
              </div>
              <div>
                <label className="label">Scripture reference</label>
                <input className="input" value={form.scripture} onChange={set('scripture')}
                       placeholder="Job 5:3-16; Nehemiah 4:14" />
              </div>
              <div>
                <label className="label">Display date</label>
                <input className="input" value={form.date} onChange={set('date')}
                       placeholder="Monday, January 5, 2026" />
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
              hint={`${form.message.length} characters · what the group reads together before discussion.`}
            />
            <textarea
              className="input min-h-[160px] leading-relaxed"
              value={form.message}
              onChange={set('message')}
              placeholder="Every family — no matter how strong, loving or godly — faces challenges…"
            />
          </section>

          {/* Discussion */}
          <section className="card p-5">
            <SectionHead
              title="Discussion / reflection questions"
              hint={`${form.discussion.length} ${form.discussion.length === 1 ? 'question' : 'questions'} · numbered automatically.`}
              right={
                <button onClick={addEntry('discussion')} className="btn-soft text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add question
                </button>
              }
            />
            {form.discussion.length === 0 ? (
              <div className="rounded-lg bg-zinc-50 py-6 text-center text-sm text-zinc-500">
                No questions yet. These steer the group conversation between scripture and prayer.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {form.discussion.map((q, i) => (
                  <ListRow
                    key={i}
                    index={i + 1}
                    value={q}
                    accent="#4F46E5"
                    onChange={(v) => setListEntry('discussion', i, v)}
                    onUp={() => moveEntry('discussion', i, -1)}
                    onDown={() => moveEntry('discussion', i, +1)}
                    onRemove={() => removeEntry('discussion', i)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Prayer */}
          <section className="card p-5">
            <SectionHead
              title="Prayer points"
              hint={`${form.prayer_points.length} ${form.prayer_points.length === 1 ? 'point' : 'points'}`}
              right={
                <button onClick={addEntry('prayer_points')} className="btn-soft text-xs">
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
                  <ListRow
                    key={i}
                    index={i + 1}
                    value={p}
                    accent="#1A56DB"
                    onChange={(v) => setListEntry('prayer_points', i, v)}
                    onUp={() => moveEntry('prayer_points', i, -1)}
                    onDown={() => moveEntry('prayer_points', i, +1)}
                    onRemove={() => removeEntry('prayer_points', i)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Sticky save bar */}
          <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl bg-white/95 px-4 py-3 ring-1 ring-zinc-200 shadow-card backdrop-blur">
            <div className="text-[12.5px] font-semibold text-zinc-600">
              {dirty
                ? <span className="text-amber-700">● Unsaved changes</span>
                : <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> All changes saved</span>}
            </div>
            <button onClick={save} disabled={!dirty && !isNew} className="btn-primary">
              <Save className="h-4 w-4" /> {dirty || isNew ? 'Save vigil' : 'Saved'}
            </button>
          </div>
        </div>

        {/* SIDEBAR: live preview */}
        <aside className="space-y-4">
          <div className="card overflow-hidden p-0">
            <div
              className="p-4 text-white"
              style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}
            >
              <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] backdrop-blur">
                <Users className="h-3 w-3" /> {form.group} Vigil
              </div>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                {form.date || '—'}
              </div>
              <div className="mt-1 text-[17px] font-bold leading-tight">
                {form.focus || <span className="text-white/60">— Untitled —</span>}
              </div>
            </div>
            <div className="p-5 space-y-4">
              {form.scripture && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-[11.5px] font-bold text-zinc-700">
                  <BookOpen className="h-3 w-3" /> {form.scripture}
                </div>
              )}
              {form.message && (
                <div className="rounded-lg bg-zinc-50 p-3.5 text-[13px] leading-relaxed text-zinc-700 line-clamp-5">
                  {form.message}
                </div>
              )}
              <Stat label="Discussion" value={form.discussion.filter((d) => d.trim()).length} icon={MessageCircle} accent="#4F46E5" />
              <Stat label="Prayer points" value={form.prayer_points.filter((p) => p.trim()).length} icon={Flame} accent={accent} />
            </div>
            <div className="border-t border-zinc-100 bg-zinc-25 px-5 py-2.5 text-[11px] font-semibold text-zinc-500">
              Live preview · how this vigil renders on mobile
            </div>
          </div>

          <div className="card p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Status</div>
            <div className="mt-2 inline-flex">
              {form.published
                ? <Badge variant="green">Published</Badge>
                : <Badge variant="amber">Draft</Badge>}
            </div>
            {!isNew && (
              <div className="mt-3 text-[11px] text-zinc-500">
                ID <code className="rounded bg-zinc-100 px-1.5 py-0.5">{form.id}</code>
              </div>
            )}
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

function ListRow({ index, value, accent, onChange, onUp, onDown, onRemove }) {
  return (
    <div className="group flex items-start gap-2 rounded-lg ring-1 ring-zinc-200 bg-white p-2.5 transition focus-within:ring-brand-600/40">
      <div className="flex flex-col items-center gap-1 pt-1.5">
        <button onClick={onUp} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100" title="Move up">▲</button>
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-[11.5px] font-bold tabular"
          style={{ backgroundColor: accent + '20', color: accent }}
        >{index}</span>
        <button onClick={onDown} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100" title="Move down">▼</button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="flex-1 resize-none bg-transparent px-1 py-1 text-sm text-ink placeholder:text-zinc-400 focus:outline-none"
        placeholder="…"
      />
      <button onClick={onRemove} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Remove">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: accent + '15' }}>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</div>
        <div className="text-[18px] font-extrabold tabular text-ink">{value}</div>
      </div>
    </div>
  );
}
