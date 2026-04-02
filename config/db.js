const { Pool } = require('pg');

const pool = new Pool({
    user: 'appuser',
    host: 'localhost',
    database: 'gestion_stock',
    password: 'app2024',
    port: 5432
});

pool.connect()
    .then(() => console.log(' Connecté à PostgreSQL - gestion_stock'))
    .catch(err => console.error('Erreur de connexion PostgreSQL', err));

module.exports = pool;
