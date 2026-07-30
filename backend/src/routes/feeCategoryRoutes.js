const feeCategoryController = require('../controllers/feeCategoryController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(feeCategoryController);