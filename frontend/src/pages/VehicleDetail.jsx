import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarClock, Eye, Gavel, Info, Lock, LogIn, Pencil, ShieldCheck, Timer, TrendingUp, Users, CheckCircle2, CircleSlash,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useNow } from '../utils/clock';
import { dateTime, km, lot, money, phaseOf, splitDuration, timeAgo, isClosedPhase } from '../utils/format';
import Carousel from '../components/Carousel';
import Spinner, { EmptyState } from '../components/Spinner';
import { DamageBadge, MyStatusBadge, PhaseChip } from '../components/Badges';

const pad = (n) => String(n).padStart(2, '0');

/** Reloj de la subasta: cuenta regresiva sincronizada con el servidor. */
function AuctionClock({ vehicle, phase, now }) {
  const start = new Date(vehicle.startAt).getTime();
  const end = new Date(vehicle.endAt).getTime();
  const target = phase === 'PROGRAMADA' ? start : end;
  const { d, h, m, s } = splitDuration(target - now);
  const progress = phase === 'ACTIVA' ? Math.min(Math.max((now - start) / (end - start), 0), 1) : phase === 'PROGRAMADA' ? 0 : 1;
  const urgent = phase === 'ACTIVA' && end - now < 5 * 60 * 1000;

  if (isClosedPhase(phase)) {
    return (
      <div className="clock clock--closed">
        <Lock size={20} />
        <div>
          <strong>Oferta cerrada</strong>
          <span>Finalizó el {dateTime(vehicle.endAt)}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`clock ${urgent ? 'clock--urgent' : ''} ${phase === 'PROGRAMADA' ? 'clock--scheduled' : ''}`}>
      <span className="clock__label">
        {phase === 'PROGRAMADA' ? <><CalendarClock size={16} />La subasta inicia en</> : <><Timer size={16} />Tiempo restante</>}
      </span>
      <div className="clock__digits" aria-live="off">
        <div><b>{pad(d)}</b><span>Días</span></div>
        <div><b>{pad(h)}</b><span>Horas</span></div>
        <div><b>{pad(m)}</b><span>Min</span></div>
        <div><b>{pad(s)}</b><span>Seg</span></div>
      </div>
      <div className="clock__bar"><span style={{ width: `${progress * 100}%` }} /></div>
      <div className="clock__dates">
        <span>Inicio: {dateTime(vehicle.startAt)}</span>
        <span>Cierre: {dateTime(vehicle.endAt)}</span>
      </div>
    </div>
  );
}

