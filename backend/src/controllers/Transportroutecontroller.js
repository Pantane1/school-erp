const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('transport_routes', {
  allowedFields: ['name', 'vehicle_id'],
  selectQuery: '*, transport_vehicles(registration_number, driver_name)',
  orderBy: 'name',
});
