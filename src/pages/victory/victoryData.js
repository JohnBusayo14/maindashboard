// src/pages/victory/victoryData.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin data layer for the Victory Month Prayer book.
//
// Source of truth is the backend (`books` + `book_entries` tables). Previous
// versions of this file kept content in localStorage — that's gone; every
// helper here now talks to the API via the `req` function the calling page
// gets from `useAuth() + makeReq(api, key)`.
//
// API surface used:
//   GET    /api/books/:slug                 → book row (used for meta)
//   GET    /api/books/:slug/entries         → list of entries (light)
//   GET    /api/books/:slug/entries/:n?type → single entry (full body)
//   PUT    /api/admin/books/:id             → update meta
//   POST   /api/admin/books/:id/entries     → upsert one entry
//   DELETE /api/admin/books/:id/entries/:n  → delete one entry
//   POST   /api/admin/books/:slug/seed      → bulk upsert
// ─────────────────────────────────────────────────────────────────────────────

// Canonical slug for the Victory Month book. The actual DB row is
// "Victory Month Prayer Bulletin 2026" — this constant must match its slug
// so /victory and the mobile app read from the row that has the 37 entries.
export const VICTORY_BOOK_SLUG = 'victory-month-2026';

// ── Default metadata shown in the editor before the row loads ───────────────
// Kept in sync with the bundled frontend data so the admin sees the right copy
// even on a fresh DB. The real values come from the backend after first load.
export const SEED_META = {
  year:        2026,
  theme:       'Season of True Revival & Great Exploits',
  window:      'January 2 – 31, 2026',
  organisation:"The Gospel Faith Mission Int'l (GOFAMINT) — North America",
  pages:       125,
};

export const GROUP_OPTIONS = ['Family', 'Youth', 'Women', 'Men', 'General'];

// Accent colour per group — matches the frontend so admins see roughly what
// the user sees on the mobile app.
export const GROUP_ACCENT = {
  Family:  '#1A56DB',
  Youth:   '#4F46E5',
  Women:   '#DB2777',
  Men:     '#0F766E',
  General: '#7C3AED',
};

// Map a backend group string → entry_type (and back). The DB stores the
// entry_type column as 'family_vigil', 'youth_vigil', etc.; the admin UI
// works in the human-readable form ('Family', 'Youth', …).
export const ENTRY_TYPE_BY_GROUP = {
  Family:  'family_vigil',
  Youth:   'youth_vigil',
  Women:   'women_vigil',
  Men:     'men_vigil',
  General: 'general_vigil',
};
export const GROUP_BY_ENTRY_TYPE = Object.fromEntries(
  Object.entries(ENTRY_TYPE_BY_GROUP).map(([g, t]) => [t, g]),
);

const VIGIL_TYPES = new Set(Object.values(ENTRY_TYPE_BY_GROUP));

// ── Shape mappers (DB row ⇄ admin form) ─────────────────────────────────────
// The admin UI was written for the frontend shape (focus / scripture /
// message / prayer_points / intercession / discussion). The backend uses
// focus / scripture_text / inspirational_message / prayer_points /
// special_intercession / discussion_questions. We translate at the boundary
// so the editors don't have to know.

// Translations on the DB row store the BACKEND field names (focus,
// scripture_text, inspirational_message, prayer_points, special_intercession,
// discussion_questions). The admin UI uses the FRONTEND names (focus,
// scripture, message, prayer_points, intercession, discussion). When mapping
// to/from the row we remap the keys so the editor always sees the UI shape.
const TRANSLATION_KEYS_DAY = {
  focus:        'focus',
  scripture:    'scripture_text',
  message:      'inspirational_message',
  prayer_points:'prayer_points',
  intercession: 'special_intercession',
};

const translationsRowToUi = (rowTranslations, map) => {
  const t = rowTranslations || {};
  const out = {};
  for (const [lang, block] of Object.entries(t)) {
    const blk = {};
    for (const [uiKey, rowKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(block, rowKey)) {
        blk[uiKey] = block[rowKey];
      }
    }
    if (Object.keys(blk).length) out[lang] = blk;
  }
  return out;
};

