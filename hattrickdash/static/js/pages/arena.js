/* Stadion-Seite: Übersicht + Arenasizer + Stadium-Bild je Größe */
(function () {
  const F = window.HHFmt;
  const LABELS = { terraces: 'Stehplätze', seating: 'Sitzplätze', seating_roof: 'überd. Sitzplätze', vip: 'VIP Logen' };
  let activeTab = 'overview';

  async function render(root) {
    const arena = await HHApi.arenaLatest();
    root.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="tabs" data-tabs="a">
            <button class="active" data-key="overview">Übersicht</button>
            <button data-key="sizer">Arenasizer</button>
          </div>
        </div>
        <div class="card-body" id="a-body"></div>
      </div>
    `;
    root.querySelectorAll('[data-tabs="a"] button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('[data-tabs="a"] button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        activeTab = b.dataset.key;
        renderTab(arena);
      });
    });
    renderTab(arena);
  }

  function renderTab(arena) {
    const target = document.getElementById('a-body');
    if (!arena.blocks) {
      target.innerHTML = `<div class="muted">Keine Stadion-Daten.</div>`;
      return;
    }
    if (activeTab === 'overview') {
      renderOverview(target, arena);
    } else {
      renderSizer(target, arena);
    }
  }

  function renderOverview(target, arena) {
    const incomeMatch = arena.income_actual || arena.income_estimated || 0;
    target.innerHTML = `
      <div class="arena-hero">
        <div class="arena-svg-wrap">
          <img src="${stadiumImagePath(arena.size_index ?? 0)}"
               alt="Stadion (${F.num(arena.capacity_total)} Plätze)"
               loading="lazy">
        </div>
        <div class="arena-name">${F.escapeHtml(arena.arena_name || 'Stadion')}</div>
      </div>

      <div class="arena-kpi-grid">
        ${arenaKPI('🪑', 'Kapazität',  F.num(arena.capacity_total), 'Plätze gesamt')}
        ${arenaKPI('👥', 'Ø Zuschauer', F.num(arena.attendance_total), 'letzte Heimspiele')}
        ${arenaKPI('💶', 'Einnahmen',   F.money(incomeMatch), 'pro Heimspiel')}
        ${arenaKPI('📈', 'Auslastung',  (arena.usage_total_pct?.toFixed(1) ?? '?') + ' %', 'Ø der Blöcke')}
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-header">Block-Details</div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="tbl arena-blocks-tbl">
            <thead><tr>
              <th>Block</th>
              <th class="center">Plätze</th>
              <th class="center">Anteil</th>
              <th class="center">Optimal</th>
              <th class="center">Zuschauer</th>
              <th class="center">Auslastung</th>
              <th class="center">Einnahmen</th>
            </tr></thead>
            <tbody>
              ${arena.blocks.map((b) => `
                <tr>
                  <td><b>${LABELS[b.name]}</b></td>
                  <td class="center">${F.num(b.capacity)}</td>
                  <td class="center">${b.ratio_pct.toFixed(1)}%</td>
                  <td class="center muted">${b.optimal_pct}%</td>
                  <td class="center">${F.num(b.attendance)}</td>
                  <td class="center">
                    ${b.usage_pct.toFixed(1)}%
                    <div class="usage-bar"><i style="width:${Math.min(100, b.usage_pct)}%"></i></div>
                  </td>
                  <td class="center">${F.money(b.income)}</td>
                </tr>
              `).join('')}
              <tr class="totals-row">
                <td><b>Total</b></td>
                <td class="center"><b>${F.num(arena.capacity_total)}</b></td>
                <td class="center"><b>100%</b></td>
                <td></td>
                <td class="center"><b>${F.num(arena.attendance_total)}</b></td>
                <td class="center"><b>${arena.usage_total_pct?.toFixed(1)}%</b></td>
                <td class="center"><b>${F.money(incomeMatch)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function arenaKPI(icon, label, value, sub) {
    return `
      <div class="arena-kpi">
        <div class="arena-kpi-icon">${icon}</div>
        <div class="arena-kpi-label">${label}</div>
        <div class="arena-kpi-value">${value}</div>
        <div class="arena-kpi-sub">${sub}</div>
      </div>
    `;
  }

  function renderSizer(target, arena) {
    target.innerHTML = `
      <p class="muted">
        Der Arenasizer hilft Dir, maximalen Profit aus Deinem Stadion zu holen.
        Anhand der Größe Deines Fanclubs siehst Du, wie groß Dein Stadion sein sollte.
      </p>
      <div style="display:flex;gap:8px;align-items:center;margin:8px 0">
        <label>Neue Gesamtgröße:
          <input type="number" id="arena-target"
                 value="${arena.capacity_total + 5000}" step="500" min="5000" max="200000">
        </label>
        <button class="primary" id="arena-go">Los</button>
      </div>
      <div id="sizer-result"></div>
    `;
    document.getElementById('arena-go').addEventListener('click', runSizer);
    runSizer();
  }

  async function runSizer() {
    const target = +document.getElementById('arena-target').value;
    const r = await HHApi.arenaSizer(target);
    const dist = r.distribution;
    document.getElementById('sizer-result').innerHTML = `
      <div class="grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Verteilung neue Größe</div>
          <table class="tbl">
            <thead><tr><th>Block</th><th class="right">Plätze</th></tr></thead>
            <tbody>
              ${Object.entries(dist).map(([k, v]) => `
                <tr><td>${LABELS[k]}</td><td class="right">${F.num(v)}</td></tr>
              `).join('')}
              <tr style="font-weight:700;border-top:2px solid var(--border)">
                <td>Total Plätze</td>
                <td class="right">${F.num(r.target_total)}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top:10px">
            Größe des Fanclubs: <b>${F.num(r.fanclub_size)}</b>
          </div>
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Erwartete Einnahmen</div>
          <table class="tbl">
            <thead><tr><th>Auslastung</th><th class="right">Zuschauer</th><th class="right">Einnahmen</th></tr></thead>
            <tbody>
              ${r.scenarios.map((s) => {
                const cls = s.label === 'schlecht' ? 'tag warn'
                         : s.label === 'mittel'   ? 'tag warn'
                         : 'tag bad';
                return `
                  <tr>
                    <td><span class="${cls}">${s.label}</span></td>
                    <td class="right">${F.num(s.attendance)}</td>
                    <td class="right">${F.money(s.revenue)}</td>
                  </tr>
                `;
              }).join('')}
              <tr><td>Unterhaltskosten</td><td></td><td class="right">${F.money(r.maintenance_cost)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ============================================================ Stadium-Bild
  // Mappt size_index (0..12 in 5k-Schritten) auf eine der 7 Stufen-PNGs
  // unter /static/img/stadium/. Eigene Designs einfach dort austauschen.
  function stadiumImagePath(sizeIdx) {
    const variants = [
      '01_tiny.svg',     // 0  (0-5k)
      '01_tiny.svg',     // 1  (5-10k)
      '02_small.svg',    // 2  (10-15k)
      '02_small.svg',    // 3  (15-20k)
      '03_medium.svg',   // 4  (20-25k)
      '03_medium.svg',   // 5  (25-30k)
      '04_large.svg',    // 6  (30-35k)
      '04_large.svg',    // 7  (35-40k)
      '05_round.svg',    // 8  (40-45k)
      '05_round.svg',    // 9  (45-50k)
      '06_covered.svg',  // 10 (50-55k)
      '06_covered.svg',  // 11 (55-60k)
      '07_mega.svg',     // 12 (60k+)
    ];
    const idx = Math.max(0, Math.min(variants.length - 1, sizeIdx | 0));
    return `/static/img/stadium/${variants[idx]}`;
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.arena = render;
})();
