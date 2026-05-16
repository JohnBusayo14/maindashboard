import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Eye, RefreshCcw, Building2, Search, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function Churches() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal]     = useState(null);   // { name, invite_code, admin_token }
  const [editing, setEditing]   = useState(null);   // church row being edited
  const [deleting, setDeleting] = useState(null);   // church row pending delete

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/admin/churches');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e.status === 404) {
        toast.error('Backend missing churches endpoint — redeploy required.');
      } else {
        toast.error(e.message || 'Failed to load churches.');
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((c) =>
      c.name?.toLowerCase().includes(term) ||
      c.location?.toLowerCase().includes(term) ||
      c.admin_email?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      // Fallback: inline prompt so the admin can copy manually
      window.prompt(`Copy ${label}:`, text);
    }
  };

  const revealToken = async (church) => {
    try {
      const list = await req('/api/admin/churches?include=token');
      const row  = list.find((r) => r.id === church.id);
      if (!row?.admin_token) {
        toast.error('Token not available — refresh the page.');
        return;
      }
      setReveal({ name: church.name, invite_code: church.invite_code, admin_token: row.admin_token });
    } catch (e) {
      toast.error(e.message || 'Reveal failed.');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Churches</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Churches</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Each church has an invite code (for teachers) and an admin token (for the church admin).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Create church
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, location, email…"
            className="w-full rounded-lg ring-1 ring-zinc-200 bg-white pl-8 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          />
        </div>
        <span className="text-xs text-zinc-500">{filtered.length} of {rows.length}</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto h-8 w-8 text-zinc-300" />
            <div className="mt-3 text-sm font-semibold text-zinc-700">
              {rows.length === 0 ? 'No churches yet' : 'No churches match'}
            </div>
            {rows.length === 0 && (
              <button onClick={() => setCreating(true)} className="btn-primary mt-4">
                <Plus className="h-4 w-4" /> Create one
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-25">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5">Church</th>
                  <th className="px-5 py-2.5">Admin email</th>
                  <th className="px-5 py-2.5">Invite code</th>
                  <th className="px-5 py-2.5">Token</th>
                  <th className="px-5 py-2.5 text-right">Teachers</th>
                  <th className="px-5 py-2.5 text-right">Classes</th>
                  <th className="px-5 py-2.5">Created</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-25">
                    <td className="px-5 py-2.5">
                      <div className="font-semibold text-ink">{c.name}</div>
                      {c.location && <div className="mt-0.5 text-[11px] text-zinc-500">{c.location}</div>}
                    </td>
                    <td className="px-5 py-2.5 text-zinc-700">{c.admin_email}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1">
                        <code className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px]">{c.invite_code}</code>
                        <button
                          onClick={() => copy(c.invite_code, 'Invite code')}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                          title="Copy"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <button
                        onClick={() => revealToken(c)}
                        className="btn-soft text-xs"
                      >
                        <Eye className="h-3.5 w-3.5" /> Reveal
                      </button>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular">
                      <Badge variant="blue">{c.teachers ?? 0}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular">
                      <Badge variant="amber">{c.classes ?? 0}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-zinc-500 tabular">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(c)}
                          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                          title="Edit church"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(c)}
                          className="rounded p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
                          title="Delete church"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <CreateChurchModal
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            setReveal({
              name:        created.name,
              invite_code: created.invite_code,
              admin_token: created.admin_token,
            });
            load();
          }}
          req={req}
          toast={toast}
        />
      )}

      {reveal && (
        <RevealModal reveal={reveal} onClose={() => setReveal(null)} copy={copy} />
      )}

      {editing && (
        <EditChurchModal
          church={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          req={req}
          toast={toast}
        />
      )}

      {deleting && (
        <DeleteChurchModal
          church={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); load(); }}
          req={req}
          toast={toast}
        />
      )}
    </div>
  );
}

