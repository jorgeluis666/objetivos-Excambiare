#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_HTML = path.join(DIST_DIR, 'index.html');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

// La pantalla de acceso vive fuera del HTML inlineado, asi que dist/ necesita
// una copia del script y de la imagen de fondo o el build sale sin login.
function copyLoginAssets() {
  for (const asset of ['auth-login.js', 'login-bg.jpg']) {
    const source = path.join(ROOT, asset);
    if (!fs.existsSync(source)) {
      console.warn(`[build] falta ${asset}; dist quedara sin ese archivo`);
      continue;
    }
    fs.copyFileSync(source, path.join(DIST_DIR, asset));
  }
}

function main() {
  let html = readFile('index.html');
  const css = readFile('css/dashboard.css');
  const app = readFile('js/objectives.js');
  const reservationGoals = readFile('js/reservation-goals.js');
  const messagesCalculator = readFile('js/messages-calculator.js');
  const navigation = readFile('js/navigation.js');
  const sidebar = readFile('js/sidebar.js');
  const reportsArchive = readFile('js/reports-archive.js');
  const projections = readFile('js/projections.js');
  const segmentation = readFile('js/segmentation.js');
  const data = readFile('data/excambiare-ads-2026.json').replace(/</g, '\\u003c');
  const juneData = readFile('data/excambiare-june-sheet-2026.json').replace(/</g, '\\u003c');
  const julyData = readFile('data/excambiare-july-sheet-2026.json').replace(/</g, '\\u003c');
  const septemberData = readFile('data/excambiare-september-sheet-2026.json').replace(/</g, '\\u003c');
  const augustData = readFile('data/excambiare-august-sheet-2026.json').replace(/</g, '\\u003c');
  const driveReports = readFile('data/excambiare-drive-reports.json').replace(/</g, '\\u003c');
  const segmentationData = readFile('data/excambiare-segmentation.json').replace(/</g, '\\u003c');

  html = html.replace(
    new RegExp('<link rel=\"stylesheet\" href=\"css/dashboard\\.css(?:\\?v=[^\"]+)?\">'),
    `<style>${css}</style>`
  );
  html = html.replace(
    new RegExp('<script src=\"js/objectives\\.js(?:\\?v=[^\"]+)?\"><\\/script>'),
    `<script>${app}</script>`
  );
  html = html.replace(
    new RegExp('<script src="js\\/reservation-goals\\.js(?:\\?v=[^"]+)?"><\\/script>'),
    `<script>${reservationGoals}</script>`
  );
  html = html.replace(
    new RegExp('<script src="js\\/messages-calculator\\.js(?:\\?v=[^"]+)?"><\\/script>'),
    `<script>${messagesCalculator}</script>`
  );
  html = html.replace(
    new RegExp('<script src="js\\/navigation\\.js(?:\\?v=[^"]+)?"><\\/script>'),
    `<script>${navigation}</script>`
  );
  html = html.replace(
    new RegExp('<script src="js\\/sidebar\\.js(?:\\?v=[^"]+)?"><\\/script>'),
    `<script>${sidebar}</script>`
  );
  html = html.replace(
    new RegExp('<script src="js\\/projections\\.js(?:\\?v=[^"]+)?"><\\/script>'),
    `<script>${projections}</script>`
  );
  html = html.replace(
    new RegExp('<script src="js\\/reports-archive\\.js(?:\\?v=[^"]+)?"><\\/script>'),
    `<script>${reportsArchive}</script>`
  );
  html = html.replace(
    new RegExp('<script src="js\\/segmentation\\.js(?:\\?v=[^"]+)?"><\\/script>'),
    `<script>${segmentation}</script>`
  );
  html = html.replace(
    '</head>',
    `<script>window.EXCAMBIARE_ADS_DATA = ${data};window.EXCAMBIARE_JUNE_DATA = ${juneData};window.EXCAMBIARE_JULY_DATA = ${julyData};window.EXCAMBIARE_AUGUST_DATA = ${augustData};window.EXCAMBIARE_SEPTEMBER_DATA = ${septemberData};window.EXCAMBIARE_DRIVE_REPORTS = ${driveReports};window.EXCAMBIARE_SEGMENTATION = ${segmentationData};</script></head>`
  );

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST_DIR, 'data'), { recursive: true });
  fs.writeFileSync(DIST_HTML, html, 'utf8');
  fs.copyFileSync(
    path.join(ROOT, 'data', 'excambiare-ads-2026.json'),
    path.join(DIST_DIR, 'data', 'excambiare-ads-2026.json')
  );

  fs.copyFileSync(
    path.join(ROOT, 'data', 'excambiare-drive-reports.json'),
    path.join(DIST_DIR, 'data', 'excambiare-drive-reports.json')
  );

  fs.copyFileSync(
    path.join(ROOT, 'data', 'excambiare-segmentation.json'),
    path.join(DIST_DIR, 'data', 'excambiare-segmentation.json')
  );

  copyLoginAssets();

  console.log(`[build] escrito dist/index.html (${(fs.statSync(DIST_HTML).size / 1024).toFixed(1)} KB)`);
}

try {
  main();
} catch (error) {
  console.error('[build] error:', error.message);
  process.exit(1);
}
