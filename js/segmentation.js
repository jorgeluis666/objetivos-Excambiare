(function () {
  const DATA_URL = 'data/excambiare-segmentation.json';
  // Escala fija de la barra de edad: cubre los rangos que Meta Ads permite segmentar.
  const AGE_SCALE = { min: 18, max: 65 };
  const COMPARE_ID = 'compare';

  const state = {
    ready: false,
    loading: false,
    source: null,
    platform: '',
    brands: [],
    active: '',
    search: '',
  };

  const els = {};

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  function allInterests(brand) {
    return brand.interests.flatMap(group => group.items);
  }

  function formatDate(value) {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function agePosition(age) {
    return ((age - AGE_SCALE.min) / (AGE_SCALE.max - AGE_SCALE.min)) * 100;
  }

  function ageBar(brand, compact = false) {
    const left = agePosition(brand.ageMin);
    const width = agePosition(brand.ageMax) - left;
    return `
      <div class="seg-age${compact ? ' compact' : ''}">
        <div class="seg-age-track">
          <div class="seg-age-range tone-${brand.tone}" style="left:${left}%;width:${width}%"></div>
        </div>
        ${compact ? `<div class="seg-age-label">${brand.ageMin}–${brand.ageMax} años</div>` : ''}
        ${compact ? '' : `<div class="seg-age-scale"><span>${AGE_SCALE.min}</span><span>30</span><span>45</span><span>${AGE_SCALE.max}+</span></div>`}
      </div>`;
  }

  function uniqueLocations() {
    return [...new Set(state.brands.flatMap(brand => brand.locations))];
  }

  function renderKpis() {
    if (!els.kpis) return;
    const minAge = Math.min(...state.brands.map(brand => brand.ageMin));
    const maxAge = Math.max(...state.brands.map(brand => brand.ageMax));
    const interests = new Set(state.brands.flatMap(brand => allInterests(brand).map(normalize)));
    const regions = new Set(state.brands.flatMap(brand => brand.exclusions.regions));
    const regionBrands = state.brands.filter(brand => brand.exclusions.regions.length).map(brand => brand.name);
    const kpis = [
      { label: 'Marcas segmentadas', value: state.brands.length, note: state.brands.map(brand => brand.name).join(' · ') },
      { label: 'Distritos incluidos', value: uniqueLocations().length, note: 'Lima Metropolitana y Callao' },
      { label: 'Rango de edad', value: `${minAge}–${maxAge}`, note: 'Cobertura combinada' },
      { label: 'Intereses únicos', value: interests.size, note: 'Sin repetir entre marcas' },
      { label: 'Regiones excluidas', value: regions.size, note: regionBrands.length ? `En ${regionBrands.join(', ')}` : 'Ninguna' },
    ];
    els.kpis.innerHTML = kpis
      .map(kpi => `<div class="kpi-pill"><span>${escapeHtml(kpi.label)}</span><strong>${escapeHtml(kpi.value)}</strong><small>${escapeHtml(kpi.note)}</small></div>`)
      .join('');
  }

  function renderTabs() {
    if (!els.tabs) return;
    const tabs = state.brands.map(brand => ({ id: brand.id, label: brand.name, tone: brand.tone }));
    tabs.push({ id: COMPARE_ID, label: 'Comparar marcas', tone: 'slate' });
    els.tabs.innerHTML = tabs
      .map(tab => `
        <button type="button" class="seg-tab${tab.id === state.active ? ' active' : ''}" data-seg-tab="${tab.id}" role="tab" aria-selected="${tab.id === state.active}">
          <span class="seg-dot tone-${tab.tone}"></span>${escapeHtml(tab.label)}
        </button>`)
      .join('');
  }

  function chip(label, extraClass = '') {
    return `<span class="seg-chip${extraClass ? ` ${extraClass}` : ''}">${escapeHtml(label)}</span>`;
  }

  function interestChips(brand) {
    const query = normalize(state.search);
    let matches = 0;
    const groups = brand.interests.map(group => {
      const chips = group.items.map(item => {
        const hit = query && normalize(item).includes(query);
        if (hit) matches += 1;
        return chip(item, query ? (hit ? 'hit' : 'dim') : '');
      });
      return `
        <div class="seg-group">
          <div class="seg-group-title">${escapeHtml(group.group)} <b>${group.items.length}</b></div>
          <div class="seg-chips">${chips.join('')}</div>
        </div>`;
    });
    const status = query
      ? `<div class="seg-search-status">${matches ? `${matches} coincidencia${matches === 1 ? '' : 's'} para “${escapeHtml(state.search)}”` : `Sin coincidencias para “${escapeHtml(state.search)}”`}</div>`
      : '';
    return `${status}<div class="seg-groups">${groups.join('')}</div>`;
  }

  function renderBrand(brand) {
    const interestsCount = allInterests(brand).length;
    const exclusions = [
      ...brand.exclusions.districts.map(name => chip(name, 'excluded')),
      ...brand.exclusions.regions.map(name => chip(name, 'excluded region')),
    ];
    return `
      <div class="panel seg-brand-panel tone-border-${brand.tone}">
        <div class="panel-head seg-brand-head">
          <div>
            <div class="seg-kicker">${escapeHtml(state.platform)} · Segmentación de público</div>
            <div class="seg-brand-name">${escapeHtml(brand.name)}</div>
            <div class="seg-type">${brand.segmentationType.map(type => `<span class="type-pill slate">${escapeHtml(type)}</span>`).join('<span class="seg-plus">+</span>')}</div>
          </div>
          <div class="seg-head-actions">
            <button type="button" class="messages-btn secondary" data-seg-copy="${brand.id}">Copiar segmentación</button>
          </div>
        </div>

        <div class="seg-grid">
          <div class="seg-card">
            <div class="seg-card-title">Edad</div>
            <div class="seg-big">${brand.ageMin} a ${brand.ageMax} años</div>
            ${ageBar(brand)}
          </div>
          <div class="seg-card">
            <div class="seg-card-title">Comportamientos</div>
            <ul class="seg-list">${brand.behaviors.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div class="seg-card">
            <div class="seg-card-title">Público</div>
            <div class="seg-big">${escapeHtml(brand.audience)}</div>
            <p class="seg-hint">Meta amplía la entrega más allá de los intereses cuando detecta mejor rendimiento.</p>
          </div>
        </div>

        <div class="seg-section">
          <div class="seg-section-head">
            <div class="seg-card-title">Intereses <b>${interestsCount}</b></div>
            <label class="reports-field search seg-search" for="seg-search">
              <span class="sr-only">Buscar interés</span>
              <input id="seg-search" type="search" placeholder="Buscar interés (ej. vino, DJ, lujo)" value="${escapeHtml(state.search)}">
            </label>
          </div>
          <div id="seg-interests">${interestChips(brand)}</div>
        </div>

        <div class="seg-section seg-geo">
          <div>
            <div class="seg-card-title">Ubicaciones incluidas <b>${brand.locations.length}</b></div>
            <div class="seg-chips">${brand.locations.map(name => chip(name, 'location')).join('')}</div>
          </div>
          <div>
            <div class="seg-card-title">Exclusiones geográficas <b>${exclusions.length}</b></div>
            <div class="seg-chips">${exclusions.join('')}</div>
          </div>
        </div>
      </div>`;
  }

  function renderCompare() {
    const brands = state.brands;
    const head = brands.map(brand => `<th class="center"><span class="seg-dot tone-${brand.tone}"></span>${escapeHtml(brand.name)}</th>`).join('');
    const check = included => (included ? '<span class="seg-check yes">✓</span>' : '<span class="seg-check no">—</span>');

    const districtRows = uniqueLocations()
      .map(name => {
        const flags = brands.map(brand => brand.locations.includes(name));
        return { name, flags, partial: !flags.every(Boolean) };
      })
      .sort((a, b) => Number(b.partial) - Number(a.partial))
      .map(({ name, flags, partial }) => `<tr class="${partial ? 'seg-diff' : ''}"><td>${escapeHtml(name)}${partial ? ' <span class="seg-diff-tag">Diferencia</span>' : ''}</td>${flags.map(flag => `<td class="center">${check(flag)}</td>`).join('')}</tr>`)
      .join('');

    const interestSets = brands.map(brand => new Set(allInterests(brand).map(normalize)));
    const labels = new Map();
    brands.forEach(brand => allInterests(brand).forEach(item => labels.set(normalize(item), item)));
    const shared = [...labels.keys()].filter(key => interestSets.every(set => set.has(key)));
    const exclusive = brands.map((brand, index) => allInterests(brand).filter(item => interestSets.every((set, other) => other === index || !set.has(normalize(item)))));

    const summaryRows = [
      ['Edad', brands.map(brand => ageBar(brand, true))],
      ['Comportamientos', brands.map(brand => `<ul class="seg-list tight">${brand.behaviors.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)],
      ['Intereses', brands.map(brand => `<strong>${allInterests(brand).length}</strong> en ${brand.interests.length} grupos`)],
      ['Intereses exclusivos', exclusive.map(list => `<div class="seg-chips">${list.map(item => chip(item)).join('')}</div>`)],
      ['Distritos', brands.map(brand => `<strong>${brand.locations.length}</strong>`)],
      ['Exclusiones', brands.map(brand => `${brand.exclusions.districts.length} distritos${brand.exclusions.regions.length ? ` · ${brand.exclusions.regions.length} regiones` : ''}`)],
      ['Público', brands.map(brand => escapeHtml(brand.audience))],
    ];

    return `
      <div class="panel seg-compare-panel">
        <div class="panel-head"><div><div class="panel-title">Resumen comparativo</div><div class="panel-sub">Diferencias clave entre los públicos configurados para cada marca.</div></div></div>
        <div class="table-scroll">
          <table class="data-table seg-compare-table">
            <thead><tr><th>Criterio</th>${head}</tr></thead>
            <tbody>${summaryRows.map(([label, cells]) => `<tr><td class="seg-row-label">${label}</td>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="seg-shared">
          <div class="seg-card-title">Intereses compartidos por las ${brands.length} marcas <b>${shared.length}</b></div>
          <div class="seg-chips">${shared.length ? shared.map(key => chip(labels.get(key), 'shared')).join('') : '<span class="no-data">Ninguno</span>'}</div>
        </div>
      </div>

      <div class="panel seg-compare-panel">
        <div class="panel-head"><div><div class="panel-title">Cobertura por distrito</div><div class="panel-sub">Las filas con diferencias entre marcas aparecen primero.</div></div></div>
        <div class="table-scroll">
          <table class="data-table seg-compare-table">
            <thead><tr><th>Distrito</th>${head}</tr></thead>
            <tbody>${districtRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderBody() {
    if (!els.body) return;
    const brand = state.brands.find(item => item.id === state.active);
    els.body.innerHTML = brand ? renderBrand(brand) : renderCompare();
  }

  function render() {
    renderKpis();
    renderTabs();
    renderBody();
    if (els.sourceLink && state.source?.url) els.sourceLink.href = state.source.url;
    if (els.sub && state.source) {
      els.sub.textContent = `Fuente: ${state.source.title} · actualizado al ${formatDate(state.source.syncedAt)}`;
    }
  }

  function brandAsText(brand) {
    const exclusions = [...brand.exclusions.districts, ...brand.exclusions.regions];
    return [
      `${brand.name.toUpperCase()} – Segmentación de público (${state.platform})`,
      `Ubicaciones: ${brand.locations.join(', ')}.`,
      `Exclusiones geográficas: ${exclusions.join(', ')}.`,
      `Edad: ${brand.ageMin} a ${brand.ageMax} años.`,
      `Tipo de segmentación: ${brand.segmentationType.join(' + ')}.`,
      `Intereses: ${allInterests(brand).join(', ')}.`,
      `Comportamientos: ${brand.behaviors.join(', ')}.`,
      `Público: ${brand.audience}.`,
    ].join('\n');
  }

  async function copyBrand(id, button) {
    const brand = state.brands.find(item => item.id === id);
    if (!brand) return;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(brandAsText(brand));
      button.textContent = 'Copiado ✓';
    } catch {
      button.textContent = 'No se pudo copiar';
    }
    window.setTimeout(() => { button.textContent = original; }, 1800);
  }

  function selectTab(id) {
    state.active = id;
    try {
      window.localStorage.setItem('excambiare-segmentation-tab', id);
    } catch {
      // Sin localStorage la pestaña simplemente no se recuerda.
    }
    renderTabs();
    renderBody();
  }

  function bindEvents() {
    els.tabs?.addEventListener('click', event => {
      const button = event.target.closest('[data-seg-tab]');
      if (button) selectTab(button.dataset.segTab);
    });
    els.body?.addEventListener('click', event => {
      const button = event.target.closest('[data-seg-copy]');
      if (button) copyBrand(button.dataset.segCopy, button);
    });
    els.body?.addEventListener('input', event => {
      if (event.target.id !== 'seg-search') return;
      state.search = event.target.value;
      const brand = state.brands.find(item => item.id === state.active);
      const target = document.getElementById('seg-interests');
      if (brand && target) target.innerHTML = interestChips(brand);
    });
  }

  function storedTab() {
    try {
      const value = window.localStorage.getItem('excambiare-segmentation-tab');
      if (value === COMPARE_ID || state.brands.some(brand => brand.id === value)) return value;
    } catch {
      // Se usa la primera marca.
    }
    return state.brands[0]?.id || COMPARE_ID;
  }

  async function loadData() {
    if (window.EXCAMBIARE_SEGMENTATION) return window.EXCAMBIARE_SEGMENTATION;
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function init() {
    if (state.ready || state.loading) return;
    state.loading = true;

    els.kpis = document.getElementById('segmentation-kpis');
    els.tabs = document.getElementById('segmentation-tabs');
    els.body = document.getElementById('segmentation-body');
    els.sub = document.getElementById('segmentation-sub');
    els.sourceLink = document.getElementById('segmentation-source-link');

    try {
      const data = await loadData();
      state.source = data.source || null;
      state.platform = data.platform || 'Meta Ads';
      state.brands = Array.isArray(data.brands) ? data.brands : [];
      state.active = storedTab();
      bindEvents();
      render();
      state.ready = true;
    } catch (error) {
      if (els.body) {
        els.body.innerHTML = `<div class="empty-state"><strong>No se pudo cargar la segmentación</strong>${escapeHtml(error.message)}</div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  window.SegmentationModule = { init };
})();
