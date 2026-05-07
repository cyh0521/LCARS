// js/library.js — Series / Library tracker

  /* ============================================================
     LIBRARY — Series Tracker (v2: series + seasons + episodes)
     API endpoint (Google Apps Script Web App)
     ============================================================ */
  const LIBRARY_API_URL = 'https://script.google.com/macros/s/AKfycbz95Pnc9LeWAMtVmPIQePNK45-7akEonTCry3jjtH3UUdNTf4rUtzCpkeelQED0orLA/exec';

  // Constants for the v2 model.
  const PLATFORMS  = ['Netflix', 'Disney+', 'Apple TV+', 'HBO Max', 'MyVideo', 'YouTube', '其他'];
  const LANGUAGES  = ['CHINESE', 'ENGLISH', 'JAPANESE', 'KOREAN', 'OTHER'];
  // English statuses replace the old Chinese labels — backend stores these
  // exact strings.
  const STATUSES   = ['WATCHING', 'PLANNED', 'COMPLETE', 'PAUSED', 'DROPPED'];
  const STATUS_KEY = {
    'WATCHING': 'watching', 'PLANNED': 'planned', 'COMPLETE': 'complete',
    'PAUSED':   'paused',   'DROPPED': 'dropped'
  };

  // Caches — three sheets now. Each season is rendered as its own card.
  let libSeriesCache  = [];   // [{id, title_original, title_zh, language, platform, ...}]
  let libSeasonsCache = [];   // [{season_id, series_id, season_number, total_episodes, status, rating, ...}]
  let libEpisodesCache = [];  // [{episode_id, series_id, season_id, season_number, episode_number, watched_date, ...}]
  let libFilter = 'all';
  let libSearch = '';
  let libLoading = false;

  // ── API helpers ────────────────────────────────────────────────────────────

  // Sheets sometimes auto-formats integer cells as dates. The epoch is
  // 1899-12-30 in Google Sheets, so cell value 1 becomes "1899-12-31",
  // 2 becomes "1900-01-01", etc. parseInt then reads "1899" and the
  // season number breaks. This helper undoes that for known integer
  // fields by counting days since the Sheets epoch.
  const SHEETS_EPOCH = Date.UTC(1899, 11, 30);  // 1899-12-30 UTC
  const INTEGER_FIELDS = new Set([
    'season_number', 'episode_number', 'total_episodes', 'total_seasons', 'rating', 'year'
  ]);

  function coerceIntegerField(value) {
    if (value === null || value === undefined || value === '') return value;
    // Already a number → return as-is
    if (typeof value === 'number') return value;
    // Date object → days since the Sheets epoch
    if (value instanceof Date && !isNaN(value.getTime())) {
      return Math.round((value.getTime() - SHEETS_EPOCH) / 86400000);
    }
    const str = String(value);
    // Pure numeric string → parse to integer
    if (/^-?\d+$/.test(str)) return parseInt(str, 10);
    // Match the canonical Sheets-coerced date strings, e.g. "1899-12-31",
    // "1900-01-01T00:00:00.000Z", or anything starting "18xx-" / "19xx-"
    // that is clearly a small-integer-as-date.
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const yr = parseInt(m[1]);
      // Only auto-correct dates within the 1899-1903 window — that's the
      // range that integers 1..1500 would land in. Real watched_date values
      // are always 2000+ so they never trip this.
      if (yr >= 1899 && yr <= 1903) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          return Math.round((d.getTime() - SHEETS_EPOCH) / 86400000);
        }
      }
    }
    return value;
  }

  // Lowercase + snake_case keys, plus rescue integer fields from Sheets'
  // date-format coercion.
  function normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    Object.keys(row).forEach(k => {
      const nk = String(k).trim().toLowerCase().replace(/\s+/g, '_');
      let val = row[k];
      if (INTEGER_FIELDS.has(nk)) val = coerceIntegerField(val);
      out[nk] = val;
    });
    return out;
  }

  // The v2 backend wraps responses as {ok, data, error}. Unwrap, throw on
  // server-side errors, and normalize each row's keys.
  function unwrapResponse(payload) {
    if (payload && typeof payload === 'object' && 'ok' in payload) {
      if (!payload.ok) throw new Error(payload.error || 'API error');
      return payload.data;
    }
    return payload;  // fallback if backend ever returns raw
  }

  async function libGet(params = {}) {
    const url = new URL(LIBRARY_API_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = unwrapResponse(await res.json());
    return Array.isArray(data) ? data.map(normalizeRow) : data;
  }

  async function libPost(body) {
    // Apps Script can be picky about CORS preflight, so we send as text/plain
    // — Apps Script doesn't care about Content-Type for parsing JSON.
    const res = await fetch(LIBRARY_API_URL, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return unwrapResponse(await res.json());
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  // One round-trip pulls all three sheets via {sheet:'all'}.
  async function fetchLibrary() {
    libLoading = true;
    renderLibGrid();
    try {
      const data = await libGet({ sheet: 'all' });
      libSeriesCache   = (data && Array.isArray(data.series))   ? data.series.map(normalizeRow)   : [];
      libSeasonsCache  = (data && Array.isArray(data.seasons))  ? data.seasons.map(normalizeRow)  : [];
      libEpisodesCache = (data && Array.isArray(data.episodes)) ? data.episodes.map(normalizeRow) : [];
      libLoading = false;
      renderLibGrid();
      renderLibFilters();
    } catch(e) {
      console.error('[LIBRARY] Fetch failed:', e);
      libLoading = false;
      renderLibError();
    }
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  function setLibFilter(f) {
    libFilter = f;
    renderLibFilters();   // refresh active state
    renderLibGrid();
  }

  // Update the search query and re-render the grid. Filter bar isn't
  // re-rendered (would steal focus from the input).
  function setLibSearch(q) {
    libSearch = String(q || '').trim().toLowerCase();
    renderLibGrid();
    // Only the clear button visibility changes — toggle it without a full
    // re-render of the filter bar (re-render would blow away input focus).
    const clear = document.getElementById('lib-search-clear');
    if (clear) clear.style.visibility = libSearch ? 'visible' : 'hidden';
  }

  // Filter seasons by status AND search query. When searching, the result is
  // sorted to keep all seasons of the same series adjacent and ordered by
  // season_number — so a search hit produces a clean per-show grouping.
  function filteredSeasons() {
    let list = libSeasonsCache.slice();

    // Status filter (AND)
    if (libFilter !== 'all') {
      const target = libFilter.toUpperCase();
      list = list.filter(se => String(se.status).toUpperCase() === target);
    }

    // Search filter (AND): match against series original + Chinese title
    if (libSearch) {
      const seriesById = {};
      libSeriesCache.forEach(s => { seriesById[s.id] = s; });
      list = list.filter(se => {
        const s = seriesById[se.series_id];
        if (!s) return false;
        const orig = String(s.title_original || '').toLowerCase();
        const zh   = String(s.title_zh || '').toLowerCase();
        return orig.includes(libSearch) || zh.includes(libSearch);
      });
      // Sort so all seasons of the same series cluster + ascend by season #
      list.sort((a, b) => {
        if (String(a.series_id) !== String(b.series_id)) {
          return String(a.series_id).localeCompare(String(b.series_id));
        }
        return (parseInt(a.season_number) || 0) - (parseInt(b.season_number) || 0);
      });
    }

    return list;
  }

  // ── Filter bar (counts folded in + search box on the right) ───────────────

  function renderLibFilters() {
    const bar = document.getElementById('lib-filter-bar');
    if (!bar) return;
    // Compute counts per status (over all seasons)
    const counts = { all: libSeasonsCache.length };
    STATUSES.forEach(st => counts[st.toLowerCase()] = 0);
    libSeasonsCache.forEach(se => {
      const k = String(se.status || 'PLANNED').toLowerCase();
      if (counts[k] !== undefined) counts[k]++;
    });

    const filters = [
      ['all',      'libFilterAll'],
      ['watching', 'libFilterWatching'],
      ['planned',  'libFilterPlanned'],
      ['complete', 'libFilterComplete'],
      ['paused',   'libFilterPaused'],
      ['dropped',  'libFilterDropped']
    ];

    const filterButtons = filters.map(([key, i18n]) => `
      <button class="lib-filter-btn${libFilter === key ? ' active' : ''}"
              data-filter="${key}"
              onclick="setLibFilter('${key}')"
              data-i18n="${i18n}">
        ${t(i18n)}<span class="count">${counts[key]}</span>
      </button>`).join('');

    // Search box on the right — margin-left:auto pushes it to the far end
    const searchBox = `
      <div class="lib-search">
        <input id="lib-search-input" type="text" class="lib-search-input"
               data-i18n-placeholder="libSearchPH"
               placeholder="${t('libSearchPH')}"
               value="${escapeAttr(libSearch)}"
               oninput="setLibSearch(this.value)">
        <button id="lib-search-clear" class="lib-search-clear"
                style="visibility:${libSearch ? 'visible' : 'hidden'}"
                onclick="document.getElementById('lib-search-input').value=''; setLibSearch('');"
                aria-label="Clear">✕</button>
      </div>`;

    bar.innerHTML = filterButtons + searchBox;
  }

  // ── Grid render ─────────────────────────────────────────────────────────────

  function renderLibGrid() {
    const grid = document.getElementById('lib-grid');
    if (!grid) return;

    if (libLoading) {
      grid.innerHTML = `<div class="lib-state">${t('libLoading')}</div>`;
      return;
    }

    const list = filteredSeasons();
    if (list.length === 0) {
      grid.innerHTML = `<div class="lib-state">${t('libEmpty')}</div>`;
      return;
    }

    // Index series and episodes for fast lookup during card build
    const seriesById = {};
    libSeriesCache.forEach(s => { seriesById[s.id] = s; });
    const episodesBySeason = {};
    libEpisodesCache.forEach(ep => {
      const sid = ep.season_id;
      if (!episodesBySeason[sid]) episodesBySeason[sid] = [];
      episodesBySeason[sid].push(ep);
    });

    grid.innerHTML = '';

    // SEARCH MODE — flat grid (search results have their own series-clustered
    // sort order; month grouping would fight that and add no value).
    if (libSearch) {
      const flatGrid = document.createElement('div');
      flatGrid.className = 'lib-grid-inner';
      list.forEach(se => {
        try {
          const s = seriesById[se.series_id];
          if (!s) return;
          const eps = episodesBySeason[se.season_id] || [];
          flatGrid.appendChild(buildSeasonCard(s, se, eps));
        } catch(e) {
          console.error('[LIBRARY] Failed to build card for season:', se, e);
        }
      });
      grid.appendChild(flatGrid);
      return;
    }

    // GROUPED MODE — bucket by latest watch date's month (or "WANT TO WATCH"
    // when no logs exist yet).
    const groups = groupSeasonsByMonth(list, episodesBySeason);
    // Cycle through LCARS hues so consecutive months are visually distinct.
    // The CSS var --month-color is read by both the left border and the
    // tag dot in the header.
    const MONTH_PALETTE = [
      'var(--lcars-orange)',
      'var(--lcars-cream)',
      'var(--lcars-blue)',
      'var(--lcars-violet)',
      'var(--lcars-gold)',
      'var(--lcars-rust)'
    ];
    groups.forEach((group, idx) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'lib-month-group';
      groupEl.style.setProperty('--month-color', MONTH_PALETTE[idx % MONTH_PALETTE.length]);

      const header = document.createElement('div');
      header.className = 'lib-month-header';
      header.innerHTML = `
        <span class="lib-month-tag"></span>
        <span class="lib-month-title">${escapeHtml(group.label)}</span>
        <span class="lib-month-count">${group.seasons.length}</span>`;
      groupEl.appendChild(header);

      const innerGrid = document.createElement('div');
      innerGrid.className = 'lib-grid-inner';
      group.seasons.forEach(se => {
        try {
          const s = seriesById[se.series_id];
          if (!s) return;
          const eps = episodesBySeason[se.season_id] || [];
          innerGrid.appendChild(buildSeasonCard(s, se, eps));
        } catch(e) {
          console.error('[LIBRARY] Failed to build card for season:', se, e);
        }
      });
      groupEl.appendChild(innerGrid);
      grid.appendChild(groupEl);
    });
  }

  // Find the most-recent valid Date object across a season's episode logs.
  // Returns null if no episode has a parseable watched_date.
  function latestWatchDate(eps) {
    let latest = null;
    eps.forEach(ep => {
      if (!ep.watched_date) return;
      const d = new Date(ep.watched_date);
      if (isNaN(d.getTime())) return;
      if (!latest || d > latest) latest = d;
    });
    return latest;
  }

  // Bucket seasons into month groups.
  // Returns: [{ key, label, sortKey, seasons: [...] }, ...]
  // - WANT TO WATCH bucket comes first (key='want', sortKey=Infinity)
  // - Then real months sorted newest-first
  function groupSeasonsByMonth(seasons, episodesBySeason) {
    const buckets = new Map();   // sortKey → { key, label, sortKey, seasons }
    const WANT_KEY = 'want';

    const ensureBucket = (sortKey, key, label) => {
      if (!buckets.has(sortKey)) {
        buckets.set(sortKey, { key, label, sortKey, seasons: [] });
      }
      return buckets.get(sortKey);
    };

    seasons.forEach(se => {
      const eps = episodesBySeason[se.season_id] || [];
      const latest = latestWatchDate(eps);
      if (!latest) {
        // No logs → "WANT TO WATCH" bucket. Use Infinity so it sorts to top.
        ensureBucket(Infinity, WANT_KEY, t('libGroupWantToWatch')).seasons.push(se);
        return;
      }
      const yr = latest.getFullYear();
      const mo = latest.getMonth();   // 0-11
      // Numeric sort key encodes year+month so newest dates win
      const sortKey = yr * 100 + mo;
      const monthName = t('mon' + mo);   // mon0..mon11
      const label = `${yr} · ${monthName}`;
      ensureBucket(sortKey, `${yr}-${mo}`, label).seasons.push(se);
    });

    // Sort: WANT TO WATCH first (Infinity), then real months newest-first
    const out = Array.from(buckets.values());
    out.sort((a, b) => b.sortKey - a.sortKey);

    // Within each bucket, sort seasons newest-watched first; WANT bucket
    // sorts by series title for predictability.
    out.forEach(bucket => {
      if (bucket.key === WANT_KEY) {
        const seriesById = {};
        libSeriesCache.forEach(s => { seriesById[s.id] = s; });
        bucket.seasons.sort((a, b) => {
          const sa = seriesById[a.series_id];
          const sb = seriesById[b.series_id];
          const ta = (sa && sa.title_original || '').toLowerCase();
          const tb = (sb && sb.title_original || '').toLowerCase();
          if (ta !== tb) return ta.localeCompare(tb);
          return (parseInt(a.season_number) || 0) - (parseInt(b.season_number) || 0);
        });
      } else {
        bucket.seasons.sort((a, b) => {
          const epsA = episodesBySeason[a.season_id] || [];
          const epsB = episodesBySeason[b.season_id] || [];
          const da = latestWatchDate(epsA);
          const db = latestWatchDate(epsB);
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        });
      }
    });

    return out;
  }

  function renderLibError() {
    const grid = document.getElementById('lib-grid');
    if (grid) grid.innerHTML = `<div class="lib-state error">${t('libError')}</div>`;
  }

  // ── Season card (replaces old series card) ─────────────────────────────────

  // Format YYYY.MM.DD from an ISO date or a Date object
  function fmtDate(d) {
    if (!d) return '';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return dt.getFullYear() + '.' + pad(dt.getMonth()+1) + '.' + pad(dt.getDate());
  }

  // Localised language label
  function langLabel(code) {
    const map = {
      'CHINESE':  t('libLangChinese'),
      'ENGLISH':  t('libLangEnglish'),
      'JAPANESE': t('libLangJapanese'),
      'KOREAN':   t('libLangKorean'),
      'OTHER':    t('libLangOther'),
      // Legacy codes — kept for backward compatibility with rows entered
      // before the v2.2 split. The Sheet should be migrated manually but
      // we don't want stale rows to render as a blank meta line.
      'WESTERN':  t('libLangEnglish'),
      'JP_KR':    t('libLangJapanese') + ' / ' + t('libLangKorean')
    };
    return map[code] || '';
  }

  // Compact two-letter language code, used in card meta ("ZH", "EN", ...).
  // Uppercase to match the rest of the LCARS UI (SEASON 1, PLANNED, etc.).
  function langShort(code) {
    const map = {
      'CHINESE':  'ZH',
      'ENGLISH':  'EN',
      'JAPANESE': 'JA',
      'KOREAN':   'KO',
      'OTHER':    'OTHER',
      'WESTERN':  'EN',     // legacy
      'JP_KR':    'JA/KO'   // legacy
    };
    return map[code] || '';
  }

  function buildSeasonCard(s, se, eps) {
    const watched   = eps.length;  // each episode log = 1 watched episode
    const total     = parseInt(se.total_episodes) || 0;
    const pct       = total > 0 ? Math.min(100, Math.round(watched / total * 100)) : 0;
    const status    = String(se.status || 'PLANNED').toUpperCase();
    const statusCls = STATUS_KEY[status] || 'planned';

    // Find latest watch date in this season's episodes
    let latestEp = null;
    eps.forEach(ep => {
      const d = ep.watched_date ? new Date(ep.watched_date) : null;
      if (d && !isNaN(d.getTime())) {
        if (!latestEp || d > new Date(latestEp.watched_date)) latestEp = ep;
      }
    });

    const card = document.createElement('div');
    card.className = `series-card status-${statusCls}`;
    card.dataset.seasonId = se.season_id;
    card.dataset.seriesId = s.id;

    // HEAD: original title + status pill
    const head = document.createElement('div');
    head.className = 'series-card-head';
    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'flex:1; min-width:0;';
    const titleOrig = document.createElement('div');
    titleOrig.className = 'series-title';
    titleOrig.textContent = s.title_original || '(Untitled)';
    titleWrap.appendChild(titleOrig);
    if (s.title_zh) {
      const titleZh = document.createElement('div');
      titleZh.className = 'series-title-zh';
      titleZh.textContent = s.title_zh;
      titleWrap.appendChild(titleZh);
    }
    const pill = document.createElement('div');
    pill.className = `series-status-pill ${statusCls}`;
    pill.textContent = status;
    head.appendChild(titleWrap);
    head.appendChild(pill);

    // META: SEASON N · YYYY · language-short · platform
    const meta = document.createElement('div');
    meta.className = 'series-meta';
    const metaParts = [];
    const seasonNum = parseInt(se.season_number) || 1;
    let seasonLabel = `SEASON ${seasonNum}`;
    if (se.season_title) seasonLabel += `: ${se.season_title}`;
    metaParts.push(seasonLabel);
    if (se.year)     metaParts.push(se.year);
    if (s.language)  metaParts.push(langShort(s.language));
    if (s.platform)  metaParts.push(s.platform);
    meta.textContent = metaParts.join(' · ');

    // EP line + progress (season already labelled in the meta line above)
    const epLine = document.createElement('div');
    epLine.className = 'series-ep-line';
    epLine.textContent = total > 0
      ? `${t('libEp')} ${watched}/${total}`
      : `${t('libEp')} ${watched}`;

    const progWrap = document.createElement('div');
    progWrap.className = 'series-progress-wrap';
    const bar = document.createElement('div');
    bar.className = 'series-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'series-progress-fill';
    fill.style.width = (total > 0 ? pct : 0) + '%';
    bar.appendChild(fill);
    const pctEl = document.createElement('div');
    pctEl.className = 'series-progress-pct';
    pctEl.textContent = total > 0 ? pct + '%' : '—';
    progWrap.appendChild(bar);
    progWrap.appendChild(pctEl);

    // LAST SEEN
    const lastSeen = document.createElement('div');
    lastSeen.className = 'series-last-seen';
    if (latestEp && latestEp.watched_date) {
      lastSeen.textContent = `${t('libLastSeen')} ${fmtDate(latestEp.watched_date)} · EP ${latestEp.episode_number}`;
    } else {
      lastSeen.textContent = t('libNeverSeen');
    }

    // ACTIONS
    const actions = document.createElement('div');
    actions.className = 'series-actions';

    const isFinished = (status === 'COMPLETE' || status === 'DROPPED');
    const atMax = total > 0 && watched >= total;

    // ADD button — opens the episode editor pre-filled with "next episode +
    // today". The actual write only happens on Save, so there's no perceived
    // delay (the old +1 behaviour double-roundtripped the API before opening
    // the editor and felt sluggish).
    const addBtn = document.createElement('button');
    addBtn.className = 'series-btn primary';
    addBtn.textContent = t('libBtnAdd');
    addBtn.disabled = isFinished || atMax;
    addBtn.addEventListener('click', () => showEpisodeEditModal(s, se, null));

    // LOG button — opens (placeholder) log modal for this season
    const logBtn = document.createElement('button');
    logBtn.className = 'series-btn';
    logBtn.textContent = t('libBtnLog');
    logBtn.addEventListener('click', () => showSeasonLogModal(s, se, eps));

    // ⋯ menu — edit / delete / add-season
    const moreBtn = document.createElement('button');
    moreBtn.className = 'series-btn icon-btn';
    moreBtn.textContent = '⋯';
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      showSeriesMenu(s, se, moreBtn);
    });

    actions.appendChild(addBtn);
    actions.appendChild(logBtn);
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    actions.appendChild(spacer);
    actions.appendChild(moreBtn);

    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(epLine);
    card.appendChild(progWrap);
    card.appendChild(lastSeen);
    card.appendChild(actions);
    return card;
  }

  // ── Cache lookup helpers ──────────────────────────────────────────────────

  // Look up cached objects after a fetchLibrary refresh.
  function findSeasonInCache(season_id) {
    return libSeasonsCache.find(x => String(x.season_id) === String(season_id));
  }
  function findSeriesInCache(series_id) {
    return libSeriesCache.find(x => String(x.id) === String(series_id));
  }
  function findEpisodeInCache(episode_id) {
    return libEpisodesCache.find(x => String(x.episode_id) === String(episode_id));
  }
  function episodesForSeason(season_id) {
    return libEpisodesCache.filter(x => String(x.season_id) === String(season_id));
  }

  // ── Episode edit / add modal ──────────────────────────────────────────────

  // Render five clickable star buttons and report current selection via the
  // returned getter. `initial` is 0 (unrated) through 5.
  function buildStarPicker(initial) {
    const container = document.createElement('div');
    container.className = 'star-picker';
    let value = parseInt(initial) || 0;
    if (value < 0 || value > 5) value = 0;

    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-btn';
      btn.dataset.value = i;
      btn.textContent = '★';
      btn.addEventListener('click', () => {
        // Click on currently-selected star clears (toggles to 0)
        value = (value === i) ? 0 : i;
        repaint();
      });
      stars.push(btn);
      container.appendChild(btn);
    }
    // "Unrated" indicator on the right
    const label = document.createElement('span');
    label.className = 'star-picker-label';
    container.appendChild(label);

    function repaint() {
      stars.forEach((b, idx) => {
        b.classList.toggle('filled', (idx + 1) <= value);
      });
      label.textContent = value === 0 ? t('libRatingUnrated') : '';
    }
    repaint();

    return { element: container, getValue: () => value };
  }

  // Show the episode edit modal. Passing `episode = null` means new-entry mode.
  // Returns nothing — the caller is expected to refetch after the user closes.
  function showEpisodeEditModal(s, se, episode) {
    const isNew = !episode;
    // Default values for new entry: next episode number + today's date
    const eps = episodesForSeason(se.season_id);
    const maxEp = eps.reduce((m, e) => Math.max(m, parseInt(e.episode_number) || 0), 0);
    const defaultEp   = isNew ? (maxEp + 1) : (parseInt(episode.episode_number) || 1);
    const defaultDate = isNew ? new Date().toISOString().slice(0, 10) : (episode.watched_date || '').toString().slice(0, 10);
    const defaultTitle = isNew ? '' : (episode.episode_title || '');
    const defaultNote  = isNew ? '' : (episode.note || '');
    const defaultRating = isNew ? 0 : (parseInt(episode.rating) || 0);
    const seasonNum = parseInt(se.season_number) || 1;

    const overlay = document.createElement('div');
    overlay.className = 'alert-overlay';
    overlay.style.zIndex = 10001;  // sit above the LOG modal if open underneath
    const stack = document.createElement('div');
    stack.className = 'alert-stack';
    stack.style.maxWidth = '520px';
    overlay.appendChild(stack);

    const card = document.createElement('div');
    card.className = 'alert-card';
    card.style.maxWidth = '520px';
    card.style.width = '100%';

    const head = document.createElement('div');
    head.className = 'alert-head';
    head.style.background = 'var(--lcars-cream)';
    const headTitle = document.createElement('span');
    headTitle.className = 'alert-head-title';
    const titleText = isNew
      ? `${escapeHtml(s.title_original)} · S${seasonNum} · ${t('libEpAddTitle')}`
      : `${escapeHtml(s.title_original)} · S${seasonNum} · EP ${defaultEp}`;
    headTitle.innerHTML = `<svg class="icon icon-md alert-head-icon"><use href="#i-library"/></svg><span>${titleText}</span>`;
    head.appendChild(headTitle);

    const body = document.createElement('div');
    body.className = 'alert-body';
    body.style.padding = '20px 24px';
    body.style.maxHeight = 'none';
    body.style.overflow = 'visible';

    body.innerHTML = `
      <div class="lib-form-grid">
        <div class="lib-form-field">
          <label class="lib-form-label">${t('libEpEpisode')}</label>
          <input id="ee-num" class="lib-form-input" type="number" min="1" value="${escapeAttr(defaultEp)}">
        </div>
        <div class="lib-form-field">
          <label class="lib-form-label">${t('libEpDate')}</label>
          <input id="ee-date" class="lib-form-input" type="date" value="${escapeAttr(defaultDate)}">
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libEpTitle')}</label>
          <input id="ee-title" class="lib-form-input" placeholder="${t('libEpTitlePH')}" value="${escapeAttr(defaultTitle)}">
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libEpRating')}</label>
          <div id="ee-rating-mount"></div>
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libEpNote')}</label>
          <textarea id="ee-note" class="lib-form-textarea" placeholder="${t('libEpNotePH')}" rows="5">${escapeHtml(defaultNote)}</textarea>
        </div>
      </div>`;

    const ratingPicker = buildStarPicker(defaultRating);
    body.querySelector('#ee-rating-mount').appendChild(ratingPicker.element);

    // Footer: CANCEL on the left, DELETE (edit only) in the middle, SAVE right
    const footer = document.createElement('div');
    footer.className = 'alert-footer confirm';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'alert-ok';
    cancelBtn.textContent = t('libCancel');

    let deleteBtn = null;
    if (!isNew) {
      deleteBtn = document.createElement('button');
      deleteBtn.className = 'alert-ok danger';
      deleteBtn.textContent = t('libDelete');
    }

    const saveBtn = document.createElement('button');
    saveBtn.className = 'alert-ok';
    saveBtn.style.background = 'var(--lcars-cream)';
    saveBtn.style.color = 'var(--lcars-bg)';
    saveBtn.textContent = t('libSave');

    const close = () => {
      document.removeEventListener('keydown', onKey);
      closeOverlay(overlay);
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); close(); }
    };

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', ev => { if (ev.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    saveBtn.addEventListener('click', async () => {
      const epNum = parseInt(document.getElementById('ee-num').value) || 0;
      if (epNum < 1) { document.getElementById('ee-num').focus(); return; }
      const payload = {
        episode_number: epNum,
        watched_date:   document.getElementById('ee-date').value || '',
        episode_title:  document.getElementById('ee-title').value.trim(),
        rating:         ratingPicker.getValue(),
        note:           document.getElementById('ee-note').value
      };
      try {
        if (isNew) {
          await libPost({
            action: 'add_episode',
            series_id:     s.id,
            season_id:     se.season_id,
            season_number: seasonNum,
            ...payload
          });
        } else {
          await libPost({
            action: 'update_episode',
            episode_id: episode.episode_id,
            ...payload
          });
        }
        beep(560);
        close();
        await fetchLibrary();
        // If the LOG modal is still open underneath, refresh its body so the
        // edits show up without the user having to close + reopen it.
        refreshLogModalIfOpen(s.id, se.season_id);
      } catch(e) {
        console.error('[LIBRARY] save episode failed:', e);
        beep(280);
      }
    });

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const ok = await lcarsConfirm({
          title:   t('libEpDelTitle'),
          body:    t('libEpDelBody').replace('{n}', episode.episode_number),
          okLabel: t('libDelete'),
          cancelLabel: t('libCancel'),
          danger:  true
        });
        if (!ok) return;
        try {
          await libPost({ action: 'delete_episode', episode_id: episode.episode_id });
          beep(560);
          close();
          await fetchLibrary();
          refreshLogModalIfOpen(s.id, se.season_id);
        } catch(e) {
          console.error('[LIBRARY] delete_episode failed:', e);
          beep(280);
        }
      });
    }

    footer.appendChild(cancelBtn);
    if (deleteBtn) footer.appendChild(deleteBtn);
    footer.appendChild(saveBtn);
    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(footer);
    stack.appendChild(card);
    openOverlay(overlay);
    requestAnimationFrame(() => document.getElementById('ee-num')?.focus());
  }

  // ── Season LOG modal — interactive list of episode logs ───────────────────

  // Tag the LOG modal overlay so we can find it again later
  const LOG_MODAL_ATTR = 'data-log-modal';

  // If a LOG modal is open for this season, repaint its body. Used after an
  // episode is added / edited / deleted in the editor modal so the list
  // updates live without the user closing and reopening it.
  function refreshLogModalIfOpen(series_id, season_id) {
    const overlay = document.querySelector(`.alert-overlay[${LOG_MODAL_ATTR}="${season_id}"]`);
    if (!overlay) return;
    const s = findSeriesInCache(series_id);
    const se = findSeasonInCache(season_id);
    if (!s || !se) return;
    const eps = episodesForSeason(season_id);
    const body = overlay.querySelector('.alert-body');
    if (body) renderLogModalBody(body, s, se, eps);
  }

  function renderLogModalBody(body, s, se, eps) {
    const sorted = eps.slice().sort((a, b) =>
      (parseInt(a.episode_number) || 0) - (parseInt(b.episode_number) || 0));

    body.innerHTML = '';
    if (sorted.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lib-state';
      empty.style.padding = '16px 0';
      empty.textContent = t('libLogEmpty');
      body.appendChild(empty);
      return;
    }

    sorted.forEach(ep => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'log-card';
      const rating = parseInt(ep.rating) || 0;
      const stars = rating > 0
        ? '<span class="log-card-stars">' + '★'.repeat(rating) + '<span class="log-card-stars-empty">' + '★'.repeat(5 - rating) + '</span></span>'
        : '';
      const noteHtml = ep.note
        ? `<div class="log-card-note">${escapeHtml(String(ep.note).slice(0, 120))}${String(ep.note).length > 120 ? '…' : ''}</div>`
        : '';
      const titleHtml = ep.episode_title
        ? `<div class="log-card-title">${escapeHtml(ep.episode_title)}</div>`
        : '';
      // Single-line template — leading whitespace inside template literals
      // would otherwise be visible if any ancestor has white-space: pre.
      card.innerHTML =
        '<div class="log-card-head">' +
          '<span class="log-card-ep">EP ' + ep.episode_number + '</span>' +
          '<span class="log-card-date">' + fmtDate(ep.watched_date) + '</span>' +
          stars +
        '</div>' +
        titleHtml +
        noteHtml;
      card.addEventListener('click', () => showEpisodeEditModal(s, se, ep));
      body.appendChild(card);
    });
  }

  function showSeasonLogModal(s, se, eps) {
    const overlay = document.createElement('div');
    overlay.className = 'alert-overlay';
    overlay.setAttribute(LOG_MODAL_ATTR, se.season_id);
    overlay.style.zIndex = 10000;
    const stack = document.createElement('div');
    stack.className = 'alert-stack';
    stack.style.maxWidth = '600px';
    overlay.appendChild(stack);

    const card = document.createElement('div');
    card.className = 'alert-card';
    card.style.maxWidth = '600px';
    card.style.width = '100%';

    const head = document.createElement('div');
    head.className = 'alert-head';
    head.style.background = 'var(--lcars-cream)';
    const headTitle = document.createElement('span');
    headTitle.className = 'alert-head-title';
    const seasonNum = parseInt(se.season_number) || 1;
    headTitle.innerHTML = `<svg class="icon icon-md alert-head-icon"><use href="#i-library"/></svg><span>${escapeHtml(s.title_original)} · S${seasonNum}</span>`;
    head.appendChild(headTitle);

    const body = document.createElement('div');
    body.className = 'alert-body';
    body.style.padding = '16px 20px';
    body.style.maxHeight = '60vh';
    body.style.overflowY = 'auto';
    // .alert-body has white-space: pre-wrap which would render the literal
    // newlines + indentation in our template strings as visible empty lines
    // between elements. Override it for the log list.
    body.style.whiteSpace = 'normal';
    body.style.lineHeight = '1.4';
    renderLogModalBody(body, s, se, eps);

    const footer = document.createElement('div');
    footer.className = 'alert-footer confirm';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'alert-ok';
    closeBtn.textContent = t('libClose');
    closeBtn.addEventListener('click', () => closeOverlay(overlay));

    const addBtn = document.createElement('button');
    addBtn.className = 'alert-ok';
    addBtn.style.background = 'var(--lcars-cream)';
    addBtn.style.color = 'var(--lcars-bg)';
    addBtn.textContent = t('libLogAddManual');
    addBtn.addEventListener('click', () => {
      // Fresh-up: pull the latest cached versions in case data has changed
      // since the modal was opened
      const s2 = findSeriesInCache(s.id) || s;
      const se2 = findSeasonInCache(se.season_id) || se;
      showEpisodeEditModal(s2, se2, null);
    });

    footer.appendChild(closeBtn);
    footer.appendChild(addBtn);
    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(footer);
    stack.appendChild(card);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeOverlay(overlay); });
    openOverlay(overlay);
  }

  // ── Series ⋯ menu ─────────────────────────────────────────────────────────

  function showSeriesMenu(s, se, anchor) {
    document.querySelectorAll('.lib-series-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'note-menu lib-series-menu';
    menu.dataset.owner = se.season_id;
    menu.style.width = '180px';
    menu.addEventListener('mousedown', e => e.stopPropagation());

    const makeItem = (label, fn) => {
      const btn = document.createElement('button');
      btn.className = 'note-menu-delete';
      btn.style.cssText = 'background:var(--lcars-frame);color:var(--lcars-cream);margin:0';
      btn.textContent = label;
      btn.addEventListener('click', () => { menu.remove(); fn(); });
      return btn;
    };

    // Status changes now happen inside the edit form (along with everything
    // else). Keep the menu focused on the two top-level actions.
    menu.appendChild(makeItem(t('libMenuEdit'), () => showLibraryEditForm(s, se)));
    menu.appendChild(makeItem(t('libMenuAddSeason'), () => showAddSeasonForm(s)));
    menu.appendChild(makeItem(t('libMenuDelSeason'), () => libDeleteSeason(s, se)));
    menu.appendChild(makeItem(t('libMenuDelete'), () => libDeleteSeries(s)));

    document.body.appendChild(menu);
    positionPopoverBelow(menu, anchor);

    // Auto-close on outside click
    setTimeout(() => {
      const onDown = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== anchor) {
          menu.remove();
          document.removeEventListener('mousedown', onDown);
        }
      };
      document.addEventListener('mousedown', onDown);
    }, 0);
  }

  async function libDeleteSeries(s) {
    const confirmed = await lcarsConfirm({
      title: t('libDeleteTitle'),
      body:  t('libDeleteBody').replace('{name}', s.title_original || ''),
      okLabel: t('libDelete'),
      cancelLabel: t('libCancel'),
      danger: true
    });
    if (!confirmed) return;
    try {
      await libPost({ action: 'delete_series', id: s.id });
      beep(560);
      await fetchLibrary();
    } catch(e) {
      console.error('[LIBRARY] delete_series failed:', e);
      beep(280);
    }
  }

  // Delete just THIS season (and its episodes). If it's the only season of
  // the series, also remove the parent series — an empty series serves no
  // purpose and would just sit invisible in the data.
  async function libDeleteSeason(s, se) {
    const allForSeries = libSeasonsCache.filter(x => String(x.series_id) === String(s.id));
    const isOnly = allForSeries.length <= 1;

    const seasonNum = parseInt(se.season_number) || 1;
    const titleParts = [s.title_original || ''];
    if (se.season_title) titleParts.push(se.season_title);
    const seasonLabel = `${s.title_original} · S${seasonNum}` + (se.season_title ? `: ${se.season_title}` : '');

    // Different copy when removing the only season vs. one of many.
    const bodyKey = isOnly ? 'libDelSeasonOnlyBody' : 'libDelSeasonBody';
    const confirmed = await lcarsConfirm({
      title: t('libDelSeasonTitle'),
      body:  t(bodyKey).replace('{label}', seasonLabel).replace('{name}', s.title_original || ''),
      okLabel: t('libDelete'),
      cancelLabel: t('libCancel'),
      danger: true
    });
    if (!confirmed) return;

    try {
      if (isOnly) {
        // Cascade-delete via delete_series (one round-trip; backend already
        // deletes seasons + episodes underneath).
        await libPost({ action: 'delete_series', id: s.id });
      } else {
        await libPost({ action: 'delete_season', season_id: se.season_id });
      }
      beep(560);
      await fetchLibrary();
    } catch(e) {
      console.error('[LIBRARY] delete_season failed:', e);
      beep(280);
    }
  }

  // ── Add / edit form ───────────────────────────────────────────────────────

  function buildSeriesFormBody(s, se) {
    const isEdit = !!s;
    const platformOpts = ['', ...PLATFORMS].map(p =>
      `<option value="${p}" ${s && s.platform === p ? 'selected' : ''}>${p || '—'}</option>`
    ).join('');
    const langOpts = LANGUAGES.map(L =>
      `<option value="${L}" ${s && s.language === L ? 'selected' : ''}>${langLabel(L)}</option>`
    ).join('');
    const statusOpts = STATUSES.map(st =>
      `<option value="${st}" ${
        (se && String(se.status).toUpperCase() === st) ? 'selected' :
        (!se && st === 'PLANNED') ? 'selected' : ''
      }>${st}</option>`
    ).join('');

    // The form always covers BOTH series-level fields and one season's
    // settings (its number / title / total episodes / status). On add the
    // user picks which season number; on edit it's the current card's season.
    const totalEpVal     = se ? (se.total_episodes || '') : '';
    const seasonTitleVal = se ? (se.season_title || '') : '';
    const seasonNumVal   = se ? (parseInt(se.season_number) || 1) : 1;
    // Neutral divider label: now that the season number is editable in both
    // modes, "SEASON 1" is no longer always correct, so use a generic header.
    const dividerLabel = t('libFormSeasonInfo');

    return `
      <div class="lib-form-grid">
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libFormTitleOrig')}</label>
          <input id="lf-title-orig" class="lib-form-input" placeholder="${t('libFormTitleOrigPH')}" value="${escapeAttr(s ? (s.title_original || '') : '')}">
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libFormTitleZh')}</label>
          <input id="lf-title-zh" class="lib-form-input" placeholder="${t('libFormTitleZhPH')}" value="${escapeAttr(s ? (s.title_zh || '') : '')}">
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormLanguage')}</label>
            <select id="lf-language" class="lib-form-select">${langOpts}</select>
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormPlatform')}</label>
            <select id="lf-platform" class="lib-form-select">${platformOpts}</select>
          </div>
        </div>

        <div class="lib-form-divider full">${dividerLabel}</div>
        <!-- Season row: number / year / season title / total episodes.
             Year sits next to season number because both are season-level. -->
        <div class="lib-form-field full" style="display:grid; grid-template-columns: 70px 90px 1fr 90px; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormSeasonNum')}</label>
            <input id="lf-season-num" class="lib-form-input" type="number" min="1" value="${escapeAttr(seasonNumVal)}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormYear')}</label>
            <input id="lf-year" class="lib-form-input" type="number" min="1900" max="2100" placeholder="?" value="${escapeAttr(se ? (se.year || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormSeasonTitle')}</label>
            <input id="lf-season-title" class="lib-form-input" placeholder="${t('libFormSeasonTitlePH')}" value="${escapeAttr(seasonTitleVal)}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormTotalEp')}</label>
            <input id="lf-total-ep" class="lib-form-input" type="number" min="0" placeholder="?" value="${escapeAttr(totalEpVal)}">
          </div>
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libFormStatus')}</label>
          <select id="lf-status" class="lib-form-select">${statusOpts}</select>
        </div>

        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libFormNote')}</label>
          <textarea id="lf-note" class="lib-form-textarea" placeholder="${t('libFormNotePH')}">${escapeHtml(s ? (s.notes || '') : '')}</textarea>
        </div>
      </div>`;
  }

  function showSeriesFormModal(s, se, title) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.style.zIndex = 10000;
      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      // alert-stack defaults to max-width:420px which would crop our wider
      // form modal — override for this stack only.
      stack.style.maxWidth = '640px';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card';
      card.style.maxWidth = '640px';
      card.style.width = '100%';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.style.background = 'var(--lcars-cream)';
      const headTitle = document.createElement('span');
      headTitle.className = 'alert-head-title';
      headTitle.innerHTML = `<svg class="icon icon-md alert-head-icon"><use href="#i-library"/></svg><span>${escapeHtml(title)}</span>`;
      head.appendChild(headTitle);

      const body = document.createElement('div');
      body.className = 'alert-body';
      // Generous padding + no max-height clamp so the form fits without
      // either a vertical or horizontal scrollbar at typical sizes.
      body.style.padding = '20px 24px';
      body.style.maxHeight = 'none';
      body.style.overflow = 'visible';
      body.innerHTML = buildSeriesFormBody(s, se);

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'alert-ok';
      saveBtn.style.background = 'var(--lcars-cream)';
      saveBtn.style.color = 'var(--lcars-bg)';
      saveBtn.textContent = t('libSave');

      const close = (result) => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(result);
      };
      const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(null); } };

      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', () => {
        const titleOrig = document.getElementById('lf-title-orig')?.value.trim();
        if (!titleOrig) { document.getElementById('lf-title-orig')?.focus(); return; }
        const seasonNumRaw = parseInt(document.getElementById('lf-season-num')?.value);
        const seasonNum    = (seasonNumRaw && seasonNumRaw >= 1) ? seasonNumRaw : 1;
        const result = {
          // Series-level
          title_original: titleOrig,
          title_zh:       document.getElementById('lf-title-zh')?.value.trim() || '',
          language:       document.getElementById('lf-language')?.value || 'OTHER',
          platform:       document.getElementById('lf-platform')?.value || '',
          notes:          document.getElementById('lf-note')?.value || '',
          // Season-level
          season_number:  seasonNum,
          season_title:   document.getElementById('lf-season-title')?.value.trim() || '',
          year:           parseInt(document.getElementById('lf-year')?.value) || '',
          total_episodes: parseInt(document.getElementById('lf-total-ep')?.value) || 0,
          status:         document.getElementById('lf-status')?.value || 'PLANNED'
        };
        close(result);
      });
      overlay.addEventListener('mousedown', (ev) => { if (ev.target === overlay) close(null); });
      document.addEventListener('keydown', onKey);

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      openOverlay(overlay);
      requestAnimationFrame(() => document.getElementById('lf-title-orig')?.focus());
    });
  }

  async function showLibraryAddForm() {
    const result = await showSeriesFormModal(null, null, t('libAddSeries'));
    if (!result) return;
    try {
      await libPost({
        action: 'add_series',
        title_original: result.title_original,
        title_zh:       result.title_zh,
        language:       result.language,
        platform:       result.platform,
        notes:          result.notes,
        create_first_season:    true,
        first_season_number:    result.season_number,
        first_season_title:     result.season_title,
        first_season_year:      result.year,
        first_season_total_eps: result.total_episodes,
        status:                 result.status
      });
      beep(620);
      await fetchLibrary();
    } catch(e) {
      console.error('[LIBRARY] add_series failed:', e);
      beep(280);
    }
  }

  async function showLibraryEditForm(s, se) {
    const result = await showSeriesFormModal(s, se, '✎ ' + (s.title_original || ''));
    if (!result) return;
    try {
      // Update both records in parallel — series-level + this-season-level.
      await Promise.all([
        libPost({
          action: 'update_series',
          id:             s.id,
          title_original: result.title_original,
          title_zh:       result.title_zh,
          language:       result.language,
          platform:       result.platform,
          notes:          result.notes
        }),
        libPost({
          action: 'update_season',
          season_id:      se.season_id,
          season_number:  result.season_number,
          season_title:   result.season_title,
          year:           result.year,
          total_episodes: result.total_episodes,
          status:         result.status
        })
      ]);
      beep(560);
      await fetchLibrary();
    } catch(e) {
      console.error('[LIBRARY] update failed:', e);
      beep(280);
    }
  }

  // ── Add Season modal — compact form for adding the next season of an
  //    existing series. Series-level fields (title, language, etc.) are
  //    fixed since they belong to the series, not the season.
  async function showAddSeasonForm(s) {
    // Compute default season number = max existing for this series + 1
    const existing = libSeasonsCache.filter(x => String(x.series_id) === String(s.id));
    const maxNum = existing.reduce((m, x) => Math.max(m, parseInt(x.season_number) || 0), 0);
    const defaultNum = maxNum + 1;

    const result = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.style.zIndex = 10000;
      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      stack.style.maxWidth = '640px';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card';
      card.style.maxWidth = '640px';
      card.style.width = '100%';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.style.background = 'var(--lcars-cream)';
      const headTitle = document.createElement('span');
      headTitle.className = 'alert-head-title';
      headTitle.innerHTML = `<svg class="icon icon-md alert-head-icon"><use href="#i-library"/></svg><span>${escapeHtml(s.title_original)} · ${t('libMenuAddSeason')}</span>`;
      head.appendChild(headTitle);

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.style.padding = '20px 24px';
      body.style.maxHeight = 'none';
      body.style.overflow = 'visible';

      const statusOpts = STATUSES.map(st =>
        `<option value="${st}" ${st === 'PLANNED' ? 'selected' : ''}>${st}</option>`
      ).join('');

      body.innerHTML = `
        <div class="lib-form-grid">
          <div class="lib-form-field full" style="display:grid; grid-template-columns: 70px 90px 1fr 90px; gap:12px;">
            <div class="lib-form-field">
              <label class="lib-form-label">${t('libFormSeasonNum')}</label>
              <input id="as-num" class="lib-form-input" type="number" min="1" value="${defaultNum}">
            </div>
            <div class="lib-form-field">
              <label class="lib-form-label">${t('libFormYear')}</label>
              <input id="as-year" class="lib-form-input" type="number" min="1900" max="2100" placeholder="?">
            </div>
            <div class="lib-form-field">
              <label class="lib-form-label">${t('libFormSeasonTitle')}</label>
              <input id="as-title" class="lib-form-input" placeholder="${t('libFormSeasonTitlePH')}">
            </div>
            <div class="lib-form-field">
              <label class="lib-form-label">${t('libFormTotalEp')}</label>
              <input id="as-eps" class="lib-form-input" type="number" min="0" placeholder="?">
            </div>
          </div>
          <div class="lib-form-field full">
            <label class="lib-form-label">${t('libFormStatus')}</label>
            <select id="as-status" class="lib-form-select">${statusOpts}</select>
          </div>
        </div>`;

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'alert-ok';
      saveBtn.style.background = 'var(--lcars-cream)';
      saveBtn.style.color = 'var(--lcars-bg)';
      saveBtn.textContent = t('libSave');

      const close = (val) => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(val);
      };
      const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(null); } };

      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', () => {
        const numRaw = parseInt(document.getElementById('as-num').value);
        const num    = (numRaw && numRaw >= 1) ? numRaw : 1;
        close({
          season_number:  num,
          year:           parseInt(document.getElementById('as-year').value) || '',
          season_title:   document.getElementById('as-title').value.trim(),
          total_episodes: parseInt(document.getElementById('as-eps').value) || 0,
          status:         document.getElementById('as-status').value || 'PLANNED'
        });
      });
      overlay.addEventListener('mousedown', ev => { if (ev.target === overlay) close(null); });
      document.addEventListener('keydown', onKey);

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      openOverlay(overlay);
      requestAnimationFrame(() => document.getElementById('as-num')?.focus());
    });

    if (!result) return;
    try {
      await libPost({
        action:    'add_season',
        series_id: s.id,
        ...result
      });
      beep(620);
      await fetchLibrary();
    } catch(e) {
      console.error('[LIBRARY] add_season failed:', e);
      beep(280);
    }
  }

  // ── Sub-tab switching (unchanged) ──────────────────────────────────────────

  const LIB_SUBTABS = {
    series:     { sub: 'libSubSeries',     add: 'libAddSeries', handler: () => showLibraryAddForm() },
    films:      { sub: 'libSubFilms',      add: 'libAddFilm',   handler: null },
    reading:    { sub: 'libSubReading',    add: 'libAddBook',   handler: null },
    collection: { sub: 'libSubCollection', add: 'libAddItem',   handler: null }
  };

  let currentLibSubtab = 'series';
  try {
    const saved = sessionStorage.getItem('lcars_lib_subtab');
    if (saved && LIB_SUBTABS[saved]) currentLibSubtab = saved;
  } catch(e) {}

  function setLibSubtab(name) {
    if (!LIB_SUBTABS[name]) return;
    currentLibSubtab = name;
    try { sessionStorage.setItem('lcars_lib_subtab', name); } catch(e) {}

    document.querySelectorAll('.lib-subtab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-subtab') === name);
    });
    document.querySelectorAll('.lib-subtab-panel').forEach(p => {
      p.hidden = p.getAttribute('data-subtab-panel') !== name;
    });

    if (currentPage === 'library' && typeof updatePageHeader === 'function') {
      updatePageHeader();
      updatePageActionButton();
    }
    beep(560);
  }

  function libraryAddBtnClick() {
    const cfg = LIB_SUBTABS[currentLibSubtab];
    if (cfg && cfg.handler) cfg.handler();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function initLibrary() {
    setLibSubtab(currentLibSubtab);

    document.querySelectorAll('.tab-btn[data-tab="library"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (libSeriesCache.length === 0 && !libLoading) fetchLibrary();
      });
    });
    // Render filter bar with initial counts (zero) on load
    renderLibFilters();

    // Expose for inline onclick handlers
    window.setLibFilter = setLibFilter;
    window.setLibSearch = setLibSearch;
    window.setLibSubtab = setLibSubtab;
    window.libraryAddBtnClick = libraryAddBtnClick;
  }

