const classController = require('../controllers/classController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(classController);