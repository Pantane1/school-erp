const examSubjectController = require('../controllers/examSubjectController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(examSubjectController);