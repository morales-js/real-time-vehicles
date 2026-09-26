const { query } = require('../db/pool');
const realtime = require('../realtime');

let timer = null;
let running = false;

/**
 * Cierra las subastas cuyo tiempo terminó:
 *  - Con al menos una oferta válida (>= monto base) -> VENDIDA.
 *  - Sin ofertas que alcancen el monto base          -> DESIERTA (no vendida).
 * El UPDATE ... WHERE ClosedAt IS NULL garantiza que cada subasta se cierre una sola vez.
 */
async function closeExpired() {
  if (running) return;
  running = true;
  try {
    const r = await query(
      `UPDATE v SET
          Status = CASE WHEN v.CurrentBid IS NOT NULL AND v.CurrentBid >= v.BasePrice THEN N'VENDIDA' ELSE N'DESIERTA' END,
          ClosedAt = @now,
          UpdatedAt = @now
       OUTPUT inserted.Id, inserted.Status, inserted.CurrentBid, inserted.CurrentBidderId, inserted.SellerId,
              inserted.Model, inserted.[Year], inserted.BrandId
       FROM dbo.Vehicles v
       WHERE v.ClosedAt IS NULL AND v.EndAt <= @now`,
      { now: new Date() }
    );
    if (!r.recordset.length) return;

    const brands = await query('SELECT Id, Name FROM dbo.Brands');
    const brandName = new Map(brands.recordset.map((b) => [b.Id, b.Name]));

    for (const v of r.recordset) {
      const title = `${brandName.get(v.BrandId) || ''} ${v.Model} ${v.Year}`.trim();
      console.log(`[subasta] #${v.Id} ${title} cerrada -> ${v.Status}`);
      await realtime.broadcastClosed({
        vehicleId: v.Id,
        title,
        status: v.Status,
        currentBid: v.CurrentBid == null ? null : Number(v.CurrentBid),
        winnerId: v.Status === 'VENDIDA' ? v.CurrentBidderId : null,
        sellerId: v.SellerId,
      });
    }
  } catch (err) {
    console.error('[subasta] error cerrando subastas:', err.message);
  } finally {
    running = false;
  }
}

function start(intervalMs = 1000) {
  if (!timer) timer = setInterval(closeExpired, intervalMs);
}

module.exports = { start, closeExpired };
