const express = require('express');
const router = express.Router();
const studentRoutes = require('./studentRoutes');

router.use('/students', studentRoutes);

module.exports = router;
