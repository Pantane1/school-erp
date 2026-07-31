const gradingScaleController = require('../controllers/gradingScaleController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(gradingScaleController);