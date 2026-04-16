const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const log = require('../middleware/logger');

router.get('/login', auth.getLogin);
router.post('/login', auth.postLogin);
router.get('/logout', log('DECONNEXION', 'Utilisateur déconnecté'), auth.logout);

module.exports = router;
