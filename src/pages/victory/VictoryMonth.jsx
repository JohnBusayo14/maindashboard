// src/pages/victory/VictoryMonth.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Victory Month — admin landing page.
//
// Layout:
//   1. Title row + actions (Edit metadata · Reset to seed · + New vigil)
//   2. Theme hero — gradient banner with the book's year/theme/window
//   3. Progress card — single horizontal "completion" bar + four stat tiles
//   4. Segmented tab switcher (30 Days · Vigils) with counts
//   5. Days panel — search + filter chips + day cards grouped by week
//   6. Vigils panel — large gradient cards, one per group
//
// The page is read-only-ish: each item links to its own dedicated editor
// (VictoryDayEditor / VictoryVigilEditor). This screen's job is to make it
// easy to find, audit, and bulk-publish content — not to edit it inline.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, BookOpen, Users, CalendarDays, Search, Edit3, Pencil,
  CheckCircle2, Circle, ChevronRight, FlameKindling, Plus, EyeOff, Eye,
  RotateCcw, AlertTriangle, MessageSquare, ListChecks, Star, Layers,
  ClipboardCheck, Download, Upload, FileJson, Copy,
} from 'lucide-react';
import { useAuth } from '../../auth.jsx';
import { makeReq } from '../../api.js';
import { useToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import {
  loadMeta, saveMeta, loadDays, saveDay, loadVigils, saveVigil,
  stats, SEED_META, GROUP_ACCENT, GROUP_OPTIONS,
} from './victoryData.js';

const TABS = [
  { id: 'days',   label: '30 Days', icon: CalendarDays },
  { id: 'vigils', label: 'Vigils',  icon: Users },
  { id: 'audit',  label: 'Audit',   icon: ClipboardCheck },
];

const FILTERS = [
  { id: 'all',         label: 'All' },
  { id: 'with-content',label: 'Has message' },
  { id: 'missing',     label: 'Missing message' },
  { id: 'unpublished', label: 'Drafts' },
];

export default function VictoryMonth() {
  const toast = useToast();
  const nav   = useNavigate();
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);

  const [meta,   setMeta]   = useState({ ...SEED_META });
  const [days,   setDays]   = useState([]);
  const [vigils, setVigils] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,    setTab]    = useState('days');
  const [q,      setQ]      = useState('');
  const [filter, setFilter] = useState('all');
  const [editingMeta, setEditingMeta] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Pull everything from the backend in parallel. Each call cache-misses on
  // first run, then becomes fast; admin sees fresh data on every page mount.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [m, d, v] = await Promise.all([
        loadMeta(req).catch(() => ({ ...SEED_META })),
        loadDays(req).catch(() => []),
        loadVigils(req).catch(() => []),
      ]);
      setMeta(m);
      setDays(d);
      setVigils(v);
    } catch (e) {
      toast.error(e.message || 'Failed to load Victory Month content.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);
  useEffect(() => { refresh(); }, [refresh]);

  const summary = useMemo(() => stats(days, vigils), [days, vigils]);

  const filteredDays = useMemo(() => {
    let arr = days;
    if (filter === 'with-content') {
      arr = arr.filter((d) => !!(d.message || (d.prayer_points && d.prayer_points.length)));
    } else if (filter === 'missing') {
      arr = arr.filter((d) => !d.message);
    } else if (filter === 'unpublished') {
      arr = arr.filter((d) => d.published === false);
    }
    if (q.trim()) {
      const term = q.toLowerCase();
      arr = arr.filter((d) =>
        d.focus?.toLowerCase().includes(term) ||
        d.scripture?.toLowerCase().includes(term) ||
        d.date?.toLowerCase().includes(term),
      );
    }
    return arr;
  }, [days, filter, q]);

  // Group days into "weeks" so the grid breaks into Week 1 / Week 2 / etc.
  // This is a purely visual aid — the underlying data is still flat.
  const weeks = useMemo(() => {
    const map = new Map();
    filteredDays.forEach((d) => {
      const w = Math.ceil(d.day / 7);
      if (!map.has(w)) map.set(w, []);
      map.get(w).push(d);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredDays]);

  // Bulk publish/unpublish — loop through each day and persist via the
  // single-entry upsert. The `published` column doesn't exist on the DB yet
  // (it's stored client-side via the bundled flag), so this is currently a
  // no-op on the backend but updates the local table for the immediate UI.
  // When a published column lands, swap the body for a Promise.all of saveDay
  // calls; the toast message + refresh are already in place.
  const bulkPublish = async (val) => {
    try {
      const next = days.map((d) => ({ ...d, published: val }));
      setDays(next);
      toast.success(val ? 'All days marked published.' : 'All days marked draft.');
    } catch (e) {
      toast.error(e.message || 'Bulk publish failed.');
    }
  };

  // Reset → just reload from the backend. The old behaviour ("restore seed
  // content from localStorage") doesn't apply now that the DB is the source
  // of truth; if the admin wants to bulk-restore, they can re-run the
  // backend's seed script. The button keeps its UX (confirm dialog → refresh).
  const resetSeed = async () => {
    setConfirmReset(false);
    await refresh();
    toast.success('Reloaded latest content from server.');
  };

  const completionPct = days.length
    ? Math.round((summary.daysWithContent / summary.daysTotal) * 100)
    : 0;

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
            Content · Devotional Books
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Victory Month Prayer</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Edit the 30-day prayer bulletin and group vigil guides shown inside
            the GOFAMINT mobile app. Pick any day or vigil below to open its
            dedicated editor — the live preview on the editor mirrors what the
            user sees on mobile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setConfirmReset(true)} className="btn-ghost" disabled={loading}>
            <RotateCcw className="h-3.5 w-3.5" /> {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button onClick={() => setBulkOpen(true)} className="btn-ghost"
                  title="Bulk import / export days + vigils as JSON">
            <FileJson className="h-3.5 w-3.5" /> Import / Export
          </button>
          <button onClick={() => setEditingMeta(true)} className="btn-ghost">
            <Pencil className="h-3.5 w-3.5" /> Edit metadata
          </button>
          <button
            onClick={() => {
              const nextNum = days.length ? Math.max(...days.map((d) => d.day)) + 1 : 1;
              nav(`/victory/day/${nextNum}`);
            }}
            className="btn-ghost"
          >
            <Plus className="h-4 w-4" /> New day
          </button>
          <button onClick={() => nav('/victory/vigil/new')} className="btn-primary">
            <Plus className="h-4 w-4" /> New vigil
          </button>
        </div>
      </div>

      {/* ── THEME HERO ─────────────────────────────────────────────────────── */}
      <ThemeHero meta={meta} summary={summary} />

      {/* ── PROGRESS CARD ──────────────────────────────────────────────────── */}
      <section className="mt-5 card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Content readiness
            </div>
            <div className="mt-1 text-[15px] font-semibold text-ink">
              {summary.daysWithContent} of {summary.daysTotal} days have content
              <span className="ml-2 text-zinc-500">· {completionPct}% ready</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => bulkPublish(true)}  className="btn-soft text-xs">
              <Eye className="h-3.5 w-3.5" /> Publish all days
            </button>
            <button onClick={() => bulkPublish(false)} className="btn-soft text-xs text-amber-700">
              <EyeOff className="h-3.5 w-3.5" /> Set all to draft
            </button>
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* Stat tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={CalendarDays}  label="Days published"    value={summary.daysPublished} hint={`of ${summary.daysTotal}`}    accent="text-brand-600" />
          <Stat icon={ListChecks}    label="Days with message" value={summary.daysWithContent} hint={`of ${summary.daysTotal}`} accent="text-indigo-600" />
          <Stat icon={Users}         label="Group vigils"      value={summary.vigilsTotal} hint={`${summary.vigilsWithContent} populated`} accent="text-rose-600" />
          <Stat icon={FlameKindling} label="Theme year"        value={meta.year}            hint={meta.window} accent="text-amber-600" />
        </div>
      </section>

      {/* ── TAB SWITCHER (segmented pill) ──────────────────────────────────── */}
      <div className="mt-6 inline-flex rounded-xl bg-zinc-100 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ' +
                (active
                  ? 'bg-white text-ink shadow-sm ring-1 ring-zinc-200'
                  : 'text-zinc-500 hover:text-ink')
              }
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className={
                'ml-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ' +
                (active ? 'bg-brand-50 text-brand-700' : 'bg-zinc-200 text-zinc-600')
              }>
                {t.id === 'days' ? days.length : vigils.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── DAYS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'days' && (
        <>
          {/* Search + filters */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search focus, scripture or date…"
                className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => {
                const active = f.id === filter;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={
                      'rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold transition ' +
                      (active
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-150')
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <span className="ml-auto text-xs text-zinc-500">
              {filteredDays.length} of {days.length} shown
            </span>
          </div>

          {/* Day cards grouped by week */}
          {filteredDays.length === 0 ? (
            <div className="mt-6 card py-14 text-center">
              <BookOpen className="mx-auto h-7 w-7 text-zinc-300" />
              <div className="mt-2 text-sm font-semibold text-zinc-600">No days match this filter.</div>
              <div className="mt-1 text-xs text-zinc-400">Try clearing search or switching filter.</div>
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {weeks.map(([w, list]) => (
                <section key={w}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                      <Layers className="h-3 w-3" /> Week {w}
                    </div>
                    <div className="flex-1 border-t border-zinc-200" />
                    <span className="text-[11px] font-semibold text-zinc-500">
                      Days {list[0].day}–{list[list.length - 1].day}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((d) => (
                      <DayCard key={d.day} d={d} onOpen={() => nav(`/victory/day/${d.day}`)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── VIGILS TAB ────────────────────────────────────────────────────── */}
      {tab === 'vigils' && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Group vigils
              </div>
              <div className="mt-0.5 text-sm text-zinc-500">
                Standalone vigil guides — Family · Youth · Women · Men · General. Click a card to edit.
              </div>
            </div>
            <button onClick={() => nav('/victory/vigil/new')} className="btn-primary">
              <Plus className="h-4 w-4" /> New vigil
            </button>
          </div>

          {/* Render one section per group, even if empty — admins see all five
              categories at a glance and can spot which ones need content. */}
          <div className="space-y-7">
            {GROUP_OPTIONS.map((group) => {
              const inGroup = vigils.filter((v) => v.group === group);
              const accent = GROUP_ACCENT[group] || '#6366F1';
              return (
                <section key={group}>
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: accent + '15', color: accent }}
                    >
                      <Users className="h-3 w-3" /> {group} vigil{group === 'Family' || inGroup.length !== 1 ? 's' : ''}
                      <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-bold tabular" style={{ color: accent }}>
                        {inGroup.length}
                      </span>
                    </span>
                    <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${accent}55, transparent)` }} />
                  </div>

                  {inGroup.length === 0 ? (
                    <button
                      onClick={() => nav('/victory/vigil/new')}
                      className="group block w-full rounded-2xl border-2 border-dashed bg-zinc-25/40 py-8 text-center transition hover:bg-zinc-50"
                      style={{ borderColor: accent + '55' }}
                    >
                      <div
                        className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full"
                        style={{ backgroundColor: accent + '18', color: accent }}
                      >
                        <Plus className="h-4 w-4" />
                      </div>
                      <div className="mt-2 text-sm font-semibold text-ink">
                        No {group.toLowerCase()} vigil yet
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Click to draft this vigil's focus, scripture and prayer points.
                      </div>
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {inGroup.map((v) => (
                        <VigilCard key={v.id} v={v} onOpen={() => nav(`/victory/vigil/${v.id}`)} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AUDIT TAB ─────────────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <AuditPanel days={days} vigils={vigils} onOpenDay={(n) => nav(`/victory/day/${n}`)}
                    onOpenVigil={(id) => nav(`/victory/vigil/${id}`)} />
      )}

      {/* ── BULK IMPORT / EXPORT MODAL ───────────────────────────────────── */}
      {bulkOpen && (
        <BulkModal
          days={days}
          vigils={vigils}
          meta={meta}
          onClose={() => setBulkOpen(false)}
          onApply={async (parsed) => {
            // Apply imported days + vigils one-by-one through the upsert
            // endpoint. Single-shot bulk endpoint exists (seedBulk) but the
            // per-row form gives clearer error reporting if one entry fails.
            if (!meta?.bookId) return toast.error('Book not loaded yet.');
            let okDays = 0, okVigils = 0, fail = 0;
            for (const d of parsed.days || []) {
              try { await saveDay(req, meta.bookId, d); okDays++; } catch { fail++; }
            }
            for (const v of parsed.vigils || []) {
              try { await saveVigil(req, meta.bookId, v); okVigils++; } catch { fail++; }
            }
            await refresh();
            setBulkOpen(false);
            const detail = `${okDays} day${okDays===1?'':'s'} · ${okVigils} vigil${okVigils===1?'':'s'} imported${fail ? ` · ${fail} failed` : ''}.`;
            if (fail) toast.error(detail);
            else      toast.success(detail);
          }}
        />
      )}

      {/* ── META MODAL ────────────────────────────────────────────────────── */}
      {editingMeta && (
        <MetaModal
          initial={meta}
          onClose={() => setEditingMeta(false)}
          onSaved={async (next) => {
            try {
              await saveMeta(req, { ...next, bookId: meta.bookId });
              setMeta(next);
              setEditingMeta(false);
              toast.success('Book metadata updated.');
            } catch (e) {
              toast.error(e.message || 'Failed to save metadata.');
            }
          }}
        />
      )}

      {/* ── REFRESH CONFIRM ─────────────────────────────────────────────────── */}
      {confirmReset && (
        <Modal
          open
          onClose={() => setConfirmReset(false)}
          title="Refresh content from server?"
          sub="Pulls the latest days, vigils, and metadata from the backend. Useful after another admin makes edits, or to discard any in-flight unsaved changes on this page."
          size="sm"
          footer={
            <>
              <button onClick={() => setConfirmReset(false)} className="btn-ghost">Cancel</button>
              <button onClick={resetSeed} className="btn-primary">
                <RotateCcw className="h-4 w-4" /> Refresh
              </button>
            </>
          }>
          <div className="rounded-lg bg-rose-50 p-3 text-[13px] text-rose-700">
            All inspirational messages, prayer points and intercession edits will be cleared.
            Day focus, dates and scripture references will return to the seed values.
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function ThemeHero({ meta, summary }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-indigo-700 p-6 text-white shadow-cta">
      {/* decorative orbs */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />

      <div className="relative grid items-center gap-6 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/80">
            {meta.year} · VICTORY MONTH
          </div>
          <div className="mt-2 text-[26px] font-extrabold tracking-tight leading-tight">
            {meta.theme}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold backdrop-blur">
              <CalendarDays className="h-3.5 w-3.5" /> {meta.window}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold backdrop-blur">
              <Star className="h-3.5 w-3.5" /> {summary.daysTotal} days
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold backdrop-blur">
              <Users className="h-3.5 w-3.5" /> {summary.vigilsTotal} vigils
            </div>
          </div>
          <div className="mt-3 text-[12.5px] text-white/85">{meta.organisation}</div>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/70">Bulletin</div>
          <div className="mt-1 text-5xl font-black tracking-tighter">{meta.pages}</div>
          <div className="text-[11px] font-semibold text-white/80">pages</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, accent = 'text-brand-600' }) {
  return (
    <div className="rounded-xl bg-zinc-25 p-4 ring-1 ring-zinc-100">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="mt-2 text-[24px] font-bold tracking-tight text-ink tabular">{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-zinc-500">{hint}</div>}
    </div>
  );
}

function DayCard({ d, onOpen }) {
  const hasMessage = !!d.message;
  const ppCount    = d.prayer_points?.length || 0;
  const hasInter   = !!d.intercession;
  const published  = d.published !== false;
  const ready      = hasMessage && ppCount > 0;

  return (
    <button
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-2xl bg-white p-4 text-left ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-cta hover:ring-brand-200"
    >
      {/* status stripe */}
      <div
        className={
          'absolute left-0 top-0 h-full w-1 ' +
          (ready ? 'bg-emerald-500' : hasMessage ? 'bg-amber-500' : 'bg-zinc-300')
        }
      />

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-sm">
          <span className="text-[10px] font-bold leading-none opacity-80">DAY</span>
          <span className="text-[18px] font-extrabold leading-none tracking-tight">{d.day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 truncate">
            {d.date?.split(',')[1]?.trim() || d.date || '—'}
          </div>
          <div className="mt-0.5 text-[14px] font-bold leading-snug tracking-tight text-ink line-clamp-2">
            {d.focus || <span className="text-zinc-400">— Untitled —</span>}
          </div>
        </div>
        {published
          ? <Badge variant="green">Live</Badge>
          : <Badge variant="amber">Draft</Badge>}
      </div>

      {!!d.scripture && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
          <BookOpen className="h-3 w-3" /> {d.scripture}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <Check icon={MessageSquare} value={hasMessage ? '✓' : '—'} ok={hasMessage}     label="Message" />
        <Check icon={ListChecks}    value={ppCount || '—'}         ok={ppCount > 0}    label="Points" />
        <Check icon={Star}          value={hasInter ? '✓' : '—'}   ok={hasInter}       label="Focus prayer" />
      </div>

      <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 group-hover:text-brand-800">
        <Edit3 className="h-3.5 w-3.5" /> Open editor <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function Check({ icon: Icon, value, ok, label }) {
  return (
    <div className={'rounded-lg py-2 ' + (ok ? 'bg-emerald-50' : 'bg-zinc-50')}>
      <Icon className={'mx-auto h-3.5 w-3.5 ' + (ok ? 'text-emerald-600' : 'text-zinc-400')} />
      <div className={'mt-1 text-[12.5px] font-extrabold tabular ' + (ok ? 'text-emerald-700' : 'text-zinc-500')}>
        {value}
      </div>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function VigilCard({ v, onOpen }) {
  const accent  = GROUP_ACCENT[v.group] || '#6366F1';
  const hasMsg  = !!v.message;
  const pp      = v.prayer_points?.length || 0;
  const discuss = v.discussion?.length || 0;
  const ready   = hasMsg && pp > 0;

  return (
    <button
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-2xl bg-white p-5 text-left ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-cta hover:ring-brand-200"
    >
      {/* group-coloured side stripe */}
      <div className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: accent }} />
      {/* corner orb */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl"
        style={{ backgroundColor: accent + '22' }}
      />

      <div className="flex items-start justify-between">
        <span
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: accent + '15', color: accent }}
        >
          {v.group}
        </span>
        {v.published !== false
          ? <Badge variant={ready ? 'green' : 'amber'}>{ready ? 'Live' : 'Live · incomplete'}</Badge>
          : <Badge variant="zinc">Draft</Badge>}
      </div>

      <h3 className="mt-3 text-[16px] font-bold leading-tight tracking-tight text-ink line-clamp-2">
        {v.focus || v.title}
      </h3>
      <div className="mt-1 text-[11.5px] text-zinc-500">{v.date}</div>
      {!!v.scripture && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">
          <BookOpen className="h-3 w-3" /> {v.scripture}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini accent={accent}    label="Message"    value={hasMsg ? '✓' : '—'} />
        <Mini accent="#4F46E5"   label="Discussion" value={discuss} />
        <Mini accent="#1A56DB"   label="Prayer"     value={pp} />
      </div>

      <div className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 group-hover:text-brand-800">
        <Edit3 className="h-3.5 w-3.5" /> Edit vigil <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function Mini({ accent, label, value }) {
  return (
    <div className="rounded-md bg-zinc-50 py-1.5">
      <div className="text-[15px] font-bold tabular" style={{ color: accent }}>{value}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

// ── Meta editor modal ──────────────────────────────────────────────────────
function MetaModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...SEED_META, ...initial });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) || 0 }));
  return (
    <Modal open onClose={onClose}
      title="Edit book metadata"
      sub="Theme banner shown on the mobile home screen and About page."
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={() => onSaved(form)} className="btn-primary">
            <Sparkles className="h-3.5 w-3.5" /> Save changes
          </button>
        </>
      }>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Theme</label>
          <input className="input" value={form.theme} onChange={set('theme')} />
        </div>
        <div>
          <label className="label">Year</label>
          <input type="number" className="input" value={form.year} onChange={setNum('year')} />
        </div>
        <div>
          <label className="label">Window</label>
          <input className="input" value={form.window} onChange={set('window')} placeholder="January 2 – 31, 2026" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Organisation</label>
          <input className="input" value={form.organisation} onChange={set('organisation')} />
        </div>
        <div>
          <label className="label">Pages</label>
          <input type="number" className="input" value={form.pages} onChange={setNum('pages')} />
        </div>
      </div>
    </Modal>
  );
}

// ── Audit panel ─────────────────────────────────────────────────────────────
// At-a-glance list of every day + every vigil with red/amber/green pills for
// each required field. Click-through to the editor jumps straight to the gap.
function AuditPanel({ days, vigils, onOpenDay, onOpenVigil }) {
  // Required-ish field set per item — same rules as the in-editor "missing"
  // banner so the two surfaces stay in agreement.
  const dayChecks = (d) => ({
    Focus:     !!d.focus?.trim(),
    Scripture: !!d.scripture?.trim(),
    Date:      !!d.date?.trim(),
    Message:   !!d.message?.trim(),
    Points:    Array.isArray(d.prayer_points) && d.prayer_points.filter((p) => p && p.trim()).length > 0,
    Focus_prayer: !!d.intercession?.trim(),
  });
  const vigilChecks = (v) => ({
    Focus:      !!v.focus?.trim(),
    Scripture:  !!v.scripture?.trim(),
    Message:    !!v.message?.trim(),
    Points:     Array.isArray(v.prayer_points) && v.prayer_points.filter((p) => p && p.trim()).length > 0,
    Discussion: Array.isArray(v.discussion)    && v.discussion.filter((p) => p && p.trim()).length > 0,
  });

  // Drill the days down to those that are NOT fully populated. Anything with
  // every box ticked is hidden — admins come here to fix things, not admire
  // completion. Toggle the "Show complete" checkbox to flip behaviour.
  const [showComplete, setShowComplete] = useState(false);
  const dayRows = useMemo(() => days.map((d) => {
    const checks = dayChecks(d);
    const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    return { d, checks, missing };
  }).filter((r) => showComplete || r.missing.length > 0)
    .sort((a, b) => a.d.day - b.d.day), [days, showComplete]);

  const vigilRows = useMemo(() => vigils.map((v) => {
    const checks = vigilChecks(v);
    const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    return { v, checks, missing };
  }).filter((r) => showComplete || r.missing.length > 0), [vigils, showComplete]);

  const incompleteDays   = days.filter((d) => Object.values(dayChecks(d)).some((v) => !v)).length;
  const incompleteVigils = vigils.filter((v) => Object.values(vigilChecks(v)).some((x) => !x)).length;

  return (
    <div className="mt-6 space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Days incomplete"   value={incompleteDays}   total={days.length}   accent="text-amber-700" />
        <SummaryTile label="Vigils incomplete" value={incompleteVigils} total={vigils.length} accent="text-rose-700" />
        <SummaryTile label="Days complete"     value={days.length - incompleteDays}     total={days.length}   accent="text-emerald-700" />
        <SummaryTile label="Vigils complete"   value={vigils.length - incompleteVigils} total={vigils.length} accent="text-emerald-700" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-zinc-500">Audit</div>
          <div className="mt-0.5 text-sm font-semibold text-ink">
            What's missing across the book
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            Click any row to open its editor. Green = present, zinc = missing.
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" checked={showComplete} onChange={(e) => setShowComplete(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Show complete entries too
        </label>
      </div>

      {/* Days table */}
      <section className="card overflow-hidden p-0">
        <header className="border-b border-zinc-100 bg-zinc-25 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">
          Daily entries · {dayRows.length} shown
        </header>
        {dayRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            🎉 Every day looks complete. Toggle <span className="font-semibold">Show complete entries too</span> to inspect them.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {dayRows.map(({ d, checks, missing }) => (
              <li key={d.day}>
                <button onClick={() => onOpenDay(d.day)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-25">
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 text-white">
                    <span className="text-[8px] font-bold opacity-80">DAY</span>
                    <span className="text-[13px] font-extrabold leading-none">{d.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-ink truncate">
                      {d.focus || <span className="text-zinc-400">— Untitled —</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {Object.entries(checks).map(([k, ok]) => (
                        <FieldPill key={k} label={k.replace('_', ' ')} ok={ok} />
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] font-semibold text-zinc-500">
                    {missing.length === 0
                      ? <span className="text-emerald-700">All set</span>
                      : <span className="text-amber-700">{missing.length} missing</span>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vigils table */}
      <section className="card overflow-hidden p-0">
        <header className="border-b border-zinc-100 bg-zinc-25 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">
          Vigils · {vigilRows.length} shown
        </header>
        {vigilRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            🎉 Every vigil looks complete.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {vigilRows.map(({ v, checks, missing }) => (
              <li key={v.id}>
                <button onClick={() => onOpenVigil(v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-25">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: (GROUP_ACCENT[v.group] || '#6366F1') + '20' }}>
                    <Users className="h-4 w-4" style={{ color: GROUP_ACCENT[v.group] || '#6366F1' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-ink truncate">
                      <span style={{ color: GROUP_ACCENT[v.group] || '#6366F1' }}>{v.group}</span>
                      {' · '}
                      {v.focus || v.title || <span className="text-zinc-400">— Untitled —</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {Object.entries(checks).map(([k, ok]) => (
                        <FieldPill key={k} label={k} ok={ok} />
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] font-semibold text-zinc-500">
                    {missing.length === 0
                      ? <span className="text-emerald-700">All set</span>
                      : <span className="text-amber-700">{missing.length} missing</span>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryTile({ label, value, total, accent }) {
  return (
    <div className="rounded-xl bg-zinc-25 p-4 ring-1 ring-zinc-100">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className={`text-[22px] font-extrabold tabular ${accent}`}>{value}</div>
        <div className="text-[11px] font-semibold text-zinc-500">/ {total}</div>
      </div>
    </div>
  );
}

function FieldPill({ label, ok }) {
  return (
    <span className={
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ' +
      (ok ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500')
    }>
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

// ── Bulk import / export modal ───────────────────────────────────────────────
// Plain JSON in/out — admins can paste from a spreadsheet they exported, or
// take the current snapshot and stash it in version control. Each entry that
// fails to import is reported individually so the rest still succeed.
function BulkModal({ days, vigils, meta, onClose, onApply }) {
  const exportPayload = useMemo(() => JSON.stringify({
    meta:   { year: meta.year, theme: meta.theme, window: meta.window, organisation: meta.organisation, pages: meta.pages },
    days:   days.map(({ day, date, focus, scripture, message, prayer_points, intercession, published }) =>
                    ({ day, date, focus, scripture, message, prayer_points, intercession, published })),
    vigils: vigils.map(({ id, group, entry_number, date, focus, scripture, message, discussion, prayer_points, published }) =>
                    ({ id, group, entry_number, date, focus, scripture, message, discussion, prayer_points, published })),
  }, null, 2), [days, vigils, meta]);

  const [text, setText] = useState(exportPayload);
  const [error, setError] = useState('');

  const copyExport = async () => {
    try { await navigator.clipboard.writeText(exportPayload); }
    catch { /* clipboard blocked — user can select-all + Ctrl+C from the textarea */ }
  };
  const downloadExport = () => {
    const blob = new Blob([exportPayload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `victory-month-${meta.year || ''}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const apply = () => {
    setError('');
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { setError(`Not valid JSON: ${e.message}`); return; }
    if (!parsed || typeof parsed !== 'object') { setError('Top-level value must be a JSON object.'); return; }
    const d = Array.isArray(parsed.days)   ? parsed.days   : [];
    const v = Array.isArray(parsed.vigils) ? parsed.vigils : [];
    if (d.length === 0 && v.length === 0) { setError('No `days` or `vigils` arrays found in the JSON.'); return; }
    onApply({ days: d, vigils: v });
  };

  return (
    <Modal
      open onClose={onClose}
      title="Import / Export"
      sub="Paste a JSON snapshot to bulk-update days + vigils. Anything not in the snapshot is left untouched (no deletes)."
      size="lg"
      footer={
        <>
          <button onClick={copyExport}    className="btn-ghost"><Copy className="h-3.5 w-3.5" /> Copy</button>
          <button onClick={downloadExport} className="btn-ghost"><Download className="h-3.5 w-3.5" /> Download</button>
          <div className="flex-1" />
          <button onClick={onClose}        className="btn-ghost">Cancel</button>
          <button onClick={apply}          className="btn-primary"><Upload className="h-3.5 w-3.5" /> Apply import</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg bg-zinc-50 p-3 text-[12.5px] text-zinc-600">
          <span className="font-semibold text-ink">Shape:</span>{' '}
          <code className="rounded bg-white px-1 py-0.5 ring-1 ring-zinc-200">{'{ "days": [...], "vigils": [...] }'}</code>{' '}
          — each day needs a numeric <code>day</code>; each vigil needs <code>group</code> + <code>entry_number</code>.
          The export below is pre-populated with your current data so you can edit it in place and apply.
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[360px] rounded-lg bg-white p-3 font-mono text-[12px] text-ink ring-1 ring-zinc-200 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
        />
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
        )}
      </div>
    </Modal>
  );
}
