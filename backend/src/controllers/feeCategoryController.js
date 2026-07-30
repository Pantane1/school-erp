const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('fee_categories', {
  allowedFields: ['name', 'description'],
  orderBy: 'name',
});