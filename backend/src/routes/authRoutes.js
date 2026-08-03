const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/authenticate');

// Public
router.post('/register-school', authController.registerSchool);
router.post('/login', authController.login);

// Protected — only school owners/principals/registrars can create new
// staff/student/parent accounts within their own school. Adjust this
// role list to match how you want account creation locked down.
router.post(
  '/register',
  authenticate,
  requireRole('school_owner', 'principal', 'registrar', 'super_admin'),
  authController.register
);

router.get('/me', authenticate, authController.me);

module.exports = router;