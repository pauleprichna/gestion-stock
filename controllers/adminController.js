const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const sauvegarderPhoto = async (req) => {
    if (req.files && req.files.photo && req.files.photo.size > 0) {
        const file = req.files.photo;
        const ext = path.extname(file.name);
        const filename = 'user-' + Date.now() + ext;
        const uploadPath = path.join(__dirname, '../public/images/utilisateurs', filename);
        await file.mv(uploadPath);
        return '/images/utilisateurs/' + filename;
    }
    return null;
};

exports.dashboard = async (req, res) => {
    try {
        const users = await pool.query('SELECT COUNT(*) FROM utilisateurs');
        const produits = await pool.query('SELECT COUNT(*) FROM produits');
        const categories = await pool.query('SELECT COUNT(*) FROM categories');
        const commandes = await pool.query('SELECT COUNT(*) FROM commandes');
        const ventesJour = await pool.query("SELECT COUNT(*), COALESCE(SUM(montant_total),0) AS ca FROM ventes WHERE DATE(date_vente)=CURRENT_DATE");
        const ventesHebdo = await pool.query("SELECT COUNT(*), COALESCE(SUM(montant_total),0) AS ca FROM ventes WHERE date_vente >= CURRENT_DATE - INTERVAL '7 days'");
        const alertes = await pool.query('SELECT COUNT(*) FROM produits WHERE quantite_stock <= seuil_alerte');

        res.render('admin/dashboard', {
            title: 'Dashboard Admin',
            stats: {
                utilisateurs: users.rows[0].count,
                produits: produits.rows[0].count,
                categories: categories.rows[0].count,
                commandes: commandes.rows[0].count,
                ventesJour: ventesJour.rows[0].count,
                caJour: parseFloat(ventesJour.rows[0].ca).toLocaleString('fr-FR'),
                ventesHebdo: ventesHebdo.rows[0].count,
                caHebdo: parseFloat(ventesHebdo.rows[0].ca).toLocaleString('fr-FR'),
                alertes: alertes.rows[0].count
            }
        });
    } catch (err) {
        console.error(err);
        res.render('admin/dashboard', { title: 'Dashboard Admin', stats: {} });
    }
};

exports.getUtilisateurs = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM utilisateurs ORDER BY date_creation DESC');
        res.render('admin/utilisateurs', { title: 'Gestion Utilisateurs', utilisateurs: result.rows });
    } catch (err) {
        req.flash('error', 'Erreur chargement utilisateurs');
        res.redirect('/admin/dashboard');
    }
};

exports.getFormUtilisateur = (req, res) => {
    const { id } = req.params;
    if (id) {
        pool.query('SELECT * FROM utilisateurs WHERE id = $1', [id])
            .then(r => res.render('admin/form-utilisateur', { title: 'Modifier Utilisateur', utilisateur: r.rows[0] }))
            .catch(() => res.redirect('/admin/utilisateurs'));
    } else {
        res.render('admin/form-utilisateur', { title: 'Nouvel Utilisateur', utilisateur: null });
    }
};

exports.creerUtilisateur = async (req, res) => {
    const { nom, prenom, email, mot_de_passe, role, telephone } = req.body;
    try {
        const photo = await sauvegarderPhoto(req);
        const hash = await bcrypt.hash(mot_de_passe, 10);
        await pool.query(
            'INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, telephone, photo) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [nom, prenom, email, hash, role, telephone || null, photo]
        );
        req.flash('success', 'Utilisateur créé avec succès');
        res.redirect('/admin/utilisateurs');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur lors de la création');
        res.redirect('/admin/utilisateurs/nouveau');
    }
};

