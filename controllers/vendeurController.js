const pool = require('../config/db');

// DASHBOARD
exports.dashboard = async (req, res) => {
    try {
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
        res.render('vendeur/dashboard', {
            title: 'Dashboard Vendeur',
            stats: {
                ventesAujourd: ventesAujourd.rows[0].count,
                caAujourd: parseFloat(caAujourd.rows[0].total).toLocaleString('fr-FR'),
                ventesTotal: ventesTotal.rows[0].count,
                caTotal: parseFloat(caTotal.rows[0].total).toLocaleString('fr-FR')
            }
        });
    } catch (err) {
        console.error(err);
        res.render('vendeur/dashboard', { title: 'Dashboard Vendeur', stats: {} });
    }
};

// NOUVELLE VENTE - formulaire
exports.getNouvelleVente = async (req, res) => {
    try {
        const produits = await pool.query(`
            SELECT p.*, c.nom AS categorie_nom 
            FROM produits p 
            LEFT JOIN categories c ON p.categorie_id = c.id
            WHERE p.quantite_stock > 0
            ORDER BY p.nom ASC`);
        res.render('vendeur/nouvelle-vente', { title: 'Nouvelle Vente', produits: produits.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement produits');
        res.redirect('/vendeur/dashboard');
    }
};

// ENREGISTRER UNE VENTE
exports.enregistrerVente = async (req, res) => {
    const { montant_recu, produit_ids, quantites, prix_unitaires } = req.body;
    try {
        const ids = Array.isArray(produit_ids) ? produit_ids : [produit_ids];
        const qtes = Array.isArray(quantites) ? quantites : [quantites];
        const prix = Array.isArray(prix_unitaires) ? prix_unitaires : [prix_unitaires];

        // Calcul montant total
        let montant_total = 0;
        for (let i = 0; i < ids.length; i++) {
            montant_total += parseFloat(prix[i]) * parseInt(qtes[i]);
        }

        const monnaie_rendue = parseFloat(montant_recu) - montant_total;
        if (monnaie_rendue < 0) {
            req.flash('error', 'Montant reçu insuffisant !');
            return res.redirect('/vendeur/nouvelle-vente');
        }

        const reference = 'VTE-' + Date.now();

        // Créer la vente
        const venteResult = await pool.query(
            'INSERT INTO ventes (reference, montant_total, montant_recu, monnaie_rendue, vendeur_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
            [reference, montant_total, montant_recu, monnaie_rendue, req.session.user.id]
        );
        const venteId = venteResult.rows[0].id;

        // Créer les lignes et mettre à jour le stock
        for (let i = 0; i < ids.length; i++) {
            const sous_total = parseFloat(prix[i]) * parseInt(qtes[i]);
            await pool.query(
                'INSERT INTO lignes_vente (vente_id, produit_id, quantite, prix_unitaire, sous_total) VALUES ($1,$2,$3,$4,$5)',
                [venteId, ids[i], qtes[i], prix[i], sous_total]
            );
            // Déduire du stock
            await pool.query(
                'UPDATE produits SET quantite_stock = quantite_stock - $1 WHERE id = $2',
                [qtes[i], ids[i]]
            );
            // Enregistrer mouvement sortie
            await pool.query(
                "INSERT INTO mouvements_stock (type, quantite, motif, produit_id, effectue_par) VALUES ('sortie',$1,'Vente en espèces - '||$2,$3,$4)",
                [qtes[i], reference, ids[i], req.session.user.id]
            );
        }

        // Rediriger vers le reçu
        res.redirect('/vendeur/recu/' + venteId);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la vente : ' + err.message);
        res.redirect('/vendeur/nouvelle-vente');
    }
};

// REÇU DE VENTE
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
            return res.redirect('/vendeur/historique');
        }

        res.render('vendeur/recu', {
            title: 'Reçu de Vente',
            vente: vente.rows[0],
            lignes: lignes.rows
        });
    } catch (err) {
        req.flash('error', 'Erreur chargement reçu');
        res.redirect('/vendeur/historique');
    }
};

// HISTORIQUE DES VENTES
exports.getHistorique = async (req, res) => {
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
        res.render('vendeur/historique', { title: 'Historique Ventes', ventes: ventes.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement historique');
        res.redirect('/vendeur/dashboard');
    }
};
