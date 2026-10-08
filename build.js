/**
 * "Production build" for New Avenue 1.
 *
 * This app is a static HTML/CSS/JS site with no framework and no build tooling
 * (no bundler, no transpiler) — the source files ARE the production files.
 * This script simply assembles a clean dist/ folder containing exactly what
 * needs to be deployed, so you have one folder to upload to any static host
 * (Netlify, Vercel, GitHub Pages, an S3 bucket, your own server, etc).
 *
 * Usage: npm run build   →  creates ./dist
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const INCLUDE = ['index.html', 'css', 'js'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

INCLUDE.forEach((entry) => {
  const src = path.join(ROOT, entry);
  if (fs.existsSync(src)) copyRecursive(src, path.join(DIST, entry));
});

console.log('Build complete → ./dist');
console.log('Upload the contents of dist/ to any static host, or run:');
console.log('  npm start   (serves dist/ automatically once it exists)');
