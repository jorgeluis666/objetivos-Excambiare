// Web App del tablero de Inversiones Excambiare. Proyecto independiente de script.google.com.
// Al cambiar este archivo: pegarlo en el proyecto y Implementar > Administrar implementaciones > editar > Nueva version.
// Inversiones Excambiare tiene tres marcas comerciales y cada una tiene su carpeta de descargas y su carpeta de
// reportes. Los IDs van en las propiedades del script (Configuracion del proyecto > Propiedades del script); el repo
// es publico y ningun ID va aqui. Ver BRANDS.
// Descargas: un archivo por mes, descarga directa de Meta Ads ("Raw Data Report": una fila por dia x edad x sexo x
// anuncio), como Hoja de calculo de Google o como .xlsx. Un .xlsx se lee con una copia temporal convertida, para lo
// que el proyecto necesita el servicio avanzado "Drive API" (Servicios > +). Nombre: "Octubre 2026" o
// "Sol y Tierra - Octubre 2026"; sin ano se asume el ano en curso.
// GET ?action=data -> ultimo barrido | ?action=data&fresh=1 -> barrido en el momento (boton Actualizar).
// Opcional (Generacion de Reporte): con un token de Meta en la propiedad META_TOKEN el barrido suma a cada marca la
// miniatura y el formato de sus artes (creatives) y, con IG_USER_<MARCA>, los seguidores nuevos y las bajas de su
// Instagram por mes (instagram). Sin token todo sigue igual: el reporte deduce el formato de las reproducciones y las
// cifras de seguidores se escriben sobre la lamina.
const BRANDS = [
  { key: 'sol-y-tierra', label: 'Sol y Tierra', data: 'DATA_FOLDER_SOL_Y_TIERRA', reports: 'REPORTS_FOLDER_SOL_Y_TIERRA', instagram: 'IG_USER_SOL_Y_TIERRA' },
  { key: 'mex-cream', label: 'Mex Cream', data: 'DATA_FOLDER_MEX_CREAM', reports: 'REPORTS_FOLDER_MEX_CREAM', instagram: 'IG_USER_MEX_CREAM' },
  { key: 'gold-fusion', label: 'Gold Fusion', data: 'DATA_FOLDER_GOLD_FUSION', reports: 'REPORTS_FOLDER_GOLD_FUSION', instagram: 'IG_USER_GOLD_FUSION' },
];
const META_API = 'https://graph.facebook.com/v21.0';
// Meses con miniaturas y seguidores: los de la evolucion del reporte (el en curso y los tres anteriores). Las URLs de
// las miniaturas de Meta vencen a los pocos dias: cada barrido diario las vuelve a pedir.
const META_MONTHS = 4;
const META_BATCH = 50;
// Instagram no da los seguidores de mas de 30 dias en una sola consulta: cada mes se pide en tramos.
const INSIGHTS_DAYS = 15;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Apps Script corta una ejecucion a los 6 minutos. Convertir y leer las 21 descargas iniciales puede acercarse: lo
// que no alcance queda para el barrido siguiente, que reutiliza lo ya leido.
const TIME_BUDGET_MS = 4.5 * 60 * 1000;
const TIMEZONE = 'America/Lima';
const SWEEP_HOUR = 10;
const SWEEP_HANDLER = 'sweepScheduled';
const SNAPSHOT_PROPERTY = 'SNAPSHOT_FILE_ID';
const SNAPSHOT_NAME = 'Excambiare - barrido del tablero.json';
// Subirla al cambiar aggregateRaw_, toDay_, toNumber_, RAW_COLUMNS, OUTPUT_COLUMNS o TIMEZONE: los meses
// guardados con otra version se vuelven a leer aunque su archivo no haya cambiado.
const SWEEP_VERSION = 3;
const MANUAL_THROTTLE_MS = 60 * 1000;
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_PATTERNS = [
  /\bene(?:ro)?\b/, /\bfeb(?:rero)?\b/, /\bmar(?:zo)?\b/, /\babr(?:il)?\b/, /\bmay(?:o)?\b/, /\bjun(?:io)?\b/,
  /\bjul(?:io)?\b/, /\bago(?:sto)?\b/, /\bse(?:pt?|t)(?:iembre)?\b/, /\boct(?:ubre)?\b/, /\bnov(?:iembre)?\b/, /\bdic(?:iembre)?\b/,
];
// Cabeceras de la descarga de Meta (normalizadas: minusculas y sin tildes). Meta renombra algunas entre
// descargas (Octubre 2026: "Importe gastado" pasa a "Monto gastado"): se acepta cualquiera de la lista.
const RAW_COLUMNS = {
  day: ['dia'],
  ad: ['nombre del anuncio'],
  spend: ['importe gastado (pen)', 'monto gastado (pen)'],
  impressions: ['impresiones'],
  reach: ['alcance'],
  clicks: ['clics en el enlace'],
  resultType: ['tipo de resultado'],
  results: ['resultados'],
  campaign: ['nombre de la campana'],
  adSet: ['nombre del conjunto de anuncios'],
  preview: ['enlace de vista previa'],
  // Las conversaciones se suman aparte de "Resultados": una campana de interaccion o de trafico tambien las inicia.
  conversations: ['conversaciones con mensajes iniciadas'],
  // Opcionales (Generacion de Reporte): seguidores que trajo cada anuncio y el desglose de las interacciones. Solo
  // vienen si la descarga de Meta incluye esas columnas; el barrido avisa cuales encontro en cada archivo (found).
  follows: ['seguimientos de instagram', 'seguidores de instagram', 'nuevos seguidores de instagram', 'seguimientos o me gusta de instagram'],
  plays3s: ['reproducciones de video de 3 segundos', 'reproducciones de 3 segundos', 'reproducciones de video de al menos 3 segundos', 'reproducciones del video de 3 segundos'],
  reactions: ['reacciones a la publicacion', 'reacciones de la publicacion', 'reacciones en la publicacion', 'reacciones a publicaciones', 'reacciones'],
  saves: ['publicaciones guardadas', 'guardados de publicaciones', 'veces que se guardo la publicacion', 'guardados'],
  shares: ['veces que se compartieron las publicaciones', 'publicaciones compartidas', 'veces que se compartio la publicacion', 'compartidos'],
  comments: ['comentarios en publicaciones', 'comentarios de la publicacion', 'comentarios en la publicacion', 'comentarios'],
};
const OPTIONAL_RAW = ['follows', 'plays3s', 'reactions', 'saves', 'shares', 'comments'];
const REQUIRED_RAW = ['day', 'ad', 'spend', 'impressions', 'reach', 'results', 'campaign'];
const SUM_FIELDS = ['spend', 'impressions', 'reach', 'clicks', 'results', 'conversations'].concat(OPTIONAL_RAW);
// Filas que devuelve el Web App: una por dia x campana x conjunto x anuncio (se suman edad y sexo).
const OUTPUT_COLUMNS = ['day', 'campaign', 'adSet', 'ad', 'resultType'].concat(SUM_FIELDS, ['preview']);

