import { useSyncExternalStore } from 'react';

/**
 * Reloj sincronizado con el servidor: todos los navegadores muestran el mismo
 * temporizador aunque el reloj local de la computadora esté adelantado o atrasado.
 */
let offset = 0;
let bestRtt = Infinity;

export function syncClock(serverTime, sentAt, receivedAt = Date.now()) {
  if (!Number.isFinite(serverTime)) return;
  const rtt = Math.max(receivedAt - sentAt, 0);
  // Preferimos las muestras con menor latencia (más precisas).
  if (rtt <= bestRtt * 1.5 + 30) {
    offset = serverTime + rtt / 2 - receivedAt;
    bestRtt = Math.min(bestRtt, rtt);
  }
}

export const serverNow = () => Date.now() + offset;

// Un único intervalo global alimenta a todos los temporizadores de la página.
let now = serverNow();
const listeners = new Set();
let timer = null;

function subscribe(cb) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = serverNow();
      listeners.forEach((l) => l());
    }, 500);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) { clearInterval(timer); timer = null; }
  };
}

/** Hora actual del servidor, se re-renderiza cada medio segundo. */
export function useNow() {
  return useSyncExternalStore(subscribe, () => now);
}
