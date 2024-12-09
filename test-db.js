require('dotenv').config();
const mongoose = require('mongoose');

// Fix mongoose deprecation warning
mongoose.set('strictQuery', false);

console.log('🔌 Attempting to connect to MongoDB...');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Successfully connected to MongoDB.');
  process.exit(0);
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
}); 