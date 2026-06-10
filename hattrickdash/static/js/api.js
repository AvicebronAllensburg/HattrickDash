/* api.js – fetch-Wrapper für alle Backend-Endpoints */
window.HHApi = (function () {
  async function get(path, params) {
    const url = new URL(path, window.location.origin);
    if (params) for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${path}`);
    return await r.json();
  }

  async function post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`${r.status} ${r.statusText}: ${txt}`);
    }
    return await r.json();
  }

  return {
    get, post,

    // Team
    teamOverview: () => get('/api/team/overview'),
    teamStaff:    () => get('/api/team/staff'),
    leagueTable:  (leagueId) => get('/api/team/league-table', { league_id: leagueId }),
    teamStatus:   () => get('/api/team/status'),

    // Players
    squad:        () => get('/api/players'),
    // playerHistory entfernt (CHPP-Compliance) — siehe local-Branch fuer
    // die Skill-Verlauf-Variante zur privaten Nutzung.
    injuryCalc:   (data) => post('/api/players/injury-calc', data),

    // Matches
    matches:      (filter) => get('/api/matches', filter),
    matchStats:   () => get('/api/matches/stats'),
    nextOpponent: () => get('/api/matches/next-opponent'),
    predictOpponentLineup: (params) => get('/api/matches/predict-opponent-lineup', params),
    adminPullOpponent: (oppId, n) =>
      post(`/api/admin/fetch/opponent-history/${oppId}?n_recent=${n || 5}`, {}),

    // Lineup
    formations:   () => get('/api/lineup/formations'),
    autoLineup:   (params) => get('/api/lineup/auto', params),
    saveLineup:   (data) => post('/api/lineup/save', data),
    savedLineups: () => get('/api/lineup/saved'),
    loadLineup:   (file) => get(`/api/lineup/saved/${encodeURIComponent(file)}`),
    submitLineup: (data) => post('/api/lineup/submit', data),
    predictLineup: (data) => post('/api/lineup/predict', data),

    // Transfers
    transfers:    (direction) => get('/api/transfers', direction ? { direction } : null),
    transferPL:   () => get('/api/transfers/pl-by-season'),
    scout:        () => get('/api/transfers/scout'),
    formerPlayers:() => get('/api/transfers/former-players'),

    // Finance
    financeLatest:  () => get('/api/finance/latest'),
    financeHistory: (days) => get('/api/finance/history', days ? { days } : null),
    salaryBreakdown:() => get('/api/finance/salary-breakdown'),
    financeOverride:    () => get('/api/finance/override'),
    setFinanceOverride: (data) => post('/api/finance/override', data),
    clearFinanceOverride: async () => {
      const r = await fetch('/api/finance/override', { method: 'DELETE' });
      return await r.json();
    },

    // Arena
    arenaLatest:  () => get('/api/arena/latest'),
    arenaSizer:   (target) => get('/api/arena/sizer', { target_total: target }),

    // Training
    training:     () => get('/api/training'),
    trainingDist: () => get('/api/training/distribution'),

    // Admin
    adminStatus:    () => get('/api/admin/status'),
    adminConsumer:  (data) => post('/api/admin/consumer', data),
    adminOauthStart:() => post('/api/admin/oauth/start', {}),
    adminOauthFinish:(pin) => post('/api/admin/oauth/finish', { pin }),
    adminOauthClear:() => post('/api/admin/oauth/clear', {}),
    adminFetchOne:  (endpoint) => post(`/api/admin/fetch/${encodeURIComponent(endpoint)}`, {}),
    adminFetchMatch:(matchId) => post(`/api/admin/fetch/match/${matchId}`, {}),
    adminFullInit:  () => post('/api/admin/full-init', {}),
    adminLogs:      (lines = 200) => get('/api/admin/logs', { lines }),
    adminScheduler: () => get('/api/admin/scheduler'),
    adminRunJob:    (jobId) => post(`/api/admin/scheduler/run/${encodeURIComponent(jobId)}`, {}),
    adminShutdown:  () => post('/api/admin/shutdown', {}),
    adminRestart:   () => post('/api/admin/restart', {}),
    adminResetDb:   () => post('/api/admin/reset-db', {}),

    // Youth (v2)
    youthTeam:    () => get('/api/youth/team'),
    youthSquad:   () => get('/api/youth/squad'),
    youthMatches: (limit) => get('/api/youth/matches', limit ? { limit } : null),
    youthTraining:(limit) => get('/api/youth/training', limit ? { limit } : null),
    youthRecommendations: () => get('/api/youth/recommendations'),
  };
})();

/* ---------------------------------------- Format-Helper (global) */
window.HHFmt = {
  num(n, digits = 0) {
    if (n === null || n === undefined || Number.isNaN(n)) return '–';
    return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  },
  money(n) {
    if (n === null || n === undefined) return '–';
    return Number(n).toLocaleString('de-DE') + ' €';
  },
  delta(n) {
    if (n === null || n === undefined || n === 0) return `<span class="delta-zero">±0</span>`;
    const cls = n > 0 ? 'delta-up' : 'delta-down';
    const sign = n > 0 ? '+' : '';
    return `<span class="${cls}">${sign}${this.num(n)}</span>`;
  },
  date(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  },
  result(r) {
    if (r === 'W') return '<span class="win">S</span>';
    if (r === 'L') return '<span class="loss">N</span>';
    if (r === 'D') return '<span class="draw">U</span>';
    return '–';
  },

  // Match-Type-Icon + Label (zentral)
  // 🏆 Schale = Liga (Meisterschaft) | 🥇 Pokal | 🤝 Freundschaftsspiel
  // 🛡 Qualifikation | 🎯 Turnier | 👑 Masters
  matchTypeIcon(t) {
    const map = {
      LEAGUE:        { icon: '🏆', label: 'Liga',          short: 'Liga'  },
      CUP:           { icon: '🥇', label: 'Pokal',         short: 'Pokal' },
      FRIENDLY:      { icon: '🤝', label: 'Freundschaft',  short: 'Freund.' },
      QUALIFICATION: { icon: '🛡', label: 'Qualifikation', short: 'Quali' },
      TOURNAMENT:    { icon: '🎯', label: 'Turnier',       short: 'Turn.' },
      MASTERS:       { icon: '👑', label: 'Masters',       short: 'Mast.' },
    };
    return map[t] || { icon: '⚽', label: t || '–', short: (t || '–').slice(0, 6) };
  },
  matchTypeBadge(t) {
    const m = this.matchTypeIcon(t);
    return `<span title="${this.escapeHtml(m.label)}">${m.icon}</span>`;
  },
  matchTypeFull(t) {
    const m = this.matchTypeIcon(t);
    return `<span title="${this.escapeHtml(m.label)}">${m.icon} ${this.escapeHtml(m.label)}</span>`;
  },
  ratingClass(v) {
    if (v == null) return '';
    if (v < 5) return 'rating-low';
    if (v < 6.5) return 'rating-mid';
    if (v < 8)  return 'rating-good';
    return 'rating-top';
  },
  escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  },

  // Hattrick-Stimmungsskala 0-8 → Emoji + Text
  moodEmoji(value) {
    if (value === null || value === undefined) return { emoji: '–', label: '–' };
    const v = Math.max(0, Math.min(8, Math.round(value)));
    const map = [
      { emoji: '😡', label: 'hundsmiserabel' },     // 0
      { emoji: '😡', label: 'katastrophal' },        // 1
      { emoji: '😟', label: 'miserabel' },           // 2
      { emoji: '😕', label: 'schlecht' },            // 3
      { emoji: '😐', label: 'zufriedenstellend' },   // 4
      { emoji: '🙂', label: 'gut' },                 // 5
      { emoji: '😊', label: 'hochmotiviert' },       // 6
      { emoji: '😄', label: 'ausgezeichnet' },       // 7
      { emoji: '😍', label: 'paradiesisch' },        // 8
    ];
    return map[v];
  },

  // Trend-Pfeil (kleines Symbol, kompakter als delta)
  trendArrow(n) {
    if (n === null || n === undefined || n === 0) return '<span class="trend-flat">▬</span>';
    if (n > 0) return `<span class="trend-up">▲ ${this.num(n)}</span>`;
    return `<span class="trend-down">▼ ${this.num(Math.abs(n))}</span>`;
  },
  // kleiner: nur das Symbol (für Tabellen mit wenig Platz)
  trendIcon(n) {
    if (n === null || n === undefined || n === 0) return '<span class="trend-flat">▬</span>';
    if (n > 0) return '<span class="trend-up">▲</span>';
    return '<span class="trend-down">▼</span>';
  },
};
