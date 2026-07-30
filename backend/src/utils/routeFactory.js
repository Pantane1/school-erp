const express = require('express');

/**
 * Builds a standard router (list/create/get/update/delete) from any
 * controller produced by createCrudController. Pass `extra` to mount
 * additional custom routes (e.g. set-current) on the same router.
 */
function buildCrudRouter(controller, extra) {
  const router = express.Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.getOne);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  if (extra) extra(router);

  return router;
}

module.exports = { buildCrudRouter };