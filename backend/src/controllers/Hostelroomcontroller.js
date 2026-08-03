const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('hostel_rooms', {
  allowedFields: ['block_name', 'room_number', 'capacity'],
  orderBy: 'block_name',
});