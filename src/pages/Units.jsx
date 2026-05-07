import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCcw, Library, Search } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { CATEGORIES, CAT_PILL, TRANS_LANGS } from '../constants.js';

export default function Units() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [activeCat, setActiveCat] = useState('adult');
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState('');
  const [editing, setEditing]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req(`/api/units?category=${activeCat}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load units.');
    } finally {
      setLoading(false);
    }
  }, [req, activeCat, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (u) =>
        u.id?.toLowerCase().includes(term) ||
        u.title?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const onDelete = async (u) => {
    if (!confirm(`Delete unit "${u.id}"?\n\nAll lessons inside will also be deleted.`)) return;
    try {
      await req(`/api/admin/units/${u.id}`, 'DELETE');
      toast.success(`Unit ${u.id} deleted.`);
      load();
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
    }
  };

  const openEdit = async (u) => {
    // Fetch translations from the admin endpoint so the modal pre-fills them.
    try {
      const full = await req(`/api/admin/units/${u.id}`);
      setEditing(full);
    } catch (e) {
      toast.error(e.message || 'Could not load unit.');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Content</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Units</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Curriculum units, grouped by age category. Lessons live inside a unit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setEditing({ category_id: activeCat })} className="btn-primary">
            <Plus className="h-4 w-4" /> New unit
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg ring-1 ring-zinc-200 bg-white p-0.5 text-sm">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                activeCat === c.id ? 'bg-zinc-100 text-ink' : 'text-zinc-500 hover:text-ink'
              }`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full mr-1.5" style={{ backgroundColor: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative ml-2 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search id or title…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <span className="text-xs text-zinc-500">{filtered.length} of {rows.length}</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Library className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {rows.length === 0 ? 'No units in this category' : 'No units match'}
            </div>
            {rows.length === 0 && (
              <button onClick={() => setEditing({ category_id: activeCat })} className="btn-primary mt-4">
                <Plus className="h-4 w-4" /> Create the first unit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5 w-48">ID</th>
                  <th className="px-5 py-2.5">Title</th>
                  <th className="px-5 py-2.5">Range</th>
                  <th className="px-5 py-2.5">Category</th>
                  <th className="px-5 py-2.5 text-right">Sort</th>
                  <th className="px-5 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-25">
                    <td className="px-5 py-2.5">
                      <code className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px]">{u.id}</code>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: u.color || '#94A3B8' }} />
                        <span className="font-semibold text-ink">{u.title}</span>
                      </div>
                      {u.description && <div className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">{u.description}</div>}
                    </td>
                    <td className="px-5 py-2.5 text-zinc-700">{u.lesson_range || '—'}</td>
                    <td className="px-5 py-2.5">
                      <Badge variant={CAT_PILL[u.category_id] || 'zinc'}>
                        <span className="capitalize">{u.category_id}</span>
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular text-zinc-700">{u.sort_order ?? 1}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(u)}
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
        <UnitModal
          initial={editing}
          activeCat={activeCat}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          req={req}
          toast={toast}
        />
      )}
    </div>
  );
}

