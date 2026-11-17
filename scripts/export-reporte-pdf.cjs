// Imprime el reporte mensual de Excambiare -las tres marcas en el mismo PDF- con el generador del
// propio tablero, no con un maquetado aparte: levanta index.html en un servidor local, baja el
// barrido del Web App igual que el build, pilota `ReporteSemanal` y manda a imprimir la lamina.
//
// Por que existe: los datos del cliente no estan en el repo (el barrido lo sirve el Web App con el
// secret DATA_ENDPOINT), asi que el PDF solo se puede armar donde ese secret existe, que es aqui.
//
// Este repositorio es publico y los artefactos de un repositorio publico los descarga cualquiera,
// asi que el PDF NUNCA se sube en claro: se cifra con AES-256-GCM y la clave AES se envuelve con
// RSA-OAEP-SHA256 contra scripts/reporte-publica.pem. La privada no esta en Git.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = path.join(ROOT, 'data', 'excambiare-meta.json');
const OUT_DIR = path.join(ROOT, 'reporte-output');
const ENDPOINT_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
const MES = (process.env.MES || '').trim();   // '2026-11'; vacio: el mes mas reciente con datos
// El generador tiene dos modos y no ofrecen los mismos meses: "monthly" solo da meses cerrados, asi que
// el mes en curso solo existe en "advance", que cierra en el ultimo domingo (el acumulado 1-N del mes).
const MODO = (process.env.MODO || '').trim() === 'advance' ? 'advance' : 'monthly';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

// El barrido, igual que en build.js: si Google contesta mal se dice que contesto, sin datos del cliente.
async function bajarBarrido(endpoint) {
  const response = await fetch(`${endpoint}?action=data`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    const host = (() => { try { return new URL(response.url).host; } catch { return '?'; } })();
    const page = (await response.text().catch(() => '')).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`El Web App contesto HTTP ${response.status} desde ${host}${page ? `: "${page}"` : ''}`);
  }
  const body = await response.text();
  let payload = null; try { payload = JSON.parse(body); } catch { /* abajo se explica */ }
  if (!payload) throw new Error(`El Web App no devolvio JSON [${response.headers.get('content-type') || 'sin tipo'}]: ` + body.slice(0, 200).replace(/\s+/g, ' '));
  if (payload.ok === false || !Array.isArray(payload.brands)) throw new Error('El barrido llego sin marcas.');
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify(payload), 'utf8');
  return payload.sweptAt || null;
}

