const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boutiqueController');

router.get('/', ctrl.getAccueil);
router.post('/valider-achat', ctrl.validerAchat);

module.exports = router;
