const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  language: { type: String, enum: ['en', 'fr', 'ar'], default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema); 