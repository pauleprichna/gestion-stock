const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../logs/activity.log');

// Créer le dossier logs si inexistant
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const log = (action, details) => {
    return (req, res, next) => {
        try {
            const user = req.session && req.session.user 
                ? `${req.session.user.prenom} ${req.session.user.nom} (${req.session.user.role})` 
                : 'Anonyme';
            const ip = req.ip || req.connection.remoteAddress;
            const date = new Date().toLocaleString('fr-FR');
            const ligne = `[${date}] | ${action} | ${user} | ${details || ''} | IP: ${ip}\n`;
            fs.appendFileSync(logFile, ligne);
        } catch (err) {
            console.error('Erreur log:', err.message);
        }
        next();
    };
};

module.exports = log;
