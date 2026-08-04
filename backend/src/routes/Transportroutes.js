const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/transportvehiclecontroller');
const routeController = require('../controllers/transportRouteController');
const pickupPointController = require('../controllers/pickupPointController');
const studentTransportController = require('../controllers/studentTransportController');
const { buildCrudRouter } = require('../utils/routeFactory');

router.use('/vehicles', buildCrudRouter(vehicleController));
router.use('/routes', buildCrudRouter(routeController));
router.use('/pickup-points', buildCrudRouter(pickupPointController));
router.use('/assignments', buildCrudRouter(studentTransportController));

module.exports = router;