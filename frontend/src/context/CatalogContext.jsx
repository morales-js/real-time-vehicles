import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const EMPTY = { brands: [], itemTypes: [], fuelTypes: [], transmissions: [], driveTrains: [], damageLevels: [] };
const CatalogContext = createContext({ catalogs: EMPTY, ready: false });

/** Catálogos (marcas, tipos, combustibles...) cargados una sola vez desde la API. */
export function CatalogProvider({ children }) {
  const [state, setState] = useState({ catalogs: EMPTY, ready: false, error: null });

  useEffect(() => {
    let alive = true;
    const load = (attempt = 0) => api('/catalogs')
      .then((catalogs) => alive && setState({ catalogs, ready: true, error: null }))
      .catch((err) => {
        if (!alive) return;
        if (attempt < 5) setTimeout(() => load(attempt + 1), 2000 * (attempt + 1));
        else setState((s) => ({ ...s, error: err.message }));
      });
    load();
    return () => { alive = false; };
  }, []);

  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}

export const useCatalogs = () => useContext(CatalogContext);
