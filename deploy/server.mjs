import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from './site-preview-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const redirects = JSON.parse(await readFile(new URL('./asset-redirects.json', import.meta.url), 'utf8'));
const pages = new Set(['', 'index', 'index.html', 'the-hive', 'the-hive.html', 'vendors', 'vendors.html', 'booking', 'booking.html']);
const server = await createPreviewServer({ root, redirects, basePath: process.env.SITE_BASE_PATH || '/',
  passwordHash: 'cc18e889ff439a65b447eb61e927b698:b8f31787a1a51d36d9aa0ff41ad7dffaf7b3004d61a4dfc53c37f4cdc4f4022d5bbd990e4e29ad9d97e0134c5a33e8af402d2577af1b62a779ee3d033ce773fe',
  allowedPath: path => pages.has(path) || ['coming-soon.css', 'coming-soon.js'].includes(path) || /^(assets|styles|scripts)\//.test(path) && !path.startsWith('scripts/tools/')
});
server.listen(Number(process.env.PORT || 8083), process.env.HOST || '0.0.0.0', () => console.log('Cottage website preview server is ready.'));
