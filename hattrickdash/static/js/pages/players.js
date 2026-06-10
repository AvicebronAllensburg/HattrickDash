/* Spieler-Seite mit 4 Ansichten: Fähigkeiten / Bewertung / TPS / Lohn. */
(function () {
  const F = window.HHFmt;

  const VIEWS = {
    skills:  'Fähigkeitsansicht',
    rating:  'Bewertungsansicht',
    tps:     'TPS-Übersicht',
    salary:  'Lohnübersicht',
  };

  // Skill-Spalten: Reihenfolge Form | Erf | Kondition | Spielaufbau | ...
  const SKILL_COLS = [
    { key: 'skill_form',       label: 'Form',        icon: '⚡' },
    { key: 'skill_experience', label: 'Erfahrung',   icon: '🎓' },
    { key: 'skill_stamina',    label: 'Kondition',   icon: '🏃' },
    { key: 'skill_playmaking', label: 'Spielaufbau', icon: '🎯' },
    { key: 'skill_winger',     label: 'Flügel',      icon: '🪽' },
    { key: 'skill_scoring',    label: 'Torschuss',   icon: '⚽' },
    { key: 'skill_passing',    label: 'Pass',        icon: '↗' },
    { key: 'skill_defending',  label: 'Vert.',       icon: '🛡' },
    { key: 'skill_keeper',     label: 'Torwart',     icon: '🥅' },
    { key: 'skill_setpieces',  label: 'Stand.',      icon: '📐' },
    { key: 'skill_loyalty',    label: 'Treue',       icon: '🤝' },
  ];

  const POS_ORDER = { G: 0, DC: 1, DW: 2, W: 3, M: 4, F: 5, '': 6 };

  const state = {
    view: 'skills',
    filterPos: '',
    filterText: '',
    sortKey: 'position_code',
    sortDir: 1,
    squad: [],
  };

  async function render(root) {
    root.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span><b id="squad-count">…</b> Spieler</span>
            <select id="filter-pos">
              <option value="">Alle Positionen</option>
              <option value="G">Torwart</option>
              <option value="DC">Innenverteidiger</option>
              <option value="DW">Außenverteidiger</option>
              <option value="W">Flügel</option>
              <option value="M">Mittelfeld</option>
              <option value="F">Sturm</option>
            </select>
            <input type="text" id="filter-text" placeholder="Spielername…" style="width:160px">
          </div>
          <div>
            <select id="view-switch" title="Ansicht wechseln">
              ${Object.entries(VIEWS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="card-body" style="overflow-x:auto;padding:0">
          <div id="squad-table">Lade…</div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-header">
          <span>🩹 Verletzungsrechner</span>
        </div>
        <div class="card-body">
          <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end">
            <label>Alter <input type="number" id="inj-age" value="22" min="15" max="40" style="width:60px"></label>
            <label>Verletzungswochen <input type="number" id="inj-weeks" value="1" min="1" max="20" style="width:60px"></label>
            <label>Ärzte <input type="number" id="inj-doctors" value="1" min="0" max="5" style="width:60px"></label>
            <label>Heilungsspeed <input type="number" id="inj-speed" value="1.0" step="0.1" min="0.5" max="3" style="width:70px"></label>
            <button class="primary" id="inj-calc">✓ Berechnen</button>
          </div>
          <div id="inj-result" class="muted" style="margin-top:8px"></div>
        </div>
      </div>
    `;

    document.getElementById('view-switch').addEventListener('change', (e) => {
      state.view = e.target.value;
      draw();
    });
    document.getElementById('filter-pos').addEventListener('change', (e) => {
      state.filterPos = e.target.value;
      draw();
    });
    document.getElementById('filter-text').addEventListener('input', (e) => {
      state.filterText = e.target.value.toLowerCase();
      draw();
    });
    document.getElementById('inj-calc').addEventListener('click', async () => {
      const data = {
        age: +document.getElementById('inj-age').value,
        weeks_injured: +document.getElementById('inj-weeks').value,
        doctors: +document.getElementById('inj-doctors').value,
        healing_speed: +document.getElementById('inj-speed').value,
      };
      const res = await HHApi.injuryCalc(data);
      document.getElementById('inj-result').innerHTML =
        `→ <b>${res.estimated_days} Tage</b> geschätzte Heilungsdauer · ${F.escapeHtml(res.note)}`;
    });

    state.squad = await HHApi.squad();
    document.getElementById('squad-count').textContent = state.squad.length;
    draw();
  }

  function draw() {
    const filtered = state.squad
      .filter((p) => !state.filterPos || p.position_code === state.filterPos)
      .filter((p) => !state.filterText
        || (p.name || '').toLowerCase().includes(state.filterText));

    filtered.sort((a, b) => {
      let av = getSortVal(a, state.sortKey);
      let bv = getSortVal(b, state.sortKey);
      if (state.sortKey === 'position_code') {
        av = POS_ORDER[av] ?? 99;
        bv = POS_ORDER[bv] ?? 99;
      }
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * state.sortDir;
    });

    const target = document.getElementById('squad-table');
    if (state.view === 'skills')  target.innerHTML = renderSkillsView(filtered);
    if (state.view === 'rating')  target.innerHTML = renderRatingView(filtered);
    if (state.view === 'tps')     target.innerHTML = renderTPSView(filtered);
    if (state.view === 'salary')  target.innerHTML = renderSalaryView(filtered);

    target.querySelectorAll('thead th[data-key]').forEach((th) => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (state.sortKey === key) state.sortDir *= -1;
        else { state.sortKey = key; state.sortDir = 1; }
        draw();
      });
    });
  }

  function getSortVal(p, key) {
    if (key in p) return p[key] ?? '';
    if (p.skills && key in p.skills) return p.skills[key] ?? -1;
    return p[key] ?? '';
  }

  // ============================================================ View: Skills
  function renderSkillsView(rows) {
    const headers = SKILL_COLS.map((s) =>
      `<th data-key="${s.key}" title="${s.label}"><span style="font-size:14px">${s.icon}</span><br>${s.label.slice(0, 6)}</th>`
    ).join('');
    return `
      <table class="tbl players-tbl">
        <thead><tr>
          <th data-key="position_code">POS</th>
          <th data-key="name" class="left" style="text-align:left">Name</th>
          <th data-key="age_years">Alt</th>
          <th>Land</th>
          <th>Status</th>
          <th data-key="tsi">TSI</th>
          ${headers}
          <th data-key="rating_stars">Sterne</th>
        </tr></thead>
        <tbody>
          ${rows.map((p) => `
            <tr class="pos-row-${p.position_code || ''}">
              <td><span class="pos ${p.position_code}">${p.position_code || '–'}</span></td>
              <td class="left"><b>${F.escapeHtml(p.name)}</b></td>
              <td>${p.age_years ?? '–'}.${p.age_days ?? ''}</td>
              <td title="${F.escapeHtml(p.nationality_name || '')}">${F.escapeHtml((p.nationality_name || '–').slice(0, 12))}</td>
              <td>${statusIcons(p)}</td>
              <td>${F.num(p.tsi)}</td>
              ${SKILL_COLS.map((s) => `<td class="skill">${p.skills?.[s.key] ?? '–'}</td>`).join('')}
              <td>${stars(p.rating_stars)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ============================================================ View: Bewertung
  function renderRatingView(rows) {
    return `
      <table class="tbl players-tbl">
        <thead><tr>
          <th data-key="position_code">POS</th>
          <th data-key="name" class="left">Name</th>
          <th data-key="age_years">Alt</th>
          <th>Land</th>
          <th data-key="rating_stars">Letzte Note</th>
          <th>Form</th>
          <th>Erfahrung</th>
          <th>Kondition</th>
          <th>Treue</th>
          <th>Spezialisierung</th>
          <th>Sterne</th>
        </tr></thead>
        <tbody>
          ${rows.map((p) => `
            <tr class="pos-row-${p.position_code || ''}">
              <td><span class="pos ${p.position_code}">${p.position_code || '–'}</span></td>
              <td class="left"><b>${F.escapeHtml(p.name)}</b></td>
              <td>${p.age_years ?? '–'}</td>
              <td>${F.escapeHtml((p.nationality_name || '–').slice(0, 12))}</td>
              <td class="skill"><b>${p.rating_stars != null ? p.rating_stars.toFixed(2) : '–'}</b></td>
              <td class="skill">${p.skills?.skill_form ?? '–'}</td>
              <td class="skill">${p.skills?.skill_experience ?? '–'}</td>
              <td class="skill">${p.skills?.skill_stamina ?? '–'}</td>
              <td class="skill">${p.skills?.skill_loyalty ?? '–'}</td>
              <td>${p.specialty_name ? '⚡ ' + F.escapeHtml(p.specialty_name) : '–'}</td>
              <td>${stars(p.rating_stars)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ============================================================ View: TPS
  function renderTPSView(rows) {
    return `
      <table class="tbl players-tbl">
        <thead><tr>
          <th data-key="position_code">POS</th>
          <th data-key="name" class="left">Name</th>
          <th data-key="age_years">Alt</th>
          <th data-key="tsi">TSI</th>
          <th>TSI/Hauptskill</th>
          <th>Hauptskill</th>
          <th>Wert</th>
          <th>Form</th>
          <th>Spez.</th>
        </tr></thead>
        <tbody>
          ${rows.map((p) => {
            const skills = p.skills || {};
            const main = mainSkillFor(p.position_code);
            const mainVal = skills[main] || 0;
            const tps = mainVal > 0 ? Math.round((p.tsi || 0) / mainVal) : 0;
            return `
              <tr class="pos-row-${p.position_code || ''}">
                <td><span class="pos ${p.position_code}">${p.position_code || '–'}</span></td>
                <td class="left"><b>${F.escapeHtml(p.name)}</b></td>
                <td>${p.age_years ?? '–'}</td>
                <td>${F.num(p.tsi)}</td>
                <td class="skill">${F.num(tps)}</td>
                <td>${skillLabelFor(main)}</td>
                <td class="skill">${mainVal}</td>
                <td class="skill">${skills.skill_form ?? '–'}</td>
                <td>${p.specialty_name ? '⚡' : '–'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ============================================================ View: Lohn
  function renderSalaryView(rows) {
    const totalSalary = rows.reduce((s, p) => s + (p.salary || 0), 0);
    const totalTSI = rows.reduce((s, p) => s + (p.tsi || 0), 0);
    return `
      <table class="tbl players-tbl">
        <thead><tr>
          <th data-key="position_code">POS</th>
          <th data-key="name" class="left">Name</th>
          <th data-key="age_years">Alt</th>
          <th data-key="salary">Gehalt</th>
          <th data-key="tsi">TSI</th>
          <th>Gehalt/TSI×1000</th>
          <th>Form</th>
          <th>Erfahrung</th>
          <th>Status</th>
        </tr></thead>
        <tbody>
          ${rows.map((p) => {
            const ratio = p.tsi ? ((p.salary || 0) / p.tsi * 1000).toFixed(2) : '–';
            return `
              <tr class="pos-row-${p.position_code || ''}">
                <td><span class="pos ${p.position_code}">${p.position_code || '–'}</span></td>
                <td class="left"><b>${F.escapeHtml(p.name)}</b></td>
                <td>${p.age_years ?? '–'}</td>
                <td class="skill">${F.money(p.salary)}</td>
                <td>${F.num(p.tsi)}</td>
                <td>${ratio}</td>
                <td class="skill">${p.skills?.skill_form ?? '–'}</td>
                <td class="skill">${p.skills?.skill_experience ?? '–'}</td>
                <td>${statusIcons(p)}</td>
              </tr>
            `;
          }).join('')}
          <tr style="font-weight:700;border-top:2px solid var(--border);background:#eef3f9">
            <td colspan="3">Total (${rows.length})</td>
            <td class="skill">${F.money(totalSalary)}</td>
            <td>${F.num(totalTSI)}</td>
            <td>${totalTSI ? (totalSalary / totalTSI * 1000).toFixed(2) : '–'}</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // ============================================================ Helpers
  function statusIcons(p) {
    const out = [];
    if (p.is_injured) out.push('<span class="tag bad" title="Verletzt">✕</span>');
    if (p.is_suspended) out.push('<span class="tag bad" title="Gesperrt">🔴</span>');
    if (p.specialty) out.push(`<span class="tag" title="${F.escapeHtml(p.specialty_name)}">⚡</span>`);
    if (p.is_transfer_listed) out.push('<span class="tag warn" title="Transfermarkt">$</span>');
    if (p.is_national_player) out.push('<span class="tag" title="Nationalteam">🌐</span>');
    if (p.yellow_cards) out.push(`<span class="tag warn" title="${p.yellow_cards} gelbe Karte(n)">${p.yellow_cards}🟨</span>`);
    return out.join(' ') || '<span class="muted">–</span>';
  }

  function stars(value) {
    if (value == null) return '<span class="muted">–</span>';
    const v = Math.max(0, Math.min(5, value));
    const full = Math.floor(v);
    const half = v - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return `<span class="stars">${'★'.repeat(full)}${half ? '⯨' : ''}<span class="stars-empty">${'☆'.repeat(empty)}</span></span>`;
  }

  function mainSkillFor(position) {
    if (position === 'G') return 'skill_keeper';
    if (position === 'F') return 'skill_scoring';
    if (position === 'W') return 'skill_winger';
    if (position === 'DC' || position === 'DW') return 'skill_defending';
    return 'skill_playmaking';
  }
  function skillLabelFor(key) {
    const found = SKILL_COLS.find((c) => c.key === key);
    return found ? found.label : key;
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.players = render;
})();
