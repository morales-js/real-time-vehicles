import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal, X, SearchX } from 'lucide-react';
import { api, toQuery } from '../api/client';
import { useCatalogs } from '../context/CatalogContext';
import { useLiveVehicles } from '../hooks/useLiveVehicles';
import { VehicleGrid } from '../components/VehicleCard';
import { EmptyState } from '../components/Spinner';

const FILTER_KEYS = ['q', 'brandId', 'model', 'engine', 'itemTypeId', 'fuelTypeId', 'transmissionId', 'driveTrainId', 'damageLevelId', 'cylinders', 'yearMin', 'yearMax', 'priceMin', 'priceMax', 'status', 'sort', 'page'];

const STATUS_OPTIONS = [
  ['vigentes', 'Vigentes'], ['activa', 'En vivo'], ['programada', 'Próximas'], ['cerrada', 'Finalizadas'], ['todas', 'Todas'],
];
const SORT_OPTIONS = [
  ['ending', 'Terminan pronto'], ['newest', 'Más recientes'], ['priceAsc', 'Precio: menor a mayor'],
  ['priceDesc', 'Precio: mayor a menor'], ['yearDesc', 'Año: más nuevo'], ['yearAsc', 'Año: más antiguo'], ['bids', 'Más ofertas'],
];
const CYLINDERS = [0, 2, 3, 4, 5, 6, 8, 10, 12];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 2 - 1980 }, (_, i) => THIS_YEAR + 1 - i);

const listOf = (v) => (v ? v.split(',').filter(Boolean) : []);

/** Input de texto con debounce para no consultar la API en cada tecla. */
function DebouncedInput({ value, onChange, delay = 400, ...props }) {
  const [local, setLocal] = useState(value || '');
  const timer = useRef(null);
  useEffect(() => { setLocal(value || ''); }, [value]);
  const handle = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), delay);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <input {...props} value={local} onChange={handle} />;
}

