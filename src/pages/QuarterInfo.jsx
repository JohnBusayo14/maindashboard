import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Star, RefreshCcw, CalendarDays } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' },
];

export default function QuarterInfo() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/admin/quarter-info');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load quarter info.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  const setCurrent = async (id) => {
    try {
      await req(`/api/admin/quarter-info/${id}/set-current`, 'POST');
      toast.success('Set as current quarter.');
      load();
    } catch (e) {
      toast.error(e.message || 'Failed to update.');
    }
  };

  const onDelete = async (q) => {
    if (!confirm(`Delete "${q.theme_title}"? This cannot be undone.`)) return;
    try {
      await req(`/api/admin/quarter-info/${q.id}`, 'DELETE');
      toast.success('Quarter deleted.');
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Quarter info</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The current quarter's theme, period, and memory verse show in the home banner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setEditing({})} className="btn-primary">
            <Plus className="h-4 w-4" /> New quarter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-6"><Skeleton lines={5} /></div>
      ) : rows.length === 0 ? (
        <div className="card py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-zinc-300" />
          <div className="mt-3 text-sm font-semibold text-zinc-700">No quarters yet</div>
          <button onClick={() => setEditing({})} className="btn-primary mt-4">
            <Plus className="h-4 w-4" /> Add the first quarter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((q) => (
            <div key={q.id} className={`card p-5 ${q.is_current ? 'ring-2 ring-brand-600' : ''}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="zinc">{q.quarter} · {q.year}</Badge>
                  {q.is_current && <Badge variant="blue"><Star className="h-3 w-3" /> Current</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  {!q.is_current && (
                    <button
                      onClick={() => setCurrent(q.id)}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-brand-50 hover:text-brand-600"
                      title="Set as current"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(q)}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(q)}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-ink">{q.theme_title}</h3>
              {q.theme_sub && <p className="mt-1 text-sm text-zinc-600">{q.theme_sub}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <div><span className="font-semibold text-zinc-700">Book:</span> {q.book_full || q.book || '—'}</div>
                <div><span className="font-semibold text-zinc-700">Lessons:</span> {q.lesson_count ?? '—'}</div>
                <div className="col-span-2"><span className="font-semibold text-zinc-700">Period:</span> {q.period || '—'}</div>
                {q.memory_verse && (
                  <div className="col-span-2">
                    <span className="font-semibold text-zinc-700">Memory verse:</span> "{q.memory_verse}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <QuarterModal
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

function QuarterModal({ initial, onClose, onSaved, req, toast }) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState({
    quarter:      initial.quarter      ?? 'Q1',
    year:         initial.year         ?? new Date().getFullYear(),
    theme_title:  initial.theme_title  ?? '',
    theme_sub:    initial.theme_sub    ?? '',
    book:         initial.book         ?? '',
    book_full:    initial.book_full    ?? '',
    lesson_count: initial.lesson_count ?? 13,
    period:       initial.period       ?? '',
    memory_verse: initial.memory_verse ?? '',
    is_current:   !!initial.is_current,
    translations: initial.translations || {},
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab]       = useState('en');

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setTrans = (lang, k, v) =>
    setForm((f) => ({ ...f, translations: { ...f.translations, [lang]: { ...(f.translations[lang] || {}), [k]: v } } }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.quarter || !form.theme_title.trim()) {
      return toast.error('Quarter and theme title are required.');
    }
    setSaving(true);
    try {
      const body = { ...form, year: parseInt(form.year, 10) || new Date().getFullYear(),
                     lesson_count: parseInt(form.lesson_count, 10) || 13 };
      if (isEdit) await req(`/api/admin/quarter-info/${initial.id}`, 'PUT', body);
      else        await req('/api/admin/quarter-info', 'POST', body);
      toast.success(isEdit ? 'Quarter updated.' : 'Quarter created.');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const tr = form.translations[tab] || {};

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit quarter' : 'New quarter'}
      sub="English values are required. Other languages fall back to English when blank."
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
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Quarter</label>
            <select className="input" value={form.quarter} onChange={(e) => setField('quarter', e.target.value)}>
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input tabular" value={form.year} onChange={(e) => setField('year', e.target.value)} />
          </div>
          <div>
            <label className="label">Lesson count</label>
            <input type="number" className="input tabular" value={form.lesson_count} onChange={(e) => setField('lesson_count', e.target.value)} />
          </div>

          <div className="sm:col-span-3">
            <label className="label">Period</label>
            <input className="input" value={form.period} onChange={(e) => setField('period', e.target.value)} placeholder="January – March 2026" />
          </div>

          <div>
            <label className="label">Book code</label>
            <input className="input" value={form.book} onChange={(e) => setField('book', e.target.value)} placeholder="Phlm" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Book full name</label>
            <input className="input" value={form.book_full} onChange={(e) => setField('book_full', e.target.value)} placeholder="Philemon" />
          </div>
        </div>

        {/* Translation tabs */}
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <div className="mb-3 flex gap-1 rounded-lg bg-zinc-50 p-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setTab(l.code)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  tab === l.code ? 'bg-white text-ink shadow-sm' : 'text-zinc-500 hover:text-ink'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {tab === 'en' ? (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Theme title (EN)</label>
                <input className="input" value={form.theme_title} onChange={(e) => setField('theme_title', e.target.value)} />
              </div>
              <div>
                <label className="label">Theme subtitle (EN)</label>
                <input className="input" value={form.theme_sub} onChange={(e) => setField('theme_sub', e.target.value)} />
              </div>
              <div>
                <label className="label">Memory verse (EN)</label>
                <textarea className="input min-h-[70px]" value={form.memory_verse} onChange={(e) => setField('memory_verse', e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Theme title ({tab.toUpperCase()})</label>
                <input className="input" value={tr.theme_title || ''} onChange={(e) => setTrans(tab, 'theme_title', e.target.value)} />
              </div>
              <div>
                <label className="label">Theme subtitle ({tab.toUpperCase()})</label>
                <input className="input" value={tr.theme_sub || ''} onChange={(e) => setTrans(tab, 'theme_sub', e.target.value)} />
              </div>
              <div>
                <label className="label">Period ({tab.toUpperCase()})</label>
                <input className="input" value={tr.period || ''} onChange={(e) => setTrans(tab, 'period', e.target.value)} />
              </div>
              <div>
                <label className="label">Memory verse ({tab.toUpperCase()})</label>
                <textarea className="input min-h-[70px]" value={tr.memory_verse || ''} onChange={(e) => setTrans(tab, 'memory_verse', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <label className="mt-5 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 ring-1 ring-brand-100">
          <input
            type="checkbox"
            checked={form.is_current}
            onChange={(e) => setField('is_current', e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-600"
          />
          <span className="text-sm font-semibold text-brand-800">Set as the current quarter</span>
        </label>
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