function doGet(event) {
  try {
    const params = (event && event.parameter) || {};
    if (params.action !== 'data') throw new Error('Accion no soportada.');
    let snapshot = params.fresh === '1' ? sweep_('manual') : readSnapshot_();
    if (!snapshot) snapshot = sweep_('inicial');
    // Una hoja subida o corregida despues del ultimo barrido se lee al abrir el tablero, sin esperar al
    // disparador de las 10:00 ni al boton Actualizar.
    else if (params.fresh !== '1' && changedSafely_(snapshot)) snapshot = sweep_('archivo nuevo');
    return json_(Object.assign({ ok: true }, snapshot));
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'No se pudo leer la carpeta de datos.' });
  }
}

// Si no se puede revisar la carpeta se sirve el barrido guardado (es lo que habia antes de esta revision).
function changedSafely_(snapshot) {
  try {
    return folderChangedSince_(snapshot);
  } catch (error) {
    console.error(error);
    return false;
  }
}

// Las tres marcas tienen su propia carpeta: basta con que cambie una para rehacer el barrido.
function folderChangedSince_(snapshot) {
  const sweptAt = Date.parse(snapshot.sweptAt) || 0;
  const present = {};
  let changed = false;
  BRANDS.forEach(brand => {
    const files = DriveApp.getFolderById(folderId_(brand.data)).getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.isTrashed()) continue;
      present[file.getId()] = true;
      if (file.getLastUpdated().getTime() > sweptAt) changed = true;
    }
  });
  const months = (snapshot.brands || []).reduce((acc, brand) => acc.concat(brand.months || []), []);
  return changed || months.some(month => month.fileId && !present[month.fileId]);
}

// Disparador diario.
function sweepScheduled() {
  sweep_('automatico');
}

