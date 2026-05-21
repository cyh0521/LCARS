// js/films.js — Film Log tracker (Library › FILMS sub-tab)
//
// Data model (Google Sheets columns):
//   id, title_original, title_zh, year, director, language, genre,
//   platform, status, rating, watched_date, runtime_min, notes
//
// Statuses: WATCHED · WANT_TO_WATCH · REWATCHING · DROPPED

  /* ============================================================
     CONFIG
     ============================================================ */
  // Reuse the same Apps Script as library.js — the sheet is 'films'
  const FILMS_API_URL = 'https://script.google.com/macros/s/AKfycbz95Pnc9LeWAMtVmPIQePNK45-7akEonTCry3jjtH3UUdNTf4rUtzCpkeelQED0orLA/exec';

  const FILM_STATUSES    = ['WATCHED', 'WANT_TO_WATCH', 'REWATCHING', 'DROPPED'];
  const FILM_STATUS_KEY  = {
    'WATCHED':       'watched',
    'WANT_TO_WATCH': 'want',
    'REWATCHING':    'rewatching',
    'DROPPED':       'dropped',
  };
  const FILM_LANGUAGES   = ['CHINESE', 'ENGLISH', 'JAPANESE', 'KOREAN', 'OTHER'];
  const FILM_PLATFORMS   = ['Netflix', 'Disney+', 'Apple TV+', 'HBO Max', 'MyVideo', 'YouTube', '院線', '其他'];
  const FILM_GENRES      = ['ACTION', 'ANIMATION', 'COMEDY', 'CRIME', 'DOCUMENTARY', 'DRAMA',
                             'FANTASY', 'HORROR', 'ROMANCE', 'SCI-FI', 'THRILLER', 'OTHER'];

  /* ============================================================
     STATE
     ============================================================ */
  let filmsCache   = [];
  let filmFilter   = 'all';
  let filmSearch   = '';
  let filmLoading  = false;

  /* ============================================================
     NORMALISATION
     ============================================================ */
  function normalizeFilmRow(row) {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    Object.keys(row).forEach(k => {
      const nk = String(k).trim().toLowerCase().replace(/\s+/g, '_');
      out[nk] = row[k];
    });
    return out;
  }

  /* ============================================================
     API
     ============================================================ */
  async function filmsGet(params = {}) {
    const url = new URL(FILMS_API_URL);
    Object.entries({ sheet: 'films', ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    const data = (raw && typeof raw === 'object' && 'ok' in raw)
      ? (raw.ok ? raw.data : (() => { throw new Error(raw.error || 'API error'); })())
      : raw;
    return Array.isArray(data) ? data.map(normalizeFilmRow) : data;
  }

  async function filmsPost(body) {
    const res = await fetch(FILMS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ sheet: 'films', ...body }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    return (raw && typeof raw === 'object' && 'ok' in raw)
      ? (raw.ok ? raw.data : (() => { throw new Error(raw.error || 'API error'); })())
      : raw;
  }

  /* ============================================================
     LOAD
     ============================================================ */
  async function fetchFilms() {
    filmLoading = true;
    renderFilmsGrid();
    try {
      const data = await filmsGet();
      filmsCache  = Array.isArray(data) ? data : [];
      filmLoading = false;
      renderFilmsGrid();
      renderFilmsFilters();
    } catch(e) {
      console.error('[FILMS] Fetch failed:', e);
      filmLoading = false;
      renderFilmsError();
    }
  }

  /* ============================================================
     FILTER
     ============================================================ */
  function setFilmFilter(f) {
    filmFilter = f;
    renderFilmsFilters();
    renderFilmsGrid();
  }

  function setFilmSearch(q) {
    filmSearch = String(q || '').trim().toLowerCase();
    renderFilmsGrid();
    const clr = document.getElementById('film-search-clear');
    if (clr) clr.style.visibility = filmSearch ? 'visible' : 'hidden';
  }

  function filteredFilms() {
    let list = filmsCache.slice();
    if (filmFilter !== 'all') {
      const target = filmFilter.toUpperCase().replace('-', '_');
      list = list.filter(f => {
        const st = String(f.status || 'WANT_TO_WATCH').toUpperCase();
        return st === target;
      });
    }
    if (filmSearch) {
      list = list.filter(f => {
        const orig = String(f.title_original || '').toLowerCase();
        const zh   = String(f.title_zh || '').toLowerCase();
        const dir  = String(f.director || '').toLowerCase();
        return orig.includes(filmSearch) || zh.includes(filmSearch) || dir.includes(filmSearch);
      });
    }
    // Sort: most recently watched first; un-dated "want" cards at the end
    list.sort((a, b) => {
      const da = a.watched_date ? new Date(a.watched_date) : null;
      const db = b.watched_date ? new Date(b.watched_date) : null;
      if (da && db) return db - da;
      if (da) return -1;
      if (db) return 1;
      return String(a.title_original || '').localeCompare(String(b.title_original || ''));
    });
    return list;
  }

  /* ============================================================
     FILTER BAR
     ============================================================ */
  function renderFilmsFilters() {
    const bar = document.getElementById('film-filter-bar');
    if (!bar) return;

    const counts = { all: filmsCache.length, watched: 0, want: 0, rewatching: 0, dropped: 0 };
    filmsCache.forEach(f => {
      const k = FILM_STATUS_KEY[String(f.status || 'WANT_TO_WATCH').toUpperCase()] || 'want';
      if (counts[k] !== undefined) counts[k]++;
    });

    const filters = [
      ['all',        t('filmFilterAll')],
      ['watched',    t('filmFilterWatched')],
      ['want',       t('filmFilterWant')],
      ['rewatching', t('filmFilterRewatching')],
      ['dropped',    t('filmFilterDropped')],
    ];

    const btns = filters.map(([key, label]) => `
      <button class="lib-filter-btn${filmFilter === key ? ' active' : ''}"
              onclick="setFilmFilter('${key}')">
        ${escapeHtml(label)}<span class="count">${counts[key]}</span>
      </button>`).join('');

    const search = `
      <div class="lib-search">
        <input id="film-search-input" type="text" class="lib-search-input"
               placeholder="${escapeAttr(t('filmSearchPH'))}"
               value="${escapeAttr(filmSearch)}"
               oninput="setFilmSearch(this.value)">
        <button id="film-search-clear" class="lib-search-clear"
                style="visibility:${filmSearch ? 'visible' : 'hidden'}"
                onclick="document.getElementById('film-search-input').value=''; setFilmSearch('');"
                aria-label="Clear">✕</button>
      </div>`;

    bar.innerHTML = btns + search;
  }

  /* ============================================================
     GRID RENDER
     ============================================================ */
  function renderFilmsGrid() {
    const grid = document.getElementById('film-grid');
    if (!grid) return;

    if (filmLoading) {
      grid.innerHTML = `<div class="lib-state">${t('libLoading')}</div>`;
      return;
    }

    const list = filteredFilms();
    if (!list.length) {
      if (filmsCache.length === 0) {
        grid.innerHTML = `
          <div class="lib-state empty">
            <div>${t('filmEmpty')}</div>
            <button class="lib-state-add-btn" onclick="showFilmAddForm()">+ ${t('libAddFilm')}</button>
          </div>`;
      } else {
        grid.innerHTML = `<div class="lib-state empty">${t('filmNoMatch')}</div>`;
      }
      return;
    }

    grid.innerHTML = '';
    list.forEach(f => grid.appendChild(buildFilmCard(f)));
  }

  function renderFilmsError() {
    const grid = document.getElementById('film-grid');
    if (grid) grid.innerHTML = `
      <div class="lib-state error">
        <div>${t('libError')}</div>
        <button class="lib-state-add-btn" onclick="fetchFilms()">${t('libRetry')}</button>
      </div>`;
  }

  /* ============================================================
     FILM CARD
     ============================================================ */
  function buildFilmCard(f) {
    const status    = String(f.status || 'WANT_TO_WATCH').toUpperCase();
    const statusCls = FILM_STATUS_KEY[status] || 'want';
    const rating    = parseFloat(f.rating) || 0;

    const card = document.createElement('div');
    card.className = `series-card status-film-${statusCls}`;
    card.dataset.filmId = f.id;

    // POSTER
    const poster = document.createElement('div');
    poster.className = 'series-poster';
    const img = document.createElement('img');
    img.alt = '';
    img.src = `images/posters/films/${f.id}.jpg`;
    img.onerror = function() {
      poster.removeChild(img);
      const ph = document.createElement('div');
      ph.className = 'series-poster-placeholder';
      ph.textContent = '🎬';
      poster.appendChild(ph);
    };
    poster.appendChild(img);

    // BODY
    const body = document.createElement('div');
    body.className = 'series-card-body';

    // Head: title + status pill
    const head = document.createElement('div');
    head.className = 'series-card-head';
    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'flex:1; min-width:0;';
    const titleOrig = document.createElement('div');
    titleOrig.className = 'series-title';
    titleOrig.textContent = f.title_original || '(Untitled)';
    titleWrap.appendChild(titleOrig);
    if (f.title_zh) {
      const titleZh = document.createElement('div');
      titleZh.className = 'series-title-zh';
      titleZh.textContent = f.title_zh;
      titleWrap.appendChild(titleZh);
    }
    const pill = document.createElement('div');
    pill.className = `series-status-pill ${statusCls}`;
    pill.textContent = filmStatusLabel(status);
    head.appendChild(titleWrap);
    head.appendChild(pill);

    // Meta line: year · director · lang · genre · platform
    const meta = document.createElement('div');
    meta.className = 'series-meta';
    const metaParts = [];
    if (f.year)     metaParts.push(f.year);
    if (f.director) metaParts.push(f.director);
    if (f.language) metaParts.push(langShort(f.language));
    if (f.genre)    metaParts.push(f.genre);
    if (f.platform) metaParts.push(f.platform);
    meta.textContent = metaParts.join(' · ');

    // Runtime + watched date
    const info = document.createElement('div');
    info.className = 'series-ep-line';
    const infoParts = [];
    if (f.runtime_min) infoParts.push(`${f.runtime_min} ${t('filmMin')}`);
    if (f.watched_date) infoParts.push(`${t('libLastSeen')} ${fmtDate(f.watched_date)}`);
    info.textContent = infoParts.join('  ·  ') || t('libNeverSeen');

    // Star rating display
    const stars = document.createElement('div');
    stars.className = 'film-rating-display';
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className = 'film-star' + (i <= rating ? ' lit' : '');
      s.textContent = '★';
      stars.appendChild(s);
    }
    if (f.notes) {
      const noteBadge = document.createElement('span');
      noteBadge.className = 'film-note-badge';
      noteBadge.title = f.notes;
      noteBadge.textContent = '📝';
      stars.appendChild(noteBadge);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'series-actions';

    // Mark watched (only for WANT_TO_WATCH)
    if (status === 'WANT_TO_WATCH') {
      const watchBtn = document.createElement('button');
      watchBtn.className = 'series-btn primary';
      watchBtn.textContent = t('filmBtnMarkWatched');
      watchBtn.addEventListener('click', () => showFilmMarkWatchedModal(f));
      actions.appendChild(watchBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'series-btn';
    editBtn.textContent = t('filmBtnEdit');
    editBtn.addEventListener('click', () => showFilmEditForm(f));

    const delBtn = document.createElement('button');
    delBtn.className = 'series-btn icon-btn';
    delBtn.textContent = '⋯';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      showFilmMenu(f, delBtn);
    });

    const spacer = document.createElement('div');
    spacer.style.flex = '1';

    if (status !== 'WANT_TO_WATCH') actions.appendChild(editBtn);
    actions.appendChild(spacer);
    actions.appendChild(delBtn);

    body.appendChild(head);
    body.appendChild(meta);
    body.appendChild(info);
    body.appendChild(stars);
    body.appendChild(actions);

    card.appendChild(poster);
    card.appendChild(body);
    return card;
  }

  function filmStatusLabel(status) {
    const map = {
      'WATCHED':       t('filmStatusWatched'),
      'WANT_TO_WATCH': t('filmStatusWant'),
      'REWATCHING':    t('filmStatusRewatching'),
      'DROPPED':       t('filmStatusDropped'),
    };
    return map[status] || status;
  }

  /* ============================================================
     ⋯ CONTEXT MENU
     ============================================================ */
  function showFilmMenu(f, anchor) {
    const existing = document.getElementById('film-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'film-ctx-menu';
    menu.className = 'lib-ctx-menu';

    const items = [
      { label: t('filmMenuEdit'),   fn: () => showFilmEditForm(f) },
      { label: t('filmMenuDelete'), fn: () => confirmFilmDelete(f), danger: true },
    ];
    items.forEach(({ label, fn, danger }) => {
      const btn = document.createElement('button');
      btn.className = 'lib-ctx-item' + (danger ? ' danger' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { menu.remove(); fn(); });
      menu.appendChild(btn);
    });

    const rect = anchor.getBoundingClientRect();
    menu.style.cssText = `position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px; z-index:9999;`;
    document.body.appendChild(menu);

    const dismiss = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', dismiss); } };
    setTimeout(() => document.addEventListener('click', dismiss), 10);
    beep(560);
  }

  /* ============================================================
     FORM HELPERS
     ============================================================ */
  function buildFilmFormBody(f) {
    const isEdit = !!f;
    const platformOpts = ['', ...FILM_PLATFORMS].map(p =>
      `<option value="${p}" ${f && f.platform === p ? 'selected' : (!f && !p ? 'selected' : '')}>${p || '—'}</option>`
    ).join('');
    const langOpts = FILM_LANGUAGES.map(L =>
      `<option value="${L}" ${f && f.language === L ? 'selected' : ''}>${langLabel(L)}</option>`
    ).join('');
    const statusOpts = FILM_STATUSES.map(st =>
      `<option value="${st}" ${f && String(f.status).toUpperCase() === st ? 'selected' : (!f && st === 'WANT_TO_WATCH' ? 'selected' : '')}>${filmStatusLabel(st)}</option>`
    ).join('');
    const genreOpts = ['', ...FILM_GENRES].map(g =>
      `<option value="${g}" ${f && f.genre === g ? 'selected' : (!f && !g ? 'selected' : '')}>${g || '—'}</option>`
    ).join('');

    return `
      <div class="lib-form-grid">
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('filmFormTitleOrig')}</label>
          <input id="ff-title-orig" class="lib-form-input" placeholder="${t('filmFormTitleOrigPH')}" value="${escapeAttr(f ? (f.title_original || '') : '')}">
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('filmFormTitleZh')}</label>
          <input id="ff-title-zh" class="lib-form-input" placeholder="${t('filmFormTitleZhPH')}" value="${escapeAttr(f ? (f.title_zh || '') : '')}">
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:80px 1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormYear')}</label>
            <input id="ff-year" class="lib-form-input" type="number" min="1900" max="2100" placeholder="?" value="${escapeAttr(f ? (f.year || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormDirector')}</label>
            <input id="ff-director" class="lib-form-input" placeholder="${t('filmFormDirectorPH')}" value="${escapeAttr(f ? (f.director || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormRuntime')}</label>
            <input id="ff-runtime" class="lib-form-input" type="number" min="0" placeholder="?" value="${escapeAttr(f ? (f.runtime_min || '') : '')}">
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormLanguage')}</label>
            <select id="ff-language" class="lib-form-select">${langOpts}</select>
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormGenre')}</label>
            <select id="ff-genre" class="lib-form-select">${genreOpts}</select>
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormStatus')}</label>
            <select id="ff-status" class="lib-form-select">${statusOpts}</select>
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormPlatform')}</label>
            <select id="ff-platform" class="lib-form-select">${platformOpts}</select>
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:end;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormWatchedDate')}</label>
            <input id="ff-date" class="lib-form-input" type="date" value="${escapeAttr(f ? (f.watched_date ? String(f.watched_date).slice(0,10) : '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormRating')}</label>
            <div id="ff-star-picker" class="lib-star-picker">${buildFilmStarPickerHTML(f ? parseFloat(f.rating)||0 : 0)}</div>
            <input id="ff-rating" type="hidden" value="${escapeAttr(f ? (f.rating || 0) : 0)}">
          </div>
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libFormNote')}</label>
          <textarea id="ff-note" class="lib-form-textarea" placeholder="${t('libFormNotePH')}">${escapeHtml(f ? (f.notes || '') : '')}</textarea>
        </div>
        ${isEdit ? `
        <div class="lib-form-field full lib-form-id-row">
          <label class="lib-form-label">FILM ID</label>
          <div class="lib-form-id-box" id="film-copy-id-btn"
               onclick="(function(el){navigator.clipboard.writeText('${f.id}').then(()=>{el.classList.add('copied');setTimeout(()=>el.classList.remove('copied'),1200)})})(document.getElementById('film-copy-id-btn'))"
               title="點擊複製">
            <span class="lib-form-id-val">${f.id}</span>
            <span class="lib-form-id-copy">⎘</span>
          </div>
        </div>` : ''}
      </div>`;
  }

  function buildFilmStarPickerHTML(initial) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="lib-star${i <= initial ? ' lit' : ''}" data-val="${i}" onclick="filmStarClick(${i})">★</span>`;
    }
    return html;
  }

  function filmStarClick(val) {
    const current = parseInt(document.getElementById('ff-rating').value) || 0;
    const newVal = current === val ? 0 : val;  // click same star = clear
    document.getElementById('ff-rating').value = newVal;
    document.querySelectorAll('#ff-star-picker .lib-star').forEach((s, i) => {
      s.classList.toggle('lit', i < newVal);
    });
  }
  window.filmStarClick = filmStarClick;

  /* ============================================================
     MODAL — ADD / EDIT
     ============================================================ */
  function showFilmFormModal(f, title) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.style.zIndex = 10000;
      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      stack.style.maxWidth = '640px';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card';
      card.style.cssText = 'max-width:640px; width:100%;';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.style.background = 'var(--lcars-rust)';
      const headTitle = document.createElement('span');
      headTitle.className = 'alert-head-title';
      headTitle.innerHTML = `<svg class="icon icon-md alert-head-icon"><use href="#i-library"/></svg><span>${escapeHtml(title)}</span>`;
      head.appendChild(headTitle);

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.style.cssText = 'padding:20px 24px; max-height:none; overflow:visible;';
      body.innerHTML = buildFilmFormBody(f);

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'alert-ok';
      saveBtn.style.cssText = 'background:var(--lcars-rust); color:var(--lcars-bg);';
      saveBtn.textContent = t('libSave');

      const close = result => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(result);
      };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', () => {
        const result = {
          title_original: document.getElementById('ff-title-orig').value.trim(),
          title_zh:       document.getElementById('ff-title-zh').value.trim(),
          year:           document.getElementById('ff-year').value.trim(),
          director:       document.getElementById('ff-director').value.trim(),
          runtime_min:    document.getElementById('ff-runtime').value.trim(),
          language:       document.getElementById('ff-language').value,
          genre:          document.getElementById('ff-genre').value,
          status:         document.getElementById('ff-status').value,
          platform:       document.getElementById('ff-platform').value,
          watched_date:   document.getElementById('ff-date').value,
          rating:         document.getElementById('ff-rating').value,
          notes:          document.getElementById('ff-note').value.trim(),
        };
        if (!result.title_original) { beep(280); return; }
        close(result);
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.style.opacity = '1');

      // Pre-fill today's date if no date set and we're adding
      if (!f) {
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('ff-date').value = today;
      }
    });
  }

  async function showFilmAddForm() {
    const result = await showFilmFormModal(null, t('filmAddTitle'));
    if (!result) return;
    try {
      await filmsPost({ action: 'add', ...result });
      beep(720);
      await fetchFilms();
    } catch(e) {
      console.error('[FILMS] Add failed:', e);
      beep(280);
    }
  }
  window.showFilmAddForm = showFilmAddForm;

  async function showFilmEditForm(f) {
    const result = await showFilmFormModal(f, t('filmEditTitle'));
    if (!result) return;
    try {
      await filmsPost({ action: 'update', id: f.id, ...result });
      beep(720);
      await fetchFilms();
    } catch(e) {
      console.error('[FILMS] Edit failed:', e);
      beep(280);
    }
  }

  /* ============================================================
     MARK WATCHED QUICK MODAL
     ============================================================ */
  async function showFilmMarkWatchedModal(f) {
    const today = new Date().toISOString().slice(0, 10);
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.style.zIndex = 10000;
      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.style.background = 'var(--lcars-rust)';
      head.innerHTML = `<span class="alert-head-title">${escapeHtml(t('filmMarkWatchedTitle'))}</span>`;

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.style.padding = '20px 24px';
      body.innerHTML = `
        <div style="margin-bottom:14px; font-size:14px; color:var(--lcars-cream);">
          ${escapeHtml(f.title_original)}
        </div>
        <div class="lib-form-grid">
          <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:end;">
            <div class="lib-form-field">
              <label class="lib-form-label">${t('filmFormWatchedDate')}</label>
              <input id="fmw-date" class="lib-form-input" type="date" value="${today}">
            </div>
            <div class="lib-form-field">
              <label class="lib-form-label">${t('filmFormRating')}</label>
              <div id="fmw-star-picker" class="lib-star-picker">${buildFilmStarPickerHTML2('fmw', 0)}</div>
              <input id="fmw-rating" type="hidden" value="0">
            </div>
          </div>
        </div>`;

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'alert-ok';
      saveBtn.style.cssText = 'background:var(--lcars-rust); color:var(--lcars-bg);';
      saveBtn.textContent = t('filmBtnMarkWatched');

      const close = result => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(result);
      };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', async () => {
        const date   = document.getElementById('fmw-date').value;
        const rating = document.getElementById('fmw-rating').value;
        close(true);
        try {
          await filmsPost({ action: 'update', id: f.id, status: 'WATCHED', watched_date: date, rating });
          beep(720);
          await fetchFilms();
        } catch(e) {
          console.error('[FILMS] Mark watched failed:', e);
          beep(280);
        }
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.style.opacity = '1');

      // Set up a second star picker for this modal (uses different IDs)
      window._filmMarkWatchedStarClick = (val) => {
        const hiddenInput = document.getElementById('fmw-rating');
        const current = parseInt(hiddenInput.value) || 0;
        const newVal = current === val ? 0 : val;
        hiddenInput.value = newVal;
        document.querySelectorAll('#fmw-star-picker .lib-star').forEach((s, i) => {
          s.classList.toggle('lit', i < newVal);
        });
      };
    });
  }

  function buildFilmStarPickerHTML2(prefix, initial) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="lib-star${i <= initial ? ' lit' : ''}" data-val="${i}" onclick="window._filmMarkWatchedStarClick(${i})">★</span>`;
    }
    return html;
  }

  /* ============================================================
     DELETE
     ============================================================ */
  async function confirmFilmDelete(f) {
    // Use the app's existing alert pattern
    const confirmed = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.style.zIndex = 10001;
      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card confirm';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.innerHTML = `<span class="alert-head-title">${escapeHtml(t('filmDeleteTitle'))}</span>`;

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.innerHTML = `<p>${escapeHtml(t('filmDeleteBody').replace('{name}', f.title_original || f.id))}</p>`;

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const delBtn = document.createElement('button');
      delBtn.className = 'alert-ok';
      delBtn.style.cssText = 'background:var(--lcars-rust); color:var(--lcars-bg);';
      delBtn.textContent = t('libDelete');

      const close = r => { closeOverlay(overlay); resolve(r); };
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      cancelBtn.addEventListener('click', () => close(false));
      delBtn.addEventListener('click', () => close(true));

      footer.appendChild(cancelBtn);
      footer.appendChild(delBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.style.opacity = '1');
    });

    if (!confirmed) return;
    try {
      await filmsPost({ action: 'delete', id: f.id });
      beep(720);
      await fetchFilms();
    } catch(e) {
      console.error('[FILMS] Delete failed:', e);
      beep(280);
    }
  }

  /* ============================================================
     INIT (called by initLibrary when films tab is active)
     ============================================================ */
  function initFilms() {
    window.setFilmFilter     = setFilmFilter;
    window.setFilmSearch     = setFilmSearch;
    window.showFilmAddForm   = showFilmAddForm;
    window.fetchFilms        = fetchFilms;
  }