const translationsUiToRow = (uiTranslations, map) => {
  const t = uiTranslations || {};
  const out = {};
  for (const [lang, block] of Object.entries(t)) {
    const blk = {};
    for (const [uiKey, rowKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(block, uiKey)) {
        blk[rowKey] = block[uiKey];
      }
    }
    if (Object.keys(blk).length) out[lang] = blk;
  }
  return out;
};

const rowToDay = (row) => ({
  day:           Number(row.entry_number),
  date:          row.entry_date ? String(row.entry_date).slice(0, 10) : '',
  focus:         row.focus || '',
  scripture:     row.scripture_text || '',
  message:       row.inspirational_message || '',
  prayer_points: Array.isArray(row.prayer_points) ? row.prayer_points : [],
  intercession:  row.special_intercession || '',
  published:     row.published !== false,
  translations:  translationsRowToUi(row.translations, TRANSLATION_KEYS_DAY),
});

const dayToRow = (d) => ({
  entry_number:          Number(d.day),
  entry_type:            'daily',
  entry_date:            d.date || null,
  focus:                 d.focus || '',
  scripture_text:        d.scripture || '',
  inspirational_message: d.message || '',
  prayer_points:         Array.isArray(d.prayer_points) ? d.prayer_points : [],
  special_intercession:  d.intercession || '',
  translations:          translationsUiToRow(d.translations, TRANSLATION_KEYS_DAY),
});

// Vigils don't have a natural numeric primary key in the admin UI; the admin
// id is 'family-1', 'youth', etc. We carry the DB entry_number along on the
// admin object so saveVigil knows which row to upsert.
const idForVigil = (group, n) => {
  const g = String(group || '').toLowerCase();
  return g === 'family' ? `family-${n}` : g;
};

// Vigils have an extra `discussion` array that days don't.
const TRANSLATION_KEYS_VIGIL = {
  focus:        'focus',
  scripture:    'scripture_text',
  message:      'inspirational_message',
  prayer_points:'prayer_points',
  discussion:   'discussion_questions',
};

const rowToVigil = (row) => {
  const group = GROUP_BY_ENTRY_TYPE[row.entry_type] || 'General';
  return {
    id:            idForVigil(group, row.entry_number),
    group,
    title:         `${group} Vigil${row.entry_number > 1 ? ' ' + row.entry_number : ''}`,
    entry_number:  Number(row.entry_number),
    date:          row.entry_date ? String(row.entry_date).slice(0, 10) : '',
    focus:         row.focus || '',
    scripture:     row.scripture_text || '',
    message:       row.inspirational_message || '',
    discussion:    Array.isArray(row.discussion_questions) ? row.discussion_questions : [],
    prayer_points: Array.isArray(row.prayer_points) ? row.prayer_points : [],
    published:     row.published !== false,
    translations:  translationsRowToUi(row.translations, TRANSLATION_KEYS_VIGIL),
  };
};

const vigilToRow = (v) => ({
  entry_number:          Number(v.entry_number || 1),
  entry_type:            ENTRY_TYPE_BY_GROUP[v.group] || 'general_vigil',
  entry_date:            v.date || null,
  focus:                 v.focus || '',
  scripture_text:        v.scripture || '',
  inspirational_message: v.message || '',
  prayer_points:         Array.isArray(v.prayer_points) ? v.prayer_points : [],
  discussion_questions:  Array.isArray(v.discussion) ? v.discussion : [],
  translations:          translationsUiToRow(v.translations, TRANSLATION_KEYS_VIGIL),
});

// ── Public async helpers ────────────────────────────────────────────────────
// Every call site must pass the bound `req` (from useAuth + makeReq). Throwing
// on network errors is left to the caller — the editors already wrap in
// try/catch + toast.

export const loadMeta = async (req) => {
  const book = await req(`/api/books/${VICTORY_BOOK_SLUG}`);
  return {
    ...SEED_META,
    // Theme lives in `subtitle` for now (the books table has no `theme` column
    // — when we add one, swap this line and the saveMeta payload).
    theme:      book?.subtitle || SEED_META.theme,
    cover_url:  book?.cover_image_url || '',
    cover_emoji:book?.cover_emoji || '🕊️',
    accent:     book?.accent_color || '#F97316',
    bookId:     book?.id,
  };
};

