import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, RefreshCcw, ShieldCheck } from 'lucide-react';
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
      toast.success(`Approved ${d.church?.name || c.name}.`);
      load();
    } catch (e) {
      toast.error(e.message || 'Approve failed.');
    }
  };

  const onReject = async (c) => {
    const reason = prompt('Reason for rejection (optional, shown to the applicant on next login):', '');
    if (reason === null) return;
    try {
      await req(`/api/admin/church-applications/${c.id}/reject`, 'POST', { reason });
      toast.success(`Rejected ${c.name}.`);
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
