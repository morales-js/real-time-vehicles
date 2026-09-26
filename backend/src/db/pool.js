const sql = require('mssql');
const config = require('../config');

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    const cfg = config.db.connectionString || config.db;
    poolPromise = new sql.ConnectionPool(cfg)
      .connect()
      .then((pool) => {
        pool.on('error', (err) => console.error('[db] error en pool:', err.message));
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

/**
 * Agrega parámetros a un request. Un valor puede ser crudo (el driver infiere el tipo)
 * o { type, value } para forzar el tipo SQL.
 */
function bind(request, params = {}) {
  for (const [name, v] of Object.entries(params)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) && 'type' in v) {
      request.input(name, v.type, v.value);
    } else {
      request.input(name, v === undefined ? null : v);
    }
  }
  return request;
}

async function query(text, params) {
  const pool = await getPool();
  return bind(pool.request(), params).query(text);
}

/** Ejecuta fn(requestFactory) dentro de una transacción. */
async function withTransaction(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    const req = (params) => bind(new sql.Request(tx), params);
    const result = await fn(req);
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch { /* ya revertida */ }
    throw err;
  }
}

module.exports = { sql, getPool, query, withTransaction };
