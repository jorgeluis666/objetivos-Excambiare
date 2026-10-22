#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_HTML = path.join(DIST_DIR, 'index.html');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

// El logo y el favicon se referencian por URL, no se inlinean: sin esta copia
// dist/ sale sin marca. La ruta del CSS se reescribe en main() porque al
// inlinearlo el '../assets/' dejaria de resolver dentro de dist/.
function copyBrandAssets() {
  const source = path.join(ROOT, 'assets');
  if (!fs.existsSync(source)) {
    console.warn('[build] falta assets/; dist quedara sin logo ni favicon');
    return;
  }
  fs.cpSync(source, path.join(DIST_DIR, 'assets'), { recursive: true });
  for (const asset of ['logo-excambiare.png', 'favicon.png']) {
    if (!fs.existsSync(path.join(source, asset))) {
      console.warn(`[build] falta assets/${asset}`);
    }
  }
}

// GitHub Pages no tiene Basic Auth: con DASHBOARD_PASSWORD el tablero se cifra (AES-256-GCM, llave
// PBKDF2-SHA256) dentro de deploy/pages-gate.html, que lo descifra en el navegador con la clave.
// La salida es compatible con WebCrypto: el tag de GCM va pegado al final del texto cifrado.
const PBKDF2_ITERATIONS = 600000;
const MIN_PASSWORD_LENGTH = 8;

