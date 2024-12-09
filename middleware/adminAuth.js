const User = require('../models/user');

// List of admin Telegram IDs with a default empty array if env variable is not set
const ADMIN_TELEGRAM_IDS = process.env.ADMIN_TELEGRAM_IDS ? 
  process.env.ADMIN_TELEGRAM_IDS.split(',') : [];

// Middleware to check if user is admin
const isAdmin = async (msg) => {
  const telegramId = msg.from.id.toString();
  try {
    // If no admins exist yet, make the first user an admin
    if (ADMIN_TELEGRAM_IDS.length === 0) {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount === 0) {
        await User.findOneAndUpdate(
          { telegramId },
          { role: 'admin' },
          { upsert: true }
        );
        return true;
      }
    }

    const user = await User.findOne({ telegramId });
    return user && (user.role === 'admin' || ADMIN_TELEGRAM_IDS.includes(telegramId));
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Command to add new admin
const addAdmin = async (msg) => {
  const adminId = msg.from.id.toString();
  const messageText = msg.text.split(' ');
  
  try {
    // Check if command sender is admin
    const isUserAdmin = await isAdmin(msg);
    if (!isUserAdmin) {
      return 'You are not authorized to add admins.';
    }

    if (messageText.length !== 2) {
      return 'Please provide a Telegram ID: /addadmin <telegram_id>';
    }

    const newAdminId = messageText[1];
    await User.findOneAndUpdate(
      { telegramId: newAdminId },
      { role: 'admin' },
      { upsert: true }
    );
    return `Admin added successfully! ID: ${newAdminId}`;
  } catch (error) {
    console.error('Error adding admin:', error);
    return 'Failed to add admin. Please try again.';
  }
};

module.exports = { isAdmin, addAdmin }; 