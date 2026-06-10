/* Seite 1: Team-Übersicht – 2 Spalten, je 2 Karten mit Tab-Wechsel */
(function () {
  const F = window.HHFmt;

  async function render(root) {
    const [overview, staff, matches] = await Promise.all([
      HHApi.teamOverview().catch(() => ({})),
      HHApi.teamStaff().catch(() => []),
      HHApi.matches({ match_type: 'LEAGUE' }).catch(() => []),
    ]);

    let leagueTable = [];
    if (overview.league_id) {
      try { leagueTable = await HHApi.leagueTable(overview.league_id); } catch (_) {}
    }

    let finance = {};
    try { finance = await HHApi.financeLatest(); } catch (_) {}

    let arena = {};
    try { arena = await HHApi.arenaLatest(); } catch (_) {}

    root.innerHTML = `
      <div class="grid-2">
        <div class="col">
          <div class="card" id="card-table">
            <div class="card-header">
              <div class="tabs" data-tabs="table">
                <button class="active" data-key="total">Total</button>
                <button data-key="home">Heimspiele</button>
                <button data-key="away">Auswärtsspiele</button>
              </div>
            </div>
            <div class="card-body" id="league-table-body"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="tabs" data-tabs="details">
                <button class="active" data-key="details">Einzelheiten</button>
                <button data-key="staff">Trainerstab</button>
              </div>
            </div>
            <div class="card-body" id="details-body"></div>
          </div>
        </div>

        <div class="col">
          <div class="card">
            <div class="card-header">
              <div class="tabs" data-tabs="schedule">
                <button class="active" data-key="schedule">Spielplan</button>
                <button data-key="league">Liga</button>
                <button data-key="scorers">Torschützenliste</button>
              </div>
            </div>
            <div class="card-body" id="schedule-body"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="tabs" data-tabs="profit">
                <button class="active" data-key="profit">Erfolgsrechnung</button>
                <button data-key="arena">Stadion</button>
                <button data-key="value">Mannschaftswert</button>
              </div>
            </div>
            <div class="card-body" id="profit-body"></div>
          </div>
        </div>
      </div>
    `;

    bindTabs(root, 'table', (key) => renderLeagueTable(key, overview, leagueTable));
    bindTabs(root, 'details', (key) => key === 'details' ? renderDetails(overview) : renderStaff(staff, overview));
    bindTabs(root, 'schedule', (key) => renderScheduleTab(key, matches, leagueTable, overview));
    bindTabs(root, 'profit', (key) => renderProfitTab(key, finance, arena));

    renderLeagueTable('total', overview, leagueTable);
    renderDetails(overview);
    renderScheduleTab('schedule', matches, leagueTable);
    renderProfitTab('profit', finance, arena);
  }

  function bindTabs(root, group, handler) {
    root.querySelectorAll(`.tabs[data-tabs="${group}"] button`).forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll(`.tabs[data-tabs="${group}"] button`).forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        handler(b.dataset.key);
      });
    });
  }

  function renderLeagueTable(key, overview, table) {
    const target = document.getElementById('league-table-body');
    if (!table.length) {
      target.innerHTML = `
        <div style="padding:10px;background:#fff8e1;border:1px solid #f0d68a;border-radius:6px">
          <b>Liga-Tabelle nicht verfügbar.</b>
          <p class="muted" style="margin:6px 0">
            HRF-Snapshots enthalten nur dein eigenes Team. Die Tabelle aller 8 Mannschaften
            kommt über die Live-CHPP-API – dafür musst du dich einmalig authentifizieren.
          </p>
          <a href="#/admin" class="btn primary" style="display:inline-block;text-decoration:none">⚙ Zum Admin-Tab → OAuth einrichten</a>
        </div>
      `;
      return;
    }
    const ownId = overview.team_id;
    // Abstiegsgrenze: in Hattrick liegt sie zwischen den letzten 2 Plätzen.
    // Wir markieren die Linie zwischen Platz (n-2) und (n-1), bei 8 Teams also nach Rang 6.
    const relegationAfterRank = Math.max(1, table.length - 2);
    const rows = table.map((t) => {
      const cls = [];
      if (t.team_id === ownId) cls.push('own-team');
      if (t.rank === relegationAfterRank) cls.push('relegation-line');
      // Trend-Indikator (kleines Quadrat) - bei W/L/D des letzten Spiels.
      // Da wir die Info nicht haben, nehmen wir den Goal-Diff als Proxy.
      const diff = t.goals_diff ?? 0;
      const trendColor = diff > 0 ? '#22a722' : (diff < 0 ? '#cc2222' : '#999');
      return `
        <tr class="${cls.join(' ')}">
          <td>${t.rank}</td>
          <td>${F.escapeHtml(t.team_name)}</td>
          <td>${t.matches ?? 0}</td>
          <td>${t.wins ?? 0}</td>
          <td>${t.draws ?? 0}</td>
          <td>${t.losses ?? 0}</td>
          <td>${t.goals_for ?? 0}</td>
          <td>${t.goals_against ?? 0}</td>
          <td>${t.goals_diff > 0 ? '+' + t.goals_diff : t.goals_diff}</td>
          <td><b>${t.points ?? 0}</b></td>
          <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${trendColor};vertical-align:middle"></span></td>
        </tr>
      `;
    }).join('');
    const subText = ({ total: 'Total', home: 'Heimspiele', away: 'Auswärtsspiele' })[key] || key;
    target.innerHTML = `
      <table class="tbl">
        <thead><tr>
          <th>#</th><th>Mannschaft</th><th>Sp</th><th>S</th><th>U</th><th>N</th>
          <th>T+</th><th>T-</th><th>±</th><th>Pkt</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="muted" style="margin-top:6px;font-size:11px;">
        Liga ${overview.league_level ?? '?'} · ${subText} ·
        <span style="display:inline-block;width:8px;height:8px;background:var(--negative);border-radius:1px;vertical-align:middle"></span>
        Linie = Abstiegszone
      </div>
    `;
  }

  function renderDetails(overview) {
    const d = overview.deltas || {};
    const c = overview.current || {};
    const target = document.getElementById('details-body');

    // Reihen mit Smiley + Wert + Trend
    const moodRow = (label, valueKey, deltaKey, asMood = true) => {
      const val = c[valueKey];
      const dv = d[deltaKey];
      if (asMood) {
        const m = F.moodEmoji(val);
        return `
          <div class="kv-row">
            <span class="k">${label}</span>
            <span class="v">
              <span class="mood-emoji">${m.emoji}</span>
              <span class="mood-label">${m.label}</span>
              ${F.trendArrow(dv)}
            </span>
          </div>
        `;
      }
      return `
        <div class="kv-row">
          <span class="k">${label}</span>
          <span class="v">${val == null ? '–' : F.num(val)} ${F.trendArrow(dv)}</span>
        </div>
      `;
    };

    target.innerHTML = `
      <div class="detail-grid">
        ${moodRow('Teamstimmung',     'team_spirit',  'team_spirit')}
        ${moodRow('Selbstvertrauen',  'confidence',   'confidence')}
        ${moodRow('Fanstimmung',      'fan_mood',     'fan_mood')}
        ${moodRow('Sponsoren',        'sponsors',     'sponsors')}
        ${moodRow('Fans',             'fans',         'fans',     false)}
        ${moodRow('Jugendmannschaft', 'youth_squad_level', null,  false)}
      </div>
      <hr style="border:0;border-top:1px solid var(--border);margin:8px 0;">
      <div class="kv-grid">
        <span class="k">Trainer</span><span class="v">${F.escapeHtml(overview.coach_name || '–')}</span>
        <span class="k">Können</span><span class="v">${overview.coach_skill ?? '–'}</span>
        <span class="k">Führung</span><span class="v">${overview.coach_leadership ?? '–'}</span>
        <span class="k">Trainingstyp</span><span class="v">${F.escapeHtml(c.training_type || '–')}</span>
        <span class="k">Trainingsintensität</span><span class="v">${c.training_intensity ?? '–'}%</span>
        <span class="k">Konditionsanteil</span><span class="v">${c.stamina_share ?? '–'}%</span>
      </div>
    `;
  }

  function renderStaff(staff, overview) {
    const target = document.getElementById('details-body');

    // Vollständige Liste mit allen 7 Rollen, auch wenn N=0
    const ROLES = [
      ['GoalkeeperCoach',  'Torwarttrainer'],
      ['AssistantCoach',   'Co-Trainer'],
      ['Psychologist',     'Psychologen'],
      ['PressOfficer',     'PR-Manager'],
      ['FinancialDirector','Finanzberater'],
      ['Physiotherapist',  'Physiotherapeuten'],
      ['Doctor',           'Ärzte'],
    ];
    const byRole = {};
    let injured = 0;
    for (const s of staff || []) {
      // gleiche Rolle eventuell mehrfach (mehrere Trainer): summieren
      if (!byRole[s.role]) byRole[s.role] = { count: 0, total_cost: 0, level: 0 };
      byRole[s.role].count++;
      byRole[s.role].total_cost += (s.salary || 0);
      byRole[s.role].level = Math.max(byRole[s.role].level, s.skill_level || 0);
    }
    const c = (overview && overview.current) || {};
    const sideInfo = {
      Psychologist:    `(Selbstvertrauen: ${c.confidence ?? '–'})`,
      Physiotherapist: `(Training: ${c.training_intensity ?? '–'}%)`,
      Doctor:          `(Verletzt: ${injured})`,  // TODO: aus aktuellem Player-Snapshot
    };

    let total = 0;
    target.innerHTML = `
      <table class="tbl">
        <thead><tr>
          <th>Rolle</th>
          <th class="right">N</th>
          <th class="right">Kosten</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${ROLES.map(([key, label]) => {
            const r = byRole[key] || { count: 0, total_cost: 0 };
            total += r.total_cost;
            const cost = r.count > 0 ? F.money(r.total_cost) : '€ 0';
            return `
              <tr ${r.count === 0 ? 'class="muted"' : ''}>
                <td>${label}</td>
                <td class="right">${r.count}</td>
                <td class="right">${cost}</td>
                <td class="muted" style="font-size:11px">${sideInfo[key] || ''}</td>
              </tr>
            `;
          }).join('')}
          <tr style="font-weight:700;border-top:2px solid var(--border)">
            <td>Total</td>
            <td class="right">${staff.length}</td>
            <td class="right">${F.money(total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  function renderScheduleTab(key, matches, leagueTable, overview) {
    const ov = overview || {};
    const target = document.getElementById('schedule-body');
    if (key === 'schedule') {
      const past = matches.filter((m) => m.result).slice(0, 6);
      const upcoming = matches.filter((m) => !m.result).slice(0, 6).reverse();
      target.innerHTML = `
        <div class="section-title">Bereits gespielt</div>
        <table class="tbl"><tbody>
          ${past.map((m) => `
            <tr>
              <td class="center" style="font-size:14px">${F.matchTypeBadge(m.match_type)}</td>
              <td>${F.date(m.match_date)}</td>
              <td>${F.escapeHtml(m.home_team_name)} – ${F.escapeHtml(m.away_team_name)}</td>
              <td>${m.home_goals ?? '?'}:${m.away_goals ?? '?'}</td>
              <td>${F.result(m.result)}</td>
            </tr>
          `).join('') || `<tr><td class="muted">Noch keine Spiele.</td></tr>`}
        </tbody></table>

        <div class="section-title">Die nächsten Spiele</div>
        <table class="tbl"><tbody>
          ${upcoming.map((m) => `
            <tr>
              <td class="center" style="font-size:14px">${F.matchTypeBadge(m.match_type)}</td>
              <td>${F.date(m.match_date)}</td>
              <td>${F.escapeHtml(m.home_team_name)} – ${F.escapeHtml(m.away_team_name)}</td>
              <td class="muted">–</td>
            </tr>
          `).join('') || `<tr><td class="muted">Keine geplanten Spiele.</td></tr>`}
        </tbody></table>
      `;
    } else if (key === 'league') {
      renderLeagueSchedule(target, matches, ov);
    } else {
      renderScorerList(target, ov);
    }
  }

  function renderLeagueSchedule(target, matches, overview) {
    // Liga-Spielplan gruppiert nach Spieltag
    const leagueOnly = matches.filter((m) => m.match_type === 'LEAGUE');
    if (!leagueOnly.length) {
      target.innerHTML = `
        <div style="padding:10px;background:#fff8e1;border:1px solid #f0d68a;border-radius:6px">
          <b>Liga-Spielplan benötigt CHPP-Daten.</b>
          <p class="muted" style="margin:6px 0">
            Diese Ansicht zeigt alle Paarungen pro Spieltag. Dafür braucht es matchlist + leaguedetails von Hattrick.
          </p>
          <a href="#/admin" class="btn primary" style="display:inline-block;text-decoration:none">⚙ OAuth einrichten</a>
        </div>
      `;
      return;
    }
    // Nach Spieltag gruppieren
    const byDay = {};
    for (const m of leagueOnly) {
      const day = m.matchday || '?';
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(m);
    }
    const ownId = (overview && overview.team_id) || 0;
    target.innerHTML = Object.keys(byDay).sort((a, b) => a - b).map((day) => `
      <div style="margin-bottom:10px">
        <div style="font-weight:700;background:var(--table-head);padding:4px 8px;border-radius:3px">
          ${day}. Spieltag
        </div>
        <table class="tbl" style="width:100%"><tbody>
          ${byDay[day].map((m) => {
            const ownInvolved = m.home_team_id === ownId || m.away_team_id === ownId;
            const cls = ownInvolved ? 'style="font-weight:700"' : '';
            return `
              <tr ${cls}>
                <td>${F.date(m.match_date).slice(0, 10)}</td>
                <td class="right">${F.escapeHtml(m.home_team_name)}</td>
                <td class="center" style="width:60px">${m.home_goals ?? '–'} : ${m.away_goals ?? '–'}</td>
                <td>${F.escapeHtml(m.away_team_name)}</td>
              </tr>
            `;
          }).join('')}
        </tbody></table>
      </div>
    `).join('');
  }

  async function renderScorerList(target, overview) {
    // Aus aktuellem Kader: Top-Stürmer (Heuristik wenn keine echten Tor-Daten da)
    target.innerHTML = `<div class="muted">Lade Torschützen-Approximation aus Kader…</div>`;
    try {
      const squad = await HHApi.squad();
      const scorers = squad
        .filter((p) => (p.skills?.skill_scoring || 0) >= 5)
        .sort((a, b) => (b.skills.skill_scoring || 0) - (a.skills.skill_scoring || 0))
        .slice(0, 16);
      if (!scorers.length) {
        target.innerHTML = '<div class="muted">Keine Torschützen-Daten verfügbar.</div>';
        return;
      }
      // 2-spaltig
      const half = Math.ceil(scorers.length / 2);
      const left = scorers.slice(0, half);
      const right = scorers.slice(half);
      const ownId = overview.team_id;
      const row = (s, rank) => `
        <tr style="${s.team_id === ownId ? 'font-weight:700' : ''}">
          <td>${rank}.</td>
          <td>${F.escapeHtml(s.name)}</td>
          <td class="muted">${F.escapeHtml(overview.short_name || overview.name || '')}</td>
          <td class="right"><b>${s.skills.skill_scoring}</b></td>
        </tr>
      `;
      target.innerHTML = `
        <div class="muted" style="margin-bottom:6px;font-size:11px">
          Approximation aus Torschuss-Skill (echte Torzahlen brauchen matchdetails-Pull).
        </div>
        <div class="grid-2">
          <table class="tbl"><tbody>${left.map((s, i) => row(s, i + 1)).join('')}</tbody></table>
          <table class="tbl"><tbody>${right.map((s, i) => row(s, i + half + 1)).join('')}</tbody></table>
        </div>
      `;
    } catch (e) {
      target.innerHTML = `<div class="muted">Fehler: ${e.message}</div>`;
    }
  }

  function renderProfitTab(key, finance, arena) {
    const target = document.getElementById('profit-body');
    if (key === 'profit') renderProfit(target, finance);
    if (key === 'arena')  renderArena(target, arena);
    if (key === 'value')  renderValue(target);
  }

  function renderProfit(target, fin) {
    const c = fin.current || {};
    const d = fin.deltas || {};
    if (!c.income) {
      target.innerHTML = `<div class="muted">Keine Finanzdaten.</div>`;
      return;
    }
    // Bei Ausgaben: positiver Delta = MEHR Kosten = NEGATIV (rot)
    // Wir zeigen Trend invertiert mit Comment "höhere Kosten"
    const incomeRow = (label, val, dv, bold = false) => `
      <div class="kv-row">
        <span class="k${bold ? '' : ''}">${bold ? '<b>' + label + '</b>' : label}</span>
        <span class="v">${bold ? '<b>' + F.money(val) + '</b>' : F.money(val)} ${F.trendArrow(dv)}</span>
      </div>
    `;
    const costRow = (label, val, dv, bold = false) => `
      <div class="kv-row">
        <span class="k">${bold ? '<b>' + label + '</b>' : label}</span>
        <span class="v">${bold ? '<b>' + F.money(val) + '</b>' : F.money(val)} ${F.trendArrow(dv == null ? null : -dv)}</span>
      </div>
    `;
    target.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="section-title">Einnahmen</div>
          ${incomeRow('Zuschauer',  c.income.supporters, d.income_supporters)}
          ${incomeRow('Sponsoren',  c.income.sponsors,   d.income_sponsors)}
          ${incomeRow('Zinsen',     c.income.interest,   d.income_interest)}
          ${incomeRow('Sonstiges',  c.income.other,      d.income_other)}
          ${incomeRow('Gesamt',     c.income.total,      d.income_total, true)}
        </div>
        <div>
          <div class="section-title">Ausgaben</div>
          ${costRow('Stadion',         c.costs.arena,       d.costs_arena)}
          ${costRow('Spielergehälter', c.costs.wages,       d.costs_wages)}
          ${costRow('Zinsen',          c.costs.interest,    d.costs_interest)}
          ${costRow('Spezialisten',    c.costs.specialists, d.costs_specialists)}
          ${costRow('Jugend',          c.costs.youth,       d.costs_youth)}
          ${costRow('Sonstiges',       c.costs.other,       d.costs_other)}
          ${costRow('Gesamt',          c.costs.total,       d.costs_total, true)}
        </div>
      </div>
      <hr style="border:0;border-top:1px solid var(--border);margin:8px 0;">
      <div class="grid-2">
        <div class="kv-row">
          <span class="k"><b>Gewinn / Verlust</b></span>
          <span class="v ${c.profit >= 0 ? 'delta-up' : 'delta-down'}"><b>${F.money(c.profit)}</b></span>
        </div>
        <div class="kv-row">
          <span class="k"><b>Bargeld</b></span>
          <span class="v"><b>${F.money(c.cash_balance)}</b></span>
        </div>
        <div class="kv-row">
          <span class="k">Bargeld nächste Woche</span>
          <span class="v">${F.money(c.cash_next_week)} ${F.trendArrow(d.cash_next_week)}</span>
        </div>
      </div>
    `;
  }

  function renderArena(target, arena) {
    if (!arena.blocks) {
      target.innerHTML = `<div class="muted">Keine Stadion-Daten.</div>`;
      return;
    }
    const rows = arena.blocks.map((b) => `
      <tr>
        <td>${labelFor(b.name)}</td>
        <td class="right">${F.num(b.capacity)}</td>
        <td class="right">${b.ratio_pct.toFixed(2)}%</td>
        <td class="right">${F.num(b.attendance)}</td>
        <td class="right">${b.usage_pct.toFixed(1)}%</td>
      </tr>
    `).join('');
    target.innerHTML = `
      <div class="section-title">${F.escapeHtml(arena.arena_name || 'Stadion')}</div>
      <table class="tbl">
        <thead><tr><th>Block</th><th class="right">Kap</th><th class="right">Anteil</th><th class="right">Zuschauer</th><th class="right">Auslastung</th></tr></thead>
        <tbody>
          ${rows}
          <tr style="font-weight:700"><td>Total</td><td class="right">${F.num(arena.capacity_total)}</td><td class="right">100%</td><td class="right">${F.num(arena.attendance_total)}</td><td class="right">${arena.usage_total_pct?.toFixed(1)}%</td></tr>
        </tbody>
      </table>
      <div class="muted" style="margin-top:6px">Einnahmen letzte Heimpartie: ${F.money(arena.income_actual)} (max. ${F.money(arena.income_capacity)})</div>
    `;
  }

  function labelFor(name) {
    return ({ terraces: 'Stehplätze', seating: 'Sitzplätze', seating_roof: 'überd. Sitzplätze', vip: 'VIP Logen' })[name] || name;
  }

  function renderValue(target) {
    HHApi.squad().then((squad) => {
      const totalTSI = squad.reduce((s, p) => s + (p.tsi || 0), 0);
      const avgTSI = squad.length ? totalTSI / squad.length : 0;
      const avgForm = squad.length ? squad.reduce((s, p) => s + (p.skills.skill_form || 0), 0) / squad.length : 0;
      target.innerHTML = `
        <div class="kv-grid">
          <span class="k">TSI total</span><span class="v">${F.num(totalTSI)}</span>
          <span class="k">Ø TSI</span><span class="v">${F.num(avgTSI)}</span>
          <span class="k">Ø Form</span><span class="v">${avgForm.toFixed(2)}</span>
          <span class="k">Spieleranzahl</span><span class="v">${squad.length}</span>
        </div>
        <div class="muted" style="margin-top:6px">Wochengewinner/-verlierer benötigen ältere Snapshots.</div>
      `;
    });
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.team = render;
})();