function CreateChurchModal({ onClose, onSaved, req, toast }) {
  const [name, setName]         = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail]       = useState('');
  const [saving, setSaving]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim())  return toast.error('Church name is required.');
    if (!email.trim()) return toast.error('Admin email is required.');
    setSaving(true);
    try {
      const created = await req('/api/admin/churches', 'POST', {
        name:        name.trim(),
        location:    location.trim() || null,
        admin_email: email.trim().toLowerCase(),
      });
      toast.success(`Church created: ${created.name}`);
      onSaved(created);
    } catch (err) {
      toast.error(err.message || 'Create failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Create church"
      sub="Generates an invite code (for teachers) and an admin token (for the church admin)."
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Creating…' : 'Create church'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="label">Church name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gospelar Lagos" />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label">Admin email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pastor@church.org"
          />
        </div>
      </form>
    </Modal>
  );
}

function RevealModal({ reveal, onClose, copy }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Credentials for ${reveal.name}`}
      sub="The token won't be shown again on subsequent loads — copy it now."
      size="md"
      footer={<button onClick={onClose} className="btn-primary">Done</button>}
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="label">Invite code <span className="font-normal normal-case tracking-normal text-zinc-500">— give to teachers</span></div>
          <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200">
            <code className="flex-1 break-all text-sm">{reveal.invite_code}</code>
            <button onClick={() => copy(reveal.invite_code, 'Invite code')} className="btn-soft text-xs">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        </div>
        <div>
          <div className="label">Admin token <span className="font-normal normal-case tracking-normal text-zinc-500">— give to church admin</span></div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
            <code className="flex-1 break-all text-sm">{reveal.admin_token}</code>
            <button onClick={() => copy(reveal.admin_token, 'Admin token')} className="btn-soft text-xs !bg-amber-100 !text-amber-800 hover:!bg-amber-200">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Treat this like a password — don't share publicly.</p>
        </div>
      </div>
    </Modal>
  );
}

function EditChurchModal({ church, onClose, onSaved, req, toast }) {
  const [name, setName]         = useState(church.name || '');
  const [location, setLocation] = useState(church.location || '');
  const [email, setEmail]       = useState(church.admin_email || '');
  const [saving, setSaving]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim())  return toast.error('Church name is required.');
    if (!email.trim()) return toast.error('Admin email is required.');
    setSaving(true);
    try {
      await req(`/api/admin/churches/${church.id}`, 'PUT', {
        name:        name.trim(),
        location:    location.trim() || null,
        admin_email: email.trim().toLowerCase(),
      });
      toast.success(`Church updated: ${name.trim()}`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit church"
      sub="Invite code and admin token are not editable here — they're managed separately."
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="label">Church name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label">Admin email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

function DeleteChurchModal({ church, onClose, onDeleted, req, toast }) {
  const [preview, setPreview] = useState(null);   // { teachers, classes, students }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  // Type-to-confirm gate. The user must type the church name exactly before
  // the Delete button enables — kills muscle-memory double-clicks that wipe
  // the wrong tenant.
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await req(`/api/admin/churches/${church.id}`, 'DELETE');
        if (!cancelled) setPreview(data?.preview || null);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load impact preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Only run once per modal mount — church.id is stable inside this modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDelete = async () => {
    if (confirmText.trim() !== church.name) {
      return toast.error('Type the church name exactly to confirm.');
    }
    setBusy(true);
    try {
      await req(`/api/admin/churches/${church.id}?confirm=1`, 'DELETE');
      toast.success(`Deleted ${church.name}.`);
      onDeleted();
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${church.name}?`}
      sub="Destructive. The church row and its dependent data will be permanently removed."
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={confirmDelete}
            disabled={busy || loading || confirmText.trim() !== church.name}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete church'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="text-sm text-zinc-500">Loading impact preview…</div>
        ) : preview ? (
          <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 px-3 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800">What will happen</div>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-rose-900">
              <li>• <strong>{preview.classes ?? 0}</strong> class(es) will be deleted (cascade)</li>
              <li>• <strong>{preview.students ?? 0}</strong> student(s) and their attendance / marks will be deleted</li>
              <li>• <strong>{preview.teachers ?? 0}</strong> teacher account(s) will be detached (kept, with church_id cleared)</li>
            </ul>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Couldn't load preview — delete will still work, but counts are unknown.</div>
        )}

        <div>
          <label className="label">
            Type <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[12px]">{church.name}</code> to confirm
          </label>
          <input
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={church.name}
            autoFocus
          />
        </div>
      </div>
    </Modal>
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