// Ejecutar UNA vez a mano. Borra los disparadores anteriores del barrido para no duplicarlos.
function installSweepTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === SWEEP_HANDLER)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(SWEEP_HANDLER).timeBased().everyDays(1).atHour(SWEEP_HOUR).inTimezone(TIMEZONE).create();
  logSnapshot_(sweep_('instalacion'));
}

// Barrido manual desde el editor, para revisar que los archivos se leen bien.
function probarBarrido() {
  logSnapshot_(sweep_('prueba'));
}

function logSnapshot_(snapshot) {
  console.log('Barrido ' + snapshot.origin + ' ' + snapshot.sweptAt + ' | diario ' + SWEEP_HOUR + ':00 (' + TIMEZONE + ')');
  snapshot.brands.forEach(brand => {
    console.log('== ' + brand.label + (brand.error ? ': ERROR ' + brand.error : ''));
    logBrand_(brand);
  });
}

// Prueba de la conexion con Meta desde el editor (despues de poner META_TOKEN e IG_USER_<MARCA>): no guarda nada.
function probarMeta() {
  if (!metaToken_()) {
    console.log('Falta la propiedad del script META_TOKEN: sin ella el barrido no pide miniaturas ni seguidores a Meta.');
    return;
  }
  const previous = readSnapshot_();
  BRANDS.forEach(brand => {
    const before = ((previous && previous.brands) || []).find(item => item.key === brand.key) || {};
    console.log('== ' + brand.label);
    try {
      const creatives = readCreatives_(before.months || [], null);
      const ids = Object.keys(creatives);
      const withThumb = ids.filter(id => creatives[id].t).length;
      console.log('Artes: ' + ids.length + ' (' + withThumb + ' con miniatura)' + (ids[0] ? ' | ejemplo ' + ids[0] + ': ' + JSON.stringify(creatives[ids[0]]) : ''));
    } catch (error) {
      console.log('Artes: ERROR ' + error);
    }
    try {
      const instagram = readInstagram_(brand, null);
      console.log(instagram ? 'Instagram @' + instagram.username + ': ' + instagram.followers + ' seguidores | ' + JSON.stringify(instagram.months) : 'Instagram: falta la propiedad ' + brand.instagram);
    } catch (error) {
      console.log('Instagram: ERROR ' + error);
    }
  });
}

function logBrand_(brand) {
  if (brand.creatives) console.log('Artes con datos de Meta: ' + Object.keys(brand.creatives).length + (brand.metaError ? ' (' + brand.metaError + ')' : ''));
  if (brand.instagram) console.log('Instagram @' + brand.instagram.username + ': ' + brand.instagram.followers + ' seguidores');
  brand.months.forEach(month => {
    if (month.error) {
      console.log(month.name + ' ' + month.year + ': ERROR ' + month.error);
      return;
    }
    const duplicates = month.duplicates.length ? ' | duplicados: ' + month.duplicates.join(', ') : '';
    if (!month.rows.length) {
      console.log(month.name + ' ' + month.year + ': sin filas con fecha valida' + duplicates);
      return;
    }
    const index = name => month.columns.indexOf(name);
    const spend = month.rows.reduce((sum, row) => sum + row[index('spend')], 0);
    const days = month.rows.map(row => row[index('day')]).sort();
    console.log(month.name + ' ' + month.year + ': ' + month.rows.length + ' filas, gasto S/ ' + spend.toFixed(2) +
      ', del ' + days[0] + ' al ' + days[days.length - 1] + duplicates);
  });
  brand.ignored.forEach(item => console.log('Ignorado: ' + item.fileName + ' -> ' + item.reason));
  console.log('Reportes en Drive: ' + brand.reports.files.length + (brand.reports.error ? ' (' + brand.reports.error + ')' : ''));
}

