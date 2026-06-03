#!/usr/bin/env node
// Zero-dependency static file server, just enough to load the ES-module web app
// (opening index.html via file:// blocks module imports in most browsers).
//
//   node bin/serve.js            # http://localhost:8080/
//   PORT=3000 node bin/serve.js

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

    // Send the bare host (and /web) to /web/ so the document URL ends in a
    // slash; otherwise the page's relative module imports resolve wrong.
    if (urlPath === '/' || urlPath === '/web') {
      res.writeHead(302, { Location: '/web/' }).end();
      return;
    }
    if (urlPath.endsWith('/')) urlPath += 'index.html';

    // Resolve against ROOT and refuse anything that escapes it.
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    if (err && err.code === 'ENOENT') res.writeHead(404).end('Not found');
    else {
      res.writeHead(500).end('Server error');
      console.error(err);
    }
  }
});

server.listen(PORT, () => {
  console.log(`neuro-creatures running at  http://localhost:${PORT}/`);
  console.log('press Ctrl+C to stop');
});
