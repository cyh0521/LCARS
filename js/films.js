// js/films.js — Film Log tracker (Library › FILMS sub-tab)
//
// Data model (Google Sheets columns):
//   id, title_original, title_zh, year, language, genre,
//   platform, status, rating, watched_date, rewatch_count, notes
//
// Statuses: WATCHED · WANT_TO_WATCH · REWATCHING

  /* ============================================================
     CONFIG
     ============================================================ */
  // Reuse the same Apps Script as library.js — the sheet is 'films'
  const FILMS_API_URL = 'https://script.google.com/macros/s/AKfycbz95Pnc9LeWAMtVmPIQePNK45-7akEonTCry3jjtH3UUdNTf4rUtzCpkeelQED0orLA/exec';

  const FILM_STATUSES    = ['WATCHED', 'WANT_TO_WATCH', 'REWATCHING'];
  const FILM_STATUS_KEY  = {
    'WATCHED':       'watched',
    'WANT_TO_WATCH': 'want',
    'REWATCHING':    'rewatching',
  };
  const FILM_LANGUAGES   = ['CHINESE', 'ENGLISH', 'JAPANESE', 'KOREAN', 'FRENCH', 'GERMAN', 'SPANISH', 'OTHER'];
  // Platforms with sentinel values for free-text entry
  const FILM_PLATFORMS = ['Netflix', 'Disney+', 'Apple TV+', 'HBO Max', 'MyVideo', 'YouTube', 'Cinema', 'Other'];
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
      body: JSON.stringify(body),
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

    const counts = { all: filmsCache.length, watched: 0, want: 0, rewatching: 0 };
    filmsCache.forEach(f => {
      const k = FILM_STATUS_KEY[String(f.status || 'WANT_TO_WATCH').toUpperCase()] || 'want';
      if (counts[k] !== undefined) counts[k]++;
    });

    const filters = [
      ['all',        t('filmFilterAll')],
      ['watched',    t('filmFilterWatched')],
      ['want',       t('filmFilterWant')],
      ['rewatching', t('filmFilterRewatching')],
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

    // Group by watched_date year (descending). Films with no date go into a
    // catch-all group at the end.
    const YEAR_PALETTE = [
      'var(--lcars-orange)',
      'var(--lcars-cream)',
      'var(--lcars-blue)',
      'var(--lcars-violet)',
      'var(--lcars-gold)',
      'var(--lcars-rust)'
    ];
    const yearMap = new Map();
    list.forEach(f => {
      const yr = f.watched_date ? String(f.watched_date).slice(0, 4) : '__';
      if (!yearMap.has(yr)) yearMap.set(yr, []);
      yearMap.get(yr).push(f);
    });
    // Sort years descending; no-date group last
    const sortedYears = [...yearMap.keys()].sort((a, b) => {
      if (a === '__') return 1;
      if (b === '__') return -1;
      return b - a;
    });
    sortedYears.forEach((yr, idx) => {
      const films = yearMap.get(yr);
      const groupEl = document.createElement('div');
      groupEl.className = 'lib-month-group';
      groupEl.style.setProperty('--month-color', YEAR_PALETTE[idx % YEAR_PALETTE.length]);

      const header = document.createElement('div');
      header.className = 'lib-month-header';
      header.innerHTML = `
        <span class="lib-month-tag"></span>
        <span class="lib-month-title">${escapeHtml(yr === '__' ? t('filmYearNone') : yr)}</span>
        <span class="lib-month-count">${films.length}</span>`;
      groupEl.appendChild(header);

      const inner = document.createElement('div');
      inner.className = 'lib-grid-inner';
      films.forEach(f => inner.appendChild(buildFilmCard(f)));
      groupEl.appendChild(inner);
      grid.appendChild(groupEl);
    });
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
    card.className = `series-card card-side-poster status-film-${statusCls}`;
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

    // Meta line: year · lang · platform
    const meta = document.createElement('div');
    meta.className = 'series-meta';
    const metaParts = [];
    if (f.year)     metaParts.push(f.year);
    if (f.language) metaParts.push(langShort(f.language));
    if (f.platform) {
      const m = f.platform.match(/^Cinema\s*\((.+)\)$/);
      metaParts.push(m ? m[1] : f.platform);
    }
    meta.textContent = metaParts.join(' · ');

    // Watched date + rewatch count
    const info = document.createElement('div');
    info.className = 'series-ep-line';
    const infoParts = [];
    const isWantCard = String(f.status).toUpperCase() === 'WANT_TO_WATCH';
    if (!isWantCard && f.watched_date) infoParts.push(`${t('libLastSeen')} ${fmtDate(f.watched_date)}`);
    const rewatchCount = parseInt(f.rewatch_count) || 0;
    if (rewatchCount > 0) infoParts.push(t('filmRewatchCount').replace('{n}', rewatchCount));
    if (!isWantCard && infoParts.length === 0) infoParts.push(t('libNeverSeen'));
    info.textContent = infoParts.join('  ·  ');

    // Star rating display — clickable for direct rating
    const stars = document.createElement('div');
    stars.className = 'film-rating-display';
    const starEls = [];
    let currentRating = parseFloat(f.rating) || 0;
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className = 'film-star' + (i <= currentRating ? ' lit' : '');
      s.textContent = '★';
      s.addEventListener('mouseenter', () => {
        starEls.forEach((st, idx) => st.classList.toggle('preview', idx < i));
      });
      s.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newRating = (i === currentRating) ? 0 : i;
        starEls.forEach(st => st.classList.remove('pulse'));
        void s.offsetWidth;
        s.classList.add('pulse');
        try {
          await filmsPost({ action: 'update_film', id: f.id, rating: newRating });
          currentRating = newRating;
          f.rating = newRating;
          starEls.forEach((st, idx) => st.classList.toggle('lit', idx < newRating));
        } catch(err) { beep(280); }
      });
      starEls.push(s);
      stars.appendChild(s);
    }
    stars.addEventListener('mouseleave', () => {
      starEls.forEach(st => st.classList.remove('preview'));
    });

    // Actions — only the ⋯ menu button
    const actions = document.createElement('div');
    actions.className = 'series-actions';

    if (status === 'WANT_TO_WATCH') {
      const watchBtn = document.createElement('button');
      watchBtn.className = 'series-btn primary';
      watchBtn.textContent = t('filmBtnMarkWatched');
      watchBtn.addEventListener('click', () => showFilmMarkWatchedModal(f));
      actions.appendChild(watchBtn);
    } else if (status === 'REWATCHING') {
      const rewatchBtn = document.createElement('button');
      rewatchBtn.className = 'series-btn primary';
      rewatchBtn.textContent = t('filmBtnLogRewatch');
      rewatchBtn.addEventListener('click', () => showFilmRewatchModal(f));
      actions.appendChild(rewatchBtn);
    }

    const spacer = document.createElement('div');
    spacer.style.flex = '1';

    const moreBtn = document.createElement('button');
    moreBtn.className = 'series-btn icon-btn';
    moreBtn.textContent = '⋯';
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      showFilmEditForm(f);
    });

    actions.appendChild(spacer);
    actions.appendChild(moreBtn);

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

    const currentPlatform = f ? (f.platform || '') : '';
    const platformOpts = FILM_PLATFORMS.map(p => {
      const isSelected = f
        ? (p === 'Cinema' ? currentPlatform.startsWith('Cinema') : currentPlatform === p)
        : p === FILM_PLATFORMS[0];
      return `<option value="${escapeAttr(p)}" ${isSelected ? 'selected' : ''}>${p}</option>`;
    }).join('');
    const langOpts = FILM_LANGUAGES.map(L =>
      `<option value="${L}" ${f && f.language === L ? 'selected' : ''}>${langLabel(L)}</option>`
    ).join('');
    const statusOpts = FILM_STATUSES.map(st =>
      `<option value="${st}" ${f && String(f.status).toUpperCase() === st ? 'selected' : (!f && st === 'WANT_TO_WATCH' ? 'selected' : '')}>${filmStatusLabel(st)}</option>`
    ).join('');

    // Cinema note
    const isCinema = f && f.platform && f.platform.startsWith('Cinema');
    const cinemaNote = isCinema && f.platform !== 'Cinema' ? f.platform.replace(/^Cinema\s*\(?(.*?)\)?$/, '$1') : '';

    const isWant = f ? String(f.status).toUpperCase() === 'WANT_TO_WATCH' : true;

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
            <label class="lib-form-label">${t('libFormLanguage')}</label>
            <select id="ff-language" class="lib-form-select">${langOpts}</select>
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormStatus')}</label>
            <select id="ff-status" class="lib-form-select" onchange="
              var isWant = this.value === 'WANT_TO_WATCH';
              var d = document.getElementById('ff-date');
              if (d) { d.disabled = isWant; d.style.opacity = isWant ? '0.35' : ''; }
            ">${statusOpts}</select>
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormWatchedDate')}</label>
            <input id="ff-date" class="lib-form-input" type="date"
              value="${escapeAttr(f && f.watched_date ? (function(d){
                const dt = d instanceof Date ? d : new Date(d);
                if (isNaN(dt.getTime())) return '';
                const pad = n => String(n).padStart(2,'0');
                return dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
              })(f.watched_date) : '')}"
              ${isWant ? 'disabled style="opacity:0.35"' : ''}>
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormPlatform')}</label>
            <select id="ff-platform-select" class="lib-form-select" onchange="
              var v = this.value;
              var row = document.getElementById('ff-cinema-row');
              if (row) row.style.display = v === 'Cinema' ? '' : 'none';
            ">${platformOpts}</select>
          </div>
        </div>
        <div class="lib-form-field full" id="ff-cinema-row" style="display:${isCinema ? '' : 'none'}">
          <label class="lib-form-label">${t('filmFormCinemaNote')}</label>
          <input id="ff-cinema-note" class="lib-form-input" placeholder="${t('filmFormCinemaNotePH')}" value="${escapeAttr(cinemaNote)}">
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
    const isEdit = !!f;
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

      const close = result => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(result);
      };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      /* backdrop-close disabled */

      // Edit mode: Delete button on the left
      if (isEdit) {
        const delBtn = document.createElement('button');
        delBtn.className = 'alert-ok danger';
        delBtn.style.cssText = 'background:var(--lcars-rust); color:var(--lcars-bg); margin-right:auto;';
        delBtn.textContent = t('libDelete');
        delBtn.addEventListener('click', () => {
          close(null);
          confirmFilmDelete(f);
        });
        footer.appendChild(delBtn);
      } else {
        footer.appendChild(document.createElement('span'));
      }

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'alert-ok';
      saveBtn.style.cssText = 'background:var(--lcars-orange); color:var(--lcars-bg);';
      saveBtn.textContent = t('libSave');

      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', () => {
        const result = {
          title_original: document.getElementById('ff-title-orig').value.trim(),
          title_zh:       document.getElementById('ff-title-zh').value.trim(),
          year:           document.getElementById('ff-year').value.trim(),
          language:       document.getElementById('ff-language').value,
          status:         document.getElementById('ff-status').value,
          platform:       (() => {
            const p = document.getElementById('ff-platform-select').value;
            if (p === 'Cinema') {
              const note = (document.getElementById('ff-cinema-note')?.value || '').trim();
              return note ? `Cinema (${note})` : 'Cinema';
            }
            return p;
          })(),
          watched_date:   document.getElementById('ff-status').value === 'WANT_TO_WATCH'
                            ? '' : document.getElementById('ff-date').value,
          notes:          document.getElementById('ff-note').value.trim(),
        };
        if (!result.title_original) { beep(280); return; }
        close(result);
      });

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex; gap:8px;';
      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(saveBtn);
      footer.appendChild(btnRow);

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      openOverlay(overlay);
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
      await filmsPost({ action: 'add_film', ...result });
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
      await filmsPost({ action: 'update_film', id: f.id, ...result });
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
      card.style.borderColor = 'var(--lcars-cream)';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.style.background = 'var(--lcars-cream)';
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
      saveBtn.style.cssText = 'background:var(--lcars-cream); color:var(--lcars-bg);';
      saveBtn.textContent = t('filmBtnMarkWatched');

      const close = result => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(result);
      };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      /* backdrop-close disabled */
      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', async () => {
        const date   = document.getElementById('fmw-date').value;
        const rating = document.getElementById('fmw-rating').value;
        close(true);
        try {
          await filmsPost({ action: 'update_film', id: f.id, status: 'WATCHED', watched_date: date, rating });
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
      openOverlay(overlay);
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
  /* ============================================================
     LOG REWATCH MODAL — increments rewatch_count + updates date
     ============================================================ */
  async function showFilmRewatchModal(f) {
    const today = new Date().toISOString().slice(0, 10);
    const currentCount = parseInt(f.rewatch_count) || 1;  // already watched at least once

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.style.zIndex = 10000;
      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card';
      card.style.borderColor = 'var(--lcars-cream)';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.style.background = 'var(--lcars-cream)';
      head.innerHTML = `<span class="alert-head-title">${escapeHtml(t('filmRewatchTitle'))}</span>`;

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.style.padding = '20px 24px';
      body.innerHTML = `
        <div style="margin-bottom:14px; font-size:14px; color:var(--lcars-cream);">${escapeHtml(f.title_original)}</div>
        <div style="margin-bottom:16px; font-size:12px; letter-spacing:0.12em; color:var(--lcars-orange);">
          ${escapeHtml(t('filmRewatchCurrent').replace('{n}', currentCount))}
          &nbsp;→&nbsp;
          <strong>${currentCount + 1}</strong>
        </div>
        <div class="lib-form-grid">
          <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:end;">
            <div class="lib-form-field">
              <label class="lib-form-label">${t('filmRewatchDate')}</label>
              <input id="frw-date" class="lib-form-input" type="date" value="${today}">
            </div>
            <div class="lib-form-field">
              <label class="lib-form-label">${t('filmFormRating')}</label>
              <div id="frw-star-picker" class="lib-star-picker">${buildFilmRewatchStarPickerHTML(parseFloat(f.rating)||0)}</div>
              <input id="frw-rating" type="hidden" value="${escapeAttr(f.rating || 0)}">
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
      saveBtn.style.cssText = 'background:var(--lcars-cream); color:var(--lcars-bg);';
      saveBtn.textContent = t('filmBtnLogRewatch');

      const close = r => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(r);
      };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      /* backdrop-close disabled */
      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', async () => {
        const date   = document.getElementById('frw-date').value;
        const rating = document.getElementById('frw-rating').value;
        close(true);
        try {
          await filmsPost({
            action:        'update_film',
            id:            f.id,
            watched_date:  date,
            rating:        rating,
            rewatch_count: currentCount + 1,
          });
          beep(720);
          await fetchFilms();
        } catch(e) {
          console.error('[FILMS] Log rewatch failed:', e);
          beep(280);
        }
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      openOverlay(overlay);
      requestAnimationFrame(() => overlay.style.opacity = '1');

      window._filmRewatchStarClick = val => {
        const h = document.getElementById('frw-rating');
        const cur = parseInt(h.value) || 0;
        const nv = cur === val ? 0 : val;
        h.value = nv;
        document.querySelectorAll('#frw-star-picker .lib-star').forEach((s, i) => s.classList.toggle('lit', i < nv));
      };
    });
  }

  function buildFilmRewatchStarPickerHTML(initial) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="lib-star${i <= initial ? ' lit' : ''}" onclick="window._filmRewatchStarClick(${i})">★</span>`;
    }
    return html;
  }

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

      const delBtn = document.createElement('button');
      delBtn.className = 'alert-ok danger';
      delBtn.style.cssText = 'background:var(--lcars-rust); color:var(--lcars-bg); margin-right:auto;';
      delBtn.textContent = t('libDelete');

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');

      const close = r => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(r);
      };
      const onKey = e => { if (e.key === 'Escape') close(false); };
      document.addEventListener('keydown', onKey);
      /* backdrop-close disabled */
      cancelBtn.addEventListener('click', () => close(false));
      delBtn.addEventListener('click', () => close(true));

      footer.appendChild(delBtn);
      footer.appendChild(cancelBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      openOverlay(overlay);
      requestAnimationFrame(() => overlay.style.opacity = '1');
    });

    if (!confirmed) return;
    try {
      await filmsPost({ action: 'delete_film', id: f.id });
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
