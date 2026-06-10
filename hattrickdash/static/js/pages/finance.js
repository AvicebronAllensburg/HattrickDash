/* Finanzen-Seite mit Zeitraum-Filter */
(function () {
  const F = window.HHFmt;

  const RANGES = [
    { value: 7,    label: '7 Tage' },
    { value: 14,   label: '14 Tage' },
    { value: 30,   label: '1 Monat' },
    { value: 60,   label: '2 Monate' },
    { value: 90,   label: '3 Monate' },
    { value: 180,  label: '6 Monate' },
    { value: 365,  label: '12 Monate' },
    { value: 0,    label: 'Alle Daten' },
  ];

  let currentDays = 30;

  async function render(root) {
    root.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="card-header">
          <span>💶 Finanzen</span>
          <div style="display:flex;gap:6px;align-items:center">
            <label style="font-size:12px;color:var(--text-soft)">Zeitraum:</label>
            <select id="fin-range" style="font-size:12px">
              ${RANGES.map((r) => `<option value="${r.value}" ${r.value === currentDays ? 'selected' : ''}>${r.label}</option>`).join('')}
            </select>
            <span class="muted" style="font-size:11px" id="fin-range-info"></span>
          </div>
        </div>
        <div class="card-body" id="fin-kpi-row">Lade…</div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">Wöchentliche Einnahmen / Ausgaben</div>
          <div class="card-body" style="height:280px"><canvas id="fin-bar"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header">Cashflow</div>
          <div class="card-body" style="height:280px"><canvas id="fin-cash"></canvas></div>
        </div>
      </div>
      <div class="grid-2" style="margin-top:14px">
        <div class="card">
          <div class="card-header">Gehaltsstruktur (aktueller Kader)</div>
          <div class="card-body" style="height:260px"><canvas id="salary-pie"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header">Sponsoren + Zuschauer-Trend</div>
          <div class="card-body" style="height:260px"><canvas id="sup-trend"></canvas></div>
        </div>
      </div>
    `;

    document.getElementById('fin-range').addEventListener('change', (e) => {
      currentDays = +e.target.value;
      loadAll();
    });

    await loadAll();
  }

  async function loadAll() {
    const [history, salary, latest] = await Promise.all([
      HHApi.financeHistory(currentDays || null),
      HHApi.salaryBreakdown(),
      HHApi.financeLatest(),
    ]);

    renderKPIs(latest.current || {});

    const info = document.getElementById('fin-range-info');
    if (history.length) {
      info.textContent = `${history.length} Snapshots · ${history[0].snapshot_date} → ${history[history.length - 1].snapshot_date}`;
    } else {
      info.textContent = 'Keine Daten im Zeitraum';
    }

    if (!history.length) {
      ['fin-bar', 'fin-cash', 'sup-trend'].forEach((id) => {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, 9999, 9999);
      });
      return;
    }
    const labels = history.map((r) => r.snapshot_date);
    HHCharts.bar('fin-bar', labels, [
      { label: 'Einnahmen', backgroundColor: '#22a722', data: history.map((r) => r.income.total || 0) },
      { label: 'Ausgaben',  backgroundColor: '#cc2222', data: history.map((r) => r.costs.total || 0) },
    ]);
    HHCharts.line('fin-cash', labels, [
      { label: 'Bargeld',
        borderColor: '#2d6cdf',
        backgroundColor: 'rgba(45,108,223,.18)',
        data: history.map((r) => r.cash_balance),
        fill: true, spanGaps: true },
    ]);
    if (salary.length) {
      const colors = ['#cc4444', '#4466cc', '#4499aa', '#44aa66', '#ddaa44', '#44aacc', '#888'];
      HHCharts.pie('salary-pie',
        salary.map((r) => r.position),
        salary.map((r) => r.total),
        salary.map((_, i) => colors[i % colors.length]));
    }
    HHCharts.line('sup-trend', labels, [
      { label: 'Sponsoren', borderColor: '#22a722', data: history.map((r) => r.income.sponsors || 0), spanGaps: true },
      { label: 'Zuschauer', borderColor: '#ddaa22', data: history.map((r) => r.income.tickets || 0), spanGaps: true },
    ]);
  }

  function renderKPIs(c) {
    const target = document.getElementById('fin-kpi-row');
    const overrideActive = !!c.override_active;
    const cash      = c.cash_balance ?? 0;
    const reserves  = c.cash_reserves ?? 0;
    const total     = c.cash_total ?? (overrideActive ? cash + reserves : cash);
    const next      = c.cash_next_week ?? 0;
    const profit    = c.profit ?? 0;

    target.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div class="kpi-tile kpi-cash">
          <div class="kpi-label">💵 Bargeld${overrideActive ? '' : ' (Import)'}</div>
          <div class="kpi-value">${F.money(cash)}</div>
        </div>
        ${overrideActive ? `
        <div class="kpi-tile kpi-reserves">
          <div class="kpi-label">🏦 Rücklagen</div>
          <div class="kpi-value">${F.money(reserves)}</div>
        </div>
        <div class="kpi-tile kpi-total">
          <div class="kpi-label">💰 Gesamt</div>
          <div class="kpi-value">${F.money(total)}</div>
        </div>
        ` : ''}
        <div class="kpi-tile">
          <div class="kpi-label">📅 Nächste Woche</div>
          <div class="kpi-value" style="font-size:18px">${F.money(next)}</div>
        </div>
        <div class="kpi-tile" style="border-top-color:${profit >= 0 ? '#22a722' : '#cc4444'}">
          <div class="kpi-label">📈 Profit (Woche)</div>
          <div class="kpi-value" style="font-size:18px;color:${profit >= 0 ? '#22a722' : '#cc4444'}">${F.money(profit)}</div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${overrideActive
          ? `<span class="tag ok" title="Manuell gesetzt am ${F.date(c.override_updated_at)}">✓ Manueller Override aktiv</span>
             <button id="fin-edit-override">✏ Bearbeiten</button>
             <button id="fin-clear-override">↺ Zurücksetzen</button>
             ${c.override_note ? `<span class="muted" style="font-size:11px">📝 ${F.escapeHtml(c.override_note)}</span>` : ''}`
          : `<span class="tag warn" title="Imports liefern den API-Cap-Wert (~150M), nicht das echte Bargeld aus dem Hattrick-Web-UI">⚠ Werte aus Import – ggf. ungenau</span>
             <button class="primary" id="fin-edit-override">✏ Echte Werte eintragen</button>`
        }
      </div>
    `;

    document.getElementById('fin-edit-override')?.addEventListener('click', openOverrideForm);
    document.getElementById('fin-clear-override')?.addEventListener('click', async () => {
      if (!confirm('Override aufheben? Imports liefern dann wieder die ungenauen API-Cap-Werte.')) return;
      await HHApi.clearFinanceOverride();
      await loadAll();
    });
  }

  async function openOverrideForm() {
    const cur = await HHApi.financeOverride().catch(() => ({}));
    const dialog = document.createElement('div');
    dialog.className = 'override-modal';
    dialog.innerHTML = `
      <div class="override-modal-content">
        <h3 style="margin-top:0">💶 Finanzen manuell setzen</h3>
        <p class="muted" style="font-size:12px">
          HRF-Files und HSQLDB-Logs liefern <code>cash=150.000.000</code> als
          API-Cap, nicht den echten Wert aus dem Hattrick-Web-UI. Hier kannst du
          Bargeld + Rücklagen (z.B. „14 Mio verfügbar / 21 Mio Rücklagen")
          manuell eintragen.<br>
          <i>Der Override überschreibt alle künftigen Imports, bis du ihn aufhebst.</i>
        </p>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center">
          <label>💵 Bargeld (verfügbar):</label>
          <input type="number" id="ov-cash" value="${cur.cash_balance ?? ''}" placeholder="14000000" step="100000">
          <label>🏦 Rücklagen:</label>
          <input type="number" id="ov-reserves" value="${cur.cash_reserves ?? ''}" placeholder="21000000" step="100000">
          <label>📅 Nächste Woche:</label>
          <input type="number" id="ov-next" value="${cur.cash_next_week ?? ''}" placeholder="optional" step="100000">
          <label>📝 Notiz:</label>
          <input type="text" id="ov-note" value="${F.escapeHtml(cur.note ?? '')}" placeholder="z.B. Stand 02.05.2026">
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
          <button id="ov-cancel">Abbrechen</button>
          <button class="primary" id="ov-save">💾 Speichern</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    function close() { dialog.remove(); }
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
    document.getElementById('ov-cancel').addEventListener('click', close);
    document.getElementById('ov-save').addEventListener('click', async () => {
      const data = {
        cash_balance:   +document.getElementById('ov-cash').value || null,
        cash_reserves:  +document.getElementById('ov-reserves').value || null,
        cash_next_week: +document.getElementById('ov-next').value || null,
        note:           document.getElementById('ov-note').value.trim(),
      };
      await HHApi.setFinanceOverride(data);
      close();
      await loadAll();
    });
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.finance = render;
})();
