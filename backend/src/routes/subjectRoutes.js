const subjectController = require('../controllers/subjectController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(subjectController);