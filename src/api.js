// Thin fetch wrapper. Errors carry .status so callers can fail-soft on 404.
export async function apiRequest(api, key, path, method = 'GET', body = null) {
  const res = await fetch(api + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Bound helper — pass the auth context once, get a `req(path, ...)` back.
export function makeReq(api, key) {
  return (path, method, body) => apiRequest(api, key, path, method, body);
}
