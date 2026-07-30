const express = require('express');
const router = express.Router();
const controller = require('../controllers/studentAttendanceController');

router.get('/summary', controller.summary); // before /:id
router.get('/', controller.list);
router.post('/bulk', controller.markBulk);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;