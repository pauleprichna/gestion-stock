const http = require('http');
const Busboy = require('busboy');

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        const bb = Busboy({ headers: req.headers });
        bb.on('field', (name, val) => console.log('FIELD:', name, '=', val));
        bb.on('file', (name, file, info) => console.log('FILE:', name, info.filename));
        bb.on('finish', () => { console.log('DONE'); res.end('ok'); });
        req.pipe(bb);
    }
});

server.listen(3001, () => console.log('Test server on 3001'));