function UnitModal({ initial, activeCat, onClose, onSaved, req, toast }) {
  const isEdit = !!initial.id && !!initial.title;
  const initialNum = (initial.id || '').split('_unit_')[1] || '1';
  const [num, setNum]           = useState(initialNum);
  const [cat, setCat]           = useState(initial.category_id || activeCat);
  const [id, setId]             = useState(initial.id || `${activeCat}_unit_${initialNum}`);
  const [idDirty, setIdDirty]   = useState(false);
  const [title, setTitle]       = useState(initial.title || '');
  const [desc, setDesc]         = useState(initial.description || '');
  const [range, setRange]       = useState(initial.lesson_range || '');
  const [color, setColor]       = useState(initial.color || CATEGORIES.find((c) => c.id === (initial.category_id || activeCat))?.color || '#7C3AED');
  const [sort, setSort]         = useState(initial.sort_order ?? 1);
  const [trans, setTrans]       = useState(initial.translations || {});
  const [tab, setTab]           = useState('en');
  const [saving, setSaving]     = useState(false);

  // Auto-generate id from category + number unless the user has hand-edited it
  // or we're editing an existing row.
  const updateAutoId = (newCat, newNum) => {
    if (isEdit || idDirty) return;
    setId(`${newCat}_unit_${newNum}`);
  };

  const setField = (k, v, setter) => {
    setter(v);
    if (k === 'cat')      updateAutoId(v, num);
    else if (k === 'num') updateAutoId(cat, v);
  };

  const setTr = (lang, k, v) =>
    setTrans((t) => ({ ...t, [lang]: { ...(t[lang] || {}), [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    if (!id.trim() || !title.trim()) {
      return toast.error('ID and title are required.');
    }
    // Strip empty translation rows so we don't store all-null entries.
    const cleanTrans = {};
    for (const lang of TRANS_LANGS.map((l) => l.code)) {
      const t = trans[lang] || {};
      if (t.title || t.description || t.lesson_range) {
        cleanTrans[lang] = {
          title:        t.title        || null,
          description:  t.description  || null,
          lesson_range: t.lesson_range || null,
        };
      }
    }

    setSaving(true);
    try {
      const body = {
        id:           id.trim(),
        category_id:  cat,
        title:        title.trim(),
        description:  desc.trim() || null,
        lesson_range: range.trim() || null,
        color:        color || null,
        sort_order:   parseInt(sort, 10) || 1,
        translations: cleanTrans,
      };
      if (isEdit) await req(`/api/admin/units/${initial.id}`, 'PUT', body);
      else        await req('/api/admin/units', 'POST', body);
      toast.success(isEdit ? 'Unit updated.' : 'Unit created.');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const tr = trans[tab] || {};

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit ${initial.id}` : 'New unit'}
      sub="The English row lives on the unit; other languages are stored as translations."
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
        {/* Header fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={cat}
              onChange={(e) => setField('cat', e.target.value, setCat)}
              disabled={isEdit}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unit #</label>
            <input
              type="number"
              min="1"
              className="input tabular"
              value={num}
              onChange={(e) => setField('num', e.target.value, setNum)}
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="label">Sort order</label>
            <input
              type="number"
              className="input tabular"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="label">ID <span className="font-normal normal-case tracking-normal text-zinc-500">— auto-generated</span></label>
            <input
              className="input font-mono text-[13px]"
              value={id}
              onChange={(e) => { setId(e.target.value); setIdDirty(true); }}
              disabled={isEdit}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="label">Title (EN)</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Lesson range (EN)</label>
            <input className="input" value={range} onChange={(e) => setRange(e.target.value)} placeholder="Lessons 1 – 4" />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-zinc-200"
              />
              <input
                className="input flex-1 font-mono text-[12px]"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label className="label">Description (EN)</label>
            <textarea
              className="input min-h-[80px]"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="One-line summary that shows under the title in the app"
            />
          </div>
        </div>

        {/* Translations */}
        <div className="mt-6 border-t border-zinc-100 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[15px] font-semibold text-ink">Translations</h4>
            <span className="text-xs text-zinc-500">Blank fields fall back to English in the app.</span>
          </div>

          <div className="mb-3 flex gap-1 rounded-lg bg-zinc-50 p-1 w-fit">
            {[{ code: 'en', label: 'English' }, ...TRANS_LANGS].map((l) => {
              const filled =
                l.code === 'en'
                  ? !!title.trim()
                  : !!(trans[l.code]?.title || trans[l.code]?.description || trans[l.code]?.lesson_range);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setTab(l.code)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    tab === l.code ? 'bg-white text-ink shadow-sm' : 'text-zinc-500 hover:text-ink'
                  }`}
                >
                  <span className="text-sm">{l.flag || ''}</span>
                  {l.label}
                  {filled && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </button>
              );
            })}
          </div>

          {tab === 'en' ? (
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              English values are managed in the form above. Switch tabs to edit YO/IG/HA.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Title ({tab.toUpperCase()})</label>
                <input
                  className="input"
                  value={tr.title || ''}
                  onChange={(e) => setTr(tab, 'title', e.target.value)}
                  placeholder={title || 'Translated title'}
                />
              </div>
              <div>
                <label className="label">Lesson range ({tab.toUpperCase()})</label>
                <input
                  className="input"
                  value={tr.lesson_range || ''}
                  onChange={(e) => setTr(tab, 'lesson_range', e.target.value)}
                  placeholder={range || '—'}
                />
              </div>
              <div>
                <label className="label">Description ({tab.toUpperCase()})</label>
                <input
                  className="input"
                  value={tr.description || ''}
                  onChange={(e) => setTr(tab, 'description', e.target.value)}
                  placeholder={desc || '—'}
                />
              </div>
            </div>
          )}
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
