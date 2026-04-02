const pool = require('../config/db');

exports.dashboard = async (req, res) => {
    try {
        const commandes = await pool.query(
            'SELECT COUNT(*) FROM commandes WHERE fournisseur_id = $1',
            [req.session.user.id]);
        const enAttente = await pool.query(
            "SELECT COUNT(*) FROM commandes WHERE fournisseur_id=$1 AND statut='en_attente'",
            [req.session.user.id]);
        const livrees = await pool.query(
            "SELECT COUNT(*) FROM commandes WHERE fournisseur_id=$1 AND statut='livree'",
            [req.session.user.id]);
        res.render('fournisseur/dashboard', {
            title: 'Dashboard Fournisseur',
            stats: {
                commandes: commandes.rows[0].count,
                enAttente: enAttente.rows[0].count,
                livrees: livrees.rows[0].count
            }
        });
    } catch (err) {
        res.render('fournisseur/dashboard', { title: 'Dashboard Fournisseur', stats: {} });
    }
};

exports.getCommandes = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, u.nom AS createur_nom, u.prenom AS createur_prenom
            FROM commandes c
            LEFT JOIN utilisateurs u ON c.cree_par = u.id
            WHERE c.fournisseur_id = $1
            ORDER BY c.date_commande DESC`, [req.session.user.id]);

        const commandes = [];
        for (const cmd of result.rows) {
            const lignes = await pool.query(`
                SELECT lc.*, p.nom AS produit_nom
                FROM lignes_commande lc
                JOIN produits p ON lc.produit_id = p.id
                WHERE lc.commande_id = $1`, [cmd.id]);
            commandes.push({ ...cmd, lignes: lignes.rows || [] });
        }

        res.render('fournisseur/commandes', {
            title: 'Mes Commandes',
            commandes
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur chargement commandes');
        res.redirect('/fournisseur/dashboard');
    }
};

exports.fournirCommande = async (req, res) => {
    const { id } = req.params;
    try {
        const cmd = await pool.query(
            "SELECT * FROM commandes WHERE id=$1 AND fournisseur_id=$2 AND statut='en_attente'",
            [id, req.session.user.id]);

        if (cmd.rows.length === 0) {
            req.flash('error', 'Commande introuvable ou déjà traitée');
            return res.redirect('/fournisseur/commandes');
        }

        const lignes = await pool.query(
            'SELECT * FROM lignes_commande WHERE commande_id = $1', [id]);

        for (const ligne of lignes.rows) {
            await pool.query(
                'UPDATE produits SET quantite_stock = quantite_stock + $1 WHERE id = $2',
                [ligne.quantite, ligne.produit_id]);

            await pool.query(
                "INSERT INTO mouvements_stock (type, quantite, motif, produit_id, effectue_par) VALUES ('entree',$1,$2,$3,$4)",
                [ligne.quantite, 'Livraison commande - ' + cmd.rows[0].reference, ligne.produit_id, req.session.user.id]);
        }

        await pool.query("UPDATE commandes SET statut='livree' WHERE id=$1", [id]);

        req.flash('success', 'Commande fournie ! Le stock a été mis à jour.');
        res.redirect('/fournisseur/commandes');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la livraison');
        res.redirect('/fournisseur/commandes');
    }
};

exports.consulterGestionnaireStock = async (req, res) => {
    try {
        const gestionnaires = await pool.query(`
            SELECT id, nom, prenom, email 
            FROM utilisateurs 
            WHERE role = 'gestionnaire_stock' AND actif = TRUE`);
        res.render('fournisseur/gestionnaire-stock', {
            title: 'Consulter Gestionnaire Stock',
            gestionnaires: gestionnaires.rows
        });
    } catch (err) {
        req.flash('error', 'Erreur');
        res.redirect('/fournisseur/dashboard');
    }
};
