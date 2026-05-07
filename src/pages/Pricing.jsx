import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, RefreshCcw, Save } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const PLAN_META = {
  single: { label: 'Single Category', tag: 'POPULAR',    accent: 'from-brand-50 to-white',   ring: 'ring-brand-100',   pill: 'text-brand-700  bg-brand-50',    sub: 'Access one age group of the learner’s choice.' },
  all:    { label: 'All Categories',  tag: 'BEST VALUE', accent: 'from-violet-50 to-white',  ring: 'ring-violet-100',  pill: 'text-violet-700 bg-violet-50',   sub: 'Unlocks every age group at a single price.' },
};

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {['single', 'all'].map((id) => (
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
      </div>
    </div>
  );
}

function PlanCard({ id, plan, loading, onSaved, req, toast }) {
  const meta = PLAN_META[id];
  const [naira, setNaira] = useState('');
  const [days, setDays]   = useState('');
  const [saving, setSaving] = useState(false);

  // Sync local form when the plan loads
  useEffect(() => {
    if (plan?.price_kobo != null) setNaira(String(Math.round(plan.price_kobo / 100)));
    if (plan?.days != null)       setDays(String(plan.days));
  }, [plan?.price_kobo, plan?.days]);

  const dirty =
    naira !== '' && days !== '' &&
    (parseInt(naira, 10) * 100 !== plan.price_kobo || parseInt(days, 10) !== plan.days);

  const submit = async (e) => {
    e.preventDefault();
    const n = parseInt(naira, 10);
    const d = parseInt(days, 10);
    if (!n || n < 100) return toast.error('Price must be at least ₦100.');
    if (!d || d < 1)   return toast.error('Duration must be at least 1 day.');
    setSaving(true);
    try {
      await req(`/api/admin/subscription/plans/${id}`, 'PUT', { price_kobo: n * 100, days: d });
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
          <DollarSign className="h-4 w-4 text-zinc-400" />
        </div>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-ink">{meta.label}</h2>
        <p className="mt-1 text-sm text-zinc-500">{meta.sub}</p>
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
