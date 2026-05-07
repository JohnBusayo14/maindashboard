import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCcw, Music2, Search } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

export default function Hymns() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [editing, setEditing] = useState(null);   // null | {} (new) | { number, title, ... } (edit)

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/admin/hymns');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load hymns.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        String(r.number).includes(term) ||
        r.title?.toLowerCase().includes(term) ||
        r.author?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const onDelete = async (num) => {
    if (!confirm(`Delete MHB #${num}? This cannot be undone.`)) return;
    try {
      await req(`/api/admin/hymns/${num}`, 'DELETE');
      toast.success(`MHB #${num} deleted.`);
      load();
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
    }
  };

  const openEdit = async (num) => {
    try {
      const full = await req(`/api/hymns/${num}`);
      setEditing(full);
    } catch (e) {
      toast.error(e.message || 'Could not load hymn.');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      {/* Heading */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Content</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Hymns</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Methodist Hymn Book entries. Each lesson can reference numbers from this list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setEditing({})} className="btn-primary">
            <Plus className="h-4 w-4" /> New hymn
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search number, title, author…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <span className="text-xs text-zinc-500">{filtered.length} of {rows.length}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Music2 className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {rows.length === 0 ? 'No hymns yet' : 'No hymns match your search'}
            </div>
            {rows.length === 0 && (
              <button onClick={() => setEditing({})} className="btn-primary mt-4">
                <Plus className="h-4 w-4" /> Add the first hymn
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5 w-20">#</th>
                  <th className="px-5 py-2.5">Title</th>
                  <th className="px-5 py-2.5">Author</th>
                  <th className="px-5 py-2.5 text-center">Verses</th>
                  <th className="px-5 py-2.5 text-center">Chorus</th>
                  <th className="px-5 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((h) => (
                  <tr key={h.id || h.number} className="hover:bg-zinc-25">
                    <td className="px-5 py-2.5 font-bold text-ink">{h.number}</td>
                    <td className="px-5 py-2.5 font-semibold text-ink">{h.title}</td>
                    <td className="px-5 py-2.5 text-zinc-500">{h.author || '—'}</td>
                    <td className="px-5 py-2.5 text-center text-zinc-700">{h.verse_count ?? '—'}</td>
                    <td className="px-5 py-2.5 text-center">
                      {h.has_chorus ? <Badge variant="green">Yes</Badge> : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(h.number)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(h.number)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {editing && (
        <HymnModal
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

function HymnModal({ initial, onClose, onSaved, req, toast }) {
  const isEdit = !!initial.number;
  const [number, setNumber]   = useState(initial.number || '');
  const [title, setTitle]     = useState(initial.title || '');
  const [author, setAuthor]   = useState(initial.author || '');
  const [chorus, setChorus]   = useState(initial.chorus || '');
  const [verses, setVerses]   = useState(initial.verses?.length ? initial.verses : ['']);
  const [saving, setSaving]   = useState(false);

  const updateVerse = (i, v) => {
    setVerses((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  };
  const addVerse    = () => setVerses((p) => [...p, '']);
  const removeVerse = (i) => setVerses((p) => p.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    const num = parseInt(number, 10);
    if (!num || num < 1) return toast.error('Hymn number must be a positive integer.');
    if (!title.trim())   return toast.error('Title is required.');
    const cleanVerses = verses.map((v) => v.trim()).filter(Boolean);
    if (!cleanVerses.length) return toast.error('At least one verse is required.');

    setSaving(true);
    try {
      await req('/api/admin/hymns', 'POST', {
        number: num,
        title: title.trim(),
        author: author.trim() || null,
        chorus: chorus.trim() || null,
        verses: cleanVerses,
      });
      toast.success(isEdit ? `MHB #${num} updated.` : `MHB #${num} created.`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit MHB #${initial.number}` : 'New hymn'}
      sub="Methodist Hymn Book entry. Verses are saved in order."
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">MHB number</label>
          <input
            type="number"
            min="1"
            className="input"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            disabled={isEdit}
          />
        </div>
        <div>
          <label className="label">Author</label>
          <input
            className="input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. Charles Wesley"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Chorus (optional)</label>
          <textarea
            className="input min-h-[70px]"
            value={chorus}
            onChange={(e) => setChorus(e.target.value)}
            placeholder="Sung after every verse"
          />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <label className="label !mb-0">Verses</label>
            <button type="button" onClick={addVerse} className="btn-soft text-xs">
              <Plus className="h-3.5 w-3.5" /> Add verse
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {verses.map((v, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 w-6 shrink-0 text-right text-xs font-semibold text-zinc-400 tabular">
                  {i + 1}
                </span>
                <textarea
                  className="input min-h-[80px]"
                  value={v}
                  onChange={(e) => updateVerse(i, e.target.value)}
                  placeholder={`Verse ${i + 1} lyrics…`}
                />
                {verses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVerse(i)}
                    className="mt-1 rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
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
