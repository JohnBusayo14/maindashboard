// components/EntryFormModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared book-entry editor. Used by:
//   • BookEntries.jsx (per-book entry CRUD)
//   • BookManage.jsx  (rich book editor with metadata + search)
//
// Maps directly to the book_entries columns. Submits to
// POST /api/admin/books/:id/entries which is upsert by (entry_number, type).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Modal from './Modal.jsx';
import TranslationFields, { compactTranslations } from './TranslationFields.jsx';

export const ENTRY_TYPES = [
  { value: 'daily',          label: 'Daily' },
  { value: 'family_vigil',   label: 'Family Vigil' },
  { value: 'youth_vigil',    label: 'Youth Vigil' },
  { value: 'women_vigil',    label: 'Women Vigil' },
  { value: 'men_vigil',      label: 'Men Vigil' },
  { value: 'general_vigil',  label: 'General Vigil' },
];

export const VIGIL_TYPES = new Set([
  'family_vigil', 'youth_vigil', 'women_vigil', 'men_vigil', 'general_vigil',
]);

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const linesToArray = (s) =>
  String(s || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export const arrayToLines = (a) =>
  Array.isArray(a) ? a.join('\n') : (a || '');

export default function EntryFormModal({ book, initial, onClose, onSaved, req, toast, defaultType }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    entry_number:          initial?.entry_number || '',
    entry_type:            initial?.entry_type || defaultType || 'daily',
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
    translations:          initial?.translations && typeof initial.translations === 'object'
                             ? initial.translations
                             : {},
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
        translations:          compactTranslations(form.translations),
      });
      toast.success(isEdit ? 'Section updated.' : 'Section created.');
      onSaved();
    } catch (e) { toast.error(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose}
      title={isEdit ? `Edit section ${initial.entry_number} (${initial.entry_type})` : 'Add section'}
      sub={`In ${book?.title || ''}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create section')}
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

        <div className="sm:col-span-3">
          <TranslationFields
            fields={[
              { key: 'focus',                 label: 'Focus',                type: 'text' },
              { key: 'scripture_text',        label: 'Scripture',            type: 'text' },
              { key: 'inspirational_message', label: 'Inspirational message', type: 'textarea', rows: 5 },
              { key: 'prayer_points',         label: 'Prayer points',         type: 'array', rows: 5 },
              { key: 'special_intercession',  label: 'Special intercession',  type: 'textarea', rows: 3 },
              { key: 'discussion_questions',  label: 'Discussion questions',  type: 'array', rows: 4 },
              { key: 'declarations',          label: 'Declarations',          type: 'array', rows: 4 },
            ]}
            english={{
              focus:                 form.focus,
              scripture_text:        form.scripture_text,
              inspirational_message: form.inspirational_message,
              prayer_points:         linesToArray(form.prayer_points_text),
              special_intercession:  form.special_intercession,
              discussion_questions:  linesToArray(form.discussion_text),
              declarations:          linesToArray(form.declarations_text),
            }}
            value={form.translations}
            onChange={(next) => setForm((f) => ({ ...f, translations: next }))}
          />
        </div>
      </div>
    </Modal>
  );
}
