// pages/BookManage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Rich book editor. Reached from the Books page by clicking "Manage" on any
// BookReader-style book row. One screen covers:
//
//   1. Book metadata — title, theme (subtitle), introduction/description,
//      cover emoji/image, accent colour, availability toggle. Saves to
//      PUT /api/admin/books/:id.
//   2. Search bar — filters across every entry's focus / scripture /
//      message / type / entry number, so an admin can find any section
//      that needs editing in seconds.
//   3. Filter chips — All · Daily · Group vigils · Missing message · Drafts.
//   4. Section list — each row is one book entry; click Edit to open the
//      shared EntryFormModal. "Add section" creates a new entry.
//
// This page works for ANY book, not just Victory Month — the VictoryMonth
// page remains as a bespoke alternative tuned for that specific book.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft, Plus, RefreshCcw, Search, Edit3, Trash2, BookOpen,
  Save, CalendarDays, Users, AlertTriangle, Sparkles, Eye, EyeOff,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import EntryFormModal, { ENTRY_TYPES, VIGIL_TYPES, fmtDate } from '../components/EntryFormModal.jsx';
import { VICTORY_BOOK_SLUG } from './victory/victoryData.js';

const FILTERS = [
  { id: 'all',         label: 'All sections',        icon: BookOpen },
  { id: 'daily',       label: 'Daily',               icon: CalendarDays },
  { id: 'vigils',      label: 'Group vigils',        icon: Users },
  { id: 'missing-msg', label: 'Missing message',     icon: AlertTriangle },
];

const ACCENT_PRESETS = ['#1A56DB', '#7C3AED', '#059669', '#DC2626', '#F59E0B', '#0F172A'];