exports.modifierUtilisateur = async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, email, role, actif, telephone } = req.body;
    try {
        const photo = await sauvegarderPhoto(req);

        if (photo) {
            // Supprimer ancienne photo
            const old = await pool.query('SELECT photo FROM utilisateurs WHERE id=$1', [id]);
            if (old.rows[0] && old.rows[0].photo) {
                const oldPath = path.join(__dirname, '../public', old.rows[0].photo);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            await pool.query(
                'UPDATE utilisateurs SET nom=$1, prenom=$2, email=$3, role=$4, actif=$5, telephone=$6, photo=$7 WHERE id=$8',
                [nom, prenom, email, role, actif === 'on', telephone || null, photo, id]
            );
        } else {
            await pool.query(
                'UPDATE utilisateurs SET nom=$1, prenom=$2, email=$3, role=$4, actif=$5, telephone=$6 WHERE id=$7',
                [nom, prenom, email, role, actif === 'on', telephone || null, id]
            );
        }
        req.flash('success', 'Utilisateur modifié');
        res.redirect('/admin/utilisateurs');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur modification');
        res.redirect('/admin/utilisateurs');
    }
};

exports.supprimerUtilisateur = async (req, res) => {
    const { id } = req.params;
    try {
        if (parseInt(id) === req.session.user.id) {
            req.flash('error', 'Vous ne pouvez pas supprimer votre propre compte');
            return res.redirect('/admin/utilisateurs');
        }
        const old = await pool.query('SELECT photo FROM utilisateurs WHERE id=$1', [id]);
        if (old.rows[0] && old.rows[0].photo) {
            const oldPath = path.join(__dirname, '../public', old.rows[0].photo);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await pool.query('DELETE FROM utilisateurs WHERE id = $1', [id]);
        req.flash('success', 'Utilisateur supprimé');
        res.redirect('/admin/utilisateurs');
    } catch (err) {
        req.flash('error', 'Erreur suppression');
        res.redirect('/admin/utilisateurs');
    }
};

exports.getVentes = async (req, res) => {
    try {
        const { periode } = req.query;
        let whereClause = '';
        let titre = 'Historique des Ventes';

        if (periode === 'jour') {
            whereClause = "WHERE DATE(v.date_vente) = CURRENT_DATE";
            titre = 'Ventes du Jour';
        } else if (periode === 'hebdo') {
            whereClause = "WHERE v.date_vente >= CURRENT_DATE - INTERVAL '7 days'";
            titre = 'Ventes des 7 derniers jours';
        }

        const ventes = await pool.query(`
            SELECT v.*, u.nom AS vendeur_nom, u.prenom AS vendeur_prenom,
                   COUNT(lv.id) AS nb_articles
            FROM ventes v
            LEFT JOIN utilisateurs u ON v.vendeur_id = u.id
            LEFT JOIN lignes_vente lv ON lv.vente_id = v.id
            ${whereClause}
            GROUP BY v.id, u.nom, u.prenom
            ORDER BY v.date_vente DESC`);

        const totaux = await pool.query(`
            SELECT COALESCE(SUM(montant_total),0) AS ca_total, COUNT(*) AS nb_ventes
            FROM ventes v ${whereClause}`);

        res.render('admin/ventes', {
            title: titre,
            ventes: ventes.rows,
            totaux: totaux.rows[0],
            periode: periode || 'tous'
        });
    } catch (err) {
        req.flash('error', 'Erreur chargement ventes');
        res.redirect('/admin/dashboard');
    }
};

exports.getStock = async (req, res) => {
    try {
        const produits = await pool.query(`
            SELECT p.*, c.nom AS categorie_nom
            FROM produits p
            LEFT JOIN categories c ON p.categorie_id = c.id
            ORDER BY p.quantite_stock ASC`);

        const stats = await pool.query(`
            SELECT COUNT(*) AS total,
                SUM(CASE WHEN quantite_stock <= seuil_alerte THEN 1 ELSE 0 END) AS en_alerte,
                SUM(CASE WHEN quantite_stock = 0 THEN 1 ELSE 0 END) AS rupture,
                SUM(CASE WHEN quantite_stock > seuil_alerte THEN 1 ELSE 0 END) AS normal
            FROM produits`);

        res.render('admin/stock', {
            title: 'État du Stock',
            produits: produits.rows,
            stats: stats.rows[0]
        });
    } catch (err) {
        req.flash('error', 'Erreur chargement stock');
        res.redirect('/admin/dashboard');
    }
};

exports.getFournisseurs = async (req, res) => {
    try {
        const fournisseurs = await pool.query(`
            SELECT u.*, COUNT(c.id) AS nb_commandes,
                   SUM(CASE WHEN c.statut='livree' THEN 1 ELSE 0 END) AS nb_livrees
            FROM utilisateurs u
            LEFT JOIN commandes c ON c.fournisseur_id = u.id
            WHERE u.role = 'fournisseur'
            GROUP BY u.id
            ORDER BY u.nom ASC`);

        res.render('admin/fournisseurs', {
            title: 'Fournisseurs',
            fournisseurs: fournisseurs.rows
        });
    } catch (err) {
        req.flash('error', 'Erreur chargement fournisseurs');
        res.redirect('/admin/dashboard');
    }
};

exports.getConfiguration = (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../config/config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        res.render('admin/parametres', { title: 'Paramètres Système', config });
    } catch (err) {
        res.render('admin/parametres', { title: 'Paramètres Système', config: {} });
    }
};

