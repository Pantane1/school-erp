const express = require('express');
const router = express.Router();
const studentRoutes = require('./studentRoutes');
const academicYearRoutes = require('./academicYearRoutes');
const termRoutes = require('./termRoutes');
const classRoutes = require('./classRoutes');
const departmentRoutes = require('./departmentRoutes');
const subjectRoutes = require('./subjectRoutes');
const classSubjectRoutes = require('./classSubjectRoutes');
const studentAttendanceRoutes = require('./studentAttendanceRoutes');
const teacherAttendanceRoutes = require('./teacherAttendanceRoutes');
const financeRoutes = require('./financeRoutes');

router.use('/students', studentRoutes);
router.use('/academic-years', academicYearRoutes);
router.use('/terms', termRoutes);
router.use('/classes', classRoutes);
router.use('/departments', departmentRoutes);
router.use('/subjects', subjectRoutes);
router.use('/class-subjects', classSubjectRoutes);
router.use('/attendance/students', studentAttendanceRoutes);
router.use('/attendance/teachers', teacherAttendanceRoutes);
router.use('/finance', financeRoutes);

module.exports = router;