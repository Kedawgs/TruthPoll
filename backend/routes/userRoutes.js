// backend/routes/userRoutes.js
const express = require('express');
// *** Import uploadAvatar ***
const { setUsername, getUserProfile, getUserVotes, getUserActivity, uploadAvatar } = require('../controllers/userController');
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const { usernameSchema, userProfileSchema } = require('../validations/userValidation');
const multer = require('multer');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage (needed for S3 uploading)
const storage = multer.memoryStorage();

// Configure multer with file filtering and size limits
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Filter based on MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      logger.info(`File upload accepted: ${file.originalname} (${file.mimetype})`);
      cb(null, true); // Accept file
    } else {
      logger.warn(`File upload rejected: ${file.originalname} (${file.mimetype})`);
      cb(new Error('Invalid file type. Only images (png, jpg, gif, webp) are allowed!'), false); // Reject file
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB limit
  }
}).single('avatar'); // Expect a single file with field name 'avatar'

// Handle multer errors
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred
    logger.error(`Multer error: ${err.message}`);
    return res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`
    });
  } else if (err) {
    logger.error(`File upload error: ${err.message}`);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
};

// User routes with validation
// Order matters: authentication -> multer file upload -> handle multer errors -> validation -> controller
router.route('/username')
  .post(
    isAuthenticated,
    verifyMagicAddress('address'),
    upload, // Process the file upload - NOTE: setUsername also handles uploads
    handleMulterErrors, // Handle any multer errors
    validate(usernameSchema), // Validate non-file fields
    setUsername
  );

router.route('/profile/:address')
  .get(validate(userProfileSchema, 'params'), getUserProfile);

router.route('/votes/:address')
  .get(validate(userProfileSchema, 'params'), getUserVotes);

router.route('/activity/:address')
  .get(validate(userProfileSchema, 'params'), getUserActivity);

// *** ADD THIS ROUTE FOR AVATAR UPLOAD ***
router.route('/upload-avatar')
  .post(
    isAuthenticated,      // Ensure user is logged in
    upload,               // Process the 'avatar' file field using multer config
    handleMulterErrors,   // Handle any errors from multer
    // Note: The 'uploadAvatar' controller itself checks req.user against req.body.address for Magic users
    uploadAvatar          // Call the controller function
  );
// *** END OF ADDED ROUTE ***

module.exports = router;