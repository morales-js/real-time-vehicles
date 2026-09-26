/**
 * Datos de demostración: usuarios de prueba + vehículos en subasta.
 *   node src/db/seed.js           -> solo si la BD no tiene usuarios
 *   node src/db/seed.js --reset   -> borra usuarios/vehículos/pujas y vuelve a sembrar (fechas frescas)
 */
const bcrypt = require('bcryptjs');
const { sql, query, getPool } = require('./pool');
const { buildDemoImages } = require('./demoImages');

const USERS = [
  { key: 'ana', firstName: 'Ana', lastName: 'García', email: 'ana@autopuja.gt', phone: '+502 5555-1001', password: 'Ana#2026!' },
  { key: 'carlos', firstName: 'Carlos', lastName: 'López', email: 'carlos@autopuja.gt', phone: '+502 5555-1002', password: 'Carlos#2026!' },
  { key: 'sofia', firstName: 'Sofía', lastName: 'Martínez', email: 'sofia@autopuja.gt', phone: '+502 5555-1003', password: 'Sofia#2026!' },
  { key: 'demo', firstName: 'Importadora', lastName: 'Demo', email: 'demo@autopuja.gt', phone: '+502 5555-1000', password: 'Demo#2026!' },
];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// start/end: desplazamiento relativo a "ahora". bids: [usuario, monto] en orden cronológico.
const VEHICLES = [
  { seller: 'demo', brand: 'Toyota', model: 'Corolla LE', type: 'Sedán', year: 2020, engine: '1.8L I4', trans: 'CVT', fuel: 'Gasolina', drive: 'FWD', cyl: 4, damage: 'VERDE', color: '#C9CED6', mileage: 48200, base: 45000, start: -2 * HOUR, end: 3 * HOUR, bids: [['sofia', 45000]], desc: 'Golpe leve en defensa trasera. Arranca y camina. Llaves disponibles.' },
  { seller: 'demo', brand: 'Honda', model: 'CR-V EX', type: 'SUV', year: 2019, engine: '1.5L Turbo I4', trans: 'CVT', fuel: 'Gasolina', drive: 'AWD', cyl: 4, damage: 'AMARILLO', color: '#D64045', mileage: 71500, base: 60000, start: -1 * DAY, end: 2 * DAY, bids: [['carlos', 60000], ['ana', 66000]], desc: 'Daño lateral derecho en puertas. Bolsas de aire intactas.' },
  { seller: 'demo', brand: 'Ford', model: 'F-150 XLT', type: 'Pickup', year: 2018, engine: '5.0L V8', trans: 'Automática', fuel: 'Gasolina', drive: '4WD', cyl: 8, damage: 'ROJO', color: '#2F6FD6', mileage: 98000, base: 35000, start: -3 * HOUR, end: 12 * DAY, bids: [['sofia', 35000]], desc: 'Impacto frontal severo. Título de salvamento. Ideal para piezas.' },
  { seller: 'demo', brand: 'Tesla', model: 'Model 3 Long Range', type: 'Sedán', year: 2021, engine: 'Motor eléctrico dual', trans: 'Automática', fuel: 'Eléctrico', drive: 'AWD', cyl: 0, damage: 'AMARILLO', color: '#E3E7EE', mileage: 32000, base: 120000, start: -6 * HOUR, end: 14 * DAY, bids: [], desc: 'Daño en puerta trasera izquierda. Batería al 92 %.' },
  { seller: 'demo', brand: 'Jeep', model: 'Wrangler Sport', type: 'SUV', year: 2017, engine: '3.6L V6', trans: 'Manual', fuel: 'Gasolina', drive: '4WD', cyl: 6, damage: 'VERDE', color: '#F5A524', mileage: 88000, base: 90000, start: -2 * DAY, end: 10 * DAY, bids: [['ana', 90000], ['sofia', 99000], ['carlos', 108900]], desc: 'Muy buen estado. Techo desmontable. Llantas nuevas.' },
  { seller: 'demo', brand: 'Mazda', model: 'Mazda3 Grand Touring', type: 'Hatchback', year: 2022, engine: '2.5L I4', trans: 'Automática', fuel: 'Gasolina', drive: 'FWD', cyl: 4, damage: 'VERDE', color: '#B3202A', mileage: 18900, base: 85000, start: -5 * HOUR, end: 20 * DAY, bids: [], desc: 'Rayón superficial en defensa. Como nuevo.' },
  { seller: 'demo', brand: 'Chevrolet', model: 'Camaro SS', type: 'Coupé', year: 2016, engine: '6.2L V8', trans: 'Manual', fuel: 'Gasolina', drive: 'RWD', cyl: 8, damage: 'ROJO', color: '#F28C28', mileage: 61000, base: 30000, start: -1 * DAY, end: 8 * DAY, bids: [['carlos', 30000]], desc: 'Choque frontal, motor sin verificar. Venta como salvamento.' },
  { seller: 'demo', brand: 'Toyota', model: 'Hilux SRV', type: 'Pickup', year: 2019, engine: '2.8L Turbo Diésel I4', trans: 'Manual', fuel: 'Diésel', drive: '4WD', cyl: 4, damage: 'AMARILLO', color: '#8A94A6', mileage: 120000, base: 110000, start: -4 * HOUR, end: 16 * DAY, bids: [['carlos', 110000]], desc: 'Daño en palangana y compuerta. Mecánica en buen estado.' },
  { seller: 'demo', brand: 'Honda', model: 'Odyssey EX-L', type: 'Van / Minivan', year: 2018, engine: '3.5L V6', trans: 'Automática', fuel: 'Gasolina', drive: 'FWD', cyl: 6, damage: 'VERDE', color: '#6A8CC7', mileage: 83000, base: 70000, start: -8 * HOUR, end: 25 * DAY, bids: [], desc: '8 pasajeros, puertas eléctricas. Limpia.' },
  { seller: 'demo', brand: 'Nissan', model: 'Sentra SV', type: 'Sedán', year: 2021, engine: '2.0L I4', trans: 'CVT', fuel: 'Gasolina', drive: 'FWD', cyl: 4, damage: 'ROJO', color: '#5B6475', mileage: 25000, base: 18000, start: -1 * DAY, end: 5 * HOUR, bids: [['ana', 18000]], desc: 'Volcadura. Techo y pilares dañados.' },
  { seller: 'demo', brand: 'Kawasaki', model: 'Ninja 400', type: 'Motocicleta', year: 2022, engine: '399 cc bicilíndrico', trans: 'Manual', fuel: 'Gasolina', drive: 'RWD', cyl: 2, damage: 'VERDE', color: '#3FB950', mileage: 6400, base: 28000, start: -3 * HOUR, end: 18 * DAY, bids: [], desc: 'Caída leve, carenado con rayones.' },
  { seller: 'demo', brand: 'Toyota', model: 'RAV4 Hybrid XLE', type: 'SUV', year: 2020, engine: '2.5L I4 Híbrido', trans: 'CVT', fuel: 'Híbrido', drive: 'AWD', cyl: 4, damage: 'AMARILLO', color: '#3C7A89', mileage: 54000, base: 95000, start: 1 * DAY, end: 22 * DAY, bids: [], desc: 'Subasta programada. Daño trasero reparable.' },
  { seller: 'ana', brand: 'BMW', model: '330i Sport', type: 'Sedán', year: 2019, engine: '2.0L Turbo I4', trans: 'Automática', fuel: 'Gasolina', drive: 'RWD', cyl: 4, damage: 'VERDE', color: '#1D3F8F', mileage: 45000, base: 140000, start: -1 * DAY, end: 9 * DAY, bids: [['carlos', 140000], ['sofia', 154000]], desc: 'Publicado por Ana. Servicios en agencia.' },
  { seller: 'sofia', brand: 'Isuzu', model: 'NPR', type: 'Camión', year: 2015, engine: '5.2L Turbo Diésel I4', trans: 'Manual', fuel: 'Diésel', drive: 'RWD', cyl: 4, damage: 'AMARILLO', color: '#E8EBF0', mileage: 210000, base: 150000, start: -2 * HOUR, end: 15 * DAY, bids: [], desc: 'Publicado por Sofía. Caja seca de 16 pies.' },
  { seller: 'demo', brand: 'Dodge', model: 'Charger SXT', type: 'Sedán', year: 2020, engine: '3.6L V6', trans: 'Automática', fuel: 'Gasolina', drive: 'RWD', cyl: 6, damage: 'AMARILLO', color: '#7A2E8E', mileage: 39000, base: 55000, start: -2 * DAY, end: 45 * MIN, bids: [['sofia', 55000], ['carlos', 60500]], desc: '¡Cierra pronto! Daño en guardafango delantero.' },
  { seller: 'demo', brand: 'Hyundai', model: 'Tucson SEL', type: 'SUV', year: 2018, engine: '2.0L I4', trans: 'Automática', fuel: 'Gasolina', drive: 'FWD', cyl: 4, damage: 'VERDE', color: '#9C6B3F', mileage: 77000, base: 48000, start: -10 * DAY, end: -1 * DAY, bids: [['carlos', 50000], ['sofia', 55000]], desc: 'Subasta finalizada (vendida).' },
  { seller: 'demo', brand: 'Kia', model: 'Rio LX', type: 'Hatchback', year: 2017, engine: '1.6L I4', trans: 'Manual', fuel: 'Gasolina', drive: 'FWD', cyl: 4, damage: 'ROJO', color: '#4AA3DF', mileage: 99000, base: 22000, start: -8 * DAY, end: -2 * DAY, bids: [], desc: 'Subasta finalizada sin ofertas (desierta).' },
];

