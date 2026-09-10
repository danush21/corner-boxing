const router = require('express').Router();
const auth   = require('../middleware/auth');
const { updateProfile, updateApiKey, updatePassword } = require('../controllers/userController');

router.use(auth);

router.patch('/profile',  updateProfile);
router.patch('/api-key',  updateApiKey);
router.patch('/password', updatePassword);

module.exports = router;
