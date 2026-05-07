import { useCallback, useEffect, useMemo, useState } from 'react';
import { Library, BookOpen, CreditCard, Trophy, ArrowUpRight, RefreshCcw } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';

const CAT_META = {
  adult:        { label: 'Adult Class',        color: '#7C3AED' },
  youth:        { label: 'Youth Class',        color: '#1A56DB' },
  intermediate: { label: 'Intermediate Class', color: '#10B981' },
  children:     { label: "Children's Class",   color: '#F97316' },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const daysLeft = (exp) => {
  if (!exp) return null;
  return Math.ceil((new Date(exp) - new Date()) / 86400000);
};

export default function Dashboard() {
  const { api, key } = useAuth();
  const req = useMemo(() => makeReq(api, key), [api, key]);

  const [loading, setLoading]   = useState(true);
  const [units, setUnits]       = useState([]);
  const [lessons, setLessons]   = useState([]);
  const [subs, setSubs]         = useState([]);
  const [board, setBoard]       = useState([]);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Pull units across all 4 categories, then lessons under each unit.
      const cats = ['adult', 'youth', 'intermediate', 'children'];
      const unitsByCat = await Promise.all(
        cats.map((c) => req(`/api/units?category=${c}`).catch(() => [])),
      );
      const allUnits = unitsByCat.flat();
      setUnits(allUnits);

      const lessonChunks = await Promise.all(
        allUnits.map((u) => req(`/api/units/${u.id}/lessons`).catch(() => [])),
      );
      setLessons(lessonChunks.flat());

      const [subsRes, lbRes] = await Promise.all([
        req('/api/subscribers').catch(() => ({ subscribers: [] })),
        req('/api/leaderboard?limit=50').catch(() => []),
      ]);
      setSubs(subsRes.subscribers || []);
      setBoard(Array.isArray(lbRes) ? lbRes : []);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [req]);

  useEffect(() => { load(); }, [load]);

  const activeSubs = subs.filter(
    (s) => s.is_active && new Date(s.expiry_date) > new Date(),
  );

  const unitsByCat = useMemo(() => {
    const m = {};
    units.forEach((u) => {
      const c = u.category_id || 'adult';
      (m[c] ||= []).push(u);
    });
    return m;
  }, [units]);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      {/* Page heading */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Overview</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
        </div>
        <button onClick={load} className="btn-ghost" disabled={loading}>
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Library}
          label="Units"
          value={units.length}
          accent="text-violet-600"
          loading={loading}
        />
        <Stat
          icon={BookOpen}
          label="Lessons"
          value={lessons.length}
          accent="text-brand-600"
          loading={loading}
        />
        <Stat
          icon={CreditCard}
          label="Active subscribers"
          value={activeSubs.length}
          hint={`of ${subs.length} total`}
          accent="text-emerald-600"
          loading={loading}
        />
        <Stat
          icon={Trophy}
          label="Learners on leaderboard"
          value={board.length}
          accent="text-amber-600"
          loading={loading}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}

      {/* Two-column body */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Units by category */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Units by category</h2>
            <span className="text-xs text-zinc-500">{units.length} total</span>
          </div>

          {loading ? (
            <Skeleton lines={6} />
          ) : units.length === 0 ? (
            <Empty icon="📚" text="No units yet" />
          ) : (
            <div className="divide-y divide-zinc-100">
              {Object.entries(unitsByCat).map(([cid, list]) => {
                const meta = CAT_META[cid] || { label: cid, color: '#64748B' };
                return (
                  <div key={cid} className="py-3 first:pt-0 last:pb-0">
                    <div
                      className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {list.map((u) => (
                        <div key={u.id} className="flex items-center justify-between text-sm">
                          <span className="truncate font-medium text-ink">{u.title}</span>
                          <code className="text-[11px] text-zinc-500">{u.id}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top learners */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Top learners</h2>
            <a className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5">
              View all <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>

          {loading ? (
            <Skeleton lines={5} />
          ) : board.length === 0 ? (
            <Empty icon="🏆" text="No scores yet" />
          ) : (
            <div className="flex flex-col">
              {board.slice(0, 5).map((r, i) => (
                <div
                  key={r.email}
                  className="flex items-center gap-3 border-b border-zinc-100 py-2.5 last:border-0"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {r.rank || i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">
                      {r.display_name || r.email.split('@')[0]}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">{r.email}</div>
                  </div>
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    ⭐ {r.total_points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent subscribers */}
      <div className="mt-4 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
          <h2 className="text-[15px] font-semibold text-ink">Recent subscribers</h2>
          <span className="text-xs text-zinc-500">
            {activeSubs.length} active · {subs.length} total
          </span>
        </div>
        {loading ? (
          <div className="p-5"><Skeleton lines={5} /></div>
        ) : subs.length === 0 ? (
          <div className="p-5"><Empty icon="💳" text="No subscribers yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5">Email</th>
                  <th className="px-5 py-2.5">Category</th>
                  <th className="px-5 py-2.5">Plan</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Expires</th>
                  <th className="px-5 py-2.5">Days left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {subs.slice(0, 8).map((s) => {
                  const dl = daysLeft(s.expiry_date);
                  const active = s.is_active && dl > 0;
                  return (
                    <tr key={s.email}>
                      <td className="px-5 py-2.5 font-semibold text-ink">{s.email}</td>
                      <td className="px-5 py-2.5">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                          {s.subscribed_category || 'adult'}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                          {s.plan_type || 'single'}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        {active ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                        ) : (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Expired</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-zinc-500">{fmtDate(s.expiry_date)}</td>
                      <td className="px-5 py-2.5 text-zinc-500">{dl ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, accent = 'text-brand-600', loading }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="mt-3 text-[28px] font-bold tracking-tight text-ink tabular">
        {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-zinc-100" /> : value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
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

function Empty({ icon, text }) {
  return (
    <div className="py-10 text-center">
      <div className="text-3xl">{icon}</div>
      <div className="mt-2 text-sm font-medium text-zinc-500">{text}</div>
    </div>
  );
}
