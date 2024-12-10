require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const announcementController = require('./controllers/announcementController');
const { initializeAdmins } = require('./middleware/adminAuth');

const startApp = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('📦 Connected to MongoDB');

    // Initialize admin users
    await initializeAdmins();

    // Initialize bot
    require('./bot/telegramBot');
    console.log('🤖 Bot initialized');

    // Start express server
    const app = express();
    app.use(express.json());

    // Fix mongoose deprecation warning
    mongoose.set('strictQuery', false);

    // Configure Telegram bot to handle promise cancellation
    process.env.NTBA_FIX_319 = 1;

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
  } catch (error) {
    console.error('❌ Error starting app:', error);
    process.exit(1);
  }
};

startApp(); 