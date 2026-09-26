import { CalendarClock, CheckCircle2, CircleSlash, Flame, Lock, ThumbsUp, TrendingUp, Trophy, AlertTriangle } from 'lucide-react';

const DAMAGE_CLASS = { VERDE: 'green', AMARILLO: 'yellow', ROJO: 'red' };

export function DamageBadge({ level, full = false }) {
  if (!level) return null;
  const tone = DAMAGE_CLASS[level.code] || 'green';
  return (
    <span className={`damage damage--${tone}`} title={level.description}>
      <span className="damage__dot" />
      {full ? `${level.name} · ${level.description}` : level.description}
    </span>
  );
}

const PHASES = {
  ACTIVA: { cls: 'live', label: 'En vivo', Icon: Flame },
  PROGRAMADA: { cls: 'scheduled', label: 'Programada', Icon: CalendarClock },
  CERRADA: { cls: 'closed', label: 'Oferta cerrada', Icon: Lock },
  VENDIDA: { cls: 'sold', label: 'Vendida', Icon: CheckCircle2 },
  DESIERTA: { cls: 'unsold', label: 'Desierta', Icon: CircleSlash },
};

export function PhaseChip({ phase }) {
  const p = PHASES[phase];
  if (!p) return null;
  const { Icon } = p;
  return (
    <span className={`phase phase--${p.cls}`}>
      {phase === 'ACTIVA' ? <span className="pulse-dot" /> : <Icon size={14} />}
      {p.label}
    </span>
  );
}

const MY_STATUS = {
  WINNING: { cls: 'win', short: '¡Vas ganando!', long: '¡Vas ganando esta subasta!', Icon: ThumbsUp },
  OUTBID: { cls: 'lose', short: 'Oferta superada', long: 'Tu oferta ha sido superada. ¡Haz tu oferta ahora antes de que termine el tiempo!', Icon: AlertTriangle },
  WON: { cls: 'win', short: '¡Ganaste!', long: '¡Ganaste esta subasta! El vendedor se pondrá en contacto contigo.', Icon: Trophy },
  LOST: { cls: 'neutral', short: 'No ganaste', long: 'La subasta cerró y otra oferta resultó ganadora.', Icon: TrendingUp },
};

/** Indicador visual del estado personal de la puja. */
export function MyStatusBadge({ status, long = false }) {
  const s = MY_STATUS[status];
  if (!s) return null;
  const { Icon } = s;
  return (
    <span key={status} className={`mystatus mystatus--${s.cls} ${long ? 'mystatus--long' : ''}`} role="status">
      <Icon size={long ? 22 : 14} />
      <span>{long ? s.long : s.short}</span>
    </span>
  );
}
