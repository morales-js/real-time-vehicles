const { query } = require('../db/pool');
const { minNextBid, phaseOf, personalStatus } = require('./auctionRules');

const imageUrl = (id) => `/api/images/${id}`;

/** SELECT base con catálogos. @uid (puede ser NULL) calcula el estado personal del usuario. */
const BASE_SELECT = `
SELECT v.Id, v.SellerId, v.[Year], v.Model, v.Engine, v.Cylinders, v.Color, v.Mileage, v.Description,
       v.BasePrice, v.StartAt, v.EndAt, v.CurrentBid, v.CurrentBidderId, v.BidCount, v.Status, v.ClosedAt,
       v.CreatedAt, v.UpdatedAt,
       v.ItemTypeId, it.Name AS ItemTypeName, it.Body AS ItemTypeBody,
       v.BrandId, b.Name AS BrandName,
       v.TransmissionId, t.Name AS TransmissionName,
       v.FuelTypeId, f.Name AS FuelTypeName,
       v.DriveTrainId, d.Code AS DriveTrainCode, d.Name AS DriveTrainName,
       v.DamageLevelId, dl.Code AS DamageCode, dl.Name AS DamageName,
       dl.Description AS DamageDescription, dl.Color AS DamageColor,
       (SELECT TOP 1 i.Id FROM dbo.VehicleImages i WHERE i.VehicleId = v.Id ORDER BY i.SortOrder, i.Id) AS CoverImageId,
       (SELECT COUNT(*) FROM dbo.VehicleImages i WHERE i.VehicleId = v.Id) AS ImageCount,
       CASE WHEN @uid IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Bids x WHERE x.VehicleId = v.Id AND x.UserId = @uid)
            THEN 1 ELSE 0 END AS UserHasBid
FROM dbo.Vehicles v
JOIN dbo.ItemTypes it     ON it.Id = v.ItemTypeId
JOIN dbo.Brands b         ON b.Id = v.BrandId
JOIN dbo.Transmissions t  ON t.Id = v.TransmissionId
JOIN dbo.FuelTypes f      ON f.Id = v.FuelTypeId
JOIN dbo.DriveTrains d    ON d.Id = v.DriveTrainId
JOIN dbo.DamageLevels dl  ON dl.Id = v.DamageLevelId`;

/**
 * Convierte una fila en el DTO público. Nunca incluye SellerId ni CurrentBidderId:
 * los demás usuarios solo ven montos, no identidades.
 */
function toDto(r, userId = null, now = new Date()) {
  const status = phaseOf(r, now);
  const closed = status === 'VENDIDA' || status === 'DESIERTA';
  return {
    id: r.Id,
    title: `${r.BrandName} ${r.Model} ${r.Year}`,
    year: r.Year,
    brand: { id: r.BrandId, name: r.BrandName },
    model: r.Model,
    itemType: { id: r.ItemTypeId, name: r.ItemTypeName, body: r.ItemTypeBody },
    engine: r.Engine,
    transmission: { id: r.TransmissionId, name: r.TransmissionName },
    fuelType: { id: r.FuelTypeId, name: r.FuelTypeName },
    driveTrain: { id: r.DriveTrainId, code: r.DriveTrainCode, name: r.DriveTrainName },
    cylinders: r.Cylinders,
    damageLevel: {
      id: r.DamageLevelId, code: r.DamageCode, name: r.DamageName,
      description: r.DamageDescription, color: r.DamageColor,
    },
    color: r.Color,
    mileage: r.Mileage,
    description: r.Description,
    basePrice: Number(r.BasePrice),
    currentBid: r.CurrentBid == null ? null : Number(r.CurrentBid),
    minNextBid: minNextBid(r.BasePrice, r.CurrentBid),
    bidCount: r.BidCount,
    startAt: r.StartAt,
    endAt: r.EndAt,
    closedAt: r.ClosedAt,
    status,
    coverImageUrl: r.CoverImageId ? imageUrl(r.CoverImageId) : null,
    imageCount: r.ImageCount,
    createdAt: r.CreatedAt,
    isOwner: userId != null && r.SellerId === userId,
    myStatus: personalStatus({
      userId, currentBidderId: r.CurrentBidderId, hasBid: !!r.UserHasBid, closed,
    }),
  };
}

// ---------------------------------------------------------------------------
// Filtros del inventario
// ---------------------------------------------------------------------------
const ID_LIST_FILTERS = {
  brandId: 'v.BrandId',
  itemTypeId: 'v.ItemTypeId',
  fuelTypeId: 'v.FuelTypeId',
  transmissionId: 'v.TransmissionId',
  driveTrainId: 'v.DriveTrainId',
  damageLevelId: 'v.DamageLevelId',
  cylinders: 'v.Cylinders',
};

const SORTS = {
  ending: 'CASE WHEN v.EndAt > @now THEN 0 ELSE 1 END, v.EndAt ASC',
  newest: 'v.CreatedAt DESC',
  priceAsc: 'COALESCE(v.CurrentBid, v.BasePrice) ASC',
  priceDesc: 'COALESCE(v.CurrentBid, v.BasePrice) DESC',
  yearDesc: 'v.[Year] DESC',
  yearAsc: 'v.[Year] ASC',
  bids: 'v.BidCount DESC',
};

