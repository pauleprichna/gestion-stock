const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

exports.getProfil = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM utilisateurs WHERE id=$1', [req.session.user.id]);
        res.render('profil', { title: 'Mon Profil', utilisateur: result.rows[0] });
    } catch (err) {
        req.flash('error', 'Erreur chargement profil');
        res.redirect('/');
    }
};

exports.updateProfil = async (req, res) => {
    const { telephone, mot_de_passe } = req.body;
    try {
        let photo = null;

        if (req.files && req.files.photo && req.files.photo.size > 0) {
            const file = req.files.photo;
            const ext = path.extname(file.name);
            const filename = 'user-' + Date.now() + ext;
            const uploadPath = path.join(__dirname, '../public/images/utilisateurs', filename);

            const old = await pool.query('SELECT photo FROM utilisateurs WHERE id=$1', [req.session.user.id]);
            if (old.rows[0] && old.rows[0].photo) {
                const oldPath = path.join(__dirname, '../public', old.rows[0].photo);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }

            await file.mv(uploadPath);
            photo = '/images/utilisateurs/' + filename;
        }

        if (photo) {
            await pool.query('UPDATE utilisateurs SET telephone=$1, photo=$2 WHERE id=$3',
                [telephone || null, photo, req.session.user.id]);
            req.session.user.photo = photo;
        } else {
            await pool.query('UPDATE utilisateurs SET telephone=$1 WHERE id=$2',
                [telephone || null, req.session.user.id]);
        }

        if (mot_de_passe && mot_de_passe.length >= 6) {
            const hash = await bcrypt.hash(mot_de_passe, 10);
            await pool.query('UPDATE utilisateurs SET mot_de_passe=$1 WHERE id=$2', [hash, req.session.user.id]);
        }

        req.session.user.telephone = telephone;
        req.flash('success', 'Profil mis à jour !');
        res.redirect('/profil');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur mise à jour profil');
        res.redirect('/profil');
    }
};