function sweep_(origin) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const previous = readSnapshot_();
    if (origin === 'manual' && previous && Date.now() - Date.parse(previous.sweptAt) < MANUAL_THROTTLE_MS) return previous;
    const deadline = Date.now() + TIME_BUDGET_MS;
    // Cada marca por separado: una carpeta mal configurada no deja sin datos a las otras dos.
    const brands = BRANDS.map(brand => {
      const before = ((previous && previous.brands) || []).find(item => item.key === brand.key) || null;
      const entry = { key: brand.key, label: brand.label, months: [], ignored: [], reports: { folder: null, files: [] }, error: null };
      try {
        const data = readMonths_(brand, before, Boolean(previous && previous.version === SWEEP_VERSION), deadline);
        entry.months = data.months;
        entry.ignored = data.ignored;
      } catch (error) {
        console.error(brand.label + ': ' + error);
        entry.error = String((error && error.message) || error);
        if (before) entry.months = before.months;
      }
      try {
        entry.reports = readReports_(brand);
      } catch (error) {
        console.error(brand.label + ' (reportes): ' + error);
        entry.reports = Object.assign({}, before ? before.reports : { folder: null, files: [] }, { error: 'No se pudo leer la carpeta de reportes.' });
      }
      if (metaToken_()) readMeta_(brand, entry, before);
      return entry;
    });
    const snapshot = { version: SWEEP_VERSION, sweptAt: new Date().toISOString(), origin, brands };
    writeSnapshot_(snapshot);
    return snapshot;
  } finally {
    lock.releaseLock();
  }
}

// Un archivo por mes: si hay varios del mismo mes se usa el editado mas recientemente y se avisa.
// Un mes ya cerrado cuyo archivo no cambio desde el barrido anterior reutiliza sus filas sin abrir la hoja.
function readMonths_(brand, beforeBrand, sameVersion, deadline) {
  const files = DriveApp.getFolderById(folderId_(brand.data)).getFiles();
  const byMonth = {};
  const ignored = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.isTrashed()) continue;
    if (file.getMimeType() !== MimeType.GOOGLE_SHEETS && file.getMimeType() !== XLSX_MIME) {
      ignored.push({ fileName: file.getName(), reason: 'No es una hoja de calculo (Google Sheets o .xlsx).' });
      continue;
    }
    const period = detectPeriod_(file.getName());
    if (!period) {
      ignored.push({ fileName: file.getName(), reason: 'El nombre no indica mes y ano.' });
      continue;
    }
    const current = byMonth[period.key];
    if (!current) byMonth[period.key] = { period, file, duplicates: [] };
    else if (file.getLastUpdated() > current.file.getLastUpdated()) {
      current.duplicates.push(current.file.getName());
      current.file = file;
    } else current.duplicates.push(file.getName());
  }
  // Meses del barrido anterior que se leyeron bien, por archivo.
  const before = {};
  ((beforeBrand && beforeBrand.months) || []).forEach(month => { if (!month.error && month.rows.length) before[month.fileId] = month; });
  const recentKey = previousMonthKey_();
  const months = Object.keys(byMonth).sort().map(key => {
    const { period, file, duplicates } = byMonth[key];
    const entry = {
      name: MONTHS[period.month - 1], year: period.year, month: period.month,
      fileId: file.getId(), fileName: file.getName(), modifiedTime: file.getLastUpdated().toISOString(),
      duplicates, columns: OUTPUT_COLUMNS, rows: [], found: [], error: null,
    };
    const old = before[entry.fileId];
    const unchanged = Boolean(old && old.modifiedTime === entry.modifiedTime && Array.isArray(old.rows) && Array.isArray(old.columns));
    // El mes en curso y el anterior se releen siempre: el anterior se completa los primeros dias del mes y
    // Drive tarda en actualizar la fecha de edicion de un Sheet.
    if (unchanged && sameVersion && key < recentKey && JSON.stringify(old.columns) === JSON.stringify(OUTPUT_COLUMNS)) {
      entry.rows = old.rows;
      entry.found = old.found || [];
      return entry;
    }
    if (Date.now() > deadline) {
      // Sin tiempo para leerlo en esta ejecucion: se conserva lo anterior y se lee en el proximo barrido.
      if (unchanged) {
        entry.rows = old.rows;
        entry.found = old.found || [];
      } else entry.error = 'Pendiente: se leera en el proximo barrido (limite de tiempo de Apps Script).';
      return entry;
    }
    let opened = null;
    try {
      opened = openSpreadsheet_(file);
      const read = aggregateRaw_(rawValues_(opened.spreadsheet), opened.spreadsheet.getSpreadsheetTimeZone());
      entry.rows = read.rows;
      entry.found = read.found;
    } catch (error) {
      if (unchanged && old.rows.length) {
        // El archivo no cambio desde el barrido anterior: un fallo pasajero de Google no borra sus filas.
        console.error(entry.fileName + ': ' + error);
        entry.columns = old.columns;
        entry.rows = old.rows;
        entry.found = old.found || [];
      } else {
        entry.error = String((error && error.message) || error);
      }
    } finally {
      if (opened) opened.cleanup();
    }
    return entry;
  });
  return { months, ignored };
}

