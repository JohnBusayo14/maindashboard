import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, RefreshCcw, CreditCard, Search } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const daysLeft = (exp) => {
  if (!exp) return null;
  return Math.ceil((new Date(exp) - new Date()) / 86400000);
};

const CAT_PILL = {
  adult:        'violet',
  youth:        'blue',
  intermediate: 'teal',
  children:     'orange',
  all:          'blue',
};

const CATEGORIES = [
  { id: 'adult',        label: 'Adult' },
  { id: 'youth',        label: 'Youth' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'children',     label: 'Children' },
  { id: 'all',          label: 'All categories' },
];

// Pretty-print a book SKU slug for the per-book pills. Falls back to a
// title-cased version of the slug so books added later still read cleanly
// without a code change here.
const BOOK_LABELS = {
  all:                  'All books',
  victory_month_prayer: 'Victory Month',
  sunday_school:        'Sunday School',
  teacher_manual:       'Teacher Manual',
};
const bookLabel = (slug) =>
  BOOK_LABELS[slug] ||
  String(slug || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Distinct pill colour per book so each subscription reads differently at a
// glance. Unknown slugs cycle through a small palette by hash.
const BOOK_PILL = {
  all:                  'green',
  victory_month_prayer: 'orange',
  sunday_school:        'blue',
  teacher_manual:       'teal',
};
const PILL_CYCLE = ['violet', 'teal', 'amber', 'blue', 'orange'];
const bookPill = (slug) => {
  if (BOOK_PILL[slug]) return BOOK_PILL[slug];
  let h = 0;
  for (const ch of String(slug)) h = (h + ch.charCodeAt(0)) % PILL_CYCLE.length;
  return PILL_CYCLE[h];
};

export default function Subscribers() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('all');     // all | active | expired
  const [bookFilter, setBookFilter] = useState('all'); // all | trial | <book slug>
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/subscribers');
      setRows(data?.subscribers || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load subscribers.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  // subscribed_books arrives as an array (server parses it); be defensive in
  // case an older payload sends the raw comma string.
  const booksOf = (s) =>
    Array.isArray(s.subscribed_books)
      ? s.subscribed_books
      : String(s.subscribed_books || '').split(',').map((x) => x.trim()).filter(Boolean);

  // The set of distinct book SKUs present across all subscribers, for the
  // per-book filter chips. Always offers 'all' + 'trial' shortcuts up front.
  const bookOptions = useMemo(() => {
    const set = new Set();
    for (const s of rows) for (const b of booksOf(s)) set.add(b);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((s) => {
      const dl = daysLeft(s.expiry_date);
      const active = s.is_active && dl > 0;
      if (filter === 'active'  && !active) return false;
      if (filter === 'expired' &&  active) return false;
      if (term && !s.email?.toLowerCase().includes(term)) return false;
      // Per-book / trial filter
      if (bookFilter === 'trial' && !s.is_trial) return false;
      if (bookFilter !== 'all' && bookFilter !== 'trial') {
        const books = booksOf(s);
        if (!books.includes(bookFilter) && !books.includes('all')) return false;
      }
      return true;
    });
  }, [rows, q, filter, bookFilter]);

  const onRevoke = async (email) => {
    if (!confirm(`Revoke access for ${email}?`)) return;
    try {
      await req(`/api/revoke/${encodeURIComponent(email)}`, 'DELETE');
      toast.success('Access revoked.');
      load();
    } catch (e) {
      toast.error(e.message || 'Revoke failed.');
    }
  };

  const stats = useMemo(() => {
    const active = rows.filter((s) => s.is_active && daysLeft(s.expiry_date) > 0).length;
    const trial  = rows.filter((s) => s.is_trial && daysLeft(s.expiry_date) > 0).length;
    return { total: rows.length, active, expired: rows.length - active, trial };
  }, [rows]);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Commerce</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Subscribers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Granting access here bypasses Paystack — useful for comps, staff, and refunds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setGranting(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Grant access
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} accent="text-emerald-600" />
        <Stat label="On trial" value={stats.trial} accent="text-amber-600" />
        <Stat label="Expired" value={stats.expired} accent="text-zinc-500" />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg ring-1 ring-zinc-200 bg-white p-0.5 text-sm">
          {['all', 'active', 'expired'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 font-semibold capitalize transition ${
                filter === f ? 'bg-zinc-100 text-ink' : 'text-zinc-500 hover:text-ink'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-500">{filtered.length} of {rows.length}</span>
      </div>

      {/* Per-book / trial filter chips — lets the admin slice subscribers by
          which book they own, or just the free-trial cohort. */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Book</span>
        {[
          { id: 'all',   label: 'All' },
          { id: 'trial', label: 'Free trial' },
          ...bookOptions.map((b) => ({ id: b, label: bookLabel(b) })),
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setBookFilter(opt.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              bookFilter === opt.id
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {rows.length === 0 ? 'No subscribers yet' : 'No subscribers match'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5">Email</th>
                  <th className="px-5 py-2.5">Category</th>
                  <th className="px-5 py-2.5">Plan</th>
                  <th className="px-5 py-2.5">Books</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Expires</th>
                  <th className="px-5 py-2.5 text-right">Days</th>
                  <th className="px-5 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((s) => {
                  const dl = daysLeft(s.expiry_date);
                  const active = s.is_active && dl > 0;
                  return (
                    <tr key={s.email} className="hover:bg-zinc-25">
                      <td className="px-5 py-2.5 font-semibold text-ink">{s.email}</td>
                      <td className="px-5 py-2.5">
                        <Badge variant={CAT_PILL[s.subscribed_category] || 'zinc'}>
                          {s.subscribed_category || 'adult'}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge variant="blue">{s.plan_type || 'single'}</Badge>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {s.is_trial && <Badge variant="amber">Trial</Badge>}
                          {(() => {
                            const books = booksOf(s);
                            if (!books.length) {
                              return s.is_trial ? null : <span className="text-xs text-zinc-400">—</span>;
                            }
                            return books.map((b) => (
                              <Badge key={b} variant={bookPill(b)}>{bookLabel(b)}</Badge>
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        {active ? <Badge variant="green">Active</Badge> : <Badge variant="red">Expired</Badge>}
                      </td>
                      <td className="px-5 py-2.5 text-zinc-500">{fmtDate(s.expiry_date)}</td>
                      <td className="px-5 py-2.5 text-right text-zinc-700">{dl ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        <button
                          onClick={() => onRevoke(s.email)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                          title="Revoke"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {granting && (
        <GrantModal
          onClose={() => setGranting(false)}
          onSaved={() => { setGranting(false); load(); }}
          req={req}
          toast={toast}
        />
      )}
    </div>
  );
}

function GrantModal({ onClose, onSaved, req, toast }) {
  const [email, setEmail]       = useState('');
  const [days, setDays]         = useState(300);
  const [category, setCategory] = useState('all');
  const [plan, setPlan]         = useState('all');
  const [saving, setSaving]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error('Enter a valid email.');
    }
    if (!days || days < 1) return toast.error('Days must be at least 1.');

    setSaving(true);
    try {
      const expiry = new Date(Date.now() + days * 86400000);
      await req('/api/admin/grant-access', 'POST', {
        email:                email.trim().toLowerCase(),
        days:                 parseInt(days, 10),
        reference:            `MANUAL_${Date.now()}`,
        expiry_date:          expiry.toISOString(),
        subscribed_category:  category,
        plan_type:            plan,
      });
      toast.success(`Granted ${days} days to ${email}.`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Grant failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Grant access"
      sub="Bypasses Paystack. Existing subscribers get extended; new emails are created."
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Granting…' : 'Grant access'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="label">Days</label>
          <input
            type="number"
            min="1"
            className="input tabular"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Plan</label>
          <select
            className="input"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="single">Single</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Category</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}

function Stat({ label, value, accent = 'text-ink' }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular ${accent}`}>{value}</div>
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
