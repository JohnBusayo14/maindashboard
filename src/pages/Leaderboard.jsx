import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trophy, RefreshCcw, Crown, Search } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const fmtRel = (d) => {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60)         return 'just now';
  if (diff < 3600)       return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 2592000)    return `${Math.floor(diff / 86400)} d ago`;
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

const RANK_BG = {
  1: 'bg-amber-400 text-white',
  2: 'bg-zinc-300 text-ink',
  3: 'bg-amber-700 text-white',
};

export default function Leaderboard() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/leaderboard?limit=100');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.email?.toLowerCase().includes(term) || r.display_name?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const podium = rows.slice(0, 3);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Insights</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Leaderboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Top learners ranked by total quiz points. Read-only — points are awarded by the app.
          </p>
        </div>
        <button onClick={load} className="btn-ghost" disabled={loading}>
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Podium */}
      {!loading && podium.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {podium.map((p, i) => (
            <div
              key={p.email}
              className={`card p-4 ${i === 0 ? 'ring-2 ring-amber-300' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${RANK_BG[i + 1]}`}>
                  {i === 0 ? <Crown className="h-5 w-5" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{p.display_name || p.email.split('@')[0]}</div>
                  <div className="truncate text-xs text-zinc-500">{p.email}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Points</div>
                  <div className="mt-0.5 text-lg font-bold tabular text-amber-600">⭐ {p.total_points}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Lessons</div>
                  <div className="mt-0.5 text-lg font-bold tabular text-ink">{p.lessons_completed}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <span className="text-xs text-zinc-500">{filtered.length} of {rows.length}</span>
      </div>

      {/* Full table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {rows.length === 0 ? 'No scores yet' : 'No learners match'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5 w-16">Rank</th>
                  <th className="px-5 py-2.5">Learner</th>
                  <th className="px-5 py-2.5 text-right">Points</th>
                  <th className="px-5 py-2.5 text-right">Lessons</th>
                  <th className="px-5 py-2.5 text-right">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((r) => (
                  <tr key={r.email} className="hover:bg-zinc-25">
                    <td className="px-5 py-2.5">
                      <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        RANK_BG[r.rank] || 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {r.rank}
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{r.avatar_emoji || '👤'}</span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">{r.display_name || r.email.split('@')[0]}</div>
                          <div className="truncate text-[11px] text-zinc-500">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold text-amber-600">⭐ {r.total_points}</td>
                    <td className="px-5 py-2.5 text-right text-zinc-700">{r.lessons_completed}</td>
                    <td className="px-5 py-2.5 text-right text-zinc-500">{fmtRel(r.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
