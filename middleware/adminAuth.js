const User = require('../models/user');

// Get initial admin IDs from environment variable
const initialAdmins = process.env.ADMIN_TELEGRAM_IDS 
  ? process.env.ADMIN_TELEGRAM_IDS.split(',').map(id => id.trim())
  : [];

// Initialize admin users on startup
const initializeAdmins = async () => {
  try {
    console.log('🔑 Initializing admin users...');
    
    for (const adminId of initialAdmins) {
      await User.findOneAndUpdate(
        { telegramId: adminId },
        { 
          role: 'admin',
          telegramId: adminId 
        },
        { upsert: true }
      );
    }
    
    console.log(`✅ Initialized ${initialAdmins.length} admin(s)`);
  } catch (error) {
    console.error('❌ Error initializing admins:', error);
  }
};

// Check if user is admin
const isAdmin = async (msg) => {
  try {
    const telegramId = msg.chat?.id || msg.from?.id;
    
    console.log('🔍 Checking admin status for:', {
      telegramId,
      initialAdmins,
      messageType: msg.chat ? 'chat' : 'callback'
    });
    
    if (!telegramId) {
      console.log('❌ No telegram ID found in message:', msg);
      return false;
    }

    // Check if user is in initial admins list
    const stringId = telegramId.toString();
    if (initialAdmins.includes(stringId)) {
      console.log('✅ User found in initial admins list:', stringId);
      // Ensure admin exists in database
      await User.findOneAndUpdate(
        { telegramId: stringId },
        { role: 'admin' },
        { upsert: true }
      );
      return true;
    }

    const user = await User.findOne({ 
      telegramId: stringId,
      role: 'admin'
    });

    console.log('🔎 Database admin check:', {
      telegramId: stringId,
      found: !!user,
      role: user?.role
    });

    return !!user;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Add new admin
const addAdmin = async (telegramId) => {
  try {
    const result = await User.findOneAndUpdate(
      { telegramId: telegramId.toString() },
      { role: 'admin' },
      { upsert: true, new: true }
    );
    return result;
  } catch (error) {
    console.error('Error adding admin:', error);
    throw error;
  }
};

module.exports = { isAdmin, addAdmin, initializeAdmins }; 