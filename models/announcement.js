const mongoose = require('mongoose');

// Define the allowed tags for announcements
const ALLOWED_TAGS = ['sports', 'academic', 'tech', 'events', 'general', 'important'];

const announcementSchema = new mongoose.Schema({
  // Title of the announcement - required field
  title: { 
    type: String, 
    required: true,
    trim: true // Remove whitespace from both ends
  },
  // Main content/message of the announcement
  message: { 
    type: String, 
    required: true 
  },
  // Category/tag for filtering announcements
  tag: { 
    type: String, 
    required: true,
    enum: ALLOWED_TAGS, // Only allow predefined tags
    lowercase: true // Convert to lowercase before saving
  },
  // Add attachment fields
  attachments: [{
    type: {
      type: String,
      enum: ['photo', 'document', 'video'],
      required: true
    },
    fileId: {
      type: String,
      required: true
    }
  }],
  // Reference to admin who created the announcement
  createdBy: { 
    type: String, 
    required: true 
  },
  // Timestamp of creation
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true // Add index for better query performance
  }
});

// Add index for faster sorting and querying
announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema); 