function encryptPage(html, password) {
  // Sal fija por marca (no es secreta): la llave que recuerda el navegador sigue sirviendo despues de cada
  // deploy y solo deja de servir cuando cambia la clave. El iv si es nuevo en cada build.
  const salt = crypto.createHash('sha256').update('lr-gate:excambiare').digest().subarray(0, 16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password.normalize('NFC'), salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  const payload = JSON.stringify({
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: data.toString('base64'),
  });
  // El payload es JSON de cadenas base64 (sin saltos de linea): solo la plantilla puede traer CRLF.
  const template = readFile('deploy/pages-gate.html').replace(/\r\n?/g, '\n');
  if (template.split('__PAYLOAD__').length !== 2) throw new Error('deploy/pages-gate.html debe contener __PAYLOAD__ exactamente una vez');
  return template.replace('__PAYLOAD__', () => payload);
}

const DATA_ENDPOINT_RE =/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
const SNAPSHOT_FILE = path.join(ROOT, 'data', 'excambiare-meta.json');
// Esperas entre intentos cuando Google no entrega el barrido. A veces responde 404 al primer intento y el
// siguiente sale bien: el 404 no lo da el script (sus errores llegan como JSON con ok:false) sino el paso
// en que Google entrega la respuesta guardada del Web App.
const RETRY_DELAYS_MS = [15000, 30000, 60000];

// Baja el ultimo barrido del Web App y lo guarda en data/. Devuelve null (con aviso) si Google falla.
async function fetchSnapshot(endpoint) {
  try {
    const response = await fetch(`${endpoint}?action=data`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      // Para saber que contesto Google: el servidor (sin la direccion completa, que es privada) y el texto
      // de su pagina de error, que no trae datos del cliente.
      const host = (() => { try { return new URL(response.url).host; } catch (error) { return '?'; } })();
      const page = (await response.text().catch(() => '')).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      throw new Error(`HTTP ${response.status} desde ${host}${page ? `: "${page}"` : ''}`);
    }
    const payload = await response.json();
    if (!payload || payload.ok === false || !Array.isArray(payload.brands)) throw new Error('respuesta sin marcas');
    const text = JSON.stringify(payload);
    fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
    fs.writeFileSync(SNAPSHOT_FILE, text, 'utf8');
    return text;
  } catch (error) {
    console.warn(`[build] no se pudo bajar el barrido del Web App (${error.message})`);
    return null;
  }
}

// El repo es publico: la URL del Web App (secret DATA_ENDPOINT) y los datos del cliente solo viven en
// dist/, que se sirve con clave. El build baja el ultimo barrido y lo incrusta como copia de respaldo; si
// Google no responde usa la copia local de data/ (gitignored) de un build anterior.
async function loadSnapshot(endpoint) {
  const text = endpoint ? await fetchSnapshot(endpoint) : null;
  if (text) return text;
  if (fs.existsSync(SNAPSHOT_FILE)) {
    if (endpoint) console.warn('[build] se usa la copia local de data/');
    return fs.readFileSync(SNAPSHOT_FILE, 'utf8');
  }
  // En GitHub Actions nunca hay copia local: un tablero sin copia reemplazaria al publicado, que si la tiene.
  // Se reintenta hasta tres veces (15 s, 30 s y 60 s) y, si Google sigue sin responder, el build falla y
  // Pages conserva el deploy anterior.
  if (process.env.GITHUB_ACTIONS === 'true') {
    if (endpoint) {
      for (const [index, delay] of RETRY_DELAYS_MS.entries()) {
        await new Promise(resolve => setTimeout(resolve, delay));
        const retry = await fetchSnapshot(endpoint);
        if (retry) {
          console.log(`[build] barrido del Web App bajado en el reintento ${index + 1}`);
          return retry;
        }
      }
    }
    throw new Error('sin barrido del Web App ni copia local de data/; no se publica un tablero sin datos');
  }
  console.warn('[build] sin copia de datos: el tablero dependera solo de la lectura en vivo');
  return 'null';
}

async function main() {
  const endpoint = (process.env.DATA_ENDPOINT || '').trim();
  if (endpoint && !DATA_ENDPOINT_RE.test(endpoint)) throw new Error('DATA_ENDPOINT no es una URL /exec de script.google.com');
  if (!endpoint) console.warn('[build] falta DATA_ENDPOINT; el tablero no podra leer Google en vivo');
  // Recortada igual que en deploy/pages-gate.html: un espacio al copiar la clave no deja a nadie afuera.
  const pagePassword = (process.env.DASHBOARD_PASSWORD || '').trim();
  // Un <input type="password"> descarta los saltos de linea: con uno en la clave nadie podria abrir el tablero.
  if (/[\r\n]/.test(pagePassword)) throw new Error('DASHBOARD_PASSWORD contiene un salto de linea: la pantalla de acceso no lo puede escribir');
  if (pagePassword && pagePassword.length < MIN_PASSWORD_LENGTH) throw new Error(`DASHBOARD_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  // En GitHub Actions nunca se publica sin clave: el tablero quedaria abierto a cualquiera con el enlace.
  if (!pagePassword && process.env.GITHUB_ACTIONS === 'true') throw new Error('falta DASHBOARD_PASSWORD; no se publica el tablero sin clave');

  let html = readFile('index.html');
  // Al inlinear el CSS la ruta pasa a resolverse desde dist/index.html,
  // asi que '../assets/' tiene que quedar como 'assets/'.
  const css = readFile('css/dashboard.css').replace(/\.\.\/assets\//g, 'assets/');
  // '\\u003c' es el texto \u003c (no el caracter <): un "</script>" en los datos cerraria el <script>.
  const metaData = (await loadSnapshot(endpoint)).replace(/</g, '\\u003c');

  // Reemplazos con funcion: una cadena de reemplazo interpretaria "$'" o "$&" dentro del codigo o de los datos.
  html = html.replace(/<link rel="stylesheet" href="css\/dashboard\.css(?:\?v=[^"]+)?">/, () => `<style>${css}</style>`);
  // Se incrustan, en el orden de index.html, todos los js/ que carga: no hay otra lista que mantener.
  html = html.replace(/<script src="js\/([\w-]+\.js)(?:\?v=[^"]+)?"><\/script>/g, (_, file) => `<script>${readFile(`js/${file}`)}</script>`);
  if (/<script src="js\//.test(html)) throw new Error('index.html carga un js/ que el build no incrusta');
  // La bitacora viaja incrustada: dist/ no lleva la carpeta data/.
  const inlineJson = file => JSON.stringify(JSON.parse(readFile(file))).replace(/</g, '\\u003c');
  const bitacora = inlineJson('data/excambiare-bitacora.json');
  // Publicos de Meta Ads por marca del modulo Segmentacion (transcritos del documento fuente).
  const segmentation = inlineJson('data/excambiare-segmentation.json');
  const config = `window.EXCAMBIARE_DATA_ENDPOINT = ${JSON.stringify(endpoint)};window.EXCAMBIARE_META_DATA = ${metaData};window.EXCAMBIARE_BITACORA = ${bitacora};window.EXCAMBIARE_SEGMENTATION = ${segmentation};`;
  html = html.replace('</head>', () => `<script>${config}</script></head>`);

  // Salida en LF tanto en Windows (checkout con CRLF) como en CI: el mismo codigo da el mismo dist/index.html.
  html = html.replace(/\r\n?/g, '\n');

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(DIST_HTML, pagePassword ? encryptPage(html, pagePassword) : html, 'utf8');
  if (pagePassword) console.log('[build] dist/index.html cifrado con DASHBOARD_PASSWORD');

  copyBrandAssets();
  // Dominio propio en GitHub Pages (inversiones.limaretail.com); va junto al sitio.
  fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(DIST_DIR, 'CNAME'));
  // El tablero no se indexa: la pantalla de acceso ya trae noindex y esto cubre el resto del sitio.
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');

  console.log(`[build] escrito dist/index.html (${(fs.statSync(DIST_HTML).size / 1024).toFixed(1)} KB)`);
}

main().catch(error => {
  console.error('[build] error:', error.message);
  process.exit(1);
});
