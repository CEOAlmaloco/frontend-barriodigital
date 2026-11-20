// Verifica que customHttp.yml proteja la app sin bloquear lo que el build y el código necesitan.
// Uso: node scripts/check-security-headers.mjs, después de npm run build.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const errors = [];
const fail = (message) => errors.push(message);

const yaml = readFileSync('customHttp.yml', 'utf8').replace(/\r\n/g, '\n');
const headers = {};
for (const match of yaml.matchAll(/- key: (\S+)\n\s+value: (?:>-\n((?:\s{10}.*\n?)+)|(.*))/g)) {
  headers[match[1]] = (match[2] ?? match[3])
    .split('\n')
    .map((line) => line.trim())
    .join(' ')
    .trim();
}

if (
  !/max-age=(\d+)/.test(headers['Strict-Transport-Security'] ?? '') ||
  Number(headers['Strict-Transport-Security'].match(/max-age=(\d+)/)[1]) < 31536000
) {
  fail('Strict-Transport-Security debe tener max-age de al menos un año');
}
if (headers['X-Frame-Options'] !== 'DENY') fail('X-Frame-Options debe ser DENY');
if (headers['X-Content-Type-Options'] !== 'nosniff')
  fail('X-Content-Type-Options debe ser nosniff');
if (headers['Referrer-Policy'] !== 'strict-origin-when-cross-origin')
  fail('Referrer-Policy inesperada');

const csp = Object.fromEntries(
  (headers['Content-Security-Policy'] ?? '')
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .filter((tokens) => tokens[0])
    .map(([name, ...values]) => [name, values]),
);
const allows = (directive, origin) =>
  (csp[directive] ?? csp['default-src'] ?? []).some((source) => {
    if (source === origin) return true;
    const wildcard = source.match(/^https:\/\/\*\.(.+)$/);
    return wildcard !== null && origin.startsWith('https://') && origin.endsWith('.' + wildcard[1]);
  });

for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'"]) {
  if ((csp['script-src'] ?? []).includes(unsafe)) fail(`script-src no debe permitir ${unsafe}`);
}
if (!(csp['object-src'] ?? []).includes("'none'")) fail("object-src debe ser 'none'");
if (!(csp['frame-ancestors'] ?? []).includes("'none'")) fail("frame-ancestors debe ser 'none'");

// Todo script y manejador inline del index.html construido tiene que estar autorizado por su hash.
const distRoot = join('dist', 'frontend-barriodigital', 'browser');
const indexHtml = readFileSync(join(distRoot, 'index.html'), 'utf8');
for (const script of indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  const hash = `'sha256-${createHash('sha256').update(script[1]).digest('base64')}'`;
  if (!(csp['script-src'] ?? []).includes(hash))
    fail(`script inline sin autorizar en index.html: ${hash}`);
}
for (const handler of indexHtml.matchAll(/\son[a-z]+="([^"]*)"/g)) {
  const hash = `'sha256-${createHash('sha256').update(handler[1]).digest('base64')}'`;
  const scriptSrc = csp['script-src'] ?? [];
  if (!scriptSrc.includes("'unsafe-hashes'") || !scriptSrc.includes(hash)) {
    fail(
      `manejador inline sin autorizar en index.html (${handler[1]}): agrega ${hash} a script-src`,
    );
  }
}

// Orígenes que usa el código: el login, el BFF, las teselas del mapa y las fuentes.
const sources = (dir) =>
  readdirSync(dir, { recursive: true })
    .filter((file) => /\.(ts|html)$/.test(file) && !/\.spec\.ts$/.test(file))
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n');
const app = sources('src/app');
const environment = readFileSync('src/environments/environment.ts', 'utf8');
const sourceIndex = readFileSync('src/index.html', 'utf8');
const origin = (url) => new URL(url.replace(/\{[a-z]\}/g, 'x')).origin;

const bff = environment.match(/bffBaseUrl:\s*'([^']+)'/);
if (!bff) fail('no se encontró bffBaseUrl en environment.ts');
else if (!allows('connect-src', origin(bff[1])))
  fail(`connect-src no permite el BFF ${origin(bff[1])}`);
if (!allows('connect-src', 'https://login.microsoftonline.com'))
  fail('connect-src no permite Entra ID');
if (!allows('frame-src', 'https://login.microsoftonline.com'))
  fail('frame-src no permite Entra ID');
for (const tile of app.matchAll(/tileLayer\(\s*'([^']+)'/g)) {
  if (!allows('img-src', origin(tile[1])))
    fail(`img-src no permite las teselas ${origin(tile[1])}`);
}
const sheetOrigins = [...sourceIndex.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
  (sheet) => origin(sheet[1]),
);
for (const sheetOrigin of sheetOrigins) {
  if (!allows('style-src', sheetOrigin)) fail(`style-src no permite ${sheetOrigin}`);
}
// Las hojas de Google Fonts cargan los archivos de fuente desde fonts.gstatic.com
if (
  sheetOrigins.some((sheetOrigin) => sheetOrigin === 'https://fonts.googleapis.com') &&
  !allows('font-src', 'https://fonts.gstatic.com')
) {
  fail('font-src no permite https://fonts.gstatic.com');
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log('Encabezados de seguridad OK');
