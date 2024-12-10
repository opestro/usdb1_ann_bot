const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/user');
const Announcement = require('../models/announcement');
const { isAdmin, addAdmin } = require('../middleware/adminAuth');
const { validateAnnouncement } = require('../utils/validator');
const schedule = require('node-schedule');
const { getText } = require('../utils/language');

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
    // Show language selection first
    await bot.sendMessage(
      chatId, 
      '🌐 Welcome! Please select your language\n\n' +
      'Bienvenue! Veuillez choisir votre langue\n\n' +
      'مرحباً! الرجاء اختيار لغتك',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'English 🇬🇧', callback_data: 'start_lang_en' },
              { text: 'Français 🇫🇷', callback_data: 'start_lang_fr' },
              { text: 'العربية 🇸🇦', callback_data: 'start_lang_ar' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in start command:', error);
  }
});

// Admin command to create announcement
bot.onText(/\/announce/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: chatId.toString() });
  const lang = user?.language || 'en';
  
  if (!await isAdmin(msg)) {
    bot.sendMessage(chatId, getText(lang, 'not_authorized'));
    return;
  }

  announcementStates.set(chatId, { 
    step: 'TITLE',
    attachments: [],
    language: lang
  });
  
  bot.sendMessage(chatId, getText(lang, 'announcement_title_prompt'));
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

  const lang = state.language;

  try {
    switch (state.step) {
      case 'TITLE':
        state.title = msg.text;
        state.step = 'MESSAGE';
        bot.sendMessage(chatId, getText(lang, 'announcement_message_prompt'));
        break;

      case 'MESSAGE':
        state.message = msg.text;
        state.step = 'TAG';
        bot.sendMessage(chatId, getText(lang, 'announcement_tag_prompt'), {
          reply_markup: {
            inline_keyboard: [
              [
                { text: `${getText(lang, 'sports')} ⚽`, callback_data: 'tag_sports' },
                { text: `${getText(lang, 'academic')} 📚`, callback_data: 'tag_academic' }
              ],
              [
                { text: `${getText(lang, 'tech')} 💻`, callback_data: 'tag_tech' },
                { text: `${getText(lang, 'events')} 📅`, callback_data: 'tag_events' }
              ],
              [
                { text: `${getText(lang, 'general')} 📢`, callback_data: 'tag_general' },
                { text: `${getText(lang, 'important')} ⚠️`, callback_data: 'tag_important' }
              ]
            ]
          }
        });
        break;
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    bot.sendMessage(chatId, getText(lang, 'error_creating_announcement'));
    announcementStates.delete(chatId);
  }
});

// Handle tag selection and schedule option
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('start_lang_')) {
    const language = data.split('_')[2];
    try {
      // Save user with selected language
      await User.findOneAndUpdate(
        { telegramId: chatId.toString() },
        { 
          username: callbackQuery.from.username,
          language: language 
        },
        { upsert: true }
      );

      // Send welcome message in selected language
      await bot.sendMessage(chatId, getText(language, 'language_changed'));
      await bot.sendMessage(chatId, getText(language, 'welcome'));
      await bot.sendMessage(chatId, getText(language, 'commands'));

    } catch (error) {
      console.error('Error setting initial language:', error);
      bot.sendMessage(chatId, '❌ Error setting language. Please try /start again.');
    }
    return;
  }

  if (data.startsWith('lang_')) {
    const language = data.split('_')[1];
    await User.findOneAndUpdate(
      { telegramId: chatId.toString() },
      { language: language },
      { upsert: true }
    );

    bot.sendMessage(chatId, getText(language, 'language_changed'));
    return;
  }
  
  const state = announcementStates.get(chatId);

  if (!state) return;

  if (data.startsWith('tag_')) {
    state.tag = data.replace('tag_', '');
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
  } else if (data === 'attachments_done') {
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
    
    for (const user of users) {
      const lang = user.language || 'en';
      try {
        const message = 
          `${getTagEmoji(announcement.tag)} *${getText(lang, 'new_announcement')}*\n\n` +
          `*${getText(lang, 'title')}:* \`${announcement.title}\`\n\n` +
          `${announcement.message}\n\n` +
          `*${getText(lang, 'category')}:* _#${announcement.tag}_\n` +
          `*${getText(lang, 'posted')}:* _${new Date().toLocaleString(
            lang === 'ar' ? 'ar-SA' : lang === 'fr' ? 'fr-FR' : 'en-US',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }
          )}_`;

        await bot.sendMessage(user.telegramId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });

        // Handle attachments
        if (announcement.attachments?.length > 0) {
          for (const attachment of announcement.attachments) {
            const caption = getText(lang, 'attachment_for')
              .replace('{title}', announcement.title);

            switch (attachment.type) {
              case 'photo':
                await bot.sendPhoto(user.telegramId, attachment.fileId, {
                  caption,
                  parse_mode: 'Markdown'
                });
                break;
              case 'document':
                await bot.sendDocument(user.telegramId, attachment.fileId, {
                  caption,
                  parse_mode: 'Markdown'
                });
                break;
            }
          }
        }
      } catch (error) {
        console.error(`Error sending to user ${user.telegramId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in broadcast:', error);
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
bot.onText(/\/myid/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: chatId.toString() });
  const lang = user?.language || 'en';
  
  const userId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : getText(lang, 'no_username');
  
  bot.sendMessage(chatId, getText(lang, 'your_id_info')
    .replace('{id}', userId)
    .replace('{username}', username));
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
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: chatId.toString() });
  const lang = user?.language || 'en';

  try {
    const recentAnnouncements = await Announcement.find()
      .sort({ createdAt: -1 })
      .limit(5);

    if (recentAnnouncements.length === 0) {
      bot.sendMessage(chatId, getText(lang, 'no_announcements'));
      return;
    }

    let response = `${getText(lang, 'recent_announcements')}\n\n`;
    
    for (const announcement of recentAnnouncements) {
      const tagEmoji = {
        sports: '⚽',
        academic: '📚',
        tech: '💻',
        events: '📅',
        general: '📢',
        important: '⚠️'
      }[announcement.tag] || '📌';

      const date = new Date(announcement.createdAt).toLocaleString(
        lang === 'ar' ? 'ar-SA' : lang === 'fr' ? 'fr-FR' : 'en-US',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      );

      response += `${tagEmoji} *${announcement.title}*\n`;
      response += `${getText(lang, 'message')}: ${announcement.message}\n\n`;
      response += `${getText(lang, 'category')}: _#${announcement.tag}_\n`;
      response += `${getText(lang, 'date')}: _${date}_\n`;
      response += `-------------------------\n\n`;
    }

    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    bot.sendMessage(chatId, getText(lang, 'error_fetching_announcements'));
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

// Add language command handler
bot.onText(/\/lang/, async (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🌐 Select your language / Choisir la langue / اختر اللغة', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'English 🇬🇧', callback_data: 'lang_en' },
          { text: 'Français 🇫🇷', callback_data: 'lang_fr' },
          { text: 'العربية 🇸🇦', callback_data: 'lang_ar' }
        ]
      ]
    }
  });
});

module.exports = { bot, broadcastAnnouncement }; 