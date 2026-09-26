import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo el SPA (5173) redirige /api y /socket.io a la Web API (4000).
// En producción el build se copia a backend/public y lo sirve la misma API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
});
