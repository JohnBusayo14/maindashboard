// pages/BookEntries.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Per-book entry CRUD. Reached from the Books page by clicking "Entries" on
// any BookReader-style book row. Lists all entries (daily + vigils) and lets
// the admin create / edit / delete them.
//
// The form maps directly to the book_entries columns:
//   entry_number, entry_type, entry_date, focus, scripture_text,
//   inspirational_message, prayer_points (one per line), special_intercession,
//   declarations (one per line), discussion_questions (one per line).
//   hymn is left as a JSON textarea for advanced editing — uncommon enough
//   that a structured editor isn't worth the surface area yet.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, RefreshCcw, Trash2, Edit3, ChevronLeft, BookOpen } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

const ENTRY_TYPES = [
  { value: 'daily',          label: 'Daily' },
  { value: 'family_vigil',   label: 'Family Vigil' },
  { value: 'youth_vigil',    label: 'Youth Vigil' },
  { value: 'women_vigil',    label: 'Women Vigil' },
  { value: 'men_vigil',      label: 'Men Vigil' },
  { value: 'general_vigil',  label: 'General Vigil' },
];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const linesToArray = (s) =>
  String(s || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const arrayToLines = (a) =>
  Array.isArray(a) ? a.join('\n') : (a || '');

export default function BookEntries() {
  const { bookId }    = useParams();
  const { api, key }  = useAuth();
  const req           = useMemo(() => makeReq(api, key), [api, key]);
  const toast         = useToast();
  const nav           = useNavigate();

  const [book, setBook]         = useState(null);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing]   = useState(null);   // full entry being edited

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch the book metadata + entries in parallel.
      const all = await req('/api/books?include=unavailable');
      const found = (all || []).find((b) => String(b.id) === String(bookId));
      if (!found) { toast.error('Book not found.'); nav('/books'); return; }
      setBook(found);
      const list = await req(`/api/books/${found.slug}/entries`);
      setEntries(list?.entries || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load entries.');
    } finally { setLoading(false); }
  }, [req, bookId, toast, nav]);

  useEffect(() => { load(); }, [load]);

  // The list endpoint returns lightweight rows (no inspirational_message etc.)
  // — when editing, fetch the full entry first.
  const openEdit = async (row) => {
    try {
      const full = await req(
        `/api/books/${book.slug}/entries/${row.entry_number}?type=${row.entry_type}`
      );
      setEditing(full);
    } catch (e) { toast.error(e.message || 'Failed to load entry.'); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete entry ${row.entry_number} (${row.entry_type})? This cannot be undone.`)) return;
    try {
      await req(`/api/admin/books/${bookId}/entries/${row.entry_number}?type=${row.entry_type}`, 'DELETE');
      toast.success('Entry deleted.');
      load();
    } catch (e) { toast.error(e.message || 'Delete failed.'); }
  };

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
            {book?.subtitle || ''} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary" disabled={!book}>
            <Plus className="h-4 w-4" /> Add entry
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">No entries yet</div>
            <button onClick={() => setCreating(true)} className="btn-primary mt-4" disabled={!book}>
              <Plus className="h-4 w-4" /> Create the first entry
            </button>
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
                {entries.map((e) => (
                  <tr key={`${e.entry_type}_${e.entry_number}`} className="hover:bg-zinc-25">
                    <td className="px-5 py-2.5 text-right tabular font-mono text-xs">
                      {String(e.entry_number).padStart(2, '0')}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge variant={e.entry_type === 'daily' ? 'blue' : 'amber'}>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <EntryFormModal
          book={book}
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
    </div>
  );
}

// ── Entry editor (used for both create and edit) ──────────────────────────────
function EntryFormModal({ book, initial, onClose, onSaved, req, toast }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    entry_number:          initial?.entry_number || '',
    entry_type:            initial?.entry_type || 'daily',
    entry_date:            initial?.entry_date ? String(initial.entry_date).slice(0, 10) : '',
    focus:                 initial?.focus || '',
    scripture_text:        initial?.scripture_text || '',
    inspirational_message: initial?.inspirational_message || '',
    prayer_points_text:    arrayToLines(initial?.prayer_points || []),
    special_intercession:  initial?.special_intercession || '',
    discussion_text:       arrayToLines(initial?.discussion_questions || []),
    declarations_text:     arrayToLines(initial?.declarations || []),
    hymn_json:             initial?.hymn ? JSON.stringify(initial.hymn, null, 2) : '',
    sort_order:            Number.isFinite(initial?.sort_order) ? initial.sort_order : 100,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target?.value ?? e }));

  const submit = async () => {
    if (!Number.isFinite(parseInt(form.entry_number, 10))) {
      return toast.error('Entry number is required.');
    }
    let hym = null;
    if (form.hymn_json.trim()) {
      try { hym = JSON.parse(form.hymn_json); }
      catch { return toast.error('Hymn JSON is invalid. Leave blank or fix the syntax.'); }
    }
    setSaving(true);
    try {
      await req(`/api/admin/books/${book.id}/entries`, 'POST', {
        entry_number:          parseInt(form.entry_number, 10),
        entry_type:            form.entry_type,
        entry_date:            form.entry_date || null,
        focus:                 form.focus || null,
        scripture_text:        form.scripture_text || null,
        inspirational_message: form.inspirational_message || null,
        prayer_points:         linesToArray(form.prayer_points_text),
        special_intercession:  form.special_intercession || null,
        discussion_questions:  linesToArray(form.discussion_text),
        declarations:          linesToArray(form.declarations_text),
        hymn:                  hym,
        sort_order:            parseInt(form.sort_order, 10) || 100,
      });
      toast.success(isEdit ? 'Entry updated.' : 'Entry created.');
      onSaved();
    } catch (e) { toast.error(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose}
      title={isEdit ? `Edit entry ${initial.entry_number} (${initial.entry_type})` : 'Add entry'}
      sub={`In ${book?.title || ''}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create entry')}
          </button>
        </>
      }>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Entry number *</label>
          <input type="number" className="input" value={form.entry_number} onChange={set('entry_number')}
                 disabled={isEdit} placeholder="1" />
          {isEdit && <p className="mt-1 text-[11px] text-zinc-500">Number + type are the unique key.</p>}
        </div>
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.entry_type} onChange={set('entry_type')} disabled={isEdit}>
            {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.entry_date} onChange={set('entry_date')} />
        </div>

        <div className="sm:col-span-3">
          <label className="label">Focus</label>
          <input className="input" value={form.focus} onChange={set('focus')}
                 placeholder="Thanksgiving for what God has done…" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Scripture</label>
          <input className="input" value={form.scripture_text} onChange={set('scripture_text')}
                 placeholder="Psalms 40:1-11, 136" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Inspirational message</label>
          <textarea className="input min-h-[120px]" value={form.inspirational_message}
                    onChange={set('inspirational_message')}
                    placeholder="Long-form prose. Paragraphs separated by blank lines." />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Prayer points (one per line)</label>
          <textarea className="input min-h-[150px]" value={form.prayer_points_text}
                    onChange={set('prayer_points_text')}
                    placeholder={'Father, we thank You for…\nLord, we ask that…\n…'} />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Special intercession</label>
          <textarea className="input min-h-[60px]" value={form.special_intercession}
                    onChange={set('special_intercession')} />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Discussion questions (one per line — vigil entries)</label>
          <textarea className="input min-h-[80px]" value={form.discussion_text}
                    onChange={set('discussion_text')} />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Declarations (one per line)</label>
          <textarea className="input min-h-[80px]" value={form.declarations_text}
                    onChange={set('declarations_text')} />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Hymn (JSON — optional, advanced)</label>
          <textarea className="input min-h-[100px] font-mono text-xs" value={form.hymn_json}
                    onChange={set('hymn_json')}
                    placeholder='{"title":"…","verses":["…"],"chorus":"…"}' />
        </div>
        <div>
          <label className="label">Sort order</label>
          <input type="number" className="input" value={form.sort_order} onChange={set('sort_order')} />
        </div>
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
