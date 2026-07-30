const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('fee_structures', {
  allowedFields: ['fee_category_id', 'class_id', 'academic_year_id', 'term_id', 'amount'],
  selectQuery: '*, fee_categories(name), classes(name), terms(name)',
  orderBy: 'created_at',
});