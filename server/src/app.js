require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

const authRoutes    = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const userRoutes    = require('./routes/users');

const app = express();

// Behind Vercel's proxy: without this, req.ip is the proxy's address and
// express-rate-limit buckets every visitor together.
app.set('trust proxy', 1);

// ── Security middleware ───────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Global rate limit: 200 req / 15 min per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ── Routes ────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users',    userRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ── Error handler ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
