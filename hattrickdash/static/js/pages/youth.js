/* Jugendmannschaft (v2) — 4 Sub-Tabs: Kader · Spiele · Training · Förder-Empfehlungen
 *
 * Nur in der Local-Version aktiv (CHPP-Endpoints youthteamdetails / youthplayerlist /
 * youthmatches / youthtraining). Bei leerer Datenlage zeigt jede Sektion einen
 * sinnvollen Hinweis — keine Fake-Werte, keine Schönrechnerei.
 */
(function () {
  const F = window.HHFmt;

  const SKILL_KEYS = [
    { key: 'keeper',    label: 'Torwart' },
    { key: 'defender',  label: 'Verteidigung' },
    { key: 'playmaker', label: 'Spielaufbau' },
    { key: 'winger',    label: 'Flügelspiel' },
    { key: 'passing',   label: 'Passspiel' },
    { key: 'scorer',    label: 'Torschuss' },
    { key: 'setpieces', label: 'Standards' },
  ];

  let activeTab = 'squad';

  async function render(root) {
    root.innerHTML = `
      <div class="card" id="youth-team-card">
        <div class="card-header">⚽ Jugendmannschaft</div>
        <div class="card-body" id="youth-team-body">
          <span class="muted">Lade…</span>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="tabs" data-tabs="youth">
          <button class="active" data-key="squad">Kader</button>
          <button data-key="matches">Spiele</button>
          <button data-key="training">Training</button>
          <button data-key="recs">Förder-Empfehlungen</button>
        </div>
        <div class="card-body" id="youth-content">
          <span class="muted">Lade…</span>
        </div>
      </div>
    `;

    // Header-Karte (Team-Stammdaten) laden
    renderTeamHeader();

    // Tab-Bindings
    const tabBar = root.querySelector('[data-tabs="youth"]');
    if (tabBar) {
      tabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-key]');
        if (!btn) return;
        Array.from(tabBar.children).forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.key;
        renderActive();
      });
    }
    renderActive();
  }

  // -------------------- Header --------------------

  async function renderTeamHeader() {
    const body = document.getElementById('youth-team-body');
    if (!body) return;
    let team = null;
    try { team = await HHApi.youthTeam(); } catch (_) { team = null; }
    if (!team || team.empty || !team.youth_team_id) {
      body.innerHTML = `
        <div class="muted">
          Noch keine Jugendmannschaft gefunden.
          Sobald in Hattrick eine Jugendmannschaft angemeldet ist und der nächste
          Daily-Job durchgelaufen ist (oder du in <a href="#/admin">Admin</a>
          manuell <code>youth_team</code> + <code>youth_players</code> pullst),
          erscheinen hier Stammdaten + Kader.
        </div>`;
      return;
    }
    const last = team.last_match_date ? F.date(team.last_match_date) : '—';
    const next = team.next_match_date ? F.date(team.next_match_date) : '—';
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        <div><div class="muted">Team</div><b>${F.escapeHtml(team.name || '—')}</b></div>
        <div><div class="muted">Liga</div><b>${F.escapeHtml(team.league_name || '—')}</b>
             ${team.league_level != null ? `<span class="muted">(L${team.league_level})</span>` : ''}</div>
        <div><div class="muted">Trainer</div>
             <b>${F.escapeHtml(team.coach_name || '—')}</b>
             ${team.coach_skill_name ? `<span class="muted">${F.escapeHtml(team.coach_skill_name)}</span>` : ''}</div>
        <div><div class="muted">Scouts</div><b>${team.scout_count ?? '—'}</b></div>
        <div><div class="muted">Letztes Spiel</div><b>${last}</b></div>
        <div><div class="muted">Nächstes Spiel</div><b>${next}</b></div>
      </div>
    `;
  }

  // -------------------- Tab-Routing --------------------

  function renderActive() {
    const c = document.getElementById('youth-content');
    if (!c) return;
    if (activeTab === 'squad')    return renderSquad(c);
    if (activeTab === 'matches')  return renderMatches(c);
    if (activeTab === 'training') return renderTraining(c);
    if (activeTab === 'recs')     return renderRecommendations(c);
  }

  // -------------------- Tab: Kader --------------------

  async function renderSquad(c) {
    c.innerHTML = '<span class="muted">Lade Kader…</span>';
    let data;
    try { data = await HHApi.youthSquad(); } catch (e) {
      c.innerHTML = `<div class="muted">Fehler: ${F.escapeHtml(e.message)}</div>`; return;
    }
    const players = data.players || [];
    if (!players.length) {
      c.innerHTML = `<div class="muted">Noch keine Jugendspieler. Sobald die
        Jugendmannschaft Spieler hat und der nächste Polling-Lauf durch ist,
        erscheinen sie hier.</div>`;
      return;
    }
    c.innerHTML = `
      <div style="overflow-x:auto">
        <table class="data-table" id="youth-squad-table">
          <thead><tr>
            <th>#</th><th>Name</th><th>Alter</th><th>Spez.</th>
            ${SKILL_KEYS.map(s => `<th title="${F.escapeHtml(s.label)}">${F.escapeHtml(s.label.slice(0,3))}</th>`).join('')}
            <th>Letztes Spiel</th>
          </tr></thead>
          <tbody>${players.map(rowSquad).join('')}</tbody>
        </table>
      </div>
      <div class="muted" style="margin-top:8px;font-size:11px">
        Format pro Skill: <b>aktuell / max</b> (gescoutet) — leeres Feld = Skill noch nicht gescoutet.
      </div>
    `;
  }

  function rowSquad(p) {
    const skillCells = SKILL_KEYS.map(s => {
      const sk = p.skills[s.key] || {};
      if (!sk.scouted && (sk.current ?? 0) === 0) {
        return `<td class="muted center">—</td>`;
      }
      const cur = sk.current ?? '?';
      const mx  = sk.max     ?? '?';
      const isFull = (sk.current && sk.max && sk.current >= sk.max - 1);
      return `<td class="center" style="${isFull ? 'background:#dff5d8;font-weight:700' : ''}">${cur}/${mx}</td>`;
    }).join('');
    const last = p.last_match_date ? F.date(p.last_match_date) : '—';
    return `<tr>
      <td>${p.player_number ?? ''}</td>
      <td><b>${F.escapeHtml(p.name)}</b></td>
      <td class="center">${F.escapeHtml(p.age_str || '—')}</td>
      <td class="muted">${F.escapeHtml(p.specialty_name || '')}</td>
      ${skillCells}
      <td class="muted">${F.escapeHtml(last)}${p.last_match_minutes ? ` · ${p.last_match_minutes}'` : ''}</td>
    </tr>`;
  }

  // -------------------- Tab: Spiele --------------------

  async function renderMatches(c) {
    c.innerHTML = '<span class="muted">Lade Spiele…</span>';
    let data;
    try { data = await HHApi.youthMatches(50); } catch (e) {
      c.innerHTML = `<div class="muted">Fehler: ${F.escapeHtml(e.message)}</div>`; return;
    }
    const matches = data.matches || [];
    if (!matches.length) {
      c.innerHTML = `<div class="muted">Noch keine Jugendspiele in der DB.</div>`;
      return;
    }
    c.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Datum</th><th>Typ</th><th>Heim</th><th class="center">Erg.</th>
          <th>Auswärts</th><th class="center">Saison/Sp.</th>
        </tr></thead>
        <tbody>
          ${matches.map(m => `<tr>
            <td>${F.escapeHtml(m.match_date ? F.date(m.match_date) : '—')}</td>
            <td class="muted">${F.escapeHtml(m.match_type || '')}</td>
            <td>${F.escapeHtml(m.home_team_name || '—')}</td>
            <td class="center"><b>${m.home_goals ?? '?'} : ${m.away_goals ?? '?'}</b></td>
            <td>${F.escapeHtml(m.away_team_name || '—')}</td>
            <td class="center muted">${m.season ?? '—'} / ${m.matchday ?? '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  // -------------------- Tab: Training --------------------

  async function renderTraining(c) {
    c.innerHTML = '<span class="muted">Lade Training…</span>';
    let data;
    try { data = await HHApi.youthTraining(50); } catch (e) {
      c.innerHTML = `<div class="muted">Fehler: ${F.escapeHtml(e.message)}</div>`; return;
    }
    const rows = data.training || [];
    if (!rows.length) {
      c.innerHTML = `<div class="muted">Noch keine Trainings-Einträge.</div>`;
      return;
    }
    c.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Saison</th><th>Woche</th><th>Datum</th>
          <th>Trainings-Typ</th><th>Match-Kind</th>
        </tr></thead>
        <tbody>
          ${rows.map(t => `<tr>
            <td class="center">${t.season ?? '—'}</td>
            <td class="center">${t.week_number ?? '—'}</td>
            <td>${F.escapeHtml(t.training_date || '—')}</td>
            <td><b>${F.escapeHtml(t.training_type || '—')}</b></td>
            <td class="muted">${F.escapeHtml(t.training_match_kind || '—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  // -------------------- Tab: Förder-Empfehlungen --------------------

  async function renderRecommendations(c) {
    c.innerHTML = '<span class="muted">Berechne Empfehlungen…</span>';
    let data;
    try { data = await HHApi.youthRecommendations(); } catch (e) {
      c.innerHTML = `<div class="muted">Fehler: ${F.escapeHtml(e.message)}</div>`; return;
    }
    const all = data.all || [];
    if (!all.length) {
      c.innerHTML = `<div class="muted">Noch keine Daten für Empfehlungen.</div>`;
      return;
    }
    const buckets = [
      { key: 'promote_now', label: '🟢 Sofort fördern',    list: data.promote_now || [] },
      { key: 'candidates',  label: '🟡 Förder-Kandidaten', list: data.candidates  || [] },
      { key: 'watch',       label: '⚪ Beobachten',         list: data.watch       || [] },
      { key: 'no',          label: '🔴 Nicht fördern',      list: data.no          || [] },
    ];
    c.innerHTML = `
      <div class="muted" style="font-size:12px;margin-bottom:12px">
        Bewertung pro Spieler (Score 0–100): basiert auf Alter, Anzahl voll
        trainierter Skills, Star-Skills (max ≥ 8) und Scout-Vollständigkeit.
        Hattrick erlaubt Förderung ab 17.0 Jahren.
      </div>
      ${buckets.map(b => `
        <div style="margin-bottom:18px">
          <h3 style="margin:6px 0">${b.label} <span class="muted" style="font-size:12px">(${b.list.length})</span></h3>
          ${b.list.length === 0
            ? '<div class="muted" style="font-size:12px">— keine —</div>'
            : `<table class="data-table">
                <thead><tr>
                  <th>Spieler</th><th>Alter</th><th class="center">Score</th>
                  <th class="center">Voll trainiert</th><th class="center">Gescoutet</th>
                  <th>Beste Position</th><th>Begründung</th>
                </tr></thead>
                <tbody>
                  ${b.list.map(r => `<tr>
                    <td><b>${F.escapeHtml(r.name)}</b></td>
                    <td class="center">${F.escapeHtml(r.age_str)}</td>
                    <td class="center"><b>${r.score}</b></td>
                    <td class="center">${r.fully_trained_count} / ${SKILL_KEYS.length}</td>
                    <td class="center">${r.scouted_count} / ${SKILL_KEYS.length}</td>
                    <td>${F.escapeHtml(skillLabel(r.best_position_skill))} <span class="muted">(max ${r.star_skill_max})</span></td>
                    <td class="muted" style="font-size:11px">${(r.reasons || []).map(F.escapeHtml).join(' · ')}</td>
                  </tr>`).join('')}
                </tbody>
              </table>`}
        </div>
      `).join('')}
    `;
  }

  function skillLabel(key) {
    const found = SKILL_KEYS.find(s => s.key === key);
    return found ? found.label : key;
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.youth = render;
})();
