const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');

router.get('/', controller.listPayments);
router.post('/', controller.recordPayment);

module.exports = router;