function BidPanel({ vehicle, phase, onBid, viewers }) {
  const { isAuthenticated } = useAuth();
  const now = useNow();
  const location = useLocation();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const touched = useRef(false);

  const min = vehicle.minNextBid;
  const current = vehicle.currentBid;
  const hasBids = current != null;

  // Sugerimos la oferta mínima; si llega una puja nueva y el usuario no ha escrito, se actualiza sola.
  useEffect(() => {
    if (!touched.current || Number(amount) < min) { setAmount(String(min)); touched.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Ingresa un monto válido.');
    if (value < min) {
      return setError(hasBids
        ? `Tu oferta debe superar la actual en al menos 10 %: mínimo ${money(min)}.`
        : `La oferta no puede ser menor al monto base: ${money(min)}.`);
    }
    setSending(true);
    try {
      await onBid(value);
      touched.current = false;
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  const quick = [
    ['Mínima', min],
    ['+15 %', Math.ceil((hasBids ? current : vehicle.basePrice) * (hasBids ? 1.15 : 1.05))],
    ['+25 %', Math.ceil((hasBids ? current : vehicle.basePrice) * (hasBids ? 1.25 : 1.15))],
  ];
  if (!hasBids) quick[1][0] = '+5 %';
  if (!hasBids) quick[2][0] = '+15 %';

  const closed = isClosedPhase(phase);
  const canBid = phase === 'ACTIVA' && isAuthenticated && !vehicle.isOwner && vehicle.myStatus !== 'WINNING';

  return (
    <div className={`bidpanel ${closed ? 'bidpanel--closed' : ''}`}>
      <div className="bidpanel__top">
        <PhaseChip phase={phase} />
        <span className="viewers" title="Personas viendo esta subasta ahora"><Eye size={15} />{viewers} {viewers === 1 ? 'persona viendo' : 'personas viendo'}</span>
      </div>

      <div className="bidpanel__price">
        <span className="label">
          {phase === 'VENDIDA' ? 'Precio de venta' : hasBids ? 'Oferta actual más alta' : 'Sin ofertas · Monto base'}
        </span>
        <strong key={current ?? 'base'} className={hasBids ? 'flash' : ''}>{money(hasBids ? current : vehicle.basePrice)}</strong>
        <div className="bidpanel__meta">
          <span><Users size={15} />{vehicle.bidCount} {vehicle.bidCount === 1 ? 'oferta' : 'ofertas'}</span>
          <span>Base: <b>{money(vehicle.basePrice)}</b></span>
        </div>
      </div>

      {vehicle.myStatus && <MyStatusBadge status={vehicle.myStatus} long />}

      <AuctionClock vehicle={vehicle} phase={phase} now={now} />

      {phase === 'VENDIDA' && (
        <div className="result result--sold"><CheckCircle2 size={22} /><div><strong>Subasta adjudicada</strong><span>Vendido por {money(current)}.</span></div></div>
      )}
      {phase === 'DESIERTA' && (
        <div className="result result--unsold"><CircleSlash size={22} /><div><strong>Subasta desierta / no vendida</strong><span>Cerró sin ofertas que alcanzaran el monto base.</span></div></div>
      )}
      {phase === 'CERRADA' && (
        <div className="result result--pending"><Lock size={22} /><div><strong>Oferta cerrada</strong><span>El tiempo terminó. Confirmando resultado...</span></div></div>
      )}

      {!closed && (
        vehicle.isOwner ? (
          <div className="owner-box">
            <Info size={18} />
            <div>
              <strong>Eres el publicador de este vehículo.</strong>
              <span>No puedes ofertar en tu propia subasta.</span>
              <Link to={`/mis-publicaciones/${vehicle.id}/editar`} className="btn btn--soft btn--sm"><Pencil size={14} />Editar publicación</Link>
            </div>
          </div>
        ) : !isAuthenticated ? (
          <div className="login-box">
            <Lock size={18} />
            <p>Estás en <b>modo lectura</b>. Inicia sesión para ofertar en esta subasta.</p>
            <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="btn btn--primary btn--block"><LogIn size={18} />Iniciar sesión para ofertar</Link>
            <Link to="/registro" className="link-btn">¿No tienes cuenta? Regístrate gratis</Link>
          </div>
        ) : (
          <form className="bidform" onSubmit={submit} noValidate>
            <label htmlFor="bid-amount">
              Tu oferta <span className="muted">(mínimo {money(min)})</span>
            </label>
            <div className="bidform__input">
              <span>Q</span>
              <input
                id="bid-amount"
                type="number"
                inputMode="decimal"
                min={min}
                step="1"
                value={amount}
                disabled={!canBid || sending}
                onChange={(e) => { touched.current = true; setAmount(e.target.value); setError(null); }}
              />
            </div>
            <div className="bidform__quick">
              {quick.map(([label, value]) => (
                <button type="button" key={label} disabled={!canBid} onClick={() => { touched.current = true; setAmount(String(value)); setError(null); }}>
                  <span>{label}</span><b>{money(value)}</b>
                </button>
              ))}
            </div>
            {error && <div className="alert alert--error" role="alert">{error}</div>}
            <button className="btn btn--accent btn--lg btn--block" disabled={!canBid || sending}>
              <Gavel size={20} />
              {phase === 'PROGRAMADA' ? 'La subasta aún no inicia'
                : vehicle.myStatus === 'WINNING' ? 'Tienes la oferta más alta'
                  : sending ? 'Enviando oferta...' : `Ofertar ${money(Number(amount) || min)}`}
            </button>
          </form>
        )
      )}

      <ul className="rules">
        <li><ShieldCheck size={15} />Ninguna oferta puede ser menor al monto base.</li>
        <li><TrendingUp size={15} />Cada puja debe superar la actual en al menos 10 %.</li>
        <li><Eye size={15} />La identidad de los postores es confidencial.</li>
      </ul>
    </div>
  );
}

function BidHistory({ bids, now }) {
  return (
    <div className="card history">
      <h3><TrendingUp size={18} />Historial de ofertas</h3>
      {!bids.length ? <p className="muted">Aún no hay ofertas. ¡Sé el primero!</p> : (
        <ol>
          {bids.map((b, i) => (
            <li key={b.id} className={`${i === 0 ? 'is-top' : ''} ${b._new ? 'is-new' : ''}`}>
              <span className="history__who">{b.mine ? 'Tu oferta' : 'Postor anónimo'}{i === 0 && <em>Más alta</em>}</span>
              <b>{money(b.amount)}</b>
              <time dateTime={b.createdAt} title={dateTime(b.createdAt)}>{timeAgo(b.createdAt, now)}</time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Specs({ v }) {
  const rows = [
    ['Año', v.year], ['Tipo de artículo', v.itemType.name], ['Marca', v.brand.name], ['Modelo', v.model],
    ['Motor', v.engine], ['Transmisión', v.transmission.name], ['Combustible', v.fuelType.name],
    ['Tren de manejo', v.driveTrain.name], ['Cilindros', v.cylinders === 0 ? '0 (eléctrico)' : v.cylinders],
    ['Kilometraje', km(v.mileage)], ['Color', v.color || '—'], ['Lote', lot(v.id)],
  ];
  return (
    <div className="card specs">
      <h3><Info size={18} />Ficha técnica</h3>
      <dl>
        {rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
        <div className="specs__damage"><dt>Estado de daño</dt><dd><DamageBadge level={v.damageLevel} full /></dd></div>
      </dl>
      {v.description && <><h4>Descripción</h4><p className="specs__desc">{v.description}</p></>}
    </div>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const vehicleId = Number(id);
  const { socket } = useSocket();
  const { token } = useAuth();
  const toast = useToast();
  const now = useNow();
  const [vehicle, setVehicle] = useState(null);
  const [bids, setBids] = useState([]);
  const [error, setError] = useState(null);
  const [viewers, setViewers] = useState(1);

  const load = useCallback(async () => {
    try {
      const [v, h] = await Promise.all([api(`/vehicles/${vehicleId}`), api(`/vehicles/${vehicleId}/bids`)]);
      setVehicle(v.vehicle);
      setBids(h.bids);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'not-found' : err.message);
    }
  }, [vehicleId]);

  // Recarga al cambiar de vehículo o de sesión (el estado personal depende del usuario).
  useEffect(() => { setVehicle(null); load(); }, [load, token]);

  // Sala de la subasta: se une al conectar y al reconectar (y recarga por si se perdió algún evento).
  useEffect(() => {
    if (!socket) return undefined;
    const join = () => socket.emit('auction:join', vehicleId);
    const onReconnect = () => { join(); load(); };
    if (socket.connected) join();
    socket.on('connect', onReconnect);
    return () => {
      socket.off('connect', onReconnect);
      socket.emit('auction:leave', vehicleId);
    };
  }, [socket, vehicleId, load]);

  useSocketEvent('auction:viewers', useCallback((e) => { if (e.vehicleId === vehicleId) setViewers(e.count); }, [vehicleId]));

  useSocketEvent('auction:bid', useCallback((e) => {
    if (e.vehicleId !== vehicleId) return;
    setVehicle((v) => v && ({ ...v, currentBid: e.currentBid, bidCount: e.bidCount, minNextBid: e.minNextBid, myStatus: e.myStatus }));
    setBids((list) => (list.some((b) => b.id === e.bid.id) ? list : [{ ...e.bid, _new: true }, ...list].slice(0, 20)));
  }, [vehicleId]));

  useSocketEvent('auction:closed', useCallback((e) => {
    if (e.vehicleId !== vehicleId) return;
    setVehicle((v) => v && ({ ...v, status: e.status, currentBid: e.currentBid, myStatus: e.myStatus, closedAt: new Date().toISOString() }));
  }, [vehicleId]));

  useSocketEvent('auction:refresh', useCallback((e) => {
    if (e.vehicleId !== vehicleId) return;
    load();
    toast.push({ type: 'info', title: 'Publicación actualizada', message: 'El vendedor actualizó la información de este vehículo.' });
  }, [vehicleId, load, toast]));

  const phase = phaseOf(vehicle, now);

  // Si el tiempo se agotó y el servidor aún no confirmó el cierre, consultamos de nuevo.
  useEffect(() => {
    if (phase !== 'CERRADA') return undefined;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [phase, load]);

  const placeBid = async (amount) => {
    try {
      const r = await api(`/vehicles/${vehicleId}/bids`, { method: 'POST', body: { amount } });
      setVehicle((v) => ({ ...v, currentBid: r.currentBid, bidCount: r.bidCount, minNextBid: r.minNextBid, myStatus: 'WINNING' }));
      setBids((list) => (list.some((b) => b.id === r.bid.id) ? list : [{ ...r.bid, _new: true }, ...list].slice(0, 20)));
      toast.push({ type: 'success', title: '¡Oferta registrada!', message: `Ofertaste ${money(amount)}. Vas ganando esta subasta.` });
    } catch (err) {
      // Si alguien ofertó primero, actualizamos los montos con lo que respondió el servidor.
      if (err.details?.minNextBid) {
        setVehicle((v) => ({ ...v, minNextBid: err.details.minNextBid, currentBid: err.details.currentBid ?? v.currentBid }));
      }
      throw err;
    }
  };

  if (error === 'not-found') {
    return <div className="container"><EmptyState icon={Gavel} title="Vehículo no encontrado" action={<Link to="/inventario" className="btn btn--primary">Ir al inventario</Link>}>Es posible que el enlace sea incorrecto.</EmptyState></div>;
  }
  if (error) return <div className="container"><div className="alert alert--error">{error}</div></div>;
  if (!vehicle) return <Spinner label="Cargando subasta..." />;

  return (
    <div className="container detail">
      <nav className="crumbs">
        <Link to="/inventario"><ArrowLeft size={16} />Inventario</Link>
        <span>/</span><span>{vehicle.brand.name}</span><span>/</span><span>{vehicle.model}</span>
      </nav>

      <header className="detail__head">
        <div>
          <span className="detail__lot">Lote {lot(vehicle.id)} · {vehicle.itemType.name}</span>
          <h1>{vehicle.brand.name} {vehicle.model} <span>{vehicle.year}</span></h1>
          <div className="detail__tags">
            <DamageBadge level={vehicle.damageLevel} full />
            <span className="tag">{vehicle.engine}</span>
            <span className="tag">{vehicle.transmission.name}</span>
            <span className="tag">{vehicle.driveTrain.code}</span>
            <span className="tag">{vehicle.fuelType.name}</span>
          </div>
        </div>
      </header>

      <div className="detail__layout">
        <div className="detail__main">
          <Carousel images={vehicle.images} title={vehicle.title} />
          <Specs v={vehicle} />
        </div>
        <aside className="detail__side">
          <BidPanel vehicle={vehicle} phase={phase} onBid={placeBid} viewers={viewers} />
          <BidHistory bids={bids} now={now} />
        </aside>
      </div>
    </div>
  );
}
