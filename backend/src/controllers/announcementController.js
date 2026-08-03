const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('announcements', {
  allowedFields: ['title', 'body', 'audience', 'class_id', 'created_by', 'published_at', 'expires_at'],
  selectQuery: '*, classes(name)',
  orderBy: 'published_at',
});