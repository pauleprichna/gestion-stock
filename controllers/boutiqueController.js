const pool = require('../config/db');

exports.getAccueil = async (req, res) => {
    try {
        const produits = await pool.query(`
            SELECT p.*, c.nom AS categorie_nom,
                pr.type AS promo_type,
                pr.valeur AS promo_valeur,
                pr.nom AS promo_nom,
                CASE 
                    WHEN pr.type = 'pourcentage' THEN ROUND(p.prix - (p.prix * pr.valeur / 100), 2)
                    WHEN pr.type = 'montant' THEN p.prix - pr.valeur
                    ELSE p.prix
                END AS prix_promo
            FROM produits p
            LEFT JOIN categories c ON p.categorie_id = c.id
            LEFT JOIN promotions pr ON (
                (pr.produit_id = p.id OR pr.categorie_id = p.categorie_id)
                AND pr.actif = TRUE
                AND pr.date_debut <= CURRENT_DATE
                AND pr.date_fin >= CURRENT_DATE
            )
            WHERE p.quantite_stock > 0
            ORDER BY p.nom ASC`);

        const categories = await pool.query('SELECT * FROM categories ORDER BY nom');
        res.render('boutique/accueil', {
            title: 'Boutique',
            produits: produits.rows,
            categories: categories.rows
        });
    } catch (err) {
        console.error(err);
        res.render('boutique/accueil', { title: 'Boutique', produits: [], categories: [] });
    }
};

exports.validerAchat = async (req, res) => {
    console.log('BODY ACHAT:', req.body);
    const { montant_recu, produit_ids, quantites, prix_unitaires } = req.body || {};

    if (!produit_ids) {
        return res.json({ success: false, message: 'Panier vide' });
    }

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
            return res.json({ success: false, message: 'Montant insuffisant !' });
        }

        const reference = 'VTE-' + Date.now();

        const gestionnaire = await pool.query(
            "SELECT id FROM utilisateurs WHERE role='gestionnaire_stock' AND actif=TRUE LIMIT 1");
        const vendeurId = gestionnaire.rows.length > 0 ? gestionnaire.rows[0].id : null;

        const venteResult = await pool.query(
            'INSERT INTO ventes (reference, montant_total, montant_recu, monnaie_rendue, vendeur_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
            [reference, montant_total, montant_recu, monnaie_rendue, vendeurId]
        );
        const venteId = venteResult.rows[0].id;

        const lignes = [];
        for (let i = 0; i < ids.length; i++) {
            const sous_total = parseFloat(prix[i]) * parseInt(qtes[i]);

            const stock = await pool.query('SELECT nom, quantite_stock FROM produits WHERE id=$1', [ids[i]]);
            if (stock.rows[0].quantite_stock < parseInt(qtes[i])) {
                return res.json({ success: false, message: `Stock insuffisant pour ${stock.rows[0].nom}` });
            }

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
                [qtes[i], 'Vente boutique - ' + reference, ids[i], vendeurId]
            );

            lignes.push({
                nom: stock.rows[0].nom,
                quantite: qtes[i],
                prix_unitaire: prix[i],
                sous_total
            });
        }

        res.json({
            success: true,
            reference,
            montant_total,
            montant_recu: parseFloat(montant_recu),
            monnaie_rendue,
            lignes
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'Erreur lors du paiement' });
    }
};
