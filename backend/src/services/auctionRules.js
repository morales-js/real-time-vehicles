const config = require('../config');

const toCents = (n) => Math.round(Number(n) * 100);

/**
 * Oferta mínima aceptada:
 *  - Sin pujas: el monto base.
 *  - Con pujas: la oferta actual + 10 %, redondeado hacia arriba al quetzal entero.
 */
function minNextBid(basePrice, currentBid) {
  if (currentBid == null) return Number(basePrice);
  const cents = toCents(currentBid) * (1 + config.auction.minIncrement);
  return Math.ceil(Math.round(cents) / 100);
}

/**
 * Fase de la subasta según el reloj del servidor.
 *   PROGRAMADA -> ACTIVA -> (VENDIDA | DESIERTA)
 */
function phaseOf(v, now = new Date()) {
  const ended = v.ClosedAt != null || now >= v.EndAt;
  if (ended) return v.CurrentBid != null ? 'VENDIDA' : 'DESIERTA';
  if (now < v.StartAt) return 'PROGRAMADA';
  return 'ACTIVA';
}

/**
 * Estado personal del usuario respecto a la subasta (sin revelar identidades ajenas).
 *   WINNING / OUTBID mientras está abierta, WON / LOST al cerrar, null si no participó.
 */
function personalStatus({ userId, currentBidderId, hasBid, closed }) {
  if (!userId) return null;
  if (currentBidderId === userId) return closed ? 'WON' : 'WINNING';
  if (hasBid) return closed ? 'LOST' : 'OUTBID';
  return null;
}

/** Devuelve un mensaje de error si la oferta no cumple las reglas, o null si es válida. */
function validateBid({ amount, vehicle, userId, now = new Date() }) {
  if (!Number.isFinite(amount) || amount <= 0) return 'Ingresa un monto válido.';
  if (amount > 999999999) return 'El monto es demasiado alto.';
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return 'Usa como máximo 2 decimales.';

  const phase = phaseOf(vehicle, now);
  if (phase === 'PROGRAMADA') return 'La subasta aún no ha iniciado.';
  if (phase !== 'ACTIVA') return 'Oferta cerrada: el tiempo de la subasta terminó.';
  if (vehicle.SellerId === userId) return 'No puedes ofertar por tu propio vehículo.';
  if (vehicle.CurrentBidderId === userId) return 'Ya tienes la oferta más alta en esta subasta.';

  const base = Number(vehicle.BasePrice);
  if (toCents(amount) < toCents(base)) {
    return `La oferta no puede ser menor al monto base (Q ${base.toLocaleString('es-GT')}).`;
  }
  if (vehicle.CurrentBid != null) {
    const current = Number(vehicle.CurrentBid);
    const min = minNextBid(base, current);
    if (toCents(amount) <= toCents(current)) {
      return 'La oferta debe ser mayor a la oferta actual más alta.';
    }
    if (toCents(amount) < toCents(min)) {
      return `La oferta debe superar la actual en al menos 10 %: mínimo Q ${min.toLocaleString('es-GT')}.`;
    }
  }
  return null;
}

module.exports = { minNextBid, phaseOf, personalStatus, validateBid, toCents };
