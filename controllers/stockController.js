const pool = require('../config/db');

exports.dashboard = async (req, res) => {
    try {
        const produits = await pool.query('SELECT COUNT(*) FROM produits');
        const alertes = await pool.query('SELECT COUNT(*) FROM produits WHERE quantite_stock <= seuil_alerte');
        const mouvements = await pool.query('SELECT COUNT(*) FROM mouvements_stock');
        const commandes = await pool.query("SELECT COUNT(*) FROM commandes WHERE statut != 'annulee'");

        // Stats ventes du gestionnaire connecté
        const ventesAujourd = await pool.query(
            "SELECT COUNT(*) FROM ventes WHERE vendeur_id=$1 AND DATE(date_vente)=CURRENT_DATE",
            [req.session.user.id]);
        const caAujourd = await pool.query(
            "SELECT COALESCE(SUM(montant_total),0) AS total FROM ventes WHERE vendeur_id=$1 AND DATE(date_vente)=CURRENT_DATE",
            [req.session.user.id]);
        const ventesTotal = await pool.query(
            "SELECT COUNT(*) FROM ventes WHERE vendeur_id=$1",
            [req.session.user.id]);
        const caTotal = await pool.query(
            "SELECT COALESCE(SUM(montant_total),0) AS total FROM ventes WHERE vendeur_id=$1",
            [req.session.user.id]);

        res.render('stock/dashboard', {
            title: 'Dashboard Stock',
            stats: {
                produits: produits.rows[0].count,
                alertes: alertes.rows[0].count,
                mouvements: mouvements.rows[0].count,
                commandes: commandes.rows[0].count,
                ventesAujourd: ventesAujourd.rows[0].count,
                caAujourd: parseFloat(caAujourd.rows[0].total).toLocaleString('fr-FR'),
                ventesTotal: ventesTotal.rows[0].count,
                caTotal: parseFloat(caTotal.rows[0].total).toLocaleString('fr-FR')
            }
        });
    } catch (err) {
        console.error(err);
        res.render('stock/dashboard', { title: 'Dashboard Stock', stats: {} });
    }
};

