// pages/BankTransfers.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Direct bank transfers for Gospelar Premium. App users send the Premium price
// to the account below with a GSP-XXXXXX code as narration, then tap "I've
// made the transfer". Check the bank app for a matching credit, then Approve
// (Premium switches on + receipt email) or Reject (user is emailed why).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, RefreshCcw, Landmark, Save } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Badge from '../components/Badge.jsx';

const naira = (kobo) => '₦' + Math.round((kobo || 0) / 100).toLocaleString('en-NG');
const fmtWhen = (d) => d
  ? new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

const TABS = [
  { v: 'submitted',         label: 'To confirm' },
  { v: 'awaiting_transfer', label: 'Not sent yet' },
  { v: 'approved',          label: 'Approved' },
  { v: 'rejected',          label: 'Rejected' },
  { v: 'all',               label: 'All' },
];

const STATUS_BADGE = {
  submitted:         <Badge variant="amber">To confirm</Badge>,
  awaiting_transfer: <Badge variant="zinc">Not sent yet</Badge>,
  approved:          <Badge variant="green">Approved</Badge>,
  rejected:          <Badge variant="red">Rejected</Badge>,
};

export default function BankTransfers() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [tab, setTab]         = useState('submitted');
  const [rows, setRows]       = useState([]);
  const [counts, setCounts]   = useState({});
  const [settings, setSettings] = useState(null);
  const [draft, setDraft]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await req(`/api/admin/bank-transfers?status=${tab}`);
      setRows(d.requests || []);
      setCounts(d.counts || {});
      setSettings(d.settings || null);
      setDraft((cur) => cur || d.settings || null);
    } catch (e) {
      toast.error(e.status === 404
        ? 'Backend has no bank-transfer endpoints yet — deploy the backend first.'
        : (e.message || 'Failed to load bank transfers.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [req, tab, toast]);

  useEffect(() => { load(); }, [load]);

  const approve = async (r) => {
    if (!confirm(`Approve ${naira(r.amount_kobo)} from ${r.sender_name || 'unknown sender'} (${r.code})?\n\n`
      + `Only approve if you can see this money in the bank account. This switches on Premium for ${r.email}.`)) return;
    setBusyId(r.id);
    try {
      const d = await req(`/api/admin/bank-transfers/${r.id}/approve`, 'POST');
      toast.success(`Approved — ${r.email} is Premium until ${new Date(d.expiry_date).toLocaleDateString('en-NG')}.`);
      load();
    } catch (e) {
      toast.error(e.message || 'Approve failed.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r) => {
    const reason = prompt(`Reject ${r.code}? Reason (emailed to ${r.email}):`, 'No matching transfer received.');
    if (reason === null) return;
    setBusyId(r.id);
    try {
      await req(`/api/admin/bank-transfers/${r.id}/reject`, 'POST', { reason });
      toast.success(`Rejected ${r.code}. ${r.email} has been emailed.`);
      load();
    } catch (e) {
      toast.error(e.message || 'Reject failed.');
    } finally {
      setBusyId(null);
    }
  };

  const saveSettings = async () => {
    try {
      const s = await req('/api/admin/bank-transfer-settings', 'PUT', draft);
      setSettings(s);
      setDraft(s);
      toast.success('Bank transfer settings saved.');
    } catch (e) {
      toast.error(e.message || 'Save failed.');
    }
  };

  const dirty = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Commerce</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Bank transfers</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Users who pay for Premium by direct transfer land here. Check the bank app for a credit with the
            matching amount and code (narration), then approve. Approving switches Premium on and emails a receipt.
          </p>
        </div>
        <button onClick={load} className="btn-ghost" disabled={loading}>
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Account settings */}
      {draft && (
        <div className="card mb-5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-zinc-500" />
            <div className="text-sm font-bold text-ink">Receiving account</div>
            <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={!!draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              />
              Offer bank transfer in the app
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['bank_name', 'Bank'],
              ['account_number', 'Account number'],
              ['account_name', 'Account name'],
              ['notify_email', 'Alert me at (email, optional)'],
            ].map(([k, label]) => (
              <div key={k}>
                <div className="label">{label}</div>
                <input
                  className="input w-full"
                  value={draft[k] || ''}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={saveSettings} className="btn-primary" disabled={!dirty}>
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex w-fit flex-wrap rounded-lg bg-white p-0.5 text-sm ring-1 ring-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              tab === t.v ? 'bg-zinc-100 text-ink' : 'text-zinc-500 hover:text-ink'
            }`}
          >
            {t.label}
            {counts[t.v] ? <span className="ml-1.5 text-[11px] text-zinc-400">{counts[t.v]}</span> : null}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <Landmark className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">Nothing here.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5">Code (narration)</th>
                  <th className="px-5 py-2.5">Sender name</th>
                  <th className="px-5 py-2.5">Amount</th>
                  <th className="px-5 py-2.5">App account</th>
                  <th className="px-5 py-2.5">Sent</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => {
                  const open = r.status === 'submitted' || r.status === 'awaiting_transfer';
                  return (
                    <tr key={r.id} className="align-top hover:bg-zinc-25">
                      <td className="px-5 py-2.5 font-mono font-semibold text-ink">{r.code}</td>
                      <td className="px-5 py-2.5 text-zinc-700">{r.sender_name || '—'}</td>
                      <td className="px-5 py-2.5 font-semibold tabular text-ink">{naira(r.amount_kobo)}</td>
                      <td className="px-5 py-2.5 text-zinc-700">{r.email}</td>
                      <td className="px-5 py-2.5 tabular text-zinc-500">{fmtWhen(r.submitted_at || r.created_at)}</td>
                      <td className="px-5 py-2.5">
                        {STATUS_BADGE[r.status] || <Badge>{r.status}</Badge>}
                        {r.status === 'rejected' && r.note && (
                          <div className="mt-1 max-w-[220px] text-[11px] text-zinc-500">{r.note}</div>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        {open && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => approve(r)}
                              disabled={busyId === r.id}
                              className="btn-soft text-xs !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => reject(r)}
                              disabled={busyId === r.id}
                              className="btn-soft text-xs !bg-red-50 !text-red-700 hover:!bg-red-100"
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </td>
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
