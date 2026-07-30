const express = require('express');
const router = express.Router();

const feeCategoryRoutes = require('./feeCategoryRoutes');
const feeStructureRoutes = require('./feeStructureRoutes');
const discountRoutes = require('./discountRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const paymentRoutes = require('./paymentRoutes');
const invoiceController = require('../controllers/invoiceController');
const mpesaController = require('../controllers/mpesaController');

router.use('/fee-categories', feeCategoryRoutes);
router.use('/fee-structures', feeStructureRoutes);
router.use('/discounts', discountRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);

// M-Pesa STK push initiation is tenant-scoped (needs x-school-id), unlike
// the callback, which is public and mounted separately in app.js.
router.post('/payments/mpesa/initiate', mpesaController.initiate);

router.get('/students/:studentId/balance', invoiceController.studentBalance);
router.get('/reports/summary', invoiceController.financialSummary);

module.exports = router;