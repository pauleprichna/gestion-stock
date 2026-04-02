const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/profilController');
const { estConnecte } = require('../middleware/auth');

router.use(estConnecte);
router.get('/', ctrl.getProfil);
router.post('/', ctrl.updateProfil);

module.exports = router;
