const Session = require('../models/Session');
const User    = require('../models/User');
const { callClaude } = require('../services/claudeService');

// GET /api/sessions
exports.getSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-messages'); // exclude heavy messages from list view

    res.json({ sessions });
  } catch (err) { next(err); }
};

// GET /api/sessions/:id
exports.getSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (err) { next(err); }
};

// POST /api/sessions
exports.createSession = async (req, res, next) => {
  try {
    console.log('Received session creation request:', req.body);
    
    const {
      durationSec, avgGuard, avgChin, avgRotation, avgBalance,
      punches, combos, messages,
    } = req.body;

    // Validate required fields
    if (!durationSec || typeof durationSec !== 'number') {
      console.error('Invalid durationSec:', durationSec);
      return res.status(400).json({ message: 'durationSec must be a number' });
    }

    // Ensure messages are properly formatted
    let formattedMessages = [];
    if (Array.isArray(messages)) {
      formattedMessages = messages.map(msg => {
        if (typeof msg === 'string') {
          return { text: msg, tag: 'COACH', type: 'coach', ts: Date.now() };
        }
        return {
          text: String(msg.text || ''),
          tag: String(msg.tag || 'COACH'),
          type: String(msg.type || 'coach'),
          ts: Number(msg.ts || Date.now())
        };
      });
    }

    // Ensure punches are numbers
    const validPunches = {
      jab: Number(punches?.jab) || 0,
      cross: Number(punches?.cross) || 0,
      hook: Number(punches?.hook) || 0,
      uppercut: Number(punches?.uppercut) || 0,
    };

    // Ensure combos are numbers
    const validCombos = {};
    if (typeof combos === 'object' && combos !== null) {
      for (const [key, val] of Object.entries(combos)) {
        validCombos[key] = Number(val) || 0;
      }
    }

    console.log('Creating session with:', {
      user: req.user._id,
      durationSec: Number(durationSec),
      avgGuard: Number(avgGuard) || 0,
      avgChin: Number(avgChin) || 0,
      avgRotation: Number(avgRotation) || 0,
      avgBalance: Number(avgBalance) || 0,
      punches: validPunches,
      combos: validCombos,
      messagesCount: formattedMessages.length,
    });

    const session = await Session.create({
      user: req.user._id,
      durationSec: Number(durationSec),
      avgGuard: Number(avgGuard) || 0,
      avgChin: Number(avgChin) || 0,
      avgRotation: Number(avgRotation) || 0,
      avgBalance: Number(avgBalance) || 0,
      punches: validPunches,
      combos: validCombos,
      messages: formattedMessages,
    });

    console.log('Session created successfully:', session._id);
    res.status(201).json({ session });
  } catch (err) {
    console.error('Session creation error:', err.message);
    console.error('Full error:', err);
    next(err);
  }
};

// DELETE /api/sessions/:id
exports.deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ message: 'Session deleted' });
  } catch (err) { next(err); }
};

// GET /api/sessions/stats/progress
exports.getProgress = async (req, res, next) => {
  try {
    const sessions = await Session.find({ user: req.user._id })
      .sort({ createdAt: 1 })
      .limit(20)
      .select('avgGuard avgChin avgRotation avgBalance punches combos durationSec createdAt');

    res.json({ sessions });
  } catch (err) { next(err); }
};

// POST /api/sessions/coaching
// Proxies a coaching request to Claude using the user's stored API key
exports.getCoaching = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+claudeApiKey');
    if (!user.claudeApiKey)
      return res.status(400).json({ message: 'No Claude API key on file. Add one in Settings.' });

    const { avgGuard, avgChin, avgRotation, avgBalance, punches, combos } = req.body;

    const prompt = `Session analysis:
- Guard score: ${avgGuard}/100
- Chin protection: ${avgChin}/100
- Shoulder rotation: ${avgRotation}/100
- Balance: ${avgBalance}/100
- Punches: ${punches.jab} jabs, ${punches.cross} crosses, ${punches.hook} hooks, ${punches.uppercut} uppercuts
- Combos landed: ${Object.entries(combos || {}).map(([k,v]) => `${k} x${v}`).join(', ') || 'none yet'}

What's the #1 thing they should focus on improving right now?`;

    const text = await callClaude(user.claudeApiKey, prompt);
    res.json({ coaching: text });
  } catch (err) { next(err); }
};
