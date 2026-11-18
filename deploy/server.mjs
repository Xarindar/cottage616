import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from './site-preview-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const redirects = JSON.parse(await readFile(new URL('./asset-redirects.json', import.meta.url), 'utf8'));
const pages = new Set(['', 'index', 'index.html', 'the-hive', 'the-hive.html', 'vendors', 'vendors.html', 'booking', 'booking.html']);
const server = await createPreviewServer({ root, redirects, basePath: process.env.SITE_BASE_PATH || '/',
  passwordHash: 'defafcc19c14d5df397358e19d8b71df:b50e15ff4cf4b3482d20ad658095d4f80c8521867b5e9b690076f0fec89afa1ce7bee38e24d1a2176ae201af8cb7da2be62ef589f579aaa6e0e3ba2309b94882',
  allowedPath: path => pages.has(path) || ['coming-soon.css', 'coming-soon.js'].includes(path) || /^(assets|styles|scripts)\//.test(path) && !path.startsWith('scripts/tools/')
});
server.listen(Number(process.env.PORT || 8083), process.env.HOST || '0.0.0.0', () => console.log('Cottage website preview server is ready.'));
