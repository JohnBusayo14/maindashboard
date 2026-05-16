import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, X, RefreshCcw, ShieldCheck, Mail, Send, AlertTriangle,
  CheckCircle2, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Badge from '../components/Badge.jsx';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const TABS = [
  { v: 'pending',  label: 'Pending'  },
  { v: 'approved', label: 'Approved' },
  { v: 'rejected', label: 'Rejected' },
  { v: 'all',      label: 'All'      },
];

export default function Approvals() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [tab, setTab]         = useState('pending');
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req(`/api/admin/church-applications?status=${tab}`);
      setRows(data?.applications || []);
    } catch (e) {
      if (e.status === 404) {
        toast.error('Backend missing church-applications endpoint — redeploy required.');
      } else {
        toast.error(e.message || 'Failed to load applications.');
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [req, tab, toast]);

  useEffect(() => { load(); }, [load]);

  const onApprove = async (c) => {
    if (!confirm(`Approve "${c.name}" and send the credentials email?`)) return;
    try {
      const d = await req(`/api/admin/church-applications/${c.id}/approve`, 'POST');
      const name = d.church?.name || c.name;
      if (d.mail?.ok) {
        toast.success(`Approved ${name}. Confirmation email sent to ${c.admin_email}.`);
      } else {
        toast.error(
          `Approved ${name}, but email FAILED to send: ${d.mail?.error || 'unknown reason'}. ` +
          `Check the Mail Test panel (/api/admin/mail-test) to debug.`
        );
      }
      load();
    } catch (e) {
      toast.error(e.message || 'Approve failed.');
    }
  };

  const onReject = async (c) => {
    const reason = prompt('Reason for rejection (optional, shown to the applicant on next login):', '');
    if (reason === null) return;
    try {
      const d = await req(`/api/admin/church-applications/${c.id}/reject`, 'POST', { reason });
      if (d.mail?.ok) {
        toast.success(`Rejected ${c.name}. Notification email sent.`);
      } else {
        toast.error(
          `Rejected ${c.name}, but email FAILED to send: ${d.mail?.error || 'unknown reason'}.`
        );
      }
      load();
    } catch (e) {
      toast.error(e.message || 'Reject failed.');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Churches</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Church approvals</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Self-service church signups land here. Approving sends the admin token by email.
          </p>
        </div>
        <button onClick={load} className="btn-ghost" disabled={loading}>
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex rounded-lg ring-1 ring-zinc-200 bg-white p-0.5 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              tab === t.v ? 'bg-zinc-100 text-ink' : 'text-zinc-500 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mail health card — surfaces the Resend probe so admins can confirm
          the approval/rejection emails will actually deliver before they
          act on a pending application. */}
      <MailHealthCard req={req} toast={toast} />

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">No {tab} applications.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5">Church</th>
                  <th className="px-5 py-2.5">Contact</th>
                  <th className="px-5 py-2.5">Email</th>
                  <th className="px-5 py-2.5">Phone</th>
                  <th className="px-5 py-2.5">Submitted</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-25 align-top">
                    <td className="px-5 py-2.5">
                      <div className="font-semibold text-ink">{c.name}</div>
                      {c.location && <div className="mt-0.5 text-[11px] text-zinc-500">{c.location}</div>}
                    </td>
                    <td className="px-5 py-2.5 text-zinc-700">{c.contact_name || '—'}</td>
                    <td className="px-5 py-2.5 text-zinc-700">{c.admin_email}</td>
                    <td className="px-5 py-2.5 text-zinc-500">{c.phone || '—'}</td>
                    <td className="px-5 py-2.5 text-zinc-500 tabular">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-2.5">
                      {c.approval_status === 'approved' && <Badge variant="green">Approved</Badge>}
                      {c.approval_status === 'pending'  && <Badge variant="amber">Pending</Badge>}
                      {c.approval_status === 'rejected' && (
                        <Badge variant="red" className="cursor-help" >
                          <span title={c.rejected_reason || ''}>Rejected</span>
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {c.approval_status === 'pending' && (
                          <>
                            <button onClick={() => onApprove(c)} className="btn-soft text-xs !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100">
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button onClick={() => onReject(c)} className="btn-soft text-xs !bg-red-50 !text-red-700 hover:!bg-red-100">
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {c.approval_status === 'rejected' && (
                          <button onClick={() => onApprove(c)} className="btn-soft text-xs !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100">
                            <Check className="h-3.5 w-3.5" /> Re-approve
                          </button>
                        )}
                      </div>
                    </td>
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

// ─────────────────────────────────────────────────────────────────────────────
// Mail health — collapsible card. Probes /api/admin/mail-test on mount,
// shows whether Resend is ready, lets the admin send a one-shot test email
// to confirm delivery without leaving the page.
// ─────────────────────────────────────────────────────────────────────────────
function MailHealthCard({ req, toast }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(true);
  const [probe,   setProbe]   = useState(null);
  const [to,      setTo]      = useState('');
  const [sending, setSending] = useState(false);
  const [lastSend,setLastSend]= useState(null); // { ok, id?, error?, to, at }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/admin/mail-test');
      setProbe(data);
    } catch (e) {
      setProbe({ ok: false, error: e.message || 'Failed to reach mail-test endpoint.' });
    } finally {
      setLoading(false);
    }
  }, [req]);

  useEffect(() => { load(); }, [load]);

  const onSend = async () => {
    const recipient = to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error('Enter a valid recipient email.');
      return;
    }
    setSending(true);
    try {
      const data = await req('/api/admin/mail-test', 'POST', { to: recipient });
      setLastSend({ ...data, at: Date.now() });
      if (data.ok) toast.success(`Test email queued at Resend (id: ${data.id?.slice(0, 8) || '…'}).`);
      else toast.error(data.error || 'Resend rejected the test send.');
    } catch (e) {
      setLastSend({ ok: false, error: e.message, to: recipient, at: Date.now() });
      toast.error(e.message || 'Mail-test endpoint failed.');
    } finally {
      setSending(false);
    }
  };

  const ready = probe?.ready;
  const headerVariant =
    loading           ? { bg: 'bg-zinc-100',     ring: 'ring-zinc-200',     fg: 'text-zinc-600',     icon: Mail,           label: 'Checking…' }
    : !probe?.ok      ? { bg: 'bg-red-50',       ring: 'ring-red-200',      fg: 'text-red-700',      icon: AlertTriangle,  label: 'Probe failed' }
    : ready           ? { bg: 'bg-emerald-50',   ring: 'ring-emerald-200',  fg: 'text-emerald-700',  icon: CheckCircle2,   label: 'Mail ready' }
                      : { bg: 'bg-amber-50',     ring: 'ring-amber-200',    fg: 'text-amber-700',    icon: AlertTriangle,  label: 'Needs attention' };
  const HeaderIcon = headerVariant.icon;

  return (
    <div className={`mb-4 rounded-xl ring-1 ${headerVariant.ring} ${headerVariant.bg}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <HeaderIcon className={`h-4 w-4 ${headerVariant.fg}`} />
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${headerVariant.fg}`}>
              Mail health · Resend
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-ink">
              {loading
                ? 'Probing Resend configuration…'
                : !probe?.ok
                  ? (probe?.error || 'Could not reach the mail-test endpoint.')
                  : ready
                    ? `Sending from ${probe.from_address}`
                    : (probe.hints?.[0] || 'Configuration incomplete — expand for details.')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden sm:inline rounded-md px-2 py-0.5 text-[11px] font-bold ${headerVariant.fg} bg-white/70`}>
            {headerVariant.label}
          </span>
          {open
            ? <ChevronUp className="h-4 w-4 text-zinc-500" />
            : <ChevronDown className="h-4 w-4 text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/60 px-4 py-4">
          {/* Diagnostic grid */}
          {probe?.ok && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Diag label="API key"        value={probe.resend_configured ? probe.api_key_prefix : '— missing —'} ok={probe.resend_configured} />
              <Diag label="MAIL_FROM"      value={probe.mail_from} ok={!probe.sandbox} />
              <Diag label="From domain"    value={probe.from_domain || '—'} ok={!probe.sandbox} />
              <Diag
                label="Domain status"
                value={
                  probe.domain_status?.restricted
                    ? 'Send-only key (cannot list domains)'
                    : (probe.domain_status?.domains || []).length
                      ? (probe.domain_status.domains.find((d) => d.name === probe.from_domain)?.status || '— not found —')
                      : (probe.domain_status?.error || 'No domains configured')
                }
                ok={
                  probe.domain_status?.restricted
                  || (probe.domain_status?.domains || []).find((d) => d.name === probe.from_domain)?.status === 'verified'
                }
              />
            </div>
          )}

          {/* Hints */}
          {!!probe?.hints?.length && (
            <ul className="space-y-1.5 rounded-lg bg-white/80 p-3 ring-1 ring-zinc-200">
              {probe.hints.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-zinc-700">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {h}
                </li>
              ))}
            </ul>
          )}

          {/* Send-test row */}
          <div className="rounded-lg bg-white/80 p-3 ring-1 ring-zinc-200">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Send test email
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="min-w-[220px] flex-1 rounded-lg ring-1 ring-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
              />
              <button
                onClick={onSend}
                disabled={sending || !to}
                className="btn-primary disabled:opacity-50 disabled:shadow-none"
              >
                {sending
                  ? <><RefreshCcw className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                  : <><Send className="h-3.5 w-3.5" /> Send test</>}
              </button>
              <button onClick={load} className="btn-ghost" disabled={loading || sending}>
                <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-probe
              </button>
            </div>

            {lastSend && (
              <div className={`mt-3 rounded-md px-3 py-2 text-[12.5px] ring-1 ${
                lastSend.ok
                  ? 'bg-emerald-50 ring-emerald-200 text-emerald-800'
                  : 'bg-red-50 ring-red-200 text-red-800'
              }`}>
                {lastSend.ok
                  ? <>✓ Sent to <code>{lastSend.to}</code> · Resend id <code>{lastSend.id}</code></>
                  : <>✕ Could not send to <code>{lastSend.to}</code> — {lastSend.error || 'unknown error'}</>}
              </div>
            )}

            {probe?.sandbox && (
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-amber-200">
                <strong>Heads-up:</strong> the sandbox sender only delivers to the email address tied to the Resend account.
                Any other recipient will return <code>You can only send testing emails to your own email address</code>.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Diag({ label, value, ok }) {
  return (
    <div className="rounded-md bg-white/80 px-3 py-2 ring-1 ring-zinc-200">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-0.5 truncate text-[12.5px] font-semibold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
        {String(value)}
      </div>
    </div>
  );
}
