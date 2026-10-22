(function () {
  // Generacion de Reporte: el PDF de publicidad con el diseño del modelo de Inversiones Excambiare ("Modelo Reporte
  // Inversiones Excambiare", version de seguidores e interaccion): laminas 16:9 con portada, crecimiento de
  // seguidores de las tres marcas (con el costo por seguidor de Trafico al perfil), por cada marca Reconocimiento,
  // Interaccion, sus mejores anuncios de interaccion y Trafico, conclusiones y cierre.
  //
  // Lleva las tres marcas en el mismo PDF: lee cada una con ExcambiareData.brandSnapshot() sin cambiar la marca
  // activa del tablero. Los numeros salen del barrido de Meta; los seguidores nuevos y las bajas vienen de Meta
  // Business Suite y se escriben sobre la lamina (netos y organico se calculan solos). Los seguidores de pauta y el
  // desglose de interacciones salen de columnas opcionales de la descarga (month.found): sin ellas, la lamina lo
  // avisa. Los textos vienen propuestos y se editan sobre la lamina; todo queda guardado por mes en este navegador.
  //
  // El template es propio de Excambiare: cada tablero de marca tiene el suyo, adaptado por la marca.
  const CLIENT = 'Excambiare';
  const NOTES_KEY = 'excambiare-report-notes-v2';
  const PAGE_WIDTH = 1280;
  const LOGO = 'assets/logo-lima-retail.png';
  const EVOLUTION_MONTHS = 4;
  const MAX_ADS = 3;
  const MAX_INTERACTION_ADS = 4;
  // Orden y nombres del modelo.
  const BRANDS = [
    { key: 'mex-cream', name: 'MEX' },
    { key: 'gold-fusion', name: 'Gold Fusion' },
    { key: 'sol-y-tierra', name: 'Sol y Tierra' },
  ];
  // Un objetivo por pagina, en el orden del modelo. El objetivo sale del nombre de la campaña (js/data-source.js).
  const SECTIONS = [
    { key: 'reconocimiento', title: 'Reconocimiento', sub: 'Objetivo de reproducciones de video', noun: 'Reproducciones', abbr: 'Reprod.', color: '#2563eb' },
    { key: 'interaccion', title: 'Interacción', sub: 'Objetivo de interacciones', noun: 'Interacciones', abbr: 'Interac.', color: '#14a08c' },
    { key: 'trafico-perfil', title: 'Tráfico', sub: 'Objetivo de visitas al perfil', noun: 'Visitas', abbr: 'Visitas', color: '#2563eb' },
  ];
  // Desglose de interacciones, en el orden del modelo. Una fila en cero no se muestra.
  const BREAKDOWN = [
    { field: 'plays3s', label: 'Reproducciones (3s)' },
    { field: 'reactions', label: 'Reacciones' },
    { field: 'clicks', label: 'Clics' },
    { field: 'saves', label: 'Guardados' },
    { field: 'shares', label: 'Compartidos' },
    { field: 'comments', label: 'Comentarios' },
  ];
  // Columnas de la tabla de mejores anuncios de interaccion.
  const AD_BREAKDOWN = [
    { field: 'plays3s', label: 'Reproduc.' },
    { field: 'reactions', label: 'Reacciones' },
    { field: 'saves', label: 'Guardados' },
    { field: 'shares', label: 'Compart.' },
  ];

  const ICONS = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    play: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m10 8 6 4-6 4z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.pulse}</svg>`;

  let selectedMonth = '';
  let wired = false;

  const api = () => window.ExcambiareData || null;
  const esc = value => api().esc(value);
  const finite = value => value != null && value !== '' && Number.isFinite(Number(value));

  // ── Formatos ("S/. 192", "S/. 0.0096", "19,998", "+89", "−12"): la moneda y los miles como en el resto del tablero ──
  const integer = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
  // Montos con separador de miles es-PE y decimales fijos (un Intl.NumberFormat por cantidad de decimales).
  const decimalFormats = new Map();
  const decimals = (value, digits) => {
    if (!decimalFormats.has(digits)) decimalFormats.set(digits, new Intl.NumberFormat('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
    return decimalFormats.get(digits).format(Number(value));
  };
  const num = value => (finite(value) ? integer.format(Math.round(value)) : '—');
  const signed = value => (finite(value) ? `${value > 0 ? '+' : value < 0 ? '−' : ''}${integer.format(Math.abs(Math.round(value)))}` : '—');
  const money = value => (finite(value) ? `S/. ${integer.format(Math.round(value))}` : '—');
  const money2 = value => (finite(value) ? `S/. ${decimals(value, 2)}` : '—');
  const cost = value => (finite(value) && value > 0 ? `S/. ${decimals(value, value < 1 ? 4 : 2)}` : '—');
  const costShort = value => (finite(value) && value > 0 ? `S/. ${decimals(value, value < 1 ? 3 : 2)}` : '—');
  const compact = value => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : integer.format(Math.round(value)));
  const share = (part, total) => (total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—');
  const pageNumber = value => String(value).padStart(2, '0');
  const list = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] || '');
  const sumOf = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  const activity = row => Number(row.spend) > 0 || Number(row.impressions) > 0;

  // ── Periodo: el mes elegido, en la misma ventana (1 al ultimo dia con datos) para todas las marcas ──
  const brandData = key => api()?.brandSnapshot?.(key) || null;
  const monthOf = (key, monthKey) => (brandData(key)?.months || []).find(month => month.key === monthKey && !month.error) || null;

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
          window: closed ? `${name.toLowerCase()} completo` : `1 – ${to} ${short}.`,
          days: closed ? '' : `1-${to}`,
          source: `Fuente: Meta Ads · ${closed ? `${name.toLowerCase()} ${year}` : `1 – ${to} ${short} ${year}`}`,
          followersSource: `Fuente: Meta Business Suite + Ads · ${closed ? `${name.toLowerCase()} ${year}` : `1 – ${to} ${short} ${year}`}`,
          footer: `${CLIENT} · Reporte Meta Ads · ${closed ? `${name} ${year}` : `1-${to} ${name} ${year}`}`,
          note: closed
            ? `**Datos de ${name.toLowerCase()} ${year}.** Comparación mes a mes.`
            : `**Datos del período 1 – ${to} de ${name.toLowerCase()}.** Comparación 1-${to} mes a mes.`,
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
    const sum = { spend: sumOf(rows, 'spend'), impressions: sumOf(rows, 'impressions'), reach: sumOf(rows, 'reach'), results: sumOf(rows, 'results') };
    BREAKDOWN.forEach(item => { sum[item.field] = sumOf(rows, item.field); });
    sum.costPerResult = sum.results > 0 ? sum.spend / sum.results : null;
    sum.cpm = sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : null;
    sum.frequency = sum.reach > 0 ? sum.impressions / sum.reach : null;
    return sum;
  }

  // Anuncios de unas filas por nombre, con su vista previa (la del mismo anuncio en otro mes si Meta la dejo vacia)
  // y las sumas del desglose de interacciones.
  function adsOf(rows, previews) {
    const byName = new Map();
    rows.forEach(row => {
      const key = String(row.ad || '').trim().toLowerCase();
      if (!key) return;
      if (!byName.has(key)) byName.set(key, { name: String(row.ad).trim(), spend: 0, value: 0, preview: '', ...Object.fromEntries(BREAKDOWN.map(item => [item.field, 0])) });
      const ad = byName.get(key);
      ad.spend += Number(row.spend) || 0;
      ad.value += Number(row.results) || 0;
      BREAKDOWN.forEach(item => { ad[item.field] += Number(row[item.field]) || 0; });
      if (!ad.preview && /^https:\/\//.test(row.preview || '')) ad.preview = row.preview;
    });
    return [...byName.entries()]
      .map(([key, ad]) => Object.assign(ad, { preview: ad.preview || previews?.get(key) || '' }))
      .filter(ad => ad.spend > 0 || ad.value > 0)
      .sort((left, right) => right.value - left.value || right.spend - left.spend);
  }

  // ── Armado del reporte ─────────────────────────────────────────────────
  function buildReport(period, notes) {
    const evolution = Array.from({ length: EVOLUTION_MONTHS }, (_, index) => shiftMonth(period.key, index - EVOLUTION_MONTHS + 1));
    const brands = BRANDS.map(brand => {
      const data = brandData(brand.key);
      const { month, rows } = windowRows(brand.key, period.key, period);
      const found = month?.found || [];
      const traffic = rows.filter(row => row.group === 'trafico-perfil');
      // De pauta: los seguidores que trajo la campaña de Trafico al perfil (columna Seguimientos de Instagram).
      const hasFollows = found.includes('follows');
      const paid = hasFollows ? sumOf(traffic, 'follows') : null;
      const trafficSpend = sumOf(traffic, 'spend');
      const entered = key => (finite(notes[`seg:${brand.key}:${key}`]) ? Number(notes[`seg:${brand.key}:${key}`]) : null);
      const nuevos = entered('nuevos');
      const dejaron = entered('dejaron');
      const breakdownFound = BREAKDOWN.some(item => item.field !== 'clicks' && found.includes(item.field));
      const sections = SECTIONS.concat(
        [...new Set(rows.filter(activity).map(row => row.group))]
          .filter(key => !SECTIONS.some(section => section.key === key))
          .map(key => {
            const sample = rows.find(row => row.group === key);
            return { key, title: sample.groupLabel, sub: `Objetivo de ${sample.groupLabel.toLowerCase()}`, noun: 'Resultados', abbr: 'Result.', color: '#2563eb' };
          }),
      ).map(section => {
        const sectionRows = rows.filter(row => row.group === section.key);
        if (!sectionRows.some(activity)) return null;
        const history = evolution.map(key => {
          const past = windowRows(brand.key, key, period).rows.filter(row => row.group === section.key);
          const sum = totals(past);
          return { key, label: api().SHORT_MONTHS[Number(key.slice(5)) - 1], results: sum.results, costPerResult: sum.costPerResult, has: past.some(activity) };
        });
        const ads = adsOf(sectionRows, data?.previews);
        return {
          ...section,
          sum: totals(sectionRows),
          history,
          ads: ads.slice(0, MAX_ADS),
          topAds: ads.slice(0, MAX_INTERACTION_ADS),
          breakdown: section.key === 'interaccion' && breakdownFound,
        };
      }).filter(Boolean);
      return {
        ...brand,
        month,
        found,
        hasFollows,
        breakdownFound,
        rows,
        paid,
        trafficSpend,
        trafficCost: paid > 0 ? trafficSpend / paid : null,
        nuevos,
        dejaron,
        netos: nuevos !== null && dejaron !== null ? nuevos - dejaron : null,
        // Organico = nuevos − los que trajo la pauta (sin descontar bajas), como en el modelo.
        organico: nuevos !== null && paid !== null ? nuevos - paid : null,
        sections,
      };
    }).filter(brand => brand.rows.some(activity));

    const sumBrands = field => (brands.length && brands.every(brand => brand[field] !== null) ? brands.reduce((total, brand) => total + brand[field], 0) : null);
    return {
      period,
      labels: period.labels,
      brands,
      followers: {
        nuevos: sumBrands('nuevos'),
        dejaron: sumBrands('dejaron'),
        netos: sumBrands('netos'),
        paid: sumBrands('paid'),
        organico: sumBrands('organico'),
        entered: brands.length > 0 && brands.every(brand => brand.netos !== null),
        anyFollows: brands.some(brand => brand.hasFollows),
      },
    };
  }

  // ── Textos propuestos (el equipo los reescribe sobre la lamina) ─────────
  const cheapest = brands => brands.filter(brand => finite(brand.trafficCost)).sort((left, right) => left.trafficCost - right.trafficCost)[0];
  const priciest = brands => brands.filter(brand => finite(brand.trafficCost)).sort((left, right) => right.trafficCost - left.trafficCost)[0];

  function suggestFollowersKey(report) {
    const { followers, brands } = report;
    const best = cheapest(brands);
    const bestText = best ? ` ${best.name} el más eficiente en pauta (${money2(best.trafficCost)}/seg).` : '';
    if (followers.nuevos !== null && followers.paid !== null) {
      return `${num(followers.nuevos)} seguidores nuevos: ${num(followers.paid)} los trajo la pauta (Tráfico al perfil) y ${num(followers.organico)} llegaron orgánicamente.${bestText}${followers.netos !== null ? ` Restando las ${num(followers.dejaron)} bajas, el crecimiento neto real es ${signed(followers.netos)}.` : ''}`;
    }
    if (followers.paid !== null) {
      return `La pauta (Tráfico al perfil) trajo ${num(followers.paid)} seguidores.${bestText} Escribe los nuevos y las bajas de cada marca (Meta Business Suite) para ver el orgánico y el crecimiento neto.`;
    }
    return 'Escribe los seguidores nuevos y las bajas de cada marca (Meta Business Suite) para ver el crecimiento neto. La descarga de Meta Ads todavía no trae la columna de seguidores por anuncio (Seguimientos de Instagram).';
  }

  const playsShare = sum => (sum.results > 0 && sum.plays3s > 0 ? sum.plays3s / sum.results : null);

  function suggestSection(brand, section) {
    const top = section.ads[0];
    if (section.key !== 'interaccion') {
      return top ? `"${top.name}" es el mejor arte con ${num(top.value)} ${section.noun.toLowerCase()}.` : `${num(section.sum.results)} ${section.noun.toLowerCase()} en el período.`;
    }
    const parts = [];
    const plays = playsShare(section.sum);
    if (section.breakdown && plays !== null) {
      parts.push(`El ${Math.round(plays * 100)}% son reproducciones de video${section.sum.reactions > 0 ? `; reacciones ${num(section.sum.reactions)}` : ''}.`);
    } else if (!section.breakdown) {
      parts.push(`La descarga de ${brand.name} no trae el desglose por tipo de interacción; solo el total.`);
    }
    if (top) parts.push(`"${top.name}" lidera con ${num(top.value)} interacciones.`);
    return parts.join(' ');
  }

  function suggestInteractionAds(section) {
    const top = section.topAds[0];
    if (!top) return 'Sin anuncios de interacción con entrega en el período.';
    const parts = [`"${top.name}" lidera con ${num(top.value)} interacciones${section.breakdown && top.reactions > 0 ? ` (${num(top.reactions)} reacciones)` : ''}.`];
    const plays = playsShare(section.sum);
    if (section.breakdown && plays !== null && plays >= 0.9) parts.push('El video con narrativa de momento genera más engagement.');
    return parts.join(' ');
  }

  function suggestConclusions(report) {
    const { followers, brands } = report;
    const cards = [];
    const best = cheapest(brands);
    if (followers.nuevos !== null && followers.paid !== null) {
      cards.push({
        icon: 'user',
        title: `${num(followers.nuevos)} seguidores nuevos`,
        text: `${num(followers.paid)} por pauta (Tráfico al perfil) y ${num(followers.organico)} orgánicos.${followers.netos !== null ? ` Restando ${num(followers.dejaron)} bajas, el neto real es ${signed(followers.netos)}.` : ''}${best ? ` ${best.name} lidera al mejor costo (${money2(best.trafficCost)}/seg).` : ''}`,
      });
    } else {
      cards.push({
        icon: 'user',
        title: followers.paid !== null ? `${num(followers.paid)} seguidores de pauta` : 'Medir los seguidores',
        text: `${followers.paid !== null ? `Tráfico al perfil trajo ${num(followers.paid)} seguidores.${best ? ` ${best.name} lidera al mejor costo (${money2(best.trafficCost)}/seg).` : ''} ` : ''}Falta registrar los nuevos y las bajas de cada marca para medir el orgánico y el crecimiento neto real.`,
      });
    }
    const shares = brands.map(brand => brand.sections.find(section => section.key === 'interaccion'))
      .filter(section => section && section.breakdown)
      .map(section => playsShare(section.sum))
      .filter(value => value !== null)
      .map(value => Math.round(value * 100));
    if (shares.length) {
      const low = Math.min(...shares);
      const high = Math.max(...shares);
      cards.push({
        icon: 'play',
        title: 'El video es el formato ganador',
        text: `En ${shares.length === brands.length ? `las ${brands.length} marcas` : `${shares.length} de las ${brands.length} marcas`}, el ${low === high ? low : `${low}-${high}`}% de las interacciones son reproducciones de video. El formato de narración de momento es el que más convierte.`,
      });
    } else {
      const leader = brands.map(brand => ({ brand, section: brand.sections.find(section => section.key === 'interaccion') }))
        .filter(item => item.section)
        .sort((left, right) => right.section.sum.results - left.section.sum.results)[0];
      if (leader) {
        cards.push({
          icon: 'play',
          title: `${leader.brand.name} lidera en interacción`,
          text: `${num(leader.section.sum.results)} interacciones a ${cost(leader.section.sum.costPerResult)} cada una${leader.section.ads[0] ? `; "${leader.section.ads[0].name}" es el arte top` : ''}.`,
        });
      }
    }
    const worst = priciest(brands);
    cards.push({
      icon: 'search',
      title: 'Reforzar tráfico al perfil',
      text: `Es la campaña que trae seguidores.${worst && worst !== best ? ` ${worst.name} tiene el costo más alto (${money2(worst.trafficCost)}) — ajustar público y piezas.` : ' Sostener la inversión y renovar las piezas para bajar el costo por seguidor.'}`,
    });
    return cards.slice(0, 3);
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
    // Restablecer vuelve a los textos propuestos; las cifras de Business Suite que escribio el equipo se quedan.
    const notes = readNotes();
    notes[monthKey] = Object.fromEntries(Object.entries(notes[monthKey] || {}).filter(([key]) => /^seg:[^:]+:(nuevos|dejaron)$/.test(key)));
    writeNotes(notes);
  }

  // **texto** va en negrita, como en los demas modelos.
  const rich = text => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const editable = (key, text, tag = 'p') => `<${tag} class="rp-edit" data-note="${esc(key)}" data-raw="${esc(text)}" title="Clic para editar · **texto** va en negrita">${rich(text)}</${tag}>`;
  const noteOr = (notes, key, suggested) => (notes[key] != null ? notes[key] : suggested);
  // Cifra que escribe el equipo (Business Suite): vacia, la lamina muestra una casilla para completarla.
  const numberCell = (key, value, shown) => `<span class="rp-edit rp-num${value === null ? ' is-empty' : ''}" data-num="${esc(key)}" data-raw="${value === null ? '' : value}" title="Clic para escribir la cifra de Meta Business Suite">${value === null ? '—' : shown}</span>`;

  // ── Piezas de las laminas ──────────────────────────────────────────────
  const kpi = (label, value, foot) => `
    <div class="rp-card rp-kpi">
      <span class="rp-kpi-label">${esc(label)}</span>
      <strong>${value}</strong>
      <span class="rp-delta muted">${esc(foot)}</span>
    </div>`;

  const head = (title, sub) => `<header class="rp-head"><h2>${esc(title)}</h2><p>${esc(sub)}</p></header>`;

  function footer(left, report, page, total) {
    return `
      <footer class="rp-foot">
        <span>${esc(left)}</span>
        <span class="rp-foot-right"><img src="${LOGO}" alt=""><b>Lima Retail</b>${esc(report.labels.footer)} · ${pageNumber(page)} / ${pageNumber(total)}</span>
      </footer>`;
  }

  const insight = (label, iconName, key, text) => `
    <div class="rp-insight">
      <span class="rp-insight-icon">${icon(iconName)}</span>
      <div>
        <span class="rp-insight-label">${label}</span>
        ${editable(key, text)}
      </div>
    </div>`;

  // Resultados (arriba) y costo por resultado (abajo) por mes, en la misma ventana de dias.
  function evolutionChart(section) {
    const points = section.history;
    const left = 46;
    const right = 600;
    const x = index => left + ((right - left) * index) / Math.max(points.length - 1, 1);
    const panel = (values, top, bottom, color, label, format) => {
      const known = values.filter(finite);
      const max = Math.max(...known, 0) * 1.25 || 1;
      const y = value => bottom - (value / max) * (bottom - top);
      const grid = [0, 0.5, 1].map(step => `<line x1="${left}" x2="${right}" y1="${y(max * step)}" y2="${y(max * step)}" class="rp-grid"/>`).join('');
      const path = values.map((value, index) => (finite(value) ? `${x(index)},${y(value)}` : null)).filter(Boolean).join(' ');
      const marks = values.map((value, index) => (finite(value)
        ? `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/><text x="${x(index)}" y="${y(value) - 8}" text-anchor="middle" class="rp-point" fill="${color}">${format(value)}</text>`
        : '')).join('');
      return `<text x="${left}" y="${top - 8}" class="rp-chart-sub" fill="${color}">${esc(label)}</text>${grid}<polyline points="${path}" fill="none" stroke="${color}" stroke-width="2.2"/>${marks}`;
    };
    return `
      <svg class="rp-chart" viewBox="0 0 620 210" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${esc(section.title)}: evolución por mes">
        <text x="${left}" y="13" class="rp-chart-title">${esc(section.title)} · evolución</text>
        ${panel(points.map(point => (point.has ? point.results : null)), 36, 92, section.color, 'Resultados', compact)}
        ${panel(points.map(point => (point.has ? point.costPerResult : null)), 128, 182, '#c8102e', 'Costo por resultado', costShort)}
        ${points.map((point, index) => `<text x="${x(index)}" y="200" text-anchor="middle" class="rp-axis"><tspan font-weight="700">${esc(point.label)}</tspan></text>`).join('')}
      </svg>`;
  }

  const previewLink = ad => {
    const url = api().safeUrl(ad.preview);
    return url ? `<a href="${url}" target="_blank" rel="noopener">Ver »</a>` : '—';
  };

  function adsTable(ads, columnLabel) {
    if (!ads.length) return '<p class="rp-empty">Sin anuncios con entrega en el período.</p>';
    return `
      <table class="rp-table rp-ads">
        <colgroup><col><col style="width:16%"><col style="width:20%"><col style="width:13%"></colgroup>
        <thead><tr><th>Anuncio</th><th class="num">Gasto</th><th class="num">${esc(columnLabel)}</th><th class="num">Ver</th></tr></thead>
        <tbody>${ads.map((ad, index) => `<tr${index === 0 ? ' class="rp-top"' : ''}><td class="rp-name" title="${esc(ad.name)}">${esc(ad.name)}</td><td class="num">${money(ad.spend)}</td><td class="num">${num(ad.value)}</td><td class="num">${previewLink(ad)}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  function breakdownTable(section) {
    const total = section.sum.results;
    const rows = BREAKDOWN.filter(item => section.sum[item.field] > 0);
    return `
      <table class="rp-table rp-ads rp-breakdown">
        <colgroup><col><col style="width:26%"><col style="width:22%"></colgroup>
        <thead><tr><th>Tipo</th><th class="num">Cantidad</th><th class="num">% total</th></tr></thead>
        <tbody>${rows.map((item, index) => `<tr${index === 0 ? ' class="rp-top"' : ''}><td class="rp-name">${esc(item.label)}</td><td class="num"><b>${num(section.sum[item.field])}</b></td><td class="num">${share(section.sum[item.field], total)}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  // ── Laminas ────────────────────────────────────────────────────────────
  function coverPage(report) {
    return `
      <section class="rp-page rp-cover">
        <div class="rp-brand"><img src="${LOGO}" alt="Lima Retail"><div><b>Lima Retail</b><span>Data Driven Marketing</span></div></div>
        <div class="rp-cover-body">
          <h1>Reporte de Publicidad</h1>
          <p class="rp-cover-client">Cliente: <b>${CLIENT}</b></p>
          <p class="rp-cover-period">${esc(report.labels.range)} · Seguidores e interacción&nbsp; | &nbsp;Meta Ads</p>
        </div>
      </section>`;
  }

  function followersPage(report, notes, total) {
    const { followers, brands, labels } = report;
    const followRows = brands.map((brand, index) => `
      <tr${index === 0 ? ' class="rp-top"' : ''}>
        <td class="rp-name">${esc(brand.name)}</td>
        <td class="num">${numberCell(`seg:${brand.key}:nuevos`, brand.nuevos, num(brand.nuevos))}</td>
        <td class="num rp-bad">${numberCell(`seg:${brand.key}:dejaron`, brand.dejaron, brand.dejaron ? `-${num(brand.dejaron)}` : '0')}</td>
        <td class="num"><b>${signed(brand.netos)}</b></td>
        <td class="num rp-blue">${num(brand.paid)}</td>
        <td class="num rp-orange">${num(brand.organico)}</td>
      </tr>`).join('');
    const costRows = brands.map(brand => `
      <tr>
        <td>${esc(brand.name)}</td>
        <td class="num">${money(brand.trafficSpend)}</td>
        <td class="num">${num(brand.paid)}</td>
        <td class="num"><b>${money2(brand.trafficCost)}</b></td>
      </tr>`).join('');
    const missing = brands.filter(brand => !brand.hasFollows).map(brand => brand.name);
    return `
      <section class="rp-page">
        ${head('Crecimiento de seguidores', `Nuevos, de pauta y orgánicos · costo por seguidor (Tráfico al perfil) · ${labels.window}`)}
        <div class="rp-body">
          <div class="rp-grid-5">
            ${kpi('Nuevos', num(followers.nuevos), 'Nos siguieron')}
            ${kpi('Dejaron', followers.dejaron === null ? '—' : `-${num(followers.dejaron)}`, 'Nos dejaron')}
            ${kpi('Netos', signed(followers.netos), 'Nuevos − bajas')}
            ${kpi('De pauta', num(followers.paid), 'Tráfico al perfil')}
            ${kpi('Orgánico', num(followers.organico), 'Nuevos − pauta')}
          </div>
          <div class="rp-split rp-split-even">
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">Seguidores por marca</div>
              <table class="rp-table">
                <colgroup><col style="width:27%"><col><col><col><col><col></colgroup>
                <thead><tr><th>Marca</th><th class="num">Nuevos</th><th class="num">Bajas</th><th class="num">Netos</th><th class="num">Pauta</th><th class="num">Orgán.</th></tr></thead>
                <tbody>${followRows}</tbody>
              </table>
              <div class="rp-table-foot">Orgánico = nuevos − los que trajo la pauta (sin descontar bajas).</div>
            </div>
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">Costo por seguidor (Tráfico perfil)</div>
              <table class="rp-table">
                <thead><tr><th>Marca</th><th class="num">Inversión</th><th class="num">Segs.</th><th class="num">Costo/seg</th></tr></thead>
                <tbody>${costRows}</tbody>
              </table>
              ${missing.length ? `<div class="rp-table-foot">${esc(`La descarga de ${list(missing)} no trae la columna de seguidores (Seguimientos de Instagram).`)}</div>` : ''}
            </div>
          </div>
          ${followers.entered ? '' : '<p class="rp-hint">Escribe en la tabla los seguidores nuevos y las bajas de cada marca (Meta Business Suite): netos y orgánico se calculan solos. Esta indicación no sale en el PDF.</p>'}
          ${insight('Clave', 'user', 'seg:clave', noteOr(notes, 'seg:clave', suggestFollowersKey(report)))}
        </div>
        ${footer(labels.followersSource, report, 2, total)}
      </section>`;
  }

  function sectionPage(brand, section, report, notes, page, total) {
    const key = `obj:${brand.key}:${section.key}`;
    const { sum } = section;
    return `
      <section class="rp-page">
        ${head(`${brand.name} · ${section.title}`, `${section.sub} · ${report.labels.window}`)}
        <div class="rp-body">
          <div class="rp-grid-3">
            ${kpi('Inversión', money(sum.spend), 'Coste')}
            ${kpi(section.noun, num(sum.results), 'Resultado')}
            ${kpi('Costo/result.', cost(sum.costPerResult), 'Coste÷result')}
            ${kpi('CPM', money2(sum.cpm), 'Costo/mil')}
            ${kpi('Alcance', num(sum.reach), 'Personas')}
            ${kpi('Frecuencia', finite(sum.frequency) ? sum.frequency.toFixed(2) : '—', 'Impr÷alc')}
          </div>
          <div class="rp-split">
            <div class="rp-card rp-chart-card">
              <div class="rp-card-title">Evolución ${report.labels.days ? `${esc(report.labels.days)} ` : ''}por mes</div>
              <div class="rp-card-sub">Resultados y costo · ${esc(section.history.map(point => point.label.toLowerCase()).join('-'))}.</div>
              ${evolutionChart(section)}
            </div>
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">${section.breakdown ? 'Desglose de interacciones' : 'Anuncios que funcionan'}</div>
              ${section.breakdown ? breakdownTable(section) : adsTable(section.ads, section.abbr)}
            </div>
          </div>
          ${insight('Qué funciona', 'pulse', key, noteOr(notes, key, suggestSection(brand, section)))}
        </div>
        ${footer(report.labels.source, report, page, total)}
      </section>`;
  }

  // Los mejores anuncios de interaccion de la marca con su desglose (reproducciones, reacciones, guardados...).
  function interactionAdsPage(brand, section, report, notes, page, total) {
    const key = `obj:${brand.key}:interaccion-anuncios`;
    const cell = (ad, field) => (section.breakdown ? num(ad[field]) : '—');
    const rows = section.topAds.map((ad, index) => `
      <tr${index === 0 ? ' class="rp-top"' : ''}>
        <td class="rp-name" title="${esc(ad.name)}">${esc(ad.name)}</td>
        <td class="num">${index === 0 ? `<b>${num(ad.value)}</b>` : num(ad.value)}</td>
        ${AD_BREAKDOWN.map(item => `<td class="num">${cell(ad, item.field)}</td>`).join('')}
        <td class="num">${previewLink(ad)}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="rp-empty">Sin anuncios de interacción con entrega en el período.</td></tr>';
    const foot = section.breakdown
      ? 'Desglose de cada arte: la mayoría son reproducciones de video; reacciones, guardados y compartidos muestran el engagement activo.'
      : `La descarga de ${brand.name} no trae el desglose por tipo de interacción: solo el total de cada arte.`;
    return `
      <section class="rp-page">
        ${head(`${brand.name} · Mejores anuncios de interacción`, `Los ${section.topAds.length || MAX_INTERACTION_ADS} artes top con su desglose · ${report.labels.window}`)}
        <div class="rp-body">
          <div class="rp-card rp-table-card">
            <table class="rp-table rp-interaction-ads">
              <colgroup><col><col style="width:12%">${AD_BREAKDOWN.map(() => '<col style="width:10%">').join('')}<col style="width:7%"></colgroup>
              <thead><tr><th>Anuncio</th><th class="num">Total interac.</th>${AD_BREAKDOWN.map(item => `<th class="num">${esc(item.label)}</th>`).join('')}<th class="num">Ver</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="rp-table-foot">${esc(foot)}</div>
          </div>
          ${insight('Qué funciona', 'trend', key, noteOr(notes, key, suggestInteractionAds(section)))}
        </div>
        ${footer(report.labels.source, report, page, total)}
      </section>`;
  }

  // Paginas de una marca: cada objetivo y, despues de Interaccion, sus mejores anuncios.
  function brandPages(brand) {
    return brand.sections.flatMap(section => (section.key === 'interaccion' ? [{ section, kind: 'section' }, { section, kind: 'ads' }] : [{ section, kind: 'section' }]));
  }

  function conclusionsPage(report, notes, page, total) {
    const cards = suggestConclusions(report).map((card, index) => `
      <div class="rp-card rp-conclusion">
        <div class="rp-toc-top"><span class="rp-icon framed">${icon(card.icon)}</span><span class="rp-concl-num">${pageNumber(index + 1)}</span></div>
        ${editable(`concl:${index}:title`, noteOr(notes, `concl:${index}:title`, card.title), 'h3')}
        ${editable(`concl:${index}:text`, noteOr(notes, `concl:${index}:text`, card.text))}
      </div>`).join('');
    return `
      <section class="rp-page">
        ${head('Conclusiones', 'Hallazgos de seguidores e interacción.')}
        <div class="rp-body">
          <div class="rp-grid-3 rp-conclusions">${cards}</div>
          <div class="rp-note">${rich(report.labels.note)}</div>
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
        // Las cifras de Business Suite recalculan netos, organico y los textos: se guardan y se repinta al salir.
        node.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); node.blur(); } });
        node.addEventListener('blur', () => {
          const digits = node.innerText.replace(/[^\d]/g, '');
          saveNote(monthKey, node.dataset.num, digits === '' ? null : Number(digits));
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

    const notes = readNotes()[period.key] || {};
    const report = buildReport(period, notes);
    const brandHtml = [];
    let page = 3;
    report.brands.forEach(brand => brandPages(brand).forEach(item => {
      brandHtml.push({ brand, ...item, page });
      page += 1;
    }));
    const conclusions = page;
    const total = conclusions + 1;
    host.innerHTML = `
      <div class="rp-deck" id="week-doc">
        ${coverPage(report)}
        ${followersPage(report, notes, total)}
        ${brandHtml.map(item => (item.kind === 'ads'
          ? interactionAdsPage(item.brand, item.section, report, notes, item.page, total)
          : sectionPage(item.brand, item.section, report, notes, item.page, total))).join('')}
        ${conclusionsPage(report, notes, conclusions, total)}
        ${closingPage()}
      </div>`;
    fitDeck();
    wireEditables(host, period.key);
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
