import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound, RefreshCcw, Search, UserRound, LogOut, Copy, Check, Smartphone,
  History, ShieldAlert, X,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Accounts — the admin side of the app's "Forgot password? Contact your
// administrator". Find an account, reset its password (shown once, optional
// email, 72 h temporary by default), sign it out on one or all devices, and
// see who did what (backend: routes/accounts.js).
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = '/api/admin';

const fmtRel = (d) => {
  if (!d) return 'Never';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60)      return 'Just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtWhen = (d) =>
  d ? new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const ROLE_PILL = { admin: 'red', teacher: 'violet', student: 'blue' };
const METHOD_LABEL = { password: 'Password', google: 'Google', 'magic-link': 'Email link' };

const ACTION_LABEL = {
  password_reset:    'Password reset',
  signed_out_all:    'Signed out everywhere',
  signed_out_device: 'Signed out a device',
};
const describe = (e) => {
  const d = e.detail || {};
  if (e.action === 'password_reset') {
    const bits = [d.generated ? 'temporary password generated' : 'password set by admin'];
    if (d.temporary) bits.push('expires in 72 h');
    if (d.emailed) bits.push('emailed to user');
    if (d.signed_out_devices) bits.push(`${d.signed_out_devices} device(s) signed out`);
    return bits.join(' · ');
  }
  if (e.action === 'signed_out_all') return `${d.devices || 0} device(s)`;
  if (e.action === 'signed_out_device') return d.device || '';
  return '';
};

// Friendly device name from a session's User-Agent-ish label.
const deviceName = (label) => {
  const s = String(label || '');
  if (/okhttp|android/i.test(s)) return 'Android phone (Gospelar app)';
  if (/iphone|ipad|cfnetwork|darwin/i.test(s)) return 'iPhone / iPad (Gospelar app)';
  if (/mozilla|chrome|safari|firefox|edg/i.test(s)) return 'Web browser';
  return s || 'Unknown device';
};

const tempStatus = (expires) => {
  if (!expires) return null;
  const left = new Date(expires).getTime() - Date.now();
  return left > 0
    ? { variant: 'amber', label: `Temp password · ${Math.ceil(left / 3600e3)} h left` }
    : { variant: 'zinc',  label: 'Temp password expired' };
};

