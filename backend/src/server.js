const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');

const config = require('./config');
const { getPool } = require('./db/pool');
const { migrate } = require('./db/migrate');
const { HttpError } = require('./http');
const realtime = require('./realtime');
const auctionCloser = require('./services/auctionCloser');

const app = express();
app.set('trust proxy', 1); // Azure App Service está detrás de un proxy
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
if (config.corsOrigins.length) {
  app.use('/api', cors({ origin: config.corsOrigins, exposedHeaders: ['X-Server-Time'] }));
}
app.use(express.json({ limit: '1mb' }));

// Hora del servidor en cada respuesta: el cliente sincroniza sus relojes de subasta con ella.
app.use('/api', (_req, res, next) => {
  res.set('X-Server-Time', String(Date.now()));
  res.set('Cache-Control', 'no-store');
  next();
});

let dbReady = false;
app.get('/api/health', (_req, res) => res.json({ ok: true, db: dbReady, serverTime: Date.now() }));
app.use('/api', (_req, _res, next) => (dbReady ? next() : next(new HttpError(503, 'La base de datos se está iniciando, intenta en unos segundos.'))));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/catalogs', require('./routes/catalogs'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/images', require('./routes/images'));
app.use('/api/me', require('./routes/me'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint no encontrado.')));

// Frontend compilado (SPA). Cualquier ruta que no sea /api devuelve index.html.
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.send('API de AutoPuja GT en ejecución. Compila el frontend con "npm run build" en la raíz.'));
}

// Manejo centralizado de errores -> { error, details }
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'Cada foto debe pesar como máximo 6 MB.'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? `Máximo ${config.auction.maxImages} fotografías.`
        : 'Error al subir las imágenes.';
    return res.status(400).json({ error: msg });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  console.error('[error]', err);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
});

async function connectWithRetry(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      await getPool();
      return;
    } catch (err) {
      console.error(`[db] intento ${i}/${retries} falló: ${err.message}`);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, Math.min(3000 * i, 15000)));
    }
  }
}

async function start() {
  const server = http.createServer(app);
  realtime.init(server, config.corsOrigins);
  server.listen(config.port, () => console.log(`[api] escuchando en http://localhost:${config.port}`));

  await connectWithRetry();
  await migrate();
  console.log('[db] esquema verificado');
  if (config.autoSeed) {
    const { seedIfEmpty } = require('./db/seed');
    await seedIfEmpty();
  }
  dbReady = true;
  auctionCloser.start();
  console.log('[subasta] motor de cierre automático activo');
}

start().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
