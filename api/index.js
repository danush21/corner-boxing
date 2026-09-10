// Vercel serverless entry. Every invocation awaits the cached connection, then
// hands the request to the same Express app used locally.
const app       = require('../server/src/app');
const connectDB = require('../server/src/db');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    // A long-lived host would exit here; a function should just fail the request.
    console.error('MongoDB connection failed:', err.message);
    return res.status(503).json({ message: 'Database unavailable' });
  }
  return app(req, res);
};
