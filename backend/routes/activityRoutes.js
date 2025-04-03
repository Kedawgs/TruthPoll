// backend/routes/activityRoutes.js
const express = require('express');
const { getActivities } = require('../controllers/activityController'); // Make sure path is correct

const router = express.Router();

router.route('/')
    .get(getActivities); // Map GET requests to the root of this router to getActivities

module.exports = router;