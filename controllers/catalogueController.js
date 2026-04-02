const pool = require('../config/db');

exports.upload = (req, res, next) => next();

exports.dashboard = async (req, res) => {
    try {
        const categories = await pool.query('SELECT COUNT(*) FROM categories');
        const produits = await pool.query('SELECT COUNT(*) FROM produits');
        const promos = await pool.query("SELECT COUNT(*) FROM promotions WHERE actif=TRUE AND date_fin >= CURRENT_DATE");
        res.render('catalogue/dashboard', {
            title: 'Dashboard Catalogue',
            stats: {
                categories: categories.rows[0].count,
                produits: produits.rows[0].count,
                promos: promos.rows[0].count
            }
        });
    } catch (err) {
        res.render('catalogue/dashboard', { title: 'Dashboard Catalogue', stats: {} });
    }
};

exports.getCategories = async (req, res) => {
    const result = await pool.query('SELECT * FROM categories ORDER BY date_creation DESC');
    res.render('catalogue/categories', { title: 'Catégories', categories: result.rows });
};

exports.creerCategorie = async (req, res) => {
    const { nom, description } = req.body;
    try {
        await pool.query('INSERT INTO categories (nom, description, creee_par) VALUES ($1,$2,$3)',
            [nom, description, req.session.user.id]);
        req.flash('success', 'Catégorie créée');
    } catch (err) {
        req.flash('error', 'Erreur création catégorie');
    }
    res.redirect('/catalogue/categories');
};

exports.supprimerCategorie = async (req, res) => {
    await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    req.flash('success', 'Catégorie supprimée');
    res.redirect('/catalogue/categories');
};

exports.getProduits = async (req, res) => {
    const result = await pool.query(`
        SELECT p.*, c.nom AS categorie_nom 
        FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id 
        ORDER BY p.date_creation DESC`);
    const categories = await pool.query('SELECT * FROM categories');
    res.render('catalogue/produits', {
        title: 'Produits',
        produits: result.rows,
        categories: categories.rows
    });
};

exports.getFormProduit = async (req, res) => {
    const { id } = req.params;
    const categories = await pool.query('SELECT * FROM categories ORDER BY nom');
    if (id) {
        const result = await pool.query('SELECT * FROM produits WHERE id=$1', [id]);
        res.render('catalogue/form-produit', { title: 'Modifier Produit', produit: result.rows[0], categories: categories.rows });
    } else {
        res.render('catalogue/form-produit', { title: 'Nouveau Produit', produit: null, categories: categories.rows });
    }
};

exports.creerProduit = async (req, res) => {
    const { nom, description, prix, quantite_stock, seuil_alerte, categorie_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO produits (nom, description, prix, quantite_stock, seuil_alerte, categorie_id, cree_par) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [nom, description || null, prix, quantite_stock || 0, seuil_alerte || 5, categorie_id || null, req.session.user.id]
        );
        req.flash('success', 'Produit créé');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur création produit');
    }
    res.redirect('/catalogue/produits');
};

exports.modifierProduit = async (req, res) => {
    const { id } = req.params;
    const { nom, description, prix, seuil_alerte, categorie_id } = req.body;
    try {
        await pool.query(
            'UPDATE produits SET nom=$1, description=$2, prix=$3, seuil_alerte=$4, categorie_id=$5 WHERE id=$6',
            [nom, description || null, prix, seuil_alerte || 5, categorie_id || null, id]
        );
        req.flash('success', 'Produit modifié');
    } catch (err) {
        req.flash('error', 'Erreur modification');
    }
    res.redirect('/catalogue/produits');
};

exports.supprimerProduit = async (req, res) => {
    try {
        await pool.query('DELETE FROM produits WHERE id=$1', [req.params.id]);
        req.flash('success', 'Produit supprimé');
    } catch (err) {
        req.flash('error', 'Erreur suppression');
    }
    res.redirect('/catalogue/produits');
};

// ===================== PROMOTIONS =====================

exports.getPromotions = async (req, res) => {
    try {
        const promos = await pool.query(`
            SELECT pr.*, 
                   p.nom AS produit_nom,
                   c.nom AS categorie_nom
            FROM promotions pr
            LEFT JOIN produits p ON pr.produit_id = p.id
            LEFT JOIN categories c ON pr.categorie_id = c.id
            ORDER BY pr.date_creation DESC`);
        const produits = await pool.query('SELECT id, nom FROM produits ORDER BY nom');
        const categories = await pool.query('SELECT id, nom FROM categories ORDER BY nom');
        res.render('catalogue/promotions', {
            title: 'Promotions',
            promos: promos.rows,
            produits: produits.rows,
            categories: categories.rows
        });
    } catch (err) {
        req.flash('error', 'Erreur chargement promotions');
        res.redirect('/catalogue/dashboard');
    }
};

exports.creerPromotion = async (req, res) => {
    const { nom, type, valeur, produit_id, categorie_id, date_debut, date_fin } = req.body;
    try {
        await pool.query(
            'INSERT INTO promotions (nom, type, valeur, produit_id, categorie_id, date_debut, date_fin, cree_par) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [nom, type, valeur, produit_id || null, categorie_id || null, date_debut, date_fin, req.session.user.id]
        );
        req.flash('success', 'Promotion créée avec succès');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur création promotion');
    }
    res.redirect('/catalogue/promotions');
};

exports.togglePromotion = async (req, res) => {
    try {
        await pool.query('UPDATE promotions SET actif = NOT actif WHERE id=$1', [req.params.id]);
        req.flash('success', 'Statut promotion modifié');
    } catch (err) {
        req.flash('error', 'Erreur');
    }
    res.redirect('/catalogue/promotions');
};

exports.supprimerPromotion = async (req, res) => {
    try {
        await pool.query('DELETE FROM promotions WHERE id=$1', [req.params.id]);
        req.flash('success', 'Promotion supprimée');
    } catch (err) {
        req.flash('error', 'Erreur suppression');
    }
    res.redirect('/catalogue/promotions');
};
