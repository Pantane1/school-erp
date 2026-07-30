const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('class_subjects', {
  allowedFields: ['class_id', 'subject_id', 'teacher_id'],
  selectQuery: '*, classes(name), subjects(name), teacher:users(full_name)',
  orderBy: 'created_at',
});