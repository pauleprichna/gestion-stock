const estConnecte = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Veuillez vous connecter');
    res.redirect('/auth/login');
};

const autoriser = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            req.flash('error', 'Veuillez vous connecter');
            return res.redirect('/auth/login');
        }
        if (!roles.includes(req.session.user.role)) {
            req.flash('error', 'Accès refusé');
            return res.redirect('/auth/login');
        }
        next();
    };
};

module.exports = { estConnecte, autoriser };