exports.voirStock = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, c.nom AS categorie_nom 
            FROM produits p 
            LEFT JOIN categories c ON p.categorie_id = c.id 
            ORDER BY p.nom ASC`);
        res.render('stock/voir-stock', { title: 'Voir le Stock', produits: result.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement stock');
        res.redirect('/stock/dashboard');
    }
};

exports.getMouvements = async (req, res) => {
    const result = await pool.query(`
        SELECT m.*, p.nom AS produit_nom, u.nom AS user_nom, u.prenom AS user_prenom
        FROM mouvements_stock m
        JOIN produits p ON m.produit_id = p.id
        LEFT JOIN utilisateurs u ON m.effectue_par = u.id
        ORDER BY m.date_mouvement DESC`);
    const produits = await pool.query('SELECT id, nom, quantite_stock FROM produits ORDER BY nom');
    res.render('stock/mouvements', { title: 'Mouvements de Stock', mouvements: result.rows, produits: produits.rows });
};

exports.creerMouvement = async (req, res) => {
    const { type, quantite, motif, produit_id } = req.body;
    try {
        await pool.query('INSERT INTO mouvements_stock (type, quantite, motif, produit_id, effectue_par) VALUES ($1,$2,$3,$4,$5)',
            [type, quantite, motif, produit_id, req.session.user.id]);
        if (type === 'entree') {
            await pool.query('UPDATE produits SET quantite_stock = quantite_stock + $1 WHERE id = $2', [quantite, produit_id]);
        } else {
            await pool.query('UPDATE produits SET quantite_stock = quantite_stock - $1 WHERE id = $2', [quantite, produit_id]);
        }
        req.flash('success', 'Mouvement enregistré');
    } catch (err) {
        req.flash('error', 'Erreur enregistrement mouvement');
    }
    res.redirect('/stock/mouvements');
};

exports.getAlertes = async (req, res) => {
    const result = await pool.query(`
        SELECT p.*, c.nom AS categorie_nom 
        FROM produits p 
        LEFT JOIN categories c ON p.categorie_id = c.id 
        WHERE p.quantite_stock <= p.seuil_alerte 
        ORDER BY p.quantite_stock ASC`);
    res.render('stock/alertes', { title: 'Alertes Stock', produits: result.rows });
};

exports.getCommandes = async (req, res) => {
    try {
        const commandes = await pool.query(`
            SELECT c.*, u.nom AS fournisseur_nom, u.prenom AS fournisseur_prenom
            FROM commandes c
            LEFT JOIN utilisateurs u ON c.fournisseur_id = u.id
            ORDER BY c.date_commande DESC`);
        const fournisseurs = await pool.query("SELECT id, nom, prenom FROM utilisateurs WHERE role = 'fournisseur' AND actif = TRUE");
        const produits = await pool.query('SELECT id, nom, prix FROM produits ORDER BY nom');
        res.render('stock/commandes', { title: 'Commandes Appro', commandes: commandes.rows, fournisseurs: fournisseurs.rows, produits: produits.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement commandes');
        res.redirect('/stock/dashboard');
    }
};

exports.creerCommande = async (req, res) => {
    const { fournisseur_id, date_livraison_prevue, produit_ids, quantites, prix_unitaires } = req.body;
    try {
        const reference = 'CMD-' + Date.now();
        const cmdResult = await pool.query(
            'INSERT INTO commandes (reference, fournisseur_id, cree_par, date_livraison_prevue) VALUES ($1,$2,$3,$4) RETURNING id',
            [reference, fournisseur_id, req.session.user.id, date_livraison_prevue || null]
        );
        const commandeId = cmdResult.rows[0].id;
        const ids = Array.isArray(produit_ids) ? produit_ids : [produit_ids];
        const qtes = Array.isArray(quantites) ? quantites : [quantites];
        const prix = Array.isArray(prix_unitaires) ? prix_unitaires : [prix_unitaires];
        for (let i = 0; i < ids.length; i++) {
            await pool.query(
                'INSERT INTO lignes_commande (commande_id, produit_id, quantite, prix_unitaire) VALUES ($1,$2,$3,$4)',
                [commandeId, ids[i], qtes[i], prix[i]]
            );
        }
        req.flash('success', `Commande ${reference} créée`);
    } catch (err) {
        req.flash('error', 'Erreur création commande');
    }
    res.redirect('/stock/commandes');
};

exports.annulerCommande = async (req, res) => {
    try {
        await pool.query("UPDATE commandes SET statut = 'annulee' WHERE id = $1", [req.params.id]);
        req.flash('success', 'Commande annulée');
    } catch (err) {
        req.flash('error', 'Erreur annulation');
    }
    res.redirect('/stock/commandes');
};

exports.getFournisseurs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.*, COUNT(c.id) AS nb_commandes
            FROM utilisateurs u
            LEFT JOIN commandes c ON c.fournisseur_id = u.id
            WHERE u.role = 'fournisseur'
            GROUP BY u.id
            ORDER BY u.nom ASC`);
        res.render('stock/fournisseurs', { title: 'Consulter Fournisseurs', fournisseurs: result.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement fournisseurs');
        res.redirect('/stock/dashboard');
    }
};

exports.getRapport = async (req, res) => {
    try {
        const produits = await pool.query(`
            SELECT p.*, c.nom AS categorie_nom 
            FROM produits p 
            LEFT JOIN categories c ON p.categorie_id = c.id 
            ORDER BY c.nom, p.nom`);
        const mouvements = await pool.query(`
            SELECT m.type, SUM(m.quantite) AS total
            FROM mouvements_stock m GROUP BY m.type`);
        const alertes = await pool.query('SELECT COUNT(*) FROM produits WHERE quantite_stock <= seuil_alerte');
        const valeurStock = await pool.query('SELECT SUM(quantite_stock * prix) AS valeur_totale FROM produits');
        res.render('stock/rapport', {
            title: 'Rapport Stock',
            produits: produits.rows,
            mouvements: mouvements.rows,
            alertes: alertes.rows[0].count,
            valeurTotale: valeurStock.rows[0].valeur_totale || 0,
            dateRapport: new Date().toLocaleDateString('fr-FR')
        });
    } catch (err) {
        req.flash('error', 'Erreur génération rapport');
        res.redirect('/stock/dashboard');
    }
};

