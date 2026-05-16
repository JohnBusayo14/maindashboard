import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, BookOpen, RefreshCcw, Save } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';

// Known plan metadata. Plan IDs that the backend returns but aren't in this
// map still render via the generic fallback in metaFor() — so adding a new
// book SKU on the server doesn't require touching the dashboard.
const PLAN_META = {
  single: { label: 'Single Category', tag: 'POPULAR',    accent: 'from-brand-50 to-white',   pill: 'text-brand-700  bg-brand-50',    sub: 'Access one age group of the learner’s choice.' },
  all:    { label: 'All Categories',  tag: 'BEST VALUE', accent: 'from-violet-50 to-white',  pill: 'text-violet-700 bg-violet-50',   sub: 'Unlocks every age group at a single price.' },
  book_victory_month_prayer: {
    label: 'Victory Month Prayer Book',
    tag:   'BOOK',
    accent:'from-amber-50 to-white',
    pill:  'text-amber-700 bg-amber-50',
    sub:   'One-time purchase to unlock the 30 daily prayers and group vigils in the Victory Month Prayer book.',
  },
};

// Fallback for unknown plan IDs (so a new book_* row on the server still
// renders without code changes). Prettifies the id into a title — e.g.,
// 'book_fasting_guide' → 'Book · Fasting Guide'.
function metaFor(id) {
  if (PLAN_META[id]) return PLAN_META[id];
  const isBook = id?.startsWith('book_');
  const pretty = (id || '')
    .replace(/^book_/, '')
    .split('_').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return {
    label: isBook ? pretty : id,
    tag:   isBook ? 'BOOK' : 'PLAN',
    accent:'from-zinc-50 to-white',
    pill:  'text-zinc-700 bg-zinc-100',
    sub:   isBook
      ? 'One-time purchase to unlock this book in the mobile app.'
      : 'Subscription plan.',
  };
}

// Stable ordering: subscription tiers first, then book SKUs alphabetised so
// the layout is predictable as new books are added.
function sortPlans(ids) {
  const TIER_ORDER = ['single', 'all'];
  const tiers = ids.filter((id) => TIER_ORDER.includes(id))
    .sort((a, b) => TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b));
  const books = ids.filter((id) => id.startsWith('book_')).sort();
  const other = ids.filter((id) => !TIER_ORDER.includes(id) && !id.startsWith('book_')).sort();
  return [...tiers, ...books, ...other];
}

export default function Pricing() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [plans, setPlans]     = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/subscription/plans');
      const map  = {};
      // Backend returns either an object map { single: {...}, all: {...} } or an array.
      if (Array.isArray(data)) {
        data.forEach((p) => { map[p.id || p.plan_id || p.plan] = p; });
      } else {
        Object.assign(map, data);
      }
      setPlans(map);
    } catch (e) {
      toast.error(e.message || 'Failed to load pricing.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Commerce</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Subscription pricing</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Prices show on the in-app payment screen. Stored in kobo (1/100 of a Naira).
          </p>
        </div>
        <button onClick={load} className="btn-ghost" disabled={loading}>
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortPlans(Object.keys(plans || {})).map((id) => (
          <PlanCard
            key={id}
            id={id}
            plan={plans[id] || {}}
            loading={loading}
            onSaved={load}
            req={req}
            toast={toast}
          />
        ))}
        {!loading && Object.keys(plans || {}).length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
            No subscription plans found. The backend seeds the default tiers on first boot — try Refresh.
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ id, plan, loading, onSaved, req, toast }) {
  const meta = metaFor(id);
  const isBook = id?.startsWith('book_');
  const [naira, setNaira] = useState('');
  const [usd,   setUsd]   = useState('');
  const [days, setDays]   = useState('');
  const [saving, setSaving] = useState(false);

  // Sync local form when the plan loads
  useEffect(() => {
    if (plan?.price_kobo      != null) setNaira(String(Math.round(plan.price_kobo / 100)));
    if (plan?.price_usd_cents != null) setUsd(plan.price_usd_cents > 0 ? (plan.price_usd_cents / 100).toFixed(2) : '');
    if (plan?.days != null)            setDays(String(plan.days));
  }, [plan?.price_kobo, plan?.price_usd_cents, plan?.days]);

  // Normalise the USD input — accept "5", "5.00", "5.5", and reject anything
  // that wouldn't be representable as an integer number of cents.
  const usdCents = usd === ''
    ? 0
    : Math.round(parseFloat(usd) * 100);

  const dirty =
    naira !== '' && days !== '' &&
    (parseInt(naira, 10) * 100 !== plan.price_kobo
     || parseInt(days, 10) !== plan.days
     || usdCents !== (plan.price_usd_cents || 0));

  const submit = async (e) => {
    e.preventDefault();
    const n = parseInt(naira, 10);
    const d = parseInt(days, 10);
    if (!n || n < 100) return toast.error('Naira price must be at least ₦100.');
    if (!d || d < 1)   return toast.error('Duration must be at least 1 day.');
    if (usd !== '' && (!Number.isFinite(usdCents) || usdCents < 50)) {
      return toast.error('USD price must be at least $0.50 (Stripe minimum) or left blank.');
    }
    setSaving(true);
    try {
      await req(`/api/admin/subscription/plans/${id}`, 'PUT', {
        price_kobo:      n * 100,
        days:            d,
        // Always send the USD value (0 means "no Stripe checkout for this plan")
        price_usd_cents: usdCents,
      });
      toast.success(`${meta.label} updated.`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={`card overflow-hidden bg-gradient-to-br ${meta.accent}`}>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${meta.pill}`}>
            {meta.tag}
          </span>
          {isBook
            ? <BookOpen className="h-4 w-4 text-zinc-400" />
            : <DollarSign className="h-4 w-4 text-zinc-400" />}
        </div>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-ink">{meta.label}</h2>
        <p className="mt-1 text-sm text-zinc-500">{meta.sub}</p>
        <p className="mt-1 text-[11px] font-mono text-zinc-400">{id}</p>
      </div>

      <div className="border-t border-zinc-100 bg-white p-5">
        {loading ? (
          <Skeleton lines={2} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price (₦)</label>
              <input
                type="number"
                min="100"
                step="50"
                className="input tabular"
                value={naira}
                onChange={(e) => setNaira(e.target.value)}
              />
              <p className="mt-1 text-[10.5px] text-zinc-500">Paystack &amp; Flutterwave charge this amount.</p>
            </div>
            <div>
              <label className="label">Duration (days)</label>
              <input
                type="number"
                min="1"
                className="input tabular"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="label">Price ($) — Stripe checkout for international users</label>
              <input
                type="number"
                min="0"
                step="0.50"
                className="input tabular"
                placeholder="Leave blank to disable Stripe for this plan"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
              />
              <p className="mt-1 text-[10.5px] text-zinc-500">
                Stripe minimum is $0.50. Set to 0 / blank to hide the Stripe option at checkout for this plan.
              </p>
            </div>
            <div className="col-span-2">
              <button type="submit" className="btn-primary w-full" disabled={!dirty || saving}>
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'No changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

function Skeleton({ lines = 4 }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded bg-zinc-100" />
      ))}
    </div>
  );
}
