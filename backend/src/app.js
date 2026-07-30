const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const tenantContext = require('./middleware/tenantContext');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const mpesaController = require('./controllers/mpesaController');

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

// M-Pesa's Daraja callback is public (Safaricom can't send x-school-id) —
// the payment's school is resolved via its stored CheckoutRequestID instead.
// Must be registered before the tenant-scoped /api mount below.
app.post('/api/finance/payments/mpesa/callback', mpesaController.callback);

// Everything else under /api requires a resolved tenant (x-school-id for now)
app.use('/api', tenantContext, routes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;