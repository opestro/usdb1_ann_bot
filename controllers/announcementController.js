const Announcement = require('../models/announcement');
const { broadcastAnnouncement } = require('../bot/telegramBot');

exports.createAnnouncement = async (req, res) => {
  try {
    // Extract announcement details from request body
    const { title, message, tag } = req.body;
    
    // Validate required fields
    if (!title || !message || !tag) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title, message and tag are required' 
      });
    }

    // Create new announcement
    const announcement = new Announcement({
      title,
      message,
      tag: tag.toLowerCase(), // Ensure tag is lowercase
      createdBy: req.user.id // From auth middleware
    });

    // Save to database
    await announcement.save();
    
    // Broadcast to all users via telegram
    await broadcastAnnouncement(announcement);

    // Return success response
    res.status(201).json({ 
      success: true, 
      announcement 
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid tag. Allowed tags: sports, academic, tech, events, general, important' 
      });
    }
    
    // Handle other errors
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}; 