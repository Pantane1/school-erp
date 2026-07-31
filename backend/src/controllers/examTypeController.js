const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('exam_types', {
  allowedFields: ['name', 'weight'],
  orderBy: 'name',
});