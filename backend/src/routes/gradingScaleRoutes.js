const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('grading_scales', {
  allowedFields: ['grade', 'min_score', 'max_score', 'grade_point', 'remarks'],
  orderBy: 'min_score',
});