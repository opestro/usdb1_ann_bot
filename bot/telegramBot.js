const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/user');
const Announcement = require('../models/announcement');
const { isAdmin, addAdmin } = require('../middleware/adminAuth');
const { validateAnnouncement } = require('../utils/validator');
const schedule = require('node-schedule');

console.log('🤖 Initializing Telegram bot...');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: true,
  filepath: false
});

console.log('✅ Bot initialized, waiting for messages...');

// Store ongoing announcement creation states
const announcementStates = new Map();

// Command handlers
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    // Save or update user in database
    await User.findOneAndUpdate(
      { telegramId: chatId.toString() },
      { username: msg.from.username },
      { upsert: true }
    );
    
    // Send welcome message with emoji
    bot.sendMessage(chatId, 
      '🎓 Welcome to University Announcement Bot!\n\n' +
      'You will receive updates automatically for all announcements.\n' +
      'Categories include: #sports, #academic, #tech, #events, #general, #important\n\n' +
      '📌 Available commands:\n' +
      '/myid - Get your Telegram ID\n' +
      '/getannouncements - Get last 5 announcements\n' +
      '/announce - Create announcement (admin only)\n' +
      '/addadmin - Add new admin (admin only)'
    );
  } catch (error) {
    console.error('Error saving user:', error);
  }
});

// Admin command to create announcement
bot.onText(/\/announce/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await isAdmin(msg)) {
    bot.sendMessage(chatId, '⛔ You are not authorized to create announcements.');
    return;
  }

  announcementStates.set(chatId, { step: 'TITLE' });
  bot.sendMessage(chatId, '📝 Please enter the announcement title:');
});

// Admin command to add another admin
bot.onText(/\/addadmin (.+)/, async (msg) => {
  const chatId = msg.chat.id;
  const response = await addAdmin(msg);
  bot.sendMessage(chatId, response);
});

// Handle announcement creation conversation
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = announcementStates.get(chatId);

  if (!state) return;

  try {
    switch (state.step) {
      case 'TITLE':
        state.title = msg.text;
        state.step = 'MESSAGE';
        bot.sendMessage(chatId, '📝 Please enter the announcement message:');
        break;

      case 'MESSAGE':
        state.message = msg.text;
        state.step = 'TAG';
        bot.sendMessage(chatId, '🏷️ Please select a tag:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Sports ⚽', callback_data: 'tag_sports' }, 
               { text: 'Academic 📚', callback_data: 'tag_academic' }],
              [{ text: 'Tech 💻', callback_data: 'tag_tech' }, 
               { text: 'Events 📅', callback_data: 'tag_events' }],
              [{ text: 'General 📢', callback_data: 'tag_general' }, 
               { text: 'Important ⚠️', callback_data: 'tag_important' }]
            ]
          }
        });
        break;
    }
  } catch (error) {
    bot.sendMessage(chatId, '❌ Error creating announcement. Please try again.');
    announcementStates.delete(chatId);
  }
});

// Handle tag selection and schedule option
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const state = announcementStates.get(chatId);

  if (!state) return;

  if (callbackQuery.data.startsWith('tag_')) {
    state.tag = callbackQuery.data.replace('tag_', '');
    
    // Ask if they want to schedule the announcement
    bot.sendMessage(chatId, '⏰ Would you like to schedule this announcement?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Yes', callback_data: 'schedule_yes' }, 
           { text: 'No, send now', callback_data: 'schedule_no' }]
        ]
      }
    });
  } else if (callbackQuery.data.startsWith('schedule_')) {
    if (callbackQuery.data === 'schedule_yes') {
      state.step = 'SCHEDULE';
      bot.sendMessage(chatId, 
        '📅 Please enter the schedule date and time in format:\n' +
        'YYYY-MM-DD HH:mm\n' +
        'Example: 2024-04-01 14:30');
    } else {
      // Create and send announcement immediately
      await createAndSendAnnouncement(state, chatId);
      announcementStates.delete(chatId);
    }
  }
});

// Handle scheduled date input
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = announcementStates.get(chatId);

  if (!state || state.step !== 'SCHEDULE') return;

  try {
    const scheduleDate = new Date(msg.text);
    if (isNaN(scheduleDate)) {
      throw new Error('Invalid date format');
    }

    // Schedule the announcement
    schedule.scheduleJob(scheduleDate, async () => {
      await createAndSendAnnouncement(state, chatId);
    });

    bot.sendMessage(chatId, 
      `✅ Announcement scheduled for ${scheduleDate.toLocaleString()}`);
    announcementStates.delete(chatId);
  } catch (error) {
    bot.sendMessage(chatId, 
      '❌ Invalid date format. Please use YYYY-MM-DD HH:mm\n' +
      'Example: 2024-04-01 14:30');
  }
});

