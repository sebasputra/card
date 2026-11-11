// Local preview, including the contact download. Editor endpoints are not exposed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import vcard from '../api/vcard.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.argv[2] || 4322);
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4'};
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + port);
  if (url.pathname === '/api/vcard') {
    // The endpoint fetches its own public data via HTTPS in production.
    const proxyReq = {query: Object.fromEntries(url.searchParams), headers: req.headers};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input, ...args) => originalFetch(String(input).replace('https://127.0.0.1:' + port + '/', 'http://127.0.0.1:' + port + '/'), ...args);
    res.status = code => { res.statusCode = code; return res; };
    res.send = body => res.end(body);
    try { await vcard(proxyReq, res); } finally { globalThis.fetch = originalFetch; }
    return;
  }
  try {
    const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (parts[0] === 'profile') parts[0] = 'stephen';
    if (parts[0] === 'bni') parts[0] = 'stephen-bni';
    if (parts.some(p => p.startsWith('.')) || parts[0] === 'api' || !['start', 'stephen', 'stephen-bni', 'assets'].includes(parts[0])) throw new Error('Not public');
    const path = resolve(root, parts.join('/'), ...(url.pathname.endsWith('/') ? ['index.html'] : []));
    if (!path.startsWith(resolve(root) + sep)) throw new Error('Outside root');
    const body = await readFile(path);
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(port, '127.0.0.1', () => process.stdout.write('Local: http://127.0.0.1:' + port + '/start/\n'));
