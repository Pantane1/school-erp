const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('exam_subjects', {
  allowedFields: ['exam_id', 'subject_id', 'class_id', 'max_marks', 'exam_date', 'start_time', 'end_time'],
  selectQuery: '*, subjects(name), classes(name), exams(name)',
  orderBy: 'exam_date',
});