// Helper function to create and send announcement
async function createAndSendAnnouncement(state, chatId) {
  try {
    // Validate announcement data
    const validationError = validateAnnouncement(state);
    if (validationError) {
      throw new Error(validationError);
    }

    // Create announcement
    const announcement = new Announcement({
      title: state.title,
      message: state.message,
      tag: state.tag,
      createdBy: chatId.toString()
    });

    await announcement.save();
    await broadcastAnnouncement(announcement);
    
    bot.sendMessage(chatId, '✅ Announcement created and sent successfully!');
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

// Function to broadcast announcement to all registered users
async function broadcastAnnouncement(announcement) {
  try {
    // Get all registered users
    const users = await User.find();
    
    // Format message with emoji based on tag
    const tagEmoji = {
      sports: '⚽',
      academic: '📚',
      tech: '💻',
      events: '📅',
      general: '📢',
      important: '⚠️'
    };

    // Construct formatted message
    const message = 
      `${tagEmoji[announcement.tag] || '📢'} New Announcement\n\n` +
      `Title: ${announcement.title}\n\n` +
      `${announcement.message}\n\n` +
      `Category: #${announcement.tag}`;

    // Send to each user
    for (const user of users) {
      await bot.sendMessage(user.telegramId, message);
    }
  } catch (error) {
    console.error('Error broadcasting announcement:', error);
  }
}

// Add debug logging for /myid command
bot.onText(/\/myid/, (msg) => {
  console.log('📝 /myid command received:', {
    chatId: msg.chat.id,
    userId: msg.from.id,
    username: msg.from.username,
    firstName: msg.from.first_name,
    lastName: msg.from.last_name,
    messageType: msg.chat.type
  });

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : 'No username';
  
  try {
    bot.sendMessage(chatId, 
      `🆔 Your Information:\n\n` +
      `Telegram ID: ${userId}\n` +
      `Username: ${username}\n\n` +
      `Share this ID with an admin to get admin privileges.`
    ).then(() => {
      console.log('✅ /myid response sent successfully to:', chatId);
    }).catch((error) => {
      console.error('❌ Error sending /myid response:', error);
    });
  } catch (error) {
    console.error('❌ Error processing /myid command:', error);
  }
});

// Add general message logging
bot.on('message', (msg) => {
  console.log('📨 Received message:', {
    text: msg.text,
    chatId: msg.chat.id,
    type: msg.chat.type
  });
});

// Add error handling for bot
bot.on('polling_error', (error) => {
  console.error('❌ Telegram Bot polling error:', error);
});

bot.on('error', (error) => {
  console.error('❌ Telegram Bot general error:', error);
});

// Add command to get recent announcements
bot.onText(/\/getannouncements/, async (msg) => {
  console.log('📝 /getannouncements command received from:', msg.chat.id);
  const chatId = msg.chat.id;

  try {
    // Get last 5 announcements, sorted by creation date
    const recentAnnouncements = await Announcement.find()
      .sort({ createdAt: -1 })
      .limit(5);

    if (recentAnnouncements.length === 0) {
      bot.sendMessage(chatId, '📭 No announcements found.');
      return;
    }

    // Format and send each announcement
    let response = '📢 Recent Announcements:\n\n';
    
    for (const announcement of recentAnnouncements) {
      // Get emoji based on tag
      const tagEmoji = {
        sports: '⚽',
        academic: '📚',
        tech: '💻',
        events: '📅',
        general: '📢',
        important: '⚠️'
      }[announcement.tag] || '📌';

      // Format date
      const date = new Date(announcement.createdAt).toLocaleDateString();
      
      response += `${tagEmoji} ${announcement.title}\n`;
      response += `Category: #${announcement.tag}\n`;
      response += `Date: ${date}\n`;
      response += `Message: ${announcement.message}\n\n`;
      response += `-------------------------\n\n`;
    }

    bot.sendMessage(chatId, response)
      .then(() => {
        console.log('✅ Recent announcements sent to:', chatId);
      })
      .catch((error) => {
        console.error('❌ Error sending announcements:', error);
      });

  } catch (error) {
    console.error('❌ Error fetching announcements:', error);
    bot.sendMessage(chatId, 
      '❌ Sorry, there was an error fetching announcements. Please try again later.');
  }
});

module.exports = { bot, broadcastAnnouncement }; 