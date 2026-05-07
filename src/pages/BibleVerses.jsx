import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, RefreshCcw, Quote, Search } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

export default function BibleVerses() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [adding, setAdding]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/admin/bible-verses');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load verses.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.reference?.toLowerCase().includes(term) || r.text?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const onDelete = async (v) => {
    if (!confirm(`Remove "${v.reference}"?`)) return;
    try {
      await req(`/api/admin/bible-verses/${v.id}`, 'DELETE');
      toast.success('Verse removed.');
      load();
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Content</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Bible verses</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cached lookups so the app never has to fetch from an external Bible API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setAdding(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add verse
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference or text…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <span className="text-xs text-zinc-500">{filtered.length} of {rows.length}</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Quote className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {rows.length === 0 ? 'No verses yet' : 'No verses match your search'}
            </div>
            {rows.length === 0 && (
              <button onClick={() => setAdding(true)} className="btn-primary mt-4">
                <Plus className="h-4 w-4" /> Add the first verse
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {filtered.map((v) => (
              <li key={v.id} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{v.reference}</span>
                    <Badge variant="zinc">{v.version || 'KJV'}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700">{v.text}</p>
                </div>
                <button
                  onClick={() => onDelete(v)}
                  className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && (
        <VerseModal
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
          req={req}
          toast={toast}
        />
      )}
    </div>
  );
}

function VerseModal({ onClose, onSaved, req, toast }) {
  const [reference, setRef]     = useState('');
  const [text, setText]         = useState('');
  const [version, setVersion]   = useState('KJV');
  const [saving, setSaving]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reference.trim() || !text.trim()) {
      return toast.error('Reference and text are required.');
    }
    setSaving(true);
    try {
      await req('/api/admin/bible-verses', 'POST', {
        reference: reference.trim(),
        text:      text.trim(),
        version:   version.trim() || 'KJV',
      });
      toast.success('Verse added.');
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
      title="Add Bible verse"
      sub="The same reference + version overwrites any existing cache row."
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Add verse'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="label">Reference</label>
          <input
            className="input"
            value={reference}
            onChange={(e) => setRef(e.target.value)}
            placeholder="John 3:16"
          />
        </div>
        <div>
          <label className="label">Version</label>
          <input
            className="input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="KJV"
          />
        </div>
        <div>
          <label className="label">Verse text</label>
          <textarea
            className="input min-h-[120px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="For God so loved the world…"
          />
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
