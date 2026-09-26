import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Eye, EyeOff, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AuthAside } from './Login';

const PASSWORD_RULES = [
  ['Mínimo 8 caracteres', (p) => p.length >= 8],
  ['Una letra mayúscula', (p) => /[A-Z]/.test(p)],
  ['Una letra minúscula', (p) => /[a-z]/.test(p)],
  ['Un número', (p) => /\d/.test(p)],
  ['Un símbolo (#, !, @...)', (p) => /[^A-Za-z0-9]/.test(p)],
];

const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,80}$/;

function validate(f) {
  const e = {};
  if (!NAME_RE.test(f.firstName.trim())) e.firstName = 'Ingresa tu nombre (solo letras).';
  if (!NAME_RE.test(f.lastName.trim())) e.lastName = 'Ingresa tu apellido (solo letras).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Correo electrónico no válido.';
  const digits = f.phone.replace(/\D/g, '');
  if (!/^\+?[\d\s-]{8,20}$/.test(f.phone.trim()) || digits.length < 8 || digits.length > 15) e.phone = 'Teléfono no válido (8 a 15 dígitos).';
  if (!PASSWORD_RULES.every(([, test]) => test(f.password))) e.password = 'La contraseña no cumple los requisitos.';
  if (f.password !== f.confirm) e.confirm = 'Las contraseñas no coinciden.';
  return e;
}

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  if (isAuthenticated && !sending) return <Navigate to={next} replace />;

  const bind = (key) => ({
    id: key,
    value: form[key],
    onChange: (e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: undefined }); },
    'aria-invalid': !!errors[key],
  });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSending(true);
    try {
      const { confirm, ...data } = form;
      const user = await register(data);
      toast.push({ type: 'success', title: `¡Cuenta creada, ${user.firstName}!`, message: 'Ya puedes ofertar y publicar vehículos.' });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setErrors(err.details || {});
      setSending(false);
    }
  };

  const strength = PASSWORD_RULES.filter(([, t]) => t(form.password)).length;

  return (
    <div className="container auth">
      <AuthAside />
      <form className="auth__card" onSubmit={submit} noValidate>
        <h1>Crear cuenta</h1>
        <p className="muted">El registro es obligatorio para ofertar y publicar vehículos.</p>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="firstName">Nombre</label>
            <input {...bind('firstName')} autoComplete="given-name" placeholder="Ana" />
            {errors.firstName && <small className="field__error">{errors.firstName}</small>}
          </div>
          <div className="field">
            <label htmlFor="lastName">Apellido</label>
            <input {...bind('lastName')} autoComplete="family-name" placeholder="García" />
            {errors.lastName && <small className="field__error">{errors.lastName}</small>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input {...bind('email')} type="email" autoComplete="email" placeholder="tu@correo.com" />
          {errors.email && <small className="field__error">{errors.email}</small>}
        </div>
        <div className="field">
          <label htmlFor="phone">Teléfono</label>
          <input {...bind('phone')} type="tel" autoComplete="tel" placeholder="+502 5555-1234" />
          {errors.phone && <small className="field__error">{errors.phone}</small>}
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña segura</label>
          <div className="input-icon input-icon--plain">
            <input {...bind('password')} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Crea una contraseña" />
            <button type="button" className="input-icon__btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className={`strength strength--${strength}`}><span /><span /><span /><span /><span /></div>
          <ul className="pw-rules">
            {PASSWORD_RULES.map(([label, test]) => {
              const ok = test(form.password);
              return <li key={label} className={ok ? 'ok' : ''}>{ok ? <Check size={14} /> : <X size={14} />}{label}</li>;
            })}
          </ul>
          {errors.password && <small className="field__error">{errors.password}</small>}
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirmar contraseña</label>
          <input {...bind('confirm')} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Repite la contraseña" />
          {errors.confirm && <small className="field__error">{errors.confirm}</small>}
        </div>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        <button className="btn btn--primary btn--lg btn--block" disabled={sending}>
          <UserPlus size={18} />{sending ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
        <p className="auth__switch">¿Ya tienes cuenta? <Link to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Inicia sesión</Link></p>
      </form>
    </div>
  );
}
