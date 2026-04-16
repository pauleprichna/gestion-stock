const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/catalogueController');
const { autoriser } = require('../middleware/auth');

router.use(autoriser('gestionnaire_catalogue'));

router.get('/dashboard', ctrl.dashboard);
router.get('/categories', ctrl.getCategories);
router.post('/categories', ctrl.creerCategorie);
router.put('/categories/:id', ctrl.modifierCategorie);
router.delete('/categories/:id', ctrl.supprimerCategorie);
router.get('/produits', ctrl.getProduits);
router.get('/produits/nouveau', ctrl.getFormProduit);
router.get('/produits/:id/modifier', ctrl.getFormProduit);
router.post('/produits', ctrl.upload, ctrl.creerProduit);
router.post('/produits/:id/modifier', ctrl.upload, ctrl.modifierProduit);
router.delete('/produits/:id', ctrl.supprimerProduit);
router.get('/promotions', ctrl.getPromotions);
router.post('/promotions', ctrl.creerPromotion);
router.post('/promotions/:id/toggle', ctrl.togglePromotion);
router.delete('/promotions/:id', ctrl.supprimerPromotion);

module.exports = router;
