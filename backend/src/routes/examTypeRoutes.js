const examTypeController = require('../controllers/examTypeController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(examTypeController);