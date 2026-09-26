import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../api/client';
import { syncClock } from '../utils/clock';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext({ socket: null, connected: false });

const NOTIFICATION_STYLE = {
  outbid: { type: 'error', icon: 'bell' },
  won: { type: 'success', icon: 'trophy' },
  lost: { type: 'warning' },
  sold: { type: 'success', icon: 'trophy' },
  unsold: { type: 'warning' },
  'seller-bid': { type: 'info', icon: 'bell' },
};

/**
 * Conexión WebSocket (Socket.IO) compartida por toda la app.
 * Se reconecta con el token nuevo al iniciar o cerrar sesión.
 */
export function SocketProvider({ children }) {
  const { token } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(API_BASE || undefined, {
      auth: { token },
      // Transporte por defecto: long-polling y "upgrade" a WebSocket; funciona aunque un proxy bloquee WS.
      reconnectionDelayMax: 5000,
    });

    const sync = () => {
      const sent = Date.now();
      s.emit('clock:sync', sent, (r) => r && syncClock(r.serverTime, sent));
    };
    s.on('connect', () => { setConnected(true); sync(); });
    s.on('disconnect', () => setConnected(false));
    s.on('server:hello', () => sync());
    s.on('notification', (n) => {
      toast.push({
        ...(NOTIFICATION_STYLE[n.type] || {}),
        title: n.title,
        message: n.message,
        link: n.vehicleId ? `/vehiculo/${n.vehicleId}` : undefined,
        duration: 9000,
      });
    });

    setSocket(s);
    const resync = setInterval(sync, 60000);
    return () => {
      clearInterval(resync);
      s.removeAllListeners();
      s.disconnect();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Suscribe un handler a un evento del socket actual. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return undefined;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, handler]);
}
