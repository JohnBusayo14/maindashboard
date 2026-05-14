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
import Badge from '../components/Badge.jsx';
import EntryFormModal, { ENTRY_TYPES, fmtDate } from '../components/EntryFormModal.jsx';
import { VICTORY_BOOK_SLUG } from './victory/victoryData.js';

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
      // Victory Month has its own dedicated editor at /victory — keep this
      // generic page out of the loop so admins don't end up editing the same
      // content from two surfaces. Old bookmarks land in the right place.
      if (found.slug === VICTORY_BOOK_SLUG) {
        nav('/victory', { replace: true });
        return;
      }
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

function Skeleton({ lines = 4 }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full animate-pulse rounded bg-zinc-100" />
      ))}
    </div>
  );
}
