// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcrypt');
const cors = require('cors');
const aws = require('aws-sdk'); // We can still use the AWS SDK!
const multerS3 = require('multer-s3');
const { nanoid } = require('nanoid');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// --- Supabase (S3 Compatible) Setup ---
const s3 = new aws.S3({
  endpoint: process.env.SUPABASE_S3_ENDPOINT, // The key change is here!
  accessKeyId: process.env.SUPABASE_ACCESS_KEY_ID,
  secretAccessKey: process.env.SUPABASE_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
});

// --- Database Setup ---
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);
const File = require('./models/File');
const ShortUrl = require('./models/ShortUrl');

// --- File Storage Setup with Multer-S3 ---
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.SUPABASE_BUCKET_NAME,
    acl: 'private', // Files should be private
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, `uploads/${Date.now().toString()}-${file.originalname}`);
    },
  }),
});

// --- API Routes (These remain IDENTICAL) ---

// 1. File Upload Route
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { password, expiresInHours, downloadLimit } = req.body;
    let expiresAt = null;
    if (expiresInHours) {
        expiresAt = new Date(Date.now() + parseInt(expiresInHours, 10) * 60 * 60 * 1000);
    }
    const fileData = {
      s3Key: req.file.key,
      originalName: req.file.originalname,
      size: req.file.size,
      expiresAt: expiresAt,
      downloadLimit: downloadLimit ? parseInt(downloadLimit, 10) : null,
    };
    if (password != null && password !== '') {
      fileData.password = await bcrypt.hash(password, 10);
    }
    const file = await File.create(fileData);
    const longUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/download/${file._id}`;
    const shortId = nanoid(8);
    await ShortUrl.create({ shortId: shortId, originalUrl: longUrl });
    const shortUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/s/${shortId}`;
    res.json({ success: true, link: shortUrl, fileId: file._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'An error occurred during upload.' });
  }
});

// 2. Get File Metadata Route
app.get('/api/files/:id/meta', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: "File not found or link is invalid." });
        const isExpiredByTime = file.expiresAt && new Date() > file.expiresAt;
        const isExpiredByDownloads = file.downloadLimit != null && file.downloadCount >= file.downloadLimit;
        if (isExpiredByTime || isExpiredByDownloads) {
            await s3.deleteObject({ Bucket: process.env.SUPABASE_BUCKET_NAME, Key: file.s3Key }).promise();
            await file.deleteOne();
            return res.status(400).json({ message: "This link has expired." });
        }
        res.json({ id: file._id, name: file.originalName, size: file.size, hasPassword: file.password != null });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error.' });
    }
});

// 3. Get Secure Download URL Route
app.post('/api/files/:id/download', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        const { password } = req.body;
        if (!file) return res.status(404).json({ message: "File not found." });
        const isExpiredByTime = file.expiresAt && new Date() > file.expiresAt;
        const isExpiredByDownloads = file.downloadLimit != null && file.downloadCount >= file.downloadLimit;
        if (isExpiredByTime || isExpiredByDownloads) return res.status(400).json({ message: "This link has expired." });
        if (file.password != null) {
            if (password == null || !(await bcrypt.compare(password, file.password))) {
                 return res.status(401).json({ message: "Incorrect password." });
            }
        }
        file.downloadCount++;
        await file.save();
        const url = s3.getSignedUrl('getObject', {
            Bucket: process.env.SUPABASE_BUCKET_NAME,
            Key: file.s3Key,
            Expires: 60,
            ResponseContentDisposition: `attachment; filename="${file.originalName}"`
        });
        res.json({ url });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error.' });
    }
});

// 4. Short URL Redirect Route
app.get('/s/:shortId', async (req, res) => {
    try {
        const urlEntry = await ShortUrl.findOne({ shortId: req.params.shortId });
        if (urlEntry == null) return res.status(404).send('URL not found');
        res.redirect(urlEntry.originalUrl);
    } catch (e) {
        console.error(e);
        res.status(500).send('Server error');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
