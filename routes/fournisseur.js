const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fournisseurController');
const { autoriser } = require('../middleware/auth');

router.use(autoriser('fournisseur'));

router.get('/dashboard', ctrl.dashboard);
router.get('/commandes', ctrl.getCommandes);
router.post('/commandes/:id/fournir', ctrl.fournirCommande);
router.get('/gestionnaire-stock', ctrl.consulterGestionnaireStock);

module.exports = router;
