const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vendeurController');
const { autoriser } = require('../middleware/auth');

router.use(autoriser('vendeur'));

router.get('/dashboard', ctrl.dashboard);
router.get('/nouvelle-vente', ctrl.getNouvelleVente);
router.post('/ventes', ctrl.enregistrerVente);
router.get('/recu/:id', ctrl.getRecu);
router.get('/historique', ctrl.getHistorique);

module.exports = router;
