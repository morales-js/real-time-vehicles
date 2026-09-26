import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Lock, Star, Trash2, UploadCloud, Wrench, Camera, Gavel, Loader2 } from 'lucide-react';
import { assetUrl } from '../api/client';
import { useCatalogs } from '../context/CatalogContext';
import { compressImage } from '../utils/image';
import { money, toLocalInput } from '../utils/format';

const MIN_IMAGES = 5;
const MAX_IMAGES = 12;
const THIS_YEAR = new Date().getFullYear();
let keySeq = 0;

const FIELDS = ['year', 'itemTypeId', 'brandId', 'model', 'engine', 'transmissionId', 'fuelTypeId', 'driveTrainId', 'cylinders', 'damageLevelId', 'color', 'mileage', 'description', 'basePrice', 'startAt', 'endAt'];

function initialState(v) {
  if (!v) {
    const start = new Date(Date.now() + 5 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
    return {
      year: '', itemTypeId: '', brandId: '', model: '', engine: '', transmissionId: '', fuelTypeId: '', driveTrainId: '',
      cylinders: '', damageLevelId: '', color: '', mileage: '', description: '', basePrice: '',
      startAt: toLocalInput(start), endAt: toLocalInput(end),
    };
  }
  return {
    year: String(v.year), itemTypeId: String(v.itemType.id), brandId: String(v.brand.id), model: v.model, engine: v.engine,
    transmissionId: String(v.transmission.id), fuelTypeId: String(v.fuelType.id), driveTrainId: String(v.driveTrain.id),
    cylinders: String(v.cylinders), damageLevelId: String(v.damageLevel.id), color: v.color || '',
    mileage: v.mileage == null ? '' : String(v.mileage), description: v.description || '', basePrice: String(v.basePrice),
    startAt: toLocalInput(v.startAt), endAt: toLocalInput(v.endAt),
  };
}

function validate(f, images, locked, isEdit) {
  const e = {};
  const y = Number(f.year);
  if (!Number.isInteger(y) || y < 1950 || y > THIS_YEAR + 1) e.year = `Año entre 1950 y ${THIS_YEAR + 1}.`;
  ['itemTypeId', 'brandId', 'transmissionId', 'fuelTypeId', 'driveTrainId', 'damageLevelId'].forEach((k) => { if (!f[k]) e[k] = 'Campo obligatorio.'; });
  if (!f.model.trim()) e.model = 'Ingresa el modelo.';
  if (!f.engine.trim()) e.engine = 'Ingresa el motor.';
  const c = Number(f.cylinders);
  if (f.cylinders === '' || !Number.isInteger(c) || c < 0 || c > 16) e.cylinders = 'Entre 0 y 16 (0 = eléctrico).';
  if (f.mileage !== '' && (!Number.isInteger(Number(f.mileage)) || Number(f.mileage) < 0)) e.mileage = 'Kilometraje inválido.';
  if (!(Number(f.basePrice) > 0)) e.basePrice = 'Ingresa un monto base mayor a 0.';
  const start = new Date(f.startAt);
  const end = new Date(f.endAt);
  if (!f.startAt || Number.isNaN(start.getTime())) e.startAt = 'Fecha de inicio obligatoria.';
  else if (!locked && (!isEdit || f._startChanged) && start < new Date(Date.now() - 10 * 60 * 1000)) e.startAt = 'El inicio no puede estar en el pasado.';
  if (!f.endAt || Number.isNaN(end.getTime())) e.endAt = 'Fecha de cierre obligatoria.';
  else if (end <= start) e.endAt = 'El cierre debe ser posterior al inicio.';
  else if (end < new Date(Date.now() + 60 * 1000)) e.endAt = 'El cierre debe ser al menos 1 minuto en el futuro.';
  if (images.length < MIN_IMAGES) e.images = `Sube al menos ${MIN_IMAGES} fotografías (llevas ${images.length}).`;
  return e;
}

function Field({ label, error, hint, children, id }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`} data-field={id}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <small className="field__error">{error}</small> : hint && <small className="field__hint">{hint}</small>}
    </div>
  );
}

function ImageManager({ images, setImages, error }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [problem, setProblem] = useState(null);

  const add = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) { setProblem(`Máximo ${MAX_IMAGES} fotografías.`); return; }
    setBusy(true);
    setProblem(null);
    const added = [];
    for (const f of files.slice(0, room)) {
      try {
        const file = await compressImage(f);
        added.push({ key: `n${++keySeq}`, kind: 'new', file, url: URL.createObjectURL(file) });
      } catch (err) {
        setProblem(err.message);
      }
    }
    if (files.length > room) setProblem(`Solo se agregaron ${room}: el máximo es ${MAX_IMAGES} fotografías.`);
    setImages((list) => [...list, ...added]);
    setBusy(false);
  };

  const move = (i, dir) => setImages((list) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const cover = (i) => setImages((list) => [list[i], ...list.filter((_, k) => k !== i)]);
  const remove = (i) => setImages((list) => {
    const item = list[i];
    if (item.kind === 'new') URL.revokeObjectURL(item.url);
    return list.filter((_, k) => k !== i);
  });

  const pct = Math.min(images.length / MIN_IMAGES, 1) * 100;

  return (
    <div className="images" data-field="images">
      <div
        className={`dropzone ${drag ? 'is-drag' : ''} ${error ? 'has-error' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      >
        {busy ? <Loader2 className="spin" size={34} /> : <UploadCloud size={34} />}
        <strong>{busy ? 'Procesando fotografías...' : 'Arrastra tus fotos aquí o haz clic para seleccionar'}</strong>
        <span>JPG, PNG o WEBP · mínimo {MIN_IMAGES}, máximo {MAX_IMAGES} · se optimizan automáticamente</span>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>

      <div className="images__progress">
        <div className="images__bar"><span style={{ width: `${pct}%` }} className={images.length >= MIN_IMAGES ? 'ok' : ''} /></div>
        <span className={images.length >= MIN_IMAGES ? 'ok' : ''}>{images.length} / {MIN_IMAGES} fotos mínimas</span>
      </div>
      {(error || problem) && <small className="field__error">{error || problem}</small>}

      {images.length > 0 && (
        <ul className="images__grid">
          {images.map((img, i) => (
            <li key={img.key} className={i === 0 ? 'is-cover' : ''}>
              <img src={img.kind === 'existing' ? assetUrl(img.url) : img.url} alt={`Foto ${i + 1}`} />
              {i === 0 && <span className="images__cover"><Star size={12} />Portada</span>}
              <div className="images__tools">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover a la izquierda"><ArrowLeft size={14} /></button>
                {i !== 0 && <button type="button" onClick={() => cover(i)} aria-label="Usar como portada"><Star size={14} /></button>}
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Mover a la derecha"><ArrowRight size={14} /></button>
                <button type="button" className="danger" onClick={() => remove(i)} aria-label="Eliminar foto"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
          {images.length < MAX_IMAGES && (
            <li className="images__add"><button type="button" onClick={() => input.current?.click()}><ImagePlus size={26} />Agregar</button></li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Formulario de publicación / edición. Llama onSubmit(FormData) y muestra
 * los errores de validación del servidor junto a cada campo.
 */
export default function VehicleForm({ vehicle, onSubmit, submitLabel }) {
  const { catalogs } = useCatalogs();
  const [form, setForm] = useState(() => initialState(vehicle));
  const [images, setImages] = useState(() => (vehicle?.images || []).map((img) => ({ key: `e${img.id}`, kind: 'existing', id: img.id, url: img.url })));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const locked = !!vehicle && vehicle.bidCount > 0;

  useEffect(() => () => images.forEach((i) => i.kind === 'new' && URL.revokeObjectURL(i.url)), []); // eslint-disable-line

  const set = (key, value) => {
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === 'startAt' ? { _startChanged: true } : {}),
      ...(key === 'endAt' ? { _endChanged: true } : {}),
    }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const bind = (key) => ({ id: key, name: key, value: form[key], onChange: (e) => set(key, e.target.value), 'aria-invalid': !!errors[key] });

  const selectedDamage = useMemo(() => catalogs.damageLevels.find((d) => String(d.id) === form.damageLevelId), [catalogs, form.damageLevelId]);

  const setDuration = (ms) => {
    const start = new Date(form.startAt);
    const base = Number.isNaN(start.getTime()) ? new Date() : start;
    set('endAt', toLocalInput(new Date(base.getTime() + ms)));
  };
  const startNow = () => set('startAt', toLocalInput(new Date()));

  const scrollToError = (errs) => {
    const first = [...FIELDS, 'images'].find((k) => errs[k]);
    if (first) document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => { if (images.length >= MIN_IMAGES) setErrors((e) => ({ ...e, images: undefined })); }, [images.length]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const v = validate(form, images, locked, !!vehicle);
    setErrors(v);
    if (Object.keys(v).length) { scrollToError(v); return; }

    const data = Object.fromEntries(FIELDS.map((k) => [k, form[k]]));
    // Al editar, si una fecha no se tocó se envía la original (el input trunca los segundos).
    data.startAt = vehicle && (locked || !form._startChanged) ? vehicle.startAt : new Date(form.startAt).toISOString();
    data.endAt = vehicle && !form._endChanged ? vehicle.endAt : new Date(form.endAt).toISOString();
    const fd = new FormData();
    let n = 0;
    data.imageOrder = images.map((img) => {
      if (img.kind === 'existing') return `e:${img.id}`;
      fd.append('images', img.file, img.file.name);
      return `n:${n++}`;
    });
    fd.append('data', JSON.stringify(data));

    setSending(true);
    try {
      await onSubmit(fd);
    } catch (err) {
      setError(err.message);
      if (err.details) { setErrors(err.details); scrollToError(err.details); }
      setSending(false);
    }
  };

  const opt = (list, label) => [<option key="" value="">{label}</option>, ...list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)];

  return (
    <form className="vform" onSubmit={submit} noValidate>
      <section className="card vform__section">
        <header><span className="vform__step"><Wrench size={18} /></span><div><h2>Ficha técnica</h2><p>Datos obligatorios del vehículo.</p></div></header>
        <div className="grid-3">
          <Field label="Año *" id="year" error={errors.year}>
            <input {...bind('year')} type="number" min="1950" max={THIS_YEAR + 1} placeholder={String(THIS_YEAR - 3)} />
          </Field>
          <Field label="Tipo de artículo *" id="itemTypeId" error={errors.itemTypeId}>
            <select {...bind('itemTypeId')}>{opt(catalogs.itemTypes, 'Selecciona...')}</select>
          </Field>
          <Field label="Marca *" id="brandId" error={errors.brandId}>
            <select {...bind('brandId')}>{opt(catalogs.brands, 'Selecciona...')}</select>
          </Field>
          <Field label="Modelo *" id="model" error={errors.model}>
            <input {...bind('model')} maxLength={80} placeholder="Ej. Corolla LE" />
          </Field>
          <Field label="Motor *" id="engine" error={errors.engine}>
            <input {...bind('engine')} maxLength={80} placeholder="Ej. 2.0L Turbo I4" />
          </Field>
          <Field label="Transmisión *" id="transmissionId" error={errors.transmissionId}>
            <select {...bind('transmissionId')}>{opt(catalogs.transmissions, 'Selecciona...')}</select>
          </Field>
          <Field label="Tipo de combustible *" id="fuelTypeId" error={errors.fuelTypeId}>
            <select {...bind('fuelTypeId')}>{opt(catalogs.fuelTypes, 'Selecciona...')}</select>
          </Field>
          <Field label="Tren de manejo *" id="driveTrainId" error={errors.driveTrainId}>
            <select {...bind('driveTrainId')}>{opt(catalogs.driveTrains, 'Selecciona...')}</select>
          </Field>
          <Field label="Número de cilindros *" id="cylinders" error={errors.cylinders} hint="0 para vehículos eléctricos">
            <input {...bind('cylinders')} type="number" min="0" max="16" placeholder="4" />
          </Field>
          <Field label="Kilometraje" id="mileage" error={errors.mileage} hint="Opcional">
            <input {...bind('mileage')} type="number" min="0" placeholder="Ej. 85000" />
          </Field>
          <Field label="Color" id="color" error={errors.color} hint="Opcional">
            <input {...bind('color')} maxLength={40} placeholder="Ej. Gris plata" />
          </Field>
        </div>
        <Field label="Descripción" id="description" error={errors.description} hint="Opcional · detalles del daño, llaves, documentos...">
          <textarea {...bind('description')} rows={3} maxLength={2000} placeholder="Describe el estado del vehículo" />
        </Field>
      </section>

      <section className="card vform__section" data-field="damageLevelId">
        <header><span className="vform__step vform__step--warn"><Wrench size={18} /></span><div><h2>Clasificación por estado de daño *</h2><p>Sé transparente: genera confianza en los compradores.</p></div></header>
        <div className="damage-pick" role="radiogroup">
          {catalogs.damageLevels.map((d) => (
            <label key={d.id} className={`damage-opt damage-opt--${d.code.toLowerCase()} ${form.damageLevelId === String(d.id) ? 'is-on' : ''}`}>
              <input type="radio" name="damageLevelId" value={d.id} checked={form.damageLevelId === String(d.id)} onChange={(e) => set('damageLevelId', e.target.value)} />
              <span className="damage-opt__light" />
              <strong>{d.name}</strong>
              <span>{d.description}</span>
            </label>
          ))}
        </div>
        {errors.damageLevelId && <small className="field__error">{errors.damageLevelId}</small>}
        {selectedDamage && <small className="field__hint">Seleccionado: {selectedDamage.name} — {selectedDamage.description}</small>}
      </section>

      <section className="card vform__section">
        <header><span className="vform__step"><Camera size={18} /></span><div><h2>Galería fotográfica *</h2><p>Mínimo {MIN_IMAGES} fotografías. La primera será la portada.</p></div></header>
        <ImageManager images={images} setImages={setImages} error={errors.images} />
      </section>

      <section className="card vform__section">
        <header><span className="vform__step vform__step--accent"><Gavel size={18} /></span><div><h2>Parámetros de la subasta</h2><p>Monto base y horario (hora local).</p></div></header>
        {locked && (
          <div className="alert alert--info"><Lock size={16} />Esta subasta ya tiene ofertas: el monto base y la fecha de inicio no se pueden modificar y el cierre solo puede extenderse.</div>
        )}
        <div className="grid-3">
          <Field label="Monto base (Q) *" id="basePrice" error={errors.basePrice} hint={form.basePrice ? `La subasta inicia en ${money(Number(form.basePrice))}` : 'Ej. 20000'}>
            <div className="input-prefix"><span>Q</span><input {...bind('basePrice')} type="number" min="1" step="100" placeholder="20000" disabled={locked} /></div>
          </Field>
          <Field label="Fecha y hora de inicio *" id="startAt" error={errors.startAt}>
            <input {...bind('startAt')} type="datetime-local" disabled={locked} />
            {!locked && <button type="button" className="link-btn" onClick={startNow}>Iniciar ahora</button>}
          </Field>
          <Field label="Fecha y hora de cierre *" id="endAt" error={errors.endAt}>
            <input {...bind('endAt')} type="datetime-local" />
            <div className="presets">
              {[['10 min', 10 * 60e3], ['1 h', 3600e3], ['1 día', 864e5], ['3 días', 3 * 864e5], ['7 días', 7 * 864e5]].map(([l, ms]) => (
                <button type="button" key={l} onClick={() => setDuration(ms)}>{l}</button>
              ))}
            </div>
          </Field>
        </div>
      </section>

      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <div className="vform__actions">
        <button className="btn btn--accent btn--lg" disabled={sending}>
          {sending ? <><Loader2 className="spin" size={18} />Guardando...</> : submitLabel}
        </button>
      </div>
    </form>
  );
}
