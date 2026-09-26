import { syncClock } from '../utils/clock';

// Vacío = mismo dominio (la API sirve el SPA). Para un frontend separado: VITE_API_URL=https://mi-api.azurewebsites.net
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const assetUrl = (path) => (path && path.startsWith('/') ? API_BASE + path : path);

const TOKEN_KEY = 'autopuja.token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* almacenamiento no disponible */ }
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || {};
  }
}

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/** Cliente HTTP asíncrono de la Web API. */
export async function api(path, { method = 'GET', body, form, signal } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const sentAt = Date.now();
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.');
  }
  const serverTime = Number(res.headers.get('X-Server-Time'));
  if (serverTime) syncClock(serverTime, sentAt);

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, data.error || `Error ${res.status}`, data.details);
  }
  return data;
}

/** Convierte un objeto de filtros en querystring, omitiendo vacíos. */
export function toQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, Array.isArray(v) ? v.join(',') : v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}