// Una Hoja de Google se abre directo. Un .xlsx se convierte en una copia temporal (servicio avanzado Drive API) que se
// manda a la papelera al terminar de leerla.
function openSpreadsheet_(file) {
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) return { spreadsheet: SpreadsheetApp.openById(file.getId()), cleanup: () => {} };
  if (typeof Drive === 'undefined') throw new Error('Para leer .xlsx activa el servicio avanzado "Drive API" (Servicios > + > Drive API).');
  const name = 'Temporal - ' + file.getName();
  const copy = Drive.Files.create
    ? Drive.Files.create({ name, mimeType: MimeType.GOOGLE_SHEETS }, file.getBlob())
    : Drive.Files.insert({ title: name, mimeType: MimeType.GOOGLE_SHEETS }, file.getBlob());
  return {
    spreadsheet: SpreadsheetApp.openById(copy.id),
    cleanup: () => { try { DriveApp.getFileById(copy.id).setTrashed(true); } catch (error) { console.error(error); } },
  };
}

// Mes anterior al de hoy en Lima ('yyyy-MM'): ese y los siguientes no se reutilizan del barrido anterior.
function previousMonthKey_() {
  const [year, month] = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-M').split('-').map(Number);
  return month === 1 ? (year - 1) + '-12' : year + '-' + String(month - 1).padStart(2, '0');
}

// La pestana con la descarga es la que tiene las cabeceras "Dia" e "Importe gastado (PEN)" (o "Monto gastado").
function rawValues_(spreadsheet) {
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i += 1) {
    const values = sheets[i].getDataRange().getValues();
    const headerRow = values.findIndex(row => row.some(cell => isColumn_('day', cell)) && row.some(cell => isColumn_('spend', cell)));
    if (headerRow >= 0) return values.slice(headerRow);
  }
  throw new Error('No se encontro la descarga de Meta (columnas "Dia" e "Importe gastado (PEN)" o "Monto gastado (PEN)"). Un resumen por conjunto sin "Dia" no sirve: hace falta el Raw Data Report diario.');
}

function isColumn_(key, cell) {
  return RAW_COLUMNS[key].indexOf(normalize_(cell)) >= 0;
}

// Suma edad y sexo. El alcance sumado es aproximado: Meta no permite sumar personas unicas entre filas.
// Devuelve las filas y las columnas opcionales que trajo la descarga (found).
function aggregateRaw_(values, timeZone) {
  const headers = values[0].map(cell => normalize_(cell));
  const col = {};
  Object.keys(RAW_COLUMNS).forEach(key => { col[key] = headers.findIndex(cell => RAW_COLUMNS[key].indexOf(cell) >= 0); });
  const missing = REQUIRED_RAW.filter(key => col[key] < 0).map(key => RAW_COLUMNS[key].join(' / '));
  if (missing.length) throw new Error('Faltan columnas: ' + missing.join(', '));

  // Cada fecha se repite en miles de filas (edad x sexo x anuncio): se formatea una sola vez.
  const days = new Map();
  const dayOf = value => {
    if (!(value instanceof Date)) return toDay_(value, timeZone);
    const time = value.getTime();
    if (!days.has(time)) days.set(time, toDay_(value, timeZone));
    return days.get(time);
  };

  const groups = {};
  values.slice(1).forEach(row => {
    const day = dayOf(row[col.day]);
    if (!day) return;
    const text = key => (col[key] < 0 ? '' : String(row[col[key]] || '').trim());
    const key = [day, text('campaign'), text('adSet'), text('ad')].join('|');
    let group = groups[key];
    if (!group) {
      group = groups[key] = { day, campaign: text('campaign'), adSet: text('adSet'), ad: text('ad'), resultType: '', preview: '' };
      SUM_FIELDS.forEach(field => { group[field] = 0; });
    }
    if (!group.resultType) group.resultType = text('resultType');
    if (!group.preview && /^https:\/\//.test(text('preview'))) group.preview = text('preview');
    SUM_FIELDS.forEach(field => { group[field] += col[field] < 0 ? 0 : toNumber_(row[col[field]]); });
  });

  const rows = Object.keys(groups).sort().map(key => {
    const group = groups[key];
    group.spend = Math.round(group.spend * 100) / 100;
    return OUTPUT_COLUMNS.map(field => group[field]);
  });
  return { rows, found: OPTIONAL_RAW.filter(key => col[key] >= 0) };
}

// Una celda de fecha llega como Date: se formatea en la zona de la hoja para no correr el dia.
function toDay_(value, timeZone) {
  if (value instanceof Date) return Utilities.formatDate(value, timeZone || TIMEZONE, 'yyyy-MM-dd');
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : null;
}

function toNumber_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const number = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : 0;
}

