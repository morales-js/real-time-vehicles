const express = require('express');
const { query } = require('../db/pool');
const { ah } = require('../http');

const router = express.Router();

/** GET /api/stats -> indicadores para el Home. */
router.get('/', ah(async (_req, res) => {
  const r = await query(
    `SELECT
       (SELECT COUNT(*) FROM dbo.Vehicles WHERE StartAt <= @now AND EndAt > @now AND ClosedAt IS NULL) AS active,
       (SELECT COUNT(*) FROM dbo.Vehicles WHERE StartAt > @now) AS scheduled,
       (SELECT COUNT(*) FROM dbo.Vehicles WHERE StartAt <= @now AND EndAt > @now AND EndAt <= DATEADD(HOUR, 24, @now)) AS closingToday,
       (SELECT COUNT(*) FROM dbo.Vehicles WHERE Status = N'VENDIDA') AS sold,
       (SELECT COUNT(*) FROM dbo.Bids) AS totalBids,
       (SELECT COUNT(*) FROM dbo.Users) AS users`,
    { now: new Date() }
  );
  res.json(r.recordset[0]);
}));

module.exports = router;
