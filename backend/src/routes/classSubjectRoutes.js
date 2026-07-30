const classSubjectController = require('../controllers/classSubjectController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(classSubjectController);