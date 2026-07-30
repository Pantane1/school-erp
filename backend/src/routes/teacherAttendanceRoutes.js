const express = require('express');
const router = express.Router();
const controller = require('../controllers/teacherAttendanceController');

router.get('/summary', controller.summary); // before /:id
router.get('/', controller.list);
router.post('/', controller.mark);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;