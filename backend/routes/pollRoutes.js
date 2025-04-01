// backend/routes/pollRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path'); // Ensure 'path' module is imported
const fs = require('fs');     // Ensure 'fs' module is imported for directory creation

// Import middlewares
// Make sure these paths are correct for your project structure
const { isAuthenticated, verifyMagicAddress } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');

// Import validation schemas
// Make sure these paths are correct
const {
  createPollSchema,
  votePollSchema,
  endPollSchema,
  reactivatePollSchema,
  searchPollSchema // Added search schema import
} = require('../validations/pollValidation');

// Import the controller
// Make sure this path is correct
const {
  createPoll,
  getPolls,
  getPoll,
  votePoll,
  endPoll,
  reactivatePoll,
  getReceivedRewards,
  getUserNonce,
  searchPolls // Added search controller import
} = require('../controllers/pollController');

// --- Multer Configuration - CORRECTED ---

// Define the destination directory path
const UPLOAD_DIRECTORY = path.join(__dirname, '..', 'public', 'images'); // Go up one level from routes, then public/images

// Configure Multer storage with directory check and corrected filename logic
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the upload directory exists
    fs.mkdir(UPLOAD_DIRECTORY, { recursive: true }, (err) => {
      if (err) {
        console.error("Failed to create upload directory:", UPLOAD_DIRECTORY, err);
        return cb(err); // Pass error to multer
      }
      cb(null, UPLOAD_DIRECTORY); // Directory is ready, pass its path to multer
    });
  },
  filename: function (req, file, cb) {
    // Generate unique filename with correct extension
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname); // Extracts '.png', '.jpg', etc.

    // Basic validation for image extensions (adjust as needed)
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (!allowedExtensions.includes(extension.toLowerCase())) {
        // Reject file with an error if extension is not allowed
        return cb(new Error('Invalid image type. Only PNG, JPG, GIF, WEBP allowed.'));
    }

    const finalFilename = uniqueSuffix + extension; // Correctly combines UUID and extension
    cb(null, finalFilename);
  }
});

// Configure Multer upload instance with storage, file filter, and size limits
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Filter based on MIME type or extension again for robustness
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const extension = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
      cb(null, true); // Accept file
    } else {
      cb(new Error('Invalid file type. Only images (png, jpg, gif, webp) are allowed!'), false); // Reject file
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB limit (adjust as needed)
  }
}).single('image'); // Expect a single file upload with the field name 'image'

// --- Routes ---

// Image upload route with proper error handling
router.post('/upload-image', isAuthenticated, (req, res) => {
  // Use upload middleware, handling potential errors from it
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred (e.g., file size limit, field name mismatch)
      console.error("Multer error during upload:", err.message);
      // Provide specific feedback based on the error code if possible
      let message = `File upload error: ${err.message}`;
      if (err.code === 'LIMIT_FILE_SIZE') {
          message = 'File is too large. Maximum size allowed is 5MB.';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          message = 'Unexpected file field. Ensure the field name is "image".';
      }
      return res.status(400).json({ success: false, error: message });

    } else if (err) {
      // An unknown error occurred (e.g., invalid file type from filter, disk space issue, permission error)
      console.error("Unknown error during upload:", err.message);
      return res.status(400).json({ success: false, error: err.message || 'File upload failed.' });
    }

    // If file is not present after middleware (shouldn't happen if no error, but check)
    if (!req.file) {
      // This might indicate an issue not caught above or no file sent
      console.error("Upload route completed without error, but req.file is missing.");
      return res.status(400).json({ success: false, error: 'No file uploaded or file rejected unexpectedly.' });
    }

    // File uploaded successfully, return the generated filename
    res.json({
      success: true,
      image: req.file.filename // Return the correctly generated filename (e.g., 'uuid.png')
    });
  });
});

// --- Poll CRUD and Action Routes ---

// GET all polls, POST a new poll
router.route('/')
  .get(getPolls) // No auth needed to view polls generally
  .post(
    isAuthenticated, // Must be logged in
    verifyMagicAddress('creator'), // Ensure 'creator' field matches logged-in user if Magic Link
    validate(createPollSchema), // Validate request body against schema
    createPoll // Call controller function
  );

// GET polls based on search criteria
router.route('/search')
  .get(
    validate(searchPollSchema, 'query'), // Validate query parameters
    searchPolls
  );

// GET a specific poll by ID
router.route('/:id')
  .get(getPoll); // No auth needed generally, controller might add checks

// POST a vote to a specific poll
router.route('/:id/vote')
  .post(
    isAuthenticated, // Must be logged in
    // No need for verifyMagicAddress here usually, voting based on connected address
    validate(votePollSchema), // Validate request body (option index)
    votePoll
  );

// PUT (or POST) to end a poll (requires authentication and authorization in controller)
router.route('/:id/end')
  .put( // Using PUT as it modifies the state
    isAuthenticated,
    validate(endPollSchema), // May need validation if body params are used
    endPoll // Controller must verify user is creator or authorized
  );

// PUT (or POST) to reactivate a poll (requires authentication and authorization in controller)
router.route('/:id/reactivate')
  .put( // Using PUT as it modifies the state
    isAuthenticated,
    validate(reactivatePollSchema), // May need validation if body params are used
    reactivatePoll // Controller must verify user is creator or authorized
  );

// --- Other Poll-Related Routes ---

// GET rewards received by a specific address (publicly accessible)
router.route('/received-rewards/:address')
  .get(getReceivedRewards);

// GET the voting nonce for a user on a specific poll contract (publicly accessible)
router.route('/nonce/:pollAddress/:userAddress')
  .get(getUserNonce);


module.exports = router;