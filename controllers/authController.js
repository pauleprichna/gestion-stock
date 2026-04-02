const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const redirectParRole = (role) => {
    switch(role) {
        case 'administrateur': return '/admin/dashboard';
        case 'gestionnaire_catalogue': return '/catalogue/dashboard';
        case 'gestionnaire_stock': return '/stock/dashboard';
        case 'fournisseur': return '/fournisseur/dashboard';
        case 'vendeur': return '/vendeur/dashboard';
        default: return '/auth/login';
    }
};

exports.getLogin = (req, res) => {
    res.render('auth/login', { title: 'Connexion' });
};

exports.postLogin = async (req, res) => {
    const { email, mot_de_passe } = req.body;
    try {
        const result = await pool.query('SELECT * FROM utilisateurs WHERE email = $1 AND actif = TRUE', [email]);
        if (result.rows.length === 0) {
            req.flash('error', 'Email ou mot de passe incorrect');
            return res.redirect('/auth/login');
        }
        const user = result.rows[0];
        const valide = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!valide) {
            req.flash('error', 'Email ou mot de passe incorrect');
            return res.redirect('/auth/login');
        }
        req.session.user = {
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            role: user.role,
            photo: user.photo || null,
            telephone: user.telephone || null
        };
        res.redirect(redirectParRole(user.role));
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur serveur');
        res.redirect('/auth/login');
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login');
    });
};
