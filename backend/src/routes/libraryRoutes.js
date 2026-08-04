const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const borrowingController = require('../controllers/borrowingController');
const { buildCrudRouter } = require('../utils/routeFactory');

router.use('/books', buildCrudRouter(bookController));

router.get('/borrowings', borrowingController.list);
router.post('/borrowings', borrowingController.borrow);
router.post('/borrowings/:id/return', borrowingController.returnBook);
router.get('/overdue', borrowingController.overdue);

module.exports = router;
