// backend/utils/responseHandler.js
/**
 * Standard success response
 */
const successResponse = (res, data, statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      data
    });
  };
  
  /**
   * Pagination response helper
   */
  const paginatedResponse = (res, { data, page, limit, total, totalPages }) => {
    return res.status(200).json({
      success: true,
      count: data.length,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      data
    });
  };
  
  module.exports = {
    successResponse,
    paginatedResponse
  };