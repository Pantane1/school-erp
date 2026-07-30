const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('departments', {
  allowedFields: ['name', 'head_of_department_id'],
  orderBy: 'name',
});