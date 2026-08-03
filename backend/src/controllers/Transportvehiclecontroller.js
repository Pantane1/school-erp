const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('transport_vehicles', {
  allowedFields: ['registration_number', 'capacity', 'driver_name', 'driver_phone'],
  orderBy: 'registration_number',
});