// pages/Notifications.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Send a notification to the mobile app. Every message lands on the app's
// Notifications page (bell on the Library) and, optionally, as a phone push.
// Below: history of everything sent (including automatic "new video / new
// book" pushes) and the queue of automatic pushes still waiting to go out.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Send, RefreshCcw, Trash2, Smartphone, Clock, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Badge from '../components/Badge.jsx';

const AUDIENCES = [
  { v: 'all',     label: 'Everyone' },
  { v: 'free',    label: 'Free users (with ads)' },
  { v: 'premium', label: 'Premium subscribers' },
  { v: 'email',   label: 'One user (by email)' },
];
const SCREEN_LABELS = {
  Library: 'Library (home)', HomeScreen: 'Sunday School lessons', PaymentScreen: 'Go Premium (checkout)',
  VideoLibrary: 'Video Library', Bible: 'Holy Bible', Notifications: 'Notifications page',
};
const KIND_BADGE = {
  announcement: <Badge variant="blue">Announcement</Badge>,
  video_new:    <Badge variant="red">New video</Badge>,
  book_new:     <Badge variant="orange">New book</Badge>,
  book_update:  <Badge variant="green">Book update</Badge>,
  payment:      <Badge variant="violet">Payment</Badge>,
  account:      <Badge variant="teal">Account</Badge>,
};
const EMPTY = { title: '', body: '', audience: 'all', email: '', linkType: 'none', linkValue: '', push: true };

const fmtWhen = (d) => d
  ? new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

