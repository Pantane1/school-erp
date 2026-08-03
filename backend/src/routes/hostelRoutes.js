const express = require('express');
const router = express.Router();
const hostelRoomController = require('../controllers/hostelRoomController');
const allocationController = require('../controllers/hostelAllocationController');
const visitorController = require('../controllers/hostelVisitorController');
const { buildCrudRouter } = require('../utils/routeFactory');

router.use('/rooms', buildCrudRouter(hostelRoomController));
router.use('/visitors', buildCrudRouter(visitorController));

router.get('/allocations', allocationController.listAllocations);
router.post('/allocations', allocationController.allocate);
router.post('/allocations/:id/vacate', allocationController.vacate);

module.exports = router;