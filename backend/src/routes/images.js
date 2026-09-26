const express = require('express');
const { query } = require('../db/pool');
const { HttpError, ah, parseId } = require('../http');

const router = express.Router();

/** GET /api/images/:id -> binario de la foto. Las fotos son inmutables: caché larga. */
router.get('/:id', ah(async (req, res) => {
  const id = parseId(req.params.id, 'id de imagen');
  const r = await query('SELECT ContentType, Data FROM dbo.VehicleImages WHERE Id = @id', { id });
  const img = r.recordset[0];
  if (!img) throw new HttpError(404, 'Imagen no encontrada.');
  res.set({
    'Content-Type': img.ContentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(img.Data);
}));

module.exports = router;
