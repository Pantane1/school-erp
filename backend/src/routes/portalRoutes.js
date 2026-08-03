const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');

// Parent portal reuses the student dashboard — a parent views their child's data.
router.get('/students/:studentId', portalController.studentDashboard);
router.get('/parents/:studentId', portalController.studentDashboard);
router.get('/teachers/:teacherId', portalController.teacherDashboard);

module.exports = router;