export const saveMeta = async (req, meta) => {
  if (!meta?.bookId) throw new Error('Missing bookId — load meta first.');
  return req(`/api/admin/books/${meta.bookId}`, 'PUT', {
    subtitle:        meta.theme || null,
    cover_image_url: meta.cover_url || null,
    cover_emoji:     meta.cover_emoji || '🕊️',
    accent_color:    meta.accent || '#F97316',
  });
};

export const loadDays = async (req) => {
  const data = await req(`/api/books/${VICTORY_BOOK_SLUG}/entries`);
  const rows = Array.isArray(data?.entries) ? data.entries : [];
  return rows
    .filter((r) => !VIGIL_TYPES.has(r.entry_type))
    .map(rowToDay)
    .sort((a, b) => a.day - b.day);
};

export const loadDay = async (req, n) => {
  const row = await req(`/api/books/${VICTORY_BOOK_SLUG}/entries/${n}?type=daily`);
  return rowToDay(row);
};

export const saveDay = async (req, bookId, day) => {
  return req(`/api/admin/books/${bookId}/entries`, 'POST', dayToRow(day));
};

export const deleteDay = async (req, bookId, dayNum) => {
  return req(`/api/admin/books/${bookId}/entries/${dayNum}?type=daily`, 'DELETE');
};

export const loadVigils = async (req) => {
  const data = await req(`/api/books/${VICTORY_BOOK_SLUG}/entries`);
  const rows = Array.isArray(data?.entries) ? data.entries : [];
  return rows
    .filter((r) => VIGIL_TYPES.has(r.entry_type))
    .map(rowToVigil)
    .sort((a, b) => {
      // Family vigils first (1..n), then alphabetical group order.
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.entry_number - b.entry_number;
    });
};

export const loadVigil = async (req, vigil) => {
  // `vigil` here is the admin object (id + entry_number + group). Pull the
  // full body from the entry endpoint using its entry_type + entry_number.
  const type = ENTRY_TYPE_BY_GROUP[vigil.group] || 'general_vigil';
  const row  = await req(
    `/api/books/${VICTORY_BOOK_SLUG}/entries/${vigil.entry_number}?type=${type}`,
  );
  return rowToVigil(row);
};

export const saveVigil = async (req, bookId, vigil) => {
  return req(`/api/admin/books/${bookId}/entries`, 'POST', vigilToRow(vigil));
};

export const deleteVigil = async (req, bookId, vigil) => {
  const type = ENTRY_TYPE_BY_GROUP[vigil.group] || 'general_vigil';
  return req(
    `/api/admin/books/${bookId}/entries/${vigil.entry_number}?type=${type}`,
    'DELETE',
  );
};

// ── Bulk seed (caller supplies the data) ────────────────────────────────────
// Accepts an array of day objects + vigil objects (admin-shape) and POSTs them
// to the bulk endpoint. The caller is responsible for sourcing the data —
// e.g. importing a JSON file dropped by the team's content editor, or
// re-running `backend/scripts/seed-victory-month.js` from the server. We do
// NOT bake the 1,000+ lines of bundled content into the admin bundle.
export const seedBulk = async (req, { days = [], vigils = [], meta }) => {
  const entries = [
    ...days.map((d, i) => ({
      ...dayToRow(d),
      entry_number: d.day || (i + 1),
      sort_order:   d.day || (i + 1),
    })),
    ...vigils.map((v, i) => ({
      ...vigilToRow(v),
      sort_order: 100 + i,
    })),
  ];
  return req(`/api/admin/books/${VICTORY_BOOK_SLUG}/seed`, 'POST', { entries, meta });
};

// ── Stats helper for the dashboard summary card ─────────────────────────────
export const stats = (days = [], vigils = []) => ({
  daysTotal:          days.length,
  daysPublished:      days.filter((d) => d.published !== false).length,
  daysWithContent:    days.filter((d) =>
    !!(d.message || (d.prayer_points && d.prayer_points.length)),
  ).length,
  vigilsTotal:        vigils.length,
  vigilsWithContent:  vigils.filter((v) =>
    !!(v.message || (v.prayer_points && v.prayer_points.length) || (v.discussion && v.discussion.length)),
  ).length,
});
