require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const announcementController = require('./controllers/announcementController');

const app = express();
app.use(express.json());

// Fix mongoose deprecation warning
mongoose.set('strictQuery', false);

// Configure Telegram bot to handle promise cancellation
process.env.NTBA_FIX_319 = 1;

// Connect to MongoDB with updated options and increased timeout
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
}).then(() => {
  console.log('📦 Connected to MongoDB');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1); // Exit if cannot connect to database
});

// Make sure your .env has the correct MongoDB URI
console.log('🔌 Attempting to connect to MongoDB...');

// Routes
app.post('/api/announcements', announcementController.createAnnouncement);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
}); 