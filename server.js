/**
 * New Avenue 1 — local static server.
 *
 * No npm packages required: this uses only Node's built-in modules, so
 * `npm install` has nothing to download and the app works even offline
 * once Node.js itself is installed.
 *
 * Usage:
 *   node server.js            -> serves ./ (or ./dist if it exists) on port 3000
 *   PORT=8080 node server.js  -> use a different port
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(path.normalize(root))) return root; // block path traversal
  return target;
}

const server = http.createServer((req, res) => {
  let filePath = safeJoin(ROOT, req.url === '/' ? '/index.html' : req.url);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) filePath = path.join(filePath, 'index.html');

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Single-page app: unknown paths fall back to index.html instead of a 404.
        fs.readFile(path.join(ROOT, 'index.html'), (err2, fallback) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': MIME['.html'] });
            res.end(fallback);
          }
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

server.listen(PORT, '0.0.0.0', () => {
  const lan = getLanAddresses();
  console.log('');
  console.log('  New Avenue 1 is running.');
  console.log('  --------------------------------------------');
  console.log(`  On this computer:   http://localhost:${PORT}`);
  if (lan.length) {
    lan.forEach((ip) => console.log(`  On your phone:      http://${ip}:${PORT}`));
    console.log('  (phone must be on the same Wi-Fi network as this computer)');
  } else {
    console.log('  Could not detect a Wi-Fi/LAN address on this machine.');
  }
  console.log('  --------------------------------------------');
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});
