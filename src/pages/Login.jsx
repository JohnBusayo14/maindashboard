import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, KeyRound, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { apiRequest } from '../api.js';

export default function Login() {
  const { isAuthed, signIn, api } = useAuth();
  const nav = useNavigate();

  const [adminKey, setKey]  = useState('');
  const [showKey, setShow]  = useState(false);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState('');

  if (isAuthed) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setError('Admin key is required.');
      return;
    }
    setLoad(true);
    setError('');
    try {
      await apiRequest(api, adminKey.trim(), '/api/admin/hymns');
      signIn(api, adminKey);
      nav('/', { replace: true });
    } catch (err) {
      setError(
        err.status === 401 || err.status === 403
          ? 'Invalid admin key — double-check the value from your environment.'
          : err.status === 404
          ? 'API is reachable but the admin route is missing.'
          : err.message || 'Could not reach the API. Check your connection.',
      );
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-25 px-4 py-12">
      {/* Background decoration — subtle radial gradients, no images required */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-100 blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-brand-50 blur-3xl opacity-70" />
      </div>

      <div className="w-full max-w-[420px]">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-brand-600/20 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-cta ring-1 ring-white/20">
              <ShieldCheck className="h-8 w-8" strokeWidth={2.25} />
            </div>
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
            Gospelar Admin
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Sign in to manage Sunday School content.
          </p>
        </div>

        {/* Card */}
        <form onSubmit={submit} className="card overflow-hidden">
          <div className="space-y-4 p-6">
            <div>
              <label className="label flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
                Admin Key
              </label>
              <div className="relative">
                <input
                  className="input pr-11 font-mono text-sm tracking-wide"
                  type={showKey ? 'text' : 'password'}
                  value={adminKey}
                  onChange={(e) => { setKey(e.target.value); if (error) setError(''); }}
                  placeholder="Enter your x-admin-key"
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                  tabIndex={-1}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 group"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>

          {/* Footer band */}
          <div className="flex items-center justify-center gap-1.5 border-t border-zinc-100 bg-zinc-25 px-6 py-3 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Credentials stored locally — never sent except to your API.</span>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Connecting to <span className="font-mono text-zinc-500">{api.replace(/^https?:\/\//, '')}</span>
        </p>
      </div>
    </div>
  );
}
