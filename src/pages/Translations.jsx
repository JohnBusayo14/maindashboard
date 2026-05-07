import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Languages, RefreshCcw, Sprout, Search, Check } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Badge from '../components/Badge.jsx';
import { TRANS_LANGS, TRANS_KEYS, ALL_TRANS_KEY_NAMES } from '../constants.js';

export default function Translations() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [lang, setLang]       = useState('yo');
  const [data, setData]       = useState({});         // saved translations { key: value }
  const [drafts, setDrafts]   = useState({});         // unsaved buffer { key: value }
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [q, setQ]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await req(`/api/translations/${lang}`);
      setData(d?.translations || {});
      setDrafts({});
    } catch (e) {
      setData({});
      toast.error(e.message || 'Failed to load translations.');
    } finally {
      setLoading(false);
    }
  }, [req, lang, toast]);

  useEffect(() => { load(); }, [load]);

  const saved = (k) => data[k] && data[k].trim();

  const totals = useMemo(() => {
    const total  = ALL_TRANS_KEY_NAMES.length;
    const filled = ALL_TRANS_KEY_NAMES.filter(saved).length;
    const pct    = total ? Math.round((filled / total) * 100) : 0;
    return { total, filled, pct };
  }, [data]);

  const filteredGroups = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return TRANS_KEYS;
    const out = {};
    for (const [group, items] of Object.entries(TRANS_KEYS)) {
      const matched = items.filter((kv) => {
        const [k, en] = kv.split(/:(.+)/);
        return (
          k.toLowerCase().includes(term) ||
          en?.toLowerCase().includes(term) ||
          (data[k] || '').toLowerCase().includes(term)
        );
      });
      if (matched.length) out[group] = matched;
    }
    return out;
  }, [q, data]);

  const updateDraft = (k, v) => setDrafts((d) => ({ ...d, [k]: v }));

  const persist = async (k) => {
    const draft = drafts[k];
    if (draft === undefined) return;          // never edited
    const value = draft.trim();
    if (value === (data[k] || '').trim()) {   // no-op
      setDrafts((d) => { const n = { ...d }; delete n[k]; return n; });
      return;
    }
    try {
      await req('/api/translations', 'PUT', { langCode: lang, key: k, value });
      setData((dat) => ({ ...dat, [k]: value }));
      setDrafts((d) => { const n = { ...d }; delete n[k]; return n; });
    } catch (e) {
      toast.error(`${k}: ${e.message}`);
    }
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const d = await req('/api/admin/translations/seed', 'POST', {});
      toast.success(d?.message || 'Translation rows seeded.');
      load();
    } catch (e) {
      toast.error(e.message || 'Seed failed.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Content</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Translations</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Translate the in-app strings. Blank rows fall back to English automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={seed} disabled={seeding} className="btn-ghost">
            <Sprout className="h-3.5 w-3.5" />
            {seeding ? 'Seeding…' : 'Seed all keys'}
          </button>
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Language tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-50 p-1 w-fit">
        {TRANS_LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
              lang === l.code ? 'bg-white text-ink shadow-sm' : 'text-zinc-500 hover:text-ink'
            }`}
          >
            <span>{l.flag}</span> {l.label}
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="mb-4 card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink tabular">
            {totals.filled} of {totals.total} strings translated
          </span>
          <span className="font-bold tabular text-ink">{totals.pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all ${
              totals.pct < 30 ? 'bg-red-500'
              : totals.pct < 70 ? 'bg-amber-500'
              : 'bg-emerald-500'
            }`}
            style={{ width: `${totals.pct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          {totals.pct === 100 ? '🎉 Fully translated.'
           : totals.pct === 0 ? 'No translations yet — click "Seed all keys" to create rows, then fill them in.'
           : 'Tab away from a field to save it. Leaving blank means English fallback.'}
        </p>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter keys, English, or current values…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="card p-6"><Skeleton lines={6} /></div>
      ) : Object.keys(data).length === 0 && totals.pct === 0 ? (
        <div className="card py-16 text-center">
          <Languages className="mx-auto h-8 w-8 text-zinc-300" />
          <div className="mt-3 text-sm font-semibold text-zinc-700">
            No translations yet for {TRANS_LANGS.find((l) => l.code === lang)?.label}
          </div>
          <button onClick={seed} disabled={seeding} className="btn-primary mt-4">
            <Sprout className="h-4 w-4" /> {seeding ? 'Seeding…' : 'Seed all keys'}
          </button>
        </div>
      ) : Object.keys(filteredGroups).length === 0 ? (
        <div className="card py-12 text-center">
          <div className="text-sm font-semibold text-zinc-700">No keys match your filter</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(filteredGroups).map(([group, items]) => (
            <div key={group} className="card overflow-hidden">
              <div className="border-b border-zinc-100 bg-zinc-25 px-5 py-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">{group}</h3>
              </div>
              <ul className="divide-y divide-zinc-100">
                {items.map((kv) => {
                  const [k, en] = kv.split(/:(.+)/);
                  return (
                    <Row
                      key={k}
                      keyName={k}
                      en={en}
                      saved={data[k] || ''}
                      draft={drafts[k]}
                      lang={lang}
                      onDraft={(v) => updateDraft(k, v)}
                      onCommit={() => persist(k)}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ keyName, en, saved, draft, lang, onDraft, onCommit }) {
  const value     = draft !== undefined ? draft : saved;
  const dirty     = draft !== undefined && draft.trim() !== saved.trim();
  const isFilled  = value.trim().length > 0;
  const inputRef  = useRef(null);

  return (
    <li className="grid grid-cols-12 gap-3 px-5 py-3">
      <div className="col-span-4">
        <code className="text-[11px] font-medium text-ink">{keyName}</code>
        <div className="mt-0.5 truncate text-[12px] text-zinc-500">{en || keyName}</div>
      </div>
      <div className="col-span-7">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onDraft(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); }
          }}
          placeholder={en || keyName}
          className={`w-full rounded-md bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-zinc-400 focus:outline-none transition ring-1 ${
            dirty   ? 'ring-amber-300 focus:ring-amber-400'
            : isFilled ? 'ring-zinc-200 focus:ring-brand-600/40'
                       : 'ring-zinc-200 bg-zinc-25 focus:ring-brand-600/40'
          }`}
        />
      </div>
      <div className="col-span-1 flex items-center justify-end">
        {dirty ? (
          <Badge variant="amber">Unsaved</Badge>
        ) : isFilled ? (
          <Badge variant="green"><Check className="h-3 w-3" /> Saved</Badge>
        ) : (
          <Badge variant="zinc">Empty</Badge>
        )}
      </div>
    </li>
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
