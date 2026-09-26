const express = require('express');
const multer = require('multer');
const config = require('../config');
const { sql, query, withTransaction } = require('../db/pool');
const { HttpError, ah, parseId } = require('../http');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { loadAll: loadCatalogs } = require('./catalogs');
const repo = require('../services/vehicleRepo');
const { validateBid, minNextBid, phaseOf } = require('../services/auctionRules');
const realtime = require('../realtime');

const router = express.Router();
const { minImages, maxImages } = config.auction;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: maxImages },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, `Formato de imagen no permitido (${file.originalname}). Usa JPG, PNG o WEBP.`));
  },
});

// ---------------------------------------------------------------------------
// Validación de la publicación
// ---------------------------------------------------------------------------
function parseBodyData(req) {
  try {
    return typeof req.body.data === 'string' ? JSON.parse(req.body.data) : (req.body.data || req.body);
  } catch {
    throw new HttpError(400, 'El formato de los datos enviados no es válido.');
  }
}

function parseDate(value) {
  const d = new Date(value);
  return value && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * Valida todos los campos obligatorios de la ficha técnica y de la subasta.
 * `existing` (fila de BD) se usa al editar para aplicar las restricciones de subastas con pujas.
 */
async function validateVehicle(data, existing = null) {
  const cat = await loadCatalogs();
  const errors = {};
  const now = new Date();
  const maxYear = now.getUTCFullYear() + 1;
  const inCatalog = (list, id) => list.some((x) => x.id === Number(id));
  const text = (v, max) => String(v ?? '').trim().slice(0, max);

  const v = {
    year: Number(data.year),
    itemTypeId: Number(data.itemTypeId),
    brandId: Number(data.brandId),
    model: text(data.model, 80),
    engine: text(data.engine, 80),
    transmissionId: Number(data.transmissionId),
    fuelTypeId: Number(data.fuelTypeId),
    driveTrainId: Number(data.driveTrainId),
    cylinders: Number(data.cylinders),
    damageLevelId: Number(data.damageLevelId),
    color: text(data.color, 40) || null,
    mileage: data.mileage === '' || data.mileage == null ? null : Number(data.mileage),
    description: text(data.description, 2000) || null,
    basePrice: Number(data.basePrice),
    startAt: parseDate(data.startAt),
    endAt: parseDate(data.endAt),
  };

  if (!Number.isInteger(v.year) || v.year < 1950 || v.year > maxYear) errors.year = `El año debe estar entre 1950 y ${maxYear}.`;
  if (!inCatalog(cat.itemTypes, v.itemTypeId)) errors.itemTypeId = 'Selecciona el tipo de artículo.';
  if (!inCatalog(cat.brands, v.brandId)) errors.brandId = 'Selecciona la marca.';
  if (v.model.length < 1) errors.model = 'Ingresa el modelo.';
  if (v.engine.length < 1) errors.engine = 'Ingresa el motor (ej. 2.5L I4).';
  if (!inCatalog(cat.transmissions, v.transmissionId)) errors.transmissionId = 'Selecciona la transmisión.';
  if (!inCatalog(cat.fuelTypes, v.fuelTypeId)) errors.fuelTypeId = 'Selecciona el tipo de combustible.';
  if (!inCatalog(cat.driveTrains, v.driveTrainId)) errors.driveTrainId = 'Selecciona el tren de manejo.';
  if (!Number.isInteger(v.cylinders) || v.cylinders < 0 || v.cylinders > 16) errors.cylinders = 'Número de cilindros entre 0 y 16.';
  if (!inCatalog(cat.damageLevels, v.damageLevelId)) errors.damageLevelId = 'Selecciona el estado de daño.';
  if (v.mileage != null && (!Number.isInteger(v.mileage) || v.mileage < 0 || v.mileage > 3000000)) errors.mileage = 'Kilometraje inválido.';
  if (!Number.isFinite(v.basePrice) || v.basePrice <= 0 || v.basePrice > 999999999) errors.basePrice = 'Ingresa un monto base mayor a 0.';
  if (!v.startAt) errors.startAt = 'Ingresa la fecha y hora de inicio.';
  if (!v.endAt) errors.endAt = 'Ingresa la fecha y hora de cierre.';

  if (v.startAt && v.endAt) {
    const startChanged = !existing || Math.abs(v.startAt - existing.StartAt) > 1000;
    if (startChanged && v.startAt < new Date(now.getTime() - 10 * 60 * 1000)) {
      errors.startAt = 'La fecha de inicio no puede estar en el pasado.';
    }
    if (v.endAt <= v.startAt) errors.endAt = 'El cierre debe ser posterior al inicio.';
    else if (v.endAt < new Date(now.getTime() + 60 * 1000)) errors.endAt = 'El cierre debe ser al menos 1 minuto en el futuro.';
    else if (v.endAt - v.startAt > 90 * 24 * 3600 * 1000) errors.endAt = 'La subasta puede durar como máximo 90 días.';
  }

  // Si ya hay pujas no se puede alterar el precio base ni el inicio (sería injusto para los postores).
  if (existing && existing.BidCount > 0) {
    if (Math.round(v.basePrice * 100) !== Math.round(Number(existing.BasePrice) * 100)) {
      errors.basePrice = 'La subasta ya tiene ofertas: no se puede cambiar el monto base.';
    }
    if (v.startAt && Math.abs(v.startAt - existing.StartAt) > 1000) {
      errors.startAt = 'La subasta ya tiene ofertas: no se puede cambiar la fecha de inicio.';
    }
    if (v.endAt && v.endAt < existing.EndAt) {
      errors.endAt = 'La subasta ya tiene ofertas: el cierre solo puede extenderse.';
    }
  }

  if (Object.keys(errors).length) throw new HttpError(400, 'Revisa los campos marcados.', errors);
  return v;
}

function vehicleParams(v) {
  return {
    year: v.year, itemTypeId: v.itemTypeId, brandId: v.brandId, model: v.model, engine: v.engine,
    transmissionId: v.transmissionId, fuelTypeId: v.fuelTypeId, driveTrainId: v.driveTrainId,
    cylinders: v.cylinders, damageLevelId: v.damageLevelId, color: v.color,
    mileage: { type: sql.Int, value: v.mileage },
    description: { type: sql.NVarChar(2000), value: v.description },
    basePrice: { type: sql.Decimal(14, 2), value: v.basePrice },
    startAt: { type: sql.DateTime2, value: v.startAt },
    endAt: { type: sql.DateTime2, value: v.endAt },
  };
}

async function insertImages(req, vehicleId, files, startOrder = 0) {
  for (let i = 0; i < files.length; i++) {
    await req({
      vehicleId, sortOrder: startOrder + i, contentType: files[i].mimetype,
      data: { type: sql.VarBinary(sql.MAX), value: files[i].buffer },
    }).query(`INSERT INTO dbo.VehicleImages (VehicleId, SortOrder, ContentType, Data)
              VALUES (@vehicleId, @sortOrder, @contentType, @data)`);
  }
}

// ---------------------------------------------------------------------------
// Lectura (pública: modo lectura para usuarios no autenticados)
// ---------------------------------------------------------------------------

/** GET /api/vehicles?q=&brandId=1,2&yearMin=&damageLevelId=&status=&sort=&page= */
router.get('/', optionalAuth, ah(async (req, res) => {
  const { mine, ...filters } = req.query; // "mine" solo se usa desde /api/me
  res.json({ ...(await repo.listVehicles(filters, { userId: req.userId })), serverTime: Date.now() });
}));

/** GET /api/vehicles/:id -> ficha técnica completa + galería + estado de la subasta. */
router.get('/:id', optionalAuth, ah(async (req, res) => {
  const vehicle = await repo.getVehicle(parseId(req.params.id), req.userId);
  if (!vehicle) throw new HttpError(404, 'Vehículo no encontrado.');
  res.json({ vehicle, serverTime: Date.now() });
}));

/** GET /api/vehicles/:id/bids -> historial anónimo (solo montos y horas). */
router.get('/:id/bids', optionalAuth, ah(async (req, res) => {
  const id = parseId(req.params.id);
  res.json({ bids: await repo.getBidHistory(id, req.userId) });
}));

// ---------------------------------------------------------------------------
// Publicación y edición (requiere sesión)
// ---------------------------------------------------------------------------

/** POST /api/vehicles (multipart: data=JSON, images=archivos) */
router.post('/', requireAuth, upload.array('images', maxImages), ah(async (req, res) => {
  const data = parseBodyData(req);
  const v = await validateVehicle(data);
  const files = req.files || [];
  if (files.length < minImages) {
    throw new HttpError(400, `Debes subir al menos ${minImages} fotografías.`, { images: `Mínimo ${minImages} fotografías.` });
  }

  const id = await withTransaction(async (tx) => {
    const r = await tx({ ...vehicleParams(v), sellerId: req.userId }).query(
      `INSERT INTO dbo.Vehicles (SellerId, [Year], ItemTypeId, BrandId, Model, Engine, TransmissionId, FuelTypeId,
         DriveTrainId, Cylinders, DamageLevelId, Color, Mileage, Description, BasePrice, StartAt, EndAt)
       OUTPUT inserted.Id
       VALUES (@sellerId, @year, @itemTypeId, @brandId, @model, @engine, @transmissionId, @fuelTypeId,
         @driveTrainId, @cylinders, @damageLevelId, @color, @mileage, @description, @basePrice, @startAt, @endAt)`
    );
    const newId = r.recordset[0].Id;
    await insertImages(tx, newId, files);
    return newId;
  });

  realtime.broadcastVehicleChanged(id, 'created');
  res.status(201).json({ vehicle: await repo.getVehicle(id, req.userId) });
}));

/**
 * PUT /api/vehicles/:id (multipart)
 * data.imageOrder: ["e:12", "n:0", ...] -> e = imagen existente por id, n = archivo nuevo por índice.
 */
router.put('/:id', requireAuth, upload.array('images', maxImages), ah(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await repo.getVehicleRow(id, req.userId);
  if (!existing) throw new HttpError(404, 'Vehículo no encontrado.');
  if (existing.SellerId !== req.userId) throw new HttpError(403, 'Solo el publicador puede editar este vehículo.');
  const phase = phaseOf(existing);
  if (phase === 'VENDIDA' || phase === 'DESIERTA') throw new HttpError(409, 'La subasta ya cerró; no puede editarse.');

  const data = parseBodyData(req);
  const v = await validateVehicle(data, existing);
  const files = req.files || [];

  const current = await query('SELECT Id FROM dbo.VehicleImages WHERE VehicleId = @id ORDER BY SortOrder, Id', { id });
  const existingIds = new Set(current.recordset.map((x) => x.Id));
  const order = Array.isArray(data.imageOrder)
    ? data.imageOrder.map(String)
    : [...current.recordset.map((x) => `e:${x.Id}`), ...files.map((_, i) => `n:${i}`)];

  const plan = [];
  const usedFiles = new Set();
  for (const token of order) {
    const [kind, raw] = token.split(':');
    const n = Number(raw);
    if (kind === 'e' && existingIds.has(n)) plan.push({ existingId: n });
    else if (kind === 'n' && files[n] && !usedFiles.has(n)) { plan.push({ file: files[n] }); usedFiles.add(n); }
  }
  if (plan.length < minImages) {
    throw new HttpError(400, `La publicación debe tener al menos ${minImages} fotografías.`, { images: `Mínimo ${minImages} fotografías.` });
  }
  if (plan.length > maxImages) throw new HttpError(400, `Máximo ${maxImages} fotografías.`, { images: `Máximo ${maxImages}.` });

  await withTransaction(async (tx) => {
    // Bloquea la fila para no chocar con una puja concurrente.
    const locked = await tx({ id }).query('SELECT BidCount, BasePrice, StartAt FROM dbo.Vehicles WITH (UPDLOCK, ROWLOCK) WHERE Id = @id');
    await validateVehicle(data, { ...existing, ...locked.recordset[0] });

    await tx({ ...vehicleParams(v), id, now: new Date() }).query(
      `UPDATE dbo.Vehicles SET [Year] = @year, ItemTypeId = @itemTypeId, BrandId = @brandId, Model = @model,
         Engine = @engine, TransmissionId = @transmissionId, FuelTypeId = @fuelTypeId, DriveTrainId = @driveTrainId,
         Cylinders = @cylinders, DamageLevelId = @damageLevelId, Color = @color, Mileage = @mileage,
         Description = @description, BasePrice = @basePrice, StartAt = @startAt, EndAt = @endAt, UpdatedAt = @now
       WHERE Id = @id`
    );

    const keep = plan.filter((p) => p.existingId).map((p) => p.existingId);
    const toDelete = [...existingIds].filter((x) => !keep.includes(x));
    for (const imgId of toDelete) {
      await tx({ imgId, id }).query('DELETE FROM dbo.VehicleImages WHERE Id = @imgId AND VehicleId = @id');
    }
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      if (p.existingId) {
        await tx({ imgId: p.existingId, sortOrder: i }).query('UPDATE dbo.VehicleImages SET SortOrder = @sortOrder WHERE Id = @imgId');
      } else {
        await insertImages(tx, id, [p.file], i);
      }
    }
  });

  realtime.broadcastVehicleChanged(id, 'updated');
  res.json({ vehicle: await repo.getVehicle(id, req.userId) });
}));

