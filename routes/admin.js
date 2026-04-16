const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { autoriser } = require('../middleware/auth');
const log = require('../middleware/logger');

router.use(autoriser('administrateur'));

router.get('/dashboard', ctrl.dashboard);
router.get('/utilisateurs', ctrl.getUtilisateurs);
router.get('/utilisateurs/nouveau', ctrl.getFormUtilisateur);
router.get('/utilisateurs/:id/modifier', ctrl.getFormUtilisateur);
router.post('/utilisateurs', log('CREATION_UTILISATEUR', 'Création utilisateur'), ctrl.creerUtilisateur);
router.put('/utilisateurs/:id', log('MODIFICATION_UTILISATEUR', 'Modification utilisateur'), ctrl.modifierUtilisateur);
router.delete('/utilisateurs/:id', log('SUPPRESSION_UTILISATEUR', 'Suppression utilisateur'), ctrl.supprimerUtilisateur);
router.get('/ventes', ctrl.getVentes);
router.get('/stock', ctrl.getStock);
router.get('/fournisseurs', ctrl.getFournisseurs);
router.get('/parametres', ctrl.getConfiguration);
router.post('/parametres', log('MODIFICATION_PARAMETRES', 'Modification paramètres système'), ctrl.updateConfiguration);
router.get('/logs', ctrl.getLogs);

module.exports = router;
