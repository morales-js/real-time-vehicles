const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { ah } = require('../http');
const repo = require('../services/vehicleRepo');

const router = express.Router();
router.use(requireAuth);

/** GET /api/me/vehicles?q=... -> mis publicaciones (buscar y editar). */
router.get('/vehicles', ah(async (req, res) => {
  const filters = { status: 'todas', sort: 'newest', pageSize: 60, ...req.query };
  res.json({ ...(await repo.listVehicles(filters, { userId: req.userId, sellerId: req.userId })), serverTime: Date.now() });
}));

/** GET /api/me/bids -> subastas en las que he participado. */
router.get('/bids', ah(async (req, res) => {
  const filters = { status: 'todas', sort: 'ending', pageSize: 60, ...req.query, mine: 'bids' };
  res.json({ ...(await repo.listVehicles(filters, { userId: req.userId })), serverTime: Date.now() });
}));

module.exports = router;
