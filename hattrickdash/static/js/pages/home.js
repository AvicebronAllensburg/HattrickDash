/* Home - schnelle Übersichtsseite mit KPIs + Quick-Links zu allen Bereichen */
(function () {
  const F = window.HHFmt;

  async function render(root) {
    const [ov, fin, arena, squad, matches, finHistory] = await Promise.all([
      HHApi.teamOverview().catch(() => ({})),
      HHApi.financeLatest().catch(() => ({ current: {} })),
      HHApi.arenaLatest().catch(() => ({})),
      HHApi.squad().catch(() => []),
      HHApi.matches().catch(() => []),
      HHApi.financeHistory().catch(() => []),
    ]);

    let leagueTable = [];
    if (ov.league_id) {
      try { leagueTable = await HHApi.leagueTable(ov.league_id); } catch (_) {}
    }

    const cur = ov.current || {};
    const c = fin.current || {};
    const totalTSI = squad.reduce((s, p) => s + (p.tsi || 0), 0);
    const avgTSI = squad.length ? Math.round(totalTSI / squad.length) : 0;
    const avgForm = squad.length
      ? squad.reduce((s, p) => s + (p.skills?.skill_form || 0), 0) / squad.length
      : 0;
    const injured = squad.filter((p) => p.is_injured).length;

    const past = matches.filter((m) => m.result).slice(0, 3);
    const upcoming = matches.filter((m) => !m.result).slice(0, 3).reverse();
    const ownId = ov.team_id;

    const moodSpirit = F.moodEmoji(cur.team_spirit);
    const moodConf   = F.moodEmoji(cur.confidence);
    const moodFan    = F.moodEmoji(cur.fan_mood);

    root.innerHTML = `
      <div class="home-hero">
        <div>
          <div class="home-team-name">${F.escapeHtml(ov.name || 'HattrickDash')}</div>
          <div class="home-team-sub">
            ${F.escapeHtml(ov.country_name || '')} · Liga ${ov.league_level ?? '?'}
            · Stadion: ${F.escapeHtml(ov.arena_name || '–')}
            · Trainer: ${F.escapeHtml(ov.coach_name || '–')}
          </div>
        </div>
        <div class="home-hero-cta">
          <a href="#/team" class="btn primary" style="text-decoration:none">Zur Team-Übersicht →</a>
        </div>
      </div>

      <div class="home-kpi-grid">
        ${kpiCard('🏆', 'Mannschaft', `${squad.length} Spieler`, `Ø TSI ${F.num(avgTSI)} · Ø Form ${avgForm.toFixed(2)}`, '#22a722', '#/players')}
        ${kpiCard('💶', 'Cash', F.money(c.cash_balance), `Profit: ${F.money(c.profit)}`, c.profit >= 0 ? '#22a722' : '#cc4444', '#/finance')}
        ${kpiCard('🏟️', 'Stadion', F.num(arena.capacity_total), `Auslastung ${arena.usage_total_pct?.toFixed(1) ?? '?'}%`, '#4488cc', '#/arena')}
        ${kpiCard('🩹', 'Verletzt', `${injured}`, injured ? `${injured} Spieler im Lazarett` : 'Alle fit', injured ? '#cc4444' : '#22a722', '#/players')}
      </div>

      <div class="grid-2" style="margin-top:14px">
        <div class="card">
          <div class="card-header">😊 Stimmung &amp; Form</div>
          <div class="card-body">
            <div class="home-mood-grid">
              ${moodTile('Teamstimmung',    moodSpirit)}
              ${moodTile('Selbstvertrauen', moodConf)}
              ${moodTile('Fanstimmung',     moodFan)}
              ${kpiTile('Fans',            F.num(cur.fans))}
              ${kpiTile('Trainingstyp',    cur.training_type || '–')}
              ${kpiTile('Intensität',      `${cur.training_intensity ?? '–'}%`)}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">⚽ Letzte &amp; nächste Spiele</div>
          <div class="card-body">
            <div class="muted" style="font-size:11px;margin-bottom:4px">Bereits gespielt</div>
            <table class="tbl">
              <tbody>
                ${past.map((m) => matchRow(m, ownId, true)).join('') || '<tr><td class="muted">Noch keine Spiele</td></tr>'}
              </tbody>
            </table>
            <div class="muted" style="font-size:11px;margin:10px 0 4px 0">Die nächsten Spiele</div>
            <table class="tbl">
              <tbody>
                ${upcoming.map((m) => matchRow(m, ownId, false)).join('') || '<tr><td class="muted">Keine geplanten Spiele</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-header">
          <span>📊 Liga-Tabelle</span>
          <a href="#/team" class="muted" style="font-size:11px;text-decoration:underline">vollständig →</a>
        </div>
        <div class="card-body" id="home-league-body">Lade…</div>
      </div>
    `;

    renderHomeLeague(leagueTable, ownId);
  }

  function renderHomeLeague(table, ownId) {
    const target = document.getElementById('home-league-body');
    if (!target) return;
    if (!table.length) {
      target.innerHTML = `
        <div class="muted" style="font-size:12px;padding:6px 0">
          Liga-Tabelle braucht OAuth – <a href="#/admin" style="text-decoration:underline">im Admin einrichten</a>.
        </div>
      `;
      return;
    }
    const relegationAfterRank = Math.max(1, table.length - 2);
    target.innerHTML = `
      <table class="tbl" style="font-size:12px">
        <thead><tr>
          <th>#</th><th>Mannschaft</th><th class="right">Sp</th>
          <th class="right">±</th><th class="right">Pkt</th>
        </tr></thead>
        <tbody>
          ${table.map((t) => {
            const cls = [];
            if (t.team_id === ownId) cls.push('own-team');
            if (t.rank === relegationAfterRank) cls.push('relegation-line');
            return `
              <tr class="${cls.join(' ')}">
                <td>${t.rank}</td>
                <td>${F.escapeHtml(t.team_name)}</td>
                <td class="right">${t.matches ?? 0}</td>
                <td class="right">${t.goals_diff > 0 ? '+' + t.goals_diff : t.goals_diff}</td>
                <td class="right"><b>${t.points ?? 0}</b></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function kpiCard(icon, label, value, sub, color, href) {
    return `
      <a href="${href}" class="home-kpi" style="border-top:3px solid ${color}">
        <div class="home-kpi-icon">${icon}</div>
        <div class="home-kpi-label">${label}</div>
        <div class="home-kpi-value">${value}</div>
        <div class="home-kpi-sub">${sub}</div>
      </a>
    `;
  }

  function moodTile(label, mood) {
    return `
      <div class="home-mood-tile">
        <div class="muted" style="font-size:11px">${label}</div>
        <div style="font-size:24px">${mood.emoji}</div>
        <div style="font-size:11px;font-weight:600">${mood.label}</div>
      </div>
    `;
  }

  function kpiTile(label, value) {
    return `
      <div class="home-mood-tile">
        <div class="muted" style="font-size:11px">${label}</div>
        <div style="font-size:18px;font-weight:600;margin-top:6px">${value}</div>
      </div>
    `;
  }

  function matchRow(m, ownId, played) {
    const ownHome = m.home_team_id === ownId;
    const home = ownHome ? `<b>${F.escapeHtml(m.home_team_name)}</b>` : F.escapeHtml(m.home_team_name);
    const away = !ownHome ? `<b>${F.escapeHtml(m.away_team_name)}</b>` : F.escapeHtml(m.away_team_name);
    const score = played
      ? `${m.home_goals ?? '?'}:${m.away_goals ?? '?'} ${F.result(m.result)}`
      : '<span class="muted">–</span>';
    return `
      <tr>
        <td class="center" style="white-space:nowrap;font-size:14px">${F.matchTypeBadge(m.match_type)}</td>
        <td style="white-space:nowrap">${F.date(m.match_date).slice(0, 10)}</td>
        <td>${home} – ${away}</td>
        <td class="right" style="white-space:nowrap">${score}</td>
      </tr>
    `;
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.home = render;
})();
