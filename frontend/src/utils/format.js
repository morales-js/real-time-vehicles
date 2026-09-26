export function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  return `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const km = (n) => (n == null ? '—' : `${Number(n).toLocaleString('es-GT')} km`);

export function dateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
}

export function timeAgo(d, now = Date.now()) {
  const s = Math.max(Math.round((now - new Date(d).getTime()) / 1000), 0);
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export const lot = (id) => `#${String(id).padStart(5, '0')}`;

export function splitDuration(ms) {
  const t = Math.max(Math.floor(ms / 1000), 0);
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60, total: t };
}

const pad = (n) => String(n).padStart(2, '0');

export function shortDuration(ms) {
  const { d, h, m, s } = splitDuration(ms);
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Fase de la subasta en el cliente (con la hora del servidor):
 * PROGRAMADA | ACTIVA | CERRADA (tiempo agotado, esperando confirmación) | VENDIDA | DESIERTA
 */
export function phaseOf(v, now) {
  if (!v) return null;
  if (v.status === 'VENDIDA' || v.status === 'DESIERTA') return v.status;
  const start = new Date(v.startAt).getTime();
  const end = new Date(v.endAt).getTime();
  if (now >= end) return 'CERRADA';
  if (now < start) return 'PROGRAMADA';
  return 'ACTIVA';
}

export const isClosedPhase = (p) => p === 'CERRADA' || p === 'VENDIDA' || p === 'DESIERTA';

/** Date -> valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
