const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, 'public/images/produits');
console.log('Dossier existe ?', fs.existsSync(dir));
console.log('Chemin complet :', dir);

fs.writeFileSync(path.join(dir, 'test.txt'), 'test');
console.log('Ecriture OK !');
