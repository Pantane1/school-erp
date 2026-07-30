const academicYearController = require('../controllers/academicYearController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(academicYearController, (router) => {
  router.post('/:id/set-current', academicYearController.setCurrent);
});