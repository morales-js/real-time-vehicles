const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env;

function buildDbConfig() {
  const pool = { max: 10, min: 0, idleTimeoutMillis: 30000 };
  // Azure SQL serverless puede tardar en "despertar": damos margen.
  const timeouts = { connectionTimeout: 60000, requestTimeout: 30000 };

  if (env.SQL_CONNECTION_STRING) {
    return { connectionString: env.SQL_CONNECTION_STRING, pool, ...timeouts };
  }
  const encrypt = env.DB_ENCRYPT === 'true';
  return {
    server: env.DB_SERVER || '127.0.0.1',
    port: Number(env.DB_PORT || 1433),
    database: env.DB_NAME || 'SubastasDB',
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    pool,
    ...timeouts,
    options: { encrypt, trustServerCertificate: !encrypt, useUTC: true },
  };
}

module.exports = {
  port: Number(env.PORT || 4000),
  jwtSecret: env.JWT_SECRET || 'dev-autopuja-cambia-este-secreto',
  jwtExpiresIn: '7d',
  corsOrigins: (env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  autoSeed: env.AUTO_SEED !== 'false',
  db: buildDbConfig(),
  auction: {
    minIncrement: 0.10, // 10 %
    minImages: 5,
    maxImages: 12,
  },
};
