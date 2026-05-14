// pages/Books.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Library catalog management. Lists every book in /api/books (including the
// unavailable ones via ?include=unavailable). Lets the admin:
//   • create a new book (slug, title, cover, accent, route, sort order)
//   • toggle availability inline
//   • click a row to drill into per-entry CRUD (BookEntries page)
//
// Sunday School (route_screen='HomeScreen') shows up here too but its row
// is read-only-ish — there are no book_entries for it; its content is the
// existing categories/units/lessons hierarchy and is edited via those pages.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCcw, Library, Search, ChevronRight, Edit3, Sparkles, Flame } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import TranslationFields, { compactTranslations } from '../components/TranslationFields.jsx';
import { VICTORY_BOOK_SLUG } from './victory/victoryData.js';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const slugify = (s) =>
  String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export default function Books() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();
  const nav   = useNavigate();

  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing]   = useState(null);   // book row being edited

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Include unavailable books so the admin can see drafts.
      const data = await req('/api/books?include=unavailable');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load books.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((b) =>
      b.title?.toLowerCase().includes(term) ||
      b.slug?.toLowerCase().includes(term) ||
      b.subtitle?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const toggleAvailable = async (book) => {
    try {
      await req(`/api/admin/books/${book.id}`, 'PUT', { available: !book.available });
      toast.success(`${book.title} is now ${book.available ? 'unavailable' : 'available'}.`);
      load();
    } catch (e) { toast.error(e.message || 'Toggle failed.'); }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Library</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Books</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The library catalog. Each book either uses the bespoke Sunday School flow or the generic
            daily-entry reader. Click a row to manage its entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Create book
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, slug, subtitle…"
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
              {rows.length === 0 ? 'No books yet' : 'No books match'}
            </div>
            {rows.length === 0 && (
              <button onClick={() => setCreating(true)} className="btn-primary mt-4">
                <Plus className="h-4 w-4" /> Create the first book
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5">Cover</th>
                  <th className="px-5 py-2.5">Book</th>
                  <th className="px-5 py-2.5">Slug</th>
                  <th className="px-5 py-2.5">Route</th>
                  <th className="px-5 py-2.5 text-right">Entries</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Updated</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((b) => {
                  const isHome    = b.route_screen === 'HomeScreen';
                  const isVictory = b.slug === VICTORY_BOOK_SLUG;
                  return (
                    <tr key={b.id} className="hover:bg-zinc-25">
                      <td className="px-5 py-2.5">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                          style={{ backgroundColor: (b.accent_color || '#1A56DB') + '22', color: b.accent_color }}
                        >
                          {b.cover_image_url ? (
                            <img src={b.cover_image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <span>{b.cover_emoji || '📖'}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-ink">{b.title}</div>
                        {b.subtitle && <div className="mt-0.5 text-[11px] text-zinc-500">{b.subtitle}</div>}
                      </td>
                      <td className="px-5 py-2.5">
                        <code className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px]">{b.slug}</code>
                      </td>
                      <td className="px-5 py-2.5">
                        {isHome
                          ? <Badge variant="amber">Sunday School flow</Badge>
                          : isVictory
                            ? <Badge variant="red">Victory Month editor</Badge>
                            : <Badge variant="blue">BookReader</Badge>}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular">
                        {isHome ? '—' : <Badge variant="blue">{b.entries_count ?? 0}</Badge>}
                      </td>
                      <td className="px-5 py-2.5">
                        <button
                          onClick={() => toggleAvailable(b)}
                          className={
                            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ' +
                            (b.available
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100')
                          }
                        >
                          {b.available ? 'Available' : 'Coming Soon'}
                        </button>
                      </td>
                      <td className="px-5 py-2.5 text-zinc-500 tabular">{fmtDate(b.updated_at)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(b)}
                            className="btn-soft text-xs"
                            title="Edit metadata in a modal"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Quick edit
                          </button>
                          {!isHome && (
                            isVictory ? (
                              // Victory Month has its own dedicated editor at /victory
                              // (cards-per-day + vigils + audit panel). Route every
                              // "manage entries" intent there instead of the generic
                              // table — that's the canonical surface for this book.
                              <button
                                onClick={() => nav('/victory')}
                                className="btn-primary text-xs"
                                title="Open the dedicated Victory Month editor"
                              >
                                <Flame className="h-3.5 w-3.5" /> Open Victory Month
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => nav(`/books/${b.id}/entries`)}
                                  className="btn-ghost text-xs"
                                  title="Plain entries table"
                                >
                                  Entries
                                </button>
                                <button
                                  onClick={() => nav(`/books/${b.id}/manage`)}
                                  className="btn-primary text-xs"
                                  title="Full editor — intro, theme, search, vigils"
                                >
                                  <Sparkles className="h-3.5 w-3.5" /> Manage
                                </button>
                              </>
                            )
                          )}
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
        <BookFormModal
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
          req={req}
          toast={toast}
        />
      )}

      {editing && (
        <BookFormModal
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

// ── Create / edit form ────────────────────────────────────────────────────────
function BookFormModal({ initial, onClose, onSaved, req, toast }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    slug:            initial?.slug || '',
    title:           initial?.title || '',
    subtitle:        initial?.subtitle || '',
    description:     initial?.description || '',
    cover_image_url: initial?.cover_image_url || '',
    cover_emoji:     initial?.cover_emoji || '📖',
    accent_color:    initial?.accent_color || '#1A56DB',
    route_screen:    initial?.route_screen || 'BookReader',
    available:       initial?.available !== false,
    sort_order:      Number.isFinite(initial?.sort_order) ? initial.sort_order : 100,
    language:        initial?.language || 'en',
    translations:    initial?.translations && typeof initial.translations === 'object'
                       ? initial.translations
                       : {},
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : (e?.target?.value ?? e);
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Auto-derive slug from title on the first character if slug is still empty.
  const setTitle = (e) => {
    const title = e.target.value;
    setForm((f) => ({ ...f, title, slug: f.slug || slugify(title) }));
  };

  const submit = async () => {
    if (!form.title.trim())          return toast.error('Title is required.');
    if (!form.slug.trim() && !isEdit) return toast.error('Slug is required.');
    setSaving(true);
    try {
      const payload = { ...form, translations: compactTranslations(form.translations) };
      if (isEdit) {
        const { slug, ...patch } = payload;    // slug is immutable post-create
        await req(`/api/admin/books/${initial.id}`, 'PUT', patch);
        toast.success('Book updated.');
      } else {
        await req('/api/admin/books', 'POST', { ...payload, slug: slugify(payload.slug) });
        toast.success('Book created.');
      }
      onSaved();
    } catch (e) { toast.error(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose}
      title={isEdit ? `Edit ${initial.title}` : 'Create book'}
      sub={isEdit ? 'Update metadata. Slug cannot be changed.' : 'A new book row. Add entries afterwards.'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? (isEdit ? 'Updating…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create book')}
          </button>
        </>
      }>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Title *</label>
          <input className="input" value={form.title} onChange={setTitle} placeholder="Victory Month Prayer Bulletin 2026" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Subtitle</label>
          <input className="input" value={form.subtitle} onChange={set('subtitle')} placeholder="30-day prayer & fasting" />
        </div>
        <div>
          <label className="label">Slug *</label>
          <input
            className="input font-mono"
            value={form.slug}
            disabled={isEdit}
            onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
            placeholder="victory-month-2026"
          />
          {isEdit && <p className="mt-1 text-[11px] text-zinc-500">Slug is permanent after creation.</p>}
        </div>
        <div>
          <label className="label">Route screen</label>
          <select className="input" value={form.route_screen} onChange={set('route_screen')}>
            <option value="BookReader">BookReader (daily entries)</option>
            <option value="HomeScreen">HomeScreen (Sunday School flow)</option>
          </select>
        </div>
        <div>
          <label className="label">Cover emoji</label>
          <input className="input" value={form.cover_emoji} onChange={set('cover_emoji')} placeholder="📖" maxLength={4} />
        </div>
        <div>
          <label className="label">Accent color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.accent_color} onChange={set('accent_color')} className="h-10 w-12 cursor-pointer rounded ring-1 ring-zinc-200" />
            <input className="input" value={form.accent_color} onChange={set('accent_color')} placeholder="#1A56DB" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Cover image URL</label>
          <input className="input" value={form.cover_image_url} onChange={set('cover_image_url')} placeholder="https://… (optional)" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" value={form.description} onChange={set('description')} placeholder="What's inside this book?" />
        </div>
        <div>
          <label className="label">Sort order</label>
          <input type="number" className="input" value={form.sort_order} onChange={set('sort_order')} />
        </div>
        <div>
          <label className="label">Language</label>
          <input className="input" value={form.language} onChange={set('language')} placeholder="en" />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.available} onChange={set('available')} />
            <span>Available — visible to users in the mobile app library</span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <TranslationFields
            fields={[
              { key: 'title',       label: 'Title',       type: 'text' },
              { key: 'subtitle',    label: 'Subtitle',    type: 'text' },
              { key: 'description', label: 'Description', type: 'textarea', minH: 80 },
            ]}
            english={form}
            value={form.translations}
            onChange={(next) => setForm((f) => ({ ...f, translations: next }))}
          />
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
