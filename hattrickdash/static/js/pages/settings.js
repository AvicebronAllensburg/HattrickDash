/* Einstellungen — Public-Variante.
 *
 * Hat in dieser Version (main-Branch) ALLE Admin-Funktionen integriert,
 * weil es keinen separaten Admin-Tab mehr gibt. Sub-Tabs:
 *   🔑 Login        → Consumer-Credentials + OAuth-Wizard
 *   📥 Daten-Pull   → Einzel-Endpoints + Full-Init + Match-Details
 *   ⏰ Scheduler    → Cron-Jobs ausführen / einsehen
 *   🔧 Server       → Restart / Shutdown / Reset-DB / Logs
 *   📐 Formeln      → HatStats/Loddar-Stats-Konfiguration
 *   ℹ Info         → Lizenz / About
 *
 * Backend-Endpunkte (/api/admin/*) sind unverändert — nur das Frontend
 * verlagert die Funktionen in die Settings-Page.
 */
(function () {
  const F = window.HHFmt;
  let activeTab = 'login';
  let pollLogsTimer = null;

  // ---------------------- Formeln (lokal) ---------------------------------
  const DEFAULT_FORMULAS = {
    spielaufbau: 0,
    flugelspiel: 0,
    torschuss: 0,
    torwart: 80,
    passspiel: 0,
    verteidigung: 25,
    form: 67,
    erfahrung: 43,
  };
  function loadFormulas() {
    try {
      return Object.assign({}, DEFAULT_FORMULAS, JSON.parse(localStorage.getItem('hh-formulas') || '{}'));
    } catch (_) { return { ...DEFAULT_FORMULAS }; }
  }
  function saveFormulas(f) {
    localStorage.setItem('hh-formulas', JSON.stringify(f));
  }

  // ======================================================================
  //                              SHELL
  // ======================================================================

  async function render(root) {
    root.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="tabs" data-tabs="settings">
            <button class="active" data-key="login">🔑 Login</button>
            <button data-key="pull">📥 Daten-Pull</button>
            <button data-key="scheduler">⏰ Scheduler</button>
            <button data-key="server">🔧 Server</button>
            <button data-key="formulas">📐 Formeln</button>
            <button data-key="info">ℹ Info</button>
          </div>
        </div>
        <div class="card-body" id="settings-body">Lade…</div>
      </div>
    `;
    root.querySelectorAll('[data-tabs="settings"] button').forEach((b) => {
      b.addEventListener('click', () => {
        // Logs-Polling stoppen wenn man Server-Tab verlässt
        if (pollLogsTimer) { clearInterval(pollLogsTimer); pollLogsTimer = null; }
        root.querySelectorAll('[data-tabs="settings"] button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        activeTab = b.dataset.key;
        renderTab();
      });
    });
    // Cleanup wenn man die ganze Page verlässt
    window.addEventListener('hashchange', () => {
      if (pollLogsTimer) { clearInterval(pollLogsTimer); pollLogsTimer = null; }
    }, { once: true });
    renderTab();
  }

  async function renderTab() {
    const target = document.getElementById('settings-body');
    target.innerHTML = '<div class="muted">Lade…</div>';
    if (activeTab === 'login')     return renderLogin(target);
    if (activeTab === 'pull')      return renderPull(target);
    if (activeTab === 'scheduler') return renderScheduler(target);
    if (activeTab === 'server')    return renderServer(target);
    if (activeTab === 'formulas')  return renderFormulas(target);
    if (activeTab === 'info')      return renderInfo(target);
  }

  // ======================================================================
  //                          TAB: 🔑 Login
  // ======================================================================

  async function renderLogin(target) {
    const s = await HHApi.adminStatus().catch((e) => ({ error: e.message }));
    target.innerHTML = `
      ${cardStatus(s)}
      ${cardOauth(s)}
    `;
    bindOauth(s);
  }

  function cardStatus(s) {
    if (s.error) {
      return `<div class="card"><div class="card-header">Status</div>
        <div class="card-body" style="color:var(--negative)">Backend nicht erreichbar: ${F.escapeHtml(s.error)}</div></div>`;
    }
    const auth  = s.authenticated  ? '<span class="tag ok">✓ angemeldet</span>'  : '<span class="tag bad">✗ nicht angemeldet</span>';
    const cons  = s.has_consumer   ? '<span class="tag ok">✓ vorhanden</span>'   : '<span class="tag bad">✗ fehlt</span>';
    const sched = s.scheduler_running ? '<span class="tag ok">✓ läuft</span>'   : '<span class="tag warn">○ inaktiv</span>';
    return `
      <div class="card"><div class="card-header">📊 Status</div>
        <div class="card-body">
          <div class="kv-grid">
            <span class="k">OAuth</span><span class="v">${auth}</span>
            <span class="k">Consumer-Credentials</span><span class="v">${cons}</span>
            <span class="k">Team-ID</span><span class="v">${s.team_id ?? '–'}</span>
            <span class="k">Consumer-Key</span><span class="v"><code>${F.escapeHtml(s.consumer_key_masked || '–')}</code></span>
            <span class="k">Scheduler</span><span class="v">${sched}</span>
            <span class="k">Server</span><span class="v">PID ${s.pid} · ${F.escapeHtml(s.host)}:${s.port}</span>
            <span class="k">DB</span><span class="v">${F.num(s.db_size_bytes)} Bytes</span>
            <span class="k">Logfile</span><span class="v">${F.num(s.log_size_bytes)} Bytes</span>
          </div>
        </div></div>
    `;
  }

  function cardOauth(s) {
    if (s.authenticated) {
      return `
        <div class="card">
          <div class="card-header">✅ Hattrick-Verbindung</div>
          <div class="card-body">
            <p>Du bist mit Hattrick verbunden. Team-ID: <b>${s.team_id ?? '?'}</b></p>
            <button class="danger" id="btn-oauth-clear">🚪 Abmelden / Tokens löschen</button>
          </div>
        </div>
      `;
    }
    const ready = !!s.has_consumer;
    return `
      <div class="card">
        <div class="card-header">🔐 Hattrick-Login (OAuth-PIN)</div>
        <div class="card-body">
          <p class="muted">
            HattrickDash bekommt nur ein OAuth-Token, nicht dein Hattrick-Passwort —
            du gibst dein Passwort ausschließlich auf hattrick.org ein.
            Die App-Credentials sind bereits eingebaut, du musst nichts registrieren.
          </p>
          <div id="oauth-step-1">
            <button class="primary" id="btn-oauth-start" ${ready ? '' : 'disabled'}>
              🌐 OAuth starten – Hattrick-Login öffnen
            </button>
            ${ready ? '' : `
              <div class="muted" style="margin-top:8px;color:var(--negative)">
                ⚠ App-Credentials fehlen — bitte <code>_app_credentials.py</code> mit Consumer Key
                und (verschlüsseltem) Consumer Secret befüllen. Siehe README.
              </div>
            `}
          </div>
          <div id="oauth-step-2" style="display:none;margin-top:10px">
            <p>1. <a id="oauth-link" href="#" target="_blank" rel="noopener">Klick hier</a> – Browser öffnet Hattrick.</p>
            <p>2. Bei Hattrick einloggen → "App genehmigen" wählen → die angezeigte <b>PIN</b> eingeben:</p>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" id="oauth-pin" placeholder="6-stellige PIN" maxlength="20" style="font-size:16px;letter-spacing:2px">
              <button class="primary" id="btn-oauth-finish">✓ Bestätigen</button>
            </div>
            <div id="oauth-feedback" class="muted" style="margin-top:6px"></div>
          </div>
        </div>
      </div>
    `;
  }
  function bindOauth(s) {
    if (s.authenticated) {
      document.getElementById('btn-oauth-clear').addEventListener('click', async () => {
        if (!confirm('Wirklich alle Tokens löschen? Du musst dich danach neu einloggen.')) return;
        await HHApi.adminOauthClear();
        alert('Tokens gelöscht. Server muss neu gestartet werden, damit der Scheduler stoppt.');
        location.reload();
      });
      return;
    }
    const startBtn = document.getElementById('btn-oauth-start');
    if (!startBtn) return;
    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.textContent = 'Hole Request-Token…';
      try {
        const r = await HHApi.adminOauthStart();
        document.getElementById('oauth-step-1').style.display = 'none';
        document.getElementById('oauth-step-2').style.display = 'block';
        const link = document.getElementById('oauth-link');
        link.href = r.auth_url;
        link.textContent = 'Hattrick öffnen und einloggen';
        window.open(r.auth_url, '_blank', 'noopener');
      } catch (e) {
        startBtn.disabled = false;
        startBtn.textContent = '🌐 OAuth starten – Hattrick-Login öffnen';
        alert('OAuth-Start fehlgeschlagen: ' + e.message);
      }
    });
    document.getElementById('btn-oauth-finish').addEventListener('click', async () => {
      const pin = document.getElementById('oauth-pin').value.trim();
      const fb = document.getElementById('oauth-feedback');
      if (!pin) { fb.textContent = 'PIN eingeben.'; fb.style.color = 'var(--negative)'; return; }
      try {
        fb.textContent = 'Prüfe PIN…';
        fb.style.color = 'var(--text-soft)';
        const r = await HHApi.adminOauthFinish(pin);
        fb.style.color = 'var(--positive)';
        fb.textContent = `✓ Eingeloggt! Team-ID: ${r.team_id}. Server wird gleich neu gestartet…`;
        setTimeout(async () => {
          try { await HHApi.adminRestart(); } catch (_) {}
          setTimeout(() => location.reload(), 5000);
        }, 1000);
      } catch (e) {
        fb.style.color = 'var(--negative)';
        fb.textContent = '✗ ' + e.message;
      }
    });
  }

  // ======================================================================
  //                       TAB: 📥 Daten-Pull
  // ======================================================================

  async function renderPull(target) {
    const s = await HHApi.adminStatus().catch((e) => ({ error: e.message }));
    const endpoints = [
      ['team',      'Team-Stammdaten + Stimmung'],
      ['players',   'Kompletter Kader'],
      ['economy',   'Finanzen'],
      ['arena',     'Stadion'],
      ['training',  'Aktuelle Trainingswoche'],
      ['staff',     'Trainerstab'],
      ['matchlist', 'Spiel-History'],
      ['transfers', 'Transfer-History'],
    ];
    const disabled = !s.authenticated ? 'disabled' : '';
    target.innerHTML = `
      <p class="muted">
        Manuelles Pullen einzelner CHPP-Endpunkte oder ein vollständiger Initial-Sync.
        Im Normalbetrieb läuft der Scheduler automatisch — diese Buttons sind für
        Erstinstallation oder bei Bedarf nach manuellen Eingriffen.
      </p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <button class="primary" id="btn-full-init" ${disabled}>⚡ Full-Init (alle Endpoints)</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${endpoints.map(([k, label]) => `
          <button data-endpoint="${k}" ${disabled} title="${F.escapeHtml(label)}">${F.escapeHtml(label)}</button>
        `).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:6px;align-items:center">
        <input type="number" id="match-id-input" placeholder="Match-ID" style="width:140px" ${disabled}>
        <button id="btn-fetch-match" ${disabled}>matchdetails laden</button>
      </div>
      <pre id="fetch-output" style="
        margin-top:10px;background:#1d2330;color:#d8e0ee;
        font-family:Consolas,monospace;font-size:11px;
        padding:8px;border-radius:6px;max-height:240px;overflow:auto;
        white-space:pre-wrap;word-break:break-word;display:none;
      "></pre>
      ${!s.authenticated ? '<div class="muted" style="margin-top:6px;color:var(--negative)">Erst OAuth durchführen (Tab „Login").</div>' : ''}
    `;
    bindPull();
  }
  function bindPull() {
    const out = document.getElementById('fetch-output');
    function showOut(text, isError = false) {
      out.style.display = 'block';
      out.style.color = isError ? '#ff8888' : '#a8e0a8';
      out.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    }
    document.querySelectorAll('button[data-endpoint]').forEach((b) => {
      b.addEventListener('click', async () => {
        const ep = b.dataset.endpoint;
        b.disabled = true;
        const orig = b.textContent;
        b.textContent = '⌛ Lade…';
        showOut(`Pulle ${ep}…`);
        try {
          const r = await HHApi.adminFetchOne(ep);
          showOut(`✓ ${ep}: ${JSON.stringify(r.result)}`);
        } catch (e) {
          showOut(`✗ ${ep}: ${e.message}`, true);
        } finally {
          b.disabled = false;
          b.textContent = orig;
        }
      });
    });
    const fullBtn = document.getElementById('btn-full-init');
    if (fullBtn) fullBtn.addEventListener('click', async () => {
      if (!confirm('Full-Init startet alle Pulls. Dauert ~1 Minute. Fortfahren?')) return;
      fullBtn.disabled = true;
      fullBtn.textContent = '⌛ Lade alle Daten…';
      showOut('Full-Init läuft – bitte warten…');
      try {
        await HHApi.adminFullInit();
        showOut('✓ Full-Init abgeschlossen.');
      } catch (e) {
        showOut(`✗ Full-Init: ${e.message}`, true);
      } finally {
        fullBtn.disabled = false;
        fullBtn.textContent = '⚡ Full-Init (alle Endpoints)';
      }
    });
    const matchBtn = document.getElementById('btn-fetch-match');
    if (matchBtn) matchBtn.addEventListener('click', async () => {
      const mid = +document.getElementById('match-id-input').value;
      if (!mid) { showOut('Match-ID eingeben.', true); return; }
      try {
        await HHApi.adminFetchMatch(mid);
        showOut(`✓ matchdetails ${mid} geladen.`);
      } catch (e) {
        showOut(`✗ ${e.message}`, true);
      }
    });
  }

  // ======================================================================
  //                       TAB: ⏰ Scheduler
  // ======================================================================

  async function renderScheduler(target) {
    target.innerHTML = '<div class="muted">Lade Scheduler-Status…</div>';
    try {
      const s = await HHApi.adminScheduler();
      if (!s.running) {
        target.innerHTML = '<div class="muted">Scheduler nicht aktiv (typisch wenn nicht authentifiziert oder Server gerade gestartet).</div>';
        return;
      }
      target.innerHTML = `
        <p class="muted">
          Cron-Jobs des automatischen Pollings. Du kannst Jobs auch manuell auslösen,
          z. B. nach einem Restart wenn ein Lauf verpasst wurde.
        </p>
        <table class="tbl" style="width:100%">
          <thead><tr><th>Job</th><th>Trigger</th><th>Nächster Lauf</th><th></th></tr></thead>
          <tbody>
            ${s.jobs.map((j) => `
              <tr>
                <td><b>${F.escapeHtml(j.id)}</b></td>
                <td><span class="muted">${F.escapeHtml(j.trigger)}</span></td>
                <td>${j.next_run ? F.date(j.next_run) : '–'}</td>
                <td><button data-job="${F.escapeHtml(j.id)}">▶ Jetzt ausführen</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      target.querySelectorAll('button[data-job]').forEach((b) => {
        b.addEventListener('click', async () => {
          if (!confirm(`Job '${b.dataset.job}' jetzt ausführen?`)) return;
          await HHApi.adminRunJob(b.dataset.job);
          alert('Job gestartet (läuft im Hintergrund). Logs im Tab Server.');
        });
      });
    } catch (e) {
      target.innerHTML = `<div class="muted">Fehler: ${F.escapeHtml(e.message)}</div>`;
    }
  }

  // ======================================================================
  //                        TAB: 🔧 Server
  // ======================================================================

  async function renderServer(target) {
    target.innerHTML = `
      <div class="card">
        <div class="card-header">🔧 Server-Steuerung</div>
        <div class="card-body">
          <p class="muted">
            Restart hilft z. B. nach OAuth-Login (damit der Scheduler aktiv wird) oder
            nach Code-Änderungen. Shutdown beendet den Server komplett — danach manuell
            neu starten (Start_HattrickDash.ps1).
          </p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="primary" id="btn-restart">🔄 Server neu starten</button>
            <button class="danger" id="btn-shutdown">🛑 Server beenden</button>
          </div>
          <div id="server-feedback" class="muted" style="margin-top:8px"></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;border-color:#cc4444">
        <div class="card-header" style="background:#fff2f2">⚠ Danger Zone</div>
        <div class="card-body">
          <p class="muted">
            Datenbank komplett zurücksetzen — alle Snapshots gehen verloren. Nach dem
            Reset musst du Full-Init laufen lassen, um wieder Daten zu haben.
          </p>
          <button class="danger" id="btn-reset-db">🗑 Datenbank löschen + neu anlegen</button>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-header">
          <span>📋 Logs (logs/app.log)</span>
          <span style="display:flex;gap:6px">
            <label style="font-size:12px;color:var(--text-soft)">
              <input type="checkbox" id="logs-poll"> Auto-refresh
            </label>
            <button id="btn-refresh-logs">↻ Aktualisieren</button>
          </span>
        </div>
        <div class="card-body">
          <pre id="logs-output" style="
            background:#1d2330;color:#d8e0ee;
            font-family:Consolas,'Courier New',monospace;font-size:11px;line-height:1.4;
            padding:10px;border-radius:6px;max-height:340px;overflow:auto;margin:0;
            white-space:pre-wrap;word-break:break-word;
          ">Lade Logs…</pre>
        </div>
      </div>
    `;
    bindServer();
    bindDanger();
    bindLogs();
    refreshLogs();
  }
  function bindServer() {
    document.getElementById('btn-restart').addEventListener('click', async () => {
      if (!confirm('Server jetzt neu starten? Die UI lädt sich danach automatisch neu.')) return;
      const fb = document.getElementById('server-feedback');
      try {
        await HHApi.adminRestart();
        fb.textContent = '🔄 Restart läuft. UI lädt in 6 Sekunden neu…';
        setTimeout(() => location.reload(), 6000);
      } catch (e) { fb.textContent = '✗ ' + e.message; }
    });
    document.getElementById('btn-shutdown').addEventListener('click', async () => {
      if (!confirm('Server stoppen? Du musst ihn danach manuell neu starten.')) return;
      const fb = document.getElementById('server-feedback');
      try {
        await HHApi.adminShutdown();
        fb.textContent = '🛑 Server stoppt sich. UI nicht mehr erreichbar.';
      } catch (e) { fb.textContent = '✗ ' + e.message; }
    });
  }
  function bindDanger() {
    document.getElementById('btn-reset-db').addEventListener('click', async () => {
      if (!confirm('Wirklich ALLE Daten löschen? Du musst danach Full-Init laufen lassen.')) return;
      try {
        const r = await HHApi.adminResetDb();
        alert('✓ ' + r.message);
        location.reload();
      } catch (e) { alert('✗ ' + e.message); }
    });
  }
  function bindLogs() {
    document.getElementById('btn-refresh-logs').addEventListener('click', refreshLogs);
    const cb = document.getElementById('logs-poll');
    cb.addEventListener('change', () => {
      if (cb.checked) {
        pollLogsTimer = setInterval(refreshLogs, 3000);
      } else if (pollLogsTimer) {
        clearInterval(pollLogsTimer);
        pollLogsTimer = null;
      }
    });
  }
  async function refreshLogs() {
    const out = document.getElementById('logs-output');
    if (!out) return;
    try {
      const r = await HHApi.adminLogs(200);
      out.textContent = r.lines.join('\n') || '(leer)';
      out.scrollTop = out.scrollHeight;
    } catch (e) {
      out.textContent = 'Logs nicht ladbar: ' + e.message;
    }
  }

  // ======================================================================
  //                       TAB: 📐 Formeln
  // ======================================================================

  function renderFormulas(target) {
    const f = loadFormulas();
    const slider = (key, label, max = 100) => `
      <div style="display:grid;grid-template-columns:140px 1fr 50px;gap:8px;align-items:center;margin:6px 0">
        <label>${label}:</label>
        <input type="range" min="0" max="${max}" value="${f[key]}" id="f-${key}">
        <span id="f-${key}-val" style="font-weight:600">${f[key]}</span>
      </div>
    `;
    target.innerHTML = `
      <p class="muted">
        Diese Formeln steuern, wie HatStats / Loddar-Stats aus den Spieler-Skills berechnet werden.
        Speicherung im Browser-LocalStorage.
      </p>
      <div class="grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Bewertungsfaktoren</div>
          ${slider('spielaufbau',  'Spielaufbau')}
          ${slider('flugelspiel',  'Flügelspiel')}
          ${slider('torschuss',    'Torschuss')}
          ${slider('torwart',      'Torwart')}
          ${slider('passspiel',    'Pass-Spiel')}
          ${slider('verteidigung', 'Verteidigung')}
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Form- / Erfahrungs-Gewicht</div>
          <div class="muted" style="margin-bottom:8px">Werden für alle Positionen übernommen.</div>
          ${slider('form',      'Form')}
          ${slider('erfahrung', 'Erfahrung')}
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="primary" id="f-save">💾 Aktualisieren</button>
        <button id="f-reset">↺ Zurücksetzen (Default-Werte)</button>
        <span id="f-feedback" class="muted" style="align-self:center"></span>
      </div>
    `;
    Object.keys(f).forEach((key) => {
      const inp = document.getElementById(`f-${key}`);
      const val = document.getElementById(`f-${key}-val`);
      if (inp && val) inp.addEventListener('input', () => { val.textContent = inp.value; });
    });
    document.getElementById('f-save').addEventListener('click', () => {
      const out = {};
      Object.keys(f).forEach((k) => { out[k] = +document.getElementById(`f-${k}`).value; });
      saveFormulas(out);
      document.getElementById('f-feedback').textContent = '✓ Gespeichert (lokal im Browser)';
    });
    document.getElementById('f-reset').addEventListener('click', () => {
      saveFormulas({ ...DEFAULT_FORMULAS });
      renderFormulas(target);
    });
  }

  // ======================================================================
  //                          TAB: ℹ Info
  // ======================================================================

  function renderInfo(target) {
    target.innerHTML = `
      <p>
        <b>HattrickDash</b> – self-hosted Hattrick analytics & management dashboard.<br>
        FastAPI + Vanilla JS. Data via the official Hattrick CHPP API, with
        optional offline imports of <code>.hrf</code> snapshot files and
        HSQLDB log files.
      </p>
      <p class="muted" style="font-size:12px">
        Hattrick™ is a trademark of Extralives AB. This project is not affiliated
        with Hattrick.
      </p>
      <p class="muted" style="font-size:12px">
        Per Hattrick CHPP rules this version does not display individual player
        skill progression history (a Hattrick Supporter feature).
      </p>
      <p style="font-size:12px">
        License: <b>MIT</b> · Source: <code>github.com/&lt;your-fork&gt;/hattrickdash</code>
      </p>
    `;
  }

  window.HHPages = window.HHPages || {};
  window.HHPages.settings = render;
})();
