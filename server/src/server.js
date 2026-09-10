// Local / long-lived-host entry point. Vercel uses api/index.js instead.
require('dotenv').config();

const app       = require('./app');
const connectDB = require('./db');

const PORT = process.env.PORT || 5002;

connectDB()
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🥊 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