export default function Notifications() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [form, setForm]       = useState(EMPTY);
  const [rows, setRows]       = useState([]);
  const [devices, setDevices] = useState({ total: 0, signedIn: 0 });
  const [screens, setScreens] = useState(Object.keys(SCREEN_LABELS));
  const [books, setBooks]     = useState([]);
  const [queue, setQueue]     = useState([]);
  const [reach, setReach]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        req('/api/admin/app-notifications'),
        req('/api/admin/push').catch(() => null),
      ]);
      setRows(d.notifications || []);
      setDevices({ total: d.devices || 0, signedIn: d.signedInDevices || 0 });
      if (Array.isArray(d.screens)) setScreens(d.screens);
      setQueue(p?.queued || []);
    } catch (e) {
      toast.error(e.status === 404
        ? 'Backend has no notification endpoints yet — deploy the backend first.'
        : (e.message || 'Failed to load notifications.'));
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    req('/api/books?include=unavailable')
      .then((b) => setBooks(Array.isArray(b) ? b : []))
      .catch(() => setBooks([]));
  }, [req]);

  // How many phones the current audience would reach.
  useEffect(() => {
    if (form.audience === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setReach(null); return; }
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ audience: form.audience, ...(form.audience === 'email' ? { email: form.email } : {}) });
      req(`/api/admin/app-notifications/audience?${qs}`)
        .then((r) => setReach(r.devices))
        .catch(() => setReach(null));
    }, 300);
    return () => clearTimeout(t);
  }, [req, form.audience, form.email]);

  const send = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Add a title.'); return; }
    const who = AUDIENCES.find((a) => a.v === form.audience)?.label;
    const pushNote = form.push
      ? `\n\nIt will also be pushed to ${reach ?? 'all matching'} phone(s) right away.`
      : '\n\nIn-app only (no phone push).';
    if (!confirm(`Send "${form.title.trim()}" to ${form.audience === 'email' ? form.email : who}?${pushNote}`)) return;
    setSending(true);
    try {
      const d = await req('/api/admin/app-notifications', 'POST', {
        title: form.title.trim(),
        body:  form.body.trim(),
        audience: form.audience,
        email: form.audience === 'email' ? form.email.trim() : undefined,
        link:  { type: form.linkType, value: form.linkValue },
        push:  form.push,
      });
      if (d.push) {
        const extra = d.push.failed ? ` · ${d.push.failed} failed (${(d.push.errors || []).join(', ')})` : '';
        toast.success(`Sent — pushed to ${d.push.sent} phone(s)${extra}.`);
      } else {
        toast.success('Saved to the app inbox.');
      }
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.message || 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  const remove = async (n) => {
    if (!confirm(`Remove "${n.title}" from every user's inbox? (A phone push that already went out can't be recalled.)`)) return;
    try {
      await req(`/api/admin/app-notifications/${n.id}`, 'DELETE');
      toast.success('Removed.');
      load();
    } catch (err) {
      toast.error(err.message || 'Delete failed.');
    }
  };

  const cancelQueued = async (q) => {
    try {
      await req(`/api/admin/push/queue/${encodeURIComponent(q.key)}`, 'DELETE');
      toast.success('Automatic push cancelled.');
      load();
    } catch (err) {
      toast.error(err.message || 'Cancel failed.');
    }
  };

  const audienceLabel = (n) => n.audience === 'email' ? n.target_email : (AUDIENCES.find((a) => a.v === n.audience)?.label || n.audience);

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Engagement</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">App notifications</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Messages appear on the app&apos;s Notifications page (the bell on the Library) and, if you choose,
            as a phone push. New videos and books are announced automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-zinc-600">
            <Smartphone className="h-4 w-4" />
            <b className="text-ink">{devices.total}</b> phones registered · {devices.signedIn} signed in
          </div>
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Composer */}
        <form onSubmit={send} className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <Send className="h-4 w-4 text-zinc-500" /> New notification
          </div>
          <div className="grid gap-3">
            <div>
              <div className="label">Title <span className="text-zinc-400">({form.title.length}/80)</span></div>
              <input className="input w-full" maxLength={80} value={form.title}
                placeholder="e.g. This Sunday's lesson is live" onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div>
              <div className="label">Message <span className="text-zinc-400">({form.body.length}/400)</span></div>
              <textarea className="input min-h-[90px] w-full" maxLength={400} value={form.body}
                placeholder="Optional details…" onChange={(e) => set({ body: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="label">Send to</div>
                <select className="input w-full" value={form.audience} onChange={(e) => set({ audience: e.target.value })}>
                  {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
                </select>
              </div>
              {form.audience === 'email' && (
                <div>
                  <div className="label">User email</div>
                  <input className="input w-full" type="email" value={form.email}
                    placeholder="user@example.com" onChange={(e) => set({ email: e.target.value })} />
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="label">When tapped, open</div>
                <select className="input w-full" value={form.linkType}
                  onChange={(e) => set({ linkType: e.target.value, linkValue: e.target.value === 'screen' ? screens[0] : '' })}>
                  <option value="none">Just the notification</option>
                  <option value="screen">A screen in the app</option>
                  <option value="book">A book</option>
                  <option value="url">A web link</option>
                </select>
              </div>
              {form.linkType === 'screen' && (
                <div>
                  <div className="label">Screen</div>
                  <select className="input w-full" value={form.linkValue} onChange={(e) => set({ linkValue: e.target.value })}>
                    {screens.map((s) => <option key={s} value={s}>{SCREEN_LABELS[s] || s}</option>)}
                  </select>
                </div>
              )}
              {form.linkType === 'book' && (
                <div>
                  <div className="label">Book</div>
                  <select className="input w-full" value={form.linkValue} onChange={(e) => set({ linkValue: e.target.value })}>
                    <option value="">Choose a book…</option>
                    {books.map((b) => <option key={b.slug} value={b.slug}>{b.title}{b.available === false ? ' (hidden)' : ''}</option>)}
                  </select>
                </div>
              )}
              {form.linkType === 'url' && (
                <div>
                  <div className="label">Web link</div>
                  <input className="input w-full" value={form.linkValue} placeholder="https://gospelar.com/…"
                    onChange={(e) => set({ linkValue: e.target.value })} />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={form.push} onChange={(e) => set({ push: e.target.checked })} />
              Also send as a phone push
              {form.push && reach != null && <span className="text-zinc-400">— reaches {reach} phone{reach === 1 ? '' : 's'}</span>}
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn-primary" disabled={sending}>
              <Send className="h-3.5 w-3.5" /> {sending ? 'Sending…' : 'Send notification'}
            </button>
          </div>
        </form>

        {/* Phone preview */}
        <div className="card p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Preview</div>
          <div className="rounded-2xl bg-zinc-900 p-3">
            <div className="rounded-xl bg-white/95 p-3 shadow">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
                <div className="flex h-4 w-4 items-center justify-center rounded bg-blue-600 text-[9px] font-black text-white">G</div>
                Gospelar · now
              </div>
              <div className="text-sm font-semibold text-zinc-900">{form.title || 'Notification title'}</div>
              <div className="mt-0.5 line-clamp-3 text-[13px] text-zinc-600">{form.body || 'Your message appears here.'}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Users who switched notifications off in their profile get no push, but still see it in the app.
          </p>
        </div>
      </div>

      {/* Automatic pushes waiting */}
      {queue.length > 0 && (
        <div className="card mb-5 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <Clock className="h-4 w-4 text-zinc-500" /> Automatic pushes waiting to go out
          </div>
          <div className="divide-y divide-zinc-100">
            {queue.map((q) => (
              <div key={q.key} className="flex items-center justify-between py-2 text-sm">
                <div>
                  {KIND_BADGE[q.kind] || <Badge>{q.kind}</Badge>}
                  <span className="ml-2 font-mono text-zinc-700">{q.ref}</span>
                  <span className="ml-2 text-zinc-500">at {fmtWhen(q.due_at)}</span>
                </div>
                <button onClick={() => cancelQueued(q)} className="btn-soft text-xs">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">No notifications sent yet.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5">Notification</th>
                  <th className="px-5 py-2.5">Type</th>
                  <th className="px-5 py-2.5">Audience</th>
                  <th className="px-5 py-2.5">Phone push</th>
                  <th className="px-5 py-2.5">Sent</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((n) => (
                  <tr key={n.id} className="align-top hover:bg-zinc-25">
                    <td className="max-w-[360px] px-5 py-2.5">
                      <div className="font-semibold text-ink">{n.title}</div>
                      {n.body && <div className="mt-0.5 line-clamp-2 text-[12px] text-zinc-500">{n.body}</div>}
                    </td>
                    <td className="px-5 py-2.5">{KIND_BADGE[n.kind] || <Badge>{n.kind}</Badge>}</td>
                    <td className="px-5 py-2.5 text-zinc-700">{audienceLabel(n)}</td>
                    <td className="px-5 py-2.5 tabular text-zinc-700">
                      {n.pushed
                        ? <>{n.push_sent} sent{n.push_failed ? <span className="text-red-600"> · {n.push_failed} failed</span> : null}</>
                        : <span className="text-zinc-400">In-app only</span>}
                    </td>
                    <td className="px-5 py-2.5 tabular text-zinc-500">{fmtWhen(n.created_at)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button onClick={() => remove(n)} className="btn-ghost text-xs" title="Remove from inbox">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
