import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCcw, Zap } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { CATEGORIES, CAT_PILL, LANGS } from '../constants.js';

const ANSWER_KEYS = ['a', 'b', 'c', 'd'];

export default function Quizzes() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [activeCat, setActiveCat] = useState('adult');
  const [units, setUnits]         = useState([]);
  const [lessons, setLessons]     = useState([]);
  const [lessonId, setLessonId]   = useState('');
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [editing, setEditing]     = useState(null);

  // Load units + lessons for the active category whenever it changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const us = await req(`/api/units?category=${activeCat}`);
        if (cancelled) return;
        setUnits(us);
        const lessonChunks = await Promise.all(
          us.map((u) => req(`/api/units/${u.id}/lessons`).catch(() => [])),
        );
        if (cancelled) return;
        const flat = lessonChunks.flat();
        setLessons(flat);
        // Reset lesson selection if the current selection no longer exists.
        if (!flat.find((l) => String(l.id) === String(lessonId))) {
          setLessonId('');
          setRows([]);
        }
      } catch (e) {
        toast.error(e.message || 'Failed to load lessons.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat, req]);

  const loadQuestions = useCallback(async () => {
    if (!lessonId) { setRows([]); return; }
    setLoading(true);
    try {
      const data = await req(`/api/quiz/${lessonId}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load quiz questions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [req, lessonId, toast]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const onDelete = async (q) => {
    if (!confirm('Delete this question?')) return;
    try {
      await req(`/api/admin/quiz/${q.id}`, 'DELETE');
      toast.success('Question deleted.');
      loadQuestions();
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
    }
  };

  const lesson = lessons.find((l) => String(l.id) === String(lessonId));

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Content</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Quiz questions</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Multiple-choice questions live under a specific lesson and award points on correct answers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadQuestions} className="btn-ghost" disabled={loading || !lessonId}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setEditing({ lesson_id: lessonId ? parseInt(lessonId, 10) : null })}
            className="btn-primary"
            disabled={!lessonId}
            title={!lessonId ? 'Pick a lesson first' : undefined}
          >
            <Plus className="h-4 w-4" /> New question
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
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          className="ml-2 min-w-[280px] rounded-lg ring-1 ring-zinc-200 bg-white px-3 py-2 text-sm font-medium text-ink"
        >
          <option value="">— Select lesson —</option>
          {lessons
            .sort((a, b) => (a.lesson_number || 0) - (b.lesson_number || 0))
            .map((l) => (
              <option key={l.id} value={l.id}>
                L{l.lesson_number ?? '?'}: {l.title}
              </option>
            ))}
        </select>
        {lesson && <span className="text-xs text-zinc-500 tabular">{rows.length} questions</span>}
      </div>

      <div className="card overflow-hidden">
        {!lessonId ? (
          <div className="py-16 text-center">
            <Zap className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">Pick a lesson to view its questions</div>
          </div>
        ) : loading ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <Zap className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">No questions yet for this lesson</div>
            <button
              onClick={() => setEditing({ lesson_id: parseInt(lessonId, 10) })}
              className="btn-primary mt-4"
            >
              <Plus className="h-4 w-4" /> Add the first question
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((q, i) => (
              <li key={q.id} className="px-5 py-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Q{i + 1} · {q.points || 10} pts
                    </div>
                    <div className="mt-0.5 text-[15px] font-semibold text-ink">{q.question}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={CAT_PILL[q.category_id] || 'zinc'}>
                      {q.category_id || 'all'}
                    </Badge>
                    <Badge variant="zinc">{(q.lang || 'en').toUpperCase()}</Badge>
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

                {/* Options */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ANSWER_KEYS.map((k) => {
                    const text = q.options?.[k] || q.options?.[k.toUpperCase()] || '';
                    if (!text) return null;
                    const correct = (q.correct_answer || '').toLowerCase() === k;
                    return (
                      <div
                        key={k}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
                          correct
                            ? 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800'
                            : 'bg-zinc-50 ring-1 ring-zinc-100 text-zinc-700'
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                          correct ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700'
                        }`}>
                          {k.toUpperCase()}
                        </span>
                        <span className="truncate">{text}</span>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <QuestionModal
          initial={editing}
          lessons={lessons}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadQuestions(); }}
          req={req}
          toast={toast}
        />
      )}
    </div>
  );
}

function QuestionModal({ initial, lessons, onClose, onSaved, req, toast }) {
  const isEdit = !!initial.id;
  const [lessonId, setLessonId]     = useState(initial.lesson_id ? String(initial.lesson_id) : '');
  const [question, setQuestion]     = useState(initial.question || '');
  const [opts, setOpts]             = useState(() => {
    const o = initial.options || {};
    return {
      a: o.a || o.A || '',
      b: o.b || o.B || '',
      c: o.c || o.C || '',
      d: o.d || o.D || '',
    };
  });
  const [answer, setAnswer]         = useState((initial.correct_answer || 'a').toLowerCase());
  const [points, setPoints]         = useState(initial.points || 10);
  const [category, setCategory]     = useState(initial.category_id || 'all');
  const [lang, setLang]             = useState(initial.lang || 'en');
  const [saving, setSaving]         = useState(false);

  const setOpt = (k, v) => setOpts((o) => ({ ...o, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!lessonId)             return toast.error('Select a lesson.');
    if (!question.trim())      return toast.error('Question text is required.');
    if (!opts[answer]?.trim()) return toast.error(`Option ${answer.toUpperCase()} is the correct answer but is empty.`);

    setSaving(true);
    try {
      const body = {
        lesson_id:      parseInt(lessonId, 10),
        question:       question.trim(),
        options: {
          a: opts.a.trim(),
          b: opts.b.trim(),
          c: opts.c.trim(),
          d: opts.d.trim(),
        },
        correct_answer: answer,
        points:         parseInt(points, 10) || 10,
        category_id:    category,
        lang,
      };
      if (isEdit) await req(`/api/admin/quiz/${initial.id}`, 'PUT', body);
      else        await req('/api/admin/quiz', 'POST', body);
      toast.success(isEdit ? 'Question updated.' : 'Question added.');
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
      title={isEdit ? 'Edit question' : 'New question'}
      sub="Pick the correct answer by clicking the radio next to it."
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
        <div className="sm:col-span-2">
          <label className="label">Lesson</label>
          <select
            className="input"
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
          >
            <option value="">— Select lesson —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                L{l.lesson_number ?? '?'}: {l.title}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Question</label>
          <textarea
            className="input min-h-[80px]"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What did Paul ask Philemon to do?"
          />
        </div>

        {/* Options + correct answer radio */}
        <div className="sm:col-span-2">
          <label className="label">Options · pick the correct one</label>
          <div className="flex flex-col gap-2">
            {ANSWER_KEYS.map((k) => (
              <label
                key={k}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ring-1 transition ${
                  answer === k
                    ? 'bg-emerald-50 ring-emerald-300'
                    : 'bg-white ring-zinc-200 hover:bg-zinc-25'
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  checked={answer === k}
                  onChange={() => setAnswer(k)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-600"
                />
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                  answer === k ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700'
                }`}>
                  {k.toUpperCase()}
                </span>
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  value={opts[k]}
                  onChange={(e) => setOpt(k, e.target.value)}
                  placeholder={`Option ${k.toUpperCase()}`}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Points</label>
          <input
            type="number"
            min="1"
            className="input tabular"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Language</label>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Show this question to</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label} only</option>
            ))}
          </select>
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
