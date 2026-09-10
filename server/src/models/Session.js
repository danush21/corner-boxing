const mongoose = require('mongoose');

// Define message subdocument schema explicitly
const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  tag:  { type: String, default: 'COACH' },
  type: { type: String, default: 'coach' },
  ts:   { type: Number, default: () => Date.now() }
}, { _id: false });

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    durationSec: { type: Number, required: true },

    // Form scores (0-100 averages across entire session)
    avgGuard:    { type: Number, default: 0 },
    avgChin:     { type: Number, default: 0 },
    avgRotation: { type: Number, default: 0 },
    avgBalance:  { type: Number, default: 0 },

    // Punch counts
    punches: {
      jab:      { type: Number, default: 0 },
      cross:    { type: Number, default: 0 },
      hook:     { type: Number, default: 0 },
      uppercut: { type: Number, default: 0 },
    },

    // Combo name → hit count
    combos: {
      type: Map,
      of: Number,
      default: {},
    },

    // Coach messages logged during session
    messages: [messageSchema],
  },
  { timestamps: true }
);

// Virtual: total punches
sessionSchema.virtual('totalPunches').get(function () {
  const p = this.punches;
  return (p.jab || 0) + (p.cross || 0) + (p.hook || 0) + (p.uppercut || 0);
});

// Virtual: overall score
sessionSchema.virtual('overallScore').get(function () {
  return Math.round(
    (this.avgGuard + this.avgChin + this.avgRotation + this.avgBalance) / 4
  );
});

sessionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Session', sessionSchema);
