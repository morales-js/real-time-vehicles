const express = require('express');
const { query } = require('../db/pool');
const { HttpError, ah } = require('../http');

const router = express.Router();

const CATALOGS = {
  brands: 'SELECT Id AS id, Name AS name FROM dbo.Brands ORDER BY Name',
  itemTypes: 'SELECT Id AS id, Name AS name, Body AS body FROM dbo.ItemTypes ORDER BY Id',
  fuelTypes: 'SELECT Id AS id, Name AS name FROM dbo.FuelTypes ORDER BY Id',
  transmissions: 'SELECT Id AS id, Name AS name FROM dbo.Transmissions ORDER BY Id',
  driveTrains: 'SELECT Id AS id, Code AS code, Name AS name FROM dbo.DriveTrains ORDER BY Id',
  damageLevels: 'SELECT Id AS id, Code AS code, Name AS name, Description AS description, Color AS color FROM dbo.DamageLevels ORDER BY Id',
};

async function loadAll() {
  const names = Object.keys(CATALOGS);
  const r = await query(names.map((n) => CATALOGS[n]).join(';\n'));
  const out = {};
  names.forEach((n, i) => { out[n] = r.recordsets[i]; });
  return out;
}

/** GET /api/catalogs -> todos los catálogos para formularios y filtros. */
router.get('/', ah(async (_req, res) => {
  res.json(await loadAll());
}));

/** GET /api/catalogs/:name -> un catálogo específico. */
router.get('/:name', ah(async (req, res) => {
  const sqlText = CATALOGS[req.params.name];
  if (!sqlText) throw new HttpError(404, `Catálogo no encontrado. Disponibles: ${Object.keys(CATALOGS).join(', ')}`);
  const r = await query(sqlText);
  res.json(r.recordset);
}));

module.exports = router;
module.exports.loadAll = loadAll;
