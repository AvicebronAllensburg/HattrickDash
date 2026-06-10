/* Seite 3: Spiele – Sidebar + 3 Tabs */
(function () {
  const F = window.HHFmt;
  let currentFilter = { match_type: null, season: null };
  let currentTab = 'points';

  async function render(root) {
    const status = await HHApi.teamStatus();
    const matches = await HHApi.matches();
    const stats = await HHApi.matchStats();
    const seasons = [...new Set(matches.map((m) => m.season).filter((s) => s != null))].sort((a, b) => b - a);

    root.innerHTML = `
      <div class="sidebar-layout">
        <aside class="sidebar">
          <h4>Spiele</h4>
          <ul>
            <li class="active" data-filter="all">Alle Deine Spiele</li>
          </ul>
          <h4>🏆 Liga</h4>
          <ul id="league-list">
            ${seasons.map((s) => `<li data-season="${s}" data-type="LEAGUE">Saison ${s}</li>`).join('')}
          </ul>
          <h4>Andere</h4>
          <ul>
            <li data-type="FRIENDLY">🤝 Freundsch.Spiele</li>
            <li data-type="CUP">🥇 Pokalspiele</li>
            <li data-type="QUALIFICATION">🛡 Qualifikation</li>
            <li data-type="TOURNAMENT">🎯 Turnier</li>
          </ul>
          <h4>Suche</h4>
          <input type="text" id="match-search" placeholder="ID oder Name">
        </aside>
        <section>
          <div class="card">
            <div class="card-header">
              <div class="tabs" data-tabs="stats">
                <button class="active" data-key="points">Punkte & Bewertungen</button>
                <button data-key="att">Angriffsstatistiken</button>
                <button data-key="def">Verteidigungsstatistiken</button>
              </div>
            </div>
            <div class="card-body" id="match-content"></div>
          </div>
          <div class="card" style="margin-top:14px">
            <div class="card-header">Spielliste</div>
            <div class="card-body" id="match-list"></div>
          </div>
        </section>
      </div>
    `;

    root.querySelectorAll('.sidebar li').forEach((li) => {
      li.addEventListener('click', () => {
        root.querySelectorAll('.sidebar li').forEach((x) => x.classList.remove('active'));
        li.classList.add('active');
        currentFilter = {
          match_type: li.dataset.type || null,
          season: li.dataset.season ? +li.dataset.season : null,
        };
        renderList(matches);
      });
    });
    root.querySelectorAll('[data-tabs="stats"] button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('[data-tabs="stats"] button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        currentTab = b.dataset.key;
        renderStats(stats);
      });
    });

    renderStats(stats);
    renderList(matches);
  }

  function applyFilter(matches) {
    let out = matches;
    if (currentFilter.match_type) out = out.filter((m) => m.match_type === currentFilter.match_type);
    if (currentFilter.season != null) out = out.filter((m) => m.season === currentFilter.season);
    return out;
  }

  function renderList(matches) {
    const out = applyFilter(matches);
    document.getElementById('match-list').innerHTML = `
      <table class="tbl">
        <thead><tr><th>Typ</th><th>Datum</th><th>Heim</th><th></th><th>Auswärts</th><th>Erg.</th></tr></thead>
        <tbody>
          ${out.map((m) => `
            <tr>
              <td class="center" style="font-size:16px">${F.matchTypeBadge(m.match_type)}</td>
              <td>${F.date(m.match_date)}</td>
              <td>${F.escapeHtml(m.home_team_name)}</td>
              <td>vs</td>
              <td>${F.escapeHtml(m.away_team_name)}</td>
              <td>${m.home_goals ?? '?'}:${m.away_goals ?? '?'} ${F.result(m.result)}</td>
            </tr>
          `).join('') || `<tr><td colspan="6" class="muted">Keine Spiele.</td></tr>`}
        </tbody>
      </table>
    `;
  }

  function renderStats(stats) {
    const target = document.getElementById('match-content');
    if (!stats.seasons || !stats.seasons.length) {
      target.innerHTML = `
        <div style="padding:10px;background:#fff8e1;border:1px solid #f0d68a;border-radius:6px">
          <b>Keine Spielhistorie in der DB.</b>
          <p class="muted" style="margin:6px 0">
            HRF-Files enthalten keine Spiele oder Match-Ratings – dafür braucht es
            die Live-CHPP-Endpoints <code>matchlist</code> + <code>matchdetails</code>.
            Nach einmaligem OAuth-Login werden alle Spiele automatisch geladen.
          </p>
          <a href="#/admin" class="btn primary" style="display:inline-block;text-decoration:none">⚙ Zum Admin-Tab → OAuth einrichten</a>
        </div>
      `;
      return;
    }
    target.innerHTML = stats.seasons.map((s) => `
      <details class="season-block" ${s === stats.seasons[0] ? 'open' : ''}>
        <summary>Saison ${s.season}</summary>
        ${currentTab === 'points' ? pointsTable(s) :
          currentTab === 'att'    ? attTable(s)    : defTable(s)}
      </details>
    `).join('');
  }

  function pointsTable(s) {
    const rows = [
      ['Heim',  s.home],
      ['Auswärts', s.away],
      ['Total', s.total],
    ];
    return `
      <table class="tbl">
        <thead><tr>
          <th></th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>T+</th><th>T-</th><th>±</th><th>Pkt</th>
          <th>Gelb</th><th>Rot</th><th>Mid</th><th>D L</th><th>D C</th><th>D R</th><th>A L</th><th>A C</th><th>A R</th>
        </tr></thead>
        <tbody>
          ${rows.map(([label, b]) => b.matches ? `
            <tr><td><b>${label}</b></td>
              <td>${b.matches}</td><td>${b.wins}</td><td>${b.draws}</td><td>${b.losses}</td>
              <td>${b.goals_for}</td><td>${b.goals_against}</td><td>${b.goals_diff}</td><td>${b.points}</td>
              <td>${b.yellow_cards}</td><td>${b.red_cards}</td>
              <td>${b.avg_ratings.mid ?? '–'}</td>
              <td>${b.avg_ratings.def_left ?? '–'}</td>
              <td>${b.avg_ratings.def_center ?? '–'}</td>
              <td>${b.avg_ratings.def_right ?? '–'}</td>
              <td>${b.avg_ratings.att_left ?? '–'}</td>
              <td>${b.avg_ratings.att_center ?? '–'}</td>
              <td>${b.avg_ratings.att_right ?? '–'}</td>
            </tr>
          ` : '').join('')}
        </tbody>
      </table>
    `;
  }

  function attTable(s) {
    return `
      <table class="tbl">
        <thead><tr><th>Saison</th><th>Sp</th><th>Tore</th><th>Mid</th><th>A L</th><th>A C</th><th>A R</th></tr></thead>
        <tbody>
          <tr><td>Saison ${s.season}</td><td>${s.total.matches}</td><td>${s.total.goals_for}</td>
              <td>${s.total.avg_ratings.mid ?? '–'}</td>
              <td>${s.total.avg_ratings.att_left ?? '–'}</td>
              <td>${s.total.avg_ratings.att_center ?? '–'}</td>
              <td>${s.total.avg_ratings.att_right ?? '–'}</td></tr>
        </tbody>
      </table>
      <div class="muted">Detail-Chancen erfordern matchdetails-Pull pro Spiel (TODO).</div>
    `;
  }

  function defTable(s) {
    return `
      <table class="tbl">
        <thead><tr><th>Saison</th><th>Sp</th><th>Gegentore</th><th>Mid</th><th>D L</th><th>D C</th><th>D R</th></tr></thead>
        <tbody>
          <tr><td>Saison ${s.season}</td><td>${s.total.matches}</td><td>${s.total.goals_against}</td>
              <td>${s.total.avg_ratings.mid ?? '–'}</td>
              <td>${s.total.avg_ratings.def_left ?? '–'}</td>
              <td>${s.total.avg_ratings.def_center ?? '–'}</td>
              <td>${s.total.avg_ratings.def_right ?? '–'}</td></tr>
        </tbody>
      </table>
      <div class="muted">Detail-Chancen erfordern matchdetails-Pull pro Spiel (TODO).</div>
    `;
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.matches = render;
})();
