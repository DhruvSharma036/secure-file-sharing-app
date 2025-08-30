require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// --- Models ---
const File = require('./models/File');
const ShortUrl = require('./models/ShortUrl');
const User = require('./models/User');

const app = express();

// --- Middleware Setup ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));


// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- S3 Compatible Storage Setup (Supabase) ---
const s3 = new aws.S3({
  endpoint: process.env.SUPABASE_S3_ENDPOINT,
  accessKeyId: process.env.SUPABASE_ACCESS_KEY_ID,
  secretAccessKey: process.env.SUPABASE_SECRET_ACCESS_KEY,
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.SUPABASE_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `uploads/${uniqueSuffix}-${file.originalname}`);
    }
  })
});

// --- AUTHENTICATION MIDDLEWARE ---
const authCheck = (req, res, next) => {
    if (req.cookies.token) {
        try {
            const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
            req.userId = decoded.userId;
            req.isGuest = false;
            next();
        } catch (error) {
            // If token is invalid, treat as guest or deny
             if (req.body.userId || req.query.userId) {
                req.isGuest = true;
                req.userId = req.body.userId || req.query.userId;
                next();
            } else {
                return res.status(401).json({ message: 'Invalid token.' });
            }
        }
    } else if (req.body.userId || req.query.userId) { // Check body for uploads, query for dashboard
        req.isGuest = true;
        req.userId = req.body.userId || req.query.userId;
        next();
    } else {
        return res.status(401).json({ message: 'No user or guest session identified.' });
    }
};

// --- AUTHENTICATION ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Password validation
    const passRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,}$/;
    if (!password || !passRegex.test(password)) {
        return res.status(400).json({ message: "Password must be at least 6 characters long and include a number and a special character." });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Username already exists." });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        // Automatically log in the user after registration
        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
        res.status(201).json({ id: newUser._id, username: newUser.username });

    } catch (error) {
        res.status(500).json({ message: "Server error during registration." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
        res.status(200).json({ id: user._id, username: user.username });

    } catch (error) {
        res.status(500).json({ message: "Server error during login." });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: "Logged out successfully." });
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json(user);
    } catch (error) {
        res.status(401).json({ message: 'Not authenticated.' });
    }
});


// --- FILE ROUTES ---

// **FIXED**: Swapped order of upload and authCheck. Multer needs to run first to parse the form data.
app.post('/api/upload', upload.single('file'), authCheck, async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { password, expiresInHours, downloadLimit } = req.body;

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const newFile = new File({
      s3Key: file.key,
      originalName: file.originalname,
      size: file.size,
      password: hashedPassword,
      expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null,
      downloadLimit: downloadLimit ? parseInt(downloadLimit, 10) : null,
      userId: req.userId, // Use userId from authCheck middleware
    });
    await newFile.save();

    const shortId = nanoid(7);
    const downloadPageUrl = `${process.env.FRONTEND_URL}/download/${newFile._id}`;
    
    const newShortUrl = new ShortUrl({
        shortId: shortId,
        originalUrl: downloadPageUrl
    });
    await newShortUrl.save();
    
    const shortLink = `${process.env.BACKEND_URL}/s/${shortId}`;

    res.status(201).json({ success: true, link: shortLink });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Server error during file upload.' });
  }
});

app.get('/api/files/:id/meta', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) { return res.status(404).json({ success: false, message: 'File not found or link is invalid.' }); }
        const isExpiredByTime = file.expiresAt && new Date() > file.expiresAt;
        const isExpiredByDownloads = file.downloadLimit != null && file.downloadCount >= file.downloadLimit;
        if (isExpiredByTime || isExpiredByDownloads) { return res.status(410).json({ success: false, message: 'This link has expired.' }); }
        res.status(200).json({ id: file._id, name: file.originalName, size: file.size, hasPassword: !!file.password });
    } catch (error) {
        console.error('Get Metadata Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.post('/api/files/:id/download', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) { return res.status(404).json({ success: false, message: 'File not found.' }); }
        const isExpiredByTime = file.expiresAt && new Date() > file.expiresAt;
        const isExpiredByDownloads = file.downloadLimit != null && file.downloadCount >= file.downloadLimit;
        if (isExpiredByTime || isExpiredByDownloads) { return res.status(410).json({ success: false, message: 'This link has expired.' }); }
        if (file.password) {
            const { password } = req.body;
            if (!password || !(await bcrypt.compare(password, file.password))) {
                return res.status(401).json({ success: false, message: 'Incorrect password.' });
            }
        }
        file.downloadCount += 1;
        await file.save();
        const params = { Bucket: process.env.SUPABASE_BUCKET_NAME, Key: file.s3Key, Expires: 60 * 5 };
        const downloadUrl = s3.getSignedUrl('getObject', params);
        res.status(200).json({ success: true, url: downloadUrl, name: file.originalName });
    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).json({ success: false, message: 'Server error during download.' });
    }
});

app.get('/s/:shortId', async (req, res) => {
    try {
        const urlEntry = await ShortUrl.findOne({ shortId: req.params.shortId });
        if (urlEntry) { return res.redirect(302, urlEntry.originalUrl); } 
        else { return res.status(404).send('Link not found.'); }
    } catch (error) {
        console.error('Redirect error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/api/files', authCheck, async (req, res) => {
  try {
    const files = await File.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(files);
  } catch (error) {
    console.error('Error fetching files for dashboard:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching files.' });
  }
});


// --- Server Start ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});