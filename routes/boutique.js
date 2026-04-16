const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boutiqueController');

router.get('/', ctrl.getAccueil);
router.post('/valider-achat', ctrl.validerAchat);

router.get('/', (req, res) => {
    res.render('boutique/accueil');
});

module.exports = router;
