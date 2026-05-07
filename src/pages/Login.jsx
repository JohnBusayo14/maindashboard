import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { apiRequest } from '../api.js';

export default function Login() {
  const { isAuthed, signIn, api: defaultApi } = useAuth();
  const nav = useNavigate();

  const [api, setApi]       = useState(defaultApi);
  const [adminKey, setKey]  = useState('');
  const [showKey, setShow]  = useState(false);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState('');

  if (isAuthed) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!api.trim() || !adminKey.trim()) {
      setError('API URL and admin key are required.');
      return;
    }
    setLoad(true);
    setError('');
    try {
      // Probe a cheap admin-gated route to verify the key is valid before
      // persisting. /api/admin/hymns is small and quick.
      await apiRequest(api.trim(), adminKey.trim(), '/api/admin/hymns');
      signIn(api, adminKey);
      nav('/', { replace: true });
    } catch (err) {
      setError(
        err.status === 401 || err.status === 403
          ? 'Invalid admin key.'
          : err.status === 404
          ? 'API URL is reachable but the admin route is missing — check the URL.'
          : err.message || 'Could not reach the API.',
      );
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-25 px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-cta">
            <span className="text-lg font-extrabold">G</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">GOFAMINT Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to manage Sunday School content.</p>
        </div>

        {/* Card */}
        <form onSubmit={submit} className="card p-6">
          <div className="mb-4">
            <label className="label">API URL</label>
            <input
              className="input"
              value={api}
              onChange={(e) => setApi(e.target.value)}
              placeholder="https://your-api.example.com"
              autoComplete="url"
            />
          </div>

          <div className="mb-4">
            <label className="label">Admin Key</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showKey ? 'text' : 'password'}
                value={adminKey}
                onChange={(e) => setKey(e.target.value)}
                placeholder="x-admin-key value"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Credentials stored locally — never sent anywhere except your API.
          </div>
        </form>
      </div>
    </div>
  );
}
