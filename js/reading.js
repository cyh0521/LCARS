// js/reading.js — Reading Log tracker (Library › READING sub-tab)
//
// Data model (Google Sheets columns):
//   id, title, title_zh, author, translator, year, language, isbn, edition, format,
//   genre, status, rating, start_date, finish_date, source, price, notes
//
// Statuses: READING · WANT_TO_READ · COMPLETED · PAUSED · DROPPED

  /* ============================================================
     CONFIG
     ============================================================ */
  const READING_API_URL = 'https://script.google.com/macros/s/AKfycbz95Pnc9LeWAMtVmPIQePNK45-7akEonTCry3jjtH3UUdNTf4rUtzCpkeelQED0orLA/exec';

  const BOOK_STATUSES    = ['READING', 'WANT_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];
  const BOOK_STATUS_KEY  = {
    'READING':       'reading',
    'WANT_TO_READ':  'want',
    'COMPLETED':     'completed',
    'PAUSED':        'paused',
    'DROPPED':       'dropped',
  };
  const BOOK_LANGUAGES   = ['CHINESE', 'ENGLISH', 'JAPANESE', 'KOREAN', 'FRENCH', 'GERMAN', 'SPANISH', 'OTHER'];
  const BOOK_FORMATS     = ['紙本', 'ePub', 'PDF'];
  const BOOK_GENRES      = ['FICTION', 'NON-FICTION', 'BIOGRAPHY', 'HISTORY', 'SCIENCE',
                             'PHILOSOPHY', 'TECHNOLOGY', 'SELF-HELP', 'MYSTERY', 'FANTASY',
                             'SCI-FI', 'POETRY', 'MANGA', 'OTHER'];

  /* ============================================================
     STATE
     ============================================================ */
  let booksCache   = [];
  let bookFilter   = 'all';
  let bookSearch   = '';
  let bookLoading  = false;

  /* ============================================================
     NORMALISATION
     ============================================================ */
  function normalizeBookRow(row) {
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
  async function readingGet(params = {}) {
    const url = new URL(READING_API_URL);
    Object.entries({ sheet: 'reading', ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    const data = (raw && typeof raw === 'object' && 'ok' in raw)
      ? (raw.ok ? raw.data : (() => { throw new Error(raw.error || 'API error'); })())
      : raw;
    return Array.isArray(data) ? data.map(normalizeBookRow) : data;
  }

  async function readingPost(body) {
    const res = await fetch(READING_API_URL, {
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
  async function fetchReading() {
    bookLoading = true;
    renderReadingGrid();
    try {
      const data = await readingGet();
      booksCache  = Array.isArray(data) ? data : [];
      bookLoading = false;
      renderReadingGrid();
      renderReadingFilters();
    } catch(e) {
      console.error('[READING] Fetch failed:', e);
      bookLoading = false;
      renderReadingError();
    }
  }

  /* ============================================================
     FILTER
     ============================================================ */
  function setBookFilter(f) {
    bookFilter = f;
    renderReadingFilters();
    renderReadingGrid();
  }

  function setBookSearch(q) {
    bookSearch = String(q || '').trim().toLowerCase();
    renderReadingGrid();
    const clr = document.getElementById('book-search-clear');
    if (clr) clr.style.visibility = bookSearch ? 'visible' : 'hidden';
  }

  function filteredBooks() {
    let list = booksCache.slice();
    if (bookFilter !== 'all') {
      const target = bookFilter.toUpperCase().replace('-', '_');
      list = list.filter(b => {
        const st = String(b.status || 'WANT_TO_READ').toUpperCase();
        // map 'want' key back to 'WANT_TO_READ' status
        const keyMap = { 'ALL': '', 'READING': 'READING', 'WANT': 'WANT_TO_READ',
                          'COMPLETED': 'COMPLETED', 'PAUSED': 'PAUSED', 'DROPPED': 'DROPPED' };
        return st === (keyMap[target] || target);
      });
    }
    if (bookSearch) {
      list = list.filter(b => {
        const orig = String(b.title || '').toLowerCase();
        const zh   = String(b.title_zh || '').toLowerCase();
        const auth = String(b.author || '').toLowerCase();
        return orig.includes(bookSearch) || zh.includes(bookSearch) || auth.includes(bookSearch);
      });
    }
    // Sort: currently reading first, then by finish/start date desc
    list.sort((a, b) => {
      const pri = s => s === 'READING' ? 0 : s === 'WANT_TO_READ' ? 1 : 2;
      const sa = String(a.status || '').toUpperCase();
      const sb = String(b.status || '').toUpperCase();
      if (pri(sa) !== pri(sb)) return pri(sa) - pri(sb);
      const da = a.finish_date || a.start_date;
      const db = b.finish_date || b.start_date;
      if (da && db) return new Date(db) - new Date(da);
      if (da) return -1;
      if (db) return 1;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    return list;
  }

  /* ============================================================
     FILTER BAR
     ============================================================ */
  function renderReadingFilters() {
    const bar = document.getElementById('book-filter-bar');
    if (!bar) return;

    const counts = { all: booksCache.length, reading: 0, want: 0, completed: 0, paused: 0, dropped: 0 };
    booksCache.forEach(b => {
      const k = BOOK_STATUS_KEY[String(b.status || 'WANT_TO_READ').toUpperCase()] || 'want';
      if (counts[k] !== undefined) counts[k]++;
    });

    const filters = [
      ['all',       t('bookFilterAll')],
      ['reading',   t('bookFilterReading')],
      ['want',      t('bookFilterWant')],
      ['completed', t('bookFilterCompleted')],
      ['paused',    t('bookFilterPaused')],
      ['dropped',   t('bookFilterDropped')],
    ];

    const btns = filters.map(([key, label]) => `
      <button class="lib-filter-btn${bookFilter === key ? ' active' : ''}"
              onclick="setBookFilter('${key}')">
        ${escapeHtml(label)}<span class="count">${counts[key]}</span>
      </button>`).join('');

    const search = `
      <div class="lib-search">
        <input id="book-search-input" type="text" class="lib-search-input"
               placeholder="${escapeAttr(t('bookSearchPH'))}"
               value="${escapeAttr(bookSearch)}"
               oninput="setBookSearch(this.value)">
        <button id="book-search-clear" class="lib-search-clear"
                style="visibility:${bookSearch ? 'visible' : 'hidden'}"
                onclick="document.getElementById('book-search-input').value=''; setBookSearch('');"
                aria-label="Clear">✕</button>
      </div>`;

    bar.innerHTML = btns + search;
  }

  /* ============================================================
     GRID RENDER
     ============================================================ */
  function renderReadingGrid() {
    const grid = document.getElementById('book-grid');
    if (!grid) return;

    if (bookLoading) {
      grid.innerHTML = `<div class="lib-state">${t('libLoading')}</div>`;
      return;
    }

    const list = filteredBooks();
    if (!list.length) {
      if (booksCache.length === 0) {
        grid.innerHTML = `
          <div class="lib-state empty">
            <div>${t('bookEmpty')}</div>
            <button class="lib-state-add-btn" onclick="showBookAddForm()">+ ${t('libAddBook')}</button>
          </div>`;
      } else {
        grid.innerHTML = `<div class="lib-state empty">${t('bookNoMatch')}</div>`;
      }
      return;
    }

    grid.innerHTML = '';

    // Group by finish_date year (or start_date if no finish). No-date last.
    const YEAR_PALETTE = [
      'var(--lcars-orange)',
      'var(--lcars-cream)',
      'var(--lcars-blue)',
      'var(--lcars-violet)',
      'var(--lcars-gold)',
      'var(--lcars-rust)'
    ];
    const yearMap = new Map();
    list.forEach(b => {
      const dateStr = b.finish_date || b.start_date || '';
      const yr = dateStr ? String(dateStr).slice(0, 4) : '__';
      if (!yearMap.has(yr)) yearMap.set(yr, []);
      yearMap.get(yr).push(b);
    });
    const sortedYears = [...yearMap.keys()].sort((a, b) => {
      if (a === '__') return 1;
      if (b === '__') return -1;
      return b - a;
    });
    sortedYears.forEach((yr, idx) => {
      const books = yearMap.get(yr);
      const groupEl = document.createElement('div');
      groupEl.className = 'lib-month-group';
      groupEl.style.setProperty('--month-color', YEAR_PALETTE[idx % YEAR_PALETTE.length]);

      const header = document.createElement('div');
      header.className = 'lib-month-header';
      header.innerHTML = `
        <span class="lib-month-tag"></span>
        <span class="lib-month-title">${escapeHtml(yr === '__' ? t('bookYearNone') : yr)}</span>
        <span class="lib-month-count">${books.length}</span>`;
      groupEl.appendChild(header);

      const inner = document.createElement('div');
      inner.className = 'lib-grid-inner';
      books.forEach(b => inner.appendChild(buildBookCard(b)));
      groupEl.appendChild(inner);
      grid.appendChild(groupEl);
    });
  }

  function renderReadingError() {
    const grid = document.getElementById('book-grid');
    if (grid) grid.innerHTML = `
      <div class="lib-state error">
        <div>${t('libError')}</div>
        <button class="lib-state-add-btn" onclick="fetchReading()">${t('libRetry')}</button>
      </div>`;
  }

  /* ============================================================
     BOOK CARD
     ============================================================ */
  function buildBookCard(b) {
    const status    = String(b.status || 'WANT_TO_READ').toUpperCase();
    const statusCls = BOOK_STATUS_KEY[status] || 'want';
    const rating    = parseFloat(b.rating) || 0;

    const card = document.createElement('div');
    card.className = `series-card card-side-poster status-book-${statusCls}`;
    card.dataset.bookId = b.id;

    // POSTER (book cover)
    const poster = document.createElement('div');
    poster.className = 'series-poster';
    const img = document.createElement('img');
    img.alt = '';
    img.src = `images/posters/books/${b.id}.jpg`;
    img.onerror = function() {
      poster.removeChild(img);
      const ph = document.createElement('div');
      ph.className = 'series-poster-placeholder';
      ph.textContent = '📖';
      poster.appendChild(ph);
    };
    poster.appendChild(img);

    // BODY
    const body = document.createElement('div');
    body.className = 'series-card-body';

    // Head
    const head = document.createElement('div');
    head.className = 'series-card-head';
    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'flex:1; min-width:0;';
    const titleEl = document.createElement('div');
    titleEl.className = 'series-title';
    titleEl.textContent = b.title || '(Untitled)';
    titleWrap.appendChild(titleEl);
    if (b.title_zh) {
      const tzh = document.createElement('div');
      tzh.className = 'series-title-zh';
      tzh.textContent = b.title_zh;
      titleWrap.appendChild(tzh);
    }
    const pill = document.createElement('div');
    pill.className = `series-status-pill ${statusCls}`;
    pill.textContent = bookStatusLabel(status);
    head.appendChild(titleWrap);
    head.appendChild(pill);

    // Meta: author · translator · year · lang · format · genre
    const meta = document.createElement('div');
    meta.className = 'series-meta';
    const metaParts = [];
    if (b.author)     metaParts.push(b.author);
    if (b.translator) metaParts.push(`${t('bookCardTranslator')} ${b.translator}`);
    if (b.year)       metaParts.push(b.year);
    if (b.language)   metaParts.push(langShort(b.language));
    if (b.format)     metaParts.push(b.format);
    if (b.genre)      metaParts.push(b.genre);
    meta.textContent = metaParts.join(' · ');

    // ISBN + edition + source + price
    const info = document.createElement('div');
    info.className = 'series-ep-line';
    const infoParts = [];
    if (b.edition) infoParts.push(`${t('bookCardEdition')} ${b.edition}`);
    if (b.isbn)    infoParts.push(`ISBN ${b.isbn}`);
    if (b.source)  infoParts.push(b.source);
    if (b.price)   infoParts.push(b.price);
    info.textContent = infoParts.join('  ·  ');

    // Date info line
    const dateInfo = document.createElement('div');
    dateInfo.className = 'series-ep-line';
    const dateParts = [];
    if (b.start_date)  dateParts.push(`${t('bookStarted')} ${fmtDate(b.start_date)}`);
    if (b.finish_date) dateParts.push(`${t('bookFinished')} ${fmtDate(b.finish_date)}`);
    dateInfo.textContent = dateParts.join('  ·  ') || (status === 'WANT_TO_READ' ? t('bookNotStarted') : '');

    // Star rating
    const stars = document.createElement('div');
    stars.className = 'film-rating-display';
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className = 'film-star' + (i <= rating ? ' lit' : '');
      s.textContent = '★';
      stars.appendChild(s);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'series-actions';

    if (status === 'WANT_TO_READ') {
      const startBtn = document.createElement('button');
      startBtn.className = 'series-btn primary';
      startBtn.textContent = t('bookBtnStartReading');
      startBtn.addEventListener('click', () => bookMarkReading(b));
      actions.appendChild(startBtn);
    } else if (status === 'READING') {
      const finishBtn = document.createElement('button');
      finishBtn.className = 'series-btn primary';
      finishBtn.style.background = 'var(--lcars-violet)';
      finishBtn.textContent = t('bookBtnMarkCompleted');
      finishBtn.addEventListener('click', () => showBookFinishModal(b));
      actions.appendChild(finishBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'series-btn';
    editBtn.textContent = t('filmBtnEdit');
    editBtn.addEventListener('click', () => showBookEditForm(b));

    const moreBtn = document.createElement('button');
    moreBtn.className = 'series-btn icon-btn';
    moreBtn.textContent = '⋯';
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      showBookMenu(b, moreBtn);
    });

    const spacer = document.createElement('div');
    spacer.style.flex = '1';

    actions.appendChild(editBtn);
    actions.appendChild(spacer);
    actions.appendChild(moreBtn);

    body.appendChild(head);
    body.appendChild(meta);
    body.appendChild(info);
    body.appendChild(dateInfo);
    body.appendChild(stars);
    body.appendChild(actions);

    card.appendChild(poster);
    card.appendChild(body);
    return card;
  }

  function bookStatusLabel(status) {
    const map = {
      'READING':      t('bookStatusReading'),
      'WANT_TO_READ': t('bookStatusWant'),
      'COMPLETED':    t('bookStatusCompleted'),
      'PAUSED':       t('bookStatusPaused'),
      'DROPPED':      t('bookStatusDropped'),
    };
    return map[status] || status;
  }

  /* ============================================================
     QUICK ACTIONS
     ============================================================ */
  async function bookMarkReading(b) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await readingPost({ action: 'update_book', id: b.id, status: 'READING', start_date: today });
      beep(720);
      await fetchReading();
    } catch(e) {
      console.error('[READING] Start failed:', e);
      beep(280);
    }
  }

  async function showBookFinishModal(b) {
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
      head.style.background = 'var(--lcars-violet)';
      head.innerHTML = `<span class="alert-head-title">${escapeHtml(t('bookFinishTitle'))}</span>`;

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.style.padding = '20px 24px';
      body.innerHTML = `
        <div style="margin-bottom:14px; font-size:14px; color:var(--lcars-cream);">${escapeHtml(b.title)}</div>
        <div class="lib-form-grid">
          <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:end;">
            <div class="lib-form-field">
              <label class="lib-form-label">${t('bookFinishDate')}</label>
              <input id="bfin-date" class="lib-form-input" type="date" value="${today}">
            </div>
            <div class="lib-form-field">
              <label class="lib-form-label">${t('filmFormRating')}</label>
              <div id="bfin-star-picker" class="lib-star-picker">${buildBookStarPickerHTML(0)}</div>
              <input id="bfin-rating" type="hidden" value="0">
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
      saveBtn.style.cssText = 'background:var(--lcars-violet); color:var(--lcars-bg);';
      saveBtn.textContent = t('bookBtnMarkCompleted');

      const close = r => { closeOverlay(overlay); resolve(r); };
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', async () => {
        const date   = document.getElementById('bfin-date').value;
        const rating = document.getElementById('bfin-rating').value;
        close(true);
        try {
          await readingPost({ action: 'update_book', id: b.id, status: 'COMPLETED', finish_date: date, rating });
          beep(720);
          await fetchReading();
        } catch(e) {
          console.error('[READING] Finish failed:', e);
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

      window._bookFinishStarClick = val => {
        const h = document.getElementById('bfin-rating');
        const cur = parseInt(h.value) || 0;
        const nv  = cur === val ? 0 : val;
        h.value = nv;
        document.querySelectorAll('#bfin-star-picker .lib-star').forEach((s, i) => s.classList.toggle('lit', i < nv));
      };
    });
  }

  function buildBookStarPickerHTML(initial) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="lib-star${i <= initial ? ' lit' : ''}" onclick="window._bookFinishStarClick(${i})">★</span>`;
    }
    return html;
  }

  /* ============================================================
     CONTEXT MENU
     ============================================================ */
  function showBookMenu(b, anchor) {
    const existing = document.getElementById('book-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'book-ctx-menu';
    menu.className = 'lib-ctx-menu';

    const items = [
      { label: t('filmMenuDelete'), fn: () => confirmBookDelete(b), danger: true },
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
  function buildBookFormBody(b) {
    const isEdit = !!b;
    const langOpts = BOOK_LANGUAGES.map(L =>
      `<option value="${L}" ${b && b.language === L ? 'selected' : ''}>${langLabel(L)}</option>`
    ).join('');
    const statusOpts = BOOK_STATUSES.map(st =>
      `<option value="${st}" ${b && String(b.status).toUpperCase() === st ? 'selected' : (!b && st === 'WANT_TO_READ' ? 'selected' : '')}>${bookStatusLabel(st)}</option>`
    ).join('');
    const genreOpts = ['', ...BOOK_GENRES].map(g =>
      `<option value="${g}" ${b && b.genre === g ? 'selected' : (!b && !g ? 'selected' : '')}>${g || '—'}</option>`
    ).join('');

    return `
      <div class="lib-form-grid">
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('bookFormTitle')}</label>
          <input id="bf-title" class="lib-form-input" placeholder="${t('bookFormTitlePH')}" value="${escapeAttr(b ? (b.title || '') : '')}">
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('filmFormTitleZh')}</label>
          <input id="bf-title-zh" class="lib-form-input" placeholder="${t('bookFormTitleZhPH')}" value="${escapeAttr(b ? (b.title_zh || '') : '')}">
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormAuthor')}</label>
            <input id="bf-author" class="lib-form-input" placeholder="${t('bookFormAuthorPH')}" value="${escapeAttr(b ? (b.author || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormTranslator')}</label>
            <input id="bf-translator" class="lib-form-input" placeholder="${t('bookFormTranslatorPH')}" value="${escapeAttr(b ? (b.translator || '') : '')}">
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:80px 1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormYear')}</label>
            <input id="bf-year" class="lib-form-input" type="number" min="0" max="2100" placeholder="?" value="${escapeAttr(b ? (b.year || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormLanguage')}</label>
            <select id="bf-language" class="lib-form-select">${langOpts}</select>
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormGenre')}</label>
            <select id="bf-genre" class="lib-form-select">${genreOpts}</select>
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr 80px; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">ISBN</label>
            <input id="bf-isbn" class="lib-form-input" placeholder="978-…" value="${escapeAttr(b ? (b.isbn || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormEdition')}</label>
            <input id="bf-edition" class="lib-form-input" placeholder="${t('bookFormEditionPH')}" value="${escapeAttr(b ? (b.edition || '') : '')}">
          </div>
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('bookFormFormat')}</label>
          <div class="lib-format-seg">
            ${BOOK_FORMATS.map(fmt => `
              <label class="lib-format-opt">
                <input type="radio" name="bf-format" value="${escapeAttr(fmt)}"
                       ${(b ? b.format : '') === fmt ? 'checked' : ''}>
                <span>${escapeHtml(fmt)}</span>
              </label>`).join('')}
            <label class="lib-format-opt">
              <input type="radio" name="bf-format" value=""
                     ${!b || !b.format ? 'checked' : ''}>
              <span>—</span>
            </label>
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:end;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormStatus')}</label>
            <select id="bf-status" class="lib-form-select">${statusOpts}</select>
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('filmFormRating')}</label>
            <div id="bf-star-picker" class="lib-star-picker">${buildBookFormStarPickerHTML(b ? parseFloat(b.rating)||0 : 0)}</div>
            <input id="bf-rating" type="hidden" value="${escapeAttr(b ? (b.rating || 0) : 0)}">
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormStartDate')}</label>
            <input id="bf-start" class="lib-form-input" type="date" value="${escapeAttr(b ? (b.start_date ? String(b.start_date).slice(0,10) : '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormFinishDate')}</label>
            <input id="bf-finish" class="lib-form-input" type="date" value="${escapeAttr(b ? (b.finish_date ? String(b.finish_date).slice(0,10) : '') : '')}">
          </div>
        </div>
        <div class="lib-form-field full" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormSource')}</label>
            <input id="bf-source" class="lib-form-input" placeholder="${t('bookFormSourcePH')}" value="${escapeAttr(b ? (b.source || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormPrice')}</label>
            <input id="bf-price" class="lib-form-input" placeholder="${t('bookFormPricePH')}" value="${escapeAttr(b ? (b.price || '') : '')}">
          </div>
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libFormNote')}</label>
          <textarea id="bf-note" class="lib-form-textarea" placeholder="${t('libFormNotePH')}">${escapeHtml(b ? (b.notes || '') : '')}</textarea>
        </div>
        ${isEdit ? `
        <div class="lib-form-field full lib-form-id-row">
          <label class="lib-form-label">BOOK ID</label>
          <div class="lib-form-id-box" id="book-copy-id-btn"
               onclick="(function(el){navigator.clipboard.writeText('${b.id}').then(()=>{el.classList.add('copied');setTimeout(()=>el.classList.remove('copied'),1200)})})(document.getElementById('book-copy-id-btn'))"
               title="點擊複製">
            <span class="lib-form-id-val">${b.id}</span>
            <span class="lib-form-id-copy">⎘</span>
          </div>
        </div>` : ''}
      </div>`;
  }

  function buildBookFormStarPickerHTML(initial) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="lib-star${i <= initial ? ' lit' : ''}" onclick="bookFormStarClick(${i})">★</span>`;
    }
    return html;
  }

  function bookFormStarClick(val) {
    const h = document.getElementById('bf-rating');
    const cur = parseInt(h.value) || 0;
    const nv = cur === val ? 0 : val;
    h.value = nv;
    document.querySelectorAll('#bf-star-picker .lib-star').forEach((s, i) => s.classList.toggle('lit', i < nv));
  }
  window.bookFormStarClick = bookFormStarClick;

  /* ============================================================
     MODAL — ADD / EDIT
     ============================================================ */
  function showBookFormModal(b, title) {
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
      head.style.background = 'var(--lcars-violet)';
      head.innerHTML = `<span class="alert-head-title"><svg class="icon icon-md alert-head-icon"><use href="#i-library"/></svg><span>${escapeHtml(title)}</span></span>`;

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.style.cssText = 'padding:20px 24px; max-height:none; overflow:visible;';
      body.innerHTML = buildBookFormBody(b);

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'alert-ok';
      saveBtn.style.cssText = 'background:var(--lcars-violet); color:var(--lcars-bg);';
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
        const formatEl = document.querySelector('input[name="bf-format"]:checked');
        const result = {
          title:        document.getElementById('bf-title').value.trim(),
          title_zh:     document.getElementById('bf-title-zh').value.trim(),
          author:       document.getElementById('bf-author').value.trim(),
          translator:   document.getElementById('bf-translator').value.trim(),
          year:         document.getElementById('bf-year').value.trim(),
          language:     document.getElementById('bf-language').value,
          isbn:         document.getElementById('bf-isbn').value.trim(),
          edition:      document.getElementById('bf-edition').value.trim(),
          format:       formatEl ? formatEl.value : '',
          genre:        document.getElementById('bf-genre').value,
          status:       document.getElementById('bf-status').value,
          rating:       document.getElementById('bf-rating').value,
          start_date:   document.getElementById('bf-start').value,
          finish_date:  document.getElementById('bf-finish').value,
          source:       document.getElementById('bf-source').value.trim(),
          price:        document.getElementById('bf-price').value.trim(),
          notes:        document.getElementById('bf-note').value.trim(),
        };
        if (!result.title) { beep(280); return; }
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
    });
  }

  async function showBookAddForm() {
    const result = await showBookFormModal(null, t('bookAddTitle'));
    if (!result) return;
    try {
      await readingPost({ action: 'add_book', ...result });
      beep(720);
      await fetchReading();
    } catch(e) {
      console.error('[READING] Add failed:', e);
      beep(280);
    }
  }
  window.showBookAddForm = showBookAddForm;

  async function showBookEditForm(b) {
    const result = await showBookFormModal(b, t('bookEditTitle'));
    if (!result) return;
    try {
      await readingPost({ action: 'update_book', id: b.id, ...result });
      beep(720);
      await fetchReading();
    } catch(e) {
      console.error('[READING] Edit failed:', e);
      beep(280);
    }
  }

  /* ============================================================
     DELETE
     ============================================================ */
  async function confirmBookDelete(b) {
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
      head.innerHTML = `<span class="alert-head-title">${escapeHtml(t('bookDeleteTitle'))}</span>`;

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.innerHTML = `<p>${escapeHtml(t('bookDeleteBody').replace('{name}', b.title || b.id))}</p>`;

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
      await readingPost({ action: 'delete_book', id: b.id });
      beep(720);
      await fetchReading();
    } catch(e) {
      console.error('[READING] Delete failed:', e);
      beep(280);
    }
  }

  /* ============================================================
     INIT
     ============================================================ */
  function initReading() {
    window.setBookFilter    = setBookFilter;
    window.setBookSearch    = setBookSearch;
    window.showBookAddForm  = showBookAddForm;
    window.fetchReading     = fetchReading;
  }
