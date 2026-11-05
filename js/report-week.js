(function () {
  // Generacion de Reporte: el PDF mensual de publicidad de las tres marcas de Inversiones Excambiare con el diseño del
  // modelo de la agencia (laminas 16:9, tarjetas blancas de borde fino y acentos en azul).
  //
  // Laminas: portada; resumen ejecutivo; crecimiento de seguidores y su evolucion; por cada marca y objetivo, una
  // lamina de evolucion (mes a mes y por que cambio el costo) y una de artes (miniatura, formato y datos, sin veredicto);
  // conclusiones; proximos pasos por marca; cierre.
  //
  // Lleva las tres marcas en el mismo PDF: lee cada una con ExcambiareData.brandSnapshot() sin cambiar la marca activa
  // del tablero. Los numeros salen del barrido de Meta. Con token de Meta en el Web App llegan tambien la miniatura y el
  // formato de cada arte (data.creatives) y los seguidores nuevos y bajas de Instagram (data.instagram); sin el, el
  // formato se deduce de las reproducciones de 3 s y los seguidores se escriben sobre la lamina. Los textos vienen
  // propuestos con lo que dicen los numeros y se editan sobre la lamina; todo queda guardado por mes en este navegador.
  //
  // El costo por resultado se lee como CPM ÷ resultados por mil impresiones: si cambio porque cambio el CPM, la causa
  // es la subasta o el publico; si cambio porque cada mil impresiones dieron mas o menos resultados, son los artes.
  //
  // El template es propio de Excambiare: cada tablero de marca tiene el suyo, adaptado por la marca.
  const CLIENT = 'Excambiare';
  const NOTES_KEY = 'excambiare-report-notes-v2';
  const PAGE_WIDTH = 1280;
  const LOGO = 'assets/logo-lima-retail.png';
  const EVOLUTION_MONTHS = 4;
  const MAX_ADS = 6;
  // Largo del "Que funciona" de la lamina de artes (caracteres): mas texto empuja la tabla fuera de la lamina.
  const ARTS_TEXT_MAX = 620;
  // Largo del analisis de la lamina de cada objetivo ("Que funciono y por que").
  const SECTION_TEXT_MAX = 720;
  // Mejores anuncios de la lamina de cada objetivo (con su pieza).
  const BEST_ADS = 3;
  // Un cambio menor a esto se lee como estable.
  const STEADY = 0.05;
  // Veredicto de cada arte: su costo por resultado contra el del objetivo en el mes. Con muy poca entrega no se juzga.
  // Renovar: ya corria el mes anterior y ahora cuesta bastante mas (desgaste de la pieza).
  const VERDICT = { minSpend: 3, minImpressions: 500, replicate: 0.8, adjust: 1.15, discard: 1.5, discardShare: 0.05, fatigue: 1.4 };
  // En Trafico al perfil lo que se busca son seguidores: desde estos seguidores en el mes, cada arte se juzga por su costo
  // por seguidor y no por el de la visita.
  const MIN_FOLLOWS = 10;
  // Desglose de las interacciones que trae la descarga (solo las columnas que vinieron: una que falta no es un 0).
  const ENGAGEMENT = [['plays3s', 'reprod.'], ['reactions', 'reacc.'], ['saves', 'guard.'], ['shares', 'compart.'], ['comments', 'coment.']];
  // Orden y nombres del modelo; el color identifica a la marca en los graficos de seguidores.
  const BRANDS = [
    { key: 'mex-cream', name: 'MEX', color: '#2563eb' },
    { key: 'gold-fusion', name: 'Gold Fusion', color: '#d97706' },
    { key: 'sol-y-tierra', name: 'Sol y Tierra', color: '#059669' },
  ];
  // Un objetivo por par de laminas, en el orden del modelo. El objetivo sale del nombre de la campaña (js/data-source.js).
  const SECTIONS = [
    { key: 'reconocimiento', title: 'Reconocimiento', sub: 'Objetivo de reproducciones de video (ThruPlay)', noun: 'Reproducciones', unit: 'reproducciones', one: 'reproducción', abbr: 'Reprod.', color: '#2563eb' },
    { key: 'interaccion', title: 'Interacción', sub: 'Objetivo de interacciones con la publicación', noun: 'Interacciones', unit: 'interacciones', one: 'interacción', abbr: 'Interac.', color: '#0f9b8e' },
    { key: 'trafico-perfil', title: 'Tráfico al perfil', sub: 'Objetivo de visitas al perfil de Instagram', noun: 'Visitas', unit: 'visitas', one: 'visita', abbr: 'Visitas', color: '#2563eb' },
  ];
  const OPTIONAL = ['follows', 'plays3s', 'reactions', 'saves', 'shares', 'comments'];
  const SUMS = ['spend', 'impressions', 'reach', 'results', 'clicks', ...OPTIONAL];
  const COST_COLOR = '#c8102e';
  const FORMAT_ICON = { Video: 'play', Reel: 'play', Carrusel: 'layers', Imagen: 'image', 'Estático': 'image' };
  const FORMAT_PLURAL = { Video: 'los videos', Reel: 'los reels', Carrusel: 'los carruseles', Imagen: 'las imágenes', 'Estático': 'las piezas estáticas' };

  const ICONS = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    play: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m10 8 6 4-6 4z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.pulse}</svg>`;

  let selectedMonth = '';
  let wired = false;

  const api = () => window.ExcambiareData || null;
  const esc = value => api().esc(value);
  const finite = value => value != null && value !== '' && Number.isFinite(Number(value));

  // ── Formatos ("S/. 192", "S/. 0.0096", "19,998", "+89", "−12%"): la moneda y los miles como en el resto del tablero ──
  const integer = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
  // Montos con separador de miles es-PE y decimales fijos (un Intl.NumberFormat por cantidad de decimales).
  const decimalFormats = new Map();
  const decimals = (value, digits) => {
    if (!decimalFormats.has(digits)) decimalFormats.set(digits, new Intl.NumberFormat('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
    return decimalFormats.get(digits).format(Number(value));
  };
  const sign = value => (value > 0 ? '+' : value < 0 ? '−' : '');
  const num = value => (finite(value) ? integer.format(Math.round(value)) : '—');
  const signed = value => (finite(value) ? `${sign(Math.round(value))}${integer.format(Math.abs(Math.round(value)))}` : '—');
  const money = value => (finite(value) ? `S/. ${integer.format(Math.round(value))}` : '—');
  const money2 = value => (finite(value) ? `S/. ${decimals(value, 2)}` : '—');
  const signedMoney = value => (finite(value) ? `${sign(Math.round(value))}S/. ${integer.format(Math.abs(Math.round(value)))}` : '—');
  const cost = value => (finite(value) && value > 0 ? `S/. ${decimals(value, value < 1 ? 4 : 2)}` : '—');
  const costShort = value => (finite(value) && value > 0 ? `S/. ${decimals(value, value < 1 ? 3 : 2)}` : '—');
  const compact = value => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : integer.format(Math.round(value)));
  const share = (part, total) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—');
  const pctText = value => (finite(value) ? `${sign(Math.round(value * 100))}${Math.abs(Math.round(value * 100))}%` : '—');
  const pctAbs = value => `${Math.abs(Math.round(value * 100))}%`;
  const times = value => `${decimals(value, 1)} veces`;
  const rateText = value => (finite(value) ? decimals(value, value < 10 ? 1 : 0) : '—');
  // Cambio relativo; null si falta alguno de los dos o el anterior es 0.
  const change = (current, previous) => (finite(current) && finite(previous) && Number(previous) > 0 ? current / previous - 1 : null);
  const pageNumber = value => String(value).padStart(2, '0');
  const list = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] || '');
  const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
  const sumOf = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  const activity = row => Number(row.spend) > 0 || Number(row.impressions) > 0;
  // Igual que el normalize de js/data-source.js: las vistas previas guardadas por nombre usan esta llave.
  const normalizeName = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const monthIndex = key => Number(key.slice(5)) - 1;
  const monthLong = key => api().MONTHS[monthIndex(key)].toLowerCase();
  const monthShort = key => api().SHORT_MONTHS[monthIndex(key)];

  // ── Periodo: el mes elegido, en la misma ventana (1 al ultimo dia con datos) para todas las marcas ──
  const brandData = key => api()?.brandSnapshot?.(key) || null;
  const monthOf = (key, monthKey) => (brandData(key)?.months || []).find(month => month.key === monthKey && !month.error) || null;

  // ok: hay descarga y se leyo; missing: no hay archivo de ese mes en la carpeta; error: el archivo no se pudo leer.
  function monthStatus(brandKey, monthKey) {
    const month = (brandData(brandKey)?.months || []).find(item => item.key === monthKey);
    if (!month) return 'missing';
    return month.error ? 'error' : 'ok';
  }

  function shiftMonth(monthKey, amount) {
    const [year, month] = monthKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + amount, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function periods() {
    const keys = new Set();
    BRANDS.forEach(brand => (brandData(brand.key)?.months || []).forEach(month => { if (month.hasData && !month.error) keys.add(month.key); }));
    const sorted = [...keys].sort().reverse();
    return sorted.map((key, index) => {
      const [year, monthNumber] = key.split('-').map(Number);
      const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      const months = BRANDS.map(brand => monthOf(brand.key, key)).filter(Boolean);
      const lastDay = Math.max(...months.map(month => month.lastDay || 0));
      // Un mes anterior al ultimo con datos ya termino aunque su descarga no llegue al ultimo dia.
      const closed = index > 0 || lastDay === days;
      const to = closed ? days : lastDay;
      const name = api().MONTHS[monthNumber - 1];
      const short = api().SHORT_MONTHS[monthNumber - 1].toLowerCase();
      return {
        key,
        year,
        monthNumber,
        to,
        closed,
        name,
        short,
        option: `${name} ${year}${closed ? '' : ` · 1–${to} (en curso)`}`,
        labels: {
          range: closed ? `${name} ${year}` : `1 – ${to} ${name} ${year}`,
          // Recuadro con las fechas, arriba a la derecha de las laminas (como en las plantillas del equipo).
          badge: `1 – ${to} ${short} ${year}`,
          window: closed ? `${name.toLowerCase()} completo` : `1 – ${to} ${short}.`,
          days: closed ? '' : `1-${to}`,
          source: `Fuente: Meta Ads · ${closed ? `${name.toLowerCase()} ${year}` : `1 – ${to} ${short} ${year}`}`,
          followersSource: `Fuente: Meta Ads + Instagram · ${closed ? `${name.toLowerCase()} ${year}` : `1 – ${to} ${short} ${year}`}`,
          footer: `${CLIENT} · Reporte Meta Ads · ${closed ? `${name} ${year}` : `1-${to} ${name} ${year}`}`,
          note: closed
            ? `**Datos de ${name.toLowerCase()} ${year}.** Comparación mes a mes con los tres meses anteriores.`
            : `**Datos del período 1 – ${to} de ${name.toLowerCase()}.** Cada mes anterior se compara en la misma ventana (1-${to}).`,
          file: `${name}${year}${closed ? '' : `_1-${to}`}`,
        },
      };
    });
  }

  // Filas de una marca en un mes, del dia 1 al ultimo dia de la ventana (en un mes cerrado, el mes completo).
  function windowRows(brandKey, monthKey, period) {
    const month = monthOf(brandKey, monthKey);
    if (!month) return { month: null, rows: [] };
    const to = period.closed ? month.daysInMonth : Math.min(period.to, month.daysInMonth);
    return { month, rows: month.rows.filter(row => row.d >= 1 && row.d <= to) };
  }

  function totals(rows) {
    const sum = Object.fromEntries(SUMS.map(field => [field, sumOf(rows, field)]));
    sum.costPerResult = sum.results > 0 ? sum.spend / sum.results : null;
    sum.cpm = sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : null;
    // Resultados por cada mil impresiones: cuanto responde la gente a los artes, sin importar lo que costo mostrarlos.
    sum.rate = sum.impressions > 0 ? (sum.results / sum.impressions) * 1000 : null;
    sum.frequency = sum.reach > 0 ? sum.impressions / sum.reach : null;
    return sum;
  }

  // Promedio de varios meses: inversion y resultados por mes; costo, CPM y tasa ponderados por lo invertido.
  function averageOf(points) {
    const all = totals(points.flatMap(point => point.rows));
    return { ...all, spend: all.spend / points.length, results: all.results / points.length, reach: all.reach / points.length };
  }

  // El costo cambia por el CPM o por la tasa de resultados: gana el que mas se movio (en escala logaritmica, asi un
  // +50% y un −33% pesan lo mismo).
  function driverOf(current, previous) {
    const cpmChange = change(current?.cpm, previous?.cpm);
    const rateChange = change(current?.rate, previous?.rate);
    if (cpmChange === null || rateChange === null) return { cpmChange, rateChange, main: null };
    return { cpmChange, rateChange, main: Math.abs(Math.log(1 + rateChange)) >= Math.abs(Math.log(1 + cpmChange)) ? 'rate' : 'cpm' };
  }

  // El enlace de vista previa de la descarga trae el ID del anuncio (facebook.com/?feed_demo_ad=<id>); el de las hojas
  // que escribe la API lo lleva al final, despues de # (fb.me/...#feed_demo_ad=<id>).
  const adIdOf = url => (String(url || '').match(/[?&#]feed_demo_ad=(\d+)/) || [])[1] || '';
  // Formato de una pieza de "06 Artes" por su tipo de archivo, y su miniatura de Drive.
  const ARTE_FORMAT = { video: 'Video', imagen: 'Imagen', carrusel: 'Carrusel' };
  const driveThumb = (id, size) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;

  // Sin datos de Meta el formato se deduce de las reproducciones de 3 s: un video las tiene en buena parte de sus
  // impresiones. Sin esa columna en la descarga no se dice nada.
  const guessFormat = (sum, found) => (!found.includes('plays3s') || !(sum.impressions > 0) ? '' : sum.plays3s / sum.impressions >= 0.05 ? 'Video' : 'Estático');

  // Anuncios de unas filas por nombre (el mismo arte en varios conjuntos suma), con su vista previa (la del mismo
  // anuncio en otro mes si Meta la dejo vacia), su miniatura y su formato.
  function adsOf(rows, data, found) {
    const byName = new Map();
    rows.forEach(row => {
      const key = normalizeName(row.ad);
      if (!key) return;
      if (!byName.has(key)) byName.set(key, { key, name: String(row.ad).trim(), rows: [], preview: '', ids: [] });
      const ad = byName.get(key);
      ad.rows.push(row);
      if (!ad.preview && /^https:\/\//.test(row.preview || '')) ad.preview = row.preview;
      const id = adIdOf(row.preview);
      if (id && !ad.ids.includes(id)) ad.ids.push(id);
    });
    return [...byName.values()].map(ad => {
      const sum = totals(ad.rows);
      const preview = ad.preview || data?.previews?.get(ad.key) || '';
      if (!ad.ids.length && adIdOf(preview)) ad.ids.push(adIdOf(preview));
      const creative = ad.ids.map(id => data?.creatives?.get(id)).find(item => item && (item.thumb || item.format)) || null;
      // La pieza que el equipo sube a "06 Artes" en Drive gana a la miniatura de Meta: no vence y no pide token.
      const arte = api().arteOf(ad.name, data);
      const arteId = arte ? arte.id || arte.laminas[0] : '';
      return {
        ...sum,
        key: ad.key,
        name: ad.name,
        value: sum.results,
        cost: sum.costPerResult,
        link: creative?.permalink || preview,
        thumb: arteId ? driveThumb(arteId, 160) : creative?.thumb || '',
        format: creative?.format || (arte ? ARTE_FORMAT[arte.tipo] : '') || guessFormat(sum, found),
      };
    })
      .filter(ad => ad.spend > 0 || ad.value > 0)
      .sort((left, right) => right.value - left.value || right.spend - left.spend);
  }

  // Veredicto de un arte por lo que se mide en su objetivo (score: resultados o seguidores) contra el promedio del mes.
  function verdictOf(ad, average, beforeCost) {
    if (ad.spend < VERDICT.minSpend || ad.impressions < VERDICT.minImpressions) return 'poca';
    if (!(ad.score > 0)) return 'descartar';
    const index = ad.scoreCost / average.cost;
    if (beforeCost > 0 && ad.scoreCost / beforeCost >= VERDICT.fatigue && index > 1) return 'fatiga';
    if (index <= VERDICT.replicate) return 'replicar';
    if (index >= VERDICT.discard && ad.spend / average.spend >= VERDICT.discardShare) return 'descartar';
    if (index >= VERDICT.adjust) return 'ajustar';
    return 'mantener';
  }

  // Lo medido por formato (solo artes que lo lograron), del mas barato al mas caro.
  function formatsOf(ads) {
    const byFormat = new Map();
    ads.filter(ad => ad.format && ad.score > 0).forEach(ad => {
      if (!byFormat.has(ad.format)) byFormat.set(ad.format, { format: ad.format, count: 0, spend: 0, results: 0 });
      const item = byFormat.get(ad.format);
      item.count += 1;
      item.spend += ad.spend;
      item.results += ad.score;
    });
    return [...byFormat.values()].map(item => ({ ...item, cost: item.spend / item.results })).sort((left, right) => left.cost - right.cost);
  }

  // ── Armado del reporte ─────────────────────────────────────────────────
  function buildSection(def, months, data, known) {
    const history = months.map(item => {
      const rows = item.rows.filter(row => row.group === def.key);
      // Seguidores de pauta de la marca en el mes: los de todas sus campañas, no solo los de este objetivo.
      const brandFollows = item.found.includes('follows') ? sumOf(item.rows, 'follows') : null;
      return { key: item.key, status: item.status, rows, found: item.found, has: rows.some(activity), sum: totals(rows), brandFollows };
    });
    const current = history[history.length - 1];
    if (!current.has) return null;
    const earlier = history.slice(0, -1).filter(point => point.has);
    const prev = earlier[earlier.length - 1] || null;
    // Meses entre el anterior con datos y el actual: sin descarga o sin pauta en este objetivo.
    const gap = prev ? history.slice(history.indexOf(prev) + 1, -1) : [];
    const previous = earlier.slice(-3);
    const sum = current.sum;
    const byFollows = def.key === 'trafico-perfil' && current.found.includes('follows') && sum.follows >= MIN_FOLLOWS;
    const scoreOf = item => (byFollows ? item.follows : item.results);
    const costOf = item => (scoreOf(item) > 0 ? item.spend / scoreOf(item) : null);
    // El costo por seguidor del objetivo es el de la marca: inversion en Trafico al perfil ÷ seguidores de pauta de todas
    // las campañas (la formula del equipo), el mismo de la lamina de seguidores. Cada arte se mide contra ese.
    const score = byFollows
      ? { unit: 'seguidores', one: 'seguidor', of: 'de los seguidores', total: sum.follows, cost: current.brandFollows > 0 ? sum.spend / current.brandFollows : costOf(sum) }
      : { unit: def.unit, one: def.one, of: 'de los resultados', total: sum.results, cost: sum.costPerResult };
    const prevAds = new Map(prev ? adsOf(prev.rows, data, prev.found).map(ad => [ad.key, ad]) : []);
    const ads = adsOf(current.rows, data, current.found).map(ad => {
      const before = prevAds.get(ad.key) || null;
      const scored = { ...ad, score: scoreOf(ad), scoreCost: costOf(ad), scoreBefore: before ? costOf(before) : null };
      // Sin seguidores, un arte que gasto menos de lo que cuestan 1.5 seguidores al promedio todavia no se juzga.
      const early = byFollows && !(scored.score > 0) && ad.spend < score.cost * VERDICT.discard;
      return {
        ...scored,
        before,
        // Nuevo: no corrio en ningun objetivo de la marca el mes anterior con datos (null si no hay mes anterior).
        isNew: known ? !known.has(ad.key) : null,
        index: scored.scoreCost && score.cost ? scored.scoreCost / score.cost : null,
        verdict: early ? 'poca' : verdictOf(scored, { spend: sum.spend, cost: score.cost }, scored.scoreBefore),
      };
    });
    if (byFollows) ads.sort((left, right) => right.follows - left.follows || right.value - left.value);
    const judged = ads.filter(ad => ad.verdict !== 'poca' && ad.score > 0);
    return {
      ...def,
      history,
      current,
      sum,
      prev,
      gap,
      previous,
      avg: previous.length ? averageOf(previous) : null,
      byFollows,
      score,
      ads,
      // El mejor arte: el que mas logro entre los que costaron igual o menos que el promedio.
      best: judged.find(ad => ad.index <= 1) || judged[0] || null,
      formats: formatsOf(ads),
      found: current.found,
      driver: driverOf(sum, prev?.sum),
      costChange: change(sum.costPerResult, prev?.sum.costPerResult),
    };
  }

  // Seguidores de la marca en un mes. De pauta: los que trajeron los anuncios de todas las campañas (columna
  // Seguimientos de Instagram). Costo por seguidor: inversion de Trafico al perfil ÷ seguidores de pauta. Nuevos, bajas
  // y total: lo que el equipo escribio en el reporte de ese mes (Meta Business Suite > Estadisticas > Publico >
  // Tendencias) o, si no, lo que dio Instagram.
  function followersOf(brandKey, item, data, allNotes) {
    const hasColumn = item.status === 'ok' && item.found.includes('follows');
    const paid = hasColumn && item.has ? sumOf(item.rows, 'follows') : null;
    const trafficSpend = sumOf(item.rows.filter(row => row.group === 'trafico-perfil'), 'spend');
    const typed = field => {
      const value = allNotes[item.key]?.[`seg:${brandKey}:${field}`];
      return finite(value) ? Number(value) : null;
    };
    const instagram = data?.instagram?.months?.get(item.key) || null;
    const nuevos = typed('nuevos') ?? instagram?.follows ?? null;
    const dejaron = typed('dejaron') ?? instagram?.unfollows ?? null;
    return {
      key: item.key,
      status: item.status,
      hasColumn,
      paid,
      trafficSpend,
      costPerFollower: paid > 0 && trafficSpend > 0 ? trafficSpend / paid : null,
      nuevos,
      dejaron,
      netos: nuevos !== null && dejaron !== null ? nuevos - dejaron : null,
      // Organico = nuevos − los que trajo la pauta (sin descontar bajas), como en el modelo.
      organico: nuevos !== null && paid !== null ? Math.max(nuevos - paid, 0) : null,
      typedNuevos: typed('nuevos') !== null,
      typedDejaron: typed('dejaron') !== null,
      fromInstagram: Boolean(instagram),
    };
  }

  function buildBrand(brand, period, keys, allNotes) {
    const data = brandData(brand.key);
    const months = keys.map(key => {
      const { month, rows } = windowRows(brand.key, key, period);
      return { key, status: monthStatus(brand.key, key), rows, found: month?.found || [], source: month?.source || 'meta', has: rows.some(activity), lastDay: month?.lastDay || null, daysInMonth: month?.daysInMonth || null };
    });
    const current = months[months.length - 1];
    // "Nuevo" solo se sabe contra el mes inmediato anterior: si falta (sin descarga), un arte de ese mes pareceria nuevo.
    const prevMonth = months[months.length - 2];
    const known = prevMonth?.has ? new Set(prevMonth.rows.map(row => normalizeName(row.ad))) : null;
    const extra = [...new Set(current.rows.filter(activity).map(row => row.group))]
      .filter(key => !SECTIONS.some(section => section.key === key))
      .map(key => {
        const sample = current.rows.find(row => row.group === key);
        return { key, title: sample.groupLabel, sub: `Objetivo de ${sample.groupLabel.toLowerCase()}`, noun: 'Resultados', unit: 'resultados', one: 'resultado', abbr: 'Result.', color: '#2563eb' };
      });
    const sections = SECTIONS.concat(extra).map(def => buildSection(def, months, data, known)).filter(Boolean);
    return {
      ...brand,
      data,
      months,
      current,
      rows: current.rows,
      sections,
      followers: months.map(item => followersOf(brand.key, item, data, allNotes)),
      totals: months.map(item => ({ key: item.key, status: item.status, has: item.has, sum: totals(item.rows) })),
    };
  }

  // Suma de las marcas; null si a alguna le falta el dato (no se mezcla un total parcial con uno completo).
  function sumBrands(brands, pick) {
    const values = brands.map(pick);
    return values.length && values.every(finite) ? values.reduce((total, value) => total + Number(value), 0) : null;
  }

  function buildReport(period) {
    const allNotes = readNotes();
    const keys = Array.from({ length: EVOLUTION_MONTHS }, (_, index) => shiftMonth(period.key, index - EVOLUTION_MONTHS + 1));
    const brands = BRANDS.map(brand => buildBrand(brand, period, keys, allNotes)).filter(brand => brand.rows.some(activity));
    const followers = keys.map((key, index) => {
      const of = field => sumBrands(brands, brand => brand.followers[index][field]);
      const paid = of('paid');
      const trafficSpend = of('trafficSpend');
      return {
        key,
        paid,
        trafficSpend,
        costPerFollower: paid > 0 && trafficSpend > 0 ? trafficSpend / paid : null,
        nuevos: of('nuevos'),
        dejaron: of('dejaron'),
        netos: of('netos'),
        organico: of('organico'),
      };
    });
    const spend = keys.map((key, index) => ({
      key,
      // Un mes en el que a una marca le falta la descarga no se compara en el total.
      complete: brands.every(brand => brand.totals[index].status === 'ok'),
      spend: sumBrands(brands, brand => brand.totals[index].sum.spend),
      reach: sumBrands(brands, brand => brand.totals[index].sum.reach),
    }));
    const last = keys.length - 1;
    return {
      period,
      labels: period.labels,
      keys,
      notes: allNotes[period.key] || {},
      brands,
      followers,
      spend,
      // Mes anterior para los totales: el ultimo con descarga de las tres marcas.
      prevIndex: [...spend.keys()].slice(0, last).reverse().find(index => spend[index].complete && spend[index].spend > 0) ?? null,
      prevFollowersIndex: [...followers.keys()].slice(0, last).reverse().find(index => followers[index].paid !== null) ?? null,
      hasCreatives: brands.some(brand => brand.data?.creatives?.size || brand.data?.artes?.piezas?.size),
      hasInstagram: brands.some(brand => brand.data?.instagram),
    };
  }

  // ── Lectura de los numeros (textos propuestos; el equipo los reescribe sobre la lamina) ──
  function trendTag(section) {
    if (section.costChange === null) return { text: 'Sin mes anterior', tone: 'muted' };
    if (Math.abs(section.costChange) < STEADY) return { text: 'Costo estable', tone: 'muted' };
    const cause = section.driver.main === 'rate' ? ' · artes' : section.driver.main === 'cpm' ? ' · CPM' : '';
    return section.costChange < 0
      ? { text: `Mejoró${cause}`, tone: 'good' }
      : { text: `Empeoró${cause}`, tone: 'bad' };
  }

  // Que funciona: el mejor arte y por que, el mas eficiente, el que hay que cortar, nuevos contra los que siguieron y el
  // formato. En Trafico al perfil con seguidores, todo por seguidor.
  function suggestArts(section) {
    const { sum, score } = section;
    const per = section.byFollows ? ' por seguidor' : '';
    // Cada frase con su importancia (1 = la primera que entra).
    const parts = [];
    const add = (rank, text) => parts.push({ rank, text });
    // Que funciono, que no y por que, y gracias a que arte bajo (o por cual subio) el costo frente al mes anterior. Sin
    // recomendaciones: esas van en la lamina de proximos pasos.
    const best = section.best;
    const weak = weakestAd(section);
    const costMove = section.prev && section.costChange !== null && Math.abs(section.costChange) >= STEADY ? section.costChange : null;
    if (best) {
      const why = adWhy(best, section);
      const lead = costMove !== null && costMove < 0
        ? `**El costo${per} bajó ${pctAbs(costMove)} frente a ${monthLong(section.prev.key)} gracias a "${best.name}"**`
        : `**"${best.name}" fue el arte que ${section.byFollows ? 'más seguidores trajo' : 'mejor rindió'}**`;
      add(1, `${lead}${best.format ? ` (${best.format.toLowerCase()})` : ''}: ${num(best.score)} ${score.unit} a ${cost(best.scoreCost)}${section.byFollows ? ' cada uno' : ''} (${pctText(best.index - 1)} vs el promedio), ${share(best.score, score.total)} ${score.of} con ${share(best.spend, sum.spend)} de la inversión${why ? `; funcionó porque ${why}` : ''}.`);
    }
    if (weak) {
      const why = adWhy(weak, section);
      const fatigue = weak.scoreBefore && weak.scoreCost && weak.scoreCost / weak.scoreBefore >= VERDICT.fatigue;
      const what = !(weak.score > 0)
        ? `gastó ${money(weak.spend)} sin ${section.byFollows ? 'traer seguidores' : 'resultados'}`
        : `costó ${cost(weak.scoreCost)}${per}, ${pctAbs(weak.index - 1)} más que el promedio, con ${money(weak.spend)} invertidos`;
      const reason = fatigue ? `ya corría en ${monthLong(section.prev.key)} y su costo subió ${pctAbs(weak.scoreCost / weak.scoreBefore - 1)}: la pieza se desgastó` : why;
      add(2, `${costMove !== null && costMove > 0 ? `El costo${per} subió ${pctAbs(costMove)} frente a ${monthLong(section.prev.key)} sobre todo por "${weak.name}"` : `**No funcionó "${weak.name}"**`}${weak.format ? ` (${weak.format.toLowerCase()})` : ''}: ${what}${reason ? `, porque ${reason}` : ''}.`);
    }
    // Un arte mas barato que el mejor pero con menos inversion.
    const efficient = section.ads.filter(ad => ad !== best && ad !== weak && ad.score > 0 && ad.index !== null && ad.index <= VERDICT.replicate && ad.spend >= VERDICT.minSpend).sort((left, right) => left.index - right.index)[0];
    if (best && efficient && efficient.index < best.index) {
      add(3, `"${efficient.name}" fue el más eficiente: ${cost(efficient.scoreCost)}${per} (${pctText(efficient.index - 1)}) con solo ${money(efficient.spend)} de inversión.`);
    }
    // Los anuncios traen las mismas sumas que las filas: se suman igual.
    const costOf = ads => {
      const all = totals(ads);
      const value = section.byFollows ? all.follows : all.results;
      return value > 0 ? all.spend / value : null;
    };
    const fresh = costOf(section.ads.filter(ad => ad.isNew === true));
    const kept = costOf(section.ads.filter(ad => ad.isNew === false));
    if (fresh && kept) {
      add(5, `Los artes nuevos del mes costaron ${cost(fresh)} por ${score.one} contra ${cost(kept)} de los que siguieron${fresh < kept ? ': la renovación de piezas funcionó' : ': los nuevos todavía no superan a los anteriores'}.`);
    }
    if (section.formats.length >= 2) {
      const top = section.formats[0];
      const low = section.formats[section.formats.length - 1];
      add(4, `Por formato, ${FORMAT_PLURAL[top.format] || top.format} rindieron mejor (${cost(top.cost)} por ${score.one}) que ${FORMAT_PLURAL[low.format] || low.format} (${cost(low.cost)}).`);
    }
    if (section.key === 'interaccion' && section.found.includes('plays3s') && sum.results > 0 && sum.plays3s > 0) {
      const active = [['reactions', 'reacciones'], ['saves', 'guardados'], ['shares', 'compartidos'], ['comments', 'comentarios']]
        .filter(([field]) => section.found.includes(field))
        .map(([field, label]) => `${num(sum[field])} ${label}`);
      add(6, `El ${share(Math.min(sum.plays3s, sum.results), sum.results)} de las interacciones son reproducciones de video${active.length ? `; ${list(active)} muestran el engagement activo` : ''}.`);
    }
    // Las frases entran por importancia mientras quepan en la lamina y se leen en su orden natural.
    let length = 0;
    const chosen = new Set([...parts].sort((left, right) => left.rank - right.rank).filter(part => {
      if (length && length + part.text.length > ARTS_TEXT_MAX) return false;
      length += part.text.length + 1;
      return true;
    }));
    return parts.filter(part => chosen.has(part)).map(part => part.text).join(' ') || `${num(sum.results)} ${section.unit} en el período con ${money(sum.spend)} de inversión.`;
  }

  // Por que un arte rindio mejor o peor que el promedio del objetivo. Su costo por resultado es CPM ÷ resultados por mil
  // impresiones, asi que la razon es una de dos: la gente respondio mas o menos a la pieza, o mostrarla costo menos o
  // mas. Se dice la que mas se aleja del promedio, con sus cifras. En Trafico al perfil con seguidores, por seguidor.
  function adWhy(ad, section) {
    const scoreOf = item => (section.byFollows ? item.follows : item.results);
    const rateOf = item => (item.impressions > 0 ? (scoreOf(item) / item.impressions) * 1000 : null);
    const rate = change(rateOf(ad), rateOf(section.sum));
    const cpm = change(ad.cpm, section.sum.cpm);
    if (rate === null || cpm === null || !(scoreOf(ad) > 0)) return '';
    const unit = section.byFollows ? 'seguidores' : section.unit;
    if (Math.abs(Math.log(1 + rate)) >= Math.abs(Math.log(1 + cpm))) {
      return `${rate > 0 ? 'la gente respondió más a la pieza' : 'la gente respondió menos a la pieza'}: ${rateText(rateOf(ad))} ${unit} por cada mil impresiones contra ${rateText(rateOf(section.sum))} del promedio`;
    }
    return `${cpm < 0 ? 'mostrarla costó menos' : 'mostrarla costó más'}: CPM de ${money2(ad.cpm)} contra ${money2(section.sum.cpm)} del objetivo`;
  }

  // El arte que no funciono: el que mas gasto entre los que costaron 15% o mas que el promedio (o no lograron nada),
  // con inversion e impresiones suficientes para juzgarlo.
  function weakestAd(section) {
    return section.ads
      .filter(ad => ad !== section.best && ad.spend >= VERDICT.minSpend && ad.impressions >= VERDICT.minImpressions)
      .filter(ad => !(ad.score > 0) || (ad.index !== null && ad.index >= VERDICT.adjust))
      .sort((left, right) => right.spend - left.spend)[0] || null;
  }

  // Lamina de cada objetivo: que paso con el costo y por que, que arte funciono y por que, cual no y por que, y el
  // formato. Las frases entran por importancia hasta lo que cabe en la tarjeta.
  function suggestSection(section) {
    const { sum, prev, score } = section;
    const per = section.byFollows ? ' por seguidor' : '';
    const parts = [];
    const add = (rank, text) => parts.push({ rank, text });
    if (prev && section.costChange !== null) {
      const vs = monthLong(prev.key);
      const missing = section.gap.filter(point => point.status !== 'ok').map(point => monthLong(point.key));
      const { main, cpmChange, rateChange } = section.driver;
      const moved = Math.abs(section.costChange) < STEADY ? 'se mantuvo' : `${section.costChange > 0 ? 'subió' : 'bajó'} ${pctAbs(section.costChange)}`;
      let cause = '';
      if (Math.abs(section.costChange) >= STEADY && main === 'rate') cause = rateChange > 0 ? `: los artes conectaron mejor (${rateText(sum.rate)} ${section.unit} por mil impresiones contra ${rateText(prev.sum.rate)})` : `: los artes generaron menos respuesta (${rateText(sum.rate)} ${section.unit} por mil impresiones contra ${rateText(prev.sum.rate)})`;
      else if (Math.abs(section.costChange) >= STEADY && main === 'cpm') cause = cpmChange > 0 ? `: mostrar los anuncios costó más (CPM ${money2(prev.sum.cpm)} → ${money2(sum.cpm)})` : `: mostrar los anuncios costó menos (CPM ${money2(prev.sum.cpm)} → ${money2(sum.cpm)})`;
      add(1, `${missing.length ? `Sin datos de ${list(missing)}, se compara con ${vs}. ` : ''}El costo por ${section.one} ${moved} frente a ${vs} (${cost(prev.sum.costPerResult)} → ${cost(sum.costPerResult)})${cause}.`);
    } else {
      add(1, `${num(sum.results)} ${section.unit} a ${cost(sum.costPerResult)} por ${section.one} con ${money(sum.spend)} de inversión; no hay un mes anterior con datos para comparar.`);
    }
    const best = section.best;
    if (best) {
      const why = adWhy(best, section);
      add(2, `**Qué funcionó:** "${best.name}"${best.format ? ` (${best.format.toLowerCase()})` : ''} logró ${share(best.score, score.total)} ${score.of} con ${share(best.spend, sum.spend)} de la inversión, a ${cost(best.scoreCost)}${per} (${pctText(best.index - 1)} vs el promedio)${why ? `, porque ${why}` : ''}.`);
    }
    const weak = weakestAd(section);
    if (weak) {
      const why = adWhy(weak, section);
      add(3, `**Qué no funcionó:** "${weak.name}"${weak.format ? ` (${weak.format.toLowerCase()})` : ''} ${!(weak.score > 0) ? `gastó ${money(weak.spend)} sin ${section.byFollows ? 'traer seguidores' : 'resultados'}` : `costó ${cost(weak.scoreCost)}${per}, ${pctAbs(weak.index - 1)} más que el promedio`}${why ? `, porque ${why}` : ''}.`);
    }
    if (section.formats.length >= 2) {
      const top = section.formats[0];
      const low = section.formats[section.formats.length - 1];
      add(4, `Por formato, ${FORMAT_PLURAL[top.format] || top.format} rindieron mejor (${cost(top.cost)} por ${score.one}) que ${FORMAT_PLURAL[low.format] || low.format} (${cost(low.cost)}).`);
    } else if (section.formats.length === 1) {
      add(5, `Todos los artes con resultados fueron ${(FORMAT_PLURAL[section.formats[0].format] || section.formats[0].format).replace(/^(los|las) /, '')}.`);
    }
    let length = 0;
    const chosen = new Set([...parts].sort((left, right) => left.rank - right.rank).filter(part => {
      if (length && length + part.text.length > SECTION_TEXT_MAX) return false;
      length += part.text.length + 1;
      return true;
    }));
    return parts.filter(part => chosen.has(part)).map(part => part.text).join(' ');
  }

  const cheapest = items => items.filter(item => finite(item.costPerFollower)).sort((left, right) => left.costPerFollower - right.costPerFollower)[0] || null;
  const priciest = items => items.filter(item => finite(item.costPerFollower)).sort((left, right) => right.costPerFollower - left.costPerFollower)[0] || null;

  function suggestFollowersKey(report) {
    const last = report.followers.length - 1;
    const current = report.followers[last];
    const prev = report.prevFollowersIndex !== null ? report.followers[report.prevFollowersIndex] : null;
    const perBrand = report.brands.map(brand => ({ name: brand.name, ...brand.followers[last] }));
    const best = cheapest(perBrand);
    const worst = priciest(perBrand);
    const parts = [];
    // Como en la plantilla del equipo: de los nuevos, cuantos trajo la pauta y cuantos llegaron solos; el neto real
    // descontando bajas; y lo que costo cada seguidor por marca.
    if (current.nuevos !== null && current.dejaron !== null && current.paid !== null) {
      parts.push(`**${num(current.nuevos)} seguidores nuevos:** ${num(current.paid)} los trajo la pauta y ${num(current.organico)} llegaron orgánicamente. Restando ${num(current.dejaron)} bajas, el crecimiento neto real es ${signed(current.netos)}.`);
    } else if (current.paid !== null) {
      parts.push(`**${num(current.paid)} seguidores llegaron por la pauta**${prev ? ` (${pctText(change(current.paid, prev.paid))} vs ${monthLong(prev.key)})` : ''}${current.costPerFollower ? `, a ${money2(current.costPerFollower)} cada uno${prev?.costPerFollower ? ` (${pctText(change(current.costPerFollower, prev.costPerFollower))})` : ''}` : ''}. Faltan los nuevos y las bajas de Meta Business Suite para el crecimiento neto.`);
    } else {
      parts.push('La descarga de Meta Ads de alguna marca no trae la columna de seguidores (Seguimientos de Instagram): sin ella no hay seguidores de pauta ni costo por seguidor.');
    }
    if (best && worst && best !== worst) parts.push(`Las ${perBrand.length} marcas captaron entre ${money2(best.costPerFollower)} y ${money2(worst.costPerFollower)} por seguidor de pauta: ${best.name} la más eficiente y ${worst.name} la más cara.`);
    else if (best) parts.push(`${best.name}: ${money2(best.costPerFollower)} por seguidor de pauta.`);
    return parts.join(' ');
  }

  // Seguidores de pauta del mes contra el promedio de los meses anteriores con dato (las tres marcas juntas), para los
  // KPIs y el texto de la lamina de evolucion.
  function followersTrend(report) {
    const points = report.followers;
    const current = points[points.length - 1];
    const earlier = points.slice(0, -1).filter(point => point.paid !== null);
    const avgPaid = earlier.length ? earlier.reduce((total, point) => total + point.paid, 0) / earlier.length : null;
    const earlierSpend = earlier.reduce((total, point) => total + (point.trafficSpend || 0), 0);
    const earlierPaid = earlier.reduce((total, point) => total + point.paid, 0);
    const avgCost = earlierPaid > 0 && earlierSpend > 0 ? earlierSpend / earlierPaid : null;
    const costs = points.filter(point => finite(point.costPerFollower)).map(point => point.costPerFollower);
    return {
      current,
      earlier,
      avgPaid,
      avgCost,
      growth: avgPaid > 0 && current.paid !== null ? current.paid / avgPaid : null,
      costChange: change(current.costPerFollower, avgCost),
      lowest: finite(current.costPerFollower) && costs.length > 1 && current.costPerFollower <= Math.min(...costs),
      span: earlier.length ? `${monthShort(earlier[0].key).toLowerCase()}–${monthShort(earlier[earlier.length - 1].key).toLowerCase()}` : '',
    };
  }

  function suggestFollowersEvolution(report) {
    const parts = [];
    // Primero el conjunto (como en la plantilla del equipo) y despues una frase por marca: como se movio el costo por
    // seguidor y por que.
    const trend = followersTrend(report);
    const month = monthLong(trend.current.key);
    if (trend.growth !== null && finite(trend.current.costPerFollower)) {
      const moved = trend.growth >= 1.1 ? (trend.growth >= 2 ? 'se multiplicaron' : 'subieron') : trend.growth <= 0.9 ? 'bajaron' : 'se mantuvieron';
      const costMove = trend.costChange === null ? '' : trend.costChange <= -STEADY ? ` y el costo cayó a **${money2(trend.current.costPerFollower)}** (${pctText(trend.costChange)})` : trend.costChange >= STEADY ? ` y el costo subió a **${money2(trend.current.costPerFollower)}** (${pctText(trend.costChange)})` : ` con un costo estable de ${money2(trend.current.costPerFollower)}`;
      const reading = trend.costChange !== null && trend.costChange <= -STEADY ? ': Tráfico al perfil se volvió más eficiente en captar seguidores' : trend.costChange !== null && trend.costChange >= STEADY ? ': cada seguidor costó más que en los meses anteriores' : '';
      parts.push(`En ${month} los seguidores por pauta ${moved} (${num(trend.current.paid)} vs ~${num(trend.avgPaid)} promedio de ${trend.span})${costMove}${reading}.`);
    }
    // Por marca, en una sola frase: de cuanto a cuanto paso el costo por seguidor y que lo movio (mas o menos seguidores
    // de pauta, o mas o menos inversion en Trafico al perfil: el que mas explica el cambio).
    const moves = report.brands.map(brand => {
      const points = brand.followers.filter(item => finite(item.costPerFollower));
      if (points.length < 2) return null;
      const first = points[0];
      const last = points[points.length - 1];
      const spend = change(last.trafficSpend, first.trafficSpend) || 0;
      const byFollowers = Math.abs(Math.log(last.paid / first.paid)) >= Math.abs(Math.log(1 + spend));
      const cause = byFollowers
        ? `${last.paid > first.paid ? 'más' : 'menos'} seguidores de pauta (${num(first.paid)} → ${num(last.paid)})`
        : `${spend > 0 ? 'más' : 'menos'} inversión en Tráfico (${money(first.trafficSpend)} → ${money(last.trafficSpend)})`;
      return `**${brand.name}** ${money2(first.costPerFollower)} → ${money2(last.costPerFollower)} (${pctText(change(last.costPerFollower, first.costPerFollower))}, por ${cause})`;
    }).filter(Boolean);
    if (moves.length) parts.push(`Costo por seguidor de ${monthLong(report.keys[0])} a ${month}: ${list(moves)}.`);
    if (!parts.length) {
      const withColumn = report.brands.some(brand => brand.followers.some(item => item.hasColumn));
      return withColumn
        ? 'Todavía hay un solo mes con la columna de seguidores (Seguimientos de Instagram) en las descargas: la evolución se completa al volver a descargar los meses anteriores con esa columna.'
        : 'Las descargas no traen la columna de seguidores (Seguimientos de Instagram): agregarla al informe de Meta Ads para medir la evolución del costo por seguidor.';
    }
    return parts.join(' ');
  }

  function suggestExec(report) {
    const last = report.keys.length - 1;
    const current = report.spend[last];
    const prev = report.prevIndex !== null ? report.spend[report.prevIndex] : null;
    const parts = [`En ${monthLong(current.key)} se invirtieron **${money(current.spend)}** en las ${report.brands.length} marcas${prev ? ` (${pctText(change(current.spend, prev.spend))} vs ${monthLong(prev.key)})` : ''}.`];
    const moves = report.brands.flatMap(brand => brand.sections.filter(section => section.costChange !== null && Math.abs(section.costChange) >= 0.1).map(section => ({ brand, section })));
    const better = moves.filter(item => item.section.costChange < 0).sort((left, right) => left.section.costChange - right.section.costChange);
    const worse = moves.filter(item => item.section.costChange > 0).sort((left, right) => right.section.costChange - left.section.costChange);
    const cause = section => (section.driver.main === 'rate' ? 'por los artes' : 'por el CPM');
    if (better.length) parts.push(`Bajó el costo en ${list(better.slice(0, 3).map(({ brand, section }) => `${brand.name} ${section.title} (${pctText(section.costChange)}, ${cause(section)})`))}.`);
    if (worse.length) parts.push(`Subió en ${list(worse.slice(0, 3).map(({ brand, section }) => `${brand.name} ${section.title} (${pctText(section.costChange)}, ${cause(section)})`))}.`);
    if (!better.length && !worse.length) parts.push('El costo por resultado se mantuvo en todos los objetivos (cambios menores al 10%).');
    const followers = report.followers[last];
    if (followers.paid !== null) parts.push(`La pauta trajo ${num(followers.paid)} seguidores${followers.costPerFollower ? ` a ${money2(followers.costPerFollower)} cada uno` : ''}.`);
    return parts.join(' ');
  }

  const clip = (text, max = 40) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

  // Un mismo arte puede correr en varios objetivos: va una sola vez, con los objetivos donde aplica y su caso mas
  // marcado (better decide cual).
  function byArt(items, better) {
    const arts = new Map();
    items.forEach(item => {
      const entry = arts.get(item.ad.key) || { ...item, titles: [] };
      entry.titles.push(item.section.title);
      if (better(item, entry)) Object.assign(entry, { ad: item.ad, section: item.section });
      arts.set(item.ad.key, entry);
    });
    return [...arts.values()];
  }

  // Lo que hay que replicar, cortar y hacer el proximo mes en una marca (una linea por punto).
  function suggestNext(brand, report) {
    const all = brand.sections.flatMap(section => section.ads.map(ad => ({ ad, section })));
    const per = section => (section.byFollows ? ' por seguidor' : '');
    const replicate = byArt(all.filter(item => item.ad.verdict === 'replicar'), (item, entry) => item.ad.index < entry.ad.index)
      .sort((left, right) => right.ad.score / right.section.score.total - left.ad.score / left.section.score.total)
      .slice(0, 3)
      .map(({ ad, section, titles }) => `• "${clip(ad.name)}" (${list(titles)}): ${titles.length > 1 ? 'hasta ' : ''}${pctAbs(1 - ad.index)} más barato${per(section)} que el promedio${ad.format ? `, ${ad.format.toLowerCase()}` : ''}.`);
    const cut = byArt(all.filter(item => ['descartar', 'fatiga', 'ajustar'].includes(item.ad.verdict)), (item, entry) => item.ad.spend > entry.ad.spend)
      .sort((left, right) => right.ad.spend - left.ad.spend)
      .slice(0, 3)
      .map(({ ad, section, titles }) => {
        const where = `"${clip(ad.name)}" (${list(titles)})`;
        if (!(ad.score > 0)) return `• ${where}: ${money(ad.spend)} sin ${section.byFollows ? 'seguidores' : 'resultados'}; pausar.`;
        if (ad.verdict === 'fatiga') return `• ${where}: su costo${per(section)} subió ${pctAbs(ad.scoreCost / ad.scoreBefore - 1)} desde ${monthLong(section.prev.key)}; renovar la pieza.`;
        return `• ${where}: ${times(ad.index)} el costo promedio${per(section)}; ${ad.verdict === 'descartar' ? 'pausar y mover el presupuesto' : 'probar otro gancho o portada'}.`;
      });
    const next = [];
    brand.sections.forEach(section => {
      const { costChange, driver } = section;
      if (costChange === null) return;
      if (costChange >= 0.1 && driver.main === 'rate') next.push(`• ${section.title}: renovar artes; la respuesta por mil impresiones cayó ${pctAbs(driver.rateChange)}.`);
      // Si los artes respondieron mejor y aun asi subio el costo, el problema es solo el publico o la subasta.
      else if (costChange >= 0.1 && driver.main === 'cpm') next.push(`• ${section.title}: ampliar o refrescar el público; el CPM subió ${pctAbs(driver.cpmChange)}${driver.rateChange >= STEADY ? ` aunque los artes respondieron ${pctAbs(driver.rateChange)} mejor` : ''}.`);
      else if (costChange <= -0.1) next.push(`• ${section.title}: sostener la inversión y escalar lo que funciona; el costo bajó ${pctAbs(costChange)}.`);
    });
    brand.sections.forEach(section => {
      const top = section.formats[0];
      const low = section.formats[section.formats.length - 1];
      if (top && low && top !== low && low.cost / top.cost >= 1.25) next.push(`• ${section.title}: priorizar ${FORMAT_PLURAL[top.format] || top.format}; costaron ${pctAbs(1 - top.cost / low.cost)} menos por ${section.score.one}.`);
    });
    const wasted = all.filter(item => item.ad.verdict === 'descartar').reduce((total, item) => total + item.ad.spend, 0);
    if (wasted >= 5) next.push(`• Reasignar ${money(wasted)} de los artes a descartar hacia los que se replican.`);
    const last = brand.followers.length - 1;
    const followers = brand.followers[last];
    const before = brand.followers.slice(0, last).reverse().find(item => finite(item.costPerFollower));
    const followerChange = change(followers.costPerFollower, before?.costPerFollower);
    if (followerChange !== null && Math.abs(followerChange) >= 0.1) {
      next.push(followerChange < 0
        ? `• Seguidores: el costo por seguidor bajó ${pctAbs(followerChange)} (${money2(followers.costPerFollower)}); sostener Tráfico al perfil.`
        : `• Seguidores: el costo por seguidor subió ${pctAbs(followerChange)} (${money2(followers.costPerFollower)}); revisar las piezas de Tráfico al perfil.`);
    }
    return {
      replicate: replicate.join('\n') || '• Ningún arte se separó del promedio: probar piezas nuevas para encontrar un ganador.',
      cut: cut.join('\n') || '• Ningún arte para cortar: todos rindieron cerca o por debajo del costo promedio.',
      next: next.slice(0, 3).join('\n') || '• Mantener la inversión y la mezcla de artes: los costos se mantuvieron.',
    };
  }

  function suggestConclusions(report) {
    const last = report.keys.length - 1;
    const followers = report.followers[last];
    const prevFollowers = report.prevFollowersIndex !== null ? report.followers[report.prevFollowersIndex] : null;
    const perBrand = report.brands.map(brand => ({ name: brand.name, ...brand.followers[last] }));
    const best = cheapest(perBrand);
    const cards = [];
    cards.push({
      icon: 'user',
      title: followers.paid !== null ? `${num(followers.paid)} seguidores de pauta` : 'Medir los seguidores',
      text: followers.paid !== null
        ? `${followers.costPerFollower ? `Costo por seguidor de ${money2(followers.costPerFollower)}${prevFollowers?.costPerFollower ? ` (${pctText(change(followers.costPerFollower, prevFollowers.costPerFollower))} vs ${monthLong(prevFollowers.key)})` : ''}.` : ''}${best ? ` ${best.name} lidera al mejor costo (${money2(best.costPerFollower)}).` : ''}${followers.netos !== null ? ` Crecimiento neto de ${signed(followers.netos)} con ${num(followers.dejaron)} bajas.` : ' Falta registrar nuevos y bajas para el crecimiento neto.'}`
        : 'Agregar la columna Seguimientos de Instagram a las descargas de Meta Ads y registrar nuevos y bajas de cada marca.',
    });
    // Cada arte cuenta una vez por marca aunque corra en varios objetivos.
    const arts = report.brands.flatMap(brand => brand.sections.flatMap(section => section.ads.map(ad => ({ ad, section, brand }))));
    const unique = items => [...new Map(items.map(item => [`${item.brand.key}|${item.ad.key}`, item])).values()];
    const winners = unique(arts.filter(item => item.ad.verdict === 'replicar').sort((left, right) => right.ad.index - left.ad.index)).sort((left, right) => left.ad.index - right.ad.index);
    const losers = unique(arts.filter(item => item.ad.verdict === 'descartar'));
    const formats = new Map();
    winners.forEach(item => { if (item.ad.format) formats.set(item.ad.format, (formats.get(item.ad.format) || 0) + 1); });
    const topFormat = [...formats.entries()].sort((left, right) => right[1] - left[1])[0];
    cards.push({
      icon: 'play',
      title: winners.length ? `${winners.length} artes para replicar` : 'Buscar el arte ganador',
      text: `${winners.length ? `Los mejores: ${list(winners.slice(0, 3).map(item => `"${clip(item.ad.name)}" (${item.brand.name}, ${item.section.title})`))}.` : 'Ningún arte se separó del promedio este mes.'}${topFormat ? ` ${topFormat[1]} de ${winners.length} son ${topFormat[0].toLowerCase()}.` : ''}${losers.length ? ` ${losers.length} para descartar concentran ${money(losers.reduce((total, item) => total + item.ad.spend, 0))} de inversión.` : ''}`,
    });
    const moves = report.brands.flatMap(brand => brand.sections.filter(section => section.costChange !== null && Math.abs(section.costChange) >= 0.1).map(section => ({ brand, section })));
    const describe = ({ brand, section }) => `${brand.name} ${section.title} ${pctText(section.costChange)} (${section.driver.main === 'rate' ? 'artes' : 'CPM'})`;
    const better = moves.filter(item => item.section.costChange < 0);
    const worse = moves.filter(item => item.section.costChange > 0);
    cards.push({
      icon: 'coins',
      title: 'Qué movió los costos',
      text: moves.length
        ? `${better.length ? `Mejoraron: ${list(better.map(describe))}.` : ''}${worse.length ? ` Empeoraron: ${list(worse.map(describe))}.` : ''} Cuando la causa son los artes, se renuevan las piezas; cuando es el CPM, se ajusta el público.`.trim()
        : 'Los costos por resultado se mantuvieron en todos los objetivos (cambios menores al 10%).',
    });
    return cards;
  }

  // Avisos para el equipo antes de descargar el PDF (no salen en el PDF). El cliente tambien abre el tablero: solo se
  // muestran en modo equipo (?equipo=1, ver data-source.js).
  function checklist(report) {
    if (!api().teamMode()) return '';
    const items = [];
    const monthNames = keys => list(keys.map(key => `${api().MONTHS[monthIndex(key)]} ${key.slice(0, 4)}`));
    report.brands.forEach(brand => {
      const missing = brand.months.filter(item => item.status === 'missing').map(item => item.key);
      if (missing.length) items.push(`<b>${esc(brand.name)}</b>: falta la descarga de Meta de ${esc(monthNames(missing))} en su carpeta de Drive. Sin ella la evolución salta ese mes.`);
      const broken = brand.months.filter(item => item.status === 'error').map(item => item.key);
      if (broken.length) items.push(`<b>${esc(brand.name)}</b>: la descarga de ${esc(monthNames(broken))} no se pudo leer (ver Archivo de Reportes).`);
      // Un mes cerrado cuya descarga no llega al ultimo dia se compara como si estuviera completo.
      brand.months.forEach((item, index) => {
        const closed = index < brand.months.length - 1 || report.period.closed;
        if (closed && item.status === 'ok' && item.has && item.lastDay && item.lastDay < item.daysInMonth) {
          const missingDays = item.daysInMonth - item.lastDay === 1 ? `el ${item.daysInMonth}` : `del ${item.lastDay + 1} al ${item.daysInMonth}`;
          items.push(item.source === 'nexus'
            ? `<b>${esc(brand.name)}</b>: los datos de Nexus de ${esc(monthNames([item.key]))} llegan hasta el día ${item.lastDay}; faltan ${missingDays}. Revisar la última lectura de la cuenta en Nexus (Monitoreo).`
            : `<b>${esc(brand.name)}</b>: la descarga de ${esc(monthNames([item.key]))} llega hasta el día ${item.lastDay}; faltan ${missingDays}. Volver a descargarla completa.`);
        }
      });
      // Un mes leido de Nexus (la hoja no trae la descarga de Meta) llega sin seguidores ni desglose de interacciones.
      const fromNexus = brand.months.filter(item => item.status === 'ok' && item.has && item.source === 'nexus' && !item.found.includes('follows')).map(item => item.key);
      if (fromNexus.length) items.push(`<b>${esc(brand.name)}</b>: ${esc(monthNames(fromNexus))} ${fromNexus.length > 1 ? 'salen' : 'sale'} de Nexus, que no trae los seguimientos de Instagram: queda sin seguidores de pauta ni costo por seguidor. Para tenerlos, sube a su carpeta la descarga de Meta del mes (el tablero la prefiere a Nexus).`);
      const noFollows = brand.months.filter(item => item.status === 'ok' && item.has && item.source !== 'nexus' && !item.found.includes('follows')).map(item => item.key);
      if (noFollows.length) items.push(`<b>${esc(brand.name)}</b>: la descarga de ${esc(monthNames(noFollows))} no trae la columna "Seguimientos de Instagram": ese mes queda sin seguidores de pauta ni costo por seguidor.`);
      if (brand.data?.metaError) items.push(`<b>${esc(brand.name)}</b>: Meta respondió con error al pedir artes o seguidores (${esc(brand.data.metaError)}).`);
    });
    // El ID de un anuncio de Meta es unico: si aparece en las descargas de dos marcas del mismo mes, una de las dos trae
    // filas de la otra (Octubre 2026: la de Sol y Tierra traia del 4 al 18 los anuncios de Gold Fusion).
    report.keys.forEach((key, index) => {
      const owners = new Map();
      report.brands.forEach(brand => {
        new Set(brand.months[index].rows.map(row => adIdOf(row.preview)).filter(Boolean)).forEach(id => owners.set(id, [...(owners.get(id) || []), brand]));
      });
      const pairs = new Map();
      owners.forEach((brands, id) => {
        if (brands.length < 2) return;
        const pair = brands.map(brand => brand.key).join('|');
        if (!pairs.has(pair)) pairs.set(pair, { brands, ids: new Set() });
        pairs.get(pair).ids.add(id);
      });
      pairs.forEach(({ brands, ids }) => {
        const detail = brands.map(brand => {
          const rows = brand.months[index].rows.filter(row => ids.has(adIdOf(row.preview)));
          const days = rows.map(row => row.d);
          return `${esc(brand.name)} ${money(sumOf(rows, 'spend'))} (días ${Math.min(...days)}-${Math.max(...days)})`;
        });
        items.push(`<b>${esc(list(brands.map(brand => brand.name)))}</b>: sus descargas de ${esc(monthNames([key]))} comparten ${ids.size} anuncios con el mismo ID de Meta: ${list(detail)}. Una de las dos trae filas de la otra marca: volver a descargarla desde su propia cuenta publicitaria.`);
      });
    });
    const last = report.keys.length - 1;
    if (report.brands.some(brand => brand.followers[last].nuevos === null || brand.followers[last].dejaron === null)) {
      items.push(report.hasInstagram
        ? 'A alguna marca le faltan los seguidores nuevos o las bajas de Instagram: escríbelos en la lámina de seguidores (clic en la casilla).'
        : 'Seguidores nuevos y bajas: escríbelos en la lámina de seguidores (clic en la casilla), de Meta Business Suite &gt; Estadísticas &gt; Público &gt; Tendencias, o conecta Instagram al Web App (propiedades META_TOKEN e IG_USER_&lt;MARCA&gt;) para que lleguen solos.');
    }
    if (!report.hasCreatives) items.push('Sin miniaturas de los artes: sube las piezas a la carpeta "06 Artes" de cada marca en Drive (el nombre del archivo con el texto del anuncio) o pon el token de Meta en el Web App (propiedad META_TOKEN). Mientras tanto el formato se deduce de las reproducciones de 3 s.');
    report.brands.forEach(brand => {
      if (!brand.data?.artes?.piezas?.size && !brand.data?.creatives?.size) items.push(`<b>${esc(brand.name)}</b>: no tiene carpeta "06 Artes" junto a sus descargas; sus anuncios salen sin miniatura.`);
    });
    report.brands.forEach(brand => {
      if (brand.data?.artes?.error) items.push(`<b>${esc(brand.name)}</b>: ${esc(brand.data.artes.error)}`);
    });
    if (!items.length) return '';
    return `
      <div class="panel rp-checklist">
        <strong>Antes de descargar el PDF</strong>
        <ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>
        <span>Este recuadro no sale en el PDF.</span>
      </div>`;
  }

  // ── Textos y cifras guardados por mes ──────────────────────────────────
  function readNotes() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(NOTES_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  }

  function writeNotes(notes) {
    try {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {
      // Sin localStorage el texto dura hasta recargar; el PDF se descarga igual.
    }
  }

  function saveNote(monthKey, key, value) {
    const notes = readNotes();
    notes[monthKey] = { ...(notes[monthKey] || {}), [key]: value };
    if (value === null) delete notes[monthKey][key];
    writeNotes(notes);
  }

  function resetNotes(monthKey) {
    // Restablecer vuelve a los textos propuestos; las cifras de seguidores que escribio el equipo se quedan.
    const notes = readNotes();
    notes[monthKey] = Object.fromEntries(Object.entries(notes[monthKey] || {}).filter(([key]) => /^seg:[^:]+:(nuevos|dejaron|total)$/.test(key)));
    writeNotes(notes);
  }

  // **texto** va en negrita, como en los demas modelos.
  const rich = text => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const editable = (key, text, tag = 'p') => `<${tag} class="rp-edit" data-note="${esc(key)}" data-raw="${esc(text)}" title="Clic para editar · **texto** va en negrita">${rich(text)}</${tag}>`;
  const noteOr = (notes, key, suggested) => (notes[key] != null ? notes[key] : suggested);
  // Cifra de seguidores: la que escribio el equipo o la de Instagram; vacia, una casilla para completarla.
  // month: el mes en que se guarda la cifra (la tabla de evolucion escribe los totales de los meses anteriores).
  const numberCell = (key, value, shown, fromApi, month = '') => `<span class="rp-edit rp-num${value === null ? ' is-empty' : ''}${fromApi ? ' is-api' : ''}" data-num="${esc(key)}"${month ? ` data-month="${esc(month)}"` : ''} data-raw="${value === null ? '' : value}" title="${fromApi ? 'Dato de Instagram · clic para corregirlo' : 'Clic para escribir la cifra de Meta Business Suite (Estadísticas > Público > Tendencias)'}">${value === null ? '—' : shown}</span>`;

  // ── Piezas de las laminas ──────────────────────────────────────────────
  // Variacion contra el mes anterior: sense 'up' (subir es bueno), 'down' (bajar es bueno) o 'none' (solo informa).
  function delta(value, prevKey, sense = 'none') {
    if (value === null || !prevKey) return '<span class="rp-delta muted">Sin mes anterior</span>';
    const steady = Math.abs(value) < STEADY;
    const tone = steady || sense === 'none' ? 'muted' : (sense === 'up') === (value > 0) ? 'good' : 'bad';
    const arrow = steady ? '=' : value > 0 ? '▲' : '▼';
    return `<span class="rp-delta ${tone}">${arrow} ${pctText(value)} vs ${esc(monthShort(prevKey).toLowerCase())}</span>`;
  }

  // Solo el porcentaje, para las tablas.
  function deltaCell(value, sense = 'none') {
    if (value === null) return '<span class="rp-faint">—</span>';
    const steady = Math.abs(value) < STEADY;
    const tone = steady || sense === 'none' ? 'muted' : (sense === 'up') === (value > 0) ? 'good' : 'bad';
    return `<span class="rp-delta ${tone}">${pctText(value)}</span>`;
  }

  const kpi = (label, value, foot) => `
    <div class="rp-card rp-kpi">
      <span class="rp-kpi-label">${esc(label)}</span>
      <strong>${value}</strong>
      ${foot}
    </div>`;

  const head = (title, sub, badge = '') => `<header class="rp-head${badge ? ' has-badge' : ''}"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${badge ? `<span class="rp-date-badge">${icon('calendar')}${esc(badge)}</span>` : ''}</header>`;

  function footer(left, report, page, total) {
    return `
      <footer class="rp-foot">
        <span>${esc(left)}</span>
        <span class="rp-foot-right"><img src="${LOGO}" alt=""><b>Lima Retail</b>${esc(report.labels.footer)} · ${pageNumber(page)} / ${pageNumber(total)}</span>
      </footer>`;
  }

  const insight = (label, iconName, key, text, extra = '') => `
    <div class="rp-insight${extra ? ` ${extra}` : ''}">
      <span class="rp-insight-icon">${icon(iconName)}</span>
      <div>
        <span class="rp-insight-label">${label}</span>
        ${editable(key, text)}
      </div>
    </div>`;

  // Puntos de un grafico mensual: valor del mes o null, con la razon cuando falta.
  const missingNote = point => (point.status !== 'ok' ? 'sin datos' : 'sin pauta');

  // Resultados y costo por resultado por mes, solo lineas (el equipo pidio quitar las barras), con el valor en cada
  // punto y el mes del reporte resaltado. Un mes sin datos deja el hueco con su razon debajo y la linea lo cruza
  // punteada.
  function evolutionChart(section) {
    const points = section.history;
    const left = 46;
    const right = 584;
    const x = index => left + ((right - left) * index) / Math.max(points.length - 1, 1);
    const lineMarks = (values, top, bottom, color, format) => {
      const max = Math.max(...values.filter(finite), 0) * 1.3 || 1;
      const y = value => bottom - (value / max) * (bottom - top);
      let path = '';
      let lastKnown = null;
      values.forEach((value, index) => {
        if (!finite(value)) return;
        if (lastKnown !== null) {
          const dashed = index - lastKnown > 1 ? ' stroke-dasharray="4 4" opacity=".45"' : '';
          path += `<line x1="${x(lastKnown)}" y1="${y(values[lastKnown])}" x2="${x(index)}" y2="${y(value)}" stroke="${color}" stroke-width="2.2"${dashed}/>`;
        }
        lastKnown = index;
      });
      const marks = values.map((value, index) => (finite(value)
        ? `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/><text x="${x(index)}" y="${y(value) - 8}" text-anchor="middle" class="rp-point" fill="${color}">${format(value)}</text>`
        : '')).join('');
      return path + marks;
    };
    // Titulo de cada linea arriba a la izquierda, en su color, y la base del panel.
    const panel = (label, titleY, bottom, color, body) => `
      <text x="${left - 30}" y="${titleY}" class="rp-chart-line-title" fill="${color}">${esc(label)}</text>
      <line x1="${left - 30}" x2="${right + 22}" y1="${bottom}" y2="${bottom}" class="rp-grid"/>
      ${body}`;
    const value = (field, point) => (point.has ? point.sum[field] : null);
    const last = points.length - 1;
    return `
      <svg class="rp-chart" viewBox="0 0 620 248" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${esc(section.title)}: evolución por mes">
        <rect x="${x(last) - 30}" y="4" width="60" height="232" rx="6" class="rp-chart-current"/>
        ${panel(section.noun, 18, 104, section.color, lineMarks(points.map(point => value('results', point)), 40, 104, section.color, compact))}
        ${panel('Costo por resultado', 132, 214, COST_COLOR, lineMarks(points.map(point => value('costPerResult', point)), 152, 214, COST_COLOR, costShort))}
        ${points.map((point, index) => `<text x="${x(index)}" y="${point.has ? 230 : 227}" text-anchor="middle" class="rp-axis${index === last ? ' rp-axis-current' : ''}"><tspan font-weight="700">${esc(monthShort(point.key))}</tspan></text>${point.has ? '' : `<text x="${x(index)}" y="239" text-anchor="middle" class="rp-axis-note">${missingNote(point)}</text>`}`).join('')}
      </svg>`;
  }

  // Una linea por marca con el valor en cada punto. Las etiquetas de un mismo mes que chocan se reparten arriba, abajo
  // y al costado del punto. Un mes sin datos de ninguna marca lo dice bajo el mes. Leyenda arriba a la derecha.
  // width/height: tamano del dibujo; debe seguir la forma de la tarjeta para que el grafico la llene (en una tarjeta
  // baja, un dibujo alto se encoge al centro).
  function seriesChart(label, keys, series, format, notes = [], width = 620, height = 236) {
    const compact = height < 200;
    const left = 46;
    const right = width - 36;
    const top = compact ? 34 : 44;
    const bottom = height - (compact ? 28 : 36);
    const x = index => left + ((right - left) * index) / Math.max(keys.length - 1, 1);
    const known = series.flatMap(item => item.values.filter(finite));
    const max = Math.max(...known, 0) * 1.25 || 1;
    const y = value => bottom - (value / max) * (bottom - top);
    const lines = series.map(item => {
      let path = '';
      let lastKnown = null;
      item.values.forEach((value, index) => {
        if (!finite(value)) return;
        if (lastKnown !== null) {
          const dashed = index - lastKnown > 1 ? ' stroke-dasharray="4 4" opacity=".45"' : '';
          path += `<line x1="${x(lastKnown)}" y1="${y(item.values[lastKnown])}" x2="${x(index)}" y2="${y(value)}" stroke="${item.color}" stroke-width="2.2"${dashed}/>`;
        }
        lastKnown = index;
      });
      return path;
    }).join('');
    const marks = keys.map((_, index) => {
      const points = series
        .filter(item => finite(item.values[index]))
        .map(item => ({ item, y: y(item.values[index]) }))
        .sort((left, right) => left.y - right.y);
      const dot = point => `<circle cx="${x(index)}" cy="${point.y}" r="3.5" fill="#fff" stroke="${point.item.color}" stroke-width="2"/>`;
      // Ultimo mes: etiquetas a la izquierda del punto, apiladas a 11 de distancia y subidas si pasan el eje.
      if (index === keys.length - 1) {
        const ys = [];
        points.forEach((point, order) => ys.push(Math.max(point.y + 4, order ? ys[order - 1] + 11 : -Infinity)));
        const lift = Math.max(0, ys[ys.length - 1] - (bottom + 2));
        return points.map((point, order) => `${dot(point)}<text x="${x(index) - 8}" y="${Math.max(ys[order] - lift, top - 4 + order * 11)}" text-anchor="end" class="rp-point" fill="${point.item.color}">${format(point.item.values[index])}</text>`).join('');
      }
      // Dentro de un grupo de puntos cercanos: el primero lleva la etiqueta arriba, el segundo al costado y el tercero
      // abajo.
      let slot = 0;
      return points.map((point, order) => {
        slot = order > 0 && point.y - points[order - 1].y < 14 ? slot + 1 : 0;
        const place = [
          { dx: 0, dy: -8, anchor: 'middle' },
          { dx: 8, dy: 4, anchor: 'start' },
          { dx: 0, dy: 16, anchor: 'middle' },
        ][Math.min(slot, 2)];
        return `${dot(point)}<text x="${x(index) + place.dx}" y="${point.y + place.dy}" text-anchor="${place.anchor}" class="rp-point" fill="${point.item.color}">${format(point.item.values[index])}</text>`;
      }).join('');
    }).join('');
    let legendX = right + 20;
    const legend = [...series].reverse().map(item => {
      legendX -= item.name.length * 5 + 22;
      return `<rect x="${legendX}" y="10" width="9" height="9" rx="2" fill="${item.color}"/><text x="${legendX + 13}" y="18" class="rp-legend-text">${esc(item.name)}</text>`;
    }).join('');
    return `
      <svg class="rp-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${esc(label)}">
        <text x="${left - 30}" y="18" class="rp-chart-title">${esc(label)}</text>
        ${legend}
        ${[bottom, (top + bottom) / 2, top].map(level => `<line x1="${left - 30}" x2="${right + 22}" y1="${level}" y2="${level}" class="rp-grid"/>`).join('')}
        ${lines}${marks}
        ${keys.map((key, index) => `<text x="${x(index)}" y="${bottom + (notes[index] ? 14 : 18) + (compact ? 0 : 2)}" text-anchor="middle" class="rp-axis"><tspan font-weight="700">${esc(monthShort(key))}</tspan></text>${notes[index] ? `<text x="${x(index)}" y="${bottom + (compact ? 24 : 27)}" text-anchor="middle" class="rp-axis-note">${esc(notes[index])}</text>` : ''}`).join('')}
      </svg>`;
  }

  function previewLink(ad, label = 'Ver »') {
    const url = api().safeUrl(ad.link);
    return url ? `<a class="rp-link" href="${url}" target="_blank" rel="noopener">${esc(label)}</a>` : (label === 'Ver »' ? '—' : '');
  }

  // Miniatura del arte (de "06 Artes" en Drive o, con token, de Meta) o un recuadro con el icono de su formato. size:
  // clase extra para la miniatura grande de "Mejores anuncios".
  function thumb(ad, size = '') {
    const iconName = FORMAT_ICON[ad.format] || 'image';
    const url = api().safeUrl(ad.thumb);
    const big = size && url ? url.replace(/sz=w\d+/, 'sz=w320') : url;
    return url
      ? `<span class="rp-thumb ${size}"><img src="${big}" alt="" referrerpolicy="no-referrer" data-fallback="${iconName}"></span>`
      : `<span class="rp-thumb rp-thumb-ph ${size}">${icon(iconName)}</span>`;
  }

  // ── Laminas ────────────────────────────────────────────────────────────
  function coverPage(report) {
    return `
      <section class="rp-page rp-cover">
        <div class="rp-brand"><img src="${LOGO}" alt="Lima Retail"><div><b>Lima Retail</b><span>Data Driven Marketing</span></div></div>
        <div class="rp-cover-body">
          <h1>Reporte de Publicidad</h1>
          <p class="rp-cover-client">Cliente: <b>${CLIENT}</b> · ${esc(list(report.brands.map(brand => brand.name)))}</p>
          <p class="rp-cover-period">${esc(report.labels.range)} · Inversión, resultados, artes y seguidores&nbsp; | &nbsp;Meta Ads</p>
        </div>
      </section>`;
  }

  function execPage(report, notes, page, total) {
    const last = report.keys.length - 1;
    const current = report.spend[last];
    const prev = report.prevIndex !== null ? report.spend[report.prevIndex] : null;
    const followers = report.followers[last];
    const prevFollowers = report.prevFollowersIndex !== null ? report.followers[report.prevFollowersIndex] : null;
    const rows = report.brands.map(brand => brand.sections.map((section, index) => {
      const prevSum = section.prev?.sum;
      const tag = trendTag(section);
      return `
        <tr>
          ${index === 0 ? `<td class="rp-name" rowspan="${brand.sections.length}"><i class="rp-dot" style="background:${brand.color}"></i>${esc(brand.name)}</td>` : ''}
          <td>${esc(section.title)}</td>
          <td class="num">${money(section.sum.spend)}</td>
          <td class="num">${deltaCell(change(section.sum.spend, prevSum?.spend))}</td>
          <td class="num">${num(section.sum.results)} <span class="rp-unit">${esc(section.unit)}</span></td>
          <td class="num">${deltaCell(change(section.sum.results, prevSum?.results), 'up')}</td>
          <td class="num"><b>${cost(section.sum.costPerResult)}</b></td>
          <td class="num">${deltaCell(section.costChange, 'down')}</td>
          <td><span class="rp-verdict ${tag.tone}">${esc(tag.text)}</span></td>
        </tr>`;
    }).join('')).join('');
    return `
      <section class="rp-page rp-exec-page">
        ${head('Resumen ejecutivo', `Inversión, resultados y costo por objetivo de las ${report.brands.length} marcas · ${report.labels.window}`)}
        <div class="rp-body">
          <div class="rp-grid-4">
            ${kpi('Inversión total', money(current.spend), delta(change(current.spend, prev?.spend), prev?.key))}
            ${kpi('Alcance', num(current.reach), delta(change(current.reach, prev?.reach), prev?.key))}
            ${kpi('Seguidores de pauta', num(followers.paid), delta(change(followers.paid, prevFollowers?.paid), prevFollowers?.key, 'up'))}
            ${kpi('Costo por seguidor', money2(followers.costPerFollower), delta(change(followers.costPerFollower, prevFollowers?.costPerFollower), prevFollowers?.key, 'down'))}
          </div>
          <div class="rp-card rp-table-card">
            <table class="rp-table rp-exec${report.brands.reduce((count, brand) => count + brand.sections.length, 0) > 9 ? ' dense' : ''}">
              <colgroup><col style="width:12%"><col style="width:14%"><col style="width:9%"><col style="width:7%"><col style="width:17%"><col style="width:7%"><col style="width:11%"><col style="width:7%"><col></colgroup>
              <thead><tr><th>Marca</th><th>Objetivo</th><th class="num">Inversión</th><th class="num">Var.</th><th class="num">Resultados</th><th class="num">Var.</th><th class="num">Costo/result.</th><th class="num">Var.</th><th>Lectura</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="rp-table-foot">Var. = contra el mes anterior con datos. Artes = cambió la respuesta por mil impresiones; CPM = cambió el costo de mostrar los anuncios.</div>
          </div>
          ${insight('Lectura del mes', 'pulse', 'exec:clave', noteOr(notes, 'exec:clave', suggestExec(report)), 'rp-insight-tight')}
        </div>
        ${footer(report.labels.source, report, page, total)}
      </section>`;
  }

  function followersPage(report, notes, page, total) {
    const last = report.keys.length - 1;
    const current = report.followers[last];
    const prev = report.prevFollowersIndex !== null ? report.followers[report.prevFollowersIndex] : null;
    // La plantilla del equipo: cinco KPIs (nuevos, bajas, netos, de pauta, organico), la tabla de seguidores por marca y
    // al lado la del costo por seguidor (inversion en Trafico al perfil ÷ seguidores de pauta de todas las campañas).
    const followerRows = report.brands.map(brand => {
      const item = brand.followers[last];
      return `
        <tr>
          <td class="rp-name"><i class="rp-dot" style="background:${brand.color}"></i>${esc(brand.name)}</td>
          <td class="num">${numberCell(`seg:${brand.key}:nuevos`, item.nuevos, num(item.nuevos), item.fromInstagram && !item.typedNuevos)}</td>
          <td class="num rp-bad">${numberCell(`seg:${brand.key}:dejaron`, item.dejaron, item.dejaron ? `-${num(item.dejaron)}` : '0', item.fromInstagram && !item.typedDejaron)}</td>
          <td class="num"><b>${signed(item.netos)}</b></td>
          <td class="num rp-blue">${num(item.paid)}</td>
          <td class="num rp-orange">${num(item.organico)}</td>
        </tr>`;
    }).join('');
    const costRows = report.brands.map(brand => {
      const item = brand.followers[last];
      return `
        <tr>
          <td class="rp-name"><i class="rp-dot" style="background:${brand.color}"></i>${esc(brand.name)}</td>
          <td class="num">${money(item.trafficSpend)}</td>
          <td class="num">${num(item.paid)}</td>
          <td class="num"><b>${money2(item.costPerFollower)}</b></td>
        </tr>`;
    }).join('');
    const missing = report.brands.filter(brand => !brand.followers[last].hasColumn).map(brand => brand.name);
    // Sin la cifra de alguna marca el total no existe: se dice que falta, no que no hay mes anterior.
    const lacking = `<span class="rp-delta muted">Falta el dato de ${report.hasInstagram ? 'Instagram' : 'Meta Business Suite'}</span>`;
    const caption = text => `<span class="rp-delta muted">${text}</span>`;
    const missingAny = report.brands.some(brand => brand.followers[last].nuevos === null || brand.followers[last].dejaron === null);
    return `
      <section class="rp-page">
        ${head('Crecimiento de seguidores', `Nuevos, de pauta y orgánicos · costo por seguidor (Tráfico al perfil) · ${report.labels.window}`, report.labels.badge)}
        <div class="rp-body">
          <div class="rp-grid-5">
            ${kpi('Nuevos', num(current.nuevos), current.nuevos === null ? lacking : caption('Nos siguieron'))}
            ${kpi('Dejaron', current.dejaron === null ? '—' : `-${num(current.dejaron)}`, current.dejaron === null ? lacking : caption('Nos dejaron'))}
            ${kpi('Netos', signed(current.netos), current.netos === null ? lacking : caption('Nuevos − bajas'))}
            ${kpi('De pauta', num(current.paid), current.paid === null ? lacking : caption(prev?.paid ? `${pctText(change(current.paid, prev.paid))} vs ${esc(monthShort(prev.key).toLowerCase())}` : 'Todas las campañas'))}
            ${kpi('Orgánico', num(current.organico), current.organico === null ? lacking : caption('Nuevos − pauta'))}
          </div>
          <div class="rp-split rp-split-followers">
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">Seguidores por marca</div>
              <table class="rp-table">
                <colgroup><col style="width:25%"><col span="5" style="width:15%"></colgroup>
                <thead><tr><th>Marca</th><th class="num">Nuevos</th><th class="num">Bajas</th><th class="num">Netos</th><th class="num">Pauta</th><th class="num">Orgánico</th></tr></thead>
                <tbody>${followerRows}</tbody>
              </table>
              <div class="rp-table-foot">Orgánico = nuevos − los que trajo la pauta (sin descontar bajas). Nuevos y bajas: ${report.hasInstagram ? 'Instagram' : 'Meta Business Suite'}.</div>
            </div>
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">Costo por seguidor (Tráfico al perfil)</div>
              <table class="rp-table">
                <thead><tr><th>Marca</th><th class="num">Inversión</th><th class="num">Seg.</th><th class="num">Costo/seg.</th></tr></thead>
                <tbody>${costRows}</tbody>
              </table>
              <div class="rp-table-foot">Costo/seg. = inversión en Tráfico al perfil ÷ seguidores de pauta de todas las campañas.${missing.length ? ` La descarga de ${esc(list(missing))} no trae la columna de seguidores.` : ''}</div>
            </div>
          </div>
          ${missingAny && api().teamMode() ? '<p class="rp-hint">Escribe en la tabla los nuevos y las bajas de cada marca (clic en la casilla). Salen de Meta Business Suite &gt; Estadísticas &gt; Público &gt; Tendencias, con la cuenta de Instagram y el mes completo: <b>Nuevos</b> = Seguimientos, <b>Bajas</b> = Personas que dejaron de seguirte. Netos y orgánico se calculan solos. Esta indicación no sale en el PDF.</p>' : ''}
          ${insight('Clave', 'user', 'seg:clave3', noteOr(notes, 'seg:clave3', suggestFollowersKey(report)))}
        </div>
        ${footer(report.labels.followersSource, report, page, total)}
      </section>`;
  }

  function followersEvolutionPage(report, notes, page, total) {
    const keys = report.keys;
    const trend = followersTrend(report);
    const month = monthShort(trend.current.key).toUpperCase();
    const empty = keys.map((_, index) => (report.brands.every(brand => brand.followers[index].paid === null) ? 'sin datos' : ''));
    // Graficos solo de lineas (lo pidio el equipo): seguidores de pauta y costo por seguidor de cada marca por mes.
    // 620 x 146 sigue la forma de la tarjeta baja (.rp-charts-short, ~596 x 140).
    const [chartWidth, chartHeight] = [620, 146];
    const lines = pick => report.brands.map(brand => ({ name: brand.name, color: brand.color, values: brand.followers.map(pick) }));
    const paidChart = seriesChart('Seguidores de pauta por mes', keys, lines(item => item.paid), num, empty, chartWidth, chartHeight);
    const costChart = seriesChart('Costo por seguidor por mes', keys, lines(item => item.costPerFollower), money2, empty, chartWidth, chartHeight);
    const rows = report.brands.map(brand => {
      const values = brand.followers;
      const lastItem = values[values.length - 1];
      const earlier = values.slice(0, -1).filter(item => finite(item.costPerFollower));
      const avgCost = earlier.length ? earlier.reduce((total, item) => total + item.trafficSpend, 0) / earlier.reduce((total, item) => total + item.paid, 0) : null;
      return `
        <tr>
          <td class="rp-name"><i class="rp-dot" style="background:${brand.color}"></i>${esc(brand.name)}</td>
          ${values.map((item, index) => `<td class="num${index === values.length - 1 ? ' rp-strong' : ''}">${item.status !== 'ok' || !item.hasColumn ? '<span class="rp-faint">Sin datos</span>' : num(item.paid)}</td>`).join('')}
          <td class="num"><b>${money2(lastItem.costPerFollower)}</b></td>
          <td class="num">${deltaCell(change(lastItem.costPerFollower, avgCost), 'down')}</td>
        </tr>`;
    }).join('');
    const kpiCaption = text => `<span class="rp-delta muted">${esc(text)}</span>`;
    return `
      <section class="rp-page">
        ${head('Evolución de seguidores y costo', `Seguidores por pauta y costo por seguidor, mes a mes · ${monthShort(keys[0]).toLowerCase()} – ${monthShort(keys[keys.length - 1]).toLowerCase()}`, report.labels.badge)}
        <div class="rp-body">
          <div class="rp-grid-4 rp-kpis-compact">
            ${kpi(`Seguidores ${month}`, num(trend.current.paid), kpiCaption(trend.avgPaid !== null ? `vs ${num(trend.avgPaid)} prom. ${trend.span}` : 'De pauta, todas las campañas'))}
            ${kpi(`Costo/seg. ${month}`, money2(trend.current.costPerFollower), kpiCaption(trend.lowest ? 'El más bajo del periodo' : trend.avgCost !== null ? `vs ${money2(trend.avgCost)} prom. ${trend.span}` : 'Inversión Tráfico ÷ seguidores'))}
            ${kpi('Crecimiento', trend.growth !== null ? `x${decimals(trend.growth, 1)}` : '—', kpiCaption(trend.growth !== null ? `vs prom. ${trend.span}` : 'Sin meses anteriores con dato'))}
            ${kpi('Mejora de costo', trend.costChange !== null ? pctText(trend.costChange) : '—', kpiCaption(trend.costChange !== null ? 'Costo/seg. vs prom.' : 'Sin meses anteriores con dato'))}
          </div>
          <div class="rp-split rp-split-even rp-charts-row rp-charts-short">
            <div class="rp-card rp-chart-card">${paidChart}</div>
            <div class="rp-card rp-chart-card">${costChart}</div>
          </div>
          <div class="rp-card rp-table-card">
            <div class="rp-card-title">Seguidores por pauta por marca <span class="rp-card-note">· costo/seg. de ${esc(monthLong(trend.current.key))}</span></div>
            <table class="rp-table rp-month-table rp-followers-table">
              <colgroup><col style="width:16%">${keys.map(() => '<col>').join('')}<col style="width:13%"><col style="width:11%"></colgroup>
              <thead><tr><th>Marca</th>${keys.map(key => `<th class="num">${esc(monthShort(key))}</th>`).join('')}<th class="num">Costo/seg.</th><th class="num">vs prom.</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="rp-table-foot">Costo/seg. = inversión en Tráfico al perfil ÷ seguidores de pauta del mes (todas las campañas). "vs prom." contra los meses anteriores.</div>
          </div>
          ${insight('Evolución', 'trend', 'seg:evol2', noteOr(notes, 'seg:evol2', suggestFollowersEvolution(report)), 'rp-insight-tight')}
        </div>
        ${footer(report.labels.followersSource, report, page, total)}
      </section>`;
  }

  // Los anuncios que mas lograron en el objetivo, con su pieza: como la tarjeta "Mejores anuncios" de la plantilla.
  function bestAdsHtml(section) {
    const top = section.ads.filter(ad => ad.score > 0).slice(0, BEST_ADS);
    if (!top.length) return '<p class="rp-best-empty">Ningún anuncio registró resultados en el mes.</p>';
    return top.map((ad, index) => `
      <div class="rp-best${index === 0 ? ' is-first' : ''}">
        ${thumb(ad, 'rp-thumb-lg')}
        <div class="rp-best-text">
          <b title="${esc(ad.name)}">${esc(ad.name)}</b>
          <span>Gastó ${money(ad.spend)} · <b>${num(ad.score)}</b> ${esc(section.byFollows ? 'seguidores' : section.abbr.toLowerCase())}${ad.format ? ` · ${esc(ad.format.toLowerCase())}` : ''}</span>
          <span class="rp-best-cost">${cost(ad.scoreCost)}${section.byFollows ? ' por seguidor' : ` por ${esc(section.one)}`}${ad.index ? ` · ${deltaCell(ad.index - 1, 'down')} vs prom.` : ''}</span>
          ${previewLink(ad, 'Ver anuncio »')}
        </div>
      </div>`).join('');
  }

  // Estructura de la plantilla del equipo: KPIs, la evolucion en lineas (resultados y costo), los mejores anuncios con
  // su pieza y el analisis de que funciono, que no y por que.
  function sectionPage(brand, section, report, notes, page, total) {
    const { sum, prev } = section;
    const prevKey = prev?.key;
    const before = prev?.sum;
    const follows = section.key === 'trafico-perfil' && section.current.brandFollows !== null;
    return `
      <section class="rp-page">
        ${head(`${brand.name} · ${section.title}`, `${section.sub} · ${report.labels.window}`, report.labels.badge)}
        <div class="rp-body">
          <div class="rp-grid-6">
            ${kpi('Inversión', money(sum.spend), delta(change(sum.spend, before?.spend), prevKey))}
            ${kpi(section.noun, num(sum.results), delta(change(sum.results, before?.results), prevKey, 'up'))}
            ${kpi('Costo/result.', cost(sum.costPerResult), delta(section.costChange, prevKey, 'down'))}
            ${kpi('CPM', money2(sum.cpm), delta(change(sum.cpm, before?.cpm), prevKey, 'down'))}
            ${follows
              ? kpi('Seguidores de pauta', num(section.current.brandFollows), delta(prev?.brandFollows ? change(section.current.brandFollows, prev.brandFollows) : null, prevKey, 'up'))
              : kpi('Alcance', num(sum.reach), delta(change(sum.reach, before?.reach), prevKey, 'up'))}
            ${follows && section.current.brandFollows > 0
              ? kpi('Costo/seguidor', money2(sum.spend / section.current.brandFollows), '<span class="rp-delta muted">Inversión ÷ seguidores (todas)</span>')
              : kpi('Frecuencia', finite(sum.frequency) ? decimals(sum.frequency, 2) : '—', delta(change(sum.frequency, before?.frequency), prevKey))}
          </div>
          <div class="rp-split rp-split-section">
            <div class="rp-card rp-chart-card">
              <div class="rp-card-title">Evolución ${report.labels.days ? `${esc(report.labels.days)} ` : ''}por mes</div>
              <div class="rp-card-sub">${esc(capital(section.unit))} y costo por resultado · ${esc(section.history.map(point => monthShort(point.key).toLowerCase()).join('–'))}</div>
              ${evolutionChart(section)}
            </div>
            <div class="rp-card rp-best-card">
              <div class="rp-card-title">Mejores anuncios</div>
              <div class="rp-card-sub">Los que más ${esc(section.byFollows ? 'seguidores' : section.unit)} generaron en el mes</div>
              <div class="rp-best-list">${bestAdsHtml(section)}</div>
            </div>
          </div>
          ${insight('Qué funcionó y por qué', 'search', `sec:${brand.key}:${section.key}`, noteOr(notes, `sec:${brand.key}:${section.key}`, suggestSection(section)), 'rp-insight-tight')}
        </div>
        ${footer(report.labels.source, report, page, total)}
      </section>`;
  }

  function artsPage(brand, section, report, notes, page, total) {
    const shown = section.ads.slice(0, MAX_ADS);
    const rest = section.ads.slice(MAX_ADS);
    const follows = section.key === 'trafico-perfil' && section.found.includes('follows');
    const detail = section.key === 'interaccion' && section.found.includes('plays3s') ? ENGAGEMENT.filter(([field]) => section.found.includes(field)) : [];
    const rows = shown.map(ad => {
      const tags = `${ad.format ? `<span class="rp-pill">${esc(ad.format)}</span>` : ''}${ad.isNew ? '<span class="rp-pill new">Nuevo</span>' : ''}`;
      const sub = detail.length ? `<small>${detail.map(([field, label]) => `${field === 'plays3s' ? compact(ad[field]) : num(ad[field])} ${label}`).join(' · ')}</small>` : '';
      return `
        <tr${ad === section.best ? ' class="rp-top"' : ''}>
          <td><div class="rp-art">${thumb(ad)}<div class="rp-art-text"><b title="${esc(ad.name)}">${esc(ad.name)}</b><span>${tags}${sub}</span></div></div></td>
          <td class="num">${money(ad.spend)}</td>
          <td class="num">${num(ad.value)}</td>
          <td class="num">${cost(ad.cost)}</td>
          ${follows ? `<td class="num">${num(ad.follows)}</td><td class="num">${ad.follows > 0 ? money2(ad.spend / ad.follows) : '<span class="rp-faint">—</span>'}</td>` : ''}
          <td class="num">${ad.index ? deltaCell(ad.index - 1, 'down') : '<span class="rp-faint">—</span>'}</td>
          <td class="num">${previewLink(ad)}</td>
        </tr>`;
    }).join('');
    const restSpend = rest.reduce((sum, ad) => sum + ad.spend, 0);
    const formats = section.formats.length ? `
      <div class="rp-card rp-table-card rp-formats">
        <div class="rp-card-title">Por formato</div>
        <table class="rp-table">
          <thead><tr><th>Formato</th><th class="num">Artes</th><th class="num">Inversión</th><th class="num">${section.byFollows ? 'Costo/seg.' : 'Costo'}</th></tr></thead>
          <tbody>${section.formats.map((item, index) => `<tr${index === 0 && section.formats.length > 1 ? ' class="rp-top"' : ''}><td class="rp-name">${esc(item.format)}</td><td class="num">${item.count}</td><td class="num">${money(item.spend)}</td><td class="num">${cost(item.cost)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : '';
    return `
      <section class="rp-page">
        ${head(`${brand.name} · ${section.title} · Artes`, `Qué arte funcionó, en qué formato y por qué · ${report.labels.window}`, report.labels.badge)}
        <div class="rp-body">
          <div class="rp-card rp-table-card">
            <table class="rp-table rp-arts">
              <colgroup><col><col style="width:10%"><col style="width:9%"><col style="width:11%">${follows ? '<col style="width:8%"><col style="width:10%">' : ''}<col style="width:9%"><col style="width:7%"></colgroup>
              <thead><tr><th>Arte</th><th class="num">Inversión</th><th class="num">${esc(section.abbr)}</th><th class="num">${follows ? 'Costo/visita' : 'Costo/result.'}</th>${follows ? '<th class="num">Seguid.</th><th class="num">Costo/seg.</th>' : ''}<th class="num">vs prom.</th><th class="num">Ver</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="rp-table-foot">${section.byFollows
              ? `Promedio del objetivo: ${cost(section.sum.costPerResult)} por visita y ${money2(section.score.cost)} por seguidor (inversión en Tráfico al perfil ÷ seguidores de todas las campañas); "vs prom." va por el costo por seguidor.`
              : `Promedio del objetivo: ${cost(section.sum.costPerResult)} por ${esc(section.one)}; "vs prom." compara el costo de cada arte con ese promedio.`}${rest.length ? ` ${rest.length} artes más con ${money(restSpend)} de inversión.` : ''}</div>
          </div>
          <div class="rp-split ${formats ? 'rp-split-arts' : 'rp-split-single'}">
            ${formats}
            ${insight('Qué funcionó, qué no y por qué', 'trend', `art2:${brand.key}:${section.key}`, noteOr(notes, `art2:${brand.key}:${section.key}`, suggestArts(section)))}
          </div>
        </div>
        ${footer(report.labels.source, report, page, total)}
      </section>`;
  }

  function conclusionsPage(report, notes, page, total) {
    const cards = suggestConclusions(report).map((card, index) => `
      <div class="rp-card rp-conclusion">
        <div class="rp-toc-top"><span class="rp-icon framed">${icon(card.icon)}</span><span class="rp-concl-num">${pageNumber(index + 1)}</span></div>
        ${editable(`concl2:${index}:title`, noteOr(notes, `concl2:${index}:title`, card.title), 'h3')}
        ${editable(`concl2:${index}:text`, noteOr(notes, `concl2:${index}:text`, card.text))}
      </div>`).join('');
    return `
      <section class="rp-page">
        ${head('Conclusiones', 'Seguidores, artes y costos del mes.')}
        <div class="rp-body">
          <div class="rp-grid-3 rp-conclusions">${cards}</div>
          <div class="rp-note">${rich(report.labels.note)}</div>
        </div>
        ${footer(`Fuente: análisis Lima Retail · ${CLIENT} · ${report.period.name.toLowerCase()} ${report.period.year}`, report, page, total)}
      </section>`;
  }

  function nextStepsPage(report, notes, page, total) {
    const columns = report.brands.map(brand => {
      const suggested = suggestNext(brand, report);
      const block = (key, label, tone, text) => `
        <div class="rp-next-block ${tone}">
          <span class="rp-next-label">${label}</span>
          ${editable(`next:${brand.key}:${key}`, noteOr(notes, `next:${brand.key}:${key}`, text))}
        </div>`;
      return `
        <div class="rp-card rp-next">
          <div class="rp-next-head"><i class="rp-dot" style="background:${brand.color}"></i>${esc(brand.name)}</div>
          ${block('replicar', 'Replicar', 'good', suggested.replicate)}
          ${block('cortar', 'Descartar o ajustar', 'bad', suggested.cut)}
          ${block('proximo', 'Próximo mes', 'blue', suggested.next)}
        </div>`;
    }).join('');
    return `
      <section class="rp-page">
        ${head('Próximos pasos', 'Decisiones por marca a partir de los artes y los costos del mes.')}
        <div class="rp-body">
          <div class="rp-grid-3 rp-next-grid">${columns}</div>
        </div>
        ${footer(`Fuente: análisis Lima Retail · ${CLIENT} · ${report.period.name.toLowerCase()} ${report.period.year}`, report, page, total)}
      </section>`;
  }

  function closingPage() {
    return `
      <section class="rp-page rp-closing">
        <img src="${LOGO}" alt="Lima Retail">
        <b>Lima Retail</b>
        <span class="rp-closing-tag">Data Driven Marketing</span>
        <span>Power KPI · Digital Analytics</span>
      </section>`;
  }

  // ── Pintado ────────────────────────────────────────────────────────────
  function fitDeck() {
    const host = document.getElementById('week-report');
    if (!host || !host.clientWidth) return;
    host.style.setProperty('--rp-scale', String(Math.min(1, host.clientWidth / PAGE_WIDTH)));
  }

  function wireEditables(host, monthKey) {
    host.querySelectorAll('[data-note], [data-num]').forEach(node => {
      try {
        node.contentEditable = 'plaintext-only';
      } catch {
        node.contentEditable = 'true';
      }
      node.spellcheck = false;
      node.addEventListener('focus', () => { node.textContent = node.dataset.raw; });
      if (node.dataset.num) {
        // Las cifras de seguidores recalculan netos, organico y los textos: se guardan y se repinta al salir.
        node.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); node.blur(); } });
        node.addEventListener('blur', () => {
          const digits = node.innerText.replace(/[^\d]/g, '');
          const month = /^\d{4}-\d{2}$/.test(node.dataset.month || '') ? node.dataset.month : monthKey;
          saveNote(month, node.dataset.num, digits === '' ? null : Number(digits));
          render();
        });
        return;
      }
      node.addEventListener('input', () => {
        node.dataset.raw = node.innerText.replace(/\n+$/, '');
        saveNote(monthKey, node.dataset.note, node.dataset.raw);
      });
      node.addEventListener('blur', () => { node.innerHTML = rich(node.dataset.raw); });
    });
  }

  // Una miniatura de Meta que ya vencio (o no carga) vuelve al recuadro con el icono de su formato.
  function wireThumbs(host) {
    host.querySelectorAll('.rp-thumb img').forEach(image => {
      image.addEventListener('error', () => {
        const box = image.parentElement;
        box.classList.add('rp-thumb-ph');
        box.innerHTML = icon(image.dataset.fallback);
      }, { once: true });
    });
  }

  function render() {
    const host = document.getElementById('week-report');
    if (!host || !api()?.brandSnapshot) return;
    const available = periods();
    const select = document.getElementById('week-select');
    if (!available.length) {
      if (select) select.innerHTML = '<option value="">Sin meses con datos</option>';
      host.innerHTML = '<div class="panel"><div class="empty-state"><strong>Todavía no hay datos para el reporte</strong><span>El reporte se arma con las descargas de Meta Ads de las tres marcas. En cuanto haya un mes con entregas, aparece aquí.</span></div></div>';
      return;
    }
    if (!available.some(period => period.key === selectedMonth)) selectedMonth = available[0].key;
    const period = available.find(item => item.key === selectedMonth);
    if (select) {
      select.innerHTML = available.map(item => `<option value="${esc(item.key)}"${item.key === selectedMonth ? ' selected' : ''}>${esc(item.option)}</option>`).join('');
    }
    const model = document.getElementById('week-model');
    if (model) model.textContent = '';

    const report = buildReport(period);
    const notes = report.notes;
    // Cada lamina se pinta con su numero y el total, que se conoce al final.
    const pages = [
      () => coverPage(report),
      (page, total) => execPage(report, notes, page, total),
      (page, total) => followersPage(report, notes, page, total),
      (page, total) => followersEvolutionPage(report, notes, page, total),
    ];
    report.brands.forEach(brand => brand.sections.forEach(section => {
      pages.push((page, total) => sectionPage(brand, section, report, notes, page, total));
      pages.push((page, total) => artsPage(brand, section, report, notes, page, total));
    }));
    pages.push((page, total) => conclusionsPage(report, notes, page, total));
    pages.push((page, total) => nextStepsPage(report, notes, page, total));
    pages.push(() => closingPage());
    host.innerHTML = `
      ${checklist(report)}
      <div class="rp-deck" id="week-doc">
        ${pages.map((paint, index) => paint(index + 1, pages.length)).join('')}
      </div>`;
    fitDeck();
    wireEditables(host, period.key);
    wireThumbs(host);
  }

  // El nombre del PDF lo pone el navegador con el titulo del documento: se cambia solo mientras imprime.
  function printReport() {
    const period = periods().find(item => item.key === selectedMonth);
    if (!period) return;
    document.activeElement?.blur?.();
    const title = document.title;
    document.title = `Reporte_${CLIENT}_${period.labels.file}`;
    const restore = () => { document.title = title; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
    window.setTimeout(restore, 2000);
  }

  function init() {
    render();
    if (wired) return;
    wired = true;
    document.getElementById('week-select')?.addEventListener('change', event => {
      selectedMonth = event.target.value;
      render();
    });
    document.getElementById('week-print')?.addEventListener('click', printReport);
    // Sin dialogo de confirmacion: vuelve a los textos propuestos del mes (las cifras escritas se quedan).
    document.getElementById('week-reset')?.addEventListener('click', () => {
      if (!selectedMonth) return;
      resetNotes(selectedMonth);
      render();
    });
    const host = document.getElementById('week-report');
    if (host && typeof window.ResizeObserver === 'function') new window.ResizeObserver(fitDeck).observe(host);
    window.addEventListener('excambiare:data-updated', () => {
      if (document.getElementById('view-week')?.classList.contains('visible')) render();
    });
  }

  window.ReporteSemanal = { init };
})();
