// backend/utils/s3Utils.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const logger = require('./logger');

// Create S3 client instance
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Bucket name from environment variable or use default
const bucketName = process.env.AWS_S3_BUCKET || 'truthpoll-images';

/**
 * Generate a unique filename for S3
 * @param {Object} file - The uploaded file object
 * @returns {String} Unique filename with extension
 */
const generateUniqueFilename = (file) => {
  const fileExtension = path.extname(file.originalname);
  const randomName = crypto.randomBytes(16).toString('hex');
  return `${randomName}${fileExtension}`;
};

/**
 * Upload a file to S3 bucket
 * @param {Object} file - File object from multer
 * @returns {Promise<Object>} Upload result with key and location
 */
const uploadFile = async (file) => {
  try {
    const key = `uploads/${generateUniqueFilename(file)}`;
    
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
      // Removed ACL parameter - use bucket policy instead
    };

    const command = new PutObjectCommand(params);
    const result = await s3Client.send(command);

    // Construct the public URL
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    
    logger.info(`File uploaded successfully to S3: ${key}`);
    
    return {
      key,
      url: fileUrl,
      etag: result.ETag
    };
  } catch (error) {
    logger.error('Error uploading file to S3:', error);
    throw error;
  }
};

/**
 * Generate a presigned URL for an S3 object
 * @param {String} key - S3 object key
 * @param {Number} expiresIn - URL expiration time in seconds
 * @returns {Promise<String>} Presigned URL
 */
const getPresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    logger.error('Error generating presigned URL:', error);
    throw error;
  }
};

/**
 * Delete a file from S3
 * @param {String} key - S3 object key to delete
 * @returns {Promise<Object>} Deletion result
 */
const deleteFile = async (key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    const command = new DeleteObjectCommand(params);
    const result = await s3Client.send(command);
    
    logger.info(`File deleted from S3: ${key}`);
    return result;
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
    throw error;
  }
};

/**
 * Get the base URL for the S3 bucket
 * @returns {String} Base URL for the S3 bucket
 */
const getS3BaseUrl = () => {
  return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/`;
};

module.exports = {
  s3Client,
  uploadFile,
  getPresignedUrl,
  deleteFile,
  getS3BaseUrl,
  bucketName
};