const fs = require('fs');
const path = require('path');
const { getPool } = require('./pool');

/** Crea tablas, índices y catálogos si no existen. */
async function migrate() {
  const script = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const batches = script
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.replace(/--.*$/gm, '').trim().length > 0);

  const pool = await getPool();
  for (const batch of batches) {
    await pool.request().batch(batch);
  }
}

module.exports = { migrate };
