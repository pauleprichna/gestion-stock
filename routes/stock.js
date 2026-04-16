const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockController');
const { autoriser } = require('../middleware/auth');
const log = require('../middleware/logger');

router.use(autoriser('gestionnaire_stock'));

router.get('/dashboard', ctrl.dashboard);
router.get('/voir-stock', ctrl.voirStock);
router.get('/mouvements', ctrl.getMouvements);
router.post('/mouvements', log('MOUVEMENT_STOCK', 'Enregistrement mouvement stock'), ctrl.creerMouvement);
router.get('/alertes', ctrl.getAlertes);
router.get('/commandes', ctrl.getCommandes);
router.post('/commandes', log('CREATION_COMMANDE', 'Création commande appro'), ctrl.creerCommande);
router.put('/commandes/:id/annuler', log('ANNULATION_COMMANDE', 'Annulation commande'), ctrl.annulerCommande);
router.get('/fournisseurs', ctrl.getFournisseurs);
router.get('/rapport', ctrl.getRapport);
router.get('/nouvelle-vente', ctrl.getNouvelleVente);
router.post('/ventes', log('VENTE', 'Vente en espèces enregistrée'), ctrl.enregistrerVente);
router.get('/recu/:id', ctrl.getRecu);
router.get('/historique-ventes', ctrl.getHistoriqueVentes);

module.exports = router;