// ---------------------------------------------------------------------------
// Pujas (tiempo real)
// ---------------------------------------------------------------------------

/** POST /api/vehicles/:id/bids { amount } */
router.post('/:id/bids', requireAuth, ah(async (req, res) => {
  const id = parseId(req.params.id);
  const amount = Number(req.body?.amount);
  const userId = req.userId;

  // Transacción con UPDLOCK: dos pujas simultáneas se procesan en serie, nunca ambas "ganan".
  const outcome = await withTransaction(async (tx) => {
    const r = await tx({ id }).query(
      `SELECT v.Id, v.SellerId, v.BasePrice, v.CurrentBid, v.CurrentBidderId, v.BidCount, v.StartAt, v.EndAt,
              v.ClosedAt, v.Model, v.[Year], b.Name AS BrandName
       FROM dbo.Vehicles v WITH (UPDLOCK, ROWLOCK)
       JOIN dbo.Brands b ON b.Id = v.BrandId
       WHERE v.Id = @id`
    );
    const vehicle = r.recordset[0];
    if (!vehicle) throw new HttpError(404, 'Vehículo no encontrado.');

    const now = new Date();
    const error = validateBid({ amount, vehicle, userId, now });
    if (error) {
      throw new HttpError(409, error, {
        currentBid: vehicle.CurrentBid == null ? null : Number(vehicle.CurrentBid),
        minNextBid: minNextBid(vehicle.BasePrice, vehicle.CurrentBid),
        status: phaseOf(vehicle, now),
      });
    }

    const ins = await tx({ id, userId, amount: { type: sql.Decimal(14, 2), value: amount }, now }).query(
      `INSERT INTO dbo.Bids (VehicleId, UserId, Amount, CreatedAt) OUTPUT inserted.Id, inserted.CreatedAt
       VALUES (@id, @userId, @amount, @now);
       UPDATE dbo.Vehicles SET CurrentBid = @amount, CurrentBidderId = @userId, BidCount = BidCount + 1, UpdatedAt = @now
       WHERE Id = @id;`
    );
    return {
      vehicle,
      bidId: ins.recordset[0].Id,
      createdAt: ins.recordset[0].CreatedAt,
      bidCount: vehicle.BidCount + 1,
    };
  });

  const { vehicle } = outcome;
  const payload = {
    vehicleId: id,
    title: `${vehicle.BrandName} ${vehicle.Model} ${vehicle.Year}`,
    amount,
    bidCount: outcome.bidCount,
    minNextBid: minNextBid(vehicle.BasePrice, amount),
    bidderId: userId,
    previousBidderId: vehicle.CurrentBidderId,
    sellerId: vehicle.SellerId,
    bidId: outcome.bidId,
    createdAt: outcome.createdAt,
  };
  realtime.broadcastBid(payload).catch((e) => console.error('[realtime] broadcastBid:', e.message));

  res.status(201).json({
    bid: { id: String(outcome.bidId), amount, createdAt: outcome.createdAt, mine: true },
    currentBid: amount,
    bidCount: outcome.bidCount,
    minNextBid: payload.minNextBid,
    myStatus: 'WINNING',
    serverTime: Date.now(),
  });
}));

module.exports = router;
