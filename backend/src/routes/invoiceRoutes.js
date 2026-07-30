const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoiceController');

router.post('/generate', controller.generateInvoice);
router.get('/', controller.listInvoices);
router.get('/:id', controller.getInvoice);
router.patch('/:id', controller.updateInvoice);

module.exports = router;