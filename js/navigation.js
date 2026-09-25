(function () {
  const VIEW_KEY = 'excambiare-active-view';
  const VIEW_META = {
    'view-obj': {
      title: 'Gasto publicitario 2026',
      caption: 'Agencia Lima Retail',
      status: 'Datos al 17 de septiembre',
      source: 'Fuente: Distribucion-excambiare / Septiembre actualizado',
      footer: 'Sincronizado por Agencia Lima Retail',
    },
    'view-messages': {
      title: 'Proyecciones',
      caption: 'Cierre de mes proyectado',
      status: 'Proyección sobre datos reales',
      source: 'Fuente: Gasto publicitario / Distribucion-excambiare',
      footer: 'Proyección lineal según el ritmo del mes',
    },
    'view-history': {
      title: 'Histórico de Campañas',
      caption: 'Campañas finalizadas',
      status: 'Datos al 17 de septiembre',
      source: 'Fuente: Distribucion-excambiare / Histórico consolidado',
      footer: 'Solo campañas finalizadas',
    },
    'view-reports': {
      title: 'Archivo de Reportes',
      caption: 'Documentos en Google Drive',
      status: 'Catalogo al 17 de septiembre',
      source: 'Fuente: Carpeta compartida Reportes Excambiare / Google Drive',
      footer: 'Vista previa y descarga directa desde Drive',
    },
    'view-segments': {
      title: 'Segmentación',
      caption: 'Públicos de Meta Ads por marca',
      status: 'Segmentación al 25 de septiembre',
      source: 'Fuente: Segmentaciones Excambiare / Google Docs',
      footer: 'MEX · Gold Fusion · Sol y Tierra',
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

  function showView(viewId) {
    const meta = VIEW_META[viewId] || VIEW_META['view-obj'];
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('visible', view.id === viewId);
    });
    document.querySelectorAll('[data-view-target]').forEach(button => {
      const active = button.dataset.viewTarget === viewId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });

    document.getElementById('topbar-title').textContent = meta.title;
    document.getElementById('topbar-caption').textContent = meta.caption;
    document.getElementById('topbar-status').textContent = meta.status;
    document.getElementById('footer-source').textContent = meta.source;
    document.getElementById('footer-status').textContent = meta.footer;
    saveView(viewId);

    if (viewId === 'view-messages') {
      window.ExcambiareProjections?.init();
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    }
    if (viewId === 'view-obj') window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    if (viewId === 'view-history') window.ExcambiareObjectives?.renderHistory?.();
    if (viewId === 'view-reports') window.ReportsArchive?.init();
    if (viewId === 'view-segments') window.SegmentationModule?.init();
  }

  function initNavigation() {
    document.querySelectorAll('[data-view-target]').forEach(button => {
      button.addEventListener('click', () => showView(button.dataset.viewTarget));
    });
    showView(storedView());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }
})();
