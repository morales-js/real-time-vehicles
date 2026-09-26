import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, AlertTriangle, Info, Trophy, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: AlertTriangle, warning: AlertTriangle, info: Info, trophy: Trophy, bell: BellRing };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((toast) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, type: 'info', ...toast }]);
    setTimeout(() => dismiss(id), toast.duration || 7000);
  }, [dismiss]);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.icon || t.type] || Info;
          return (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <Icon size={20} className="toast__icon" />
              <div className="toast__body">
                {t.title && <strong>{t.title}</strong>}
                {t.message && <p>{t.message}</p>}
                {t.link && <Link to={t.link} onClick={() => dismiss(t.id)}>{t.linkText || 'Ver subasta'} →</Link>}
              </div>
              <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Cerrar"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
