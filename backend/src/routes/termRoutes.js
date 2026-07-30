const termController = require('../controllers/termController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(termController, (router) => {
  router.post('/:id/set-current', termController.setCurrent);
});