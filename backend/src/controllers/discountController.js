const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('student_discounts', {
  allowedFields: ['student_id', 'fee_category_id', 'discount_type', 'value', 'reason', 'academic_year_id'],
  selectQuery: '*, students(first_name, last_name, admission_number), fee_categories(name)',
  orderBy: 'created_at',
});