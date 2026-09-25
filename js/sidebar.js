(function () {
  const STORAGE_KEY = 'rb-sidebar-collapsed';
  const LEGACY_STORAGE_KEY = 'excambiare-sidebar-collapsed';

  function getStoredState() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === '1';
      return window.localStorage.getItem(LEGACY_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function saveState(collapsed) {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // El dashboard también debe funcionar si el navegador bloquea localStorage.
    }
  }

  // En la franja minimizada solo quedan los iconos: el nombre de cada módulo
  // pasa a tooltip y a aria-label para no perderlo.
  function syncItemLabels(sidebar, collapsed) {
    sidebar.querySelectorAll('.s-item').forEach(function (item) {
      const title = item.querySelector('.s-title-nav');
      const name = title ? title.textContent.trim() : '';
      if (collapsed && name) {
        item.setAttribute('title', name);
        item.setAttribute('aria-label', name);
      } else {
        item.removeAttribute('title');
        item.removeAttribute('aria-label');
      }
    });
  }

  function wireSidebarToggle() {
    const shell = document.querySelector('.shell');
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    if (!shell || !toggle || !sidebar) return;

    let collapsed = getStoredState();

    function render() {
      shell.classList.toggle('sidebar-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));

      const label = collapsed ? 'Expandir panel' : 'Minimizar panel';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
      syncItemLabels(sidebar, collapsed);
    }

    toggle.addEventListener('click', function () {
      collapsed = !collapsed;
      saveState(collapsed);
      render();

      // Los gráficos recalculan su ancho cuando termina la animación del panel.
      window.setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, 250);
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSidebarToggle);
  } else {
    wireSidebarToggle();
  }
})();
