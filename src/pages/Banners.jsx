import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCcw, Megaphone, Power, ImageOff } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

const fmt = (d) =>
  d ? new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const isLive = (b) => {
  if (!b.is_active) return false;
  const now = Date.now();
  if (b.scheduled_at && new Date(b.scheduled_at).getTime() > now) return false;
  if (b.expires_at   && new Date(b.expires_at).getTime()   <= now) return false;
  return true;
};

export default function Banners() {
  const { api, key } = useAuth();
  const req   = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await req('/api/admin/banners');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load banners.');
    } finally {
      setLoading(false);
    }
  }, [req, toast]);

  useEffect(() => { load(); }, [load]);

  const onToggle = async (b) => {
    try {
      await req(`/api/admin/banners/${b.id}`, 'PUT', { ...b, is_active: !b.is_active });
      toast.success(b.is_active ? 'Banner paused.' : 'Banner activated.');
      load();
    } catch (e) {
      toast.error(e.message || 'Toggle failed.');
    }
  };

  const onDelete = async (b) => {
    if (!confirm(`Delete banner "${b.title || 'untitled'}"?`)) return;
    try {
      await req(`/api/admin/banners/${b.id}`, 'DELETE');
      toast.success('Banner deleted.');
      load();
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Commerce</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Ad banners</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Activating a banner pauses any other active banner — only one shows at a time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setEditing({})} className="btn-primary">
            <Plus className="h-4 w-4" /> New banner
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-6"><Skeleton lines={4} /></div>
      ) : rows.length === 0 ? (
        <div className="card py-16 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-zinc-300" />
          <div className="mt-3 text-sm font-semibold text-zinc-700">No banners yet</div>
          <button onClick={() => setEditing({})} className="btn-primary mt-4">
            <Plus className="h-4 w-4" /> Create one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((b) => (
            <BannerCard
              key={b.id}
              b={b}
              onEdit={() => setEditing(b)}
              onToggle={() => onToggle(b)}
              onDelete={() => onDelete(b)}
            />
          ))}
        </div>
      )}

      {editing && (
        <BannerModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          req={req}
          toast={toast}
        />
      )}
    </div>
  );
}

function BannerCard({ b, onEdit, onToggle, onDelete }) {
  const live = isLive(b);
  const src  = b.image_url || (b.image_base64 ? `data:image/jpeg;base64,${b.image_base64}` : null);

  return (
    <div className="card overflow-hidden">
      {src ? (
        <div className="aspect-[16/9] w-full bg-zinc-100">
          <img src={src} alt={b.title || ''} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-zinc-100 text-zinc-400">
          <ImageOff className="h-8 w-8" />
        </div>
      )}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold text-ink">
            {b.title || 'Untitled banner'}
          </h3>
          {live ? <Badge variant="green">Live</Badge>
                : b.is_active ? <Badge variant="amber">Scheduled</Badge>
                              : <Badge variant="zinc">Paused</Badge>}
        </div>
        <div className="space-y-1 text-xs text-zinc-500">
          {b.link_url && <div>→ {b.link_url}</div>}
          {b.scheduled_at && <div>Starts: {fmt(b.scheduled_at)}</div>}
          {b.expires_at && <div>Ends: {fmt(b.expires_at)}</div>}
        </div>
        <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-3">
          <button onClick={onEdit} className="btn-ghost text-xs">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={onToggle} className="btn-ghost text-xs">
            <Power className="h-3.5 w-3.5" /> {b.is_active ? 'Pause' : 'Activate'}
          </button>
          <button
            onClick={onDelete}
            className="ml-auto rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BannerModal({ initial, onClose, onSaved, req, toast }) {
  const isEdit = !!initial.id;
  const [title, setTitle]         = useState(initial.title || '');
  const [imageUrl, setImageUrl]   = useState(initial.image_url || '');
  const [imageB64, setImageB64]   = useState(initial.image_base64 || '');
  const [linkUrl, setLinkUrl]     = useState(initial.link_url || '');
  const [scheduled, setScheduled] = useState(toLocalInput(initial.scheduled_at));
  const [expires, setExpires]     = useState(toLocalInput(initial.expires_at));
  const [isActive, setActive]     = useState(!!initial.is_active);
  const [saving, setSaving]       = useState(false);

  const onFile = (file) => {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('Image too large — keep it under 1.5 MB or use a URL instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      const stripped = data.includes(',') ? data.split(',')[1] : data;
      setImageB64(stripped);
      setImageUrl('');
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!imageUrl.trim() && !imageB64) {
      return toast.error('Provide either an image URL or upload an image.');
    }
    setSaving(true);
    try {
      const body = {
        title:        title.trim() || null,
        image_url:    imageUrl.trim() || null,
        image_base64: imageUrl.trim() ? null : imageB64 || null,
        link_url:     linkUrl.trim() || null,
        scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
        expires_at:   expires   ? new Date(expires).toISOString()   : null,
        is_active:    isActive,
      };
      if (isEdit) await req(`/api/admin/banners/${initial.id}`, 'PUT', body);
      else        await req('/api/admin/banners', 'POST', body);
      toast.success(isEdit ? 'Banner updated.' : 'Banner created.');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit banner' : 'New banner'}
      sub="Either an image URL or an uploaded file. Active banners auto-pause others."
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Image URL</label>
          <input
            className="input"
            value={imageUrl}
            onChange={(e) => { setImageUrl(e.target.value); setImageB64(''); }}
            placeholder="https://…"
          />
          <p className="mt-1 text-[11px] text-zinc-500">— or — upload below</p>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Upload image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full cursor-pointer rounded-lg ring-1 ring-zinc-200 bg-zinc-25 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
          />
          {imageB64 && !imageUrl && (
            <div className="mt-2 overflow-hidden rounded-md ring-1 ring-zinc-200">
              <img src={`data:image/jpeg;base64,${imageB64}`} className="h-24 w-full object-cover" alt="" />
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="label">Click-through URL</label>
          <input className="input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
        </div>

        <div>
          <label className="label">Starts at</label>
          <input
            type="datetime-local"
            className="input"
            value={scheduled}
            onChange={(e) => setScheduled(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Ends at</label>
          <input
            type="datetime-local"
            className="input"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </div>

        <label className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-zinc-25 px-3 py-2 ring-1 ring-zinc-200">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-600"
          />
          <span className="text-sm font-semibold text-ink">Active</span>
          <span className="text-xs text-zinc-500">Activating pauses other active banners.</span>
        </label>
      </form>
    </Modal>
  );
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
