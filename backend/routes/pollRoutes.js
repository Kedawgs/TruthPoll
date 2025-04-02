// backend/routes/pollRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const s3Utils = require('../utils/s3Utils');

// Import validation schemas
const {
  createPollSchema,
  votePollSchema,
  endPollSchema,
  reactivatePollSchema,
  searchPollSchema
} = require('../validations/pollValidation');

// Import controller
const {
  createPoll,
  getPolls,
  getPoll,
  votePoll,
  endPoll,
  reactivatePoll,
  getReceivedRewards,
  getUserNonce,
  searchPolls
} = require('../controllers/pollController');

// Configure multer for memory storage (needed for S3 uploading)
const storage = multer.memoryStorage();

// Configure multer with file filtering and size limits
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Filter based on MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accept file
    } else {
      cb(new Error('Invalid file type. Only images (png, jpg, gif, webp) are allowed!'), false); // Reject file
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB limit
  }
}).single('image'); // Expect a single file with field name 'image'

// --- Routes ---

// Image upload route with S3 integration
router.post('/upload-image', isAuthenticated, (req, res) => {
  // Use upload middleware with memory storage
  upload(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred
      let message = `File upload error: ${err.message}`;
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'File is too large. Maximum size allowed is 5MB.';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        message = 'Unexpected file field. Ensure the field name is "image".';
      }
      return res.status(400).json({ success: false, error: message });
    } else if (err) {
      // An unknown error occurred
      return res.status(400).json({ success: false, error: err.message || 'File upload failed.' });
    }

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    try {
      // Upload file to S3
      const { key, url } = await s3Utils.uploadFile(req.file);
      
      // Return the S3 key and URL
      res.json({
        success: true,
        image: key,
        imageUrl: url
      });
    } catch (s3Error) {
      console.error('S3 upload error:', s3Error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error uploading to S3: ' + (s3Error.message || 'Unknown error')
      });
    }
  });
});

// --- Poll CRUD and Action Routes ---

// GET all polls, POST a new poll
router.route('/')
  .get(getPolls)
  .post(
    isAuthenticated,
    verifyMagicAddress('creator'),
    validate(createPollSchema),
    createPoll
  );

// GET polls based on search criteria
router.route('/search')
  .get(
    validate(searchPollSchema, 'query'),
    searchPolls
  );

// GET a specific poll by ID
router.route('/:id')
  .get(getPoll);

// POST a vote to a specific poll
router.route('/:id/vote')
  .post(
    isAuthenticated,
    validate(votePollSchema),
    votePoll
  );

// PUT to end a poll
router.route('/:id/end')
  .put(
    isAuthenticated,
    validate(endPollSchema),
    endPoll
  );

// PUT to reactivate a poll
router.route('/:id/reactivate')
  .put(
    isAuthenticated,
    validate(reactivatePollSchema),
    reactivatePoll
  );

// --- Other Poll-Related Routes ---

// GET rewards received by a specific address
router.route('/received-rewards/:address')
  .get(getReceivedRewards);

// GET the voting nonce for a user on a specific poll contract
router.route('/nonce/:pollAddress/:userAddress')
  .get(getUserNonce);

module.exports = router;