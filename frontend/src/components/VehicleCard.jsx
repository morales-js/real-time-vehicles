import { Link } from 'react-router-dom';
import { Fuel, Gauge, Settings2, Users, Timer, Cog } from 'lucide-react';
import { assetUrl } from '../api/client';
import { useNow } from '../utils/clock';
import { money, km, phaseOf, shortDuration, lot } from '../utils/format';
import { DamageBadge, PhaseChip, MyStatusBadge } from './Badges';

export default function VehicleCard({ v }) {
  const now = useNow();
  const phase = phaseOf(v, now);
  const end = new Date(v.endAt).getTime();
  const start = new Date(v.startAt).getTime();
  const urgent = phase === 'ACTIVA' && end - now < 15 * 60 * 1000;
  const hasBids = v.currentBid != null;

  let timeLabel;
  if (phase === 'ACTIVA') timeLabel = <>Cierra en <b>{shortDuration(end - now)}</b></>;
  else if (phase === 'PROGRAMADA') timeLabel = <>Inicia en <b>{shortDuration(start - now)}</b></>;
  else timeLabel = <b>Subasta finalizada</b>;

  return (
    <Link to={`/vehiculo/${v.id}`} className={`vcard ${urgent ? 'vcard--urgent' : ''} ${phase === 'VENDIDA' || phase === 'DESIERTA' ? 'vcard--closed' : ''}`}>
      <div className="vcard__media">
        {v.coverImageUrl
          ? <img src={assetUrl(v.coverImageUrl)} alt={v.title} loading="lazy" />
          : <div className="vcard__noimg">Sin foto</div>}
        <div className="vcard__top">
          <DamageBadge level={v.damageLevel} />
          <PhaseChip phase={phase} />
        </div>
        <span className="vcard__lot">Lote {lot(v.id)}</span>
        {v.myStatus && <div className="vcard__mine"><MyStatusBadge status={v.myStatus} /></div>}
        {v.isOwner && <div className="vcard__mine"><span className="owner-tag">Tu publicación</span></div>}
      </div>

      <div className="vcard__body">
        <div className="vcard__title">
          <h3>{v.brand.name} {v.model}</h3>
          <span className="vcard__year">{v.year}</span>
        </div>
        <p className="vcard__sub">{v.itemType.name} · {v.engine}</p>

        <ul className="vcard__specs">
          <li><Fuel size={14} />{v.fuelType.name}</li>
          <li><Settings2 size={14} />{v.transmission.name}</li>
          <li><Cog size={14} />{v.driveTrain.code}</li>
          {v.mileage != null && <li><Gauge size={14} />{km(v.mileage)}</li>}
        </ul>

        <div className="vcard__price">
          <div>
            <span className="label">{hasBids ? (phase === 'VENDIDA' ? 'Vendido en' : 'Oferta actual') : 'Monto base'}</span>
            <strong key={v._flash || 0} className={v._flash ? 'flash' : ''}>{money(hasBids ? v.currentBid : v.basePrice)}</strong>
          </div>
          <span className="vcard__bids"><Users size={14} />{v.bidCount} {v.bidCount === 1 ? 'oferta' : 'ofertas'}</span>
        </div>
      </div>

      <div className={`vcard__foot vcard__foot--${phase?.toLowerCase()}`}>
        <Timer size={15} />
        <span>{timeLabel}</span>
      </div>
    </Link>
  );
}

export function VehicleGrid({ items, loading, skeletons = 8, empty }) {
  if (loading && !items.length) {
    return (
      <div className="vgrid">
        {Array.from({ length: skeletons }).map((_, i) => <div key={i} className="vcard vcard--skeleton"><div className="vcard__media" /><div className="vcard__body"><span /><span /><span /></div></div>)}
      </div>
    );
  }
  if (!items.length) return empty || null;
  return <div className={`vgrid ${loading ? 'is-loading' : ''}`}>{items.map((v) => <VehicleCard key={v.id} v={v} />)}</div>;
}
