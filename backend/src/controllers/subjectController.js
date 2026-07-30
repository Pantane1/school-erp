const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('subjects', {
  allowedFields: ['name', 'code', 'department_id', 'is_active'],
  selectQuery: '*, departments(name)',
  orderBy: 'name',
});