const express = require('express');
const router = express.Router();

// Route order matters: crud registers GET /mine before GET /:id
router.use(require('./games/crud'));
router.use(require('./games/participants'));
router.use(require('./games/checkin'));
router.use(require('./games/lifecycle'));

module.exports = router;
