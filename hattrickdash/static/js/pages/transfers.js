/* Seite 5: Transfers */
(function () {
  const F = window.HHFmt;
  let activeTab = 'all';

  async function render(root) {
    const [all, pl, scout, formers] = await Promise.all([
      HHApi.transfers(), HHApi.transferPL(), HHApi.scout(), HHApi.formerPlayers(),
    ]);

    root.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="tabs" data-tabs="t">
            <button class="active" data-key="all">Alle</button>
            <button data-key="buy">Käufe</button>
            <button data-key="sell">Verkäufe</button>
            <button data-key="former">Ehemalige (${formers.length})</button>
            <button data-key="scout">Scouting-Empfehlungen</button>
            <button data-key="pl">P&L</button>
          </div>
        </div>
        <div class="card-body" id="tr-body"></div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="card-header">Transfer-Bilanz pro Saison</div>
        <div class="card-body" style="height:260px"><canvas id="pl-chart"></canvas></div>
      </div>
    `;

    root.querySelectorAll('[data-tabs="t"] button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('[data-tabs="t"] button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        activeTab = b.dataset.key;
        renderBody({ all, pl, scout, formers });
      });
    });

    renderBody({ all, pl, scout, formers });
    renderChart(pl);
  }

  function renderBody({ all, pl, scout, formers }) {
    const target = document.getElementById('tr-body');
    if (activeTab === 'former') {
      renderFormers(target, formers);
      return;
    }
    if (activeTab === 'pl') {
      target.innerHTML = `
        <table class="tbl">
          <thead><tr><th>Saison</th><th class="right">Einnahmen</th><th class="right">Ausgaben</th><th class="right">Netto</th></tr></thead>
          <tbody>
            ${pl.map((r) => `
              <tr>
                <td>Saison ${r.season}</td>
                <td class="right">${F.money(r.income)}</td>
                <td class="right">${F.money(r.costs)}</td>
                <td class="right ${r.net >= 0 ? 'delta-up' : 'delta-down'}">${F.money(r.net)}</td>
              </tr>
            `).join('') || `<tr><td class="muted">Keine Daten.</td></tr>`}
          </tbody>
        </table>
      `;
      return;
    }
    if (activeTab === 'scout') {
      target.innerHTML = `
        <table class="tbl">
          <thead><tr><th>Position</th><th>Schwäche</th><th>Anforderung</th><th>Budget</th><th>TSI</th></tr></thead>
          <tbody>
            ${scout.map((r) => `
              <tr>
                <td><span class="pos ${r.position}">${r.position}</span></td>
                <td>Ø ${r.current_avg_skill}</td>
                <td>${F.escapeHtml(r.skill_requirement)}</td>
                <td>${F.money(r.budget_min)} – ${F.money(r.budget_max)}</td>
                <td>${F.escapeHtml(r.tsi_range)}</td>
              </tr>
            `).join('') || `<tr><td class="muted">Keine Empfehlungen – Kader sieht solide aus.</td></tr>`}
          </tbody>
        </table>
      `;
      return;
    }

    const list = activeTab === 'all' ? all : all.filter((t) => t.direction === activeTab);
    target.innerHTML = `
      <table class="tbl">
        <thead><tr>
          <th>Datum</th><th>Spieler</th><th>Land</th><th>Alt</th><th>TSI</th>
          <th>Von/An</th><th>Preis</th><th>Richtung</th>
        </tr></thead>
        <tbody>
          ${list.map((t) => `
            <tr>
              <td>${F.date(t.deadline)}</td>
              <td>${F.escapeHtml(t.player_name)}</td>
              <td>${F.escapeHtml(t.nationality_name)}</td>
              <td>${t.age_years ?? '–'}</td>
              <td>${F.num(t.tsi)}</td>
              <td>${F.escapeHtml(t.other_team_name || '–')}</td>
              <td>${F.money(t.price)}</td>
              <td>${t.direction === 'buy' ? '🛒 Kauf' : '📤 Verkauf'}</td>
            </tr>
          `).join('') || `<tr><td class="muted">Keine Transfers.</td></tr>`}
        </tbody>
      </table>
    `;
  }

  function renderFormers(target, formers) {
    if (!formers || !formers.length) {
      target.innerHTML = `<div class="muted">Keine ehemaligen Spieler im Datensatz.</div>`;
      return;
    }
    // Sortierung: jüngster letzter Snapshot zuerst (= zuletzt verkauft/abgegangen)
    const sorted = [...formers].sort((a, b) =>
      String(b.last_snapshot).localeCompare(String(a.last_snapshot))
    );
    const totalSold = sorted.reduce((s, p) => s + (p.sale_price || 0), 0);
    const totalBought = sorted.reduce((s, p) => s + (p.purchase_price || 0), 0);
    const totalEstimated = sorted.reduce((s, p) => s + (p.sale_price_estimated || 0), 0);

    target.innerHTML = `
      <div class="muted" style="margin-bottom:8px;font-size:12px">
        Spieler die im jüngsten Kader-Snapshot nicht mehr enthalten sind
        (verkauft, abgegangen, oder einfach noch keine Daten).
        Verkaufswerte sind <b>real</b> wenn ein Transfer-Record existiert,
        sonst geschätzt aus letztem TSI×2.
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">
        <div style="background:#f0f8f0;border:1px solid #c4e3c4;border-radius:6px;padding:8px;text-align:center">
          <div class="muted" style="font-size:11px">Reale Verkaufserlöse</div>
          <div style="font-size:18px;font-weight:700;color:#22a722">${F.money(totalSold)}</div>
        </div>
        <div style="background:#fef0f0;border:1px solid #f0c4c4;border-radius:6px;padding:8px;text-align:center">
          <div class="muted" style="font-size:11px">Reale Einkaufskosten</div>
          <div style="font-size:18px;font-weight:700;color:#cc4444">${F.money(totalBought)}</div>
        </div>
        <div style="background:#f0f4f8;border:1px solid #c4d0e0;border-radius:6px;padding:8px;text-align:center">
          <div class="muted" style="font-size:11px">Geschätzter Wert (ohne Real-Daten)</div>
          <div style="font-size:18px;font-weight:700;color:#4488cc">~ ${F.money(totalEstimated)}</div>
        </div>
      </div>

      <table class="tbl players-tbl" style="font-size:12px">
        <thead><tr>
          <th>POS</th>
          <th class="left">Name</th>
          <th>Alt</th>
          <th>Land</th>
          <th class="right">Letzter Stand</th>
          <th class="right">Letzter TSI</th>
          <th class="right">Verkaufsdatum</th>
          <th class="right">Verkaufswert</th>
          <th class="right">Einkaufsdatum</th>
          <th class="right">Einkaufswert</th>
          <th class="right">P&L</th>
        </tr></thead>
        <tbody>
          ${sorted.map((p) => {
            const sale = p.sale_price != null
              ? `<b>${F.money(p.sale_price)}</b>`
              : `<span class="muted" title="Kein Transfer-Record vorhanden, geschätzt aus TSI×2">~ ${F.money(p.sale_price_estimated)}</span>`;
            const purchase = p.purchase_price != null
              ? `<b>${F.money(p.purchase_price)}</b>`
              : '<span class="muted">–</span>';
            const pl = p.pl == null ? '<span class="muted">–</span>'
              : `<span class="${p.pl >= 0 ? 'delta-up' : 'delta-down'}"><b>${F.money(p.pl)}</b></span>`;
            return `
              <tr class="pos-row-${p.position_code || ''}">
                <td><span class="pos ${p.position_code}">${p.position_code || '–'}</span></td>
                <td class="left"><b>${F.escapeHtml(p.name)}</b></td>
                <td>${p.age_years ?? '–'}</td>
                <td>${F.escapeHtml((p.nationality_name || '').slice(0, 12))}</td>
                <td class="right">${p.last_snapshot}</td>
                <td class="right">${F.num(p.last_tsi)}</td>
                <td class="right">${p.sale_date ? F.date(p.sale_date).slice(0, 10) : '<span class="muted">–</span>'}</td>
                <td class="right">${sale}</td>
                <td class="right">${p.purchase_date ? F.date(p.purchase_date).slice(0, 10) : '<span class="muted">–</span>'}</td>
                <td class="right">${purchase}</td>
                <td class="right">${pl}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function renderChart(pl) {
    if (!pl.length) return;
    const labels = pl.map((r) => `S${r.season}`);
    HHCharts.bar('pl-chart', labels, [
      { label: 'Einnahmen', backgroundColor: '#22a722', data: pl.map((r) => r.income) },
      { label: 'Ausgaben',  backgroundColor: '#cc2222', data: pl.map((r) => r.costs) },
    ], { stacked: false });
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.transfers = render;
})();
