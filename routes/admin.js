const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { autoriser } = require('../middleware/auth');

router.use(autoriser('administrateur'));

router.get('/dashboard', ctrl.dashboard);
router.get('/utilisateurs', ctrl.getUtilisateurs);
router.get('/utilisateurs/nouveau', ctrl.getFormUtilisateur);
router.get('/utilisateurs/:id/modifier', ctrl.getFormUtilisateur);
router.post('/utilisateurs', ctrl.creerUtilisateur);
router.put('/utilisateurs/:id', ctrl.modifierUtilisateur);
router.delete('/utilisateurs/:id', ctrl.supprimerUtilisateur);
router.get('/ventes', ctrl.getVentes);
router.get('/stock', ctrl.getStock);
router.get('/fournisseurs', ctrl.getFournisseurs);

router.get('/parametres', ctrl.getConfiguration);
router.post('/parametres', ctrl.updateConfiguration);

module.exports = router;
