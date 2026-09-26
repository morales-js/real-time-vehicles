import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const applySession = useCallback((t, u) => {
    setToken(t);
    setTokenState(t);
    setUser(u);
  }, []);

  const logout = useCallback(() => applySession(null, null), [applySession]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restaura la sesión guardada.
  useEffect(() => {
    if (!token || user) { setLoading(false); return; }
    let alive = true;
    api('/auth/me')
      .then((r) => alive && setUser(r.user))
      .catch(() => alive && logout())
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = useCallback(async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    applySession(r.token, r.user);
    return r.user;
  }, [applySession]);

  const register = useCallback(async (data) => {
    const r = await api('/auth/register', { method: 'POST', body: data });
    applySession(r.token, r.user);
    return r.user;
  }, [applySession]);

  const value = useMemo(
    () => ({ user, token, loading, isAuthenticated: !!user, login, register, logout }),
    [user, token, loading, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
