// apiFailover.js
// ─────────────────────────────────────────────────────────────────────────────
// api.gospelar.com and api2.gospelar.com are two hostnames for the SAME backend
// (same Railway service, same database). This module wraps window.fetch so any
// request to either hostname goes to whichever one is healthy:
//
//   • Requests go to the preferred host (api.gospelar.com by default).
//   • If that host can't be reached (DNS / TLS / connection error), the same
//     request is retried once on the other host.
//   • GET/HEAD requests also fail over on gateway errors (502/503/504/52x).
//     Writes (POST/PUT/DELETE) only fail over on connection errors, so a
//     request the server may already have processed is never sent twice.
//   • A request the caller aborted (timeout / cancel) is never retried.
//   • After a failover the working host is remembered for 30 min, then the
//     primary is tried again, so traffic drifts back once it recovers.
//
// Requests to any other origin (localhost, third-party APIs) pass through
// untouched. Keep this file identical across maindashboard, churchdashboard
// and gospelarregistration.
// ─────────────────────────────────────────────────────────────────────────────

export const API_HOSTS = ['https://api.gospelar.com', 'https://api2.gospelar.com'];
export const PRIMARY_API = API_HOSTS[0];

const PREF_KEY  = 'gospelar_api_host';
const STICKY_MS = 30 * 60 * 1000;
const RETRY_STATUS = new Set([502, 503, 504, 520, 521, 522, 523, 524, 530]);
const IDEMPOTENT   = new Set(['GET', 'HEAD', 'OPTIONS']);

let state = (() => {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (p && API_HOSTS.includes(p.host)) return p;
  } catch { /* storage blocked — use the primary */ }
  return { host: PRIMARY_API, at: 0 };
})();

const listeners = new Set();

// The host requests currently go to. A fallback preference expires after
// STICKY_MS so the primary gets retried.
export function activeApiHost() {
  if (state.host !== PRIMARY_API && Date.now() - state.at > STICKY_MS) {
    state = { host: PRIMARY_API, at: 0 };
  }
  return state.host;
}

export function onApiHostChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setActive(host) {
  if (host === state.host) return;
  state = { host, at: Date.now() };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((fn) => { try { fn(host); } catch { /* ignore */ } });
}

// True for any URL on one of the Gospelar API hostnames.
export function isGospelarApi(url) {
  return API_HOSTS.some((h) => url === h || String(url).startsWith(h + '/'));
}

function pathOf(url) {
  const h = API_HOSTS.find((x) => url === x || url.startsWith(x + '/'));
  return h ? url.slice(h.length) : null;
}

export function installApiFailover() {
  if (typeof window === 'undefined' || !window.fetch || window.fetch.__gospelarFailover) return;
  const nativeFetch = window.fetch.bind(window);

  const wrapped = async (input, init = {}) => {
    const url  = typeof input === 'string' ? input : input instanceof URL ? input.href : null;
    const path = url ? pathOf(url) : null;
    if (path == null) return nativeFetch(input, init);   // not our API → untouched

    const method  = String(init.method || 'GET').toUpperCase();
    const first   = activeApiHost();
    const order   = [first, ...API_HOSTS.filter((h) => h !== first)];
    let gatewayRes = null;
    let lastErr    = null;

    for (let i = 0; i < order.length; i++) {
      const host = order[i];
      const last = i === order.length - 1;
      try {
        const res = await nativeFetch(host + path, init);
        if (!last && IDEMPOTENT.has(method) && RETRY_STATUS.has(res.status)) {
          gatewayRes = res;                                  // try the other host
          continue;
        }
        if (!RETRY_STATUS.has(res.status)) setActive(host);
        return res;
      } catch (e) {
        if (init.signal?.aborted || e?.name === 'AbortError') throw e;   // caller cancelled
        lastErr = e;
        if (last) break;
      }
    }
    if (gatewayRes) return gatewayRes;
    throw lastErr;
  };

  wrapped.__gospelarFailover = true;
  window.fetch = wrapped;
}

// Install on import: main.jsx imports this module first, so the wrapper is in
// place before any other module can issue a request.
installApiFailover();