function ChipGroup({ label, options, selected, onToggle, render }) {
  return (
    <fieldset className="fgroup">
      <legend>{label}</legend>
      <div className="chips">
        {options.map((o) => {
          const on = selected.includes(String(o.id));
          return (
            <button type="button" key={o.id} className={`chip chip--toggle ${on ? 'is-on' : ''}`} onClick={() => onToggle(String(o.id))} aria-pressed={on}>
              {render ? render(o) : o.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Inventory() {
  const { catalogs } = useCatalogs();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, page: 1 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(false);

  const filters = useMemo(() => {
    const f = {};
    FILTER_KEYS.forEach((k) => { const v = params.get(k); if (v) f[k] = v; });
    return f;
  }, [params]);

  const set = useCallback((key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '' || value == null || (Array.isArray(value) && !value.length)) next.delete(key);
      else next.set(key, Array.isArray(value) ? value.join(',') : value);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  const toggle = (key) => (id) => {
    const cur = listOf(filters[key]);
    set(key, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api(`/vehicles${toQuery({ pageSize: 12, ...filters })}`, { signal });
      setData(r);
      setItems(r.items);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useLiveVehicles(items, setItems, { onChanged: useCallback(() => load(), [load]) });

  // Chips de filtros activos (para quitarlos con un clic).
  const active = [];
  const nameOf = (list, id) => list.find((x) => String(x.id) === String(id))?.name;
  if (filters.q) active.push(['q', null, `“${filters.q}”`]);
  if (filters.brandId) listOf(filters.brandId).forEach((id) => active.push(['brandId', id, nameOf(catalogs.brands, id)]));
  if (filters.model) active.push(['model', null, `Modelo: ${filters.model}`]);
  if (filters.engine) active.push(['engine', null, `Motor: ${filters.engine}`]);
  [['itemTypeId', catalogs.itemTypes], ['fuelTypeId', catalogs.fuelTypes], ['transmissionId', catalogs.transmissions], ['damageLevelId', catalogs.damageLevels]]
    .forEach(([k, list]) => listOf(filters[k]).forEach((id) => active.push([k, id, k === 'damageLevelId' ? `Daño ${nameOf(list, id)}` : nameOf(list, id)])));
  listOf(filters.driveTrainId).forEach((id) => active.push(['driveTrainId', id, catalogs.driveTrains.find((d) => String(d.id) === id)?.code]));
  listOf(filters.cylinders).forEach((c) => active.push(['cylinders', c, c === '0' ? 'Eléctrico (0 cil.)' : `${c} cilindros`]));
  if (filters.yearMin) active.push(['yearMin', null, `Desde ${filters.yearMin}`]);
  if (filters.yearMax) active.push(['yearMax', null, `Hasta ${filters.yearMax}`]);
  if (filters.priceMin) active.push(['priceMin', null, `≥ Q ${Number(filters.priceMin).toLocaleString('es-GT')}`]);
  if (filters.priceMax) active.push(['priceMax', null, `≤ Q ${Number(filters.priceMax).toLocaleString('es-GT')}`]);

  const removeChip = (key, id) => {
    if (id == null) set(key, '');
    else set(key, listOf(filters[key]).filter((x) => x !== id));
  };
  const clearAll = () => setParams(filters.sort ? { sort: filters.sort } : {}, { replace: true });
  const status = filters.status || 'vigentes';

  return (
    <div className="container inventory">
      <div className="inventory__head">
        <div>
          <h1>Inventario de subastas</h1>
          <p className="muted">Combina filtros de la ficha técnica para encontrar exactamente lo que buscas.</p>
        </div>
        <div className="searchbar">
          <Search size={20} />
          <DebouncedInput value={filters.q} onChange={(v) => set('q', v.trim())} placeholder="Marca, modelo, motor o año..." aria-label="Buscar" />
          {filters.q && <button onClick={() => set('q', '')} aria-label="Limpiar búsqueda"><X size={16} /></button>}
        </div>
      </div>

      <div className="segmented" role="tablist">
        {STATUS_OPTIONS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'is-on' : ''} onClick={() => set('status', k === 'vigentes' ? '' : k)}>{label}</button>
        ))}
      </div>

      <div className="inventory__layout">
        <aside className={`filters ${drawer ? 'is-open' : ''}`} aria-label="Filtros">
          <div className="filters__head">
            <h2><SlidersHorizontal size={18} />Filtros</h2>
            <button className="link-btn" onClick={clearAll}><RotateCcw size={14} />Limpiar</button>
            <button className="icon-btn filters__close" onClick={() => setDrawer(false)} aria-label="Cerrar filtros"><X size={18} /></button>
          </div>

          <ChipGroup
            label="Estado de daño"
            options={catalogs.damageLevels}
            selected={listOf(filters.damageLevelId)}
            onToggle={toggle('damageLevelId')}
            render={(d) => <><span className={`dot dot--${d.code.toLowerCase()}`} />{d.name}</>}
          />

          <div className="fgroup">
            <label htmlFor="f-brand">Marca</label>
            <select id="f-brand" value={filters.brandId || ''} onChange={(e) => set('brandId', e.target.value)}>
              <option value="">Todas las marcas</option>
              {catalogs.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="fgroup">
            <label htmlFor="f-model">Modelo</label>
            <DebouncedInput id="f-model" value={filters.model} onChange={(v) => set('model', v.trim())} placeholder="Ej. Corolla, CR-V..." />
          </div>

          <div className="fgroup fgroup--row">
            <div>
              <label htmlFor="f-ymin">Año desde</label>
              <select id="f-ymin" value={filters.yearMin || ''} onChange={(e) => set('yearMin', e.target.value)}>
                <option value="">Cualquiera</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-ymax">Año hasta</label>
              <select id="f-ymax" value={filters.yearMax || ''} onChange={(e) => set('yearMax', e.target.value)}>
                <option value="">Cualquiera</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <ChipGroup label="Tipo de artículo" options={catalogs.itemTypes} selected={listOf(filters.itemTypeId)} onToggle={toggle('itemTypeId')} />
          <ChipGroup label="Combustible" options={catalogs.fuelTypes} selected={listOf(filters.fuelTypeId)} onToggle={toggle('fuelTypeId')} />
          <ChipGroup label="Transmisión" options={catalogs.transmissions} selected={listOf(filters.transmissionId)} onToggle={toggle('transmissionId')} />
          <ChipGroup label="Tren de manejo" options={catalogs.driveTrains} selected={listOf(filters.driveTrainId)} onToggle={toggle('driveTrainId')} render={(d) => d.code} />
          <ChipGroup
            label="Cilindros"
            options={CYLINDERS.map((c) => ({ id: c, name: c === 0 ? 'EV' : String(c) }))}
            selected={listOf(filters.cylinders)}
            onToggle={toggle('cylinders')}
          />

          <div className="fgroup">
            <label htmlFor="f-engine">Motor</label>
            <DebouncedInput id="f-engine" value={filters.engine} onChange={(v) => set('engine', v.trim())} placeholder="Ej. V6, Turbo, 2.0L" />
          </div>

          <div className="fgroup fgroup--row">
            <div>
              <label htmlFor="f-pmin">Precio mín. (Q)</label>
              <DebouncedInput id="f-pmin" type="number" min="0" step="1000" value={filters.priceMin} onChange={(v) => set('priceMin', v)} placeholder="0" />
            </div>
            <div>
              <label htmlFor="f-pmax">Precio máx. (Q)</label>
              <DebouncedInput id="f-pmax" type="number" min="0" step="1000" value={filters.priceMax} onChange={(v) => set('priceMax', v)} placeholder="Sin límite" />
            </div>
          </div>

          <button className="btn btn--primary btn--block filters__apply" onClick={() => setDrawer(false)}>Ver {data.total} resultados</button>
        </aside>
        {drawer && <div className="backdrop" onClick={() => setDrawer(false)} />}

        <section className="inventory__results">
          <div className="results-bar">
            <button className="btn btn--soft filters__toggle" onClick={() => setDrawer(true)}>
              <SlidersHorizontal size={16} />Filtros{active.length ? ` (${active.length})` : ''}
            </button>
            <span className="results-bar__count"><b>{data.total}</b> {data.total === 1 ? 'vehículo' : 'vehículos'}</span>
            <label className="results-bar__sort">
              <span>Ordenar</span>
              <select value={filters.sort || 'ending'} onChange={(e) => set('sort', e.target.value === 'ending' ? '' : e.target.value)}>
                {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>

          {active.length > 0 && (
            <div className="active-filters">
              {active.map(([key, id, label]) => (
                <button key={`${key}-${id}`} className="chip chip--active" onClick={() => removeChip(key, id)}>{label}<X size={14} /></button>
              ))}
              <button className="link-btn" onClick={clearAll}>Limpiar todo</button>
            </div>
          )}

          {error && <div className="alert alert--error">{error}</div>}

          <VehicleGrid
            items={items}
            loading={loading}
            skeletons={6}
            empty={(
              <EmptyState icon={SearchX} title="No encontramos vehículos con esos filtros" action={<button className="btn btn--primary" onClick={clearAll}>Limpiar filtros</button>}>
                Prueba quitando algún filtro o cambiando el estado de la subasta.
              </EmptyState>
            )}
          />

          {data.totalPages > 1 && (
            <nav className="pager" aria-label="Paginación">
              <button className="btn btn--soft" disabled={data.page <= 1} onClick={() => set('page', data.page - 1)}><ChevronLeft size={16} />Anterior</button>
              <span>Página <b>{data.page}</b> de {data.totalPages}</span>
              <button className="btn btn--soft" disabled={data.page >= data.totalPages} onClick={() => set('page', data.page + 1)}>Siguiente<ChevronRight size={16} /></button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
