const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('hostel_visitors', {
  allowedFields: ['student_id', 'visitor_name', 'relationship', 'purpose', 'check_in_time', 'check_out_time'],
  selectQuery: '*, students(first_name, last_name, admission_number)',
  orderBy: 'check_in_time',
});