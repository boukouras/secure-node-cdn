"use strict";
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const ALLOWED_CLIENTS = process.env.ALLOWED_CLIENTS?.split(',') || [];

// Middleware: Authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);

    if (!ALLOWED_CLIENTS.includes(user?.name)) {
      return res.status(403).json({ error: 'Unauthorized client' });
    }

    req.user = user;
    next();

  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// MIME Validation
const allowedMimes = {
  css: ['text/css'],
  js: ['application/javascript', 'text/javascript'],
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml'
  ],
  videos: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo'
  ],
  etc: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.ms-excel',
    'application/zip',
    'application/json',
    'text/plain',
  ]
};

function getCategoryByMime(mime) {
  for (const [category, types] of Object.entries(allowedMimes)) {
    if (types.includes(mime)) return category;
  }
  return null;
}

// Multer Storage Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mime = file.mimetype;
    const category = getCategoryByMime(mime);
    if (!category) return cb(new Error('Unsupported MIME type'));

    const access = req.body.access === 'private' ? 'private' : 'public';
    const targetDir = path.join(process.cwd(), 'media', access, category);
    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const category = getCategoryByMime(file.mimetype);
  if (!category) return cb(new Error('Blocked file type'), false);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

// Upload Single File
app.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  const mime = req.file.mimetype;
  const category = getCategoryByMime(mime);
  const access = req.body.access === 'private' ? 'private' : 'public';


  if (!req.file) {
    return res.status(400).json({ status: false, error: 'No file uploaded' });
  }

  return res.json({
    status: true,
    file: req.file.filename,
    url: `/media/${access}/${category}/${req.file.filename}`
  });
});

// Upload Multiple Files
app.post('/upload/multi', authenticateToken, upload.array('files', 10), (req, res) => {
  const files = req.files.map(f => {
    const mime = f.mimetype;
    const category = getCategoryByMime(mime);
    const access = req.body.access === 'private' ? 'private' : 'public';

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ status: false, error: 'No files uploaded' });
    }

    return {
      filename: f.filename,
      url: `/media/${access}/${category}/${f.filename}`
    };
  });

  return res.json({ status: true, files });
});

// Serve Media Files
app.get('/media', (req, res) => {
  const { access, type, filepath } = req.query;

  if (!['public', 'private'].includes(access)) {
    return res.status(400).json({ error: 'Invalid access type' });
  }

  const safeTypes = ['css', 'js', 'images', 'videos', 'etc'];
  if (!safeTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  if (!filepath || filepath.includes('..')) {
    return res.status(400).json({ error: 'Invalid filepath' });
  }

  const fullPath = path.join(process.cwd(), 'media', access, type, filepath);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (['css', 'images', 'js'].includes(type)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const ext = path.extname(filepath).toLowerCase();
    if (type === 'css') {
      res.setHeader('Content-Type', 'text/css');
    } else if (type === 'js') {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (type === 'images') {
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };
      res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');

      if (ext === '.svg') {
        const svgContent = fs.readFileSync(fullPath, 'utf8');
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src * data: blob:;");
        return res.send(svgContent);
      }
    }

    if (access === 'private') {
      authenticateToken(req, res, () => {
        res.sendFile(fullPath);
      });
    } else {
      res.sendFile(fullPath);
    }
  }
}
);

// Home Route
app.get('/', (req, res) => {
  res.json({
    server: true,
    message: 'Welcome to your secure CDN Server',
    uptime: process.uptime(),
    port: process.env.APP_PORT || 3000
  })
});

// Start server
const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => {
  console.log(`📡 CDN Server running at http://localhost:${PORT}`);
  const sampleToken = jwt.sign({ name: ALLOWED_CLIENTS[0] }, process.env.JWT_SECRET, { expiresIn: '1h' });
  console.log('🔐 Sample JWT:', sampleToken);
});
