const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  language: { type: String, enum: ['en', 'fr', 'ar'], default: 'en' },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Update lastActive on each interaction
userSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema); 