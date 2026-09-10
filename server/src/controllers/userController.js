const User = require('../models/User');

// PATCH /api/users/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, stance } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { ...(name && { name }), ...(stance && { stance }) },
      { new: true, runValidators: true }
    );
    res.json({ user: { id: user._id, name: user.name, email: user.email, stance: user.stance } });
  } catch (err) { next(err); }
};

// PATCH /api/users/api-key
exports.updateApiKey = async (req, res, next) => {
  try {
    const { apiKey } = req.body;
    await User.findByIdAndUpdate(req.user._id, { claudeApiKey: apiKey || null });
    res.json({ message: apiKey ? 'API key saved' : 'API key removed' });
  } catch (err) { next(err); }
};

// PATCH /api/users/password
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
};
