const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema); 