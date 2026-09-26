import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, Gavel, Search, ShieldCheck, Sparkles, Timer, UserPlus, Zap, Trophy, Users, CarFront } from 'lucide-react';
import { api, assetUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCatalogs } from '../context/CatalogContext';
import { useLiveVehicles } from '../hooks/useLiveVehicles';
import { useNow } from '../utils/clock';
import { money, phaseOf, splitDuration } from '../utils/format';
import { VehicleGrid } from '../components/VehicleCard';
import { DamageBadge } from '../components/Badges';

function HeroFeature({ v }) {
  const now = useNow();
  if (!v) return <div className="hero__feature hero__feature--skeleton" />;
  const phase = phaseOf(v, now);
  const { d, h, m, s } = splitDuration(new Date(v.endAt).getTime() - now);
  return (
    <Link to={`/vehiculo/${v.id}`} className="hero__feature">
      <div className="hero__feature-img">
        <img src={assetUrl(v.coverImageUrl)} alt={v.title} />
        <span className="hero__feature-tag"><Flame size={14} />Cierra pronto</span>
      </div>
      <div className="hero__feature-body">
        <div>
          <h3>{v.title}</h3>
          <DamageBadge level={v.damageLevel} />
        </div>
        <div className="hero__feature-row">
          <div>
            <span className="label">{v.currentBid ? 'Oferta actual' : 'Monto base'}</span>
            <strong key={v._flash || 0} className={v._flash ? 'flash' : ''}>{money(v.currentBid ?? v.basePrice)}</strong>
          </div>
          {phase === 'ACTIVA' && (
            <div className="mini-clock">
              {d > 0 && <span><b>{d}</b>d</span>}
              <span><b>{String(h).padStart(2, '0')}</b>h</span>
              <span><b>{String(m).padStart(2, '0')}</b>m</span>
              <span><b>{String(s).padStart(2, '0')}</b>s</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

const DAMAGE_COPY = {
  VERDE: 'Listos para rodar con detalles mínimos.',
  AMARILLO: 'Oportunidades con reparación moderada.',
  ROJO: 'Salvamento y piezas al mejor precio.',
};

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { catalogs } = useCatalogs();
  const navigate = useNavigate();
  const [ending, setEnding] = useState([]);
  const [newest, setNewest] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, b, st] = await Promise.all([
        api('/vehicles?status=activa&sort=ending&pageSize=8'),
        api('/vehicles?sort=newest&pageSize=4'),
        api('/stats'),
      ]);
      setEnding(a.items);
      setNewest(b.items);
      setStats(st);
    } catch { /* se muestra vacío */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useLiveVehicles(ending, setEnding, { onChanged: load });
  useLiveVehicles(newest, setNewest);

  const search = (e) => {
    e.preventDefault();
    navigate(`/inventario${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <>
      <section className="hero">
        <div className="hero__bg" aria-hidden="true"><span /><span /><span /></div>
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow"><Zap size={14} />Subastas en vivo · sin recargar la página</span>
            <h1>Tu próximo vehículo importado, <span className="text-grad">al precio que tú decides.</span></h1>
            <p>Autos, SUV, pickups y motos de subasta estilo EE. UU. Explora el inventario, compara el estado de daño y puja en tiempo real contra otros compradores.</p>
            <form className="hero__search" onSubmit={search}>
              <Search size={20} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por marca, modelo o año: Toyota Hilux, 2020..." aria-label="Buscar vehículos" />
              <button className="btn btn--primary">Buscar</button>
            </form>
            <div className="hero__chips">
              {catalogs.itemTypes.slice(0, 6).map((t) => (
                <Link key={t.id} to={`/inventario?itemTypeId=${t.id}`} className="chip">{t.name}</Link>
              ))}
            </div>
          </div>
          <HeroFeature v={ending[0]} />
        </div>
      </section>

      <section className="container pillars">
        {[
          { n: 1, Icon: UserPlus, title: 'Regístrese', text: 'Crea tu cuenta gratis en segundos para ofertar y publicar tus vehículos.', to: isAuthenticated ? '/publicar' : '/registro', cta: isAuthenticated ? 'Publicar vehículo' : 'Crear cuenta' },
          { n: 2, Icon: Search, title: 'Encuentre', text: 'Filtra por marca, año, combustible, tracción o nivel de daño y encuentra la oportunidad ideal.', to: '/inventario', cta: 'Ver inventario' },
          { n: 3, Icon: Gavel, title: 'Oferte', text: 'Puja en tiempo real, recibe alertas si te superan y gana antes de que termine el reloj.', to: '/inventario?status=activa', cta: 'Subastas en vivo' },
        ].map(({ n, Icon, title, text, to, cta }) => (
          <Link key={n} to={to} className={`pillar pillar--${n}`}>
            <span className="pillar__num">0{n}</span>
            <span className="pillar__icon"><Icon size={26} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
            <span className="pillar__cta">{cta}<ArrowRight size={16} /></span>
          </Link>
        ))}
      </section>

      <section className="container stats">
        <div><CarFront /><strong>{stats?.active ?? '—'}</strong><span>Subastas activas</span></div>
        <div><Timer /><strong>{stats?.closingToday ?? '—'}</strong><span>Cierran en 24 h</span></div>
        <div><Users /><strong>{stats?.totalBids ?? '—'}</strong><span>Ofertas realizadas</span></div>
        <div><Trophy /><strong>{stats?.sold ?? '—'}</strong><span>Vehículos vendidos</span></div>
      </section>

      <section className="container section">
        <div className="section__head">
          <div>
            <span className="eyebrow eyebrow--hot"><Flame size={14} />Últimos minutos</span>
            <h2>Terminan pronto</h2>
          </div>
          <Link to="/inventario?status=activa&sort=ending" className="btn btn--soft">Ver todas<ArrowRight size={16} /></Link>
        </div>
        <VehicleGrid items={ending} loading={loading} skeletons={4} empty={<p className="muted">No hay subastas activas en este momento.</p>} />
      </section>

      <section className="container section">
        <div className="section__head">
          <div>
            <span className="eyebrow"><ShieldCheck size={14} />Clasificación transparente</span>
            <h2>Explora por estado de daño</h2>
          </div>
        </div>
        <div className="damage-cards">
          {catalogs.damageLevels.map((d) => (
            <Link key={d.id} to={`/inventario?damageLevelId=${d.id}`} className={`damage-card damage-card--${d.code.toLowerCase()}`}>
              <span className="damage-card__light" />
              <h3>{d.name}</h3>
              <strong>{d.description}</strong>
              <p>{DAMAGE_COPY[d.code]}</p>
              <span className="damage-card__cta">Explorar<ArrowRight size={16} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section__head">
          <div>
            <span className="eyebrow"><Sparkles size={14} />Recién llegados</span>
            <h2>Nuevas publicaciones</h2>
          </div>
          <Link to="/inventario?sort=newest" className="btn btn--soft">Ver inventario<ArrowRight size={16} /></Link>
        </div>
        <VehicleGrid items={newest} loading={loading} skeletons={4} />
      </section>

      <section className="container">
        <div className="cta-banner">
          <div>
            <h2>¿Tienes un vehículo para subastar?</h2>
            <p>Publícalo con su ficha técnica y al menos 5 fotos. Define el monto base y el horario; nosotros nos encargamos de la subasta en vivo.</p>
          </div>
          <Link to="/publicar" className="btn btn--accent btn--lg">Publicar mi vehículo<ArrowRight size={18} /></Link>
        </div>
      </section>
    </>
  );
}
