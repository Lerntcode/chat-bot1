const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { FileUploadError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Enhanced File Upload Security Middleware
 * Implements comprehensive security measures for file uploads
 */

// Allowed file types with MIME type validation
const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/csv': ['.csv']
};

// Maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
  'image/jpeg': 5 * 1024 * 1024, // 5MB
  'image/png': 5 * 1024 * 1024,  // 5MB
  'image/gpif': 5 * 1024 * 1024, // 5MB
  'image/webp': 5 * 1024 * 1024, // 5MB
  'application/pdf': 10 * 1024 * 1024, // 10MB
  'text/plain': 1 * 1024 * 1024, // 1MB
  'application/msword': 10 * 1024 * 1024, // 10MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10 * 1024 * 1024, // 10MB
  'text/csv': 5 * 1024 * 1024 // 5MB
};

// Virus scanning patterns (basic heuristic detection)
const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /vbscript:/i,
  /onload/i,
  /onerror/i,
  /eval\(/i,
  /expression\(/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<applet/i,
  /<meta/i,
  /<link/i,
  /<base/i,
  /<form/i,
  /<input/i,
  /<textarea/i,
  /<select/i,
  /<button/i
];

/**
 * File type validation
 */
const validateFileType = (file) => {
  const mimeType = file.mimetype;
  const extension = path.extname(file.originalname).toLowerCase();
  
  // Check if MIME type is allowed
  if (!ALLOWED_FILE_TYPES[mimeType]) {
    throw new FileUploadError(`File type '${mimeType}' is not allowed`);
  }
  
  // Check if file extension matches MIME type
  if (!ALLOWED_FILE_TYPES[mimeType].includes(extension)) {
    throw new FileUploadError(`File extension '${extension}' does not match MIME type '${mimeType}'`);
  }
  
  return true;
};

/**
 * File size validation
 */
const validateFileSize = (file) => {
  const mimeType = file.mimetype;
  const maxSize = MAX_FILE_SIZES[mimeType];
  
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    throw new FileUploadError(`File size exceeds maximum limit of ${maxSizeMB}MB`);
  }
  
  return true;
};

/**
 * File content validation
 */
const validateFileContent = (file) => {
  // Check file header (magic bytes) for common file types
  const buffer = file.buffer;
  const header = buffer.slice(0, 8);
  
  // JPEG
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    if (file.mimetype !== 'image/jpeg') {
      throw new FileUploadError('File header does not match declared MIME type');
    }
  }
  
  // PNG
  else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    if (file.mimetype !== 'image/png') {
      throw new FileUploadError('File header does not match declared MIME type');
    }
  }
  
  // PDF
  else if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    if (file.mimetype !== 'application/pdf') {
      throw new FileUploadError('File header does not match declared MIME type');
    }
  }
  
  // Check for suspicious content in text files
  if (file.mimetype.startsWith('text/') || file.mimetype.includes('document')) {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        throw new FileUploadError('File contains suspicious content');
      }
    }
  }
  
  return true;
};

/**
 * Generate secure filename
 */
const generateSecureFilename = (originalname, mimeType) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalname).toLowerCase();
  
  return `${timestamp}_${randomString}${extension}`;
};

/**
 * Create secure storage configuration
 */
const createSecureStorage = () => {
  const uploadDir = path.join(__dirname, '../uploads');
  
  // Create upload directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o750 });
  }
  
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Create subdirectory based on file type
      const subDir = file.mimetype.startsWith('image/') ? 'images' : 'documents';
      const fullPath = path.join(uploadDir, subDir);
      
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true, mode: 0o750 });
      }
      
      cb(null, fullPath);
    },
    filename: (req, file, cb) => {
      const secureFilename = generateSecureFilename(file.originalname, file.mimetype);
      cb(null, secureFilename);
    }
  });
};

/**
 * File filter function
 */
const fileFilter = (req, file, cb) => {
  try {
    // Validate file type
    validateFileType(file);
    
    // Validate file size
    validateFileSize(file);
    
    // Validate file content
    validateFileContent(file);
    
    // Log successful file validation
    logger.info({
      action: 'file_upload_validated',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    });
    
    cb(null, true);
  } catch (error) {
    logger.warn({
      action: 'file_upload_rejected',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      error: error.message
    });
    
    cb(new FileUploadError(error.message), false);
  }
};

/**
 * Create secure multer instance
 */
const createSecureMulter = (options = {}) => {
  const defaultOptions = {
    storage: createSecureStorage(),
    fileFilter: fileFilter,
    limits: {
      fileSize: Math.max(...Object.values(MAX_FILE_SIZES)), // Use largest max size
      files: 1, // Allow only one file per request
      fieldSize: 1024 * 1024 // 1MB for field data
    },
    preservePath: false,
    ...options
  };
  
  return multer(defaultOptions);
};

/**
 * Clean up uploaded files
 */
const cleanupUploadedFiles = (filePaths) => {
  if (!Array.isArray(filePaths)) {
    filePaths = [filePaths];
  }
  
  filePaths.forEach(filePath => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info({
          action: 'file_cleanup_success',
          filePath
        });
      } catch (error) {
        logger.error({
          action: 'file_cleanup_failed',
          filePath,
          error: error.message
        });
      }
    }
  });
};

/**
 * Scan uploaded file for viruses (basic heuristic)
 */
const scanFileForViruses = (file) => {
  const buffer = file.buffer;
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
  
  // Check for executable patterns
  const executablePatterns = [
    /MZ/, // DOS executable
    /ELF/, // Unix executable
    /#!/, // Shebang
    /<script/i, // Script tags
    /javascript:/i, // JavaScript protocol
    /vbscript:/i, // VBScript protocol
    /powershell/i, // PowerShell
    /cmd\.exe/i, // Command prompt
    /\.exe/i, // Executable extension
    /\.bat/i, // Batch file
    /\.ps1/i, // PowerShell script
    /\.sh/i, // Shell script
    /\.py/i, // Python script
    /\.rb/i, // Ruby script
    /\.pl/i, // Perl script
    /\.php/i, // PHP script
    /\.asp/i, // ASP script
    /\.jsp/i, // JSP script
    /\.cgi/i // CGI script
  ];
  
  for (const pattern of executablePatterns) {
    if (pattern.test(content)) {
      throw new FileUploadError('File appears to contain executable content');
    }
  }
  
  return true;
};

/**
 * Get file metadata securely
 */
const getFileMetadata = (file) => {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadDate: new Date().toISOString(),
    hash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
    secure: true
  };
};

// Export all file security functions
module.exports = {
  createSecureMulter,
  validateFileType,
  validateFileSize,
  validateFileContent,
  generateSecureFilename,
  cleanupUploadedFiles,
  scanFileForViruses,
  getFileMetadata,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES
};
