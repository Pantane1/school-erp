const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('exams', {
  allowedFields: ['name', 'exam_type_id', 'academic_year_id', 'term_id', 'start_date', 'end_date', 'status'],
  selectQuery: '*, exam_types(name), terms(name)',
  orderBy: 'start_date',
});