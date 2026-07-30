const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('classes', {
  allowedFields: ['name', 'stream', 'academic_year_id', 'class_teacher_id'],
  selectQuery: '*, academic_years(name)',
  orderBy: 'name',
});