/* Seite Training (öffentliche Version).
   CHPP-Compliance: Skill-/Zustands-VERLÄUFE über Zeit (Spieler- und
   Team-Trends) sind Teil des Hattrick-Supporter-Pakets und in der
   öffentlichen Version NICHT enthalten. Gezeigt wird nur die Trainings-
   TYP-Historie (welcher Trainingstyp lief in welcher Woche) + Verteilung —
   das ist kein Skill-Verlauf. Im 'local'-Branch sind die Trends vorhanden. */
(function () {
  const F = window.HHFmt;

  async function render(root) {
    root.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div style="padding:12px;background:#fff8e1;border:1px solid #f0d68a;border-radius:6px;color:var(--text)">
            <b>Skill- &amp; Team-Verläufe über Zeit sind in dieser Version nicht enthalten.</b><br>
            Nach den Hattrick-CHPP-Regeln ist die Aufzeichnung der Spieler-/
            Team-Entwicklung über Zeit Teil des Hattrick-Supporter-Pakets und
            darf von CHPP-Apps nicht repliziert werden. Gezeigt wird daher nur
            die Trainingstyp-Historie (kein Skill-Verlauf).
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-header">Trainingstyp-Verteilung &amp; Wochenhistorie</div>
        <div class="card-body" id="train-history-body">Lade…</div>
      </div>
    `;

    await loadHistoryTab();
  }

  // ============================================================ History
  async function loadHistoryTab() {
    const [grouped, dist] = await Promise.all([HHApi.training(), HHApi.trainingDist()]);
    const target = document.getElementById('train-history-body');

    if (!grouped.length) {
      target.innerHTML = `<div class="muted">Noch keine Trainings-Daten.</div>`;
      return;
    }

    target.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Wochenhistorie</div>
          ${grouped.map((g, i) => `
            <details class="season-block" ${i === 0 ? 'open' : ''}>
              <summary>Saison ${g.season}</summary>
              <table class="tbl">
                <thead><tr><th>Woche</th><th>Datum</th><th>Typ</th><th>Intensität</th><th>Kondition</th></tr></thead>
                <tbody>
                  ${g.weeks.map((w) => `
                    <tr>
                      <td>Woche ${w.week_number}</td>
                      <td>${w.training_date}</td>
                      <td>${F.escapeHtml(w.training_type || '–')}</td>
                      <td>${w.training_intensity ?? 0}%</td>
                      <td>${w.stamina_share ?? 0}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </details>
          `).join('')}
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Trainingstyp-Verteilung</div>
          <div style="height:280px"><canvas id="train-pie"></canvas></div>
        </div>
      </div>
    `;

    if (dist.length) {
      const colors = ['#cc4444', '#4466cc', '#4499aa', '#44aa66', '#ddaa44', '#44aacc', '#888', '#aa55cc', '#cc8855'];
      HHCharts.pie('train-pie',
        dist.map((d) => d.training_type),
        dist.map((d) => d.count),
        dist.map((_, i) => colors[i % colors.length]));
    }
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.training = render;
})();
