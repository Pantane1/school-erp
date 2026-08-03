const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('books', {
  allowedFields: ['title', 'author', 'isbn', 'category', 'total_copies', 'available_copies'],
  orderBy: 'title',
});