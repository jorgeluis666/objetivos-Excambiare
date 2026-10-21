(function () {
  // Generacion de Reporte: el PDF de publicidad con el diseño del modelo de Inversiones Excambiare ("Modelo Reporte
  // Inversiones Excambiare"): laminas 16:9 con portada, contenido, crecimiento de seguidores de las tres marcas,
  // artes que trajeron seguidores, evolucion de los seguidores de pauta, una pagina por objetivo de cada marca
  // (Reconocimiento, Interaccion, Trafico), conclusiones y cierre.
  //
  // Lleva las tres marcas en el mismo PDF: lee cada una con ExcambiareData.brandSnapshot() sin cambiar la marca
  // activa del tablero. Los numeros salen del barrido de Meta; los seguidores nuevos y los que dejaron de seguir
  // vienen de Meta Business Suite y se escriben sobre la lamina (netos y organico se calculan solos). Los
  // seguidores por anuncio y el desglose de interacciones salen de columnas opcionales de la descarga
  // (month.found): sin ellas, la lamina lo avisa. Los textos vienen propuestos y se editan sobre la lamina; todo
  // queda guardado por mes en este navegador.
  //
  // El template es propio de Excambiare: cada tablero de marca tiene el suyo, adaptado por la marca.
  const CLIENT = 'Excambiare';
  const NOTES_KEY = 'excambiare-report-notes-v2';
  const PAGE_WIDTH = 1280;
  const LOGO = 'assets/logo-lima-retail.png';
  const AGENCY_LINE = 'Lima Retail · Data Driven Marketing · Power KPI · Digital Analytics';
  const EVOLUTION_MONTHS = 4;
  const MAX_ADS = 3;
  // Orden y nombres del modelo.
  const BRANDS = [
    { key: 'mex-cream', name: 'MEX', short: 'MEX' },
    { key: 'gold-fusion', name: 'Gold Fusion', short: 'Gold' },
    { key: 'sol-y-tierra', name: 'Sol y Tierra', short: 'Sol y Tierra' },
  ];
  // Un objetivo por pagina, en el orden del modelo. El objetivo sale del nombre de la campaña (js/data-source.js).
  const SECTIONS = [
    { key: 'reconocimiento', title: 'Reconocimiento', sub: 'Objetivo de reproducciones de video', noun: 'Reproducciones', abbr: 'Reprod.', color: '#2563eb' },
    { key: 'interaccion', title: 'Interacción', sub: 'Objetivo de interacciones', noun: 'Interacciones', abbr: 'Interac.', color: '#14a08c' },
    { key: 'trafico-perfil', title: 'Tráfico', sub: 'Objetivo de visitas al perfil', noun: 'Visitas', abbr: 'Visitas', color: '#2563eb' },
  ];
  const BREAKDOWN = [
    { field: 'plays3s', label: 'Reproducciones (3s)' },
    { field: 'clicks', label: 'Clics' },
    { field: 'saves', label: 'Guardados' },
    { field: 'shares', label: 'Compartidos' },
    { field: 'comments', label: 'Comentarios' },
  ];
  const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  const ICONS = {
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-5"/><path d="M13 17V8"/><path d="M18 17v-3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    flag: '<path d="M4 22V4"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.chart}</svg>`;

  let selectedMonth = '';
  let wired = false;

  const api = () => window.ExcambiareData || null;
  const esc = value => api().esc(value);
  const finite = value => value != null && value !== '' && Number.isFinite(Number(value));

  // ── Formatos del modelo ("S/ 192", "S/ 0.0096", "19,998", "+89", "S/0.006") ──
  const integer = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
  const num = value => (finite(value) ? integer.format(Math.round(value)) : '—');
  const signed = value => (finite(value) ? `${value > 0 ? '+' : value < 0 ? '-' : ''}${integer.format(Math.abs(Math.round(value)))}` : '—');
  const money = value => (finite(value) ? `S/ ${integer.format(Math.round(value))}` : '—');
  const money2 = value => (finite(value) ? `S/ ${Number(value).toFixed(2)}` : '—');
  const cost = value => (finite(value) && value > 0 ? `S/ ${Number(value).toFixed(value < 1 ? 4 : 2)}` : '—');
  const costShort = value => (finite(value) && value > 0 ? `S/${Number(value).toFixed(value < 1 ? 3 : 2)}` : '—');
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
    const MONTHS = api().MONTHS;
    return sorted.map((key, index) => {
      const [year, monthNumber] = key.split('-').map(Number);
      const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      const months = BRANDS.map(brand => monthOf(brand.key, key)).filter(Boolean);
      const lastDay = Math.max(...months.map(month => month.lastDay || 0));
      // Un mes anterior al ultimo con datos ya termino aunque su descarga no llegue al ultimo dia.
      const closed = index > 0 || lastDay === days;
      const to = closed ? days : lastDay;
      const name = MONTHS[monthNumber - 1];
      const short = api().SHORT_MONTHS[monthNumber - 1].toLowerCase();
      const range = closed ? `${name} ${year}` : `1 – ${to} ${name} ${year}`;
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
          range,
          window: closed ? `${name.toLowerCase()} completo` : `1 – ${to} ${short}.`,
          days: closed ? 'mes completo' : `1-${to}`,
          source: `Fuente: Meta Ads · ${closed ? `${name.toLowerCase()} ${year}` : `1 – ${to} ${short} ${year}`}`,
          footer: `${CLIENT} · Reporte Meta Ads · ${closed ? `${name} ${year}` : `1-${to} ${name} ${year}`}`,
          note: closed ? `**Datos de ${name.toLowerCase()} ${year}.** Seguidores netos = nuevos − quienes dejaron de seguir.` : `**Datos del período 1 – ${to} de ${name.toLowerCase()}.** Seguidores netos = nuevos − quienes dejaron de seguir.`,
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
    const sum = { spend: sumOf(rows, 'spend'), impressions: sumOf(rows, 'impressions'), reach: sumOf(rows, 'reach'), results: sumOf(rows, 'results'), follows: sumOf(rows, 'follows') };
    BREAKDOWN.forEach(item => { sum[item.field] = sumOf(rows, item.field); });
    sum.costPerResult = sum.results > 0 ? sum.spend / sum.results : null;
    sum.cpm = sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : null;
    sum.frequency = sum.reach > 0 ? sum.impressions / sum.reach : null;
    return sum;
  }

  // Anuncios de unas filas por nombre, con su vista previa (la del mismo anuncio en otro mes si Meta la dejo vacia).
  function adsOf(rows, previews, field) {
    const byName = new Map();
    rows.forEach(row => {
      const key = String(row.ad || '').trim().toLowerCase();
      if (!key) return;
      if (!byName.has(key)) byName.set(key, { name: String(row.ad).trim(), spend: 0, value: 0, preview: '' });
      const ad = byName.get(key);
      ad.spend += Number(row.spend) || 0;
      ad.value += Number(row[field]) || 0;
      if (!ad.preview && /^https:\/\//.test(row.preview || '')) ad.preview = row.preview;
    });
    return [...byName.entries()]
      .map(([key, ad]) => Object.assign(ad, { preview: ad.preview || previews?.get(key) || '' }))
      .filter(ad => ad.spend > 0 || ad.value > 0)
      .sort((left, right) => right.value - left.value || right.spend - left.spend);
  }

  // Semanas de lunes a domingo dentro del mes: la 1 va del dia 1 al primer domingo.
  function weeksOf(period) {
    const weekday = day => new Date(Date.UTC(period.year, period.monthNumber - 1, day)).getUTCDay();
    const weeks = [];
    let start = 1;
    for (let day = 1; day <= period.to; day += 1) {
      if (weekday(day) === 0 || day === period.to) {
        weeks.push({ from: start, to: day, label: `Sem ${weeks.length + 1} (${WEEKDAYS[weekday(start)]} ${start} – ${WEEKDAYS[weekday(day)]} ${day})` });
        start = day + 1;
      }
    }
    return weeks;
  }

  // ── Armado del reporte ─────────────────────────────────────────────────
  function buildReport(period, notes) {
    const evolution = Array.from({ length: EVOLUTION_MONTHS }, (_, index) => shiftMonth(period.key, index - EVOLUTION_MONTHS + 1));
    const weeks = weeksOf(period);
    const brands = BRANDS.map(brand => {
      const data = brandData(brand.key);
      const { month, rows } = windowRows(brand.key, period.key, period);
      const found = month?.found || [];
      const traffic = rows.filter(row => row.group === 'trafico-perfil');
      const paid = sumOf(rows, 'follows');
      const entered = key => (finite(notes[`seg:${brand.key}:${key}`]) ? Number(notes[`seg:${brand.key}:${key}`]) : null);
      const nuevos = entered('nuevos');
      const dejaron = entered('dejaron');
      const netos = nuevos !== null && dejaron !== null ? nuevos - dejaron : null;
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
        return {
          ...section,
          sum: totals(sectionRows),
          history,
          ads: adsOf(sectionRows, data?.previews, 'results').slice(0, MAX_ADS),
          breakdown: section.key === 'interaccion' && BREAKDOWN.some(item => item.field !== 'clicks' && found.includes(item.field)),
        };
      }).filter(Boolean);
      return {
        ...brand,
        month,
        found,
        hasFollows: found.includes('follows'),
        rows,
        paid,
        nuevos,
        dejaron,
        netos,
        organico: netos !== null ? netos - paid : null,
        followAds: adsOf(rows, data?.previews, 'follows').filter(ad => ad.value > 0).slice(0, MAX_ADS),
        // Seguidores y costo por seguidor de la campaña de Trafico al perfil, mes a mes y semana a semana.
        evolution: evolution.map(key => {
          const { month: past, rows: pastRows } = windowRows(brand.key, key, period);
          const t = pastRows.filter(row => row.group === 'trafico-perfil');
          const follows = sumOf(t, 'follows');
          const has = Boolean(past && past.found.includes('follows'));
          return { key, label: api().SHORT_MONTHS[Number(key.slice(5)) - 1], follows: has ? follows : null, cost: has && follows > 0 ? sumOf(t, 'spend') / follows : null };
        }),
        weekly: weeks.map(week => {
          const t = traffic.filter(row => row.d >= week.from && row.d <= week.to);
          const follows = sumOf(t, 'follows');
          return { follows: found.includes('follows') ? follows : null, cost: follows > 0 ? sumOf(t, 'spend') / follows : null };
        }),
        trafficCost: sumOf(traffic, 'follows') > 0 ? sumOf(traffic, 'spend') / sumOf(traffic, 'follows') : null,
        sections,
      };
    }).filter(brand => brand.rows.some(activity));

    const sumBrands = field => (brands.every(brand => brand[field] !== null) ? brands.reduce((total, brand) => total + brand[field], 0) : null);
    return {
      period,
      labels: period.labels,
      evolution,
      weeks,
      brands,
      followers: {
        nuevos: sumBrands('nuevos'),
        dejaron: sumBrands('dejaron'),
        netos: sumBrands('netos'),
        paid: brands.reduce((total, brand) => total + brand.paid, 0),
        organico: sumBrands('organico'),
        entered: brands.length > 0 && brands.every(brand => brand.netos !== null),
        anyFollows: brands.some(brand => brand.hasFollows),
      },
    };
  }

  // ── Textos propuestos (el equipo los reescribe sobre la lamina) ─────────
  function suggestFollowersKey(report) {
    const { followers, brands } = report;
    if (!followers.anyFollows && !followers.entered) {
      return 'Escribe los seguidores nuevos y los que dejaron de seguir de cada marca (Meta Business Suite) para ver el crecimiento neto. La descarga de Meta Ads todavía no trae la columna de seguidores por anuncio.';
    }
    if (!followers.entered) {
      return `La pauta trajo ${num(followers.paid)} seguidores en el período (${list(brands.map(brand => `${brand.name} ${num(brand.paid)}`))}). Escribe los nuevos y los que dejaron de seguir de cada marca para ver el crecimiento neto real.`;
    }
    const leader = [...brands].sort((left, right) => right.netos - left.netos)[0];
    const parts = [`El crecimiento real es ${signed(followers.netos)} seguidores netos; de ellos ${num(followers.paid)} vinieron de la pauta y ${num(followers.organico)} del orgánico.`];
    if (leader) parts.push(`${leader.name} lidera (${signed(leader.netos)}, ${num(leader.paid)} por pauta).`);
    const leaky = brands.filter(brand => brand.nuevos > 0 && brand.dejaron / brand.nuevos >= 0.5).sort((left, right) => right.dejaron - left.dejaron)[0];
    if (leaky) parts.push(`${leaky.name} pierde muchos seguidores (-${num(leaky.dejaron)}) pese a captar ${num(leaky.nuevos)} — hay que cuidar la retención.`);
    return parts.join(' ');
  }

  function suggestArtsKey(report) {
    const parts = report.brands.filter(brand => brand.followAds.length).map(brand => {
      const top = brand.followAds.slice(0, 2);
      return `en ${brand.name} ${list(top.map(ad => `"${ad.name}" (${num(ad.value)})`))}`;
    });
    if (!parts.length) return 'Ningún anuncio trajo seguidores en el período, o la descarga todavía no trae la columna de seguidores por anuncio.';
    const text = `Las piezas que más seguidores trajeron: ${list(parts)}.`;
    return `${text} Replicar su formato en las próximas piezas de tráfico al perfil.`;
  }

  function suggestEvolutionKey(report) {
    const prevIndex = EVOLUTION_MONTHS - 2;
    const parts = report.brands.map(brand => {
      const before = brand.evolution[prevIndex];
      const now = brand.evolution[EVOLUTION_MONTHS - 1];
      if (!finite(before.cost) || !finite(now.cost)) return '';
      return `${brand.short} de ${costShort(before.cost)} en ${before.label.toLowerCase()} a ${costShort(now.cost)}`;
    }).filter(Boolean);
    const sentences = [];
    if (parts.length) {
      const falling = report.brands.filter(brand => finite(brand.evolution[prevIndex].cost) && finite(brand.evolution[EVOLUTION_MONTHS - 1].cost) && brand.evolution[EVOLUTION_MONTHS - 1].cost < brand.evolution[prevIndex].cost).length;
      sentences.push(`En ${report.period.name.toLowerCase()} el costo por seguidor ${falling >= parts.length / 2 ? 'bajó' : 'subió'} (${list(parts)}).`);
    }
    const best = [...report.brands].sort((left, right) => sumOf(right.weekly, 'follows') - sumOf(left.weekly, 'follows'))[0];
    if (best && best.weekly.length > 1 && best.weekly.every(week => week.follows !== null)) {
      const series = best.weekly.map(week => num(week.follows));
      const first = best.weekly[0].follows;
      const last = best.weekly[best.weekly.length - 1].follows;
      sentences.push(`${best.short} ${last > first ? 'acelera' : last < first ? 'desacelera' : 'se mantiene'} semana a semana (${series.join(' → ')} seguidores).`);
    }
    return sentences.join(' ') || 'Sin seguidores de pauta registrados en la descarga para comparar los meses.';
  }

  function suggestSection(brand, section, period) {
    const prev = section.history[EVOLUTION_MONTHS - 2];
    const parts = [];
    if (prev && prev.has && prev.results > 0) {
      const ratio = section.sum.results / prev.results;
      const verb = ratio >= 1.15 ? 'creció' : ratio <= 0.85 ? 'bajó' : 'se mantiene estable';
      parts.push(`${section.title} ${verb} en ${period.short} (${compact(section.sum.results)} vs ${compact(prev.results)} en ${prev.label.toLowerCase()}).`);
    } else {
      parts.push(`${section.title}: ${compact(section.sum.results)} ${section.noun.toLowerCase()} en el período.`);
    }
    if (section.breakdown) {
      const plays = section.sum.plays3s;
      const active = section.sum.saves + section.sum.shares + section.sum.comments;
      if (section.sum.results > 0 && plays > 0) parts.push(`El ${Math.round((plays / section.sum.results) * 100)}% son reproducciones de video; el engagement activo (guardados, compartidos y comentarios) suma ${num(active)}.`);
    } else if (section.key === 'interaccion') {
      parts.push(`La descarga de ${brand.name} no trae el desglose por tipo de interacción; solo el total.`);
    }
    if (section.ads[0]) parts.push(`"${section.ads[0].name}" es el arte top.`);
    return parts.join(' ');
  }

  function suggestConclusions(report) {
    const { followers, brands } = report;
    const cards = [];
    if (followers.entered) {
      cards.push({
        icon: 'user',
        title: `${signed(followers.netos)} seguidores netos reales`,
        text: `El crecimiento real es ${signed(followers.netos)}, no +${num(followers.nuevos)}: ${num(followers.dejaron)} personas dejaron de seguir. Es importante medir el neto para saber cuántos seguidores de verdad ganamos.`,
      });
    } else {
      cards.push({
        icon: 'user',
        title: `${num(followers.paid)} seguidores de pauta`,
        text: `La pauta trajo ${num(followers.paid)} seguidores en el período. Falta registrar los nuevos y los que dejaron de seguir de cada marca para medir el crecimiento neto real.`,
      });
    }
    const efficient = brands.filter(brand => finite(brand.trafficCost)).sort((left, right) => left.trafficCost - right.trafficCost)[0];
    if (efficient) {
      cards.push({
        icon: 'star',
        title: `${efficient.name}, la más eficiente`,
        text: `${efficient.name} ${efficient.netos !== null ? `crece ${signed(efficient.netos)} netos` : `suma ${num(efficient.paid)} seguidores de pauta`} al menor costo por seguidor (${money2(efficient.trafficCost)}). Conviene replicar su contenido y ritmo en las demás marcas.`,
      });
    }
    // La marca a reforzar es la que menos crecio entre las demas: la mas eficiente ya tiene su tarjeta.
    const weakest = brands.filter(brand => brand !== efficient).sort((left, right) => (left.netos ?? left.paid) - (right.netos ?? right.paid))[0];
    if (weakest) {
      cards.push({
        icon: 'trend',
        title: `Reforzar ${weakest.name}`,
        text: `${weakest.name} es la que menos creció (${weakest.netos !== null ? `${signed(weakest.netos)} netos` : `${num(weakest.paid)} seguidores de pauta`}). Necesita reforzar el tráfico al perfil y contenido que invite a seguir la marca.`,
      });
    }
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
    const kept = Object.fromEntries(Object.entries(notes[monthKey] || {}).filter(([key]) => /^seg:[^:]+:(nuevos|dejaron)$/.test(key)));
    notes[monthKey] = kept;
    writeNotes(notes);
  }

  // **texto** va en negrita, como "Que paso:" en los demas modelos.
  const rich = text => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const editable = (key, text, tag = 'p') => `<${tag} class="rp-edit" data-note="${esc(key)}" data-raw="${esc(text)}" title="Clic para editar · **texto** va en negrita">${rich(text)}</${tag}>`;
  const noteOr = (notes, key, suggested) => (notes[key] != null ? notes[key] : suggested);
  // Cifra que escribe el equipo (Business Suite): vacia, la lamina muestra una casilla para completarla.
  const numberCell = (key, value, shown) => `<span class="rp-edit rp-num${value === null ? ' is-empty' : ''}" data-num="${esc(key)}" data-raw="${value === null ? '' : value}" title="Clic para escribir la cifra de Meta Business Suite">${value === null ? '—' : shown}</span>`;

  // ── Piezas de las laminas ──────────────────────────────────────────────
  const kpi = (label, value, foot, tone = '') => `
    <div class="rp-card rp-kpi">
      <span class="rp-kpi-label">${esc(label)}</span>
      <strong class="${tone}">${value}</strong>
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

  function adsTable(ads, columnLabel) {
    if (!ads.length) return '<p class="rp-empty">Sin anuncios con entrega en el período.</p>';
    return `
      <table class="rp-table rp-ads">
        <colgroup><col><col style="width:16%"><col style="width:20%"><col style="width:13%"></colgroup>
        <thead><tr><th>Anuncio</th><th class="num">Gasto</th><th class="num">${esc(columnLabel)}</th><th class="num">Ver</th></tr></thead>
        <tbody>${ads.map((ad, index) => {
          const url = api().safeUrl(ad.preview);
          return `<tr${index === 0 ? ' class="rp-top"' : ''}><td class="rp-name" title="${esc(ad.name)}">${esc(ad.name)}</td><td class="num">${money(ad.spend)}</td><td class="num">${num(ad.value)}</td><td class="num">${url ? `<a href="${url}" target="_blank" rel="noopener">Ver »</a>` : '—'}</td></tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  function breakdownTable(section) {
    const total = section.sum.results;
    const active = section.sum.saves + section.sum.shares + section.sum.comments;
    return `
      <table class="rp-table rp-ads rp-breakdown">
        <colgroup><col><col style="width:26%"><col style="width:22%"></colgroup>
        <thead><tr><th>Tipo</th><th class="num">Cantidad</th><th class="num">% total</th></tr></thead>
        <tbody>${BREAKDOWN.map((item, index) => `<tr${index === 0 ? ' class="rp-top"' : ''}><td class="rp-name">${esc(item.label)}</td><td class="num"><b>${num(section.sum[item.field])}</b></td><td class="num">${share(section.sum[item.field], total)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="rp-table-foot">De ${num(total)}: engagement activo (guardados, compartidos, comentarios) = ${num(active)}.</div>`;
  }

  // ── Laminas ────────────────────────────────────────────────────────────
  function issuedLabel() {
    const { year, month, day } = api().limaParts(new Date());
    return `${day} ${api().SHORT_MONTHS[month].toLowerCase()}. ${year}`;
  }

  function coverPage(report) {
    return `
      <section class="rp-page rp-cover">
        <div class="rp-brand"><img src="${LOGO}" alt="Lima Retail"><div><b>Lima Retail</b><span>Data Driven Marketing</span></div></div>
        <div class="rp-cover-body">
          <h1>Reporte de Publicidad</h1>
          <p class="rp-cover-client">Cliente: <b>${CLIENT}</b></p>
          <p class="rp-cover-period">${esc(report.labels.range)} · Seguidores y evolución&nbsp; | &nbsp;Meta Ads</p>
        </div>
        <footer class="rp-foot">
          <span>${AGENCY_LINE}</span>
          <span class="rp-foot-right"><img src="${LOGO}" alt=""><b>Lima Retail</b>Emitido el ${esc(issuedLabel())}</span>
        </footer>
      </section>`;
  }

  function contentsPage(report, pages, total) {
    const range = (from, to) => (from === to ? `Pág. ${pageNumber(from)}` : `Pág. ${pageNumber(from)}-${pageNumber(to)}`);
    const items = [
      { title: 'Seguidores', desc: `Crecimiento neto real de las ${report.brands.length} marcas.`, icon: 'user', page: range(3, 5) },
      ...report.brands.map(brand => ({
        title: brand.name,
        desc: `${list(brand.sections.map(section => section.title.toLowerCase())).replace(/^./, char => char.toUpperCase())}.`,
        icon: 'layers',
        page: range(pages.brand[brand.key], pages.brand[brand.key] + brand.sections.length - 1),
      })),
      { title: 'Conclusiones', desc: 'Hallazgos de seguidores y próximos pasos.', icon: 'flag', page: range(pages.conclusions, pages.conclusions) },
    ];
    return `
      <section class="rp-page">
        ${head('Contenido del reporte', 'Qué encontrarás en cada sección de este informe mensual.')}
        <div class="rp-body rp-contents">
          ${items.map((item, index) => `
            <div class="rp-card rp-toc">
              <div class="rp-toc-top"><span class="rp-icon">${icon(item.icon)}</span><span class="rp-toc-num">${pageNumber(index + 1)}</span></div>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.desc)}</p>
              <span class="rp-toc-page">${item.page}</span>
            </div>`).join('')}
        </div>
        ${footer(report.labels.source, report, 2, total)}
      </section>`;
  }

  function followersPage(report, notes, total) {
    const { followers, brands, labels } = report;
    const tone = value => (value === null ? '' : value >= 0 ? 'rp-good' : 'rp-bad');
    const rows = brands.map((brand, index) => `
      <tr${index === 0 ? ' class="rp-top"' : ''}>
        <td class="rp-name">${esc(brand.name)}</td>
        <td class="num">${numberCell(`seg:${brand.key}:nuevos`, brand.nuevos, num(brand.nuevos))}</td>
        <td class="num rp-bad">${numberCell(`seg:${brand.key}:dejaron`, brand.dejaron, brand.dejaron ? `-${num(brand.dejaron)}` : '0')}</td>
        <td class="num"><b>${signed(brand.netos)}</b></td>
        <td class="num rp-blue">${brand.hasFollows ? num(brand.paid) : '—'}</td>
        <td class="num rp-orange">${brand.organico === null ? '—' : signed(brand.organico).replace(/^\+/, '')}</td>
      </tr>`).join('');
    const missing = brands.filter(brand => !brand.hasFollows).map(brand => brand.name);
    const foot = [
      followers.entered ? `Total: ${signed(followers.netos)} netos (${num(followers.nuevos)} nuevos − ${num(followers.dejaron)} que dejaron) · ${num(followers.paid)} por pauta · ${num(followers.organico)} orgánicos.` : `Total por pauta: ${num(followers.paid)} seguidores.`,
      missing.length ? `La descarga de ${list(missing)} no trae la columna de seguidores por anuncio (Seguimientos de Instagram).` : '',
    ].filter(Boolean).join(' ');
    return `
      <section class="rp-page">
        ${head('Crecimiento de seguidores', `Seguidores netos, de pauta y orgánicos de las ${brands.length} marcas · ${labels.window}`)}
        <div class="rp-body">
          <div class="rp-grid-5">
            ${kpi('Nuevos', num(followers.nuevos), 'Nos siguieron')}
            ${kpi('Dejaron', followers.dejaron === null ? '—' : `-${num(followers.dejaron)}`, 'Nos dejaron de seguir')}
            ${kpi('Netos', signed(followers.netos), 'Crecimiento real', tone(followers.netos))}
            ${kpi('De pauta (ads)', followers.anyFollows ? num(followers.paid) : '—', 'Traídos por anuncios', 'rp-blue')}
            ${kpi('Orgánico', followers.organico === null ? '—' : num(followers.organico), 'Restante (sin pauta)', 'rp-orange')}
          </div>
          <div class="rp-card rp-table-card">
            <div class="rp-card-title">Seguidores por marca</div>
            <table class="rp-table">
              <thead><tr><th>Marca</th><th class="num">Nuevos</th><th class="num">Dejaron</th><th class="num">Netos</th><th class="num">De pauta</th><th class="num">Orgánico</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="rp-table-foot">${esc(foot)}</div>
          </div>
          ${followers.entered ? '' : '<p class="rp-hint">Escribe en la tabla los seguidores nuevos y los que dejaron de seguir de cada marca (Meta Business Suite): netos y orgánico se calculan solos. Esta indicación no sale en el PDF.</p>'}
          ${insight('Clave', 'user', 'seg:clave', noteOr(notes, 'seg:clave', suggestFollowersKey(report)))}
        </div>
        ${footer(`Fuente: Meta Business Suite + Ads · ${labels.window.replace(/\.$/, '')}`, report, 3, total)}
      </section>`;
  }

  function artsPage(report, notes, total) {
    const rows = report.brands.flatMap(brand => brand.followAds.map((ad, index) => {
      const url = api().safeUrl(ad.preview);
      return `<tr${index === 0 ? ' class="rp-top"' : ''}><td>${index === 0 ? esc(brand.short) : ''}</td><td class="rp-name"><b>${esc(ad.name)}</b></td><td class="num">${index === 0 ? `<b>${num(ad.value)}</b>` : num(ad.value)}</td><td class="num">${url ? `<a href="${url}" target="_blank" rel="noopener">Ver »</a>` : '—'}</td></tr>`;
    })).join('');
    const body = rows || `<tr><td colspan="4" class="rp-empty">${report.followers.anyFollows ? 'Ningún anuncio trajo seguidores en el período.' : 'La descarga de Meta todavía no trae la columna de seguidores por anuncio (Seguimientos de Instagram).'}</td></tr>`;
    return `
      <section class="rp-page">
        ${head('Artes que trajeron seguidores', 'Las piezas que más seguidores generaron en cada marca.')}
        <div class="rp-body">
          <div class="rp-card rp-table-card">
            <table class="rp-table rp-arts">
              <colgroup><col style="width:17%"><col><col style="width:14%"><col style="width:10%"></colgroup>
              <thead><tr><th>Marca</th><th>Anuncio / pieza</th><th class="num">Seguidores</th><th class="num">Ver</th></tr></thead>
              <tbody>${body}</tbody>
            </table>
            <div class="rp-table-foot">Seguidores atribuidos a cada anuncio (columna Seguimientos de Instagram de la descarga de Meta).</div>
          </div>
          ${insight('Qué funcionó', 'trend', 'seg:artes', noteOr(notes, 'seg:artes', suggestArtsKey(report)))}
        </div>
        ${footer(report.labels.source, report, 4, total)}
      </section>`;
  }

  function evolutionPage(report, notes, total) {
    const { brands, evolution, weeks, labels } = report;
    const monthHead = evolution.map(key => `<th class="num">${esc(api().SHORT_MONTHS[Number(key.slice(5)) - 1])}</th>`).join('');
    const followRows = brands.map(brand => `<tr><td class="rp-name">${esc(brand.short)}</td>${brand.evolution.map((point, index) => `<td class="num">${index === evolution.length - 1 ? `<b>${num(point.follows)}</b>` : num(point.follows)}</td>`).join('')}</tr>`).join('');
    const costRows = brands.map(brand => `<tr><td class="rp-name">${esc(brand.short)}</td>${brand.evolution.map((point, index) => `<td class="num">${index === evolution.length - 1 ? `<b>${money2(point.cost)}</b>` : money2(point.cost)}</td>`).join('')}</tr>`).join('');
    const weekRows = brands.map(brand => `<tr><td class="rp-name">${esc(brand.short)}</td>${brand.weekly.map(week => `<td class="num">${week.follows === null ? '—' : `${num(week.follows)} (${week.cost ? money2(week.cost) : '—'})`}</td>`).join('')}</tr>`).join('');
    const firstWeek = weeks[0];
    const weekNote = firstWeek && firstWeek.to - firstWeek.from < 6 && !/lun/.test(firstWeek.label)
      ? `${report.period.name} inicia ${firstWeek.label.match(/\((\S+)/)[1]}: la semana 1 va hasta el domingo ${firstWeek.to}; las siguientes de lunes a domingo.`
      : 'Semanas de lunes a domingo dentro del mes.';
    return `
      <section class="rp-page">
        ${head('Seguidores de pauta · evolución', 'Atribuidos a la campaña de Tráfico al perfil · costo por seguidor con esa inversión.')}
        <div class="rp-body">
          <div class="rp-split rp-split-even">
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">Seguidores por período (${esc(labels.days)})</div>
              <table class="rp-table"><thead><tr><th>Marca</th>${monthHead}</tr></thead><tbody>${followRows}</tbody></table>
              <div class="rp-table-foot">Mismo período (${esc(labels.days)}) de cada mes.</div>
            </div>
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">Costo por seguidor (${esc(labels.days)})</div>
              <table class="rp-table"><thead><tr><th>Marca</th>${monthHead}</tr></thead><tbody>${costRows}</tbody></table>
              <div class="rp-table-foot">Inversión de Tráfico al perfil ÷ seguidores.</div>
            </div>
          </div>
          <div class="rp-card rp-table-card">
            <div class="rp-card-title">Variación semanal de ${esc(report.period.name.toLowerCase())} (seguidores · costo/seg)</div>
            <table class="rp-table"><thead><tr><th>Marca</th>${weeks.map(week => `<th class="num">${esc(week.label)}</th>`).join('')}</tr></thead><tbody>${weekRows}</tbody></table>
            <div class="rp-table-foot">${esc(weekNote)}</div>
          </div>
          ${insight('Clave', 'user', 'seg:evolucion', noteOr(notes, 'seg:evolucion', suggestEvolutionKey(report)))}
        </div>
        ${footer(`Fuente: Meta Ads · campaña Tráfico al perfil · ${labels.window.replace(/\.$/, '')}`, report, 5, total)}
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
              <div class="rp-card-title">Evolución ${report.period.closed ? '' : `${esc(report.labels.days)} `}por mes</div>
              <div class="rp-card-sub">Resultados y costo · ${esc(section.history.map(point => point.label.toLowerCase()).join('-'))}.</div>
              ${evolutionChart(section)}
            </div>
            <div class="rp-card rp-table-card">
              <div class="rp-card-title">${section.breakdown ? 'Desglose de interacciones' : 'Anuncios que funcionan'}</div>
              ${section.breakdown ? breakdownTable(section) : adsTable(section.ads, section.abbr)}
            </div>
          </div>
          ${insight('Qué funciona', 'pulse', key, noteOr(notes, key, suggestSection(brand, section, report.period)))}
        </div>
        ${footer(report.labels.source, report, page, total)}
      </section>`;
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
        ${head('Conclusiones y próximos pasos', 'Lo prioritario para seguir creciendo en comunidad.')}
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
      host.innerHTML = '<div class="panel"><div class="empty-state"><strong>Todavia no hay datos para el reporte</strong><span>El reporte se arma con las descargas de Meta Ads de las tres marcas. En cuanto haya un mes con entregas, aparece aqui.</span></div></div>';
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
    let next = 6;
    const pages = { brand: {} };
    report.brands.forEach(brand => {
      pages.brand[brand.key] = next;
      next += brand.sections.length;
    });
    pages.conclusions = next;
    const total = next + 1;
    host.innerHTML = `
      <div class="rp-deck" id="week-doc">
        ${coverPage(report)}
        ${contentsPage(report, pages, total)}
        ${followersPage(report, notes, total)}
        ${artsPage(report, notes, total)}
        ${evolutionPage(report, notes, total)}
        ${report.brands.map(brand => brand.sections.map((section, index) => sectionPage(brand, section, report, notes, pages.brand[brand.key] + index, total)).join('')).join('')}
        ${conclusionsPage(report, notes, pages.conclusions, total)}
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
