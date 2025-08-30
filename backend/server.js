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

// --- Google Gemini API Helper ---
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

const File = require('./models/File');
const ShortUrl = require('./models/ShortUrl');
const User = require('./models/User');

const app = express();
// FIX: Increase the JSON body limit to 100mb to handle larger file content for analysis,
// matching the frontend's 100MB upload limit.
app.use(express.json({ limit: '100mb' })); 
app.use(cookieParser());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB connected.')).catch(err => console.error('MongoDB Connection Error:', err));

const s3 = new aws.S3({
  endpoint: process.env.SUPABASE_S3_ENDPOINT,
  accessKeyId: process.env.SUPABASE_ACCESS_KEY_ID,
  secretAccessKey: process.env.SUPABASE_SECRET_ACCESS_KEY,
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.SUPABASE_BUCKET_NAME,
    key: function (req, file, cb) {
      // FIX: Sanitize the original filename to remove invalid characters for S3 keys.
      // This prevents the "InvalidKey" error for files with special characters like [].
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `uploads/${uniqueSuffix}-${sanitizedOriginalName}`);
    }
  })
});

// --- Middleware ---
const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token.' });
    }
};

const identifyUserOrGuest = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded; 
        } catch (error) {
            req.user = null; 
        }
    } 
    const guestId = req.body.userId || req.query.userId;
    if (guestId) {
        req.guestId = guestId;
    }
    
    if (!req.user && !req.guestId) {
       return res.status(401).json({ success: false, message: 'No user or guest session identified.' });
    }
    next();
};

const fileUploadMiddleware = upload.single('file');


// --- API Routes ---
app.post('/api/upload', (req, res, next) => {
    fileUploadMiddleware(req, res, (err) => {
        if (err) {
            console.error('Multer Upload Error:', err);
            return res.status(400).json({ success: false, message: 'File upload error. Check server logs for details.' });
        }
        identifyUserOrGuest(req, res, next);
    });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const { password, expiresInHours, downloadLimit } = req.body;
    const userId = req.user ? req.user.id : req.guestId;
    
    let hashedPassword = null;
    if (password) hashedPassword = await bcrypt.hash(password, 10);

    const newFile = new File({
      s3Key: req.file.key,
      originalName: req.file.originalname,
      size: req.file.size,
      password: hashedPassword,
      expiresAt: expiresInHours ? new Date(Date.now() + parseInt(expiresInHours, 10) * 60 * 60 * 1000) : null,
      downloadLimit: downloadLimit ? parseInt(downloadLimit, 10) : null,
      userId: userId,
    });
    await newFile.save();

    const shortId = nanoid(7);
    const downloadPageUrl = `${process.env.FRONTEND_URL}/download/${newFile._id}`;
    
    const newShortUrl = new ShortUrl({ shortId, originalUrl: downloadPageUrl });
    await newShortUrl.save();
    
    const shortLink = `${process.env.BACKEND_URL}/s/${shortId}`;
    res.status(201).json({ success: true, link: shortLink });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Server error during file upload.' });
  }
});


app.post('/api/files/analyze', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: "No content provided for analysis." });
        }
        const prompt = `Analyze the following text and identify if it contains any Personally Identifiable Information (PII). List the types of PII found. Your response must be a valid JSON object with a single key "pii_types" which is an array of strings. For example: {"pii_types": ["EMAIL_ADDRESS", "PHONE_NUMBER"]}. If no PII is found, the array should be empty. Text to analyze: "${content}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        // FIX: Add a try-catch block specifically for parsing the AI's response
        // to prevent server crashes if the response is not valid JSON.
        try {
            const text = response.text().replace(/```json/g, '').replace(/```/g, '');
            const analysis = JSON.parse(text);
            res.status(200).json({ success: true, analysis });
        } catch (parseError) {
            console.error("AI Response Parsing Error:", parseError);
            console.error("Original AI Response Text:", response.text());
            res.status(500).json({ success: false, message: "Failed to parse AI analysis response." });
        }

    } catch (error) {
        console.error("AI Analysis Error:", error);
        res.status(500).json({ success: false, message: "Failed to analyze file with AI. Check server logs for API key or other issues." });
    }
});


app.get('/api/files/:id/meta', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: "File not found or link is invalid." });
        }
        const isExpiredByTime = file.expiresAt && new Date() > file.expiresAt;
        const isExpiredByDownloads = file.downloadLimit != null && file.downloadCount >= file.downloadLimit;
        if (isExpiredByTime || isExpiredByDownloads) {
            return res.status(410).json({ message: "This link has expired." });
        }
        res.json({ id: file._id, name: file.originalName, size: file.size, hasPassword: !!file.password });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

app.post('/api/files/:id/download', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: "File not found." });
        }
        const isExpiredByTime = file.expiresAt && new Date() > file.expiresAt;
        const isExpiredByDownloads = file.downloadLimit != null && file.downloadCount >= file.downloadLimit;
        if (isExpiredByTime || isExpiredByDownloads) {
            return res.status(410).json({ message: "This link has expired." });
        }
        if (file.password) {
            const { password } = req.body;
            if (!password || !(await bcrypt.compare(password, file.password))) {
                return res.status(401).json({ message: "Incorrect password." });
            }
        }
        file.downloadCount++;
        await file.save();
        const params = {
            Bucket: process.env.SUPABASE_BUCKET_NAME,
            Key: file.s3Key,
            Expires: 60 * 5 // 5 minutes
        };
        const downloadUrl = s3.getSignedUrl('getObject', params);
        res.status(200).json({ success: true, url: downloadUrl, name: file.originalName });
    } catch (error) {
        res.status(500).json({ message: 'Server error during download.' });
    }
});

app.get('/s/:shortId', async (req, res) => {
    try {
        const urlEntry = await ShortUrl.findOne({ shortId: req.params.shortId });
        if (urlEntry == null) return res.status(404).send('URL not found');
        res.redirect(302, urlEntry.originalUrl);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

app.get('/api/files', identifyUserOrGuest, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.guestId;
    const files = await File.find({ userId: userId }).sort({ createdAt: -1 });
    res.status(200).json(files);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching files.' });
  }
});

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!password || password.length < 6 || !/\d/.test(password) || !/[!@#$%^&*]/.test(password)) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long and include a number and a special character.' });
        }
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        
        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 });
        res.status(201).json({ id: user._id, username: user.username });
    } catch (error) {
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 });
        res.status(200).json({ id: user._id, username: user.username });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});