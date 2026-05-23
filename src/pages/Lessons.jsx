import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCcw, BookOpen, Search, ImagePlus, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import HymnPicker from '../components/HymnPicker.jsx';
import { CATEGORIES, CAT_PILL, LANGS } from '../constants.js';

const safeArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; }
    catch { return []; }
  }
  return [];
};

const blankContent = () => ({
  memory_verse:    '',
  background:      '',
  conclusion:      '',
  lesson_part:     [],
  devotional_days: [],
  questions:       [],
});

const DAY_LABELS = [
  'Day 1 — Monday', 'Day 2 — Tuesday', 'Day 3 — Wednesday',
  'Day 4 — Thursday', 'Day 5 — Friday', 'Day 6 — Saturday',
];

export default function Lessons() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [activeCat, setActiveCat] = useState('adult');
  const [units, setUnits]         = useState([]);
  const [unitFilter, setUnitFilter] = useState('');
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [q, setQ]                 = useState('');
  const [editing, setEditing]     = useState(null);

  // Load units when category changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const us = await req(`/api/units?category=${activeCat}`);
        if (cancelled) return;
        setUnits(us);
        // Reset unit filter if it no longer applies
        if (unitFilter && !us.find((u) => u.id === unitFilter)) setUnitFilter('');
      } catch (e) {
        toast.error(e.message || 'Failed to load units.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat, req]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let lessons;
      if (unitFilter) {
        lessons = await req(`/api/units/${unitFilter}/lessons`);
      } else {
        if (!units.length) { setRows([]); setLoading(false); return; }
        const chunks = await Promise.all(
          units.map((u) => req(`/api/units/${u.id}/lessons`).catch(() => [])),
        );
        lessons = chunks.flat();
      }
      setRows(Array.isArray(lessons) ? lessons : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load lessons.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [req, unitFilter, units, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (l) =>
        l.title?.toLowerCase().includes(term) ||
        String(l.lesson_number || '').includes(term) ||
        l.topic?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const onDelete = async (l) => {
    if (!confirm(`Delete "${l.title}"? This also deletes its quiz questions.`)) return;
    try {
      await req(`/api/admin/lessons/${l.id}`, 'DELETE');
      toast.success('Lesson deleted.');
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Lessons</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The full lesson editor — header info, parts, devotional days, questions, and four languages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setEditing({ unit_id: unitFilter || '' })}
            className="btn-primary"
            disabled={!units.length}
            title={!units.length ? 'Create a unit first' : undefined}
          >
            <Plus className="h-4 w-4" /> New lesson
          </button>
        </div>
      </div>

      {/* Filters */}
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
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="ml-2 rounded-lg ring-1 ring-zinc-200 bg-white px-3 py-2 text-sm font-medium text-ink"
        >
          <option value="">All units in category</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.title}</option>
          ))}
        </select>
        <div className="relative ml-2 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, topic, number…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <span className="text-xs text-zinc-500 tabular">{filtered.length} of {rows.length}</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : !units.length ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              No units in this category yet — create a unit before adding lessons.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {rows.length === 0 ? 'No lessons yet' : 'No lessons match'}
            </div>
            {rows.length === 0 && (
              <button
                onClick={() => setEditing({ unit_id: unitFilter || '' })}
                className="btn-primary mt-4"
              >
                <Plus className="h-4 w-4" /> Add the first lesson
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5 w-12">#</th>
                  <th className="px-5 py-2.5">Title</th>
                  <th className="px-5 py-2.5">Unit</th>
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-5 py-2.5 text-center">Parts</th>
                  <th className="px-5 py-2.5 text-center">Days</th>
                  <th className="px-5 py-2.5 text-center">Qs</th>
                  <th className="px-5 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((l) => {
                  const unit = units.find((u) => u.id === l.unit_id);
                  return (
                    <tr key={l.id} className="hover:bg-zinc-25">
                      <td className="px-5 py-2.5 font-bold tabular text-zinc-500">{l.lesson_number ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-ink">{l.title}</div>
                        {l.topic && <div className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">{l.topic}</div>}
                      </td>
                      <td className="px-5 py-2.5 text-zinc-700">{unit?.title || l.unit_id}</td>
                      <td className="px-5 py-2.5 text-zinc-500 tabular">{l.lesson_date || '—'}</td>
                      <td className="px-5 py-2.5 text-center">
                        <Badge variant="violet">{safeArr(l.lesson_part).length}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <Badge variant="teal">{safeArr(l.devotional_days).length}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <Badge variant="amber">{safeArr(l.questions).length}</Badge>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(l)}
                            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDelete(l)}
                            className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {editing && (
        <LessonModal
          initial={editing}
          units={units}
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

// ─────────────────────────────────────────────────────────────────────────────
// Lesson editor modal
// ─────────────────────────────────────────────────────────────────────────────
function LessonModal({ initial, units, activeCat, onClose, onSaved, req, toast }) {
  const isEdit = !!initial.id;

  // Top-level header fields
  const [unitId, setUnitId]                     = useState(initial.unit_id || '');
  const [lessonNumber, setLessonNumber]         = useState(initial.lesson_number || '');
  const [title, setTitle]                       = useState(initial.title || '');
  const [lessonDate, setLessonDate]             = useState(initial.lesson_date || '');
  const [topic, setTopic]                       = useState(initial.topic || '');
  const [quarterTheme, setQuarterTheme]         = useState(initial.quarter_theme || '');
  const [hymns, setHymns]                       = useState(initial.suggested_hymns || '');
  const [devReading, setDevReading]             = useState(initial.devotional_reading || '');
  const [memoryPassage, setMemoryPassage]       = useState(initial.memory_verse_passage || '');
  const [sortOrder, setSortOrder]               = useState(initial.sort_order ?? 0);

  // Per-language content blocks
  const [content, setContent] = useState(() => {
    const c = {
      en: {
        memory_verse:    initial.memory_verse || '',
        background:      initial.lesson_background || '',
        conclusion:      initial.lesson_conclusion || '',
        lesson_part:     safeArr(initial.lesson_part),
        devotional_days: safeArr(initial.devotional_days),
        questions:       safeArr(initial.questions).map((q) => (typeof q === 'string' ? q : q?.text || '')),
      },
      yo: blankContent(),
      ig: blankContent(),
      ha: blankContent(),
    };
    return c;
  });

  const [tab, setTab]               = useState('en');
  const [saving, setSaving]         = useState(false);
  const [loadingTr, setLoadingTr]   = useState(false);

  // On edit, fetch translations and merge them in.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setLoadingTr(true);
    req(`/api/admin/lessons/${initial.id}`)
      .then((full) => {
        if (cancelled) return;
        const tr = full.translations || {};
        setContent((prev) => {
          const next = { ...prev };
          for (const lang of ['yo', 'ig', 'ha']) {
            if (tr[lang]) {
              next[lang] = {
                memory_verse:    tr[lang].memory_verse      || '',
                background:      tr[lang].lesson_background || '',
                conclusion:      tr[lang].lesson_conclusion || '',
                lesson_part:     safeArr(tr[lang].lesson_part),
                devotional_days: safeArr(tr[lang].devotional_days),
                questions:       safeArr(tr[lang].questions).map((q) => (typeof q === 'string' ? q : q?.text || '')),
              };
            }
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTr(false); });
    return () => { cancelled = true; };
  }, [isEdit, initial.id, req]);

  const setLang = (lang, k, v) =>
    setContent((c) => ({ ...c, [lang]: { ...c[lang], [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    if (!unitId)        return toast.error('Pick a unit.');
    if (!title.trim())  return toast.error('Title is required.');

    setSaving(true);
    try {
      const body = {
        unit_id:               unitId,
        lesson_number:         parseInt(lessonNumber, 10) || null,
        title:                 title.trim(),
        lesson_date:           lessonDate.trim() || null,
        topic:                 topic.trim() || null,
        quarter_theme:         quarterTheme.trim() || null,
        suggested_hymns:       hymns.trim() || null,
        devotional_reading:    devReading.trim() || null,
        memory_verse_passage:  memoryPassage.trim() || null,
        sort_order:            parseInt(sortOrder, 10) || 0,
        content:               content,
      };
      if (isEdit) await req(`/api/admin/lessons/${initial.id}`, 'PUT', body);
      else        await req('/api/admin/lessons', 'POST', body);
      toast.success(isEdit ? 'Lesson updated.' : 'Lesson created.');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const isFilled = (lang) => {
    const c = content[lang];
    if (!c) return false;
    if (lang === 'en') return !!title.trim() || !!c.background || c.lesson_part.length > 0;
    return !!c.background || !!c.conclusion || c.lesson_part.length > 0 || c.questions.length > 0;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit lesson #${initial.lesson_number ?? '?'}` : 'New lesson'}
      sub="Header info on top, then four language tabs for the actual lesson content."
      size="xl"
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
        {/* ─── Header fields ──────────────────────────────────────────────── */}
        <div className="rounded-lg bg-zinc-25 p-4">
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Header</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label className="label">Unit</label>
              <select
                className="input"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">— Select unit —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lesson #</label>
              <input
                type="number"
                className="input tabular"
                value={lessonNumber}
                onChange={(e) => setLessonNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Sort</label>
              <input
                type="number"
                className="input tabular"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                className="input"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
                placeholder="2026-01-04"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="label">Title (EN)</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="sm:col-span-6">
              <label className="label">Topic / subtitle (EN)</label>
              <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Quarter theme</label>
              <input className="input" value={quarterTheme} onChange={(e) => setQuarterTheme(e.target.value)} placeholder="Optional" />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Suggested hymns</label>
              {/* Multi-select pulled from the Hymns submenu. Stored as the
                  same comma-separated MHB numbers string the backend already
                  expects, so the mobile app's existing parser works
                  unchanged. */}
              <HymnPicker
                value={hymns}
                onChange={setHymns}
                req={req}
                toast={toast}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Devotional reading</label>
              <input className="input" value={devReading} onChange={(e) => setDevReading(e.target.value)} placeholder="Philemon 1:1–25" />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Memory verse passage</label>
              <input className="input" value={memoryPassage} onChange={(e) => setMemoryPassage(e.target.value)} placeholder="Phlm 1:7" />
            </div>
          </div>
        </div>

        {/* ─── Language tabs ──────────────────────────────────────────────── */}
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-lg bg-zinc-50 p-1">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setTab(l.code)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    tab === l.code ? 'bg-white text-ink shadow-sm' : 'text-zinc-500 hover:text-ink'
                  }`}
                >
                  <span className="text-sm">{l.flag}</span>
                  {l.label}
                  {isFilled(l.code) && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </button>
              ))}
            </div>
            {loadingTr && <span className="text-xs text-zinc-500">Loading translations…</span>}
          </div>

          {tab !== 'en' && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800 ring-1 ring-amber-100">
              {LANGS.find((l) => l.code === tab)?.label} translation — blank fields fall back to English in the app.
            </div>
          )}

          <LangPanel
            lang={tab}
            content={content[tab]}
            onChange={(k, v) => setLang(tab, k, v)}
            mutateArr={(k, fn) => setLang(tab, k, fn(content[tab][k]))}
          />
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-language content panel — text fields + 3 nested array editors
// ─────────────────────────────────────────────────────────────────────────────
function LangPanel({ lang, content, onChange, mutateArr }) {
  const set = (k) => (e) => onChange(k, e.target.value);
  const upper = lang.toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="label">Memory verse ({upper})</label>
        <textarea
          className="input min-h-[60px]"
          value={content.memory_verse}
          onChange={set('memory_verse')}
        />
      </div>
      <div>
        <label className="label">Lesson background ({upper})</label>
        <textarea
          className="input min-h-[110px]"
          value={content.background}
          onChange={set('background')}
        />
      </div>
      <div>
        <label className="label">Conclusion ({upper})</label>
        <textarea
          className="input min-h-[80px]"
          value={content.conclusion}
          onChange={set('conclusion')}
        />
      </div>

      <PartsEditor
        items={content.lesson_part}
        upper={upper}
        onChange={(fn) => mutateArr('lesson_part', fn)}
      />
      <DaysEditor
        items={content.devotional_days}
        upper={upper}
        onChange={(fn) => mutateArr('devotional_days', fn)}
      />
      <QuestionsEditor
        items={content.questions}
        upper={upper}
        onChange={(fn) => mutateArr('questions', fn)}
      />
    </div>
  );
}

function PartsEditor({ items, upper, onChange }) {
  const add  = () => onChange((arr) => [...arr, { part_topic: '', part_para1: '', part_para2: '', part_image_url: '' }]);
  const rem  = (i) => onChange((arr) => arr.filter((_, idx) => idx !== i));
  const upd  = (i, k, v) => onChange((arr) => arr.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label !mb-0">Parts ({upper})</label>
        <button type="button" onClick={add} className="btn-soft text-xs">
          <Plus className="h-3.5 w-3.5" /> Add part
        </button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md bg-zinc-25 px-3 py-2.5 text-[12px] text-zinc-500">
          No parts yet. Lessons usually have 2–3 parts.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((p, i) => (
            <div key={i} className="rounded-lg bg-zinc-25 p-3 ring-1 ring-zinc-100">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Part {i + 1}
                </span>
                <button type="button" onClick={() => rem(i)} className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <PartImageField
                  value={p.part_image_url || ''}
                  onChange={(v) => upd(i, 'part_image_url', v)}
                />
                <input
                  className="input"
                  value={p.part_topic || ''}
                  onChange={(e) => upd(i, 'part_topic', e.target.value)}
                  placeholder="Part topic"
                />
                <textarea
                  className="input min-h-[80px]"
                  value={p.part_para1 || ''}
                  onChange={(e) => upd(i, 'part_para1', e.target.value)}
                  placeholder="Paragraph 1"
                />
                <textarea
                  className="input min-h-[60px]"
                  value={p.part_para2 || ''}
                  onChange={(e) => upd(i, 'part_para2', e.target.value)}
                  placeholder="Paragraph 2 (optional)"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Per-part header image. Accepts either a remote URL or a file uploaded from
// disk (read as a base64 data URL, capped at ~1.5MB to keep the lesson_part
// JSONB row small). The mobile app's <Image source={{ uri }} /> handles both
// `https://...` URLs and `data:image/...;base64,...` strings unchanged.
function PartImageField({ value, onChange }) {
  const onFile = (file) => {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert('Image too large — keep it under 1.5 MB or paste a URL instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  const hasImage = !!value;

  return (
    <div className="rounded-md bg-white p-2.5 ring-1 ring-zinc-200">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Header image (optional)
        </span>
        {hasImage && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 rounded p-1 text-[11px] font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-600"
            title="Remove image"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
      {hasImage && (
        <img
          src={value}
          alt=""
          className="mb-2 h-28 w-full rounded-md object-cover ring-1 ring-zinc-200"
        />
      )}
      <input
        className="input mb-1.5"
        value={value.startsWith('data:') ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://… (or upload below)"
      />
      <label className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-50 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100">
        <ImagePlus className="h-3.5 w-3.5" />
        Upload from device
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
    </div>
  );
}

function DaysEditor({ items, upper, onChange }) {
  const add = () =>
    onChange((arr) => [...arr, { day: DAY_LABELS[arr.length] || `Day ${arr.length + 1}`, title: '', scripture: '' }]);
  const rem = (i) => onChange((arr) => arr.filter((_, idx) => idx !== i));
  const upd = (i, k, v) => onChange((arr) => arr.map((d, idx) => (idx === i ? { ...d, [k]: v } : d)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label !mb-0">Devotional days ({upper})</label>
        <button type="button" onClick={add} className="btn-soft text-xs">
          <Plus className="h-3.5 w-3.5" /> Add day
        </button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md bg-zinc-25 px-3 py-2.5 text-[12px] text-zinc-500">
          No days yet. Six days (Mon–Sat) is the typical pattern.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((d, i) => (
            <div key={i} className="rounded-lg bg-zinc-25 p-3 ring-1 ring-zinc-100">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  {DAY_LABELS[i] || `Day ${i + 1}`}
                </span>
                <button type="button" onClick={() => rem(i)} className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  className="input"
                  value={d.day || ''}
                  onChange={(e) => upd(i, 'day', e.target.value)}
                  placeholder="Label"
                />
                <input
                  className="input"
                  value={d.title || ''}
                  onChange={(e) => upd(i, 'title', e.target.value)}
                  placeholder="Day title"
                />
                <input
                  className="input"
                  value={d.scripture || ''}
                  onChange={(e) => upd(i, 'scripture', e.target.value)}
                  placeholder="Scripture (e.g. Phlm 1:1–3)"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionsEditor({ items, upper, onChange }) {
  const add = () => onChange((arr) => [...arr, '']);
  const rem = (i) => onChange((arr) => arr.filter((_, idx) => idx !== i));
  const upd = (i, v) => onChange((arr) => arr.map((q, idx) => (idx === i ? v : q)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label !mb-0">Discussion questions ({upper})</label>
        <button type="button" onClick={add} className="btn-soft text-xs">
          <Plus className="h-3.5 w-3.5" /> Add question
        </button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md bg-zinc-25 px-3 py-2.5 text-[12px] text-zinc-500">
          No questions yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((q, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-6 shrink-0 text-right text-xs font-semibold text-zinc-400 tabular">
                {i + 1}
              </span>
              <textarea
                className="input min-h-[55px]"
                value={typeof q === 'string' ? q : q?.text || ''}
                onChange={(e) => upd(i, e.target.value)}
                placeholder="Discussion question…"
              />
              <button
                type="button"
                onClick={() => rem(i)}
                className="mt-1 rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
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
