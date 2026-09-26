import { useCallback, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useSocketEvent } from '../context/SocketContext';

/**
 * Mantiene en vivo una lista de vehículos (Home / Inventario / Mis pujas):
 * precios, número de ofertas y cierres llegan por WebSocket sin recargar la página.
 */
export function useLiveVehicles(items, setItems, { onChanged } = {}) {
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const changedTimer = useRef(null);

  const patch = useCallback((vehicleId, fields) => {
    setItems((list) => list.map((v) => (v.id === vehicleId ? { ...v, ...fields } : v)));
  }, [setItems]);

  // Si participo en la subasta, pido mi estado personal (vas ganando / superada) al servidor.
  const refreshOne = useCallback(async (vehicleId) => {
    try {
      const { vehicle } = await api(`/vehicles/${vehicleId}`);
      patch(vehicleId, vehicle);
    } catch { /* ignorado */ }
  }, [patch]);

  useSocketEvent('inventory:bid', useCallback((e) => {
    const v = itemsRef.current.find((x) => x.id === e.vehicleId);
    if (!v) return;
    patch(e.vehicleId, { currentBid: e.currentBid, bidCount: e.bidCount, minNextBid: e.minNextBid, _flash: Date.now() });
    if (v.myStatus || v.isOwner) refreshOne(e.vehicleId);
  }, [patch, refreshOne]));

  useSocketEvent('inventory:closed', useCallback((e) => {
    const v = itemsRef.current.find((x) => x.id === e.vehicleId);
    if (!v) return;
    patch(e.vehicleId, { status: e.status, currentBid: e.currentBid ?? v.currentBid });
    if (v.myStatus || v.isOwner) refreshOne(e.vehicleId);
  }, [patch, refreshOne]));

  useSocketEvent('inventory:changed', useCallback((e) => {
    if (!onChanged) return;
    clearTimeout(changedTimer.current);
    changedTimer.current = setTimeout(() => onChanged(e), 600);
  }, [onChanged]));

  useEffect(() => () => clearTimeout(changedTimer.current), []);
}