function intList(value) {
  if (value == null || value === '') return [];
  return String(value).split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0).slice(0, 30);
}

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lista vehículos con filtros combinables (filtros "multitarea").
 * Todos los valores van parametrizados para evitar inyección SQL.
 */
async function listVehicles(filters = {}, { userId = null, sellerId = null } = {}) {
  const now = new Date();
  const params = { uid: userId, now };
  const where = [];
  let p = 0;
  const param = (value) => { const name = `p${p++}`; params[name] = value; return `@${name}`; };

  if (sellerId != null) where.push(`v.SellerId = ${param(sellerId)}`);

  const q = String(filters.q || '').trim().slice(0, 80);
  if (q) {
    const like = param(`%${q}%`);
    where.push(`(b.Name LIKE ${like} OR v.Model LIKE ${like} OR v.Engine LIKE ${like} OR it.Name LIKE ${like}
      OR CONCAT(b.Name, ' ', v.Model) LIKE ${like} OR CAST(v.[Year] AS NVARCHAR(4)) = ${param(q)})`);
  }
  if (filters.model) where.push(`v.Model LIKE ${param(`%${String(filters.model).slice(0, 80)}%`)}`);
  if (filters.engine) where.push(`v.Engine LIKE ${param(`%${String(filters.engine).slice(0, 80)}%`)}`);

  const yearMin = num(filters.yearMin);
  const yearMax = num(filters.yearMax);
  if (yearMin != null) where.push(`v.[Year] >= ${param(yearMin)}`);
  if (yearMax != null) where.push(`v.[Year] <= ${param(yearMax)}`);

  const priceMin = num(filters.priceMin);
  const priceMax = num(filters.priceMax);
  if (priceMin != null) where.push(`COALESCE(v.CurrentBid, v.BasePrice) >= ${param(priceMin)}`);
  if (priceMax != null) where.push(`COALESCE(v.CurrentBid, v.BasePrice) <= ${param(priceMax)}`);

  for (const [key, column] of Object.entries(ID_LIST_FILTERS)) {
    const ids = intList(filters[key]);
    if (ids.length) where.push(`${column} IN (${ids.map(param).join(', ')})`);
  }

  switch (String(filters.status || 'vigentes').toLowerCase()) {
    case 'activa': where.push('v.StartAt <= @now AND v.EndAt > @now AND v.ClosedAt IS NULL'); break;
    case 'programada': where.push('v.StartAt > @now'); break;
    case 'cerrada': where.push('(v.EndAt <= @now OR v.ClosedAt IS NOT NULL)'); break;
    case 'todas': break;
    default: where.push('v.EndAt > @now AND v.ClosedAt IS NULL'); // vigentes: activas + programadas
  }

  if (filters.mine === 'bids' && userId) {
    where.push('EXISTS (SELECT 1 FROM dbo.Bids x WHERE x.VehicleId = v.Id AND x.UserId = @uid)');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORTS[filters.sort] || SORTS.ending;
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 12, 1), 60);
  const page = Math.max(Number(filters.page) || 1, 1);
  params.offset = (page - 1) * pageSize;
  params.limit = pageSize;

  const sqlText = `
    ${BASE_SELECT}
    ${whereSql}
    ORDER BY ${orderSql}, v.Id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

    SELECT COUNT(*) AS Total
    FROM dbo.Vehicles v
    JOIN dbo.ItemTypes it ON it.Id = v.ItemTypeId
    JOIN dbo.Brands b ON b.Id = v.BrandId
    ${whereSql};`;

  const result = await query(sqlText, params);
  const total = result.recordsets[1][0].Total;
  return {
    items: result.recordsets[0].map((r) => toDto(r, userId, now)),
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

async function getVehicleRow(id, userId = null) {
  const r = await query(`${BASE_SELECT} WHERE v.Id = @id`, { id, uid: userId });
  return r.recordset[0] || null;
}

async function getVehicle(id, userId = null) {
  const row = await getVehicleRow(id, userId);
  if (!row) return null;
  const imgs = await query(
    'SELECT Id FROM dbo.VehicleImages WHERE VehicleId = @id ORDER BY SortOrder, Id', { id }
  );
  return {
    ...toDto(row, userId),
    images: imgs.recordset.map((i) => ({ id: i.Id, url: imageUrl(i.Id) })),
  };
}

/** Historial anónimo: montos y horas; "mine" solo marca las ofertas propias del solicitante. */
async function getBidHistory(vehicleId, userId = null, limit = 20) {
  const r = await query(
    `SELECT TOP (@limit) Id, Amount, CreatedAt, CASE WHEN UserId = @uid THEN 1 ELSE 0 END AS Mine
     FROM dbo.Bids WHERE VehicleId = @id ORDER BY Amount DESC, Id DESC`,
    { id: vehicleId, uid: userId, limit }
  );
  return r.recordset.map((b) => ({
    id: String(b.Id), amount: Number(b.Amount), createdAt: b.CreatedAt, mine: !!b.Mine,
  }));
}

async function getBidderIds(vehicleId) {
  const r = await query('SELECT DISTINCT UserId FROM dbo.Bids WHERE VehicleId = @id', { id: vehicleId });
  return new Set(r.recordset.map((x) => x.UserId));
}

module.exports = { listVehicles, getVehicle, getVehicleRow, getBidHistory, getBidderIds, toDto, imageUrl };
