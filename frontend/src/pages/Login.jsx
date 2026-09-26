import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail, Lock, Gavel } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function AuthAside() {
  return (
    <aside className="auth__aside">
      <span className="auth__badge"><Gavel size={16} />Subastas en tiempo real</span>
      <h2>Puja, gana y maneja tu próximo vehículo.</h2>
      <ul>
        <li><b>1</b>Regístrate gratis con tu correo.</li>
        <li><b>2</b>Encuentra vehículos con filtros avanzados.</li>
        <li><b>3</b>Oferta en vivo y recibe alertas al instante.</li>
      </ul>
    </aside>
  );
}

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  if (isAuthenticated && !sending) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const user = await login(form.email, form.password);
      toast.push({ type: 'success', title: `¡Bienvenido, ${user.firstName}!`, message: 'Ya puedes ofertar y publicar vehículos.' });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  return (
    <div className="container auth">
      <AuthAside />
      <form className="auth__card" onSubmit={submit} noValidate>
        <h1>Iniciar sesión</h1>
        <p className="muted">Ingresa para ofertar en subastas y publicar tus vehículos.</p>

        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <div className="input-icon"><Mail size={18} />
            <input id="email" type="email" autoComplete="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@correo.com" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <div className="input-icon"><Lock size={18} />
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            <button type="button" className="input-icon__btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        <button className="btn btn--primary btn--lg btn--block" disabled={sending}>
          <LogIn size={18} />{sending ? 'Ingresando...' : 'Ingresar'}
        </button>
        <p className="auth__switch">¿No tienes cuenta? <Link to={`/registro${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Crear cuenta</Link></p>
      </form>
    </div>
  );
}
