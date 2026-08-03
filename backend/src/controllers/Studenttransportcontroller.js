const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('student_transport', {
  allowedFields: ['student_id', 'route_id', 'pickup_point_id'],
  selectQuery: '*, students(first_name, last_name, admission_number), transport_routes(name), transport_pickup_points(name)',
  orderBy: 'created_at',
});const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('student_transport', {
  allowedFields: ['student_id', 'route_id', 'pickup_point_id'],
  selectQuery: '*, students(first_name, last_name, admission_number), transport_routes(name), transport_pickup_points(name)',
  orderBy: 'created_at',
});