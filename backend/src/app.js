const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { authenticate } = require('./middleware/authenticate');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const mpesaController = require('./controllers/mpesaController');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health check doesn't need a tenant
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// M-Pesa's Daraja callback is public (Safaricom can't send an auth token) —
// the payment's school is resolved via its stored CheckoutRequestID instead.
// Must be registered before the authenticated /api mount below.
app.post('/api/finance/payments/mpesa/callback', mpesaController.callback);

// Auth routes: register-school and login are public; register and /me
// apply their own `authenticate` per-route (see authRoutes.js) since
// they're mounted here, ahead of the blanket authenticate below.
app.use('/api/auth', authRoutes);

// Everything else under /api requires a valid Bearer token (see
// src/middleware/authenticate.js). This replaces the old temporary
// x-school-id header — req.schoolId is now set from the verified JWT.
app.use('/api', authenticate, routes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;