const servidor = http.createServer((req, res) => {
  const file = path.resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

async function main() {
  const endpoint = (process.env.DATA_ENDPOINT || '').trim();
  if (!ENDPOINT_RE.test(endpoint)) throw new Error('Falta DATA_ENDPOINT o no es una URL /exec de script.google.com');
  const sweptAt = await bajarBarrido(endpoint);
  // Que trajo el barrido, por marca y mes. Un mes con error no entra en el reporte y hasta ahora no
  // se veia en ningun sitio: asi se sabe si falta un mes porque no hay datos o porque fallo su lectura.
  const barrido = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  for (const marca of barrido.brands || []) {
    const meses = (marca.months || []).map(m => `${m.year}-${String(m.month).padStart(2, '0')}${m.error ? '!' : ''}`).join(' ');
    console.log(`BARRIDO ${marca.label}: ${meses || 'sin meses'}${marca.error ? ' | marca con error: ' + marca.error : ''}`);
    for (const m of marca.months || []) if (m.error) console.log(`  ERROR ${m.year}-${m.month} «${m.fileName}»: ${String(m.error).slice(0, 200)}`);
    // De los dos ultimos meses, lo justo para saber por que un mes no llega al reporte: cuantas filas
    // trajo, con que columnas y que aspecto tiene su dia (si no es AAAA-MM-DD, el tablero las descarta).
    for (const m of (marca.months || []).slice(-2)) {
      const dia = (m.columns || []).indexOf('day');
      console.log(`  ${m.year}-${String(m.month).padStart(2, '0')} filas=${(m.rows || []).length} dia=${dia < 0 ? '(sin columna)' : JSON.stringify((m.rows || [])[0]?.[dia])} columnas=${(m.columns || []).join(',')}`);
    }
    for (const x of marca.ignored || []) console.log(`  IGNORADO «${x.fileName}»: ${x.reason}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    page.on('pageerror', error => console.error('  [pagina]', error.message));
    await page.goto(`http://127.0.0.1:${servidor.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.ReporteSemanal && window.ExcambiareData && window.ExcambiareData.brandSnapshot), { timeout: 120000 });
    // La vista tiene que estar visible: una lamina dentro de un display:none no mide ni decodifica.
    await page.evaluate(() => { document.getElementById('view-reports')?.classList.add('visible'); });
    await page.evaluate(() => window.ReporteSemanal.init());
    await page.waitForFunction(() => document.querySelectorAll('#week-select option').length > 0, { timeout: 90000 });
    if (MODO === 'advance') {
      await page.select('#week-type', 'advance');
      await page.waitForFunction(() => [...document.querySelectorAll('#week-select option')].some(o => /avance/i.test(o.textContent)), { timeout: 60000 });
    }

    const opciones = await page.evaluate(() => [...document.querySelectorAll('#week-select option')].map(o => ({ value: o.value, text: o.textContent.trim() })));
    const conDatos = opciones.filter(o => o.value);
    if (!conDatos.length) throw new Error('El generador no ofrece ningun mes con datos: ' + JSON.stringify(opciones));
    const elegido = MES ? conDatos.find(o => o.value === MES) : conDatos[0];
    if (!elegido) throw new Error(`No hay reporte para ${MES}. Hay: ${conDatos.map(o => o.value).join(', ')}`);
    await page.select('#week-select', elegido.value);
    await page.waitForFunction(() => document.querySelectorAll('#week-report .rp-page').length > 0, { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {});

    // Se imprime exactamente el mazo del tablero: nada de menus ni del resto de los modulos.
    const prueba = await page.evaluate(() => {
      const host = document.querySelector('#week-report');
      const laminas = host.querySelectorAll('.rp-page');
      if (!laminas.length) throw Error('Sin laminas');
      const texto = host.innerText;
      if (texto.length < 1000) throw Error('El reporte salio vacio');
      document.body.replaceChildren(host.cloneNode(true));
      return { laminas: laminas.length, marcas: ['Sol y Tierra', 'Mex Cream', 'Gold Fusion'].filter(m => texto.includes(m)) };
    });
    // El mazo lleva solo las marcas con entregas ese mes, que no siempre son las tres: no es un fallo,
    // pero quien manda el PDF tiene que saberlo, asi que se avisa y se anota en el manifiesto.
    if (!prueba.marcas.length) throw new Error('El PDF no nombra ninguna de las tres marcas.');
    if (prueba.marcas.length < 3) console.warn('AVISO: este mes el reporte solo trae ' + prueba.marcas.join(' y ') + '.');
    await page.addStyleTag({ content: '@media print { body { margin:0!important;padding:0!important } .rp-deck {display:block!important} .rp-page {zoom:1!important} }' });
    // Clonar crea imagenes nuevas: hay que decodificarlas antes de imprimir o salen en blanco.
    await page.evaluate(async () => {
      await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
      const rotas = [...document.images].filter(img => !img.naturalWidth).length;
      if (rotas) throw Error(rotas + ' imagen(es) no cargaron');
    });

    const nombre = `excambiare-${elegido.value}${MODO === 'advance' ? '-avance' : ''}`;
    const pdfPath = path.join(OUT_DIR, nombre + '.pdf');
    await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    const pdf = fs.readFileSync(pdfPath);

    const manifiesto = { generador: 'excambiare-reporte-v1', mes: elegido.value, modo: MODO, titulo: elegido.text, laminas: prueba.laminas, marcas: prueba.marcas,
      sha256: crypto.createHash('sha256').update(pdf).digest('hex'), bytes: pdf.length, barrido: sweptAt, generado: new Date().toISOString() };

    // Cifrado antes de salir del runner. El .pdf en claro no se sube: se borra aqui mismo.
    const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(Buffer.from(JSON.stringify({ manifiesto, pdf: pdf.toString('base64') }))), cipher.final()]);
    const wrapped = crypto.publicEncrypt({ key: fs.readFileSync(path.join(__dirname, 'reporte-publica.pem')), oaepHash: 'sha256' }, key);
    fs.writeFileSync(path.join(OUT_DIR, nombre + '.encrypted.json'), JSON.stringify({ version: 1, key: wrapped.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }));
    fs.rmSync(pdfPath);
    console.log(JSON.stringify(manifiesto));
  } finally { await browser.close(); servidor.close(); }
}

main().catch(error => { console.error(error.message); servidor.close(); process.exitCode = 1; });