function readReports_(brand) {
  const folder = DriveApp.getFolderById(folderId_(brand.reports));
  const files = folder.getFiles();
  const list = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.isTrashed()) continue;
    list.push({
      id: file.getId(), title: file.getName(), mimeType: file.getMimeType(), sizeBytes: file.getSize(),
      modifiedTime: file.getLastUpdated().toISOString(),
    });
  }
  return { folder: { id: folder.getId(), name: folder.getName(), url: folder.getUrl() }, files: list };
}

// ── Meta (opcional) ──────────────────────────────────────────────────────
// Un error de la API no deja a la marca sin lo que ya tenia: se conserva lo del barrido anterior y se avisa en
// metaError.
function readMeta_(brand, entry, before) {
  const errors = [];
  try {
    entry.creatives = readCreatives_(entry.months, before && before.creatives);
  } catch (error) {
    console.error(brand.label + ' (artes de Meta): ' + error);
    entry.creatives = (before && before.creatives) || {};
    errors.push('artes: ' + ((error && error.message) || error));
  }
  try {
    const instagram = readInstagram_(brand, before && before.instagram);
    if (instagram) entry.instagram = instagram;
  } catch (error) {
    console.error(brand.label + ' (Instagram): ' + error);
    if (before && before.instagram) entry.instagram = before.instagram;
    errors.push('Instagram: ' + ((error && error.message) || error));
  }
  if (errors.length) entry.metaError = errors.join(' | ');
}

function metaToken_() {
  return String(PropertiesService.getScriptProperties().getProperty('META_TOKEN') || '').trim();
}

function graph_(path, params) {
  const query = Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&');
  const response = UrlFetchApp.fetch(META_API + '/' + path + '?' + query + '&access_token=' + encodeURIComponent(metaToken_()), { muteHttpExceptions: true });
  let body = {};
  try {
    body = JSON.parse(response.getContentText() || '{}');
  } catch (error) {
    body = {};
  }
  if (response.getResponseCode() >= 400 || body.error) {
    throw new Error('Meta: ' + ((body.error && body.error.message) || 'HTTP ' + response.getResponseCode()));
  }
  return body;
}

// Varios IDs en una consulta (?ids=). Si Meta rechaza el lote (un anuncio de otra cuenta o sin permiso) se piden de a
// uno para no perder los demas.
function graphMany_(ids, params) {
  const result = {};
  for (let start = 0; start < ids.length; start += META_BATCH) {
    const part = ids.slice(start, start + META_BATCH);
    try {
      Object.assign(result, graph_('', Object.assign({ ids: part.join(',') }, params)));
    } catch (error) {
      if (part.length === 1) continue;
      part.forEach(id => {
        try {
          result[id] = graph_(id, params);
        } catch (single) {
          console.error(id + ': ' + single);
        }
      });
    }
  }
  return result;
}

// Meses 'yyyy-MM' del en curso hacia atras.
function recentMonthKeys_(count) {
  const [year, month] = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-M').split('-').map(Number);
  const keys = [];
  for (let back = 0; back < count; back += 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1));
    keys.push(date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0'));
  }
  return keys;
}

// El enlace de vista previa de la descarga trae el ID del anuncio (facebook.com/?feed_demo_ad=<id>).
function adIdOf_(url) {
  const match = String(url || '').match(/[?&]feed_demo_ad=(\d+)/);
  return match ? match[1] : '';
}

