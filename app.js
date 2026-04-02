const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const flash = require('express-flash');
const methodOverride = require('method-override');
const fileUpload = require('express-fileupload');
const path = require('path');
const pool = require('./config/db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware intelligent - pas de conflit
app.use((req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
        fileUpload()(req, res, next);
    } else if (ct.includes('application/x-www-form-urlencoded')) {
        express.urlencoded({ extended: true })(req, res, next);
    } else {
        next();
    }
});

app.use(session({
    store: new pgSession({ pool, tableName: 'session' }),
    secret: 'gestionstock_secret_2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.use('/', require('./routes/boutique'));
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/catalogue', require('./routes/catalogue'));
app.use('/stock', require('./routes/stock'));
app.use('/fournisseur', require('./routes/fournisseur'));
app.use('/vendeur', require('./routes/vendeur'));
app.use('/profil', require('./routes/profil'));

app.use((req, res) => {
    res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(` Serveur lancé sur http://localhost:${PORT}`);
});
