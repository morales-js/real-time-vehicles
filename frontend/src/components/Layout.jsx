import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Car, Gavel, LayoutGrid, LogOut, Menu, PlusCircle, Search, UserCircle2, X, ListChecks } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="AutoPuja GT, inicio">
      <span className="logo__mark"><Car size={20} strokeWidth={2.4} /></span>
      <span className="logo__text">AutoPuja<span> GT</span></span>
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initials = `${user.firstName[0] || ''}${user.lastName[0] || ''}`.toUpperCase();
  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar">{initials}</span>
        <span className="usermenu__name">{user.firstName}</span>
      </button>
      {open && (
        <div className="usermenu__panel" onClick={() => setOpen(false)}>
          <div className="usermenu__head">
            <strong>{user.firstName} {user.lastName}</strong>
            <span>{user.email}</span>
          </div>
          <Link to="/mis-pujas"><Gavel size={16} />Mis pujas</Link>
          <Link to="/mis-publicaciones"><ListChecks size={16} />Mis publicaciones</Link>
          <Link to="/publicar"><PlusCircle size={16} />Publicar vehículo</Link>
          <button onClick={() => { logout(); navigate('/'); }}><LogOut size={16} />Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { isAuthenticated, loading } = useAuth();
  const { connected } = useSocket();
  const [mobile, setMobile] = useState(false);
  const location = useLocation();

  useEffect(() => setMobile(false), [location.pathname]);

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Logo />
        <nav className={`navbar__links ${mobile ? 'is-open' : ''}`}>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/inventario"><LayoutGrid size={16} />Inventario</NavLink>
          <NavLink to="/publicar"><PlusCircle size={16} />Publicar</NavLink>
          {isAuthenticated && <NavLink to="/mis-pujas"><Gavel size={16} />Mis pujas</NavLink>}
          {isAuthenticated && <NavLink to="/mis-publicaciones"><ListChecks size={16} />Mis publicaciones</NavLink>}
          {!isAuthenticated && !loading && (
            <div className="navbar__mobile-auth">
              <Link to="/login" className="btn btn--ghost">Iniciar sesión</Link>
              <Link to="/registro" className="btn btn--primary">Crear cuenta</Link>
            </div>
          )}
        </nav>
        <div className="navbar__right">
          <span className={`live ${connected ? 'is-on' : ''}`} title={connected ? 'Conectado en tiempo real' : 'Reconectando...'}>
            <span className="live__dot" />{connected ? 'En vivo' : 'Conectando'}
          </span>
          <Link to="/inventario" className="icon-btn hide-md" aria-label="Buscar vehículos"><Search size={18} /></Link>
          {isAuthenticated ? <UserMenu /> : !loading && (
            <div className="navbar__auth">
              <Link to="/login" className="btn btn--ghost"><UserCircle2 size={18} />Iniciar sesión</Link>
              <Link to="/registro" className="btn btn--primary">Crear cuenta</Link>
            </div>
          )}
          <button className="icon-btn navbar__burger" onClick={() => setMobile((m) => !m)} aria-label="Menú">
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <Logo />
          <p>Subastas de vehículos importados en tiempo real. Regístrese, encuentre y oferte desde cualquier lugar.</p>
        </div>
        <div>
          <h4>Explorar</h4>
          <Link to="/inventario">Inventario</Link>
          <Link to="/inventario?status=programada">Próximas subastas</Link>
          <Link to="/inventario?status=cerrada">Resultados</Link>
        </div>
        <div>
          <h4>Vender</h4>
          <Link to="/publicar">Publicar vehículo</Link>
          <Link to="/mis-publicaciones">Mis publicaciones</Link>
        </div>
        <div>
          <h4>Reglas de la subasta</h4>
          <p className="small">Las ofertas inician en el monto base y cada nueva puja debe superar la actual en al menos 10 %. La identidad de los postores es confidencial.</p>
        </div>
      </div>
      <div className="container footer__legal">© {new Date().getFullYear()} AutoPuja GT · Proyecto académico — Diseño Web</div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app">
      <Navbar />
      <main className="main"><Outlet /></main>
      <Footer />
    </div>
  );
}
