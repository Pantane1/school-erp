const departmentController = require('../controllers/departmentController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(departmentController);