// Miniatura y formato de cada anuncio de los ultimos meses: { <id del anuncio>: { f: formato, t: miniatura, p: enlace } }.
// El anuncio da su creatividad; la publicacion de Instagram (si la tiene) da el formato exacto y la portada.
function readCreatives_(months, before) {
  const keys = recentMonthKeys_(META_MONTHS);
  const seen = {};
  months.forEach(month => {
    if (keys.indexOf(month.year + '-' + String(month.month).padStart(2, '0')) < 0 || !Array.isArray(month.rows)) return;
    const at = (month.columns || []).indexOf('preview');
    if (at < 0) return;
    month.rows.forEach(row => {
      const id = adIdOf_(row[at]);
      if (id) seen[id] = true;
    });
  });
  const adIds = Object.keys(seen);
  const creatives = {};
  if (!adIds.length) return creatives;
  const ads = graphMany_(adIds, { fields: 'creative{id,object_type,image_url,video_id,effective_instagram_media_id}' });
  const creativeOf = {};
  const mediaOf = {};
  adIds.forEach(id => {
    const creative = ads[id] && ads[id].creative;
    if (!creative) return;
    creatives[id] = { f: creativeFormat_(creative), t: creative.image_url || '' };
    if (creative.id) creativeOf[id] = creative.id;
    if (creative.effective_instagram_media_id) mediaOf[id] = creative.effective_instagram_media_id;
  });
  // La miniatura de la creatividad sale en 64 px si no se pide el tamano.
  const thumbs = graphMany_(unique_(Object.keys(creativeOf).map(id => creativeOf[id])), { fields: 'thumbnail_url', thumbnail_width: 320, thumbnail_height: 320 });
  Object.keys(creativeOf).forEach(id => {
    const thumb = thumbs[creativeOf[id]] && thumbs[creativeOf[id]].thumbnail_url;
    if (thumb && !creatives[id].t) creatives[id].t = thumb;
  });
  // Requiere instagram_basic sobre la cuenta de Instagram: sin ese permiso queda lo que dijo la creatividad.
  try {
    const media = graphMany_(unique_(Object.keys(mediaOf).map(id => mediaOf[id])), { fields: 'media_type,media_product_type,thumbnail_url,media_url,permalink' });
    Object.keys(mediaOf).forEach(id => {
      const item = media[mediaOf[id]];
      if (!item) return;
      creatives[id].f = instagramFormat_(item) || creatives[id].f;
      const cover = item.thumbnail_url || (item.media_type !== 'VIDEO' ? item.media_url : '');
      if (cover) creatives[id].t = cover;
      if (item.permalink) creatives[id].p = item.permalink;
    });
  } catch (error) {
    console.error('Publicaciones de Instagram: ' + error);
  }
  // Un anuncio que Meta ya no devolvio conserva lo del barrido anterior.
  adIds.forEach(id => {
    if (!creatives[id] && before && before[id]) creatives[id] = before[id];
  });
  return creatives;
}

function creativeFormat_(creative) {
  if (creative.video_id || creative.object_type === 'VIDEO') return 'Video';
  if (creative.object_type === 'PHOTO' || creative.image_url) return 'Imagen';
  return '';
}

function instagramFormat_(item) {
  if (item.media_product_type === 'REELS') return 'Reel';
  if (item.media_type === 'CAROUSEL_ALBUM') return 'Carrusel';
  if (item.media_type === 'VIDEO') return 'Video';
  if (item.media_type === 'IMAGE') return 'Imagen';
  return '';
}

