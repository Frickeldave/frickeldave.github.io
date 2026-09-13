import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Minimal dependency-free static file server for the Astro `dist/` build.
 *
 * Astro 7's `astro preview` daemonizes (the launcher exits immediately), which
 * is incompatible with Playwright's `webServer` (it needs a foreground,
 * long-running process). This tiny server stays in the foreground so Playwright
 * can manage its lifecycle, and serves the same static output that
 * `astro preview` would.
 */

const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function resolvePath(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  return join(DIST_DIR, safe);
}

const server = createServer((req, res) => {
  let filePath = resolvePath(new URL(req.url, `http://${req.headers.host}`).pathname);

  // Directory request → serve index.html (Astro static output layout).
  if (statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${DIST_DIR} at http://${HOST}:${PORT}`);
});
