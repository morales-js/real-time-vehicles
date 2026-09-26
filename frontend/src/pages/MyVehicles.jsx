import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ListChecks, Pencil, PlusCircle, Search, Users, CarFront } from 'lucide-react';
import { api, assetUrl, toQuery } from '../api/client';
import { useLiveVehicles } from '../hooks/useLiveVehicles';
import { useNow } from '../utils/clock';
import { dateTime, isClosedPhase, lot, money, phaseOf, shortDuration } from '../utils/format';
import { DamageBadge, PhaseChip } from '../components/Badges';
import Spinner, { EmptyState } from '../components/Spinner';

const STATUS = [['todas', 'Todas'], ['activa', 'En vivo'], ['programada', 'Próximas'], ['cerrada', 'Finalizadas']];

export default function MyVehicles() {
  const now = useNow();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('todas');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const r = await api(`/me/vehicles${toQuery({ q, status })}`, { signal });
      setItems(r.items);
    } catch { /* abortado o error */ }
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => load(ctrl.signal), 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [load]);

  useLiveVehicles(items, setItems);

  return (
    <div className="container">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow"><ListChecks size={14} />Panel del publicador</span>
          <h1>Mis publicaciones</h1>
          <p className="muted">Busca tus vehículos publicados, revisa sus ofertas en vivo y edítalos.</p>
        </div>
        <Link to="/publicar" className="btn btn--accent"><PlusCircle size={18} />Publicar vehículo</Link>
      </header>

      <div className="toolbar">
        <div className="searchbar">
          <Search size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en mis publicaciones: marca, modelo, año..." aria-label="Buscar mis publicaciones" />
        </div>
        <div className="segmented">
          {STATUS.map(([k, l]) => <button key={k} className={status === k ? 'is-on' : ''} onClick={() => setStatus(k)}>{l}</button>)}
        </div>
      </div>

      {loading && !items.length ? <Spinner /> : !items.length ? (
        <EmptyState icon={CarFront} title={q ? 'Sin resultados' : 'Aún no has publicado vehículos'} action={<Link to="/publicar" className="btn btn--primary">Publicar mi primer vehículo</Link>}>
          {q ? 'Ninguna publicación coincide con tu búsqueda.' : 'Publica tu vehículo y recibe ofertas en tiempo real.'}
        </EmptyState>
      ) : (
        <ul className="mylist">
          {items.map((v) => {
            const phase = phaseOf(v, now);
            const closed = isClosedPhase(phase);
            return (
              <li key={v.id} className="mylist__item">
                <Link to={`/vehiculo/${v.id}`} className="mylist__img"><img src={assetUrl(v.coverImageUrl)} alt={v.title} loading="lazy" /></Link>
                <div className="mylist__info">
                  <div className="mylist__title">
                    <h3>{v.title}</h3>
                    <PhaseChip phase={phase} />
                  </div>
                  <p className="muted">Lote {lot(v.id)} · {v.itemType.name} · {v.engine}</p>
                  <DamageBadge level={v.damageLevel} />
                </div>
                <div className="mylist__stats">
                  <div><span className="label">{v.currentBid ? 'Oferta actual' : 'Monto base'}</span><strong key={v._flash || 0} className={v._flash ? 'flash' : ''}>{money(v.currentBid ?? v.basePrice)}</strong></div>
                  <div><span className="label">Ofertas</span><strong><Users size={14} /> {v.bidCount}</strong></div>
                  <div>
                    <span className="label">{phase === 'PROGRAMADA' ? 'Inicia en' : closed ? 'Cerró' : 'Cierra en'}</span>
                    <strong>{phase === 'PROGRAMADA' ? shortDuration(new Date(v.startAt) - now) : closed ? dateTime(v.endAt) : shortDuration(new Date(v.endAt) - now)}</strong>
                  </div>
                </div>
                <div className="mylist__actions">
                  <Link to={`/vehiculo/${v.id}`} className="btn btn--soft btn--sm"><Eye size={15} />Ver</Link>
                  {closed
                    ? <span className="btn btn--sm btn--disabled" title="Las subastas finalizadas no se pueden editar"><Pencil size={15} />Editar</span>
                    : <Link to={`/mis-publicaciones/${v.id}/editar`} className="btn btn--primary btn--sm"><Pencil size={15} />Editar</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
