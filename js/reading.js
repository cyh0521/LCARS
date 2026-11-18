// js/reading.js — Reading Log tracker (Library › READING sub-tab)
//
// Data model (Google Sheets columns):
//   id, title, title_zh, author, translator, year, language, isbn, edition, format,
//   genre, status, rating, start_date, finish_date, source, price, notes, purchase_date
//
// Statuses: READING · WANT_TO_READ · COMPLETED · PAUSED · DROPPED

  /* ============================================================
     CONFIG
     ============================================================ */
  const READING_API_URL = 'https://script.google.com/macros/s/AKfycbz95Pnc9LeWAMtVmPIQePNK45-7akEonTCry3jjtH3UUdNTf4rUtzCpkeelQED0orLA/exec';

  const BOOK_STATUSES    = ['READING', 'COMPLETED', 'WANT_TO_READ', 'PAUSED', 'DROPPED'];
  const BOOK_STATUS_KEY  = {
    'READING':       'reading',
    'WANT_TO_READ':  'want',
    'COMPLETED':     'completed',
    'PAUSED':        'paused',
    'DROPPED':       'dropped',
  };
  const BOOK_LANGUAGES = {
    CHINESE_TRADITIONAL: 'bookLangTraditional',
    CHINESE_SIMPLIFIED: 'bookLangSimplified',
    ENGLISH: 'bookLangEnglish',
    JAPANESE: 'bookLangJapanese',
    GERMAN: 'bookLangGerman',
    OTHER: 'libLangOther',
  };

  function bookLanguageOption(code) {
    if (code === 'CHINESE') return 'CHINESE_TRADITIONAL';
    if (code === 'WESTERN') return 'ENGLISH';
    return Object.hasOwn(BOOK_LANGUAGES, code) ? code : 'OTHER';
  }

  function bookLanguageLabel(code) {
    return code ? t(BOOK_LANGUAGES[bookLanguageOption(code)]) : '';
  }
  const BOOK_FORMATS     = ['Paperback', 'Hardcover', 'ePub', 'PDF'];
  function bookFormatLabel(format) {
    if (currentLang !== 'zh') return format;
    if (format === 'Paperback') return '實體平裝';
    if (format === 'Hardcover') return '實體精裝';
    return format;
  }
  const BOOK_GENRES      = ['FICTION', 'NON-FICTION', 'BIOGRAPHY', 'HISTORY', 'SCIENCE',
                             'PHILOSOPHY', 'TECHNOLOGY', 'SELF-HELP', 'MYSTERY', 'FANTASY',
                             'SCI-FI', 'POETRY', 'MANGA', 'OTHER'];
  const BOOK_GENRE_ZH   = {
    'FICTION':      '小說',
    'NON-FICTION':  '非虛構',
    'BIOGRAPHY':   '傳記',
    'HISTORY':     '歷史',
    'SCIENCE':     '科學',
    'PHILOSOPHY':  '哲學',
    'TECHNOLOGY':  '科技',
    'SELF-HELP':   '自我成長',
    'MYSTERY':     '推理',
    'FANTASY':     '奇幻',
    'SCI-FI':      '科幻',
    'POETRY':      '詩集',
    'MANGA':       '漫畫',
    'OTHER':       '其他',
  };
  function genreLabel(g) {
    const isZh = (typeof currentLang !== 'undefined') && currentLang === 'zh';
    return isZh ? (BOOK_GENRE_ZH[g] || g) : g;
  }

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

  function bookDateInputValue(value) {
    const match = String(value || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=$|[T\s])/);
    if (!match) return '';
    const [, year, month, day] = match;
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
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

    bar.innerHTML = btns;
    document.querySelector('[data-search-subtab="reading"]').innerHTML = searchToggleMarkup() + search;
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
        <span class="lib-month-count">共 ${books.length} 本</span>`;
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

    const card = document.createElement('div');
    card.className = `series-card card-side-poster status-book-${statusCls}`;
    card.dataset.bookId = b.id;
    bindMediaDetails(card, () => showBookDetails(b));

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
    titleEl.className = b.title_zh ? 'series-title book-title-zh' : 'series-title';
    titleEl.textContent = b.title_zh || b.title || '(Untitled)';
    titleWrap.appendChild(titleEl);
    if (b.title_zh && b.title) {
      const originalTitle = document.createElement('div');
      originalTitle.className = 'series-title-zh';
      originalTitle.textContent = b.title;
      titleWrap.appendChild(originalTitle);
    }
    const pill = document.createElement('div');
    pill.className = `series-status-pill ${statusCls}`;
    pill.textContent = bookStatusFormLabel(status);
    head.appendChild(titleWrap);
    head.appendChild(pill);

    // Meta: author · translator · year · lang · format · genre
    const meta = document.createElement('div');
    meta.className = 'series-meta';
    const metaParts = [];
    if (b.author)     metaParts.push(b.author);
    if (b.translator) metaParts.push(`${t('bookCardTranslator')} ${b.translator}`);
    if (b.year)       metaParts.push(b.year);
    if (b.language)   metaParts.push(bookLanguageLabel(b.language));
    if (b.format)     metaParts.push(bookFormatLabel(b.format));
    if (b.genre)      metaParts.push(genreLabel(b.genre));
    meta.textContent = metaParts.join(' · ');

    const moreBtn = document.createElement('button');
    moreBtn.className = 'series-btn icon-btn';
    moreBtn.setAttribute('aria-label', t('notesMoreTip'));
    moreBtn.innerHTML = '<svg class="more-dots-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      showBookMenu(b, moreBtn);
    });


    moreBtn.classList.add('media-more-corner');
    card.appendChild(moreBtn);

    body.appendChild(head);
    if (metaParts.length) body.appendChild(meta);

    const finishDate = bookDateInputValue(b.finish_date);
    if (finishDate) {
      const completion = document.createElement('div');
      completion.className = 'series-ep-line';
      completion.textContent = `${t('bookCardReadOn')} ${finishDate.replaceAll('-', '/')}`;
      body.appendChild(completion);
    }

    if (status === 'WANT_TO_READ') {
      const actions = document.createElement('div');
      actions.className = 'series-actions';
      const button = document.createElement('button');
      button.className = 'series-btn primary';
      button.textContent = t('bookBtnStartReading');
      button.addEventListener('click', () => bookMarkReading(b));
      actions.appendChild(button);
      body.appendChild(actions);
    }

    card.appendChild(poster);
    card.appendChild(body);
    return card;
  }

  function bookStatusFormLabel(status) {
    if (currentLang !== 'zh') return bookStatusLabel(status);
    return ({'READING': '閱讀中', 'COMPLETED': '已閱讀', 'WANT_TO_READ': '待閱讀', 'PAUSED': '暫停', 'DROPPED': '棄讀'})[status] || status;
  }

  function showBookDetails(b) {
    const fields = [
      [t('bookFormTitle'), b.title],
      [t('bookFormTitleZh'), b.title_zh],
      [t('bookFormAuthor'), b.author],
      [t('bookFormTranslator'), b.translator],
      [t('libFormYear'), b.year],
      [t('bookFormEdition'), b.edition],
      [t('libFormLanguage'), bookLanguageLabel(b.language)],
      [t('filmFormGenre'), b.genre && genreLabel(b.genre)],
      ['ISBN', b.isbn],
      [t('bookFormPublisher'), b.publisher],
      [t('bookFormFormat'), bookFormatLabel(b.format)],
      [t('bookFormStartDate'), bookDateInputValue(b.start_date).replaceAll('-', '/')],
      [t('bookFormFinishDate'), bookDateInputValue(b.finish_date).replaceAll('-', '/')],
      [t('bookFormPurchaseDate'), bookDateInputValue(b.purchase_date).replaceAll('-', '/')],
      [t('bookFormSource'), b.source],
      [t('bookFormPrice'), b.price],
      [t('libFormStatus'), bookStatusFormLabel(String(b.status || 'WANT_TO_READ').toUpperCase())],
      [t('libFormNote'), b.notes],
    ];
    showMediaDetails(t('bookDetailsTitle'), 'books', 'BOOK ID', b.id, fields);
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
  function bookMarkReading(b) {
    const now = new Date();
    const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map(part => String(part).padStart(2, '0')).join('-');
    const dialog = document.createElement('dialog');
    dialog.className = 'alert-card media-form-card book-start-dialog';
    dialog.setAttribute('aria-labelledby', 'book-start-title');
    dialog.innerHTML = `
      <div class="alert-head"><span class="alert-head-title" id="book-start-title">${t('bookBtnStartReading')}</span></div>
      <form>
        <div class="alert-body lib-form-field">
          <label class="lib-form-label" for="book-start-date">${t('bookFormStartDate')}</label>
          <input class="lib-form-input" id="book-start-date" type="date" value="${today}" required autofocus>
          <span role="alert"></span>
        </div>
        <div class="alert-footer confirm">
          <button class="alert-ok" type="button">${t('libCancel')}</button>
          <button class="alert-ok" type="submit">${t('libSave')}</button>
        </div>
      </form>`;

    const form = dialog.querySelector('form');
    const date = dialog.querySelector('input');
    const cancel = dialog.querySelector('[type="button"]');
    const save = dialog.querySelector('[type="submit"]');
    const error = dialog.querySelector('[role="alert"]');
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', e => {
      if (save.disabled) e.preventDefault();
    });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (save.disabled) return;
      date.disabled = cancel.disabled = save.disabled = true;
      error.textContent = '';
      try {
        await readingPost({ action: 'update_book', id: b.id, status: 'READING', start_date: date.value });
      } catch (err) {
        console.error('[READING] Start failed:', err);
        error.textContent = t('libError');
        date.disabled = cancel.disabled = save.disabled = false;
        beep(280);
        return;
      }
      dialog.close();
      beep(720);
      await fetchReading();
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  /* ============================================================
     CONTEXT MENU
     ============================================================ */
  function showBookMenu(b, anchor) {
    const existing = document.getElementById('book-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'book-ctx-menu';
    menu.className = 'note-menu lib-series-menu';
    menu.style.width = '180px';
    menu.addEventListener('mousedown', e => e.stopPropagation());

    const items = [
      { label: t('filmMenuEdit'), fn: () => showBookEditForm(b) },
      { label: t('filmMenuDelete'), fn: () => confirmBookDelete(b), danger: true },
    ];
    items.forEach(({ label, fn, danger }) => {
      const btn = document.createElement('button');
      btn.className = 'note-menu-delete' + (danger ? ' danger' : '');
      btn.style.cssText = 'background:var(--lcars-frame);color:' + (danger ? 'var(--lcars-rust)' : 'var(--lcars-cream)') + ';margin:0';
      btn.textContent = label;
      btn.addEventListener('click', () => { menu.remove(); fn(); });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    positionPopoverBelow(menu, anchor);

    const dismiss = e => { if (!menu.contains(e.target) && e.target !== anchor) { menu.remove(); document.removeEventListener('mousedown', dismiss); } };
    setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
    beep(560);
  }

  /* ============================================================
     FORM HELPERS
     ============================================================ */
  function buildBookFormBody(b) {
    const selectedLanguage = b?.language ? bookLanguageOption(b.language) : 'CHINESE_TRADITIONAL';
    const langOpts = Object.entries(BOOK_LANGUAGES).map(([code, label]) =>
      `<option value="${code}" ${selectedLanguage === code ? 'selected' : ''}>${t(label)}</option>`
    ).join('');
    const statusOpts = BOOK_STATUSES.map(st =>
      `<option value="${st}" ${String(b?.status || 'WANT_TO_READ').toUpperCase() === st ? 'selected' : ''}>${bookStatusFormLabel(st)}</option>`
    ).join('');
    const genreOpts = ['', ...BOOK_GENRES].map(g =>
      `<option value="${g}" ${b && b.genre === g ? 'selected' : (!b && !g ? 'selected' : '')}>${g ? genreLabel(g) : '—'}</option>`
    ).join('');

    return `
      <div class="lib-form-grid">
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('bookFormTitle')}</label>
          <input id="bf-title" class="lib-form-input" placeholder="${t('bookFormTitlePH')}" value="${escapeAttr(b ? (b.title || '') : '')}">
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('bookFormTitleZh')}</label>
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
        <div class="lib-form-field full book-form-row book-form-publication">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormYear')}</label>
            <input id="bf-year" class="lib-form-input" type="number" min="0" max="2100" placeholder="?" value="${escapeAttr(b ? (b.year || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormEdition')}</label>
            <input id="bf-edition" class="lib-form-input" placeholder="${t('bookFormEditionPH')}" value="${escapeAttr(b ? (b.edition || '') : '')}">
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
        <div class="lib-form-field full book-form-row book-form-identifiers">
          <div class="lib-form-field">
            <label class="lib-form-label">ISBN</label>
            <input id="bf-isbn" class="lib-form-input" placeholder="978-…" value="${escapeAttr(b ? (b.isbn || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormPublisher')}</label>
            <input id="bf-publisher" class="lib-form-input" placeholder="${t('bookFormPublisherPH')}" value="${escapeAttr(b ? (b.publisher || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormFormat')}</label>
            <select id="bf-format" class="lib-form-select">
              ${BOOK_FORMATS.map(fmt => `<option value="${escapeAttr(fmt)}" ${(b && b.format === fmt) || (!b && fmt === BOOK_FORMATS[0]) ? 'selected' : ''}>${escapeHtml(bookFormatLabel(fmt))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="lib-form-field full book-form-row book-form-dates">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormStartDate')}</label>
            <input id="bf-start" class="lib-form-input" type="date" value="${bookDateInputValue(b?.start_date)}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormFinishDate')}</label>
            <input id="bf-finish" class="lib-form-input" type="date" value="${bookDateInputValue(b?.finish_date)}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label" for="bf-purchase-date">${t('bookFormPurchaseDate')}</label>
            <input id="bf-purchase-date" class="lib-form-input" type="date" value="${bookDateInputValue(b?.purchase_date)}">
          </div>
        </div>
        <div class="lib-form-field full book-form-row book-form-acquisition">
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormSource')}</label>
            <input id="bf-source" class="lib-form-input" placeholder="${t('bookFormSourcePH')}" value="${escapeAttr(b ? (b.source || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('bookFormPrice')}</label>
            <input id="bf-price" class="lib-form-input" placeholder="${t('bookFormPricePH')}" value="${escapeAttr(b ? (b.price || '') : '')}">
          </div>
          <div class="lib-form-field">
            <label class="lib-form-label">${t('libFormStatus')}</label>
            <select id="bf-status" class="lib-form-select">${statusOpts}</select>
          </div>
        </div>
        <div class="lib-form-field full">
          <label class="lib-form-label">${t('libFormNote')}</label>
          <textarea id="bf-note" class="lib-form-textarea" placeholder="${t('libFormNotePH')}">${escapeHtml(b ? (b.notes || '') : '')}</textarea>
        </div>
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
    const isEdit = !!b;
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.style.zIndex = 10000;
      const stack = document.createElement('div');
      stack.className = 'alert-stack media-form-stack';
      stack.style.maxWidth = '640px';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card media-form-card';
      card.style.cssText = 'max-width:640px; width:100%;';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.innerHTML = `<span class="alert-head-title"><span>${escapeHtml(title)}</span></span>`;

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.style.padding = '20px 24px';
      body.innerHTML = buildBookFormBody(b);

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';

      footer.appendChild(document.createElement('span'));

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'alert-ok';
      saveBtn.style.cssText = 'background:var(--lcars-orange); color:var(--lcars-bg);';
      saveBtn.textContent = t('libSave');

      const close = result => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        resolve(result);
      };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      /* backdrop-close disabled */
      cancelBtn.addEventListener('click', () => close(null));
      saveBtn.addEventListener('click', () => {
        const formatEl = document.getElementById('bf-format');
        const selectedLanguage = document.getElementById('bf-language').value;
        const language = b?.language && bookLanguageOption(b.language) === selectedLanguage
          ? b.language
          : selectedLanguage;
        const result = {
          title:        document.getElementById('bf-title').value.trim(),
          title_zh:     document.getElementById('bf-title-zh').value.trim(),
          author:       document.getElementById('bf-author').value.trim(),
          translator:   document.getElementById('bf-translator').value.trim(),
          year:         document.getElementById('bf-year').value.trim(),
          language:     language,
          isbn:         document.getElementById('bf-isbn').value.trim(),
          edition:      document.getElementById('bf-edition').value.trim(),
          publisher:    document.getElementById('bf-publisher').value.trim(),
          format:       formatEl ? formatEl.value : '',
          genre:        document.getElementById('bf-genre').value,
          status:       document.getElementById('bf-status').value,
          start_date:   document.getElementById('bf-start').value,
          finish_date:  document.getElementById('bf-finish').value,
          purchase_date: document.getElementById('bf-purchase-date').value,
          source:       document.getElementById('bf-source').value.trim(),
          price:        document.getElementById('bf-price').value.trim(),
          notes:        document.getElementById('bf-note').value.trim(),
        };
        if (!result.title) { beep(280); return; }
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
