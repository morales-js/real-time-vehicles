import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { api } from '../api/client';
import { useLiveVehicles } from '../hooks/useLiveVehicles';
import { VehicleGrid } from '../components/VehicleCard';
import { EmptyState } from '../components/Spinner';

export default function MyBids() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api('/me/bids');
      setItems(r.items);
    } catch { /* vacío */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useLiveVehicles(items, setItems);

  const count = (s) => items.filter((v) => v.myStatus === s).length;

  return (
    <div className="container">
      <header className="page-head">
        <span className="eyebrow"><Gavel size={14} />Mi actividad</span>
        <h1>Mis pujas</h1>
        <p className="muted">Subastas en las que participas. El estado se actualiza en vivo.</p>
      </header>
      {items.length > 0 && (
        <div className="summary">
          <div className="summary__item summary__item--win"><strong>{count('WINNING')}</strong><span>Vas ganando</span></div>
          <div className="summary__item summary__item--lose"><strong>{count('OUTBID')}</strong><span>Superadas</span></div>
          <div className="summary__item summary__item--won"><strong>{count('WON')}</strong><span>Ganadas</span></div>
          <div className="summary__item"><strong>{count('LOST')}</strong><span>No ganadas</span></div>
        </div>
      )}
      <VehicleGrid
        items={items}
        loading={loading}
        skeletons={4}
        empty={<EmptyState icon={Gavel} title="Aún no has ofertado" action={<Link to="/inventario?status=activa" className="btn btn--primary">Ver subastas en vivo</Link>}>Explora el inventario y haz tu primera oferta.</EmptyState>}
      />
    </div>
  );
}
