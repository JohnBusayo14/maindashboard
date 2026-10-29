import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, RefreshCcw, Pencil, Trash2, Eye, EyeOff, Upload, Play, Search, Film,
  ImageIcon, AlertTriangle, Loader2,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { makeReq } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Sunday School video library — admin console.
//
// Same backend as the mobile admin screens (/api/admin/videos/*), reached
// with this dashboard's x-admin-key. Files never pass through our server:
// the backend issues a short-lived signed URL per file and the browser PUTs
// straight to the private Supabase Storage bucket, then asks the backend to
// verify the upload before it goes live.
//
// Save pipeline (Retry resumes at the failed step):
//   metadata → video file → thumbnail → publish (if "Save & publish")
// ─────────────────────────────────────────────────────────────────────────────

const AGE_LABELS = { children: 'Children', teens: 'Teenagers', adults: 'Adults', all: 'All ages' };
const MB = 1024 * 1024;
const PAGE = 24;

const fmtBytes = (n) => (!n ? '—' : n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDur = (s) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function statusOf(v) {
  if (!v.has_video) return v.upload_pending ? ['Upload incomplete', 'red'] : ['No video file', 'red'];
  return v.published ? ['Published', 'green'] : ['Draft', 'amber'];
}

export default function Videos() {
  const { api, key } = useAuth();
  const req = useMemo(() => makeReq(api, key), [api, key]);
  const toast = useToast();

  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);     // {} new | video
  const [previewing, setPreviewing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async (offset = 0) => {
    const id = ++reqId.current;
    if (offset === 0) setLoading(true);
    try {
      const qs = new URLSearchParams({ status, limit: String(PAGE), offset: String(offset) });
      if (search.trim()) qs.set('search', search.trim());
      const data = await req(`/api/admin/videos?${qs}`);
      if (id !== reqId.current) return;
      setRows((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
      setNext(data.next_offset);
      setLoadError(null);
    } catch (e) {
      if (id !== reqId.current) return;
      setLoadError(e.message || 'Failed to load videos.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [req, status, search]);

  useEffect(() => {
    const t = setTimeout(() => load(0), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    req('/api/admin/videos/meta').then(setMeta).catch(() => {});
  }, [req]);

  const replace = (v) => setRows((prev) => prev.map((r) => (r.id === v.id ? v : r)));

  const togglePublish = async (v) => {
    setBusyId(v.id);
    try {
      const updated = await req(`/api/admin/videos/${v.id}/publish`, 'POST', { published: !v.published });
      replace(updated);
      toast.success(updated.published ? 'Published — visible to every signed-in user.' : 'Unpublished — now a draft.');
    } catch (e) {
      toast.error(e.message || 'Could not change visibility.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (v) => {
    if (!confirm(`Permanently delete "${v.title}" and its files? This cannot be undone.`)) return;
    setBusyId(v.id);
    try {
      await req(`/api/admin/videos/${v.id}`, 'DELETE');
      setRows((prev) => prev.filter((r) => r.id !== v.id));
      toast.success('Video deleted.');
    } catch (e) {
      toast.error(e.message || 'Delete failed.');
      load(0);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Content</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Video library</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Short Sunday School videos for the mobile app. Only published videos are visible to users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(0)} className="btn-ghost" disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setEditing({})} className="btn-primary">
            <Plus className="h-4 w-4" /> New video
          </button>
        </div>
      </div>

      {meta && meta.storage_configured === false && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>Video storage isn't configured on the server yet.</b> You can save details as drafts, but uploads and
            playback will fail until <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> are set on the backend.
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[['all', 'All'], ['draft', 'Drafts'], ['published', 'Published']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 transition ${
              status === k ? 'bg-ink text-white ring-ink' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'}`}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="input pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or category…"
          />
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse"><div className="aspect-video bg-zinc-100" /><div className="h-24" /></div>
          ))}
        </div>
      ) : loadError ? (
        <div className="card py-12 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <div className="mt-3 text-sm font-semibold text-zinc-700">Couldn't load videos</div>
          <div className="mt-1 text-sm text-zinc-500">{loadError}</div>
          <button onClick={() => load(0)} className="btn-primary mt-4">Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="card py-16 text-center">
          <Film className="mx-auto h-8 w-8 text-zinc-300" />
          <div className="mt-3 text-sm font-semibold text-zinc-700">
            {search || status !== 'all' ? 'No videos match' : 'No videos yet'}
          </div>
          {!search && status === 'all' && (
            <button onClick={() => setEditing({})} className="btn-primary mt-4">
              <Plus className="h-4 w-4" /> Upload the first one
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((v) => (
              <VideoCard
                key={v.id}
                v={v}
                busy={busyId === v.id}
                onEdit={() => setEditing(v)}
                onPreview={() => setPreviewing(v)}
                onToggle={() => togglePublish(v)}
                onDelete={() => remove(v)}
              />
            ))}
          </div>
          {next != null && (
            <div className="mt-6 text-center">
              <button onClick={() => load(next)} className="btn-ghost">Load more</button>
            </div>
          )}
        </>
      )}

      {editing && (
        <VideoModal
          initial={editing}
          meta={meta}
          req={req}
          toast={toast}
          onClose={() => setEditing(null)}
          onChanged={(v) => {
            setRows((prev) => (prev.some((r) => r.id === v.id) ? prev.map((r) => (r.id === v.id ? v : r)) : [v, ...prev]));
          }}
        />
      )}
      {previewing && <PreviewModal video={previewing} req={req} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

function VideoCard({ v, busy, onEdit, onPreview, onToggle, onDelete }) {
  const [label, variant] = statusOf(v);
  return (
    <div className="card overflow-hidden">
      <button onClick={v.has_video ? onPreview : onEdit} className="group relative block aspect-video w-full bg-zinc-100">
        {v.thumbnail_url
          ? <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-zinc-300"><Film className="h-10 w-10" /></div>}
        {v.has_video && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
            <Play className="h-10 w-10 text-white opacity-0 drop-shadow transition group-hover:opacity-100" fill="white" />
          </span>
        )}
        {fmtDur(v.duration_seconds) && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {fmtDur(v.duration_seconds)}
          </span>
        )}
      </button>
      <div className="p-4">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[15px] font-semibold text-ink">{v.title}</h3>
          <Badge variant={variant} className="shrink-0">{label}</Badge>
        </div>
        {v.bible_reference && <div className="mb-1 text-xs font-semibold text-brand-700">{v.bible_reference}</div>}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="blue">{v.category}</Badge>
          <Badge variant="zinc">{AGE_LABELS[v.age_group] || v.age_group}</Badge>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          {fmtBytes(v.file_size_bytes)} · {v.published ? `Published ${fmtDate(v.published_at)}` : `Created ${fmtDate(v.created_at)}`}
          {v.uploaded_by_email ? ` · ${v.uploaded_by_email}` : ''}
        </div>
        <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-3">
          <button onClick={onEdit} className="btn-ghost text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button
            onClick={onToggle}
            disabled={busy || !v.has_video}
            title={v.has_video ? '' : 'Upload a video file first'}
            className="btn-ghost text-xs disabled:opacity-50"
          >
            {v.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {v.published ? 'Unpublish' : 'Publish'}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete video"
            className="ml-auto rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create / edit + upload ───────────────────────────────────────────────────

const LIMITS = { title: 120, description: 2000, bible_reference: 120, category: 60 };
const formOf = (v) => ({
  title: v?.title || '', description: v?.description || '', bible_reference: v?.bible_reference || '',
  category: v?.category || '', age_group: v?.age_group || 'all',
});

function readDuration(file) {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (d) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) && d > 0 ? d : null); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    el.src = url;
  });
}

function putFile(url, file, headers, onProgress, xhrRef) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('PUT', url);
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = '';
      try { const b = JSON.parse(xhr.responseText); msg = b.message || b.error || ''; } catch { /* not JSON */ }
      reject(Object.assign(new Error(msg ? `Upload failed: ${msg}` : `Upload failed (HTTP ${xhr.status}).`), { stage: 'upload' }));
    };
    xhr.onerror = () => reject(Object.assign(new Error('Network error during upload. Check your connection and retry.'), { stage: 'upload' }));
    xhr.onabort = () => reject(Object.assign(new Error('Upload cancelled.'), { stage: 'upload', cancelled: true }));
    xhr.send(file);
  });
}

function VideoModal({ initial, meta, req, toast, onClose, onChanged }) {
  const [video, setVideo] = useState(initial.id ? initial : null);
  const [form, setForm] = useState(formOf(initial));
  const [errors, setErrors] = useState({});
  const [videoFile, setVideoFile] = useState(null);   // { file, duration }
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [phase, setPhase] = useState('idle');          // idle | saving | video | thumbnail | publishing
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState(null);        // { message, publish }
  const xhrRef = useRef(null);
  const failedStage = useRef({ video: null, thumbnail: null });
  const busy = phase !== 'idle';

  const limits = {
    video: meta?.max_video_bytes || 50 * MB,
    thumb: meta?.max_thumbnail_bytes || 5 * MB,
    videoTypes: meta?.video_types || ['video/mp4', 'video/quicktime', 'video/x-m4v'],
    imageTypes: meta?.image_types || ['image/jpeg', 'image/png', 'image/webp'],
  };
  const suggestions = meta?.suggested_categories || [];

  useEffect(() => () => { if (thumbPreview) URL.revokeObjectURL(thumbPreview); }, [thumbPreview]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const dirty = Object.keys(form).some((k) => String(form[k]).trim() !== String(formOf(video)[k]).trim());

  const onVideo = async (file) => {
    if (!file) return;
    if (!limits.videoTypes.includes(file.type)) return toast.error('Please choose an MP4 or MOV video.');
    if (file.size > limits.video) return toast.error(`This video is ${fmtBytes(file.size)}; the limit is ${fmtBytes(limits.video)}. Export at 720p and try again.`);
    setVideoFile({ file, duration: await readDuration(file) });
    failedStage.current.video = null;
  };

  const onThumb = (file) => {
    if (!file) return;
    if (!limits.imageTypes.includes(file.type)) return toast.error('Please choose a JPEG, PNG or WebP image.');
    if (file.size > limits.thumb) return toast.error(`Image is ${fmtBytes(file.size)}; the limit is ${fmtBytes(limits.thumb)}.`);
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
    failedStage.current.thumbnail = null;
  };

  const sendFile = async (id, kind, file, duration) => {
    setPhase(kind);
    setProgress(0);
    try {
      if (failedStage.current[kind] === 'complete') {
        try {
          return await req(`/api/admin/videos/${id}/complete-upload`, 'POST', { kind, duration_seconds: duration });
        } catch (e) {
          if (e.status !== 409) throw Object.assign(e, { stage: 'complete' });
        }
      }
      const ticket = await req(`/api/admin/videos/${id}/upload-url`, 'POST', {
        kind, content_type: file.type, size_bytes: file.size,
      }).catch((e) => { throw Object.assign(e, { stage: 'request' }); });
      await putFile(ticket.upload_url, file, ticket.headers, setProgress, xhrRef);
      setProgress(1);
      const updated = await req(`/api/admin/videos/${id}/complete-upload`, 'POST', { kind, duration_seconds: duration })
        .catch((e) => { throw Object.assign(e, { stage: 'complete' }); });
      failedStage.current[kind] = null;
      return updated;
    } catch (e) {
      failedStage.current[kind] = e.stage || null;
      throw e;
    } finally {
      xhrRef.current = null;
    }
  };

  const save = async (publish) => {
    if (busy) return;
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.category.trim()) errs.category = 'Category is required.';
    for (const [k, max] of Object.entries(LIMITS)) if (form[k].trim().length > max) errs[k] = `Max ${max} characters.`;
    if (publish && !videoFile && !video?.has_video) errs.file = 'Choose a video file before publishing.';
    if (Object.keys(errs).length) return setErrors(errs);

    setFailure(null);
    let current = video;
    try {
      if (!current || dirty) {
        setPhase('saving');
        current = current
          ? await req(`/api/admin/videos/${current.id}`, 'PATCH', form)
          : await req('/api/admin/videos', 'POST', form);
        setVideo(current);
        setForm(formOf(current));
        onChanged(current);
      }
      if (videoFile) {
        current = await sendFile(current.id, 'video', videoFile.file, videoFile.duration);
        setVideo(current); onChanged(current); setVideoFile(null);
      }
      if (thumbFile) {
        current = await sendFile(current.id, 'thumbnail', thumbFile, null);
        setVideo(current); onChanged(current); setThumbFile(null);
      }
      if (publish && !current.published) {
        setPhase('publishing');
        current = await req(`/api/admin/videos/${current.id}/publish`, 'POST', { published: true });
        setVideo(current); onChanged(current);
      }
      toast.success(current.published ? 'Saved — the video is live in the app.' : 'Saved as a draft.');
      onClose();
    } catch (e) {
      if (e.fields) setErrors(e.fields);
      setFailure({ message: e.message || 'Something went wrong.', publish, cancelled: !!e.cancelled });
    } finally {
      setPhase('idle');
    }
  };

  const close = () => {
    if (phase === 'video' || phase === 'thumbnail') {
      if (!confirm('An upload is in progress. Cancel it and close? Your details are saved as a draft.')) return;
      xhrRef.current?.abort();
    }
    onClose();
  };

  const phaseText = {
    saving: 'Saving details…',
    video: progress < 1 ? `Uploading video… ${Math.round(progress * 100)}%` : 'Verifying video…',
    thumbnail: progress < 1 ? `Uploading thumbnail… ${Math.round(progress * 100)}%` : 'Verifying thumbnail…',
    publishing: 'Publishing…',
  }[phase];

  const fileState = videoFile
    ? `${videoFile.file.name} · ${fmtBytes(videoFile.file.size)}${fmtDur(videoFile.duration) ? ` · ${fmtDur(videoFile.duration)}` : ''} — uploads when you save`
    : video?.has_video
      ? `Uploaded · ${fmtBytes(video.file_size_bytes)}${fmtDur(video.duration_seconds) ? ` · ${fmtDur(video.duration_seconds)}` : ''}`
      : video?.upload_pending ? 'Previous upload did not finish — choose the file again' : 'No video chosen yet';

  return (
    <Modal
      open
      onClose={close}
      title={video ? 'Edit video' : 'New video'}
      sub={video ? statusOf(video)[0] : 'Saved as a draft until you publish.'}
      size="lg"
      footer={
        <>
          <button onClick={close} className="btn-ghost">{busy ? 'Cancel upload' : 'Close'}</button>
          <button onClick={() => save(false)} disabled={busy} className="btn-soft">
            {video?.published ? 'Save changes' : 'Save as draft'}
          </button>
          {!video?.published && (
            <button onClick={() => save(true)} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Save & publish
            </button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {failure && (
          <div className={`sm:col-span-2 flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm ring-1 ${
            failure.cancelled ? 'bg-zinc-50 text-zinc-700 ring-zinc-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{failure.message}</div>
            <button onClick={() => save(failure.publish)} disabled={busy} className="btn-ghost text-xs">Retry</button>
          </div>
        )}

        <Field label="Title *" error={errors.title} count={`${form.title.length}/${LIMITS.title}`} span>
          <input className="input" value={form.title} maxLength={LIMITS.title} disabled={busy}
            onChange={(e) => set('title', e.target.value)} placeholder="e.g. David and Goliath" />
        </Field>
        <Field label="Description" error={errors.description} count={`${form.description.length}/${LIMITS.description}`} span>
          <textarea className="input min-h-[96px]" value={form.description} maxLength={LIMITS.description} disabled={busy}
            onChange={(e) => set('description', e.target.value)} placeholder="What will children learn from this video?" />
        </Field>
        <Field label="Bible reference" error={errors.bible_reference}>
          <input className="input" value={form.bible_reference} maxLength={LIMITS.bible_reference} disabled={busy}
            onChange={(e) => set('bible_reference', e.target.value)} placeholder="e.g. 1 Samuel 17:1–50" />
        </Field>
        <Field label="Age group" error={errors.age_group}>
          <select className="input" value={form.age_group} disabled={busy} onChange={(e) => set('age_group', e.target.value)}>
            {(meta?.age_groups || Object.keys(AGE_LABELS)).map((a) => <option key={a} value={a}>{AGE_LABELS[a] || a}</option>)}
          </select>
        </Field>
        <Field label="Category *" error={errors.category} span>
          <input className="input" list="video-category-options" value={form.category} maxLength={LIMITS.category} disabled={busy}
            onChange={(e) => set('category', e.target.value)} placeholder="Pick a suggestion or type your own" />
          <datalist id="video-category-options">
            {suggestions.map((c) => <option key={c} value={c} />)}
          </datalist>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((c) => (
                <button key={c} type="button" disabled={busy} onClick={() => set('category', c)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                    form.category === c ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label={`Video file (MP4 or MOV, max ${fmtBytes(limits.video)})`} error={errors.file} span>
          <label className={`flex cursor-pointer items-center gap-3 rounded-lg bg-zinc-25 px-3 py-3 ring-1 ring-zinc-200 hover:bg-zinc-50 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            <Film className="h-5 w-5 shrink-0 text-brand-600" />
            <span className="flex-1 text-sm text-zinc-700">{fileState}</span>
            <span className="btn-soft text-xs">{videoFile || video?.has_video ? 'Replace' : 'Choose file'}</span>
            <input type="file" className="hidden" accept={limits.videoTypes.join(',')}
              onChange={(e) => { onVideo(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </Field>

        <Field label="Thumbnail (optional, 16:9 image)" span>
          <div className="flex items-center gap-3">
            <div className="aspect-video w-36 shrink-0 overflow-hidden rounded-md bg-zinc-100 ring-1 ring-zinc-200">
              {thumbPreview || video?.thumbnail_url
                ? <img src={thumbPreview || video.thumbnail_url} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center text-zinc-300"><ImageIcon className="h-6 w-6" /></div>}
            </div>
            <label className={`btn-soft cursor-pointer text-xs ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              {thumbPreview || video?.thumbnail_url ? 'Change image' : 'Choose image'}
              <input type="file" className="hidden" accept={limits.imageTypes.join(',')}
                onChange={(e) => { onThumb(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        </Field>

        {busy && (
          <div className="sm:col-span-2" role="status" aria-live="polite">
            <div className="mb-1.5 text-sm font-semibold text-zinc-700">{phaseText}</div>
            {(phase === 'video' || phase === 'thumbnail') && (
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, error, count, span, children }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <div className="flex items-baseline justify-between">
        <label className="label">{label}</label>
        {count && <span className="text-[11px] text-zinc-400">{count}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

function PreviewModal({ video, req, onClose }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let cancelled = false;
    req(`/api/admin/videos/${video.id}/playback`)
      .then((d) => !cancelled && setState({ url: d.url }))
      .catch((e) => !cancelled && setState({ error: e.message || 'Could not load the video.' }));
    return () => { cancelled = true; };
  }, [req, video.id]);

  return (
    <Modal open onClose={onClose} title={video.title} sub={statusOf(video)[0]} size="xl">
      {state.loading && <div className="flex aspect-video items-center justify-center rounded-lg bg-black"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
      {state.error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state.url && (
        <video src={state.url} controls autoPlay playsInline className="aspect-video w-full rounded-lg bg-black" />
      )}
      {video.description && <p className="mt-3 whitespace-pre-line text-sm text-zinc-600">{video.description}</p>}
    </Modal>
  );
}
