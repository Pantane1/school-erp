const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('transport_pickup_points', {
  allowedFields: ['route_id', 'name', 'sequence_order', 'pickup_time'],
  selectQuery: '*, transport_routes(name)',
  orderBy: 'sequence_order',
});