import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Plus, RefreshCcw, Pencil, Trash2, KeyRound, Copy, Check, Ticket } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Rewards — what players can buy with their XP in the app. You create a reward
// (e.g. "₦500 MTN airtime", 5000 XP), load the voucher codes you've bought, and
// the app hands one unused code to a player when they redeem. Prices are
// yours to set and change at any time (backend: routes/rewards.js).
// ─────────────────────────────────────────────────────────────────────────────

const fmtWhen = (d) =>
  d ? new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const EMPTY = { title: '', value_label: '', xp_cost: '', description: '', emoji: '🎁', per_user_limit: '', active: true };

export default function Rewards() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [tab, setTab]       = useState('items');
  const [items, setItems]   = useState([]);
  const [redeems, setRedeems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit]     = useState(null);     // item or EMPTY (new)
  const [codesFor, setCodesFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([req('/api/admin/rewards'), req('/api/admin/rewards/redemptions?limit=200')]);
      setItems(a.items || []);
      setRedeems(b.redemptions || []);
    } catch (e) {
      toast.error(e.message || 'Could not load rewards.');
    } finally { setLoading(false); }
  }, [req, toast]);
  useEffect(() => { load(); }, [load]);

  const remove = async (it) => {
    if (!window.confirm(`Delete "${it.title}"? Unused codes for it are deleted too.`)) return;
    try {
      const r = await req(`/api/admin/rewards/${it.id}`, 'DELETE');
      toast.success(r.hidden ? 'It has redemptions, so it was hidden instead.' : 'Reward deleted.');
      load();
    } catch (e) { toast.error(e.message || 'Could not delete.'); }
  };

  const toggle = async (it) => {
    try { await req(`/api/admin/rewards/${it.id}`, 'PUT', { active: !it.active }); load(); }
    catch (e) { toast.error(e.message || 'Could not update.'); }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Engagement</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Rewards</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Players earn XP from reading and the Bible games, then swap it for the vouchers you create here.
            Add a reward, set its XP price, and load the voucher codes — the app gives one unused code to
            each player who redeems. Accounts must be 3 days old, and game XP is capped at 60 a day.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg ring-1 ring-zinc-200 bg-white p-0.5 text-sm">
            {[['items', 'Rewards'], ['redeemed', 'Redeemed']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`rounded-md px-3 py-1 font-semibold transition ${tab === id ? 'bg-zinc-100 text-ink' : 'text-zinc-500 hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setEdit({ ...EMPTY })} className="btn-primary"><Plus className="h-4 w-4" /> New reward</button>
        </div>
      </div>

      {tab === 'items' ? (
        <div className="card overflow-hidden">
          {loading ? <div className="p-8 text-sm text-zinc-500">Loading…</div> : items.length === 0 ? (
            <div className="py-16 text-center">
              <Gift className="mx-auto h-8 w-8 text-zinc-300" />
              <div className="mt-3 text-sm font-semibold text-zinc-700">No rewards yet</div>
              <div className="mt-1 text-xs text-zinc-500">Create one, then add voucher codes to it.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead className="bg-zinc-25">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-2.5">Reward</th>
                    <th className="px-5 py-2.5 text-right">XP price</th>
                    <th className="px-5 py-2.5 text-right">In stock</th>
                    <th className="px-5 py-2.5 text-right">Redeemed</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-zinc-25">
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-ink">{it.emoji} {it.title}</div>
                        <div className="text-xs text-zinc-500">{[it.value_label, it.per_user_limit ? `max ${it.per_user_limit} per person` : ''].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-ink">{Number(it.xp_cost).toLocaleString()}</td>
                      <td className="px-5 py-2.5 text-right">
                        <span className={it.stock === 0 ? 'font-semibold text-red-600' : it.stock < 5 ? 'font-semibold text-amber-600' : 'text-zinc-700'}>{it.stock}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-zinc-700">{it.redeemed}</td>
                      <td className="px-5 py-2.5">
                        <button onClick={() => toggle(it)} title="Click to show/hide in the app">
                          <Badge variant={it.active ? 'green' : 'zinc'}>{it.active ? 'Live' : 'Hidden'}</Badge>
                        </button>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setCodesFor(it)} className="btn-primary px-2.5 py-1.5 text-xs"><Ticket className="h-3.5 w-3.5" /> Add codes</button>
                          <button onClick={() => setEdit(it)} className="btn-ghost px-2.5 py-1.5 text-xs"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(it)} className="btn-ghost px-2.5 py-1.5 text-xs text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {redeems.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500">Nobody has redeemed a reward yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead className="bg-zinc-25">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-2.5">When</th><th className="px-5 py-2.5">Player</th>
                    <th className="px-5 py-2.5">Reward</th><th className="px-5 py-2.5 text-right">XP</th><th className="px-5 py-2.5">Code given</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {redeems.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2.5 text-zinc-600">{fmtWhen(r.created_at)}</td>
                      <td className="px-5 py-2.5 text-ink">{r.email}</td>
                      <td className="px-5 py-2.5">{r.title}{r.value_label ? <span className="text-zinc-500"> · {r.value_label}</span> : null}</td>
                      <td className="px-5 py-2.5 text-right">{r.xp_cost}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-zinc-700">{r.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {edit && <ItemModal item={edit} req={req} toast={toast} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {codesFor && <CodesModal item={codesFor} req={req} toast={toast} onClose={() => setCodesFor(null)} onSaved={() => { setCodesFor(null); load(); }} />}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function ItemModal({ item, req, toast, onClose, onSaved }) {
  const isNew = !item.id;
  const [f, setF] = useState({
    title: item.title || '', value_label: item.value_label || '', xp_cost: item.xp_cost ?? '',
    description: item.description || '', emoji: item.emoji || '🎁',
    per_user_limit: item.per_user_limit ?? '', active: item.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.title.trim()) return toast.error('Give the reward a title.');
    if (!(parseInt(f.xp_cost, 10) > 0)) return toast.error('Set an XP price above 0.');
    setSaving(true);
    try {
      const body = { ...f, xp_cost: parseInt(f.xp_cost, 10), per_user_limit: f.per_user_limit === '' ? null : parseInt(f.per_user_limit, 10) };
      await req(isNew ? '/api/admin/rewards' : `/api/admin/rewards/${item.id}`, isNew ? 'POST' : 'PUT', body);
      toast.success(isNew ? 'Reward created — now add voucher codes.' : 'Saved.');
      onSaved();
    } catch (e) { toast.error(e.message || 'Could not save.'); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'New reward' : 'Edit reward'} sub="What players can buy with XP"
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <Field label="Icon"><input className="input text-center text-lg" value={f.emoji} onChange={set('emoji')} maxLength={4} /></Field>
          <Field label="Title"><input className="input" value={f.title} onChange={set('title')} placeholder="MTN airtime" autoFocus /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Value shown to players" hint="e.g. ₦500"><input className="input" value={f.value_label} onChange={set('value_label')} placeholder="₦500" /></Field>
          <Field label="XP price" hint="You decide — change any time"><input className="input" type="number" min="1" value={f.xp_cost} onChange={set('xp_cost')} placeholder="5000" /></Field>
        </div>
        <Field label="Description" hint="How to use the voucher."><textarea className="input" rows={3} value={f.description} onChange={set('description')} placeholder="Dial *555*PIN# to load the airtime." /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max per person" hint="Leave empty for no limit"><input className="input" type="number" min="1" value={f.per_user_limit} onChange={set('per_user_limit')} /></Field>
          <Field label="Visible in the app">
            <select className="input" value={f.active ? '1' : '0'} onChange={(e) => setF((p) => ({ ...p, active: e.target.value === '1' }))}>
              <option value="1">Live</option><option value="0">Hidden</option>
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function CodesModal({ item, req, toast, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const count = useMemo(() => new Set(text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)).size, [text]);

  const save = async () => {
    if (!count) return toast.error('Paste at least one code.');
    setSaving(true);
    try {
      const r = await req(`/api/admin/rewards/${item.id}/codes`, 'POST', { codes: text });
      toast.success(`${r.added} code(s) added${r.skipped_duplicates ? `, ${r.skipped_duplicates} duplicate(s) skipped` : ''}.`);
      onSaved();
    } catch (e) { toast.error(e.message || 'Could not add the codes.'); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Add codes — ${item.title}`} sub={`${item.stock} unused code(s) in stock now`}
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button onClick={save} disabled={saving || !count} className="btn-primary">{saving ? 'Adding…' : `Add ${count || ''} code${count === 1 ? '' : 's'}`}</button></>}>
      <Field label="Voucher codes" hint="One per line (or separated by commas). Duplicates are skipped. Up to 1,000 at a time.">
        <textarea className="input font-mono text-xs" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1234-5678-9012\n2345-6789-0123'} autoFocus />
      </Field>
    </Modal>
  );
}
