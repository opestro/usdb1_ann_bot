const validateAnnouncement = (data) => {
  const { title, message, tag } = data;

  if (!title || title.trim().length < 3) {
    return 'Title must be at least 3 characters long';
  }

  if (!message || message.trim().length < 10) {
    return 'Message must be at least 10 characters long';
  }

  const validTags = ['sports', 'academic', 'tech', 'events', 'general', 'important'];
  if (!tag || !validTags.includes(tag)) {
    return 'Invalid tag selected';
  }

  return null;
};

module.exports = { validateAnnouncement }; 