const mongoose = require('mongoose');

// Serverless instances freeze between invocations and get reused, so the
// connection is cached on `global`. Without this, every cold start opens a new
// pool and you exhaust the Atlas connection limit under trivial load.
const cached = global.__mongoose || (global.__mongoose = { conn: null, promise: null });

module.exports = async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        bufferCommands: false, // fail fast instead of queueing against a cold pool
        maxPoolSize: 10,       // one small pool per instance, not the default 100
      })
      // Don't let a failed attempt poison the cache — the next request retries.
      .catch(err => { cached.promise = null; throw err; });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};
