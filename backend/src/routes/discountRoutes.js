const discountController = require('../controllers/discountController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(discountController);