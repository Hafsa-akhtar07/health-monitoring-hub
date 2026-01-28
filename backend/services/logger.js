const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log OCR errors to both console and file
 * @param {string} type - Error type (ocr_error, parse_error, validation_error, etc.)
 * @param {string} filename - Original filename
 * @param {string} message - Error message
 * @param {object} details - Additional error details (optional)
 */
function logError(type, filename, message, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    filename: filename || 'unknown',
    message,
    ...details
  };

  // Console log
  console.error(`[${timestamp}] [${type.toUpperCase()}] ${filename || 'unknown'}: ${message}`);
  if (Object.keys(details).length > 0) {
    console.error('Details:', details);
  }

  // File log
  const logFile = path.join(logsDir, 'ocr-errors.log');
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (fileError) {
    console.error('Failed to write to log file:', fileError.message);
  }
}

/**
 * Log OCR success (for tracking successful extractions)
 * @param {string} filename - Original filename
 * @param {object} stats - OCR statistics (accuracy, detections, duration, etc.)
 */
function logSuccess(filename, stats = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type: 'ocr_success',
    filename: filename || 'unknown',
    ...stats
  };

  // Console log (less verbose)
  if (stats.accuracy_percentage !== undefined) {
    console.log(`✅ OCR Success: ${filename} - Accuracy: ${stats.accuracy_percentage.toFixed(2)}%, Detections: ${stats.total_detections || 0}`);
  }

  // File log (optional - can be enabled for full tracking)
  // Uncomment if you want to log all successful OCRs
  /*
  const logFile = path.join(logsDir, 'ocr-success.log');
  const logLine = JSON.stringify(logEntry) + '\n';
  try {
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (fileError) {
    console.error('Failed to write to success log file:', fileError.message);
  }
  */
}

/**
 * Get recent error logs (for admin viewing)
 * @param {number} limit - Number of recent logs to return
 * @returns {Array} Array of log entries
 */
function getRecentErrors(limit = 50) {
  const logFile = path.join(logsDir, 'ocr-errors.log');
  
  if (!fs.existsSync(logFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const logs = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(log => log !== null)
      .reverse() // Most recent first
      .slice(0, limit);
    
    return logs;
  } catch (error) {
    console.error('Error reading log file:', error);
    return [];
  }
}

module.exports = {
  logError,
  logSuccess,
  getRecentErrors
};

