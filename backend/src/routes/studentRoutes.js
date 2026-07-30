const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

router.get('/export', studentController.exportStudents); // before /:id
router.get('/', studentController.listStudents);
router.get('/:id', studentController.getStudent);
router.post('/', studentController.createStudent);
router.post('/bulk-import', studentController.bulkImportStudents);
router.patch('/:id', studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
