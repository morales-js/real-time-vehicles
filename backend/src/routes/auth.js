const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const { HttpError, ah } = require('../http');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s-]{8,20}$/;

/** Contraseña segura: 8+ caracteres, mayúscula, minúscula, número y símbolo. */
function passwordProblems(pw) {
  const problems = [];
  if (pw.length < 8) problems.push('al menos 8 caracteres');
  if (pw.length > 72) problems.push('máximo 72 caracteres');
  if (!/[A-Z]/.test(pw)) problems.push('una mayúscula');
  if (!/[a-z]/.test(pw)) problems.push('una minúscula');
  if (!/\d/.test(pw)) problems.push('un número');
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push('un símbolo');
  return problems;
}

const userDto = (u) => ({
  id: u.Id, firstName: u.FirstName, lastName: u.LastName, email: u.Email, phone: u.Phone,
});

router.post('/register', authLimiter, ah(async (req, res) => {
  const b = req.body || {};
  const data = {
    firstName: String(b.firstName || '').trim(),
    lastName: String(b.lastName || '').trim(),
    email: String(b.email || '').trim().toLowerCase(),
    phone: String(b.phone || '').trim(),
    password: String(b.password || ''),
  };

  const errors = {};
  if (!NAME_RE.test(data.firstName)) errors.firstName = 'Ingresa un nombre válido (solo letras, mínimo 2).';
  if (!NAME_RE.test(data.lastName)) errors.lastName = 'Ingresa un apellido válido (solo letras, mínimo 2).';
  if (!EMAIL_RE.test(data.email) || data.email.length > 160) errors.email = 'Ingresa un correo electrónico válido.';
  const digits = data.phone.replace(/\D/g, '');
  if (!PHONE_RE.test(data.phone) || digits.length < 8 || digits.length > 15) errors.phone = 'Ingresa un teléfono válido (8 a 15 dígitos).';
  const pwProblems = passwordProblems(data.password);
  if (pwProblems.length) errors.password = `La contraseña necesita ${pwProblems.join(', ')}.`;
  if (Object.keys(errors).length) throw new HttpError(400, 'Revisa los datos del formulario.', errors);

  const exists = await query('SELECT 1 AS x FROM dbo.Users WHERE Email = @email', { email: data.email });
  if (exists.recordset.length) {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo.', { email: 'Este correo ya está registrado.' });
  }

  const hash = await bcrypt.hash(data.password, 10);
  const r = await query(
    `INSERT INTO dbo.Users (FirstName, LastName, Email, Phone, PasswordHash)
     OUTPUT inserted.*
     VALUES (@firstName, @lastName, @email, @phone, @hash)`,
    { ...data, hash }
  );
  const user = r.recordset[0];
  res.status(201).json({ token: signToken(user), user: userDto(user) });
}));

router.post('/login', authLimiter, ah(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw new HttpError(400, 'Ingresa tu correo y contraseña.');

  const r = await query('SELECT * FROM dbo.Users WHERE Email = @email', { email });
  const user = r.recordset[0];
  const ok = user && (await bcrypt.compare(password, user.PasswordHash));
  if (!ok) throw new HttpError(401, 'Correo o contraseña incorrectos.');

  res.json({ token: signToken(user), user: userDto(user) });
}));

router.get('/me', requireAuth, ah(async (req, res) => {
  const r = await query('SELECT * FROM dbo.Users WHERE Id = @id', { id: req.userId });
  if (!r.recordset[0]) throw new HttpError(401, 'La sesión ya no es válida.');
  res.json({ user: userDto(r.recordset[0]) });
}));

module.exports = router;
module.exports.passwordProblems = passwordProblems;