exports.updateConfiguration = async (req, res) => {
    const { nom_entreprise, adresse, telephone, email, devise, slogan } = req.body;
    try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../config/config.json');
        const config = { nom_entreprise, adresse, telephone, email, devise, slogan };

        // Gérer le logo
        if (req.files && req.files.logo && req.files.logo.size > 0) {
            const file = req.files.logo;
            const ext = path.extname(file.name);
            const logoPath = path.join(__dirname, '../public/images/logo' + ext);
            await file.mv(logoPath);

            // Mettre à jour favicon
            const { execSync } = require('child_process');
            try {
                execSync(`convert ${logoPath} -resize 32x32 ${path.join(__dirname, '../public/favicon.ico')}`);
                execSync(`convert ${logoPath} -resize 50x50 ${path.join(__dirname, '../public/images/logo-small.png')}`);
            } catch(e) {
                console.log('Convert non disponible');
            }

            config.logo = '/images/logo' + ext;
        } else {
            // Garder l'ancien logo
            const oldConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            config.logo = oldConfig.logo || null;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        req.flash('success', 'Paramètres mis à jour !');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur mise à jour');
    }
    res.redirect('/admin/parametres');
};

exports.getLogs = (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const logFile = path.join(__dirname, '../logs/activity.log');

        let logs = [];
        if (fs.existsSync(logFile)) {
            const content = fs.readFileSync(logFile, 'utf8');
            const lignes = content.trim().split('\n').filter(l => l);

            // Parser chaque ligne
            logs = lignes.map(l => {
                const parts = l.split(' | ');
                return {
                    date: parts[0] ? parts[0].replace('[', '').replace(']', '') : '',
                    action: parts[1] ? parts[1].trim() : '',
                    utilisateur: parts[2] ? parts[2].trim() : '',
                    details: parts[3] ? parts[3].trim() : '',
                    ip: parts[4] ? parts[4].replace('IP: ', '').trim() : ''
                };
            }).reverse();
        }

        // Filtrer par action si demandé
        const { action, recherche } = req.query;
        if (action && action !== 'tous') {
            logs = logs.filter(l => l.action === action);
        }
        if (recherche) {
            logs = logs.filter(l =>
                l.utilisateur.toLowerCase().includes(recherche.toLowerCase()) ||
                l.details.toLowerCase().includes(recherche.toLowerCase())
            );
        }

        const actions = ['CONNEXION', 'DECONNEXION', 'CREATION_UTILISATEUR', 'MODIFICATION_UTILISATEUR',
                        'SUPPRESSION_UTILISATEUR', 'MOUVEMENT_STOCK', 'VENTE', 'CREATION_COMMANDE',
                        'ANNULATION_COMMANDE', 'MODIFICATION_PARAMETRES'];

        res.render('admin/logs', {
            title: 'Logs Système',
            logs: logs.slice(0, 200),
            actions,
            filtreAction: action || 'tous',
            recherche: recherche || ''
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur chargement logs');
        res.redirect('/admin/dashboard');
    }
};
