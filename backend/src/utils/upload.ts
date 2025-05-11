// src/utils/upload.ts
// A dedicated file for multer configuration to ensure uploads work properly

import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with original name to aid debugging
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Remove special characters from original name
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + cleanFileName);
  }
});

// Create multer instance
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and common document/media types
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

export default upload;