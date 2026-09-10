const router = require('express').Router();
const auth   = require('../middleware/auth');
const {
  getSessions, getSession, createSession,
  deleteSession, getProgress, getCoaching,
} = require('../controllers/sessionController');

router.use(auth); // all session routes require auth

router.get('/',               getSessions);
router.get('/stats/progress', getProgress);
router.get('/:id',            getSession);
router.post('/',              createSession);
router.post('/coaching',      getCoaching);
router.delete('/:id',         deleteSession);

module.exports = router;
