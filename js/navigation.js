(function () {
  const VIEW_KEY = 'excambiare-active-view';
  // Modulos que muestran una sola marca. Gasto publicitario la elige desde el menu (una entrada por marca); el resto
  // la cambia con el selector de la barra superior. Todos comparten la marca activa de js/data-source.js.
  // Generacion de Reporte no esta: el PDF lleva las tres marcas.
  const BRAND_VIEWS = ['view-obj', 'view-ads', 'view-messages', 'view-history', 'view-reports'];
  const SWITCH_VIEWS = ['view-ads', 'view-messages', 'view-history', 'view-reports'];
  let currentView = 'view-obj';
  // La bajada (caption) de la barra superior repite la descripcion del modulo en el panel lateral, como Royal Baby.
  // Excepcion: en Gasto publicitario el menu pone la marca de titulo y "Gasto publicitario" debajo, que la barra ya
  // dice en su titulo; la bajada dice que mide, como en los otros tableros de la familia.
  const VIEW_META = {
    'view-obj': {
      title: 'Gasto publicitario 2026',
      caption: 'Meta Ads por objetivo',
      source: 'Fuente: Meta Ads / descargas mensuales en Google Drive',
      footer: 'Barrido automático todos los días a las 10:00',
    },
    'view-ads': {
      title: 'Anuncios',
      caption: 'Meta Ads por anuncio',
      source: 'Fuente: Meta Ads / descargas mensuales en Google Drive',
      footer: 'Mismo mes que Gasto publicitario',
    },
    'view-messages': {
      title: 'Proyecciones',
      caption: 'Cierre de mes por objetivo',
      source: 'Fuente: Gasto publicitario / Meta Ads',
      footer: 'Proyección lineal según el ritmo del mes',
    },
    'view-calculator': {
      title: 'Calculadora de inversión',
      caption: 'Inversión por CPL',
      source: 'Fuente: valores ingresados / CPL real de Meta Ads',
      footer: 'Los valores se guardan en este navegador',
    },
    'view-history': {
      title: 'Histórico de campañas',
      caption: 'Activas y finalizadas',
      source: 'Fuente: Meta Ads / todos los meses con descarga',
      footer: 'Todas las campañas de las descargas de Drive',
    },
    'view-reports': {
      title: 'Archivo de Reportes',
      caption: 'Documentos y reporte mensual',
      source: 'Fuente: Carpeta de reportes de la marca / Google Drive',
      footer: 'Validado contra las descargas de Meta del módulo Gasto publicitario',
    },
    'view-segments': {
      title: 'Segmentación',
      caption: 'Públicos por marca',
      source: 'Fuente: documento Segmentaciones Excambiare',
      footer: 'Se actualiza al cambiar el documento fuente',
    },
    'view-week': {
      parent: 'view-reports',   // va dentro de Archivo de Reportes, con su pestaña
      title: 'Archivo de Reportes',
      caption: 'Documentos y reporte mensual',
      source: 'Fuente: descargas de Meta Ads de las tres marcas',
      footer: 'El mes elegido, listo para descargar en PDF',
    },
    'view-log': {
      title: 'Bitácora',
      caption: 'Cambios, comentarios y decisiones',
      source: 'Fuente: Bitácora del equipo de Agencia Lima Retail',
      footer: 'Las ediciones quedan como borrador hasta exportar y publicar el archivo',
    },
  };

  function storedView() {
    try {
      const value = window.localStorage.getItem(VIEW_KEY);
      return VIEW_META[value] ? value : 'view-obj';
    } catch {
      return 'view-obj';
    }
  }

  function saveView(viewId) {
    try {
      window.localStorage.setItem(VIEW_KEY, viewId);
    } catch {
      // La navegación sigue funcionando aunque localStorage no esté disponible.
    }
  }

  // Titulo, menu y selector dependen de la vista y de la marca activa: se repintan al cambiar cualquiera de las dos.
  function renderChrome() {
    const viewId = currentView;
    const meta = VIEW_META[viewId] || VIEW_META['view-obj'];
    const brand = window.ExcambiareData?.brand();
    const brandLabel = window.ExcambiareData?.brandLabel() || '';
    const branded = BRAND_VIEWS.includes(viewId);
    // El menú marca el módulo; las pestañas de adentro, la sección abierta.
    document.querySelectorAll('[data-view-target]').forEach(button => {
      const target = button.dataset.viewTarget;
      const active = (target === viewId || (button.classList.contains('s-item') && target === meta.parent))
        && (!button.dataset.brand || button.dataset.brand === brand);
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.getElementById('topbar-title').textContent = viewId === 'view-obj' && brandLabel ? `${brandLabel} · ${meta.title}` : meta.title;
    document.getElementById('topbar-caption').textContent = branded && viewId !== 'view-obj' && brandLabel ? `${brandLabel} · ${meta.caption}` : meta.caption;
    // El estado de los datos (#topbar-status) es el mismo en todos los modulos: lo mantiene js/data-source.js.
    document.getElementById('footer-source').textContent = meta.source;
    document.getElementById('footer-status').textContent = meta.footer;
    const switcher = document.getElementById('brand-switch');
    if (switcher) {
      switcher.hidden = !SWITCH_VIEWS.includes(viewId);
      switcher.querySelectorAll('[data-brand-switch]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.brandSwitch === brand));
      });
    }
  }

  function showView(viewId, brand) {
    currentView = VIEW_META[viewId] ? viewId : 'view-obj';
    viewId = currentView;
    // Una entrada de Gasto publicitario del menu cambia la marca antes de mostrar la vista.
    if (brand) window.ExcambiareData?.setBrand(brand);
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('visible', view.id === viewId);
    });
    renderChrome();
    saveView(viewId);

    // Gasto publicitario y Anuncios comparten el mes: la que se abre se repinta si el mes cambio en la otra.
    if (viewId === 'view-obj' || viewId === 'view-ads') window.ExcambiareObjectives?.show(viewId);
    if (viewId === 'view-messages') window.ExcambiareProjections?.init();
    if (viewId === 'view-calculator') window.MessagesCalculator?.init();
    if (viewId === 'view-reports') window.ReportsArchive?.init();
    if (viewId === 'view-week') window.ReporteSemanal?.init();
    if (viewId === 'view-log') window.Bitacora?.init();
    if (viewId === 'view-segments') window.SegmentationModule?.init();
  }

  function renderBrandSwitch() {
    const switcher = document.getElementById('brand-switch');
    if (!switcher || !window.ExcambiareData) return;
    switcher.innerHTML = window.ExcambiareData.brands()
      .map(brand => `<button type="button" class="brand-tab" data-brand-switch="${brand.key}" aria-pressed="false">${brand.label}</button>`)
      .join('');
    switcher.addEventListener('click', event => {
      const button = event.target.closest('[data-brand-switch]');
      if (button) window.ExcambiareData.setBrand(button.dataset.brandSwitch);
    });
  }

  function initNavigation() {
    renderBrandSwitch();
    document.querySelectorAll('[data-view-target]').forEach(button => {
      button.addEventListener('click', () => showView(button.dataset.viewTarget, button.dataset.brand));
    });
    window.addEventListener('excambiare:brand-changed', renderChrome);
    showView(storedView());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }
})();
