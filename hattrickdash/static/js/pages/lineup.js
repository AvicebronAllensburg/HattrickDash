/* Seite 4: Aufstellung – Pitch + 5 Sub-Seiten */
(function () {
  const F = window.HHFmt;
  let currentFormation = '442';
  let currentLineup = null;
  let activeSub = 'assistant';

  async function render(root) {
    const formations = await HHApi.formations();
    if (!formations.includes(currentFormation)) currentFormation = formations[0];

    root.innerHTML = `
      <div class="lineup-top-row">
        <div class="card lineup-pitch-card">
          <div class="pitch-wrap">
            <canvas id="pitch" width="1000" height="700"></canvas>
          </div>
        </div>
        <div class="lineup-side-col">
          <div class="card">
            <div class="card-header">📊 Team-Stats</div>
            <div class="card-body" id="team-stats-body">Lade…</div>
          </div>
          <div class="card">
            <div class="card-header">⚔ Nächster Gegner</div>
            <div class="card-body" id="next-opponent-body">Lade…</div>
          </div>
          <div class="card">
            <div class="card-header">
              <span>🔍 Vermutliche Gegner-Aufstellung</span>
              <button id="btn-pull-opponent" title="matchdetails+matchlineup für Gegner-History pullen" style="font-size:11px">↻ Pull</button>
            </div>
            <div class="card-body" id="opponent-lineup-body">Lade…</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="subnav">
          <button data-sub="team">👤 Team</button>
          <button data-sub="assistant" class="active">📋 Aufstellungsassistent</button>
          <button data-sub="tactics">⚡ Taktische Einzelheiten</button>
          <button data-sub="weather">🌤 Wetter</button>
          <button data-sub="saved">💾 Speichern/Laden</button>
          <button data-sub="submit">⚽ An Hattrick senden</button>
        </div>
        <div class="card-body" id="sub-content"></div>
      </div>
    `;
    loadOpponentInfo();
    loadOpponentLineup();
    document.getElementById('btn-pull-opponent')?.addEventListener('click', pullOpponent);

    root.querySelectorAll('.subnav button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('.subnav button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        activeSub = b.dataset.sub;
        renderSub(formations);
      });
    });

    // Erstes Auto-Lineup
    await loadAuto();
    renderSub(formations);
  }

  async function loadAuto(opts = {}) {
    currentLineup = await HHApi.autoLineup({
      formation: currentFormation,
      allow_injured: opts.allow_injured ? 'true' : 'false',
      allow_suspended: opts.allow_suspended ? 'true' : 'false',
    });
    drawPitch();
  }

  function drawPitch() {
    if (!currentLineup) return;
    const canvas = document.getElementById('pitch');
    HHPitch.render(canvas, currentLineup.lineup);
    HHPitch.attachResizeRedraw(canvas, () => currentLineup ? currentLineup.lineup : []);
    renderTeamStatsCard();
  }

  function renderTeamStatsCard() {
    if (!currentLineup) return;
    const tr = currentLineup.team_rating;
    const target = document.getElementById('team-stats-body');
    if (!target) return;
    const bar = (label, value, color) => {
      const w = Math.min(100, Math.max(0, (value || 0) * 5));
      return `
        <div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span class="muted">${label}</span>
            <span><b>${(value || 0).toFixed(2)}</b></span>
          </div>
          <div class="kpi-bar"><i style="width:${w}%;background:${color}"></i></div>
        </div>
      `;
    };
    target.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div style="background:#eef3f9;border-radius:6px;padding:8px;text-align:center">
          <div class="muted" style="font-size:11px">Loddar Stats</div>
          <div style="font-size:22px;font-weight:700;color:#2d6cdf">${tr.loddar}</div>
        </div>
        <div style="background:#fff7e0;border-radius:6px;padding:8px;text-align:center">
          <div class="muted" style="font-size:11px">HatStats</div>
          <div style="font-size:22px;font-weight:700;color:#cc7a00">${tr.hatstats}</div>
        </div>
      </div>
      ${bar('Mittelfeld',    tr.midfield, '#22a722')}
      ${bar('Angriff (Ø)',   tr.attack,   '#cc4444')}
      ${bar('Verteidigung',  tr.defense,  '#4488cc')}
      <div class="muted" style="font-size:11px;margin-top:6px">
        Formation <b>${currentFormation}</b> · ${currentLineup.lineup.length} Feldspieler
      </div>
    `;
  }

  let lastOpponentId = null;

  async function loadOpponentLineup() {
    const target = document.getElementById('opponent-lineup-body');
    if (!target) return;
    target.innerHTML = '<div class="muted" style="font-size:11px">Lade…</div>';
    try {
      const data = await HHApi.predictOpponentLineup();
      lastOpponentId = data.opponent_id || null;
      if (!data.available) {
        target.innerHTML = `
          <div style="font-size:12px;color:var(--text-soft);margin-bottom:6px">
            ${F.escapeHtml(data.reason || 'Keine Daten verfügbar.')}
          </div>
          ${data.matches_found ? `
            <div class="muted" style="font-size:11px">
              ${data.matches_found.length} Matches in DB, aber keine Lineups.
              Klick auf <b>↻ Pull</b> oben, um sie zu laden.
            </div>
          ` : ''}
        `;
        return;
      }
      const tactic = data.tactic_distribution[0]
        ? `${data.tactic_distribution[0].tactic} (${data.tactic_distribution[0].count}/${data.matches_analyzed.length})`
        : '–';
      target.innerHTML = `
        <div style="font-size:12px;color:var(--text-soft);margin-bottom:6px">
          Aus den letzten <b>${data.matches_analyzed.length}</b> ${data.looking_at}-Spielen ·
          Häufigste Taktik: <b>${F.escapeHtml(tactic)}</b>
        </div>

        <table class="tbl" style="font-size:11px">
          <thead><tr><th>Pos</th><th>Spieler</th><th class="right">N</th><th class="right">Ø Note</th></tr></thead>
          <tbody>
            ${data.predicted_lineup.map((p) => `
              <tr>
                <td>${F.escapeHtml(rolePos(p.role))}</td>
                <td><b>${F.escapeHtml(p.name || ('#' + p.player_id))}</b></td>
                <td class="right">${p.appearances}</td>
                <td class="right">${p.avg_rating ?? '–'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="muted" style="font-size:10px;margin-top:6px">
          Analysierte Matches: ${data.matches_analyzed.map((m) => `${F.date(m.match_date).slice(0, 10)} (${m.result})`).join(' · ')}
        </div>
      `;
    } catch (e) {
      target.innerHTML = `<div class="muted" style="font-size:11px">Fehler: ${F.escapeHtml(e.message)}</div>`;
    }
  }

  function rolePos(role) {
    if (!role) return '?';
    const r = role.toLowerCase();
    if (r === 'keeper' || r.startsWith('keep')) return 'G';
    if (r.includes('cb')) return 'DC';
    if (r === 'rb' || r === 'lb' || r.includes('wb')) return 'DW';
    if (r === 'rw' || r === 'lw') return 'W';
    if (r.includes('cm') || r.includes('im')) return 'M';
    if (r.includes('cf')) return 'F';
    return role.slice(0, 4);
  }

  async function pullOpponent() {
    const btn = document.getElementById('btn-pull-opponent');
    const target = document.getElementById('opponent-lineup-body');
    if (!btn) return;

    // Wenn wir noch keine opponent_id haben, ausm Next-Opponent holen
    let oppId = lastOpponentId;
    if (!oppId) {
      try {
        const info = await HHApi.nextOpponent();
        if (info.available) oppId = info.opponent.team_id;
      } catch (_) {}
    }
    if (!oppId) {
      alert('Keine Gegner-ID bekannt – bitte erst matchlist pullen.');
      return;
    }
    btn.disabled = true;
    btn.textContent = '⌛ pulling…';
    target.innerHTML = `<div class="muted" style="font-size:11px">Lade ${5} letzte Spiele des Gegners (CHPP, mit 5s-Rate-Limit – kann ~30s dauern)…</div>`;
    try {
      const r = await HHApi.adminPullOpponent(oppId, 5);
      target.innerHTML = `<div class="muted" style="font-size:11px">✓ ${r.pulled?.length || 0} Matches geladen. Werte werden ausgewertet…</div>`;
      await loadOpponentLineup();
    } catch (e) {
      target.innerHTML = `<div style="color:var(--negative);font-size:11px">${F.escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '↻ Pull';
    }
  }

  async function loadOpponentInfo() {
    const target = document.getElementById('next-opponent-body');
    if (!target) return;
    try {
      const data = await HHApi.nextOpponent();
      if (!data.available) {
        target.innerHTML = `
          <div class="muted" style="font-size:12px">
            Kein nächstes Spiel in der DB.<br>
            ${F.escapeHtml(data.reason || '')}
          </div>
          <a href="#/admin" class="btn primary" style="display:inline-block;margin-top:8px;text-decoration:none;font-size:11px">⚙ matchlist pullen</a>
        `;
        return;
      }
      const nm = data.next_match;
      const opp = data.opponent;
      const h = data.h2h;
      const matchTypeLabel = F.matchTypeFull(nm.match_type);
      const venue = nm.is_home ? '🏠 Heim' : '✈ Auswärts';
      target.innerHTML = `
        <div style="font-weight:700;font-size:14px;margin-bottom:2px">
          ${F.escapeHtml(opp.team_name || `Team #${opp.team_id}`)}
        </div>
        <div class="muted" style="font-size:11px;margin-bottom:8px">
          ${F.date(nm.match_date)} · ${matchTypeLabel} · ${venue}
        </div>

        ${h.matches > 0 ? `
          <div style="background:#f7f9fb;border-radius:6px;padding:6px;margin-bottom:8px">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;text-align:center">
              <div>
                <div style="font-size:11px;color:#22a722">Siege</div>
                <div style="font-size:18px;font-weight:700">${h.wins}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#999">Remis</div>
                <div style="font-size:18px;font-weight:700">${h.draws}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#cc4444">Niederl.</div>
                <div style="font-size:18px;font-weight:700">${h.losses}</div>
              </div>
            </div>
            <div style="text-align:center;font-size:12px;margin-top:4px;color:var(--text-soft)">
              ${h.matches} Begegnungen · Tore <b>${h.goals_for} : ${h.goals_against}</b>
            </div>
          </div>
        ` : `
          <div class="muted" style="font-size:11px;margin-bottom:8px">
            Keine bisherigen Begegnungen in der DB.
          </div>
        `}

        ${h.last_results.length ? `
          <div style="font-size:11px;color:var(--text-soft);margin-bottom:4px">Letzte Begegnungen:</div>
          <div style="display:flex;flex-direction:column;gap:3px">
            ${h.last_results.map((r) => `
              <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 6px;background:#f7f9fb;border-radius:3px">
                <span>${F.matchTypeBadge(r.match_type)} ${F.date(r.date).slice(0, 10)}</span>
                <span><b>${r.own_goals}:${r.opp_goals}</b></span>
                <span class="${r.result === 'W' ? 'win' : r.result === 'L' ? 'loss' : 'draw'}">${F.result(r.result)}</span>
                <span class="muted">${r.is_home ? '🏠' : '✈'}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
    } catch (e) {
      target.innerHTML = `<div class="muted" style="font-size:11px">Fehler: ${F.escapeHtml(e.message)}</div>`;
    }
  }

  function renderSub(formations) {
    const target = document.getElementById('sub-content');
    if (activeSub === 'assistant') target.innerHTML = assistantHtml(formations);
    if (activeSub === 'team')      target.innerHTML = teamHtml();
    if (activeSub === 'tactics')   target.innerHTML = tacticsHtml();
    if (activeSub === 'weather')   target.innerHTML = `<div class="muted">Wetter-Anzeige benötigt matchdetails-Wetter-Feld pro nächstem Spiel (TODO).</div>`;
    if (activeSub === 'saved')     savedHtml(target);
    if (activeSub === 'submit')    submitHtml(target);

    if (activeSub === 'assistant') {
      target.querySelectorAll('.formation-tabs button').forEach((b) => {
        b.addEventListener('click', async () => {
          currentFormation = b.dataset.f;
          await loadAuto({
            allow_injured: document.getElementById('opt-injured')?.checked,
            allow_suspended: document.getElementById('opt-suspended')?.checked,
          });
          renderSub(formations);
        });
      });
      ['opt-injured', 'opt-suspended'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', async () => {
          await loadAuto({
            allow_injured: document.getElementById('opt-injured').checked,
            allow_suspended: document.getElementById('opt-suspended').checked,
          });
        });
      });
    }
  }

  function assistantHtml(formations) {
    const tabs = formations.map((f) => `
      <button data-f="${f}" class="${f === currentFormation ? 'active' : ''}">${f}</button>
    `).join('');
    const lineup = currentLineup ? currentLineup.lineup : [];
    return `
      <div class="formation-tabs">${tabs}</div>
      <div style="margin:10px 0;display:flex;gap:14px;flex-wrap:wrap">
        <label><input type="checkbox" id="opt-injured"> ✕ Verletzte aufstellen</label>
        <label><input type="checkbox" id="opt-suspended"> 🔴 Gesperrte aufstellen</label>
      </div>
      <table class="tbl">
        <thead><tr><th>Rolle</th><th>Spieler</th><th>Position</th><th class="right">Rating-Schätzung</th></tr></thead>
        <tbody>
          ${lineup.map((s) => `
            <tr>
              <td>${F.escapeHtml(s.role)}</td>
              <td>${F.escapeHtml(s.player.name)}</td>
              <td><span class="pos ${s.player.position_code}">${s.player.position_code || '–'}</span></td>
              <td class="right">${s.rating_estimate.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function teamHtml() {
    if (!currentLineup) return '<div class="muted">Lade…</div>';
    return `
      <div class="muted">Bank (Top 7):</div>
      <table class="tbl">
        <thead><tr><th>Pos</th><th>Name</th><th>Form</th><th>Kond.</th><th>TSI</th></tr></thead>
        <tbody>
          ${currentLineup.bench.map((p) => `
            <tr>
              <td><span class="pos ${p.position_code}">${p.position_code || '–'}</span></td>
              <td>${F.escapeHtml(p.name)}</td>
              <td>${p.skills.skill_form ?? '–'}</td>
              <td>${p.skills.skill_stamina ?? '–'}</td>
              <td>${F.num(p.tsi)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function tacticsHtml() {
    if (!currentLineup) return '<div class="muted">Lade…</div>';
    const tr = currentLineup.team_rating;

    // Mini-Pitch mit Zonen-Werten: 7 Zonen.
    // Heuristik: aus Lineup-Spielern Skills aufteilen
    const zones = computeZoneRatings(currentLineup.lineup);

    return `
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;background:var(--card-bg);padding:8px;border:1px solid var(--border);border-radius:6px">
        <label>Heim/Auswärts:
          <select id="ta-side"><option>Heimspiel</option><option>Auswärts</option></select></label>
        <label>Teameinstellung:
          <select id="ta-mood"><option>Normal</option><option>Spiel des Jahres</option><option>Pflichtsieg</option></select></label>
        <label>Teamstimmung:
          <select id="ta-spirit"><option>ruhig (mittel)</option><option>hoch</option><option>sehr hoch</option></select></label>
        <label>Selbstvertrauen:
          <select id="ta-conf"><option>gering</option><option>mittel</option><option>hoch</option></select></label>
      </div>

      <div class="grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Teambewertung</div>
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:8px">
            <div style="background:#eef3f9;padding:8px 14px;border-radius:6px">
              <div class="muted" style="font-size:11px">Loddar Stats</div>
              <div style="font-size:22px;font-weight:700;color:#2d6cdf">${tr.loddar}</div>
            </div>
            <div>
              <div class="muted" style="font-size:11px">HatStats / Squad / Smartsquad</div>
              <div style="font-size:14px"><b>${tr.hatstats}</b> / ${(tr.hatstats * 0.85).toFixed(0)} / ${(tr.hatstats * 0.92).toFixed(0)}</div>
            </div>
          </div>
          ${miniPitchHtml(zones)}
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Spielerbewertung (Mini-Pitch)</div>
          <div style="position:relative;background:#4a7c3f;height:280px;border-radius:6px;overflow:hidden">
            ${currentLineup.lineup.map((slot) => `
              <div style="
                position:absolute;
                left:${slot.y}%; top:${100 - slot.x}%;
                transform:translate(-50%,-50%);
                background:${ratingColor(slot.rating_estimate)};
                color:white;padding:3px 6px;border-radius:4px;
                font-size:10px;font-weight:600;
                box-shadow:0 1px 2px rgba(0,0,0,0.3);
                white-space:nowrap;
              ">
                ${F.escapeHtml(slot.player.name.split(' ').pop())} ${stars(slot.rating_estimate / 2)}<br>
                <span style="font-size:9px;opacity:.85">${slot.rating_estimate.toFixed(1)}</span>
              </div>
            `).join('')}
          </div>
          <div class="muted" style="margin-top:6px;font-size:11px">Hover für Details, Klick für Spielerwechsel (TODO)</div>
        </div>
      </div>

      <div style="margin-top:14px">
        <div class="section-title">Mannschaftsvergleich</div>
        <table class="tbl" style="max-width:520px">
          <thead><tr><th></th><th class="right">Eigenes Team</th><th class="right">Gegner</th></tr></thead>
          <tbody>
            <tr><td>Durchschnittserfahrung</td><td class="right">${avgSkill(currentLineup.lineup, 'skill_experience').toFixed(2)}</td><td class="right muted">–</td></tr>
            <tr><td>Durchschnittsform</td><td class="right">${avgSkill(currentLineup.lineup, 'skill_form').toFixed(2)}</td><td class="right muted">–</td></tr>
            <tr><td>Durchschnittlicher TSI</td><td class="right">${F.num(avgTSI(currentLineup.lineup))}</td><td class="right muted">–</td></tr>
          </tbody>
        </table>
        <div class="muted" style="margin-top:6px;font-size:11px">Gegnerdaten kommen via OAuth-Live-Pull (TODO).</div>
      </div>
    `;
  }

  function computeZoneRatings(lineup) {
    // Heuristisch: Spieler werden Zonen zugeordnet; Wert = Mittel ihrer relevanten Skills × 0.4
    const zones = { ar: 0, ac: 0, al: 0, m: 0, dr: 0, dc: 0, dl: 0 };
    const counts = { ar: 0, ac: 0, al: 0, m: 0, dr: 0, dc: 0, dl: 0 };
    for (const slot of lineup) {
      const role = slot.role || '';
      const sk = slot.player.skills || {};
      // Angriff
      if (role.includes('cf') || role === 'ccf') {
        if (role.startsWith('r')) { zones.ar += sk.skill_scoring || 0; counts.ar++; }
        else if (role.startsWith('l')) { zones.al += sk.skill_scoring || 0; counts.al++; }
        else { zones.ac += sk.skill_scoring || 0; counts.ac++; }
      }
      if (role === 'rw') { zones.ar += (sk.skill_winger || 0) * 0.7 + (sk.skill_scoring || 0) * 0.3; counts.ar++; }
      if (role === 'lw') { zones.al += (sk.skill_winger || 0) * 0.7 + (sk.skill_scoring || 0) * 0.3; counts.al++; }
      // Mittelfeld
      if (role.includes('im') || role.includes('cm')) { zones.m += sk.skill_playmaking || 0; counts.m++; }
      // Verteidigung
      if (role === 'rb' || role === 'rwb') { zones.dr += sk.skill_defending || 0; counts.dr++; }
      if (role === 'lb' || role === 'lwb') { zones.dl += sk.skill_defending || 0; counts.dl++; }
      if (role.includes('cb')) { zones.dc += sk.skill_defending || 0; counts.dc++; }
    }
    Object.keys(zones).forEach((k) => {
      zones[k] = counts[k] ? +(zones[k] / counts[k] * 0.6).toFixed(2) : 0;
    });
    return zones;
  }

  function miniPitchHtml(z) {
    // 3x3-Grid in Pitch-Optik: rechts Angriff oben, Mitte=Mittelfeld, links Abwehr
    return `
      <div style="background:#4a7c3f;border-radius:6px;padding:12px;color:white">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
          <div>
            <div style="font-size:10px;opacity:.7">Abwehr links</div>
            <div style="font-size:18px;font-weight:700">${z.dl}</div>
          </div>
          <div>
            <div style="font-size:10px;opacity:.7">Abwehr Mitte</div>
            <div style="font-size:18px;font-weight:700">${z.dc}</div>
          </div>
          <div>
            <div style="font-size:10px;opacity:.7">Abwehr rechts</div>
            <div style="font-size:18px;font-weight:700">${z.dr}</div>
          </div>
          <div></div>
          <div>
            <div style="font-size:10px;opacity:.7">Mittelfeld</div>
            <div style="font-size:22px;font-weight:700;color:#ffe066">${z.m}</div>
          </div>
          <div></div>
          <div>
            <div style="font-size:10px;opacity:.7">Angriff links</div>
            <div style="font-size:18px;font-weight:700">${z.al}</div>
          </div>
          <div>
            <div style="font-size:10px;opacity:.7">Angriff Mitte</div>
            <div style="font-size:18px;font-weight:700">${z.ac}</div>
          </div>
          <div>
            <div style="font-size:10px;opacity:.7">Angriff rechts</div>
            <div style="font-size:18px;font-weight:700">${z.ar}</div>
          </div>
        </div>
      </div>
    `;
  }

  function avgSkill(lineup, key) {
    const vals = lineup.map((s) => s.player.skills?.[key] || 0).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }
  function avgTSI(lineup) {
    const vals = lineup.map((s) => s.player.tsi || 0).filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
  function ratingColor(r) {
    if (r == null) return '#888';
    if (r < 5) return '#cc4444';
    if (r < 6.5) return '#ddaa22';
    if (r < 8) return '#44aa44';
    return '#4488cc';
  }
  function stars(v) {
    if (v == null) return '';
    const full = Math.max(0, Math.min(5, Math.floor(v)));
    return '★'.repeat(full);
  }

  async function savedHtml(target) {
    const [list, matches] = await Promise.all([
      HHApi.savedLineups(),
      HHApi.matches(),
    ]);
    const playedRecent = matches.filter((m) => m.result).slice(0, 12);

    target.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Gespeicherte Aufstellungen</div>
          <table class="tbl">
            <thead><tr><th>Name der Aufstellung</th><th>Datum</th><th></th></tr></thead>
            <tbody id="saved-rows">
              ${list.map((it) => `
                <tr><td><b>${F.escapeHtml(it.name)}</b></td><td>${F.date(it.saved_at).slice(0, 16)}</td>
                    <td><button data-load="${it.file}" title="Aufstellung laden">📋</button></td></tr>
              `).join('') || `<tr><td colspan="3" class="muted">Noch keine.</td></tr>`}
            </tbody>
          </table>
          <div style="margin-top:10px;display:flex;gap:6px;align-items:center">
            <span>Speichere unter:</span>
            <input type="text" id="save-name" placeholder="Aufstellungsname…" style="flex:1">
            <button class="primary" id="save-btn">💾 Speichern</button>
          </div>
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Aufstellungen gespielter Partien</div>
          <table class="tbl">
            <thead><tr><th>Typ</th><th>Spiel</th><th>Datum</th><th></th></tr></thead>
            <tbody>
              ${playedRecent.map((m) => `
                <tr>
                  <td class="center" style="font-size:14px">${F.matchTypeBadge(m.match_type)}</td>
                  <td>
                    <b>${F.escapeHtml(m.home_team_name)}</b> –
                    <b>${F.escapeHtml(m.away_team_name)}</b>
                    [${m.home_goals ?? '?'}:${m.away_goals ?? '?'}]
                  </td>
                  <td>${F.date(m.match_date).slice(0, 10)}</td>
                  <td><button data-played="${m.match_id}" title="Aufstellung dieses Spiels anzeigen">📋</button></td>
                </tr>
              `).join('') || `<tr><td colspan="4" class="muted">Noch keine gespielten Partien.</td></tr>`}
            </tbody>
          </table>
          <div class="muted" style="margin-top:6px;font-size:11px">
            Lineup-Anzeige der gespielten Partien benötigt matchdetails-Pull pro Spiel (TODO).
          </div>
        </div>
      </div>
    `;
    document.getElementById('save-btn').addEventListener('click', async () => {
      const name = document.getElementById('save-name').value.trim() || 'Aufstellung';
      await HHApi.saveLineup({ name, lineup: currentLineup });
      renderSub();
    });
    target.querySelectorAll('button[data-load]').forEach((b) => {
      b.addEventListener('click', async () => {
        const data = await HHApi.loadLineup(b.dataset.load);
        currentLineup = data.lineup;
        drawPitch();
      });
    });
  }

  let selectedMatchId = null;

  async function submitHtml(target) {
    const matches = await HHApi.matches();
    const upcoming = matches.filter((m) => !m.result).slice(0, 8).reverse();
    const players = currentLineup ? currentLineup.lineup.map((s) => s.player) : [];

    // Spielerauswahl für Kapitän/Standardschütze
    const playerOpt = (def) => players.map((p) =>
      `<option value="${p.player_id}" ${def === p.player_id ? 'selected' : ''}>
        ${(p.rating_stars || 0).toFixed(2)} | ${F.escapeHtml(p.name)}
      </option>`
    ).join('');

    target.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Nächste Spiele</div>
          <table class="tbl">
            <thead><tr><th>Datum</th><th>Typ</th><th>Spiel</th><th></th></tr></thead>
            <tbody id="upcoming-rows">
              ${upcoming.map((m) => `
                <tr data-mid="${m.match_id}" style="cursor:pointer">
                  <td>${F.date(m.match_date)}</td>
                  <td class="center" style="font-size:14px">${F.matchTypeBadge(m.match_type)}</td>
                  <td>${F.escapeHtml(m.home_team_name)} – ${F.escapeHtml(m.away_team_name)}</td>
                  <td>✏️</td>
                </tr>
              `).join('') || `<tr><td colspan="4" class="muted">Keine geplanten Spiele.</td></tr>`}
            </tbody>
          </table>
          <div class="muted" style="margin-top:6px;font-size:11px">Klick auf Zeile zum Auswählen</div>
        </div>

        <div>
          <div class="section-title" style="margin-top:0">Aufstellungs-Optionen</div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:6px;align-items:center">
            <label>Teameinstellung:</label>
            <select id="sub-mood">
              <option value="0">Normal</option>
              <option value="1">Pflichtsieg</option>
              <option value="2">Spiel des Jahres</option>
              <option value="-1">Spiel der Woche</option>
            </select>

            <label>Spezialtaktik:</label>
            <select id="sub-tactic">
              <option value="0">Normal</option>
              <option value="1">Pressing</option>
              <option value="2">Auf Konter</option>
              <option value="3">Durch die Mitte</option>
              <option value="4">Über die Flügel</option>
              <option value="7">Weitschüsse</option>
              <option value="8">Kreativ spielen</option>
            </select>

            <label>Kapitän:</label>
            <select id="sub-captain">${playerOpt()}</select>

            <label>Standardschütze:</label>
            <select id="sub-setpieces">${playerOpt()}</select>
          </div>

          <div style="margin-top:14px">
            <div id="submit-target" class="muted" style="margin-bottom:6px">
              Bitte oben ein Spiel auswählen…
            </div>
            <button id="btn-predict-lineup" disabled
                    style="width:100%;font-size:13px;padding:6px 0;margin-bottom:6px">
              🔮 Test ohne Senden (Hattrick-Ratings-Vorschau)
            </button>
            <div id="predict-result" class="muted"
                 style="margin-bottom:6px;font-size:11px"></div>
            <button class="primary" id="btn-submit-lineup" disabled
                    style="width:100%;font-size:14px;padding:8px 0">
              ⚽ Aufstellung an Hattrick übermitteln
            </button>
          </div>

          <div style="margin-top:10px;padding:8px;background:#fff8e1;border:1px solid #f0d68a;border-radius:4px;font-size:11px">
            ⚠ <b>Schreibender CHPP-Endpoint.</b> Nach Klick erscheint eine Sicherheits-Bestätigung.
            Stelle sicher dass die Aufstellung oben im Pitch korrekt ist.
          </div>
        </div>
      </div>
    `;

    // Spiel-Auswahl per Click auf Zeile
    target.querySelectorAll('tr[data-mid]').forEach((tr) => {
      tr.addEventListener('click', () => {
        target.querySelectorAll('tr[data-mid]').forEach((x) => x.style.background = '');
        tr.style.background = 'var(--tab-active)';
        selectedMatchId = +tr.dataset.mid;
        const home = tr.children[2]?.textContent || '';
        document.getElementById('submit-target').innerHTML =
          `Ausgewählt: <b>${F.escapeHtml(home)}</b> · Match-ID ${selectedMatchId}`;
        document.getElementById('btn-submit-lineup').disabled = false;
        document.getElementById('btn-predict-lineup').disabled = false;
      });
    });

    // Dry-Run: predictratings nimmt dasselbe lineup-JSON wie setmatchorder,
    // validiert es serverseitig und liefert die HT-Ratings — ohne zu schreiben.
    document.getElementById('btn-predict-lineup').addEventListener('click', async () => {
      if (!selectedMatchId) { alert('Bitte Spiel auswählen.'); return; }
      if (!currentLineup) { alert('Keine Aufstellung im Pitch geladen.'); return; }
      const out = document.getElementById('predict-result');
      out.textContent = '⏳ Hattrick rechnet…';
      try {
        const r = await HHApi.predictLineup({
          match_id: selectedMatchId,
          lineup: currentLineup,
          captain_id: +document.getElementById('sub-captain').value,
          setpieces_id: +document.getElementById('sub-setpieces').value,
          tactic: document.getElementById('sub-tactic').value,
          attitude: +(document.getElementById('sub-mood')?.value ?? -1),
          confirm: false,
        });
        const rt = r.ratings || {};
        const f = (v) => (v == null ? '—' : v);
        out.innerHTML =
          `✅ Payload von Hattrick akzeptiert · ` +
          `MF <b>${f(rt.midfield)}</b> · ` +
          `Abw <b>${f(rt.right_def)}</b>/<b>${f(rt.mid_def)}</b>/<b>${f(rt.left_def)}</b> · ` +
          `Ang <b>${f(rt.right_att)}</b>/<b>${f(rt.mid_att)}</b>/<b>${f(rt.left_att)}</b>`;
      } catch (e) {
        out.innerHTML = '❌ ' + F.escapeHtml(e.message || String(e));
      }
    });

    document.getElementById('btn-submit-lineup').addEventListener('click', async () => {
      if (!selectedMatchId) { alert('Bitte Spiel auswählen.'); return; }
      if (!currentLineup) { alert('Keine Aufstellung im Pitch geladen.'); return; }
      const tactic = document.getElementById('sub-tactic').value;
      const captain = +document.getElementById('sub-captain').value;
      const setpieces = +document.getElementById('sub-setpieces').value;
      if (!confirm(`Aufstellung wirklich für Match ${selectedMatchId} an Hattrick senden?\nKapitän: ${captain}\nStandards: ${setpieces}\nTaktik: ${tactic}`)) return;
      try {
        const r = await HHApi.submitLineup({
          match_id: selectedMatchId,
          lineup: currentLineup,
          captain_id: captain,
          setpieces_id: setpieces,
          tactic: tactic,
          attitude: +(document.getElementById('sub-mood')?.value ?? -1),
          confirm: true,
        });
        alert('Erfolg: ' + JSON.stringify(r).slice(0, 300));
      } catch (e) {
        alert('Fehler: ' + e.message);
      }
    });
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.lineup = render;
})();