exports.getNouvelleVente = async (req, res) => {
    try {
        const produits = await pool.query(`
            SELECT p.*, c.nom AS categorie_nom 
            FROM produits p 
            LEFT JOIN categories c ON p.categorie_id = c.id
            WHERE p.quantite_stock > 0
            ORDER BY p.nom ASC`);
        res.render('stock/nouvelle-vente', { title: 'Nouvelle Vente', produits: produits.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement produits');
        res.redirect('/stock/dashboard');
    }
};

exports.enregistrerVente = async (req, res) => {
    const { montant_recu, produit_ids, quantites, prix_unitaires } = req.body;
    try {
        const ids = Array.isArray(produit_ids) ? produit_ids : [produit_ids];
        const qtes = Array.isArray(quantites) ? quantites : [quantites];
        const prix = Array.isArray(prix_unitaires) ? prix_unitaires : [prix_unitaires];

        let montant_total = 0;
        for (let i = 0; i < ids.length; i++) {
            montant_total += parseFloat(prix[i]) * parseInt(qtes[i]);
        }

        const monnaie_rendue = parseFloat(montant_recu) - montant_total;
        if (monnaie_rendue < 0) {
            req.flash('error', 'Montant reçu insuffisant !');
            return res.redirect('/stock/nouvelle-vente');
        }

        const reference = 'VTE-' + Date.now();

        const venteResult = await pool.query(
            'INSERT INTO ventes (reference, montant_total, montant_recu, monnaie_rendue, vendeur_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
            [reference, montant_total, montant_recu, monnaie_rendue, req.session.user.id]
        );
        const venteId = venteResult.rows[0].id;

        for (let i = 0; i < ids.length; i++) {
            const sous_total = parseFloat(prix[i]) * parseInt(qtes[i]);
            await pool.query(
                'INSERT INTO lignes_vente (vente_id, produit_id, quantite, prix_unitaire, sous_total) VALUES ($1,$2,$3,$4,$5)',
                [venteId, ids[i], qtes[i], prix[i], sous_total]
            );
            await pool.query(
                'UPDATE produits SET quantite_stock = quantite_stock - $1 WHERE id = $2',
                [qtes[i], ids[i]]
            );
            await pool.query(
                "INSERT INTO mouvements_stock (type, quantite, motif, produit_id, effectue_par) VALUES ('sortie',$1,$2,$3,$4)",
                [qtes[i], 'Vente espèces - ' + reference, ids[i], req.session.user.id]
            );
        }

        res.redirect('/stock/recu/' + venteId);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la vente : ' + err.message);
        res.redirect('/stock/nouvelle-vente');
    }
};

exports.getRecu = async (req, res) => {
    try {
        const vente = await pool.query(`
            SELECT v.*, u.nom AS vendeur_nom, u.prenom AS vendeur_prenom
            FROM ventes v
            LEFT JOIN utilisateurs u ON v.vendeur_id = u.id
            WHERE v.id = $1`, [req.params.id]);
        const lignes = await pool.query(`
            SELECT lv.*, p.nom AS produit_nom
            FROM lignes_vente lv
            JOIN produits p ON lv.produit_id = p.id
            WHERE lv.vente_id = $1`, [req.params.id]);
        if (vente.rows.length === 0) {
            req.flash('error', 'Vente introuvable');
            return res.redirect('/stock/historique-ventes');
        }
        res.render('stock/recu', { title: 'Reçu de Vente', vente: vente.rows[0], lignes: lignes.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement reçu');
        res.redirect('/stock/historique-ventes');
    }
};

exports.getHistoriqueVentes = async (req, res) => {
    try {
        const ventes = await pool.query(`
            SELECT v.*, u.nom AS vendeur_nom, u.prenom AS vendeur_prenom,
                   COUNT(lv.id) AS nb_articles
            FROM ventes v
            LEFT JOIN utilisateurs u ON v.vendeur_id = u.id
            LEFT JOIN lignes_vente lv ON lv.vente_id = v.id
            WHERE v.vendeur_id = $1
            GROUP BY v.id, u.nom, u.prenom
            ORDER BY v.date_vente DESC`, [req.session.user.id]);
        res.render('stock/historique-ventes', { title: 'Historique Ventes', ventes: ventes.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement historique');
        res.redirect('/stock/dashboard');
    }
};
