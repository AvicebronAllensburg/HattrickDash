/* app.js - SPA-Router mit Sidebar-Navigation + Top-Header */

(function () {
  const ROUTES = ['home', 'team', 'players', 'matches', 'lineup', 'transfers',
                  'finance', 'arena', 'training', 'youth', 'settings'];
  const DEFAULT = 'home';

  function activeRoute() {
    const m = window.location.hash.match(/^#\/(\w+)/);
    return (m && ROUTES.includes(m[1])) ? m[1] : DEFAULT;
  }

  function setActiveLink(route) {
    document.querySelectorAll('.sidenav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === route);
    });
  }

  async function render() {
    const route = activeRoute();
    setActiveLink(route);
    const content = document.getElementById('content');
    content.innerHTML = `<div class="loading">Lade ${route}…</div>`;

    const page = window.HHPages && window.HHPages[route];
    if (!page) {
      content.innerHTML = `<div class="loading">Seite '${route}' nicht implementiert.</div>`;
      return;
    }
    try {
      await page(content);
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body" style="color:var(--negative)">Fehler: ${HHFmt.escapeHtml(err.message)}</div></div>`;
      console.error(err);
    }
  }

  // Datum dd.mm.yyyy hh:mm
  function fmtDate(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-DE') + ' ' +
           d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  async function refreshHeader() {
    const meta = document.getElementById('meta-text');
    const auth = document.getElementById('auth-status');
    const brandName = document.getElementById('brand-team-name');
    const brandSub = document.getElementById('brand-team-sub');
    try {
      const status = await HHApi.teamStatus();
      if (status.authenticated) {
        auth.innerHTML = `<span style="color:#22a722">●</span> OAuth aktiv · #${status.team_id ?? '?'}`;
      } else {
        auth.innerHTML = `<span style="color:#cc8855">●</span> ohne OAuth – <a href="#/settings" style="color:#2d6cdf;text-decoration:underline">Einstellungen → Login</a>`;
      }
      if (status.team_id) {
        try {
          const ov = await HHApi.teamOverview();
          if (ov.name) {
            brandName.textContent = ov.name;
            brandSub.textContent = ov.country_name
              ? `${ov.country_name} · Liga ${ov.league_level ?? '?'}`
              : '';
          }
          const parts = [];
          if (ov.last_updated) {
            parts.push(`<b>Hattrick Daten vom ${fmtDate(ov.last_updated)}</b>`);
          } else if (ov.latest_snapshot) {
            parts.push(`<b>Daten bis ${ov.latest_snapshot}</b>`);
          }
          if (ov.snapshot_count) {
            parts.push(`${ov.snapshot_count} Wochen Teamdaten`);
          }
          meta.innerHTML = parts.join(' &nbsp;·&nbsp; ') || 'Noch keine Daten';
          return;
        } catch (_) { /* fallthrough */ }
      }
      meta.textContent = 'Noch keine Daten – Einstellungen → Daten-Pull oder Imports';
    } catch (e) {
      auth.innerHTML = `<span style="color:#cc2222">●</span> Backend offline`;
      meta.textContent = '';
    }
  }

  function bindActions() {
    const btn = document.getElementById('btn-refresh');
    if (btn) {
      btn.addEventListener('click', () => {
        refreshHeader();
        render();
      });
    }
    // Mobile-Burger zum Sidebar-Toggle
    const burger = document.getElementById('topbar-burger');
    if (burger) {
      burger.addEventListener('click', () => {
        document.body.classList.toggle('menu-open');
      });
    }
    // Bei Sidebar-Klick auf kleinen Screens: Sidebar wieder zu
    document.querySelectorAll('.sidenav a').forEach((a) => {
      a.addEventListener('click', () => {
        document.body.classList.remove('menu-open');
      });
    });
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.location.hash) window.location.hash = '#/home';
    bindActions();
    refreshHeader();
    render();
  });

  // Damit Pages bei Bedarf den Header refreshen können
  window.HHRefreshHeader = refreshHeader;
})();

window.HHPages = window.HHPages || {};
