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

// Store announcement creation states
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

  // Initialize announcement state
  announcementStates.set(chatId, { 
    step: 'TITLE',
    attachments: []
  });
  
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
    console.error('Error in message handler:', error);
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
    state.step = 'ATTACHMENTS';
    
    bot.sendMessage(chatId, 
      '📎 You can now send photos or documents (optional).\n' +
      'Send your attachments one by one or click "Done" if you don\'t want to add any.',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "Done ✅", callback_data: "attachments_done" }
          ]]
        }
      }
    );
  } else if (callbackQuery.data === 'attachments_done') {
    await createAndSendAnnouncement(state, chatId);
    announcementStates.delete(chatId);
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
    console.log('📤 Creating announcement with state:', {
      title: state.title,
      hasAttachments: !!state.attachments,
      attachmentsCount: state.attachments?.length
    });

    // Create the announcement in database
    const announcement = new Announcement({
      title: state.title,
      message: state.message,
      tag: state.tag,
      attachments: state.attachments || [],
      createdBy: chatId.toString()
    });

    await announcement.save();
    console.log('💾 Announcement saved to database with ID:', announcement._id);

    // Broadcast the announcement
    await broadcastAnnouncement(announcement);
    
    bot.sendMessage(chatId, '✅ Announcement created and sent successfully!');
  } catch (error) {
    console.error('❌ Error creating announcement:', error);
    bot.sendMessage(chatId, '❌ Error creating announcement. Please try again.');
  }
}

// Function to broadcast announcement to all registered users
async function broadcastAnnouncement(announcement) {
  try {
    const users = await User.find();
    console.log('📢 Broadcasting announcement to', users.length, 'users');
    
    for (const user of users) {
      try {
        // Format date
        const date = new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Send main message with markdown formatting
        const message = 
          `${getTagEmoji(announcement.tag)} *NEW ANNOUNCEMENT*\n\n` +
          `*📌 Title:* \`${announcement.title}\`\n\n` +
          `${announcement.message}\n\n` +
          `*🏷️ Category:* _#${announcement.tag}_\n` +
          `*🕒 Posted:* _${date}_`;

        await bot.sendMessage(user.telegramId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });

        // Send attachments if any
        if (announcement.attachments && announcement.attachments.length > 0) {
          console.log('📎 Sending', announcement.attachments.length, 
            'attachments to user:', user.telegramId);
          
          for (const attachment of announcement.attachments) {
            console.log('📎 Sending attachment:', {
              type: attachment.type,
              fileId: attachment.fileId
            });

            switch (attachment.type) {
              case 'photo':
                await bot.sendPhoto(user.telegramId, attachment.fileId, {
                  caption: `📸 Attachment for: *${announcement.title}*`,
                  parse_mode: 'Markdown'
                }).catch(err => console.error('Error sending photo:', err));
                break;
              case 'document':
                await bot.sendDocument(user.telegramId, attachment.fileId, {
                  caption: `📎 Document for: *${announcement.title}*`,
                  parse_mode: 'Markdown'
                }).catch(err => console.error('Error sending document:', err));
                break;
            }
          }
        }
      } catch (error) {
        console.error('❌ Error sending to user:', user.telegramId, error);
      }
    }
  } catch (error) {
    console.error('❌ Error in broadcast:', error);
  }
}

// Helper function to get emoji for tag
function getTagEmoji(tag) {
  const emojis = {
    sports: '⚽',
    academic: '📚',
    tech: '💻',
    events: '📅',
    general: '📢',
    important: '⚠️'
  };
  return emojis[tag] || '📌';
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
      response += `Message: ${announcement.message}\n\n`;
      response += `Category: #${announcement.tag}\n`;
      response += `Date: ${date}\n`;
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

// Handle file uploads during announcement creation
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const state = announcementStates.get(chatId);
  
  console.log('📸 Received photo:', {
    chatId: chatId,
    state: state?.step,
    photoSizes: msg.photo,
    hasCaption: !!msg.caption
  });
  
  if (state && state.step === 'ATTACHMENTS') {
    // Get the highest resolution photo
    const photo = msg.photo[msg.photo.length - 1];
    console.log('📸 Saving photo with fileId:', photo.file_id);
    
    state.attachments = state.attachments || [];
    state.attachments.push({
      type: 'photo',
      fileId: photo.file_id
    });
    
    bot.sendMessage(chatId, 
      `📎 Photo attached! (ID: ${photo.file_id.substr(0, 8)}...)\n` +
      'Send another attachment or click "Done" when finished.',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "Done ✅", callback_data: "attachments_done" }
          ]]
        }
      }
    );
  }
});

bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const state = announcementStates.get(chatId);
  
  if (state && state.step === 'ATTACHMENTS') {
    state.attachments.push({
      type: 'document',
      fileId: msg.document.file_id
    });
    
    bot.sendMessage(chatId, 
      '📎 Document attached! Send another attachment or click "Done" when finished.',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "Done ✅", callback_data: "attachments_done" }
          ]]
        }
      }
    );
  }
});

module.exports = { bot, broadcastAnnouncement }; 