export default function BookManage() {
  const { bookId }   = useParams();
  const { api, key } = useAuth();
  const req          = useMemo(() => makeReq(api, key), [api, key]);
  const toast        = useToast();
  const nav          = useNavigate();

  const [book, setBook]         = useState(null);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState('');
  const [filter, setFilter]     = useState('all');

  // ── editable book metadata mirror ──────────────────────────────────────────
  // Kept separate from `book` so the inputs are controlled and the Save button
  // is only enabled while there are unsaved changes.
  const [meta, setMeta] = useState({
    title:           '',
    subtitle:        '',
    description:     '',
    cover_emoji:     '',
    cover_image_url: '',
    accent_color:    '#1A56DB',
    available:       false,
  });
  const [savingMeta, setSavingMeta] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await req('/api/books?include=unavailable');
      const found = (all || []).find((b) => String(b.id) === String(bookId));
      if (!found) { toast.error('Book not found.'); nav('/books'); return; }
      // Victory Month uses the dedicated /victory editor — keep this generic
      // page out of its flow.
      if (found.slug === VICTORY_BOOK_SLUG) { nav('/victory', { replace: true }); return; }
      setBook(found);
      setMeta({
        title:           found.title || '',
        subtitle:        found.subtitle || '',
        description:     found.description || '',
        cover_emoji:     found.cover_emoji || '',
        cover_image_url: found.cover_image_url || '',
        accent_color:    found.accent_color || '#1A56DB',
        available:       !!found.available,
      });
      const list = await req(`/api/books/${found.slug}/entries`);
      setEntries(list?.entries || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load book.');
    } finally { setLoading(false); }
  }, [req, bookId, toast, nav]);

  useEffect(() => { load(); }, [load]);

  // ── derived state ──────────────────────────────────────────────────────────
  const metaDirty = useMemo(() => {
    if (!book) return false;
    return (
      meta.title           !== (book.title || '')           ||
      meta.subtitle        !== (book.subtitle || '')        ||
      meta.description     !== (book.description || '')     ||
      meta.cover_emoji     !== (book.cover_emoji || '')     ||
      meta.cover_image_url !== (book.cover_image_url || '') ||
      meta.accent_color    !== (book.accent_color || '#1A56DB') ||
      meta.available       !== !!book.available
    );
  }, [meta, book]);

  const counts = useMemo(() => {
    const daily  = entries.filter((e) => e.entry_type === 'daily').length;
    const vigils = entries.filter((e) => VIGIL_TYPES.has(e.entry_type)).length;
    const missing = entries.filter((e) => !e.inspirational_message).length;
    return { daily, vigils, missing, total: entries.length };
  }, [entries]);

  const filtered = useMemo(() => {
    let arr = entries;
    if (filter === 'daily')        arr = arr.filter((e) => e.entry_type === 'daily');
    else if (filter === 'vigils')  arr = arr.filter((e) => VIGIL_TYPES.has(e.entry_type));
    else if (filter === 'missing-msg') arr = arr.filter((e) => !e.inspirational_message);

    if (q.trim()) {
      const term = q.trim().toLowerCase();
      arr = arr.filter((e) =>
        String(e.entry_number).includes(term) ||
        (e.entry_type     || '').toLowerCase().includes(term) ||
        (e.focus          || '').toLowerCase().includes(term) ||
        (e.scripture_text || '').toLowerCase().includes(term) ||
        (e.inspirational_message || '').toLowerCase().includes(term),
      );
    }
    return arr;
  }, [entries, filter, q]);

  // ── actions ───────────────────────────────────────────────────────────────
  const setField = (k) => (e) =>
    setMeta((m) => ({ ...m, [k]: typeof e === 'object' && e?.target ? e.target.value : e }));

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await req(`/api/admin/books/${bookId}`, 'PUT', {
        title:           meta.title || null,
        subtitle:        meta.subtitle || null,
        description:     meta.description || null,
        cover_emoji:     meta.cover_emoji || null,
        cover_image_url: meta.cover_image_url || null,
        accent_color:    meta.accent_color || null,
        available:       !!meta.available,
      });
      toast.success('Book details saved.');
      await load();
    } catch (e) {
      toast.error(e.message || 'Save failed.');
    } finally { setSavingMeta(false); }
  };

  const openEdit = async (row) => {
    try {
      const full = await req(
        `/api/books/${book.slug}/entries/${row.entry_number}?type=${row.entry_type}`,
      );
      setEditing(full);
    } catch (e) { toast.error(e.message || 'Failed to load section.'); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete section ${row.entry_number} (${row.entry_type})? This cannot be undone.`)) return;
    try {
      await req(`/api/admin/books/${bookId}/entries/${row.entry_number}?type=${row.entry_type}`, 'DELETE');
      toast.success('Section deleted.');
      await load();
    } catch (e) { toast.error(e.message || 'Delete failed.'); }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/books" className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-ink">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Books
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {book?.title || 'Loading…'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Edit the book's introduction, theme, and any of its {counts.total} section{counts.total === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setBulkOpen(true)} className="btn-ghost" disabled={!book} title="Create several daily entries at once">
            <CalendarPlus className="h-4 w-4" /> Add days
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary" disabled={!book}>
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>
      </div>

      {/* ── Metadata panel (intro / theme / description / cover) ─────────── */}
      <div className="card mb-6 overflow-hidden">
        <div
          className="border-b border-zinc-100 px-5 py-4 text-white"
          style={{ background: `linear-gradient(135deg, ${meta.accent_color || '#1A56DB'} 0%, #0f172a 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-2xl ring-1 ring-white/20 backdrop-blur"
            >
              {meta.cover_image_url
                ? <img src={meta.cover_image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                : <span>{meta.cover_emoji || '📖'}</span>}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Introduction & theme</div>
              <div className="mt-0.5 text-base font-bold tracking-tight">{meta.title || 'Untitled book'}</div>
              <div className="text-[12px] text-white/80">{meta.subtitle || 'No theme set'}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input className="input" value={meta.title} onChange={setField('title')} placeholder="Victory Month Prayer" />
          </div>
          <div>
            <label className="label">
              Theme <span className="text-[11px] font-normal text-zinc-400">(subtitle)</span>
            </label>
            <input className="input" value={meta.subtitle} onChange={setField('subtitle')}
                   placeholder="Season of True Revival &amp; Great Exploits" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">
              Introduction / description
              <span className="ml-1 text-[11px] font-normal text-zinc-400">
                — shown on the book's intro page in the app
              </span>
            </label>
            <textarea
              className="input min-h-[140px]"
              value={meta.description}
              onChange={setField('description')}
              placeholder="A short overview of what this book is, who it's for, and how to use it."
            />
          </div>

          <div>
            <label className="label">Cover emoji</label>
            <input className="input" value={meta.cover_emoji} onChange={setField('cover_emoji')} placeholder="🔥" />
            <p className="mt-1 text-[11px] text-zinc-500">Used when no cover image is set.</p>
          </div>
          <div>
            <label className="label">Cover image URL</label>
            <input className="input" value={meta.cover_image_url} onChange={setField('cover_image_url')}
                   placeholder="https://…/cover.png" />
            <p className="mt-1 text-[11px] text-zinc-500">Square image, served over HTTPS.</p>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Accent colour</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={meta.accent_color}
                onChange={setField('accent_color')}
                className="h-9 w-12 cursor-pointer rounded-md border border-zinc-200"
              />
              <input className="input flex-1" value={meta.accent_color} onChange={setField('accent_color')} />
              <div className="flex items-center gap-1">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setMeta((m) => ({ ...m, accent_color: c }))}
                    className="h-6 w-6 rounded-full ring-1 ring-zinc-200 hover:scale-110 transition"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <button
              onClick={() => setMeta((m) => ({ ...m, available: !m.available }))}
              className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ' +
                (meta.available
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-amber-50 text-amber-700 ring-amber-200')
              }
            >
              {meta.available ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {meta.available ? 'Available to users' : 'Coming soon (hidden)'}
            </button>
            <div className="flex items-center gap-2">
              {metaDirty && (
                <span className="text-[11px] font-semibold text-amber-700">Unsaved changes</span>
              )}
              <button onClick={saveMeta} disabled={!metaDirty || savingMeta} className="btn-primary">
                <Save className="h-3.5 w-3.5" /> {savingMeta ? 'Saving…' : 'Save book details'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search + filters ────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any section — focus, scripture, message, #…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <span className="text-xs text-zinc-500">{filtered.length} of {counts.total}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.id;
          const count =
            f.id === 'daily'       ? counts.daily
            : f.id === 'vigils'    ? counts.vigils
            : f.id === 'missing-msg' ? counts.missing
            : counts.total;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ' +
                (active
                  ? 'bg-brand-50 text-brand-700 ring-brand-200'
                  : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50')
              }
            >
              <Icon className="h-3 w-3" />
              {f.label}
              <span className="text-[10px] tabular text-zinc-400">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Section list ────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {counts.total === 0 ? 'No sections yet' : 'No sections match your search'}
            </div>
            {counts.total === 0 && (
              <button onClick={() => setCreating(true)} className="btn-primary mt-4" disabled={!book}>
                <Plus className="h-4 w-4" /> Add the first section
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5 text-right">#</th>
                  <th className="px-5 py-2.5">Type</th>
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-5 py-2.5">Focus</th>
                  <th className="px-5 py-2.5">Scripture</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((e) => {
                  const isVigil = VIGIL_TYPES.has(e.entry_type);
                  return (
                    <tr key={`${e.entry_type}_${e.entry_number}`} className="hover:bg-zinc-25">
                      <td className="px-5 py-2.5 text-right tabular font-mono text-xs">
                        {String(e.entry_number).padStart(2, '0')}
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge variant={isVigil ? 'amber' : 'blue'}>
                          {ENTRY_TYPES.find((t) => t.value === e.entry_type)?.label || e.entry_type}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5 text-zinc-500 tabular text-xs">{fmtDate(e.entry_date)}</td>
                      <td className="px-5 py-2.5 max-w-xl truncate text-ink">{e.focus || '—'}</td>
                      <td className="px-5 py-2.5 text-xs text-zinc-500">{e.scripture_text || '—'}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(e)} className="btn-soft text-xs">
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button onClick={() => remove(e)} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <EntryFormModal
          book={book}
          defaultType={filter === 'vigils' ? 'family_vigil' : 'daily'}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
          req={req}
          toast={toast}
        />
      )}
      {editing && (
        <EntryFormModal
          book={book}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          req={req}
          toast={toast}
        />
      )}
      {bulkOpen && (
        <BulkAddDaysModal
          book={book}
          existingDailyNumbers={entries.filter((e) => e.entry_type === 'daily').map((e) => e.entry_number)}
          onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); load(); }}
          req={req}
          toast={toast}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-add days
// Creates N empty daily placeholder entries in one call so the admin can
// scaffold a 30-day book without 30 trips through the full editor. Uses the
// existing /api/admin/books/:slug/seed endpoint which upserts atomically.
// Defaults the start number to (max existing daily number + 1).
// ─────────────────────────────────────────────────────────────────────────────
function BulkAddDaysModal({ book, existingDailyNumbers, onClose, onSaved, req, toast }) {
  const nextStart = useMemo(() => {
    if (!existingDailyNumbers?.length) return 1;
    return Math.max(...existingDailyNumbers) + 1;
  }, [existingDailyNumbers]);

  const [startNumber, setStartNumber] = useState(String(nextStart));
  const [count,       setCount]       = useState('7');
  const [startDate,   setStartDate]   = useState('');
  const [saving,      setSaving]      = useState(false);

  // Live preview of which day numbers will be created and which will clash.
  const preview = useMemo(() => {
    const s = parseInt(startNumber, 10);
    const c = parseInt(count, 10);
    if (!Number.isFinite(s) || !Number.isFinite(c) || s < 1 || c < 1) {
      return { numbers: [], clashes: [], invalid: true };
    }
    if (c > 365) return { numbers: [], clashes: [], invalid: true, tooMany: true };
    const numbers = Array.from({ length: c }, (_, i) => s + i);
    const existing = new Set(existingDailyNumbers || []);
    const clashes = numbers.filter((n) => existing.has(n));
    return { numbers, clashes, invalid: false };
  }, [startNumber, count, existingDailyNumbers]);

  const submit = async () => {
    if (preview.invalid) {
      return toast.error(preview.tooMany ? 'Max 365 days per bulk add.' : 'Start and count must be positive numbers.');
    }
    if (!book?.slug) return toast.error('Book slug unavailable.');

    // Skip any clashing day numbers — the seed endpoint upserts, so sending
    // them would overwrite existing content with empty placeholders.
    const clash = new Set(preview.clashes);
    const base = startDate ? new Date(startDate) : null;
    const entries = preview.numbers
      .filter((n) => !clash.has(n))
      .map((n) => {
        let entry_date = null;
        if (base && !Number.isNaN(base.getTime())) {
          // Index relative to the original sequence so dates still align
          // with the original first day, even when some numbers were skipped.
          const offset = n - preview.numbers[0];
          const d = new Date(base);
          d.setDate(d.getDate() + offset);
          entry_date = d.toISOString().slice(0, 10);
        }
        return {
          entry_number: n,
          entry_type:  'daily',
          entry_date,
          sort_order:  100 + n,
        };
      });

    if (!entries.length) {
      return toast.info?.('Nothing to add — all selected days already exist.')
          || toast.error('Nothing to add — all selected days already exist.');
    }

    setSaving(true);
    try {
      const r = await req(`/api/admin/books/${book.slug}/seed`, 'POST', { entries });
      const made = r?.upserted ?? entries.length;
      const skipped = preview.clashes.length;
      toast.success(
        `Added ${made} day${made === 1 ? '' : 's'}` +
        (skipped ? ` (skipped ${skipped} that already existed)` : '') +
        '. Use search to fill in their content.'
      );
      onSaved();
    } catch (e) {
      toast.error(e.message || 'Bulk add failed.');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Add multiple days"
      sub={`Scaffold empty daily entries in ${book?.title || ''}. You can fill in their focus, scripture, and message afterwards.`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving || preview.invalid}>
            {saving ? 'Adding…' : `Add ${preview.numbers.length || ''} day${preview.numbers.length === 1 ? '' : 's'}`.trim()}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Start at day #</label>
          <input
            type="number"
            min="1"
            className="input"
            value={startNumber}
            onChange={(e) => setStartNumber(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Next free number is <strong>{nextStart}</strong>.
          </p>
        </div>
        <div>
          <label className="label">How many days?</label>
          <input
            type="number"
            min="1"
            max="365"
            className="input"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-zinc-500">Up to 365 at a time.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">First date (optional)</label>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            If set, each created day will be dated one day after the previous one.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-25 p-3 text-xs">
        <div className="font-semibold text-zinc-700">Preview</div>
        {preview.invalid ? (
          <div className="mt-1 text-amber-700">
            {preview.tooMany ? 'Reduce count to 365 or fewer.' : 'Enter a valid start and count.'}
          </div>
        ) : (
          <>
            <div className="mt-1 text-zinc-600">
              Will create day{preview.numbers.length === 1 ? '' : 's'}{' '}
              <span className="tabular font-mono">
                {preview.numbers.length <= 12
                  ? preview.numbers.join(', ')
                  : `${preview.numbers.slice(0, 6).join(', ')} … ${preview.numbers.slice(-2).join(', ')}`}
              </span>
              .
            </div>
            {preview.clashes.length > 0 && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-amber-800 ring-1 ring-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Day{preview.clashes.length === 1 ? '' : 's'}{' '}
                  <strong className="font-mono">{preview.clashes.join(', ')}</strong>{' '}
                  already exist — they'll be left as-is (content preserved).
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Skeleton({ lines = 4 }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full animate-pulse rounded bg-zinc-100" />
      ))}
    </div>
  );
}
