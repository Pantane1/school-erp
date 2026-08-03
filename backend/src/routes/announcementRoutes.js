const announcementController = require('../controllers/announcementController');
const { buildCrudRouter } = require('../utils/routeFactory');

module.exports = buildCrudRouter(announcementController);