export default function Accounts() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [tab, setTab]           = useState('accounts');
  const [q, setQ]               = useState('');
  const [query, setQuery]       = useState('');
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [resetFor, setResetFor] = useState(null);
  const [openId, setOpenId]     = useState(null);

  // Debounce typing so every keystroke doesn't hit the server.
  useEffect(() => {
    const h = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(h);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await req(`${PREFIX}/accounts?limit=100${query ? `&q=${encodeURIComponent(query)}` : ''}`);
      setRows(d.accounts || []);
    } catch (e) {
      toast.error(e.message || 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  }, [req, query, toast]);

  useEffect(() => { if (tab === 'accounts') load(); }, [load, tab]);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Users</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Accounts</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            When someone taps <b>Forgot password?</b> in the app, they're told to contact you. Find their
            account here, reset the password and send it to them — they change it under <b>Settings → Change Password</b>.
          </p>
        </div>
        <div className="flex rounded-lg ring-1 ring-zinc-200 bg-white p-0.5 text-sm">
          {[['accounts', 'Accounts'], ['activity', 'Activity']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                tab === id ? 'bg-zinc-100 text-ink' : 'text-zinc-500 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'activity' ? <ActivityLog req={req} toast={toast} /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email or name…"
                className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
                autoFocus
              />
            </div>
            <button onClick={load} className="btn-ghost" disabled={loading}>
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <span className="ml-auto text-xs text-zinc-500">
              {query ? `${rows.length} match${rows.length === 1 ? '' : 'es'}` : 'Most recently active'}
            </span>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-6"><Skeleton lines={6} /></div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <UserRound className="mx-auto h-8 w-8 text-zinc-300" />
                <div className="mt-3 text-sm font-semibold text-zinc-700">
                  {query ? 'No account matches that search' : 'No accounts yet'}
                </div>
                {query && <div className="mt-1 text-xs text-zinc-500">Check the spelling of the email address.</div>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular">
                  <thead className="bg-zinc-25">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      <th className="px-5 py-2.5">Account</th>
                      <th className="px-5 py-2.5">Role</th>
                      <th className="px-5 py-2.5">Church</th>
                      <th className="px-5 py-2.5">Last active</th>
                      <th className="px-5 py-2.5 text-right">Devices</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rows.map((a) => {
                      const ts = tempStatus(a.temp_password_expires_at);
                      return (
                        <tr key={a.id} className="hover:bg-zinc-25">
                          <td className="px-5 py-2.5">
                            <button onClick={() => setOpenId(a.id)} className="text-left">
                              <div className="font-semibold text-ink hover:text-brand-700">{a.name || a.email}</div>
                              {a.name && <div className="text-xs text-zinc-500">{a.email}</div>}
                            </button>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {ts && <Badge variant={ts.variant}>{ts.label}</Badge>}
                              {a.approval_status !== 'approved' && <Badge variant="orange">{a.approval_status}</Badge>}
                            </div>
                          </td>
                          <td className="px-5 py-2.5">
                            <Badge variant={ROLE_PILL[a.role] || 'zinc'}>{a.role || 'student'}</Badge>
                          </td>
                          <td className="px-5 py-2.5 text-zinc-600">{a.church_name || <span className="text-zinc-400">—</span>}</td>
                          <td className="px-5 py-2.5 text-zinc-600">{fmtRel(a.last_active)}</td>
                          <td className="px-5 py-2.5 text-right text-zinc-700">{a.devices || 0}</td>
                          <td className="px-5 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => setOpenId(a.id)} className="btn-ghost px-2.5 py-1.5 text-xs">Details</button>
                              <button onClick={() => setResetFor(a)} className="btn-primary px-2.5 py-1.5 text-xs">
                                <KeyRound className="h-3.5 w-3.5" /> Reset password
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {resetFor && (
        <ResetModal
          account={resetFor}
          req={req}
          toast={toast}
          onClose={() => setResetFor(null)}
          onDone={load}
        />
      )}
      {openId && (
        <AccountPanel
          id={openId}
          req={req}
          toast={toast}
          onClose={() => setOpenId(null)}
          onReset={(a) => { setOpenId(null); setResetFor(a); }}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ── Reset password ───────────────────────────────────────────────────────────
function ResetModal({ account, req, toast, onClose, onDone }) {
  const [mode, setMode]           = useState('generate');
  const [password, setPassword]   = useState('');
  const [temporary, setTemporary] = useState(true);
  const [emailUser, setEmailUser] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [result, setResult]       = useState(null);
  const name = account.name || account.display_name || account.email;

  const submit = async () => {
    if (mode === 'type' && password.length < 8) return toast.error('The password must be at least 8 characters.');
    setSaving(true);
    try {
      const r = await req(`${PREFIX}/accounts/${account.id}/reset-password`, 'POST', {
        password: mode === 'type' ? password : undefined,
        temporary,
        email_user: emailUser,
      });
      setResult(r);
      if (r.email_error) toast.error(r.email_error);
      else toast.success(`Password reset for ${account.email}.`);
      onDone?.();
    } catch (e) {
      toast.error(e.message || 'Reset failed.');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const message =
      `Hello${name && name !== account.email ? ` ${name}` : ''}, your Gospelar password has been reset.\n\n` +
      `Email: ${result.email}\nPassword: ${result.password}\n\n` +
      'Sign in to the Gospelar app, then tap the Settings (gear) icon in the Library and choose ' +
      '"Change Password" to set your own.' +
      (result.expires_at ? `\n\nThis password stops working on ${fmtWhen(result.expires_at)} if it isn't changed.` : '');
    return (
      <Modal
        open
        onClose={onClose}
        title="Password reset"
        sub={account.email}
        size="md"
        footer={<button onClick={onClose} className="btn-primary">Done</button>}
      >
        <div className="flex flex-col gap-4">
          <div>
            <div className="label">New password</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-brand-50 px-4 py-3 text-lg font-bold tracking-wide text-brand-700 ring-1 ring-brand-100">
                {result.password}
              </code>
              <CopyButton text={result.password} label="Copy" />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">Shown only once — it isn't stored anywhere you can look it up later.</p>
          </div>
          <ul className="space-y-1.5 text-sm text-zinc-600">
            {result.expires_at && <li>• Works until <b>{fmtWhen(result.expires_at)}</b> unless the user changes it.</li>}
            <li>• Signed out on {result.signed_out_devices} device{result.signed_out_devices === 1 ? '' : 's'}.</li>
            {result.emailed && <li>• Emailed to <b>{result.email}</b>.</li>}
            {result.email_error && <li className="text-red-600">• {result.email_error}</li>}
          </ul>
          <div>
            <div className="label">Message to send (WhatsApp / SMS)</div>
            <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 ring-1 ring-zinc-200">{message}</pre>
            <div className="mt-2"><CopyButton text={message} label="Copy message" /></div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reset password"
      sub={`${name}${name !== account.email ? ` · ${account.email}` : ''}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            <KeyRound className="h-4 w-4" /> {saving ? 'Resetting…' : 'Reset password'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Make sure you're talking to the real account owner before resetting. Their current password stops working
            and they're signed out on every device.</span>
        </div>

        <div className="flex flex-col gap-2">
          <Choice checked={mode === 'generate'} onChange={() => setMode('generate')}
            title="Generate a password (recommended)" sub="Easy to read out or type, e.g. Grace-4821-Olive." />
          <Choice checked={mode === 'type'} onChange={() => setMode('type')}
            title="Type a password" sub="At least 8 characters." />
          {mode === 'type' && (
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoFocus
            />
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} />
          <span>
            <span className="font-semibold text-ink">Must be changed within 72 hours</span>
            <span className="block text-xs text-zinc-500">After that it stops working, so a password shared over chat doesn't stay valid.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5" checked={emailUser} onChange={(e) => setEmailUser(e.target.checked)} />
          <span>
            <span className="font-semibold text-ink">Also email it to {account.email}</span>
            <span className="block text-xs text-zinc-500">Only if they can still open that mailbox.</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ── Account details: devices + history ───────────────────────────────────────
function AccountPanel({ id, req, toast, onClose, onReset, onChanged }) {
  const [data, setData]   = useState(null);
  const [busy, setBusy]   = useState(false);

  const load = useCallback(async () => {
    try { setData(await req(`${PREFIX}/accounts/${id}`)); }
    catch (e) { toast.error(e.message || 'Could not load account.'); onClose(); }
  }, [req, id, toast, onClose]);
  useEffect(() => { load(); }, [load]);

  const signOutAll = async () => {
    if (!window.confirm('Sign this account out on every device? They will need to sign in again.')) return;
    setBusy(true);
    try {
      const r = await req(`${PREFIX}/accounts/${id}/sign-out-all`, 'POST');
      toast.success(`Signed out on ${r.signed_out_devices} device(s).`);
      await load(); onChanged?.();
    } catch (e) { toast.error(e.message || 'Could not sign out.'); }
    finally { setBusy(false); }
  };
  const signOutOne = async (sid) => {
    setBusy(true);
    try {
      await req(`${PREFIX}/accounts/${id}/sessions/${sid}/revoke`, 'POST');
      toast.success('Device signed out.');
      await load(); onChanged?.();
    } catch (e) { toast.error(e.message || 'Could not sign that device out.'); }
    finally { setBusy(false); }
  };

  const a = data?.account;
  const ts = a && tempStatus(a.temp_password_expires_at);
  return (
    <Modal
      open
      onClose={onClose}
      title={a ? (a.display_name || a.email) : 'Account'}
      sub={a?.display_name ? a.email : undefined}
      size="lg"
      footer={a && (
        <>
          <button onClick={signOutAll} disabled={busy || !data.devices.length} className="btn-ghost">
            <LogOut className="h-4 w-4" /> Sign out everywhere
          </button>
          <button onClick={() => onReset(a)} className="btn-primary">
            <KeyRound className="h-4 w-4" /> Reset password
          </button>
        </>
      )}
    >
      {!data ? <Skeleton lines={6} /> : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Fact label="Role"><Badge variant={ROLE_PILL[a.role] || 'zinc'}>{a.role || 'student'}</Badge></Fact>
            <Fact label="Church">{a.church_name || '—'}</Fact>
            <Fact label="Joined">{fmtWhen(a.created_at).split(',')[0]}</Fact>
            <Fact label="Password">{ts ? <Badge variant={ts.variant}>{ts.label}</Badge> : 'Set by user'}</Fact>
          </div>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <Smartphone className="h-3.5 w-3.5" /> Signed-in devices ({data.devices.length})
            </h3>
            {data.devices.length === 0 ? (
              <p className="text-sm text-zinc-500">Not signed in anywhere.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-200">
                {data.devices.map((d) => (
                  <li key={d.sid} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <div className="flex-1">
                      <div className="font-semibold text-ink">{deviceName(d.device_label)}</div>
                      <div className="text-xs text-zinc-500">
                        {METHOD_LABEL[d.provider] || d.provider || 'Password'} · signed in {fmtRel(d.created_at)}
                        {d.last_used_at && ` · last used ${fmtRel(d.last_used_at)}`}
                      </div>
                    </div>
                    <button onClick={() => signOutOne(d.sid)} disabled={busy}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600" title="Sign this device out">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <History className="h-3.5 w-3.5" /> History
            </h3>
            {data.history.length === 0 ? (
              <p className="text-sm text-zinc-500">No admin actions on this account yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.history.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-semibold text-ink">{ACTION_LABEL[e.action] || e.action}</span>
                    <span className="text-zinc-500"> · {fmtWhen(e.created_at)} · by {e.actor || 'admin'}</span>
                    {describe(e) && <div className="text-xs text-zinc-500">{describe(e)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

// ── Audit log ────────────────────────────────────────────────────────────────
function ActivityLog({ req, toast }) {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    req(`${PREFIX}/accounts-activity?limit=100`)
      .then((d) => setEvents(d.events || []))
      .catch((e) => { toast.error(e.message || 'Could not load activity.'); setEvents([]); });
  }, [req, toast]);

  return (
    <div className="card overflow-hidden">
      {!events ? <div className="p-6"><Skeleton lines={6} /></div> : events.length === 0 ? (
        <div className="py-16 text-center">
          <History className="mx-auto h-8 w-8 text-zinc-300" />
          <div className="mt-3 text-sm font-semibold text-zinc-700">No account actions yet</div>
          <div className="mt-1 text-xs text-zinc-500">Password resets and sign-outs will be listed here.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-25">
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-2.5">When</th>
                <th className="px-5 py-2.5">Action</th>
                <th className="px-5 py-2.5">Account</th>
                <th className="px-5 py-2.5">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {events.map((e, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-zinc-500">{fmtWhen(e.created_at)}</td>
                  <td className="px-5 py-2.5">
                    <div className="font-semibold text-ink">{ACTION_LABEL[e.action] || e.action}</div>
                    {describe(e) && <div className="text-xs text-zinc-500">{describe(e)}</div>}
                  </td>
                  <td className="px-5 py-2.5 text-zinc-700">{e.user_email}</td>
                  <td className="px-5 py-2.5 text-zinc-600">{e.actor || 'admin'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────
function Choice({ checked, onChange, title, sub }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg p-3 text-sm ring-1 transition ${
      checked ? 'bg-brand-50 ring-brand-100' : 'bg-white ring-zinc-200 hover:bg-zinc-50'}`}>
      <input type="radio" className="mt-0.5" checked={checked} onChange={onChange} />
      <span>
        <span className="font-semibold text-ink">{title}</span>
        <span className="block text-xs text-zinc-500">{sub}</span>
      </span>
    </label>
  );
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch { window.prompt('Copy this:', text); }
  };
  return (
    <button onClick={copy} className="btn-ghost px-3 py-2 text-xs">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-ink">{children}</div>
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
