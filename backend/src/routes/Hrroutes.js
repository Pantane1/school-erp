const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const leaveController = require('../controllers/leaveController');
const payrollController = require('../controllers/payrollController');
const { buildCrudRouter } = require('../utils/routeFactory');

// Employees — read + employment-profile update only (creation happens
// via /api/auth/register, since every employee is a users row)
router.get('/employees', employeeController.list);
router.get('/employees/:id', employeeController.getOne);
router.patch('/employees/:id', employeeController.update);

// Leave requests
router.post('/leave-requests', leaveController.create);
router.get('/leave-requests', leaveController.list);
router.post('/leave-requests/:id/decide', leaveController.decide);

// Payroll — custom action route registered before the generic '/:id'
// CRUD routes below, same reasoning as examRoutes.js.
router.post('/payroll/:id/mark-paid', payrollController.markPaid);
router.use('/payroll', buildCrudRouter(payrollController));

module.exports = router;