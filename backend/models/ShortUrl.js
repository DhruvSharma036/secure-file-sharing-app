const mongoose = require('mongoose');

const shortUrlSchema = new mongoose.Schema({
  shortId: {
    type: String,
    required: true,
    unique: true,
  },
  originalUrl: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 7, // auto-delete links after 7 days
  },
});

module.exports = mongoose.model('ShortUrl', shortUrlSchema);