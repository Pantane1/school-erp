const feeStructureController = require('../controllers/feeStructureController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(feeStructureController);