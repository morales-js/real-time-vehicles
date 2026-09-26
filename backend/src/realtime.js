const { Server } = require('socket.io');
const { verifyToken } = require('./middleware/auth');
const { personalStatus } = require('./services/auctionRules');
const { getBidderIds } = require('./services/vehicleRepo');

let io = null;
const room = (vehicleId) => `vehicle:${vehicleId}`;
const userRoom = (userId) => `user:${userId}`;

function init(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: corsOrigins.length ? { origin: corsOrigins } : undefined,
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  // El token (si existe) identifica al usuario; los anónimos pueden mirar en modo lectura.
  io.use((socket, next) => {
    socket.data.userId = verifyToken(socket.handshake.auth?.token);
    next();
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    if (userId) socket.join(userRoom(userId));
    socket.emit('server:hello', { serverTime: Date.now(), authenticated: !!userId });

    socket.on('auction:join', async (vehicleId) => {
      const id = Number(vehicleId);
      if (!Number.isInteger(id) || id <= 0) return;
      await socket.join(room(id));
      emitViewers(id);
    });

    socket.on('auction:leave', async (vehicleId) => {
      const id = Number(vehicleId);
      if (!Number.isInteger(id)) return;
      await socket.leave(room(id));
      emitViewers(id);
    });

    socket.on('clock:sync', (clientTime, ack) => {
      if (typeof ack === 'function') ack({ clientTime, serverTime: Date.now() });
    });

    socket.on('disconnecting', () => {
      for (const r of socket.rooms) {
        if (r.startsWith('vehicle:')) setTimeout(() => emitViewers(Number(r.slice(8))), 50);
      }
    });
  });

  return io;
}

function emitViewers(vehicleId) {
  if (!io) return;
  const count = io.sockets.adapter.rooms.get(room(vehicleId))?.size || 0;
  io.to(room(vehicleId)).emit('auction:viewers', { vehicleId, count });
}

/**
 * Nueva puja: se envía a cada socket de la sala con SU estado personal
 * (WINNING / OUTBID) calculado en el servidor, sin revelar quién ofertó.
 */
async function broadcastBid({ vehicleId, title, amount, bidCount, minNextBid, bidderId, previousBidderId, sellerId, bidId, createdAt }) {
  if (!io) return;
  const bidders = await getBidderIds(vehicleId);
  const sockets = await io.in(room(vehicleId)).fetchSockets();
  for (const s of sockets) {
    const uid = s.data.userId;
    s.emit('auction:bid', {
      vehicleId,
      currentBid: amount,
      bidCount,
      minNextBid,
      myStatus: personalStatus({ userId: uid, currentBidderId: bidderId, hasBid: bidders.has(uid), closed: false }),
      bid: { id: String(bidId), amount, createdAt, mine: uid === bidderId },
      serverTime: Date.now(),
    });
  }

  // Tarjetas del inventario / home en vivo.
  io.emit('inventory:bid', { vehicleId, currentBid: amount, bidCount, minNextBid });

  // Notificaciones globales (aunque el usuario esté en otra página).
  if (previousBidderId && previousBidderId !== bidderId) {
    io.to(userRoom(previousBidderId)).emit('notification', {
      type: 'outbid',
      vehicleId,
      title: 'Tu oferta ha sido superada',
      message: `${title}: nueva oferta de Q ${amount.toLocaleString('es-GT')}. ¡Haz tu oferta antes de que termine el tiempo!`,
    });
  }
  if (sellerId) {
    io.to(userRoom(sellerId)).emit('notification', {
      type: 'seller-bid',
      vehicleId,
      title: 'Nueva oferta en tu vehículo',
      message: `${title} recibió una oferta de Q ${amount.toLocaleString('es-GT')}.`,
    });
  }
}

/** Cierre de subasta: VENDIDA o DESIERTA, con estado WON/LOST personal. */
async function broadcastClosed({ vehicleId, title, status, currentBid, winnerId, sellerId }) {
  if (!io) return;
  const bidders = await getBidderIds(vehicleId);
  const sockets = await io.in(room(vehicleId)).fetchSockets();
  for (const s of sockets) {
    const uid = s.data.userId;
    s.emit('auction:closed', {
      vehicleId,
      status,
      currentBid,
      myStatus: personalStatus({ userId: uid, currentBidderId: winnerId, hasBid: bidders.has(uid), closed: true }),
      serverTime: Date.now(),
    });
  }
  io.emit('inventory:closed', { vehicleId, status, currentBid });

  if (winnerId) {
    io.to(userRoom(winnerId)).emit('notification', {
      type: 'won', vehicleId, title: '¡Ganaste la subasta!',
      message: `${title} fue adjudicado a tu oferta de Q ${Number(currentBid).toLocaleString('es-GT')}.`,
    });
  }
  for (const uid of bidders) {
    if (uid === winnerId) continue;
    io.to(userRoom(uid)).emit('notification', {
      type: 'lost', vehicleId, title: 'Subasta finalizada', message: `${title} fue adjudicado a otra oferta.`,
    });
  }
  if (sellerId) {
    io.to(userRoom(sellerId)).emit('notification', {
      type: status === 'VENDIDA' ? 'sold' : 'unsold',
      vehicleId,
      title: status === 'VENDIDA' ? 'Tu vehículo fue vendido' : 'Subasta desierta',
      message: status === 'VENDIDA'
        ? `${title} se vendió en Q ${Number(currentBid).toLocaleString('es-GT')}.`
        : `${title} cerró sin ofertas que alcanzaran el monto base.`,
    });
  }
}

/** El vendedor editó la publicación o se publicó una nueva. */
function broadcastVehicleChanged(vehicleId, kind = 'updated') {
  if (!io) return;
  io.to(room(vehicleId)).emit('auction:refresh', { vehicleId });
  io.emit('inventory:changed', { vehicleId, kind });
}

module.exports = { init, broadcastBid, broadcastClosed, broadcastVehicleChanged };