function unique_(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

// Seguidores de Instagram de la marca (propiedad IG_USER_<MARCA> con el ID de la cuenta profesional):
// { username, followers, months: { 'yyyy-MM': { follows, unfollows, through, complete, end } } }.
// follows y unfollows salen de la metrica follows_and_unfollows; end es el total de seguidores al ultimo barrido
// del mes (Instagram no da el total de fechas pasadas: el historial se arma barrido a barrido).
function readInstagram_(brand, before) {
  const id = String(PropertiesService.getScriptProperties().getProperty(brand.instagram) || '').trim();
  if (!id) return null;
  const profile = graph_(id, { fields: 'username,followers_count' });
  const months = Object.assign({}, (before && before.months) || {});
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const keys = recentMonthKeys_(META_MONTHS);
  keys.forEach((key, index) => {
    const old = months[key];
    // Un mes que ya se leyo completo no se vuelve a pedir.
    if (old && old.complete) return;
    const [year, month] = key.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    // Hasta ayer: el dia en curso todavia no termina.
    const lastDay = index === 0 ? Number(today.slice(8, 10)) - 1 : last;
    const counts = lastDay >= 1 ? followsBetween_(id, year, month, 1, lastDay) : { follows: 0, unfollows: 0 };
    months[key] = {
      follows: counts.follows,
      unfollows: counts.unfollows,
      through: lastDay >= 1 ? key + '-' + String(lastDay).padStart(2, '0') : '',
      complete: lastDay === last,
      end: index === 0 ? profile.followers_count : (old && old.end != null ? old.end : null),
    };
  });
  // Solo los meses de la evolucion: el JSON del barrido no crece mes a mes.
  Object.keys(months).forEach(key => {
    if (keys.indexOf(key) < 0) delete months[key];
  });
  return { username: profile.username || '', followers: profile.followers_count, months, at: new Date().toISOString() };
}

// Suma follows_and_unfollows del dia `from` al `to` (inclusive) del mes, en tramos de INSIGHTS_DAYS. Los limites van
// en hora de Lima (UTC-5): el dia empieza a las 05:00 UTC.
function followsBetween_(id, year, month, from, to) {
  const total = { follows: 0, unfollows: 0 };
  for (let start = from; start <= to; start += INSIGHTS_DAYS) {
    const end = Math.min(start + INSIGHTS_DAYS - 1, to);
    const body = graph_(id + '/insights', {
      metric: 'follows_and_unfollows',
      period: 'day',
      metric_type: 'total_value',
      breakdown: 'follow_type',
      since: Date.UTC(year, month - 1, start, 5) / 1000,
      until: Date.UTC(year, month - 1, end + 1, 5) / 1000,
    });
    const metric = (body.data || [])[0] || {};
    const breakdown = ((metric.total_value && metric.total_value.breakdowns) || [])[0] || {};
    (breakdown.results || []).forEach(item => {
      const type = String((item.dimension_values || [])[0] || '').toUpperCase();
      // FOLLOWER = cuentas que empezaron a seguir; NON_FOLLOWER = las que dejaron de seguir.
      if (type.indexOf('NON') >= 0) total.unfollows += Number(item.value) || 0;
      else total.follows += Number(item.value) || 0;
    });
  }
  return total;
}

// Si el nombre no trae ano se asume el ano en curso; si ese mes aun no llega, el ano anterior.
function detectPeriod_(name) {
  const text = normalize_(name)
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[_.\-]+/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2');
  const monthIndex = earliestMonth_(text);
  if (monthIndex < 0) return null;
  const yearMatch = text.match(/\b(20\d{2})\b/);
  let year = yearMatch ? Number(yearMatch[1]) : null;
  if (!year) {
    const now = new Date();
    const currentYear = Number(Utilities.formatDate(now, TIMEZONE, 'yyyy'));
    const currentMonth = Number(Utilities.formatDate(now, TIMEZONE, 'M'));
    year = monthIndex + 1 > currentMonth ? currentYear - 1 : currentYear;
  }
  return { key: year + '-' + String(monthIndex + 1).padStart(2, '0'), year, month: monthIndex + 1 };
}

// Si el nombre trae varias palabras de mes, gana la que aparece primero en el texto. Acepta "Setiembre".
function earliestMonth_(text) {
  let best = -1;
  let position = Infinity;
  MONTH_PATTERNS.forEach((pattern, index) => {
    const match = text.match(pattern);
    if (match && match.index < position) {
      best = index;
      position = match.index;
    }
  });
  return best;
}

// Los IDs de las carpetas viven en las propiedades del script: pegar una version nueva del .gs no los borra.
function folderId_(name) {
  const id = String(PropertiesService.getScriptProperties().getProperty(name) || '').trim();
  if (!id) throw new Error('Falta la propiedad del script ' + name + ' (Configuracion del proyecto > Propiedades del script)');
  return id;
}

function snapshotFile_() {
  const id = PropertiesService.getScriptProperties().getProperty(SNAPSHOT_PROPERTY);
  if (!id) return null;
  try {
    const file = DriveApp.getFileById(id);
    return file.isTrashed() ? null : file;
  } catch (error) {
    return null;
  }
}

function readSnapshot_() {
  const file = snapshotFile_();
  if (!file) return null;
  try {
    const snapshot = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    // Un barrido guardado con otro formato (sin marcas o sin columnas) se descarta y se vuelve a leer.
    const valid = Array.isArray(snapshot.brands) && snapshot.brands.every(brand => Array.isArray(brand.months) && brand.months.every(month => month.columns));
    return valid ? snapshot : null;
  } catch (error) {
    return null;
  }
}

// El JSON del barrido queda en Mi unidad de la cuenta que publica, fuera de las carpetas de datos y reportes.
function writeSnapshot_(snapshot) {
  const content = JSON.stringify(snapshot);
  const file = snapshotFile_();
  if (file) {
    file.setContent(content);
    return;
  }
  const created = DriveApp.createFile(SNAPSHOT_NAME, content, MimeType.PLAIN_TEXT);
  PropertiesService.getScriptProperties().setProperty(SNAPSHOT_PROPERTY, created.getId());
}

function normalize_(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
