const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  s3Key: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  password: { type: String },
  expiresAt: { type: Date },
  downloadLimit: { type: Number },
  downloadCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('File', fileSchema);