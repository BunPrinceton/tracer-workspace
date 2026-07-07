/* ============================================================
   ActivityDashboard — shared core for borkbook's Datasets tab
   No-build static site; loaded as <script src=".../shared/activity-core.js" defer></script>

   Public API (page shells depend on this exact shape):
     window.ActivityDashboard.init({
       mount:       '#activity-app',
       mode:        'dashboard' | 'dataset',
       dataset:     'CA3',                 // required when mode === 'dataset'
       workerUrl:   'https://worker.borkbook.com/activity',
       snapshotUrl: './data/activity-snapshot.json',
       datasetBase: './'                   // optional; base for dataset-card links in dashboard mode
     })

   Data: fetch(workerUrl) first; on ANY failure fall back to fetch(snapshotUrl),
   surfacing a "showing cached snapshot" note. Both return the anonymized SCHEMA payload:
     { generatedAt, contributorCount, roster, tabs:{ <TAB>:{people:[{id,name}],dates:[...],values:[[...]]} } }
   The per-tab {people,dates,values} shape is identical to the original dashboard's
   STATE.data[tab], so the battle-tested render functions run on it unchanged.

   PRIVACY: people[].name / people[].id are PSEUDONYMS from the payload. This file never
   reconstructs, fetches, or displays real names, numeric worker IDs, or the sheet id.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Dataset + metric config (NO sheet id) ---------- */
  const DATASETS = [
    { key: 'RETINA', label: 'RETINA', metrics: { edits: 'RETINA_edits' } },
    { key: 'MINNIE', label: 'MINNIE', metrics: { edits: 'MINNIE_edits' } },
    { key: 'CA3',    label: 'CA3',    metrics: { edits: 'CA3_edits' } },
    { key: 'BANC',   label: 'BANC',   metrics: { edits: 'BANC_edits', cells: 'BANC_cells', labels: 'BANC_labels' } },
    { key: 'FAFB',   label: 'FAFB',   metrics: { edits: 'FAFB_edits', cells: 'FAFB_cells', labels: 'FAFB_labels' } },
  ];

  const THEMES = {
    edits:    { main: '#E77500', soft: '#FFE2C2', tint: '#FFF1E2', ramp: ['#F2EFE6', '#FFE2C2', '#FBC288', '#F39A47', '#E77500'] },
    cells:    { main: '#1E6FBE', soft: '#D7E6F4', tint: '#EAF1F9', ramp: ['#EEF2F7', '#D7E6F4', '#A6C5E8', '#5E94CC', '#1E6FBE'] },
    labels:   { main: '#2E8540', soft: '#D7E7D8', tint: '#EAF3EA', ramp: ['#EEF3EE', '#D7E7D8', '#A8D2A9', '#67B068', '#2E8540'] },
    combined: { main: '#3F3C32', soft: '#DCD8CD', tint: '#EAE6DA', ramp: ['#F2EFE6', '#DCD8CD', '#B6B0A0', '#7E7868', '#3F3C32'] },
  };

  /* ---------- Module state (single instance per page) ---------- */
  let MOUNT = null;
  let OPTS = null;
  const STATE = {
    mode: 'dashboard',
    dataset: null,
    metric: 'edits',
    data: {},          // { tabName: { people:[{id,name}], dates:[Date], values:[[...]] } }
    combined: {},      // { dsKey: buildCombined(...) }
    cached: false,
    generatedAt: null,
    contributorCount: 0,
    roster: {},
    loading: true,
  };

  /* ============================================================
     Small helpers
     ============================================================ */
  const el = (id) => MOUNT.querySelector('#' + id);
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtNum(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
  function fmtDate(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function fmtDateLong(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function parseISO(s) {
    if (s instanceof Date) return s;
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function currentTheme() { return THEMES[STATE.metric] || THEMES.edits; }
  function isCombined() { return STATE.metric === 'combined'; }
  function getDisplayMetrics(ds) {
    const real = Object.keys(ds.metrics);
    return real.length >= 2 ? [...real, 'combined'] : real;
  }
  function applyAccent() {
    const t = currentTheme();
    MOUNT.style.setProperty('--aa-accent', t.main);
    MOUNT.style.setProperty('--aa-accent-soft', t.soft);
    MOUNT.style.setProperty('--aa-accent-bg', t.tint);
  }
  function rampColor(v, max, ramp) {
    const r = ramp || currentTheme().ramp;
    if (!v || v <= 0 || max <= 0) return r[0];
    const t = Math.min(1, v / max);
    const lt = Math.log10(1 + 9 * t);
    if (lt < 0.25) return r[1];
    if (lt < 0.5) return r[2];
    if (lt < 0.75) return r[3];
    return r[4];
  }

  /* ============================================================
     DATA LOAD  (workerUrl -> snapshotUrl fallback)
     ============================================================ */
  async function loadPayload() {
    // Try live worker first; on ANY failure fall back to the committed snapshot.
    if (OPTS.workerUrl) {
      try {
        const r = await fetch(OPTS.workerUrl, { cache: 'no-store' });
        if (r.ok) return { payload: await r.json(), cached: false };
      } catch (_) { /* fall through to snapshot */ }
    }
    const r = await fetch(OPTS.snapshotUrl, { cache: 'no-store' });
    if (!r.ok) throw new Error('snapshot HTTP ' + r.status);
    return { payload: await r.json(), cached: true };
  }

  function normalizeTab(t) {
    if (!t) return { people: [], dates: [], values: [] };
    return {
      people: (t.people || []).map((p) => ({ id: p.id, name: p.name })),
      dates: (t.dates || []).map(parseISO).filter(Boolean),
      values: t.values || [],
    };
  }

  async function loadAll() {
    STATE.loading = true;
    setStatus('Loading data…', 'stale');
    let payload, cached = false;
    try {
      const res = await loadPayload();
      payload = res.payload;
      cached = res.cached;
    } catch (e) {
      setStatus('Could not load data', 'err');
      showError('Unable to load activity data from the worker or the cached snapshot (' + e.message + ').');
      STATE.loading = false;
      return;
    }
    STATE.cached = cached;
    STATE.generatedAt = payload.generatedAt || null;
    STATE.contributorCount = payload.contributorCount || 0;
    STATE.roster = payload.roster || {};
    STATE.data = {};
    const tabs = payload.tabs || {};
    Object.keys(tabs).forEach((k) => { STATE.data[k] = normalizeTab(tabs[k]); });
    // Precompute combined views for multi-metric datasets (BANC, FAFB)
    STATE.combined = {};
    for (const ds of DATASETS) {
      if (Object.keys(ds.metrics).length >= 2) STATE.combined[ds.key] = buildCombined(ds.key);
    }
    STATE.loading = false;
    clearError();
    setStatus(statusText(), '');
    toggleSnapshotNote(cached);

    if (STATE.mode === 'dataset') { renderMetricTabs(); render(); }
    else { renderDashboard(); }
  }

  function statusText() {
    if (STATE.generatedAt) {
      const d = parseISO(STATE.generatedAt) || new Date(STATE.generatedAt);
      if (d && !isNaN(d)) return 'Data as of ' + fmtDateLong(d);
    }
    return 'Data loaded';
  }

  /* ---------- combined build (per-dataset across its metrics) ---------- */
  function buildCombined(datasetKey) {
    const ds = DATASETS.find((d) => d.key === datasetKey);
    const metricKeys = Object.keys(ds.metrics);
    if (metricKeys.length < 2) return null;
    const tabs = metricKeys.map((mk) => ({ mk, tab: STATE.data[ds.metrics[mk]] || { people: [], dates: [], values: [] } }));

    const dateByTime = new Map();
    tabs.forEach((t) => t.tab.dates.forEach((d) => { if (!dateByTime.has(d.getTime())) dateByTime.set(d.getTime(), d); }));
    const dates = [...dateByTime.values()].sort((a, b) => a.getTime() - b.getTime());
    const dateIdx = new Map(dates.map((d, i) => [d.getTime(), i]));

    const personByKey = new Map();
    const personKey = (p) => (p.id ? 'id:' + p.id : 'name:' + p.name);
    for (const t of tabs) for (const p of t.tab.people) {
      const k = personKey(p);
      if (!personByKey.has(k)) personByKey.set(k, { id: p.id, name: p.name });
    }
    const people = [...personByKey.values()];
    const peopleIdx = new Map([...personByKey.keys()].map((k, i) => [k, i]));

    const values = dates.map(() => new Array(people.length).fill(0));
    const breakdown = dates.map(() => Array.from({ length: people.length }, () => ({})));
    const perMetricDailyTotals = {};
    const perMetricPersonTotals = {};
    metricKeys.forEach((mk) => {
      perMetricDailyTotals[mk] = new Array(dates.length).fill(0);
      perMetricPersonTotals[mk] = new Array(people.length).fill(0);
    });

    for (const t of tabs) {
      for (let tdi = 0; tdi < t.tab.dates.length; tdi++) {
        const di = dateIdx.get(t.tab.dates[tdi].getTime());
        if (di == null) continue;
        const rowv = t.tab.values[tdi] || [];
        for (let tpi = 0; tpi < t.tab.people.length; tpi++) {
          const pi = peopleIdx.get(personKey(t.tab.people[tpi]));
          if (pi == null) continue;
          const v = rowv[tpi] || 0;
          breakdown[di][pi][t.mk] = (breakdown[di][pi][t.mk] || 0) + v;
          values[di][pi] += v;
          perMetricDailyTotals[t.mk][di] += v;
          perMetricPersonTotals[t.mk][pi] += v;
        }
      }
    }
    return { people, dates, values, breakdown, metricKeys, perMetricDailyTotals, perMetricPersonTotals };
  }

  /* ============================================================
     STATUS / ERROR / SNAPSHOT-NOTE / TOOLTIP
     ============================================================ */
  function setStatus(msg, cls) {
    const t = el('status-text'); if (t) t.textContent = msg;
    const dot = el('status-dot'); if (dot) dot.className = 'updated-dot ' + (cls || '');
  }
  function showError(msg) { const h = el('err-host'); if (h) h.innerHTML = '<div class="err-banner">' + escapeHtml(msg) + '</div>'; }
  function clearError() { const h = el('err-host'); if (h) h.innerHTML = ''; }
  function toggleSnapshotNote(on) {
    const n = el('snapshot-note');
    if (!n) return;
    n.className = 'snapshot-note' + (on ? ' show' : '');
    n.textContent = on ? 'Showing cached snapshot (live source unavailable).' : '';
  }

  let TIP = null;
  function ensureTip() { if (!TIP) TIP = el('aa-tooltip'); return TIP; }
  function showTip(x, y, text) { const t = ensureTip(); if (!t) return; t.textContent = text; t.classList.add('show'); moveTip(x, y); }
  function moveTip(x, y) { const t = ensureTip(); if (!t) return; t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px'; }
  function hideTip() { const t = ensureTip(); if (t) t.classList.remove('show'); }

  /* ============================================================
     SVG PRIMITIVES (sparkline, stacked sparkline)
     ============================================================ */
  function sparkSVG(series, w, h, fillColor, lineColor) {
    if (!series.length) return '';
    const max = Math.max(...series, 1);
    const stepX = w / Math.max(1, series.length - 1);
    let pts = '';
    for (let i = 0; i < series.length; i++) {
      const x = i * stepX;
      const y = h - (series[i] / max) * (h - 2) - 1;
      pts += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    const fillPts = pts + `L ${w} ${h} L 0 ${h} Z`;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${fillPts}" fill="${fillColor || '#FFE2C2'}"/>
      <path d="${pts}" fill="none" stroke="${lineColor || '#E77500'}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }
  function stackedSparkSVG(stacks, colors, w, h) {
    if (!stacks.length || !stacks[0].length) return '';
    const n = stacks[0].length;
    const totals = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (const s of stacks) totals[i] += s[i] || 0;
    const max = Math.max(...totals, 1);
    const stepX = w / Math.max(1, n - 1);
    const layerTopY = stacks.map(() => new Array(n).fill(h));
    const layerBotY = stacks.map(() => new Array(n).fill(h));
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let li = 0; li < stacks.length; li++) {
        const bottom = h - (acc / max) * (h - 1);
        acc += stacks[li][i] || 0;
        const top = h - (acc / max) * (h - 1);
        layerTopY[li][i] = top;
        layerBotY[li][i] = bottom;
      }
    }
    let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">`;
    for (let li = 0; li < stacks.length; li++) {
      let path = '';
      for (let i = 0; i < n; i++) path += (i === 0 ? 'M' : 'L') + (i * stepX).toFixed(1) + ' ' + layerTopY[li][i].toFixed(1) + ' ';
      for (let i = n - 1; i >= 0; i--) path += 'L ' + (i * stepX).toFixed(1) + ' ' + layerBotY[li][i].toFixed(1) + ' ';
      path += 'Z';
      svg += `<path d="${path}" fill="${colors[li]}" opacity="0.9"/>`;
    }
    return svg + '</svg>';
  }

  /* ============================================================
     ===================  DATASET MODE  =========================
     Full focused view for ONE dataset (adapted from original).
     ============================================================ */
  function injectDatasetShell() {
    const ds = DATASETS.find((d) => d.key === STATE.dataset) || DATASETS[0];
    MOUNT.innerHTML = `
      <nav class="tab-row" id="metric-tabs" role="tablist" aria-label="Metric">
        <span class="label">Metric</span>
        <span class="aa-toolbar aa-toolbar-inline" id="aa-toolbar">
          <span class="aa-status"><span class="updated-dot" id="status-dot"></span><span id="status-text">Loading data…</span></span>
          <span class="snapshot-note" id="snapshot-note"></span>
          <button class="btn ghost" id="refresh-btn" type="button" title="Reload latest data">↻ Refresh</button>
        </span>
      </nav>
      <div id="err-host"></div>

      <div class="kpi-grid" id="kpi-grid">
        <div class="kpi"><div class="lbl">Most Recent Day</div><div class="val" id="kpi-today">—</div><div class="sub" id="kpi-today-sub">&nbsp;</div></div>
        <div class="kpi"><div class="lbl">7-Day Average</div><div class="val" id="kpi-7d">—</div><div class="sub" id="kpi-7d-sub">team total / day</div></div>
        <div class="kpi"><div class="lbl">Past Month Average</div><div class="val" id="kpi-30d">—</div><div class="sub" id="kpi-30d-sub">team total / day</div></div>
        <div class="kpi"><div class="lbl">YTD Average</div><div class="val" id="kpi-ytd">—</div><div class="sub" id="kpi-ytd-sub">team total / day</div></div>
        <div class="kpi" id="kpi-total-card"><div class="lbl">Cumulative Total</div><div class="val" id="kpi-total">—</div><div class="sub" id="kpi-total-sub">across all days</div></div>
        <div class="kpi"><div class="lbl">Active Contributors</div><div class="val" id="kpi-active">—</div><div class="sub" id="kpi-active-sub">past 7 days</div></div>
      </div>

      <section class="card">
        <header><h2>Team Daily Total</h2><div class="hint">Bars: daily total · Line: 7-day rolling average</div></header>
        <div class="trend-wrap">
          <div class="legend" id="trend-legend"></div>
          <svg id="trend-chart" width="100%" height="220" aria-label="Daily team total chart"></svg>
        </div>
      </section>

      <section class="card">
        <header><h2>Contribution Heatmap</h2><div class="hint">Each row is a contributor; each column a day · click a row to drill in</div></header>
        <div class="heatmap-controls">
          <div class="legend-row"><span>Less</span><span class="cells" id="legend-cells"></span><span>More</span></div>
          <div class="sort-controls">Sort:
            <select id="sort-select">
              <option value="total">Total (this metric)</option>
              <option value="recent">Most recent 7d</option>
              <option value="alpha">Name (A–Z)</option>
            </select>
          </div>
        </div>
        <div class="heatmap-scroll"><svg id="heatmap" aria-label="Contribution heatmap"></svg></div>
      </section>

      <div class="grid-2">
        <section class="card">
          <header><h2>Leaderboard</h2><div class="hint">Last 30 days · click a row</div></header>
          <div class="body" style="padding:0;"><table class="leaderboard" id="leaderboard-table"></table></div>
        </section>
        <section class="card">
          <header><h2>Per-Contributor Trends</h2><div class="hint">Click any card to drill in</div></header>
          <div class="body"><div class="sparklines" id="spark-grid"></div></div>
        </section>
      </div>

      <div class="drill-backdrop" id="drill-backdrop"></div>
      <aside class="drill-panel" id="drill-panel" aria-hidden="true" aria-label="Contributor detail">
        <button class="close" id="drill-close" type="button" title="Close (Esc)">✕</button>
        <div class="who-eyebrow" id="drill-eyebrow">Contributor</div>
        <h2 id="drill-name">—</h2>
        <div class="id-line" id="drill-id">—</div>
        <div class="drill-stats">
          <div class="drill-stat"><div class="l" id="drill-total-label">Total</div><div class="v" id="drill-total">—</div><div class="sub" id="drill-total-sub">—</div></div>
          <div class="drill-stat"><div class="l">Best Day</div><div class="v" id="drill-best">—</div><div class="sub" id="drill-best-sub">—</div></div>
          <div class="drill-stat"><div class="l">Active Days</div><div class="v" id="drill-days">—</div><div class="sub" id="drill-days-sub">—</div></div>
        </div>
        <div class="drill-section-title">Daily Timeline</div>
        <svg id="drill-line" width="100%" height="160"></svg>
        <div class="drill-section-title">Across Datasets &amp; Metrics</div>
        <div id="drill-breakdown"></div>
      </aside>
      <div class="aa-tooltip" id="aa-tooltip"></div>
    `;

    el('refresh-btn').addEventListener('click', () => loadAll());
    el('drill-close').addEventListener('click', closeDrill);
    el('drill-backdrop').addEventListener('click', closeDrill);
    el('sort-select').addEventListener('change', () => {
      const tab = currentTab();
      renderHeatmap(tab || { people: [], dates: [], values: [] });
    });
    applyAccent();
  }

  function ensureValidMetric() {
    const ds = DATASETS.find((d) => d.key === STATE.dataset);
    if (!ds) return;
    const valid = getDisplayMetrics(ds);
    if (!valid.includes(STATE.metric)) STATE.metric = valid[0];
  }

  function currentTab() {
    const ds = DATASETS.find((d) => d.key === STATE.dataset);
    if (!ds) return { people: [], dates: [], values: [] };
    if (isCombined()) return (STATE.combined && STATE.combined[STATE.dataset]) || { people: [], dates: [], values: [] };
    return STATE.data[ds.metrics[STATE.metric]] || { people: [], dates: [], values: [] };
  }

  // Canonical metric order — every dataset page shows all four for a consistent
  // format; metrics a dataset has no data for yet render as disabled placeholders.
  const ALL_METRICS = ['edits', 'cells', 'labels', 'combined'];

  function renderMetricTabs() {
    const row = el('metric-tabs');
    row.querySelectorAll('.tab').forEach((n) => n.remove());
    const ds = DATASETS.find((d) => d.key === STATE.dataset);
    const available = getDisplayMetrics(ds); // real metrics (+ 'combined' when 2+ exist)
    row.classList.remove('hidden');
    const toolbar = row.querySelector('.aa-toolbar'); // tabs go before the inline toolbar
    for (const mk of ALL_METRICS) {
      const isAvail = available.includes(mk);
      const isActive = isAvail && mk === STATE.metric;
      const b = document.createElement('button');
      b.className = 'tab' + (isActive ? ' active' : '') + (isAvail ? '' : ' disabled');
      b.type = 'button';
      b.textContent = mk;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      const theme = THEMES[mk];
      if (isAvail) {
        if (theme) {
          b.style.color = theme.main;
          b.style.borderBottomColor = isActive ? theme.main : 'transparent';
        }
        b.onclick = () => { STATE.metric = mk; renderMetricTabs(); render(); };
      } else {
        b.disabled = true;
        b.setAttribute('aria-disabled', 'true');
        b.title = 'No ' + mk + ' data for ' + STATE.dataset + ' yet';
      }
      if (toolbar) row.insertBefore(b, toolbar); else row.appendChild(b);
    }
    applyAccent();
  }

  function renderLegend() {
    const row = MOUNT.querySelector('.legend-row');
    if (!row) return;
    if (isCombined()) { row.style.display = 'none'; return; }
    row.style.display = '';
    const host = el('legend-cells');
    host.innerHTML = '';
    for (const c of currentTheme().ramp) {
      const sp = document.createElement('span');
      sp.style.background = c;
      sp.style.border = '1px solid rgba(0,0,0,.06)';
      host.appendChild(sp);
    }
  }

  function render() {
    applyAccent();
    renderLegend();
    const tab = currentTab();
    const label = `${STATE.dataset} ${STATE.metric}`;
    const kpiGrid = el('kpi-grid');
    if (isCombined()) kpiGrid.classList.add('hidden');
    else kpiGrid.classList.remove('hidden');
    renderKPIs(tab, label);
    renderTrend(tab);
    renderHeatmap(tab);
    renderLeaderboard(tab);
    renderSparklines(tab);
  }

  /* ---------- KPIs ---------- */
  function renderKPIs(tab, label) {
    const { dates, values, people } = tab;
    if (!dates.length) {
      ['kpi-total', 'kpi-today', 'kpi-active', 'kpi-7d', 'kpi-30d', 'kpi-ytd'].forEach((id) => { el(id).textContent = '—'; });
      el('kpi-total-sub').textContent = `${label} · no data`;
      ['kpi-today-sub', 'kpi-active-sub', 'kpi-7d-sub', 'kpi-30d-sub', 'kpi-ytd-sub'].forEach((id) => { el(id).textContent = ''; });
      return;
    }
    const dailyTotals = values.map((row) => row.reduce((a, b) => a + b, 0));
    const total = dailyTotals.reduce((a, b) => a + b, 0);
    let lastNonZeroIdx = -1;
    for (let i = dates.length - 1; i >= 0; i--) { if (dailyTotals[i] > 0) { lastNonZeroIdx = i; break; } }
    const recentIdx = lastNonZeroIdx >= 0 ? lastNonZeroIdx : dates.length - 1;
    const recentVal = dailyTotals[recentIdx] || 0;
    const recentDate = dates[recentIdx];
    const last7 = values.slice(-7);
    const activeCount = people.map((_, pi) => last7.some((row) => row[pi] > 0)).filter(Boolean).length;
    const last7Totals = dailyTotals.slice(-7);
    const avg7 = last7Totals.length ? last7Totals.reduce((a, b) => a + b, 0) / last7Totals.length : 0;
    const last30Totals = dailyTotals.slice(-30);
    const avg30 = last30Totals.length ? last30Totals.reduce((a, b) => a + b, 0) / last30Totals.length : 0;
    const refYear = recentDate ? recentDate.getFullYear() : new Date().getFullYear();
    const ytdTotals = [];
    for (let i = 0; i < dates.length; i++) if (dates[i].getFullYear() === refYear) ytdTotals.push(dailyTotals[i]);
    const avgYtd = ytdTotals.length ? ytdTotals.reduce((a, b) => a + b, 0) / ytdTotals.length : 0;
    const prev7Totals = dailyTotals.slice(-14, -7);
    const prev7 = prev7Totals.length ? prev7Totals.reduce((a, b) => a + b, 0) / prev7Totals.length : 0;
    const delta = prev7 > 0 ? ((avg7 - prev7) / prev7) * 100 : null;

    el('kpi-total').textContent = fmtNum(total);
    if (isCombined() && tab.perMetricDailyTotals) {
      const parts = tab.metricKeys.map((mk) => {
        const sum = tab.perMetricDailyTotals[mk].reduce((a, b) => a + b, 0);
        return `<span style="color:${THEMES[mk].main}">●</span> ${fmtNum(sum)} ${mk}`;
      });
      el('kpi-total-sub').innerHTML = parts.join(' &nbsp; ');
    } else {
      el('kpi-total-sub').textContent = `${label} · all dates`;
    }
    el('kpi-today').textContent = fmtNum(recentVal);
    el('kpi-today-sub').textContent = recentDate ? fmtDateLong(recentDate) : '';
    el('kpi-active').textContent = `${activeCount} / ${people.length}`;
    el('kpi-active-sub').textContent = 'contributors past 7 days';
    el('kpi-7d').innerHTML = fmtNum(avg7) +
      (delta !== null && Math.abs(delta) > 1
        ? ` <span class="sub delta ${delta >= 0 ? 'up' : 'down'}" style="font-size:0.6875rem;">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}%</span>`
        : '');
    el('kpi-7d-sub').textContent = `${label} / day`;
    el('kpi-30d').textContent = fmtNum(avg30);
    el('kpi-30d-sub').textContent = `${label} / day · last 30`;
    el('kpi-ytd').textContent = ytdTotals.length ? fmtNum(avgYtd) : '—';
    el('kpi-ytd-sub').textContent = ytdTotals.length ? `${label} / day · ${refYear}` : `no ${refYear} data`;
  }

  /* ---------- Trend (bars + 7-day MA) ---------- */
  function renderTrend(tab) {
    if (isCombined() && tab.metricKeys && tab.perMetricDailyTotals) return renderTrendSmallMultiples(tab);
    const legend = el('trend-legend');
    legend.innerHTML =
      `<span><span class="swatch bars"></span>Daily total</span>` +
      `<span><span class="swatch line"></span>7-day average</span>`;
    const svg = el('trend-chart');
    svg.innerHTML = '';
    svg.setAttribute('height', 220);
    const { dates, values } = tab;
    const w = svg.clientWidth || 1100;
    const h = 220;
    const pad = { l: 44, r: 16, t: 14, b: 28 };
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    if (!dates.length) {
      svg.innerHTML = `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#8a8a85" font-size="13">No data</text>`;
      return;
    }
    const dailyTotals = values.map((row) => row.reduce((a, b) => a + b, 0));
    const maxY = Math.max(...dailyTotals, 1);
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const n = dates.length;
    const barW = Math.max(1.5, innerW / n - 1);
    const xFor = (i) => pad.l + (i + 0.5) * (innerW / n);
    const yFor = (v) => pad.t + innerH - (v / maxY) * innerH;

    for (let i = 0; i <= 4; i++) {
      const yv = (maxY * i) / 4;
      const y = yFor(yv);
      svg.insertAdjacentHTML('beforeend',
        `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#e5e5e5" stroke-width="1"/>` +
        `<text x="${pad.l - 8}" y="${y + 3}" text-anchor="end" fill="#8a8a85" font-size="10" font-family="monospace">${fmtNum(yv)}</text>`);
    }
    const theme = currentTheme();
    for (let i = 0; i < n; i++) {
      const x = xFor(i) - barW / 2;
      const y = yFor(dailyTotals[i]);
      const bh = pad.t + innerH - y;
      if (bh > 0.5) svg.insertAdjacentHTML('beforeend', `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${theme.soft}"/>`);
    }
    const ma = dailyTotals.map((_, i) => { const s = Math.max(0, i - 6); const slice = dailyTotals.slice(s, i + 1); return slice.reduce((a, b) => a + b, 0) / slice.length; });
    const linePath = ma.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
    svg.insertAdjacentHTML('beforeend', `<path d="${linePath}" fill="none" stroke="${theme.main}" stroke-width="2" stroke-linejoin="round"/>`);

    let lastMonth = -1;
    for (let i = 0; i < n; i++) {
      const m = dates[i].getMonth();
      if (m !== lastMonth) { lastMonth = m; svg.insertAdjacentHTML('beforeend', `<text x="${xFor(i)}" y="${h - 8}" text-anchor="middle" fill="#595959" font-size="11">${dates[i].toLocaleDateString('en-US', { month: 'short' })}</text>`); }
    }
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    overlay.setAttribute('x', pad.l); overlay.setAttribute('y', pad.t);
    overlay.setAttribute('width', innerW); overlay.setAttribute('height', innerH);
    overlay.setAttribute('fill', 'transparent');
    svg.appendChild(overlay);
    overlay.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (w / rect.width);
      const idx = Math.round(((px - pad.l) / innerW) * n - 0.5);
      const ci = Math.max(0, Math.min(n - 1, idx));
      showTip(e.clientX, e.clientY, `${fmtDateLong(dates[ci])} · ${fmtNum(dailyTotals[ci])} (${fmtNum(ma[ci])} avg)`);
    });
    overlay.addEventListener('mouseleave', hideTip);
  }

  function renderTrendSmallMultiples(tab) {
    const legend = el('trend-legend');
    legend.innerHTML = tab.metricKeys.map((mk) =>
      `<span><span class="swatch" style="display:inline-block;width:14px;height:10px;background:${THEMES[mk].main};margin-right:6px;border-radius:1px;"></span>${mk}</span>`
    ).join('') + `<span style="color:#8a8a85;">each panel scaled to its own peak</span>`;
    const svg = el('trend-chart');
    svg.innerHTML = '';
    const w = svg.clientWidth || 1100;
    const panelH = 70, panelGap = 10, monthLabelH = 18;
    const totalH = (panelH + panelGap) * tab.metricKeys.length + monthLabelH;
    svg.setAttribute('viewBox', `0 0 ${w} ${totalH}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('height', totalH);
    const pad = { l: 64, r: 16, t: 16, b: 6 };
    const innerW = w - pad.l - pad.r;
    const n = tab.dates.length;
    if (!n) { svg.innerHTML = `<text x="${w / 2}" y="${totalH / 2}" text-anchor="middle" fill="#8a8a85" font-size="13">No data</text>`; return; }

    for (let mi = 0; mi < tab.metricKeys.length; mi++) {
      const mk = tab.metricKeys[mi];
      const theme = THEMES[mk];
      const yOff = mi * (panelH + panelGap);
      const innerH = panelH - pad.t - pad.b;
      const dailyTotals = tab.perMetricDailyTotals[mk];
      const maxY = Math.max(...dailyTotals, 1);
      const barW = Math.max(1.5, innerW / n - 1);
      const xFor = (i) => pad.l + (i + 0.5) * (innerW / n);
      const yFor = (v) => yOff + pad.t + innerH - (v / maxY) * innerH;
      svg.insertAdjacentHTML('beforeend',
        `<text x="${pad.l - 10}" y="${yOff + pad.t + 4}" text-anchor="end" fill="${theme.main}" font-size="11" font-weight="700" letter-spacing=".1em">${mk.toUpperCase()}</text>` +
        `<text x="${pad.l - 10}" y="${yOff + pad.t + 18}" text-anchor="end" fill="#8a8a85" font-size="10" font-family="monospace">${fmtNum(maxY)}</text>` +
        `<text x="${pad.l - 10}" y="${yOff + pad.t + innerH + 2}" text-anchor="end" fill="#8a8a85" font-size="10" font-family="monospace">0</text>`);
      svg.insertAdjacentHTML('beforeend', `<line x1="${pad.l}" x2="${w - pad.r}" y1="${yOff + pad.t + innerH}" y2="${yOff + pad.t + innerH}" stroke="#e5e5e5"/>`);
      for (let i = 0; i < n; i++) {
        const v = dailyTotals[i];
        if (v <= 0) continue;
        const x = xFor(i) - barW / 2;
        const y = yFor(v);
        const bh = yOff + pad.t + innerH - y;
        svg.insertAdjacentHTML('beforeend', `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${theme.main}" opacity="0.55"/>`);
      }
      const ma = dailyTotals.map((_, i) => { const s = Math.max(0, i - 6); const slice = dailyTotals.slice(s, i + 1); return slice.reduce((a, b) => a + b, 0) / slice.length; });
      const linePath = ma.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
      svg.insertAdjacentHTML('beforeend', `<path d="${linePath}" fill="none" stroke="${theme.main}" stroke-width="1.5" stroke-linejoin="round"/>`);
      const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      overlay.setAttribute('x', pad.l); overlay.setAttribute('y', yOff + pad.t);
      overlay.setAttribute('width', innerW); overlay.setAttribute('height', innerH);
      overlay.setAttribute('fill', 'transparent');
      svg.appendChild(overlay);
      overlay.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (w / rect.width);
        const idx = Math.round(((px - pad.l) / innerW) * n - 0.5);
        const ci = Math.max(0, Math.min(n - 1, idx));
        showTip(e.clientX, e.clientY, `${fmtDateLong(tab.dates[ci])} · ${mk}: ${fmtNum(dailyTotals[ci])} (${fmtNum(ma[ci])} avg)`);
      });
      overlay.addEventListener('mouseleave', hideTip);
    }
    const yBottom = tab.metricKeys.length * (panelH + panelGap);
    let lastMonth = -1;
    for (let i = 0; i < n; i++) {
      const m = tab.dates[i].getMonth();
      if (m !== lastMonth) { lastMonth = m; const x = pad.l + (i + 0.5) * (innerW / n); svg.insertAdjacentHTML('beforeend', `<text x="${x}" y="${yBottom + 12}" text-anchor="middle" fill="#595959" font-size="11">${tab.dates[i].toLocaleDateString('en-US', { month: 'short' })}</text>`); }
    }
  }

  /* ---------- Heatmap ---------- */
  function renderHeatmap(tab) {
    if (isCombined() && tab.breakdown && tab.metricKeys) return renderHeatmapSmallMultiples(tab);
    const svg = el('heatmap');
    svg.innerHTML = '';
    const { people, dates, values } = tab;
    if (!people.length || !dates.length) {
      svg.setAttribute('viewBox', `0 0 800 200`); svg.setAttribute('width', '800'); svg.setAttribute('height', '200');
      svg.innerHTML = `<text x="400" y="100" text-anchor="middle" fill="#8a8a85" font-size="13">No data for ${STATE.dataset} · ${STATE.metric}</text>`;
      return;
    }
    const nameW = 180, cellW = 8, cellH = 18, gap = 1, monthLabelH = 24;
    const innerW = (cellW + gap) * dates.length;
    const totalW = nameW + innerW + 16;
    const totalH = monthLabelH + people.length * (cellH + gap) + 8;
    svg.setAttribute('width', totalW); svg.setAttribute('height', totalH); svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

    const sortMode = el('sort-select').value;
    const totals = people.map((_, pi) => values.reduce((a, row) => a + row[pi], 0));
    const recent7 = people.map((_, pi) => values.slice(-7).reduce((a, row) => a + row[pi], 0));
    const order = people.map((p, i) => ({ p, i, total: totals[i], recent: recent7[i] }));
    if (sortMode === 'alpha') order.sort((a, b) => a.p.name.localeCompare(b.p.name));
    else if (sortMode === 'recent') order.sort((a, b) => b.recent - a.recent);
    else order.sort((a, b) => b.total - a.total);

    const allVals = [];
    for (let r = 0; r < values.length; r++) for (let c = 0; c < people.length; c++) if (values[r][c] > 0) allVals.push(values[r][c]);
    allVals.sort((a, b) => a - b);
    const maxColor = allVals.length ? (allVals[Math.floor(allVals.length * 0.95)] || allVals[allVals.length - 1]) : 1;

    let lastMonth = -1;
    for (let i = 0; i < dates.length; i++) {
      const m = dates[i].getMonth();
      if (m !== lastMonth) { lastMonth = m; const x = nameW + i * (cellW + gap); svg.insertAdjacentHTML('beforeend', `<text x="${x}" y="16" fill="#595959" font-size="11" font-weight="500">${dates[i].toLocaleDateString('en-US', { month: 'short' })}</text>`); }
    }
    svg.insertAdjacentHTML('beforeend', `<line x1="${nameW - 4}" y1="${monthLabelH - 8}" x2="${nameW - 4}" y2="${totalH - 4}" stroke="#e5e5e5" stroke-width="1"/>`);

    for (let row = 0; row < order.length; row++) {
      const { p, i: pi, total } = order[row];
      const y = monthLabelH + row * (cellH + gap);
      const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      band.setAttribute('x', 0); band.setAttribute('y', y - 1); band.setAttribute('width', totalW); band.setAttribute('height', cellH + 2);
      band.setAttribute('fill', 'transparent'); band.style.cursor = 'pointer';
      band.addEventListener('mouseenter', () => band.setAttribute('fill', currentTheme().tint));
      band.addEventListener('mouseleave', () => band.setAttribute('fill', 'transparent'));
      band.addEventListener('click', () => openDrill(pi));
      svg.appendChild(band);

      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', 4); tx.setAttribute('y', y + cellH / 2 + 4); tx.setAttribute('fill', '#1a1a1a');
      tx.setAttribute('font-size', '12'); tx.setAttribute('font-weight', '500'); tx.style.cursor = 'pointer';
      tx.textContent = p.name.length > 24 ? p.name.slice(0, 23) + '…' : p.name;
      tx.addEventListener('click', () => openDrill(pi));
      svg.appendChild(tx);

      const tot = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tot.setAttribute('x', nameW - 8); tot.setAttribute('y', y + cellH / 2 + 4); tot.setAttribute('fill', '#8a8a85');
      tot.setAttribute('font-size', '10'); tot.setAttribute('font-family', 'monospace'); tot.setAttribute('text-anchor', 'end');
      tot.textContent = fmtNum(total);
      svg.appendChild(tot);

      for (let c = 0; c < dates.length; c++) {
        const v = values[c][pi] || 0;
        const x = nameW + c * (cellW + gap);
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', cellW); r.setAttribute('height', cellH); r.setAttribute('rx', 1.5);
        r.setAttribute('fill', rampColor(v, maxColor));
        r.style.cursor = 'pointer';
        r.addEventListener('mouseenter', (e) => showTip(e.clientX, e.clientY, `${p.name} · ${fmtDateLong(dates[c])} · ${fmtNum(v)}`));
        r.addEventListener('mousemove', (e) => moveTip(e.clientX, e.clientY));
        r.addEventListener('mouseleave', hideTip);
        r.addEventListener('click', () => openDrill(pi));
        svg.appendChild(r);
      }
    }
  }

  function renderHeatmapSmallMultiples(tab) {
    const svg = el('heatmap');
    svg.innerHTML = '';
    const { people, dates, breakdown, metricKeys, perMetricPersonTotals } = tab;
    if (!people.length || !dates.length) {
      svg.setAttribute('viewBox', `0 0 800 200`); svg.setAttribute('width', '800'); svg.setAttribute('height', '200');
      svg.innerHTML = `<text x="400" y="100" text-anchor="middle" fill="#8a8a85" font-size="13">No data</text>`;
      return;
    }
    const nameW = 200, cellW = 8, cellH = 16, gap = 1, headerH = 24, monthLabelH = 22, panelGap = 28;
    const innerW = (cellW + gap) * dates.length;
    const totalW = nameW + innerW + 16;
    const panelH = monthLabelH + people.length * (cellH + gap) + 6;
    const totalH = (headerH + panelH + panelGap) * metricKeys.length - panelGap + 4;
    svg.setAttribute('width', totalW); svg.setAttribute('height', totalH); svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

    const maxByMetric = {};
    for (const mk of metricKeys) {
      const vals = [];
      for (let di = 0; di < dates.length; di++) for (let pi = 0; pi < people.length; pi++) { const v = (breakdown[di][pi] && breakdown[di][pi][mk]) || 0; if (v > 0) vals.push(v); }
      vals.sort((a, b) => a - b);
      maxByMetric[mk] = vals.length ? (vals[Math.floor(vals.length * 0.95)] || vals[vals.length - 1]) : 1;
    }
    const sortMode = el('sort-select').value;
    const totals = people.map((_, pi) => metricKeys.reduce((s, mk) => s + perMetricPersonTotals[mk][pi], 0));
    const recent7 = people.map((_, pi) => { let s = 0; const from = Math.max(0, dates.length - 7); for (let di = from; di < dates.length; di++) for (const mk of metricKeys) s += (breakdown[di][pi] && breakdown[di][pi][mk]) || 0; return s; });
    const order = people.map((p, i) => ({ p, i, total: totals[i], recent: recent7[i] }));
    if (sortMode === 'alpha') order.sort((a, b) => a.p.name.localeCompare(b.p.name));
    else if (sortMode === 'recent') order.sort((a, b) => b.recent - a.recent);
    else order.sort((a, b) => b.total - a.total);

    for (let mi = 0; mi < metricKeys.length; mi++) {
      const mk = metricKeys[mi];
      const theme = THEMES[mk];
      const yBase = mi * (headerH + panelH + panelGap);
      svg.insertAdjacentHTML('beforeend',
        `<text x="0" y="${yBase + 14}" fill="${theme.main}" font-size="12" font-weight="700" letter-spacing=".12em">${mk.toUpperCase()}</text>` +
        `<text x="${nameW + 4}" y="${yBase + 14}" fill="#8a8a85" font-size="10" font-family="monospace">peak ${fmtNum(maxByMetric[mk])} / day</text>`);
      let lastMonth = -1;
      for (let i = 0; i < dates.length; i++) {
        const m = dates[i].getMonth();
        if (m !== lastMonth) { lastMonth = m; const x = nameW + i * (cellW + gap); svg.insertAdjacentHTML('beforeend', `<text x="${x}" y="${yBase + headerH + 14}" fill="#595959" font-size="11" font-weight="500">${dates[i].toLocaleDateString('en-US', { month: 'short' })}</text>`); }
      }
      svg.insertAdjacentHTML('beforeend', `<line x1="${nameW - 4}" y1="${yBase + headerH + monthLabelH - 8}" x2="${nameW - 4}" y2="${yBase + headerH + panelH - 2}" stroke="#e5e5e5" stroke-width="1"/>`);
      for (let row = 0; row < order.length; row++) {
        const { p, i: pi } = order[row];
        const y = yBase + headerH + monthLabelH + row * (cellH + gap);
        const personMetricTotal = perMetricPersonTotals[mk][pi];
        const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        band.setAttribute('x', 0); band.setAttribute('y', y - 1); band.setAttribute('width', totalW); band.setAttribute('height', cellH + 2);
        band.setAttribute('fill', 'transparent'); band.style.cursor = 'pointer';
        band.addEventListener('mouseenter', () => band.setAttribute('fill', theme.tint));
        band.addEventListener('mouseleave', () => band.setAttribute('fill', 'transparent'));
        band.addEventListener('click', () => openDrill(pi));
        svg.appendChild(band);
        const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tx.setAttribute('x', 4); tx.setAttribute('y', y + cellH / 2 + 4); tx.setAttribute('fill', '#1a1a1a'); tx.setAttribute('font-size', '12'); tx.setAttribute('font-weight', '500'); tx.style.cursor = 'pointer';
        tx.textContent = p.name.length > 26 ? p.name.slice(0, 25) + '…' : p.name;
        tx.addEventListener('click', () => openDrill(pi));
        svg.appendChild(tx);
        const tot = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tot.setAttribute('x', nameW - 8); tot.setAttribute('y', y + cellH / 2 + 4); tot.setAttribute('fill', '#8a8a85'); tot.setAttribute('font-size', '10'); tot.setAttribute('font-family', 'monospace'); tot.setAttribute('text-anchor', 'end');
        tot.textContent = fmtNum(personMetricTotal);
        svg.appendChild(tot);
        for (let c = 0; c < dates.length; c++) {
          const v = (breakdown[c][pi] && breakdown[c][pi][mk]) || 0;
          const x = nameW + c * (cellW + gap);
          const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', cellW); r.setAttribute('height', cellH); r.setAttribute('rx', 1.5);
          r.setAttribute('fill', rampColor(v, maxByMetric[mk], theme.ramp));
          r.style.cursor = 'pointer';
          r.addEventListener('mouseenter', (e) => showTip(e.clientX, e.clientY, `${p.name} · ${fmtDateLong(dates[c])} · ${mk}: ${fmtNum(v)}`));
          r.addEventListener('mousemove', (e) => moveTip(e.clientX, e.clientY));
          r.addEventListener('mouseleave', hideTip);
          r.addEventListener('click', () => openDrill(pi));
          svg.appendChild(r);
        }
      }
    }
  }

  /* ---------- Leaderboard ---------- */
  function renderLeaderboard(tab) {
    const table = el('leaderboard-table');
    const { people, dates, values } = tab;
    if (!people.length || !dates.length) { table.innerHTML = `<tr><td style="padding:20px;color:#8a8a85;">No data</td></tr>`; return; }
    const last30 = values.slice(-30), last7 = values.slice(-7);
    const totals30 = people.map((_, pi) => last30.reduce((a, row) => a + row[pi], 0));
    const totals7 = people.map((_, pi) => last7.reduce((a, row) => a + row[pi], 0));
    const order = people.map((p, i) => ({ p, i, t30: totals30[i], t7: totals7[i] })).filter((o) => o.t30 > 0).sort((a, b) => b.t30 - a.t30).slice(0, 12);
    if (!order.length) { table.innerHTML = `<tr><td style="padding:20px;color:#8a8a85;">No activity in last 30 days</td></tr>`; return; }
    const max = order[0].t30 || 1;
    const shareLabel = isCombined() ? 'Mix' : 'Share';
    let html = `<thead><tr><th style="width:24px;">#</th><th>Contributor</th><th class="num" style="width:80px;">30d</th><th style="width:100px;">${shareLabel}</th><th class="num" style="width:60px;">7d</th></tr></thead><tbody>`;
    order.forEach((o, rank) => {
      const pct = (o.t30 / max) * 100;
      let shareCell;
      if (isCombined() && tab.metricKeys && tab.breakdown) {
        const l30 = tab.breakdown.slice(-30);
        const mkSums = {}; tab.metricKeys.forEach((mk) => (mkSums[mk] = 0));
        for (const rowb of l30) { const cell = rowb[o.i] || {}; tab.metricKeys.forEach((mk) => (mkSums[mk] += cell[mk] || 0)); }
        const sum = Object.values(mkSums).reduce((a, b) => a + b, 0) || 1;
        const segs = tab.metricKeys.map((mk) => `<div style="width:${(mkSums[mk] / sum) * 100}%;background:${THEMES[mk].main}"></div>`).join('');
        shareCell = `<div class="mini-stack" title="${tab.metricKeys.map((mk) => mk + ': ' + fmtNum(mkSums[mk])).join(' · ')}">${segs}</div>`;
      } else {
        shareCell = `<div class="mini-bar"><div style="width:${pct}%"></div></div>`;
      }
      html += `<tr data-pi="${o.i}"><td style="color:#8a8a85;">${rank + 1}</td>` +
        `<td style="font-weight:500;">${escapeHtml(o.p.name)}</td>` +
        `<td class="num">${fmtNum(o.t30)}</td>` +
        `<td class="bar-cell">${shareCell}</td>` +
        `<td class="num">${fmtNum(o.t7)}</td></tr>`;
    });
    html += '</tbody>';
    table.innerHTML = html;
    table.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => openDrill(+tr.dataset.pi)));
  }

  /* ---------- Sparklines ---------- */
  function renderSparklines(tab) {
    const host = el('spark-grid');
    host.innerHTML = '';
    const { people, dates, values } = tab;
    if (!people.length || !dates.length) { host.innerHTML = `<div style="color:#8a8a85;padding:20px;grid-column:1 / -1;">No contributors yet for this metric</div>`; return; }
    const order = people.map((p, i) => ({ p, i, total: values.reduce((a, r) => a + r[i], 0) })).filter((o) => o.total > 0).sort((a, b) => b.total - a.total);
    if (!order.length) { host.innerHTML = `<div style="color:#8a8a85;padding:20px;grid-column:1 / -1;">No activity yet for this metric</div>`; return; }
    for (const o of order) {
      const card = document.createElement('div');
      card.className = 'spark-card';
      card.tabIndex = 0;
      let chart;
      if (isCombined() && tab.breakdown && tab.metricKeys) {
        const stacks = tab.metricKeys.map((mk) => tab.breakdown.map((row) => (row[o.i] && row[o.i][mk]) || 0));
        chart = stackedSparkSVG(stacks, tab.metricKeys.map((mk) => THEMES[mk].main), 140, 36);
      } else {
        const series = values.map((r) => r[o.i] || 0);
        const theme = currentTheme();
        chart = sparkSVG(series, 140, 36, theme.soft, theme.main);
      }
      card.innerHTML = `<div class="name" title="${escapeHtml(o.p.name)}">${escapeHtml(o.p.name)}</div><div class="num">${fmtNum(o.total)} total</div>${chart}`;
      card.addEventListener('click', () => openDrill(o.i));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrill(o.i); } });
      host.appendChild(card);
    }
  }

  /* ---------- Drill-down ---------- */
  function openDrill(personIdx) {
    const tab = currentTab();
    if (!tab) return;
    const person = tab.people[personIdx];
    if (!person) return;
    el('drill-eyebrow').textContent = `Contributor · ${STATE.dataset} ${STATE.metric}`;
    el('drill-name').textContent = person.name;                        // pseudonym only
    el('drill-id').textContent = person.id ? `Pseudonym ${person.id}` : '';
    const series = tab.values.map((r) => r[personIdx] || 0);
    const total = series.reduce((a, b) => a + b, 0);
    let bestIdx = 0, bestVal = 0;
    series.forEach((v, i) => { if (v > bestVal) { bestVal = v; bestIdx = i; } });
    const activeDays = series.filter((v) => v > 0).length;
    el('drill-total').textContent = fmtNum(total);
    el('drill-total-label').textContent = `Total (${STATE.metric})`;
    el('drill-total-sub').textContent = `${STATE.dataset} · ${STATE.metric}`;
    el('drill-best').textContent = bestVal ? fmtNum(bestVal) : '—';
    el('drill-best-sub').textContent = bestVal ? fmtDateLong(tab.dates[bestIdx]) : '';
    el('drill-days').textContent = fmtNum(activeDays);
    el('drill-days-sub').textContent = `of ${tab.dates.length} days`;
    if (isCombined() && tab.breakdown && tab.metricKeys) drawDrillStacked(tab, personIdx);
    else drawDrillLine(series, tab.dates);
    renderBreakdown(person);
    el('drill-backdrop').classList.add('open');
    el('drill-panel').classList.add('open');
    el('drill-panel').setAttribute('aria-hidden', 'false');
  }
  function closeDrill() {
    el('drill-backdrop').classList.remove('open');
    el('drill-panel').classList.remove('open');
    el('drill-panel').setAttribute('aria-hidden', 'true');
  }
  function drawDrillLine(series, dates) {
    const svg = el('drill-line');
    svg.innerHTML = '';
    const w = svg.clientWidth || 560, h = 160, pad = { l: 36, r: 12, t: 10, b: 22 };
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('preserveAspectRatio', 'none');
    if (!series.length || !series.some((v) => v > 0)) { svg.innerHTML = `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#8a8a85" font-size="12">No activity</text>`; return; }
    const max = Math.max(...series, 1);
    const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
    const stepX = innerW / Math.max(1, series.length - 1);
    const xFor = (i) => pad.l + i * stepX;
    const yFor = (v) => pad.t + innerH - (v / max) * innerH;
    for (let i = 0; i <= 3; i++) { const yv = (max * i) / 3; const y = yFor(yv); svg.insertAdjacentHTML('beforeend', `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#e5e5e5"/><text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" fill="#8a8a85" font-size="10" font-family="monospace">${fmtNum(yv)}</text>`); }
    const theme = currentTheme();
    let path = '';
    for (let i = 0; i < series.length; i++) path += (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + yFor(series[i]) + ' ';
    const fill = path + `L ${xFor(series.length - 1)} ${yFor(0)} L ${xFor(0)} ${yFor(0)} Z`;
    svg.insertAdjacentHTML('beforeend', `<path d="${fill}" fill="${theme.soft}"/><path d="${path}" fill="none" stroke="${theme.main}" stroke-width="2" stroke-linejoin="round"/>`);
    let lastMonth = -1;
    for (let i = 0; i < dates.length; i++) { const m = dates[i].getMonth(); if (m !== lastMonth) { lastMonth = m; svg.insertAdjacentHTML('beforeend', `<text x="${xFor(i)}" y="${h - 6}" text-anchor="middle" fill="#595959" font-size="10">${dates[i].toLocaleDateString('en-US', { month: 'short' })}</text>`); } }
  }
  function drawDrillStacked(tab, personIdx) {
    const svg = el('drill-line');
    svg.innerHTML = '';
    const w = svg.clientWidth || 560, h = 160, pad = { l: 36, r: 12, t: 10, b: 22 };
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('preserveAspectRatio', 'none');
    const { dates, breakdown, metricKeys } = tab;
    const stacks = metricKeys.map((mk) => breakdown.map((row) => (row[personIdx] && row[personIdx][mk]) || 0));
    const totals = breakdown.map((row) => { const cell = row[personIdx] || {}; return metricKeys.reduce((a, mk) => a + (cell[mk] || 0), 0); });
    if (!totals.some((v) => v > 0)) { svg.innerHTML = `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#8a8a85" font-size="12">No activity</text>`; return; }
    const max = Math.max(...totals, 1);
    const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
    const stepX = innerW / Math.max(1, totals.length - 1);
    const xFor = (i) => pad.l + i * stepX;
    const yFor = (v) => pad.t + innerH - (v / max) * innerH;
    for (let i = 0; i <= 3; i++) { const yv = (max * i) / 3; const y = yFor(yv); svg.insertAdjacentHTML('beforeend', `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#e5e5e5"/><text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" fill="#8a8a85" font-size="10" font-family="monospace">${fmtNum(yv)}</text>`); }
    const n = totals.length;
    const topY = stacks.map(() => new Array(n)), botY = stacks.map(() => new Array(n));
    for (let i = 0; i < n; i++) { let acc = 0; for (let li = 0; li < stacks.length; li++) { const bottom = yFor(acc); acc += stacks[li][i]; const top = yFor(acc); topY[li][i] = top; botY[li][i] = bottom; } }
    for (let li = 0; li < stacks.length; li++) { let path = ''; for (let i = 0; i < n; i++) path += (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + topY[li][i] + ' '; for (let i = n - 1; i >= 0; i--) path += 'L ' + xFor(i) + ' ' + botY[li][i] + ' '; path += 'Z'; svg.insertAdjacentHTML('beforeend', `<path d="${path}" fill="${THEMES[metricKeys[li]].main}" opacity="0.85"/>`); }
    let lastMonth = -1;
    for (let i = 0; i < dates.length; i++) { const m = dates[i].getMonth(); if (m !== lastMonth) { lastMonth = m; svg.insertAdjacentHTML('beforeend', `<text x="${xFor(i)}" y="${h - 6}" text-anchor="middle" fill="#595959" font-size="10">${dates[i].toLocaleDateString('en-US', { month: 'short' })}</text>`); } }
    let lx = w - pad.r;
    for (let li = metricKeys.length - 1; li >= 0; li--) { const mk = metricKeys[li]; svg.insertAdjacentHTML('beforeend', `<rect x="${lx - 10}" y="${pad.t + 2}" width="8" height="8" fill="${THEMES[mk].main}" opacity="0.85"/><text x="${lx - 14}" y="${pad.t + 9}" text-anchor="end" fill="#404040" font-size="10">${mk}</text>`); lx -= 56; }
  }
  function renderBreakdown(person) {
    const host = el('drill-breakdown');
    host.innerHTML = '';
    const rows = [];
    for (const ds of DATASETS) {
      for (const metricKey of Object.keys(ds.metrics)) {
        const tab = STATE.data[ds.metrics[metricKey]];
        if (!tab) continue;
        let pi = -1;
        if (person.id) pi = tab.people.findIndex((p) => p.id === person.id);
        if (pi < 0) pi = tab.people.findIndex((p) => p.name === person.name);
        if (pi < 0) continue;
        const total = tab.values.reduce((a, row) => a + (row[pi] || 0), 0);
        const recent = tab.values.slice(-7).reduce((a, row) => a + (row[pi] || 0), 0);
        rows.push({ dsKey: ds.key, metricKey, total, recent });
      }
    }
    if (!rows.length) { host.innerHTML = `<div style="color:#8a8a85;font-size:0.75rem;">No additional datasets.</div>`; return; }
    rows.sort((a, b) => b.total - a.total);
    for (const r of rows) {
      const isCurrent = r.dsKey === STATE.dataset && r.metricKey === STATE.metric;
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `<div style="font-weight:600;min-width:80px;">${r.dsKey}</div><div class="pill metric-${r.metricKey}">${r.metricKey}</div><div style="color:#595959;font-size:0.75rem;">7d: ${fmtNum(r.recent)}</div><div class="qty ${r.total === 0 ? 'zero' : ''}">${fmtNum(r.total)}</div>`;
      if (isCurrent) row.style.background = 'var(--aa-mark)';
      // Only switch metrics if the target metric is one this dataset actually shows here (same-dataset drill).
      if (r.dsKey === STATE.dataset) {
        row.addEventListener('click', () => {
          STATE.metric = r.metricKey;
          renderMetricTabs(); render();
          const newTab = currentTab();
          let newPi = -1;
          if (person.id) newPi = newTab.people.findIndex((p) => p.id === person.id);
          if (newPi < 0) newPi = newTab.people.findIndex((p) => p.name === person.name);
          if (newPi >= 0) openDrill(newPi);
        });
      } else {
        // Cross-dataset row: link out to that dataset's own page (deep view lives there).
        row.title = `Open the ${r.dsKey} dataset page`;
        row.addEventListener('click', () => { window.location.href = datasetHref(r.dsKey); });
      }
      host.appendChild(row);
    }
  }

  /* ============================================================
     ==================  DASHBOARD MODE  ========================
     Cross-dataset springboard: dataset cards + aggregate stats.
     ============================================================ */
  function datasetHref(key) {
    const base = OPTS.datasetBase || './';
    return base + key.toLowerCase() + '/';
  }

  function editsTab(key) { return STATE.data[key + '_edits'] || { people: [], dates: [], values: [] }; }

  function buildCrossDataset() {
    const perDataset = DATASETS.map((ds) => {
      const t = editsTab(ds.key);
      const dailyTotals = t.values.map((row) => row.reduce((a, b) => a + b, 0));
      const total = dailyTotals.reduce((a, b) => a + b, 0);
      const last7 = t.values.slice(-7);
      const active = t.people.map((_, pi) => last7.some((row) => row[pi] > 0)).filter(Boolean).length;
      let lastIdx = -1;
      for (let i = t.dates.length - 1; i >= 0; i--) { if (dailyTotals[i] > 0) { lastIdx = i; break; } }
      const lastActive = lastIdx >= 0 ? t.dates[lastIdx] : null;
      return { ds, total, active, contributors: t.people.length, lastActive, dailyTotals, dates: t.dates };
    });

    const teamTotal = perDataset.reduce((a, d) => a + d.total, 0);
    // Combined active-contributor count: union of pseudonyms active in last 7 days across all datasets.
    const activeSet = new Set();
    DATASETS.forEach((ds) => {
      const t = editsTab(ds.key);
      const last7 = t.values.slice(-7);
      t.people.forEach((p, pi) => { if (last7.some((row) => row[pi] > 0)) activeSet.add(p.id || p.name); });
    });

    // Team cumulative over unioned dates.
    const map = new Map();
    DATASETS.forEach((ds) => {
      const t = editsTab(ds.key);
      t.dates.forEach((d, i) => { const k = d.getTime(); const tot = t.values[i].reduce((a, b) => a + b, 0); map.set(k, (map.get(k) || 0) + tot); });
    });
    const cumDates = [...map.keys()].sort((a, b) => a - b).map((k) => new Date(k));
    const cumDaily = cumDates.map((d) => map.get(d.getTime()));
    let acc = 0; const cumulative = cumDaily.map((v) => (acc += v));
    let mostRecent = null;
    for (let i = cumDates.length - 1; i >= 0; i--) { if (cumDaily[i] > 0) { mostRecent = cumDates[i]; break; } }

    return { perDataset, teamTotal, activeUnique: activeSet.size, cumDates, cumDaily, cumulative, mostRecent };
  }

  function injectDashboardShell() {
    MOUNT.classList.add('aa-dashboard');
    MOUNT.innerHTML = `
      <div class="aa-toolbar aa-toolbar-dash" id="aa-toolbar">
        <span class="aa-status"><span class="updated-dot" id="status-dot"></span><span id="status-text">Loading data…</span></span>
        <span class="snapshot-note" id="snapshot-note"></span>
        <button class="btn ghost" id="refresh-btn" type="button" title="Reload latest data">↻ Refresh</button>
      </div>
      <div id="err-host"></div>

      <div class="kpi-grid" id="x-kpis"></div>

      <h2>Datasets</h2>
      <p style="color:#595959;font-size:0.9375rem;margin:-0.5rem 0 1rem;">Open a dataset for the full contributor view: KPIs, daily trend, per-contributor heatmap, leaderboard and drill-down.</p>
      <div class="ds-cards" id="ds-cards"></div>

      <section class="card">
        <header><h2>Edits by Dataset</h2><div class="hint">Cumulative edits across all tracked days</div></header>
        <div class="body"><svg id="cmp-chart" width="100%" height="220" aria-label="Edits by dataset"></svg></div>
      </section>

      <section class="card">
        <header><h2>Cumulative Team Edits</h2><div class="hint">Running total across every dataset</div></header>
        <div class="trend-wrap"><svg id="cum-chart" width="100%" height="220" aria-label="Cumulative team edits"></svg></div>
      </section>

      <div class="aa-tooltip" id="aa-tooltip"></div>
    `;
    el('refresh-btn').addEventListener('click', () => loadAll());
    applyAccent();
  }

  function renderDashboard() {
    applyAccent();
    const agg = buildCrossDataset();

    // Cross-dataset KPI row
    el('x-kpis').innerHTML = [
      kpiCard('Team Total Edits', fmtNum(agg.teamTotal), 'across all datasets'),
      kpiCard('Active Contributors', String(agg.activeUnique), 'unique · past 7 days'),
      kpiCard('Datasets Tracked', String(DATASETS.length), 'RETINA · MINNIE · CA3 · BANC · FAFB'),
      kpiCard('Most Recent Activity', agg.mostRecent ? fmtDateLong(agg.mostRecent) : '—', 'latest edit day'),
    ].join('');

    // Dataset cards
    const cardsHost = el('ds-cards');
    cardsHost.innerHTML = '';
    agg.perDataset.forEach((d) => {
      const spark = sparkSVG(d.dailyTotals.length ? d.dailyTotals : [0], 200, 34, THEMES.edits.soft, THEMES.edits.main);
      const a = document.createElement('a');
      a.className = 'ds-card';
      a.href = datasetHref(d.ds.key);
      a.setAttribute('aria-label', `${d.ds.label} dataset — ${fmtNum(d.total)} total edits`);
      const metricsNote = Object.keys(d.ds.metrics).length > 1 ? 'edits · cells · labels' : 'edits';
      a.innerHTML =
        `<div class="ds-name">${d.ds.label}</div>` +
        `<div class="ds-sub">${metricsNote}</div>` +
        `<div class="ds-stats">` +
          `<div class="ds-stat"><div class="v">${fmtNum(d.total)}</div><div class="l">Total edits</div></div>` +
          `<div class="ds-stat"><div class="v">${d.active}</div><div class="l">Active 7d</div></div>` +
        `</div>` +
        spark +
        `<div class="ds-sub" style="margin-top:0.5rem;">Last active: ${d.lastActive ? fmtDateLong(d.lastActive) : '—'}</div>` +
        `<div class="ds-open" style="margin-top:0.5rem;">Open dataset →</div>`;
      cardsHost.appendChild(a);
    });

    renderComparisonChart(agg);
    renderCumulativeChart(agg);
  }

  function kpiCard(lbl, val, sub) {
    return `<div class="kpi"><div class="lbl">${escapeHtml(lbl)}</div><div class="val">${escapeHtml(val)}</div><div class="sub">${escapeHtml(sub)}</div></div>`;
  }

  function renderComparisonChart(agg) {
    const svg = el('cmp-chart');
    svg.innerHTML = '';
    const rows = agg.perDataset.map((d) => ({ label: d.ds.label, value: d.total }));
    const w = svg.clientWidth || 1000;
    const rowH = 34, pad = { l: 90, r: 60, t: 10, b: 10 };
    const h = pad.t + pad.b + rows.length * rowH;
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const max = Math.max(...rows.map((r) => r.value), 1);
    const innerW = w - pad.l - pad.r;
    rows.forEach((r, i) => {
      const y = pad.t + i * rowH;
      const bw = (r.value / max) * innerW;
      svg.insertAdjacentHTML('beforeend',
        `<text x="${pad.l - 10}" y="${y + rowH / 2 + 4}" text-anchor="end" fill="#1a1a1a" font-size="13" font-weight="600">${escapeHtml(r.label)}</text>` +
        `<rect x="${pad.l}" y="${y + 6}" width="${Math.max(0, bw)}" height="${rowH - 14}" rx="3" fill="${THEMES.edits.main}"/>` +
        `<text x="${pad.l + Math.max(0, bw) + 8}" y="${y + rowH / 2 + 4}" fill="#595959" font-size="12" font-family="monospace">${fmtNum(r.value)}</text>`);
    });
  }

  function renderCumulativeChart(agg) {
    const svg = el('cum-chart');
    svg.innerHTML = '';
    const { cumDates: dates, cumulative } = agg;
    const w = svg.clientWidth || 1000, h = 220, pad = { l: 52, r: 16, t: 14, b: 28 };
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    if (!dates.length) { svg.innerHTML = `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#8a8a85" font-size="13">No data</text>`; return; }
    const max = Math.max(...cumulative, 1);
    const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
    const stepX = innerW / Math.max(1, dates.length - 1);
    const xFor = (i) => pad.l + i * stepX;
    const yFor = (v) => pad.t + innerH - (v / max) * innerH;
    for (let i = 0; i <= 4; i++) { const yv = (max * i) / 4; const y = yFor(yv); svg.insertAdjacentHTML('beforeend', `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#e5e5e5"/><text x="${pad.l - 8}" y="${y + 3}" text-anchor="end" fill="#8a8a85" font-size="10" font-family="monospace">${fmtNum(yv)}</text>`); }
    let path = '';
    for (let i = 0; i < cumulative.length; i++) path += (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + yFor(cumulative[i]) + ' ';
    const fill = path + `L ${xFor(cumulative.length - 1)} ${yFor(0)} L ${xFor(0)} ${yFor(0)} Z`;
    svg.insertAdjacentHTML('beforeend', `<path d="${fill}" fill="${THEMES.edits.soft}"/><path d="${path}" fill="none" stroke="${THEMES.edits.main}" stroke-width="2" stroke-linejoin="round"/>`);
    let lastMonth = -1;
    for (let i = 0; i < dates.length; i++) { const m = dates[i].getMonth(); if (m !== lastMonth) { lastMonth = m; svg.insertAdjacentHTML('beforeend', `<text x="${xFor(i)}" y="${h - 8}" text-anchor="middle" fill="#595959" font-size="11">${dates[i].toLocaleDateString('en-US', { month: 'short' })}</text>`); } }
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    overlay.setAttribute('x', pad.l); overlay.setAttribute('y', pad.t); overlay.setAttribute('width', innerW); overlay.setAttribute('height', innerH); overlay.setAttribute('fill', 'transparent');
    svg.appendChild(overlay);
    overlay.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (w / rect.width);
      const idx = Math.round(((px - pad.l) / innerW) * (dates.length - 1));
      const ci = Math.max(0, Math.min(dates.length - 1, idx));
      showTip(e.clientX, e.clientY, `${fmtDateLong(dates[ci])} · ${fmtNum(cumulative[ci])} total`);
    });
    overlay.addEventListener('mouseleave', hideTip);
  }

  /* ============================================================
     INIT + GLOBAL WIRING
     ============================================================ */
  function wireGlobal() {
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && STATE.mode === 'dataset') closeDrill(); });
    window.addEventListener('resize', debounce(() => {
      if (STATE.loading) return;
      if (STATE.mode === 'dataset') { const tab = currentTab(); renderTrend(tab); renderHeatmap(tab); }
      else renderDashboard();
    }, 200));
  }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  async function init(opts) {
    opts = opts || {};
    MOUNT = document.querySelector(opts.mount || '#activity-app');
    if (!MOUNT) { console.error('[ActivityDashboard] mount element not found:', opts.mount); return; }
    OPTS = {
      mode: opts.mode === 'dataset' ? 'dataset' : 'dashboard',
      dataset: opts.dataset || null,
      workerUrl: opts.workerUrl || '',
      snapshotUrl: opts.snapshotUrl || './data/activity-snapshot.json',
      datasetBase: opts.datasetBase || './',
    };
    STATE.mode = OPTS.mode;
    if (STATE.mode === 'dataset') {
      const valid = DATASETS.find((d) => d.key === OPTS.dataset);
      if (!valid) { MOUNT.innerHTML = `<div class="err-banner">Unknown dataset "${escapeHtml(String(OPTS.dataset))}". Expected one of RETINA, MINNIE, CA3, BANC, FAFB.</div>`; return; }
      STATE.dataset = OPTS.dataset;
      STATE.metric = 'edits';
      ensureValidMetric();
      injectDatasetShell();
    } else {
      injectDashboardShell();
    }
    wireGlobal();
    await loadAll();
  }

  window.ActivityDashboard = { init: init, version: '1.0', datasets: DATASETS.map((d) => d.key) };
})();