async function lookup(table, column = 'Name') {
  const r = await query(`SELECT Id, ${column} AS K FROM dbo.${table}`);
  return new Map(r.recordset.map((x) => [x.K, x.Id]));
}

async function seed() {
  const [brands, types, trans, fuels, drives, damages] = await Promise.all([
    lookup('Brands'), lookup('ItemTypes'), lookup('Transmissions'), lookup('FuelTypes'),
    lookup('DriveTrains', 'Code'), lookup('DamageLevels', 'Code'),
  ]);
  const bodyOf = new Map((await query('SELECT Name, Body FROM dbo.ItemTypes')).recordset.map((x) => [x.Name, x.Body]));

  const userIds = {};
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const r = await query(
      `INSERT INTO dbo.Users (FirstName, LastName, Email, Phone, PasswordHash) OUTPUT inserted.Id
       VALUES (@firstName, @lastName, @email, @phone, @hash)`,
      { ...u, hash }
    );
    userIds[u.key] = r.recordset[0].Id;
  }

  const now = Date.now();
  for (const v of VEHICLES) {
    const startAt = new Date(now + v.start);
    const endAt = new Date(now + v.end);
    const closed = endAt.getTime() <= now;
    const last = v.bids[v.bids.length - 1];
    const status = !closed ? 'ABIERTA' : last ? 'VENDIDA' : 'DESIERTA';

    const r = await query(
      `INSERT INTO dbo.Vehicles (SellerId, [Year], ItemTypeId, BrandId, Model, Engine, TransmissionId, FuelTypeId,
         DriveTrainId, Cylinders, DamageLevelId, Color, Mileage, Description, BasePrice, StartAt, EndAt,
         CurrentBid, CurrentBidderId, BidCount, Status, ClosedAt, CreatedAt)
       OUTPUT inserted.Id
       VALUES (@seller, @year, @type, @brand, @model, @engine, @trans, @fuel, @drive, @cyl, @damage, @color, @mileage,
         @desc, @base, @startAt, @endAt, @currentBid, @bidder, @bidCount, @status, @closedAt, @createdAt)`,
      {
        seller: userIds[v.seller], year: v.year, type: types.get(v.type), brand: brands.get(v.brand),
        model: v.model, engine: v.engine, trans: trans.get(v.trans), fuel: fuels.get(v.fuel),
        drive: drives.get(v.drive), cyl: v.cyl, damage: damages.get(v.damage), color: null,
        mileage: v.mileage, desc: v.desc,
        base: { type: sql.Decimal(14, 2), value: v.base },
        startAt: { type: sql.DateTime2, value: startAt },
        endAt: { type: sql.DateTime2, value: endAt },
        currentBid: { type: sql.Decimal(14, 2), value: last ? last[1] : null },
        bidder: { type: sql.Int, value: last ? userIds[last[0]] : null },
        bidCount: v.bids.length,
        status,
        closedAt: { type: sql.DateTime2, value: closed ? endAt : null },
        createdAt: { type: sql.DateTime2, value: new Date(Math.min(startAt.getTime(), now) - HOUR) },
      }
    );
    const id = r.recordset[0].Id;

    const images = buildDemoImages({
      title: `${v.brand} ${v.model} ${v.year}`, lot: String(id).padStart(5, '0'), color: v.color,
      body: bodyOf.get(v.type), damage: v.damage, engine: v.engine, cylinders: v.cyl, transmission: v.trans,
    });
    for (let i = 0; i < images.length; i++) {
      await query(
        'INSERT INTO dbo.VehicleImages (VehicleId, SortOrder, ContentType, Data) VALUES (@id, @i, @ct, @data)',
        { id, i, ct: images[i].contentType, data: { type: sql.VarBinary(sql.MAX), value: images[i].buffer } }
      );
    }

    // Pujas espaciadas entre el inicio y "ahora" (o el cierre).
    const bidWindowEnd = Math.min(now, endAt.getTime()) - 5 * MIN;
    const step = (bidWindowEnd - startAt.getTime()) / (v.bids.length + 1);
    for (let i = 0; i < v.bids.length; i++) {
      await query(
        'INSERT INTO dbo.Bids (VehicleId, UserId, Amount, CreatedAt) VALUES (@id, @uid, @amount, @at)',
        {
          id, uid: userIds[v.bids[i][0]],
          amount: { type: sql.Decimal(14, 2), value: v.bids[i][1] },
          at: { type: sql.DateTime2, value: new Date(startAt.getTime() + step * (i + 1)) },
        }
      );
    }
  }
  console.log(`[seed] ${USERS.length} usuarios y ${VEHICLES.length} vehículos creados.`);
}

async function seedIfEmpty() {
  const r = await query('SELECT COUNT(*) AS n FROM dbo.Users');
  if (r.recordset[0].n > 0) return false;
  await seed();
  return true;
}

async function reset() {
  await query('DELETE FROM dbo.Bids; DELETE FROM dbo.VehicleImages; DELETE FROM dbo.Vehicles; DELETE FROM dbo.Users;');
  // Reinicia los IDENTITY para que los ids vuelvan a empezar en 1 (solo si la tabla ya tuvo filas).
  for (const t of ['Bids', 'VehicleImages', 'Vehicles', 'Users']) {
    await query(`IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.${t}') AND last_value IS NOT NULL)
                 DBCC CHECKIDENT ('dbo.${t}', RESEED, 0) WITH NO_INFOMSGS;`);
  }
  await seed();
}

if (require.main === module) {
  const { migrate } = require('./migrate');
  (async () => {
    await migrate();
    if (process.argv.includes('--reset')) await reset();
    else if (!(await seedIfEmpty())) console.log('[seed] La BD ya tiene usuarios. Usa --reset para reiniciar los datos demo.');
    (await getPool()).close();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedIfEmpty, reset, USERS };
