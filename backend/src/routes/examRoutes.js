const express = require('express');
const router = express.Router();

const examController = require('../controllers/examController');
const examTypeRoutes = require('./examTypeRoutes');
const gradingScaleRoutes = require('./gradingScaleRoutes');
const examSubjectRoutes = require('./examSubjectRoutes');
const markController = require('../controllers/markController');

// Sub-resources and fixed-path routes MUST be registered before the
// generic '/:id' exam routes below, or '/types' etc. would be swallowed
// by GET /:id (id = 'types').
router.use('/types', examTypeRoutes);
router.use('/grading-scales', gradingScaleRoutes);
router.use('/schedule', examSubjectRoutes); // exam_subjects: subject+class timetable within an exam

router.post('/marks/bulk', markController.bulkEnterMarks);
router.get('/marks', markController.listMarks);
router.patch('/marks/:id', markController.updateMark);

router.get('/:examId/report-cards/:studentId', markController.studentReportCard);
router.get('/:examId/rankings', markController.examRankings);

// Generic exam CRUD — last, so it doesn't shadow the routes above.
router.get('/', examController.list);
router.post('/', examController.create);
router.get('/:id', examController.getOne);
router.patch('/:id', examController.update);
router.delete('/:id', examController.remove);

module.exports = router;