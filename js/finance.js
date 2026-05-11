// js/finance.js — Stocks, FX (Google Sheets JSONP) + Finance sub-tabs

  /* ============================================================
     STOCKS, FUNDS & FX — read from a public Google Sheet.
     Sheet structure (gid=1900082413):
       股票  A=code  B=currency  C=price  D=changePct  E=date   (F=空)
       基金  G=code  H=currency  I=price  J=changePct  K=date   (L=空)
       匯率  M=currency  N=rate
     We use Google Visualization API in JSON mode (?tqx=out:json),
     which is CORS-friendly for any "anyone with link" sheet.
     ============================================================ */

  // Sheet ID extracted from the user's share URL
  const SHEET_ID = '1YhFHwSYyQrrfToGw_EGzyQy3v7LlTWKtuSwMk-qSQww';

  // Sheet GID — which tab inside the spreadsheet to read.
  // 0 = first tab. To find a different tab's GID, open the sheet and
  // look at the URL: ".../edit#gid=XXXXXXXXXX" → put XXXXXXXXXX here.
  const SHEET_GID = '1900082413';

  // We use the Google Visualization JSONP endpoint to dodge the CORS
  // restriction that blocks fetch() from file:// pages. JSONP loads via
  // a <script> tag, which has no same-origin restriction.

  // Original ticker order — must match the sheet rows we expect to see.
  // (We render stocks in the order the sheet provides them, so this list
  // is now mostly informational; the actual data comes from the sheet.)
  const STOCKS_TW = ['0050', '2330', '2891'];
  const STOCKS_US = ['VT', 'VTI', 'VOO', 'BRK.B'];

  const STOCKS_CACHE_KEY = 'lcars_stocks_cache_v2';
  // Stores buildTiles(pw) functions keyed by tab id, called after DOM paint
  const _treemapBuilders = {};
  const FUND_CACHE_KEY   = 'lcars_fund_cache_v1';
  const FX_CACHE_KEY     = 'lcars_fx_cache';

  /* Render stocks immediately from cache (if any) */
  function renderStocksFromCache() {
    const cached = cacheGet(STOCKS_CACHE_KEY);
    if (cached) {
      renderStockGrid('stocks-tw', cached.tw || [], cached.timestamp);
      renderStockGrid('stocks-us', cached.us || [], cached.timestamp);
      updateStocksTimestamp(cached.timestamp);
    }
    const fundCached = cacheGet(FUND_CACHE_KEY);
    if (fundCached) {
      renderFundGrid(fundCached.funds || [], fundCached.timestamp);
    }
    const fxCached = cacheGet(FX_CACHE_KEY);
    if (fxCached) {
      renderFxGrid(fxCached.rates || []);
    }
    return !!cached;
  }

  function updateStocksTimestamp(ts) {
    const el = document.getElementById('stocks-updated');
    if (!el) return;
    if (!ts) { el.textContent = ''; return; }
    const date = new Date(ts);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.textContent = ' · ' + t('updatedAt') + ' ' + time;
  }

  /* JSONP loader: dynamically inject a <script> tag, Google calls our
     callback with the response payload. Returns a Promise. */
  function fetchSheetViaJsonp() {
    return new Promise((resolve, reject) => {
      // Pick a unique callback name so concurrent calls don't collide
      const callbackName = 'lcarsGvizCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      // Add a cache-buster because Google/gviz can otherwise keep serving
      // the previous cell display format after the Sheet's number format changes
      // (notably date-only vs date+time on quote timestamps).
      const cacheBust = Date.now();
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
                  `?gid=${SHEET_GID}&tqx=responseHandler:${callbackName}&_=${cacheBust}`;

      const script = document.createElement('script');
      let settled = false;

      const cleanup = () => {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      window[callbackName] = (data) => {
        settled = true;
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        if (settled) return;
        cleanup();
        reject(new Error('JSONP script load failed'));
      };

      // Safety timeout
      setTimeout(() => {
        if (settled) return;
        cleanup();
        reject(new Error('JSONP timeout (10s)'));
      }, 10000);

      script.src = url;
      document.head.appendChild(script);
    });
  }

  /* Convert a gviz cell to either string or number (preserves null) */
  function cellValue(cell) {
    if (!cell) return null;
    return cell.v != null ? cell.v : null;
  }
  function cellFormatted(cell) {
    if (!cell) return '';
    return cell.f != null ? cell.f : (cell.v != null ? String(cell.v) : '');
  }

  function cellDebugLabel(cell) {
    if (!cell) return '';
    const raw = cell.v instanceof Date
      ? cell.v.toISOString()
      : (cell.v == null ? '' : String(cell.v));
    const fmt = cell.f == null ? '' : String(cell.f);
    return fmt && fmt !== raw ? `${fmt} | raw=${raw}` : raw;
  }

  async function fetchStocks() {
    console.log('[LCARS] Fetching sheet via JSONP, gid:', SHEET_GID);
    try {
      const data = await fetchSheetViaJsonp();
      console.log('[LCARS] JSONP success. Status:', data?.status);
      window.__sheetData = data;  // for debugging in console
      const rows = data?.table?.rows || [];
      console.log('[LCARS] Sheet rows count:', rows.length);

      // New layout:
      //   股票: A=code  B=currency  C=price  D=changePct  E=date   (F=空, idx=5)
      //   基金: G=code  H=currency  I=price  J=changePct  K=date   (L=空, idx=11)
      //   匯率: M=currency  N=rate
      const stocks = [];
      const funds  = [];
      const fx     = [];

      for (const row of rows) {
        const cells = row.c || [];

        // ---- STOCKS BLOCK (cols A-E, idx 0-4) ----
        const stkCode = cellValue(cells[0]);
        const stkCcy  = cellValue(cells[1]);
        const stkPx   = cellValue(cells[2]);
        const stkPct  = cellValue(cells[3]);
        const stkDate = cells[4];

        if (stkCode != null) {
          const codeStr = String(stkCode).trim();
          if (codeStr !== '股票' && codeStr !== '') {
            const price = (typeof stkPx === 'number') ? stkPx : parseFloat(stkPx);
            if (!isNaN(price)) {
              let pct = null;
              if (typeof stkPct === 'number') pct = stkPct;
              else if (stkPct != null && stkPct !== '') {
                const p = parseFloat(String(stkPct).replace('%', ''));
                if (!isNaN(p)) pct = p;
              }
              stocks.push({
                code:     codeStr,
                currency: stkCcy ? String(stkCcy).trim().toUpperCase() : 'USD',
                price,
                pct,
                dateStr:   cellFormatted(stkDate),
                dateRaw:   cellValue(stkDate),
                dateDebug: cellDebugLabel(stkDate),
              });
            }
          }
        }

        // ---- FUNDS BLOCK (cols G-K, idx 6-10) ----
        const fundCode = cellValue(cells[6]);
        const fundCcy  = cellValue(cells[7]);
        const fundPx   = cellValue(cells[8]);
        const fundPct  = cellValue(cells[9]);
        const fundDate = cells[10];

        if (fundCode != null) {
          const codeStr = String(fundCode).trim();
          if (codeStr !== '基金' && codeStr !== '') {
            const price = (typeof fundPx === 'number') ? fundPx : parseFloat(fundPx);
            if (!isNaN(price)) {
              let pct = null;
              if (typeof fundPct === 'number') pct = fundPct;
              else if (fundPct != null && fundPct !== '') {
                const p = parseFloat(String(fundPct).replace('%', ''));
                if (!isNaN(p)) pct = p;
              }
              funds.push({
                code:     codeStr,
                currency: fundCcy ? String(fundCcy).trim().toUpperCase() : 'TWD',
                price,
                pct,
                dateStr:   cellFormatted(fundDate),
                dateRaw:   cellValue(fundDate),
                dateDebug: cellDebugLabel(fundDate),
              });
            }
          }
        }

        // ---- FX BLOCK (cols M-N, idx 12-13) ----
        const fxCcy  = cellValue(cells[12]);
        const fxRate = cellValue(cells[13]);

        if (fxCcy != null) {
          const ccyStr = String(fxCcy).trim();
          if (ccyStr !== '匯率' && ccyStr !== '') {
            const rate = (typeof fxRate === 'number') ? fxRate : parseFloat(fxRate);
            if (!isNaN(rate)) fx.push({ name: ccyStr, rate });
          }
        }
      }

      // Split stocks by currency from sheet (no longer inferred from code)
      const tw = stocks.filter(s => s.currency === 'TWD');
      const us = stocks.filter(s => s.currency !== 'TWD');
      console.log(`[LCARS] Sheet parsed: ${tw.length} TW + ${us.length} US stocks, ${funds.length} funds, ${fx.length} FX rates`);

      const timestamp = Date.now();
      cacheSet(STOCKS_CACHE_KEY, { tw, us, timestamp });
      cacheSet(FUND_CACHE_KEY,   { funds, timestamp });
      cacheSet(FX_CACHE_KEY,     { rates: fx, timestamp });

      renderStockGrid('stocks-tw', tw, timestamp);
      renderStockGrid('stocks-us', us, timestamp);
      renderFundGrid(funds, timestamp);
      renderFxGrid(fx);
      updateStocksTimestamp(timestamp);
    } catch (err) {
      console.warn('[LCARS] Sheet fetch failed:', err);
      const hasCache = !!cacheGet(STOCKS_CACHE_KEY);
      if (!hasCache) {
        document.querySelectorAll('#stocks-tw .ticker-row, #stocks-us .ticker-row, #stocks-fund .ticker-row')
          .forEach(row => {
            row.classList.add('error');
            row.classList.remove('loading');
            const name = row.querySelector('.ticker-name');
            if (name) {
              name.removeAttribute('data-i18n');
              name.textContent = t('finError');
            }
          });
      }
    }
  }

  /* Build the external quote URL for a ticker card.
     Numeric Taiwan tickers are stored in the sheet without the .TW suffix,
     while BRK.B needs Yahoo's BRK-B URL form. */
  function stockDetailUrl(code) {
    const raw = String(code || '').trim();
    if (!raw) return '#';
    const yahooCode = /^\d{4,5}$/.test(raw)
      ? `${raw}.TW`
      : raw.replace('.', '-');
    return `https://finance.yahoo.com/quote/${encodeURIComponent(yahooCode)}`;
  }

  /* Finance card footer label. During active market hours, show the quote
     time so the card feels live; once the relevant market is closed, fall
     back to the quote date. Holidays are not hard-coded here, so this uses
     regular weekday exchange hours as a conservative client-side signal. */
  function tickerMarketConfig(code) {
    return /^\d{4,5}$/.test(String(code || '').trim())
      ? { tz: 'Asia/Taipei', open: 9 * 60, close: 13 * 60 + 30 }
      : { tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 };
  }

  function zonedDateParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', hour: '2-digit', minute: '2-digit',
      hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    let hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      weekday: parts.weekday,
      hour,
      minute: Number(parts.minute)
    };
  }

  function isTickerMarketOpenNow(code) {
    const cfg = tickerMarketConfig(code);
    const now = zonedDateParts(new Date(), cfg.tz);
    if (now.weekday === 'Sat' || now.weekday === 'Sun') return false;
    const mins = now.hour * 60 + now.minute;
    return mins >= cfg.open && mins < cfg.close;
  }

  function parseSheetDate(raw, formatted) {
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

    const rawStr = raw == null ? '' : String(raw).trim();
    const dateMatch = rawStr.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}))?)?\)$/);
    if (dateMatch) {
      // Google Visualization Date(...) months are zero-based.
      return new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]),
        Number(dateMatch[3]),
        Number(dateMatch[4] || 0),
        Number(dateMatch[5] || 0),
        Number(dateMatch[6] || 0)
      );
    }

    const str = String(formatted || rawStr || '').trim();
    const ymd = str.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (!ymd) return null;

    const timeParts = extractQuoteTimeParts(str);
    return new Date(
      Number(ymd[1]),
      Number(ymd[2]) - 1,
      Number(ymd[3]),
      timeParts ? timeParts.hour : 0,
      timeParts ? timeParts.minute : 0,
      timeParts ? timeParts.second : 0
    );
  }

  function extractQuoteTimeParts(value) {
    const str = String(value || '').trim();
    // Accept zh-TW Google Sheets formats such as "2026/5/6 上午 10:36:16",
    // plus AM/PM or 24-hour variants. The seconds are intentionally ignored
    // in the footer label to keep the card compact.
    const hm = str.match(/(上午|下午|AM|PM|am|pm)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!hm) return null;
    let hour = Number(hm[2]);
    const minute = Number(hm[3]);
    const second = Number(hm[4] || 0);
    const meridiem = hm[1] || '';
    if (/下午|PM|pm/.test(meridiem) && hour < 12) hour += 12;
    if (/上午|AM|am/.test(meridiem) && hour === 12) hour = 0;
    return { hour, minute, second };
  }

  function hasQuoteTime(raw, formatted) {
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return raw.getHours() !== 0 || raw.getMinutes() !== 0 || raw.getSeconds() !== 0;
    }
    const rawStr = raw == null ? '' : String(raw);
    if (/^Date\(\d{4},\s*\d{1,2},\s*\d{1,2},\s*\d{1,2},\s*\d{1,2}/.test(rawStr)) return true;
    return !!extractQuoteTimeParts(formatted) || !!extractQuoteTimeParts(rawStr);
  }

  function sameMarketDate(date, code) {
    if (!date) return true;
    const cfg = tickerMarketConfig(code);
    const quote = zonedDateParts(date, cfg.tz);
    const today = zonedDateParts(new Date(), cfg.tz);
    return quote.year === today.year && quote.month === today.month && quote.day === today.day;
  }

  function formatQuoteTime(raw, formatted, code) {
    const formattedParts = extractQuoteTimeParts(formatted);
    if (formattedParts) {
      return `${String(formattedParts.hour).padStart(2, '0')}:${String(formattedParts.minute).padStart(2, '0')}`;
    }

    const rawParts = extractQuoteTimeParts(raw);
    if (rawParts) {
      return `${String(rawParts.hour).padStart(2, '0')}:${String(rawParts.minute).padStart(2, '0')}`;
    }

    const date = parseSheetDate(raw, formatted);
    if (date && hasQuoteTime(raw, formatted)) {
      const cfg = tickerMarketConfig(code);
      return date.toLocaleTimeString([], {
        timeZone: cfg.tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    return '';
  }

  function formatQuoteDate(raw, formatted) {
    const date = parseSheetDate(raw, formatted);
    if (date) {
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    }
    return String(formatted || '').trim().replace(/\s*(上午|下午|AM|PM|am|pm)?\s*\d{1,2}:\d{2}.*$/, '');
  }

  function tickerFooterLabel(stock, fallbackTimestamp) {
    const quoteDate = parseSheetDate(stock.dateRaw, stock.dateStr);
    const timeLabel = formatQuoteTime(stock.dateRaw, stock.dateStr, stock.code);
    const marketOpen = isTickerMarketOpenNow(stock.code);
    const quoteIsToday = sameMarketDate(quoteDate, stock.code);

    if (marketOpen && quoteIsToday) {
      // Prefer the actual quote timestamp from the Sheet. If gviz still serves
      // a date-only formatted value, fall back to the fetch time only while the
      // market is open.
      if (timeLabel) return timeLabel;
      if (fallbackTimestamp) {
        const cfg = tickerMarketConfig(stock.code);
        return new Date(fallbackTimestamp).toLocaleTimeString([], {
          timeZone: cfg.tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
    }

    return formatQuoteDate(stock.dateRaw, stock.dateStr) || stock.dateStr || '';
  }

  /* Render an array of stock objects into the named container */
  function renderStockGrid(containerId, stocks, fallbackTimestamp) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    stocks.forEach(s => {
      const row = document.createElement('div');
      row.className = 'ticker-row';
      const dir = s.pct == null ? 'flat' : (s.pct > 0 ? 'up' : (s.pct < 0 ? 'down' : 'flat'));
      const arrow = s.pct == null ? '·' : (s.pct > 0 ? '▲' : (s.pct < 0 ? '▼' : '·'));
      const sign = (s.pct != null && s.pct > 0) ? '+' : '';
      const pctStr = s.pct == null ? '—' : sign + s.pct.toFixed(2) + '%';

      const detailUrl = stockDetailUrl(s.code);
      row.innerHTML = `
        <div class="ticker-head">
          <span class="ticker-sym">${escapeHtml(s.code)}</span>
          <span class="ticker-actions">
            <span class="ticker-change ${dir}">${arrow} ${pctStr}</span>
            <a class="pin-btn ticker-link-btn"
               href="${escapeAttr(detailUrl)}"
               target="_blank"
               rel="noopener"
               title="${escapeAttr(t('finOpenDetail'))}"
               aria-label="${escapeAttr(t('finOpenDetail'))}">
              <svg class="icon icon-sm"><use href="#i-external"/></svg>
            </a>
          </span>
        </div>
        <span class="ticker-price">${formatPrice(s.price)}</span>
        <span class="ticker-date">${escapeHtml(tickerFooterLabel(s, fallbackTimestamp))}</span>`;
      container.appendChild(row);
    });
  }

  /* Render FX rates into the fx container */
  function renderFxGrid(rates) {
    const container = document.getElementById('fx-rates');
    if (!container) return;
    container.innerHTML = '';
    rates.forEach(r => {
      const row = document.createElement('div');
      row.className = 'ticker-row fx-row';
      row.innerHTML = `
        <div class="ticker-head">
          <span class="ticker-sym">${escapeHtml(r.name)}</span>
        </div>
        <span class="ticker-price">${r.rate.toFixed(4)}<span class="ticker-price-currency">TWD</span></span>`;
      container.appendChild(row);
    });
  }

  /* Render Funds into the stocks-fund container */
  function renderFundGrid(funds, fallbackTimestamp) {
    const container = document.getElementById('stocks-fund');
    if (!container) return;
    container.innerHTML = '';
    if (!funds.length) {
      container.innerHTML = `<div class="empty-state"><p>${t('finNoData') || '—'}</p></div>`;
      return;
    }
    funds.forEach(s => {
      const row = document.createElement('div');
      row.className = 'ticker-row';
      const dir = s.pct == null ? 'flat' : (s.pct > 0 ? 'up' : (s.pct < 0 ? 'down' : 'flat'));
      const arrow = s.pct == null ? '·' : (s.pct > 0 ? '▲' : (s.pct < 0 ? '▼' : '·'));
      const sign = (s.pct != null && s.pct > 0) ? '+' : '';
      const pctStr = s.pct == null ? '—' : sign + s.pct.toFixed(2) + '%';
      const ccy = s.currency || 'TWD';
      row.innerHTML = `
        <div class="ticker-head">
          <span class="ticker-sym">${escapeHtml(s.code)}</span>
          <span class="ticker-actions">
            <span class="ticker-change ${dir}">${arrow} ${pctStr}</span>
          </span>
        </div>
        <span class="ticker-price">${formatPrice(s.price)}<span class="ticker-price-currency">${escapeHtml(ccy)}</span></span>
        <span class="ticker-date">${escapeHtml(tickerFooterLabel(s, fallbackTimestamp))}</span>`;
      container.appendChild(row);
    });
  }

  function formatPrice(p) {
    if (p == null || isNaN(p)) return '—';
    if (p < 10) return p.toFixed(3);
    if (p < 1000) return p.toFixed(2);
    return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  /* ============================================================
     FINANCE SUB-TABS — user-managed labels for market panels
     ============================================================ */
  const FINANCE_TABS_KEY = 'lcars_finance_tabs_v1';
  const FINANCE_CURRENT_TAB_KEY = 'lcars_finance_current_tab';
  const FINANCE_WATCHLIST_ID = 'watchlist';
  let financeTabs = [{ id: FINANCE_WATCHLIST_ID, name: 'WATCHLIST', locked: true }];
  let currentFinanceTab = FINANCE_WATCHLIST_ID;
  let financeTabDragSourceId = null;

  function defaultFinanceTabs() {
    return [{ id: FINANCE_WATCHLIST_ID, name: 'WATCHLIST', locked: true }];
  }

  function sanitizeFinanceTabs(value) {
    const incoming = Array.isArray(value) ? value : [];
    const seen = new Set();
    const cleaned = [];
    incoming.forEach(tab => {
      const rawId = String(tab?.id || '').trim();
      const name = String(tab?.name || '').trim();
      if (!rawId || !name || seen.has(rawId)) return;
      seen.add(rawId);
      cleaned.push({
        id: rawId,
        name: name.slice(0, 32),
        locked: rawId === FINANCE_WATCHLIST_ID || !!tab.locked
      });
    });
    if (!cleaned.some(tab => tab.id === FINANCE_WATCHLIST_ID)) {
      cleaned.unshift({ id: FINANCE_WATCHLIST_ID, name: 'WATCHLIST', locked: true });
    }
    cleaned.forEach(tab => {
      if (tab.id === FINANCE_WATCHLIST_ID) {
        tab.name = 'WATCHLIST';
        tab.locked = true;
      }
    });
    return cleaned;
  }

  function loadFinanceTabs() {
    try {
      financeTabs = sanitizeFinanceTabs(JSON.parse(localStorage.getItem(FINANCE_TABS_KEY) || 'null'));
    } catch(e) {
      financeTabs = defaultFinanceTabs();
    }
    try {
      const savedCurrent = localStorage.getItem(FINANCE_CURRENT_TAB_KEY);
      if (savedCurrent && financeTabs.some(tab => tab.id === savedCurrent)) currentFinanceTab = savedCurrent;
    } catch(e) {}
    if (!financeTabs.some(tab => tab.id === currentFinanceTab)) currentFinanceTab = FINANCE_WATCHLIST_ID;
  }

  function saveFinanceTabs() {
    try { localStorage.setItem(FINANCE_TABS_KEY, JSON.stringify(financeTabs)); } catch(e) {}
    try { localStorage.setItem(FINANCE_CURRENT_TAB_KEY, currentFinanceTab); } catch(e) {}
    // 非同步同步到 Sheet（不等待，失敗時本地快取仍有效）
    syncToSheet(null);
  }

  function financeTabLabel(tab) {
    return tab.id === FINANCE_WATCHLIST_ID ? t('finTabWatchlist') : tab.name;
  }

  function financeTabContent(tab) {
    return `
      <div class="fin-subtab-panel" data-finance-tab-panel="${escapeAttr(tab.id)}" hidden>
        ${renderPortfolioPanel(tab)}
      </div>`;
  }


  function clearFinanceTabDropMarkers() {
    document.querySelectorAll('.fin-subtab-btn.drop-before, .fin-subtab-btn.drop-after')
      .forEach(btn => btn.classList.remove('drop-before', 'drop-after'));
  }

  function reorderFinanceTabs(sourceId, targetId, placeBefore) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const from = financeTabs.findIndex(tab => tab.id === sourceId);
    let to = financeTabs.findIndex(tab => tab.id === targetId);
    if (from < 0 || to < 0) return;
    const [tab] = financeTabs.splice(from, 1);
    if (from < to) to--;
    if (!placeBefore) to++;
    financeTabs.splice(to, 0, tab);
    currentFinanceTab = sourceId;
    saveFinanceTabs();
    renderFinanceTabs();
  }

  function attachFinanceTabDragHandlers(btn) {
    const id = btn.getAttribute('data-finance-tab');
    btn.addEventListener('dragstart', (ev) => {
      financeTabDragSourceId = id;
      btn.classList.add('dragging');
      try {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', id);
      } catch(e) {}
    });
    btn.addEventListener('dragend', () => {
      btn.classList.remove('dragging');
      clearFinanceTabDropMarkers();
      financeTabDragSourceId = null;
    });
    btn.addEventListener('dragover', (ev) => {
      if (!financeTabDragSourceId || financeTabDragSourceId === id) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      const rect = btn.getBoundingClientRect();
      const before = (ev.clientX - rect.left) < rect.width / 2;
      clearFinanceTabDropMarkers();
      btn.classList.add(before ? 'drop-before' : 'drop-after');
    });
    btn.addEventListener('dragleave', (ev) => {
      if (!btn.contains(ev.relatedTarget)) {
        btn.classList.remove('drop-before', 'drop-after');
      }
    });
    btn.addEventListener('drop', (ev) => {
      if (!financeTabDragSourceId || financeTabDragSourceId === id) return;
      ev.preventDefault();
      const rect = btn.getBoundingClientRect();
      const before = (ev.clientX - rect.left) < rect.width / 2;
      const sourceId = financeTabDragSourceId;
      clearFinanceTabDropMarkers();
      reorderFinanceTabs(sourceId, id, before);
      beep(600);
    });
  }

  function renderFinanceTabs() {
    const bar = document.getElementById('finance-subtab-bar');
    const dynamicPanels = document.getElementById('finance-dynamic-panels');
    if (!bar || !dynamicPanels) return;

    if (!financeTabs.length) financeTabs = defaultFinanceTabs();
    if (!financeTabs.some(tab => tab.id === currentFinanceTab)) currentFinanceTab = FINANCE_WATCHLIST_ID;

    bar.innerHTML = financeTabs.map(tab => `
      <button class="fin-subtab-btn${tab.id === currentFinanceTab ? ' active' : ''}"
              type="button"
              draggable="true"
              data-finance-tab="${escapeAttr(tab.id)}"
              title="${escapeAttr(financeTabLabel(tab))}">
        ${escapeHtml(financeTabLabel(tab))}
      </button>`).join('');

    dynamicPanels.innerHTML = financeTabs
      .filter(tab => tab.id !== FINANCE_WATCHLIST_ID)
      .map(financeTabContent)
      .join('');

    document.querySelectorAll('[data-finance-tab-panel]').forEach(panel => {
      panel.hidden = panel.getAttribute('data-finance-tab-panel') !== currentFinanceTab;
    });

    // Paint treemaps with real container width after DOM is ready
    requestAnimationFrame(() => {
      Object.entries(_treemapBuilders).forEach(([tabId, builder]) => {
        const wrap = document.getElementById('treemap-wrap-' + tabId);
        if (!wrap) return;
        const realW = Math.round(wrap.getBoundingClientRect().width);
        if (realW > 50) wrap.innerHTML = builder(realW);
      });
    });

    bar.querySelectorAll('[data-finance-tab]').forEach(btn => {
      attachFinanceTabDragHandlers(btn);
      btn.addEventListener('click', () => {
        if (financeTabDragSourceId) return;
        setFinanceTab(btn.getAttribute('data-finance-tab'));
      });
    });

    updateFinanceTabControls();
  }

  function updateFinanceTabControls() {
    const idx = financeTabs.findIndex(tab => tab.id === currentFinanceTab);
    const current = financeTabs[idx];
    const setDisabled = (id, disabled) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !!disabled;
    };
    setDisabled('finance-tab-delete', !current || current.id === FINANCE_WATCHLIST_ID || financeTabs.length <= 1);
    setDisabled('finance-tab-rename', !current || current.id === FINANCE_WATCHLIST_ID);
  }

  function setFinanceTab(id) {
    if (!financeTabs.some(tab => tab.id === id)) return;
    currentFinanceTab = id;
    saveFinanceTabs();
    renderFinanceTabs();
    beep(560);
  }

  function uniqueFinanceTabId() {
    return 'fin_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  async function financeAddTab() {
    const name = await lcarsPrompt({
      title: t('finTabAdd'),
      label: t('finTabNamePrompt'),
      defaultValue: t('finTabNewDefault'),
      okLabel: t('libSave'),
      cancelLabel: t('libCancel')
    });
    if (name == null) return;
    const clean = String(name).trim();
    if (!clean) return;
    const tab = { id: uniqueFinanceTabId(), name: clean.slice(0, 32), locked: false };
    financeTabs.push(tab);
    currentFinanceTab = tab.id;
    saveFinanceTabs();
    renderFinanceTabs();
    beep(720);
  }

  /* ============================================================
     PORTFOLIO + TABS — 統一存入 Google Sheet
     工作表欄位：tabId | name | position | code | shares | cost
     ============================================================ */
  const PORTFOLIO_API = 'https://script.google.com/macros/s/AKfycbz14I2pnaZKMODgehIhtM2RroHUM0Do4OSDDSjZLt4zSA8RaJQfTKdtK2INlhEdKNf6/exec';
  const PORTFOLIO_KEY  = 'lcars_portfolio_v1';   // holdings 本地快取
  const FINANCE_TABS_KEY_REMOTE = 'lcars_finance_tabs_remote_v1'; // tabs 本地快取

  let _portfolioCache = null;  // { tabId: { code: { shares, cost } } }

  function loadPortfolioCache() {
    try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '{}'); } catch(e) { return {}; }
  }
  function savePortfolioCache(data) {
    try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function getTabHoldings(tabId) {
    if (!_portfolioCache) _portfolioCache = loadPortfolioCache();
    return _portfolioCache[tabId] || {};
  }

  /* 啟動時從 Sheet 同步 tabs + holdings，成功後更新本地狀態並重繪 */
  async function fetchFromSheet() {
    try {
      const res  = await fetch(PORTFOLIO_API);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      // 更新 holdings 快取
      _portfolioCache = json.holdings || {};
      savePortfolioCache(_portfolioCache);

      // 合併 tabs：以 Sheet 為主，保留 WATCHLIST，補上 locked 旗標
      if (Array.isArray(json.tabs) && json.tabs.length > 0) {
        const remoteTabs = json.tabs.map(t => ({
          id: t.id, name: t.name, locked: false
        }));
        // 確保 WATCHLIST 永遠在第一位
        const merged = [
          { id: FINANCE_WATCHLIST_ID, name: 'WATCHLIST', locked: true },
          ...remoteTabs.filter(t => t.id !== FINANCE_WATCHLIST_ID)
        ];
        financeTabs = sanitizeFinanceTabs(merged);
        // 若目前選的 tab 不在清單裡，切回 WATCHLIST
        if (!financeTabs.some(t => t.id === currentFinanceTab)) {
          currentFinanceTab = FINANCE_WATCHLIST_ID;
        }
        // 寫回 localStorage 供下次離線使用
        try { localStorage.setItem(FINANCE_TABS_KEY, JSON.stringify(financeTabs)); } catch(e) {}
        renderFinanceTabs();
      }
    } catch(e) {
      console.warn('[LCARS] Sheet sync failed, using local cache:', e);
      if (!_portfolioCache) _portfolioCache = loadPortfolioCache();
    }
  }

  /* 儲存：先更新本地快取，再把完整狀態 POST 到 Sheet */
  async function syncToSheet(updatedHoldings) {
    if (updatedHoldings) {
      _portfolioCache = updatedHoldings;
      savePortfolioCache(_portfolioCache);
    }
    try {
      const payload = {
        tabs: financeTabs,
        holdings: _portfolioCache || {}
      };
      const res  = await fetch(PORTFOLIO_API, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.ok) console.warn('[LCARS] Sheet sync error:', json.error);
    } catch(e) {
      console.warn('[LCARS] Sheet sync failed (local cache preserved):', e);
    }
  }

  /* Colour palette — resolved hex so CSS variables work in inline SVG */
  const BAR_COLORS = [
    '#e8902a','#4a8fe8','#9b5ae8','#e8c84a','#4ae890','#e84a5a',
    '#38bdf8','#c084fc','#fb923c','#a3e635'
  ];

  /* Get cached stock price by code. Returns null if unavailable. */
  function getCachedPrice(code) {
    const cached = cacheGet(STOCKS_CACHE_KEY);
    const fundCached = cacheGet(FUND_CACHE_KEY);
    const all = [
      ...(cached?.tw || []),
      ...(cached?.us || []),
      ...(fundCached?.funds || []),
    ];
    const found = all.find(s => s.code === code);
    return found ? found.price : null;
  }

  function getCachedCurrency(code) {
    const cached = cacheGet(STOCKS_CACHE_KEY);
    const fundCached = cacheGet(FUND_CACHE_KEY);
    const all = [
      ...(cached?.tw || []),
      ...(cached?.us || []),
      ...(fundCached?.funds || []),
    ];
    const found = all.find(s => s.code === code);
    return found ? found.currency : null;
  }

  function getCachedPct(code) {
    const cached = cacheGet(STOCKS_CACHE_KEY);
    const fundCached = cacheGet(FUND_CACHE_KEY);
    const all = [
      ...(cached?.tw || []),
      ...(cached?.us || []),
      ...(fundCached?.funds || []),
    ];
    const found = all.find(s => s.code === code);
    return found ? found.pct : null;
  }

  /* Get USD→TWD rate from FX cache. Returns null if unavailable. */
  /* Get the TWD rate for any foreign currency.
     Sheet stores: "1 foreign = X TWD"  (e.g. USD→31.32, JPY→0.20) */
  function getFxRateToTwd(currency) {
    if (!currency || currency.toUpperCase() === 'TWD') return 1;
    const fxCached = cacheGet(FX_CACHE_KEY);
    if (!fxCached) return null;
    const key = currency.toUpperCase();
    const entry = (fxCached.rates || []).find(r => r.name.toUpperCase() === key);
    return entry ? entry.rate : null;
  }

  /* Convenience wrapper kept for backward compatibility */
  function getUsdToTwd() {
    return getFxRateToTwd('USD');
  }

  /* isTW: use currency field if available, fall back to code pattern */
  function isTW(code, currency) {
    if (currency) return currency.toUpperCase() === 'TWD';
    return /^\d{4,5}$/.test(String(code).trim());
  }

  /* Format number for table display */
  function fmtNum(n, decimals) {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  /* Build stacked horizontal bar + legend (like the reference image) */
  function buildStackedBar(segments, totalTwd) {
    if (!segments.length || !totalTwd) return '';

    const trackSegs = segments.map(seg => {
      const pct = (seg.value / totalTwd * 100).toFixed(2);
      return `<div class="portfolio-bar-seg" style="width:${pct}%;background:${seg.color};"></div>`;
    }).join('');

    const legendItems = segments.map(seg => {
      const pct = (seg.value / totalTwd * 100).toFixed(1);
      const twdVal = Math.round(seg.value).toLocaleString();
      return `<div class="portfolio-legend-item">
        <span class="portfolio-legend-dot" style="background:${seg.color}"></span>
        <span class="portfolio-legend-pct">${pct}%</span>
        <span>${escapeHtml(seg.label)}</span>
        <span class="portfolio-legend-val">NT$${twdVal}</span>
      </div>`;
    }).join('');

    return `<div class="portfolio-bar-track">${trackSegs}</div>
            <div class="portfolio-bar-legend">${legendItems}</div>`;
  }

  /* Render the portfolio panel for a given tab */
  /* LCARS palette for stacked bar — distinct LCARS colours */
  const LCARS_BAR_PALETTE = [
    '#f7941d', // orange
    '#99ccff', // blue
    '#cc99cc', // violet
    '#ffcc00', // gold
    '#cc6666', // rust
    '#66cccc', // teal
    '#ff9999', // pink
    '#99cc99', // green
  ];

  /* Render the portfolio panel for a given tab */
  function renderPortfolioPanel(tab) {
    const holdings = getTabHoldings(tab.id);
    // Use Sheet order (same as edit form): TW stocks → US stocks → Funds
    const cached     = cacheGet(STOCKS_CACHE_KEY);
    const fundCached = cacheGet(FUND_CACHE_KEY);
    const allCodes = [
      ...(cached     ? [...(cached.tw || []).map(s => s.code), ...(cached.us || []).map(s => s.code)] : []),
      ...(fundCached ? (fundCached.funds || []).map(s => s.code) : []),
    ];
    // Filter to codes that have holdings, preserving Sheet order
    const codes = allCodes.filter(c => (holdings[c]?.shares || 0) > 0);
    const usdRate = getUsdToTwd();

    if (!codes.length) {
      return `<div class="fin-tab-empty">
        <svg class="icon icon-lg"><use href="#i-stocks"/></svg>
        <div class="fin-tab-empty-title">${escapeHtml(financeTabLabel(tab))}</div>
        <div class="fin-tab-empty-msg">${escapeHtml(t('finPortfolioNoData'))}</div>
      </div>`;
    }
    if (!cached) {
      return `<div class="fin-tab-empty">
        <svg class="icon icon-lg"><use href="#i-stocks"/></svg>
        <div class="fin-tab-empty-title">${escapeHtml(financeTabLabel(tab))}</div>
        <div class="fin-tab-empty-msg">${escapeHtml(t('finPortfolioNoPrices'))}</div>
      </div>`;
    }

    // Build data rows
    let totalTwd = 0, totalTwdStocks = 0, totalUsdValue = 0;
    const rows = codes.map((code, i) => {
      const h        = holdings[code];
      const shares   = Number(h.shares) || 0;
      const cost     = Number(h.cost)   || 0;
      const price    = getCachedPrice(code);
      const pct      = getCachedPct(code);
      const currency = getCachedCurrency(code) || 'USD';
      const tw       = currency.toUpperCase() === 'TWD';
      const dec      = tw ? 0 : 2;
      const value    = price != null ? price * shares : null;
      const pnl      = (value != null && cost > 0) ? value - cost : null;
      const ret      = (pnl  != null && cost > 0) ? (pnl / cost) * 100 : null;
      const dir      = pnl == null ? '' : pnl > 0 ? 'up' : pnl < 0 ? 'down' : '';
      const sign     = (pnl != null && pnl > 0) ? '+' : '';
      let valueTwd = null;
      if (value != null) {
        if (tw) {
          valueTwd = value;
        } else {
          const fxRate = getFxRateToTwd(currency);
          valueTwd = fxRate != null ? value * fxRate : null;
        }
        if (valueTwd != null) {
          totalTwd += valueTwd;
          if (tw) totalTwdStocks += valueTwd;
          else    totalUsdValue  += value;
        }
      }
      return { code, currency, tw, dec, shares, cost, price, pct, value, pnl, ret, dir, sign, valueTwd,
               color: LCARS_BAR_PALETTE[i % LCARS_BAR_PALETTE.length] };
    });

    // ── Summary cards ──
    const foreignInTwd = totalTwd - totalTwdStocks;  // all non-TWD converted
    const sumTwd   = fmtNum(totalTwdStocks, 0);
    const sumUsd   = fmtNum(totalUsdValue, 2);
    const sumAll   = totalTwd > 0 ? fmtNum(totalTwd, 0) : '—';
    const usdLabel = usdRate ? '≈ NT$' + fmtNum(totalUsdValue * usdRate, 0) : '';

    // ── Summary cards — one per currency found in holdings, plus total ──
    // Collect totals per currency
    const ccyTotals = {};
    rows.forEach(r => {
      if (r.value == null) return;
      const ccy = r.currency || 'USD';
      ccyTotals[ccy] = (ccyTotals[ccy] || 0) + r.value;
    });

    const CCY_SYMBOLS = { TWD: 'NT$', USD: '$', JPY: '¥', EUR: '€', GBP: '£', HKD: 'HK$' };

    const ccyCards = Object.entries(ccyTotals).map(([ccy, total]) => {
      const sym  = CCY_SYMBOLS[ccy] || ccy + ' ';
      const dec  = ccy === 'TWD' || ccy === 'JPY' ? 0 : 2;
      const fxRate = getFxRateToTwd(ccy);
      const subLabel = (ccy !== 'TWD' && fxRate)
        ? '≈ NT$' + fmtNum(total * fxRate, 0)
        : '';
      return `
        <div class="portfolio-summary-card">
          <div class="portfolio-summary-label">${escapeHtml(ccy)}</div>
          <div class="portfolio-summary-value">${escapeHtml(sym)}${fmtNum(total, dec)}</div>
          ${subLabel ? `<div class="portfolio-summary-sub">${escapeHtml(subLabel)}</div>` : ''}
        </div>`;
    }).join('');

    const totalCard = `
        <div class="portfolio-summary-card portfolio-summary-card--total">
          <div class="portfolio-summary-label">${escapeHtml(t('finPortfolioTotalTwd'))}</div>
          <div class="portfolio-summary-value">NT$ ${sumAll}</div>
        </div>`;

    const ccyCount  = Object.keys(ccyTotals).length;
    const cardCount = ccyCount + 1; // +1 for total card
    const cols      = Math.min(cardCount, 4);

    const summaryPanel = `
      <div class="portfolio-panel">
        <div class="panel-title"><span>${escapeHtml(t('finPortfolioSummary'))}</span></div>
        <div class="portfolio-summary-grid" style="grid-template-columns:repeat(${cols},1fr)">
          ${ccyCards}
          ${totalCard}
        </div>
      </div>`;

    // ── Holdings table ──
    const tableRows = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.code)}</td>
        <td><span class="ccy-badge ${r.tw ? 'twd' : 'usd'}">${escapeHtml(r.currency)}</span></td>
        <td>${r.price != null ? fmtNum(r.price, 2) : '—'}</td>
        <td>${fmtNum(r.shares, r.tw ? 0 : 2)}</td>
        <td>${fmtNum(r.cost, r.dec)}</td>
        <td>${r.value != null ? fmtNum(r.value, r.dec) : '—'}</td>
        <td class="${r.dir}">${r.pnl != null ? r.sign + fmtNum(r.pnl, r.dec) : '—'}</td>
        <td class="${r.dir}">${r.ret != null ? r.sign + r.ret.toFixed(2) + '%' : '—'}</td>
      </tr>`).join('');

    const holdingsPanel = `
      <div class="portfolio-panel" style="margin-top:2px">
        <div class="panel-title"><span>${escapeHtml(financeTabLabel(tab))}</span></div>
        <div class="portfolio-table-wrap">
          <table class="portfolio-table">
            <thead><tr>
              <th>${escapeHtml(t('finPortfolioCode'))}</th>
              <th>${escapeHtml(t('finPortfolioCcy'))}</th>
              <th>${escapeHtml(t('finPortfolioPrice'))}</th>
              <th>${escapeHtml(t('finPortfolioShares'))}</th>
              <th>${escapeHtml(t('finPortfolioCost'))}</th>
              <th>${escapeHtml(t('finPortfolioValue'))}</th>
              <th>${escapeHtml(t('finPortfolioPnl'))}</th>
              <th>${escapeHtml(t('finPortfolioRet'))}</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>`;

    // ── Treemap ──
    const treemapSegs = rows
      .filter(r => r.valueTwd != null && r.valueTwd > 0)
      .sort((a, b) => b.valueTwd - a.valueTwd);

    let chartPanel = '';
    if (treemapSegs.length) {

      // ---- Squarified Treemap ----
      // PW is read from actual DOM after insertion so aspect ratio is correct.
      const TREEMAP_H = 220;
      const treemapData = treemapSegs.map(s => ({ ...s, v: s.valueTwd }));

      // Squarified treemap — Bruls et al. algorithm
      // Each node must have .v (value) and any other props passed through.
      function squarifyPx(nodes, X, Y, W, H) {
        if (!nodes.length || !W || !H) return [];
        const results = [];
        const totalV = nodes.reduce((s, n) => s + n.v, 0);

        // aspect ratio of a tile: max(long/short)
        function aspect(a, b) { return a > b ? a / b : b / a; }

        // worst aspect ratio in a row laid along `side` with total row area `rowA`
        function worst(row, rowA, side) {
          let w = 0;
          for (const n of row) {
            // tile dims: side × (n.area / rowA)  ... wait, correct formula:
            // if row height = rowA/side, tile width = n.area / (rowA/side) = n.area*side/rowA
            const long = side;                   // the stripe dimension
            const sht  = rowA / side;            // thickness of the stripe
            const tileDim = (n.v / totalV) * W * H / sht; // tile extent along stripe
            const r = aspect(tileDim, sht);
            if (r > w) w = r;
          }
          return w;
        }

        function layout(items, x, y, w, h) {
          if (!items.length) return;
          if (items.length === 1) {
            results.push({ item: items[0], x, y, w, h });
            return;
          }
          // shorter side is where the new strip goes
          const horiz = w >= h;
          const side  = horiz ? w : h;

          let row = [], rowV = 0, i = 0;
          while (i < items.length) {
            const next    = items[i];
            const newRowV = rowV + next.v;
            // Stripe thickness = newRowV/totalV * (full dim perpendicular to side)
            const stripT  = (newRowV / totalV) * (horiz ? h : w);
            if (!stripT) { row.push(next); rowV = newRowV; i++; continue; }

            function worstInRow(r, rv) {
              let wst = 0;
              const st = (rv / totalV) * (horiz ? h : w);
              if (!st) return Infinity;
              for (const n of r) {
                const tileLen = (n.v / rv) * (horiz ? w : h);
                const r2 = aspect(tileLen, st);
                if (r2 > wst) wst = r2;
              }
              return wst;
            }

            const wOld = row.length ? worstInRow(row, rowV) : Infinity;
            const wNew = worstInRow([...row, next], newRowV);

            if (!row.length || wNew <= wOld) {
              row.push(next); rowV = newRowV; i++;
            } else {
              break;
            }
          }
          if (!row.length) { row = [items[0]]; rowV = items[0].v; i = 1; }

          // Place the row
          const stripFrac = rowV / totalV;
          const stripT    = (horiz ? h : w) * stripFrac;
          let pos = horiz ? x : y;
          for (const n of row) {
            const tileLen = (n.v / rowV) * (horiz ? w : h);
            if (horiz) {
              results.push({ item: n, x: pos, y, w: tileLen, h: stripT });
              pos += tileLen;
            } else {
              results.push({ item: n, x, y: pos, w: stripT, h: tileLen });
              pos += tileLen;
            }
          }

          // Recurse on remainder
          const rem = items.slice(i);
          if (horiz) layout(rem, x, y + stripT, w, h - stripT);
          else       layout(rem, x + stripT, y, w - stripT, h);
        }

        layout(nodes, X, Y, W, H);
        return results;
      }

      function pctColor(pct) {
        if (pct == null) return 'rgba(80,80,100,0.7)';
        if (pct >=  3)   return '#2a6e3f';
        if (pct >=  2)   return '#2f7d46';
        if (pct >=  1)   return '#3a8f52';
        if (pct >=  0)   return '#4a7a5a';
        if (pct >= -1)   return '#7a4a52';
        if (pct >= -2)   return '#8f3a44';
        if (pct >= -3)   return '#9e2e38';
        return                   '#b02030';
      }

      function buildTiles(pw) {
        const GAP   = 2;
        const tiles = squarifyPx(treemapData, 0, 0, pw, TREEMAP_H);
        return tiles.map(({ item, x, y, w, h }) => {
          const xp = ((x + GAP / 2) / pw * 100).toFixed(3);
          const yp = ((y + GAP / 2) / TREEMAP_H * 100).toFixed(3);
          const wp = Math.max(0, (w - GAP) / pw * 100).toFixed(3);
          const hp = Math.max(0, (h - GAP) / TREEMAP_H * 100).toFixed(3);
          const bg = pctColor(item.pct);
          const pctStr = item.pct != null
            ? (item.pct >= 0 ? '+' : '') + item.pct.toFixed(2) + '%' : '—';
          const showCode = w > 55  && h > 30;
          const showPct  = w > 55  && h > 55;
          const showAttr = showCode && showPct ? 'full' : showCode ? 'code' : 'none';
          const fontSize = w > 220 ? '15px' : w > 120 ? '13px' : '11px';
          return `<div class="treemap-tile has-tooltip"
            style="left:${xp}%;top:${yp}%;width:${wp}%;height:${hp}%;background:${bg}"
            data-code="${escapeAttr(item.code)}"
            data-pct="${escapeAttr(pctStr)}"
            data-show="${showAttr}">
            ${showCode ? `<span class="treemap-code" style="font-size:${fontSize}">${escapeHtml(item.code)}</span>` : ''}
            ${showPct  ? `<span class="treemap-pct">${escapeHtml(pctStr)}</span>` : ''}
          </div>`;
        }).join('');
      }

      const legendStops = [
        { label:'≤ -3%', color:'#b02030' }, { label:'-2%', color:'#9e2e38' },
        { label:'-1%',   color:'#8f3a44' }, { label:'0',   color:'#4a7a5a' },
        { label:'+1%',   color:'#3a8f52' }, { label:'+2%', color:'#2f7d46' },
        { label:'≥ +3%', color:'#2a6e3f' },
      ];
      const legendEl = legendStops.map(s =>
        `<div class="treemap-legend-item">
          <div class="treemap-legend-swatch" style="background:${s.color}"></div>
          <span>${escapeHtml(s.label)}</span>
        </div>`).join('');

      const treemapWrapId = 'treemap-wrap-' + tab.id;
      chartPanel = `
        <div class="portfolio-panel" style="margin-top:2px">
          <div class="panel-title" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
            <span>${escapeHtml(t('finPortfolioAlloc'))}</span>
            <div class="treemap-legend">${legendEl}</div>
          </div>
          <div class="treemap-wrap" id="${treemapWrapId}"></div>
        </div>`;

      // Store buildTiles fn keyed by tab id so renderTreemaps() can call it
      _treemapBuilders[tab.id] = buildTiles;

    return `<div class="portfolio-wrap">${summaryPanel}${holdingsPanel}${chartPanel}</div>`;
  }

  }

  /* ============================================================
     FINANCE TAB EDIT MODAL — name + holdings, compact form
     ============================================================ */
  async function financeEditTab() {
    const tab = financeTabs.find(item => item.id === currentFinanceTab);
    if (!tab || tab.id === FINANCE_WATCHLIST_ID) return;

    const cached     = cacheGet(STOCKS_CACHE_KEY);
    const fundCached = cacheGet(FUND_CACHE_KEY);
    const allCodes = [
      ...(cached     ? [...(cached.tw || []).map(s => s.code), ...(cached.us || []).map(s => s.code)] : [...STOCKS_TW, ...STOCKS_US]),
      ...(fundCached ? (fundCached.funds || []).map(s => s.code) : []),
    ];
    const currentHoldings = getTabHoldings(tab.id);

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      let topZ = 10000;
      document.querySelectorAll('.alert-overlay').forEach(o => {
        const z = parseInt(o.style.zIndex || getComputedStyle(o).zIndex) || 0;
        if (z > topZ) topZ = z;
      });
      overlay.style.zIndex = topZ + 10;

      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      overlay.appendChild(stack);

      const card = document.createElement('div');
      card.className = 'alert-card confirm portfolio-modal';

      const head = document.createElement('div');
      head.className = 'alert-head';
      head.innerHTML = `<span>${escapeHtml(t('finPortfolioEdit'))} · ${escapeHtml(financeTabLabel(tab))}</span>`;

      const body = document.createElement('div');
      body.className = 'portfolio-modal-body';
      body.style.whiteSpace = 'normal';

      // Section 1: tab name — single inline row
      const secName = document.createElement('div');
      secName.className = 'portfolio-modal-section';
      secName.style.cssText = 'display:flex;align-items:center;gap:10px;';
      const nameLbl = document.createElement('span');
      nameLbl.className = 'portfolio-section-label';
      nameLbl.style.marginBottom = '0';
      nameLbl.style.whiteSpace = 'nowrap';
      nameLbl.textContent = t('finPortfolioTabName');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'portfolio-num-input';
      nameInput.style.cssText = 'flex:1;text-align:left;';
      nameInput.value = tab.name;
      nameInput.maxLength = 32;
      secName.appendChild(nameLbl);
      secName.appendChild(nameInput);
      body.appendChild(secName);

      // Section 2: holdings
      const secHold = document.createElement('div');
      secHold.className = 'portfolio-modal-section';

      // Column header
      const colHead = document.createElement('div');
      colHead.className = 'portfolio-stock-row';
      colHead.style.marginBottom = '4px';
      colHead.innerHTML = `
        <span class="portfolio-section-label" style="margin-bottom:0">${escapeHtml(t('finPortfolioHoldings'))}</span>
        <span class="portfolio-input-label">${escapeHtml(t('finPortfolioShares'))}</span>
        <span class="portfolio-input-label">${escapeHtml(t('finPortfolioCost'))}</span>`;
      secHold.appendChild(colHead);

      const inputRefs = {};
      allCodes.forEach(code => {
        const tw = isTW(code, getCachedCurrency(code));
        const h  = currentHoldings[code] || {};
        const row = document.createElement('div');
        row.className = 'portfolio-stock-row';

        const ccy = getCachedCurrency(code) || (tw ? 'TWD' : 'USD');
        const symEl = document.createElement('div');
        symEl.className = 'portfolio-stock-sym';
        symEl.innerHTML = escapeHtml(code) +
          `<span class="ccy-text">${escapeHtml(ccy)}</span>`;

        const sharesInput = document.createElement('input');
        sharesInput.type = 'text';
        sharesInput.inputMode = 'decimal';
        sharesInput.className = 'portfolio-num-input';
        sharesInput.placeholder = '0';
        sharesInput.value = h.shares != null ? h.shares : '';

        const costInput = document.createElement('input');
        costInput.type = 'text';
        costInput.inputMode = 'decimal';
        costInput.className = 'portfolio-num-input';
        costInput.placeholder = '0';
        costInput.value = h.cost != null ? h.cost : '';

        row.appendChild(symEl);
        row.appendChild(sharesInput);
        row.appendChild(costInput);
        secHold.appendChild(row);
        inputRefs[code] = { sharesInput, costInput };
      });
      body.appendChild(secHold);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = t('libCancel');

      const okBtn = document.createElement('button');
      okBtn.className = 'alert-ok';
      okBtn.style.cssText = 'background:var(--lcars-blue);color:var(--lcars-bg)';
      okBtn.textContent = t('libSave');

      const finish = async (save) => {
        document.removeEventListener('keydown', onKey);
        closeOverlay(overlay);
        if (save) {
          const clean = String(nameInput.value).trim();
          if (clean) tab.name = clean.slice(0, 32);
          const newHoldings = {};
          allCodes.forEach(code => {
            const shares = parseFloat(inputRefs[code].sharesInput.value);
            const cost   = parseFloat(inputRefs[code].costInput.value);
            if (!isNaN(shares) && shares > 0)
              newHoldings[code] = { shares, cost: isNaN(cost) ? 0 : cost };
          });
          // 更新本地快取
          if (!_portfolioCache) _portfolioCache = loadPortfolioCache();
          _portfolioCache[tab.id] = newHoldings;
          savePortfolioCache(_portfolioCache);
          // 更新 tabs + holdings 一起同步到 Sheet
          saveFinanceTabs();
          renderFinanceTabs();
          beep(620);
        } else { beep(380); }
        resolve(save);
      };

      const onKey = ev => {
        if (ev.key === 'Escape') { ev.stopPropagation(); finish(false); }
      };
      cancelBtn.addEventListener('click', () => finish(false));
      okBtn.addEventListener('click',     () => finish(true));
      installBackdropClose(overlay, () => finish(false));
      document.addEventListener('keydown', onKey);

      footer.appendChild(cancelBtn);
      footer.appendChild(okBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      openOverlay(overlay);
      requestAnimationFrame(() => nameInput.focus());
    });
  }
  function financeDeleteTab() {
    const tab = financeTabs.find(item => item.id === currentFinanceTab);
    if (!tab) return;
    if (tab.id === FINANCE_WATCHLIST_ID) {
      flash('>>> ' + t('finTabCannotDeleteWatchlist') + ' <<<');
      return;
    }
    lcarsConfirm({
      title: t('finTabDeleteTitle'),
      body: t('finTabDeleteBody').replace('{name}', financeTabLabel(tab)),
      okLabel: t('libDelete'),
      cancelLabel: t('libCancel'),
      danger: true
    }).then(ok => {
      if (!ok) return;
      const idx = financeTabs.findIndex(item => item.id === tab.id);
      financeTabs = financeTabs.filter(item => item.id !== tab.id);
      const fallback = financeTabs[Math.max(0, idx - 1)] || financeTabs[0] || defaultFinanceTabs()[0];
      currentFinanceTab = fallback.id;
      saveFinanceTabs();
      renderFinanceTabs();
      beep(480);
    });
  }

  function initFinanceTabs() {
    loadFinanceTabs();
    if (!_portfolioCache) _portfolioCache = loadPortfolioCache();
    renderFinanceTabs(); // 先用本地快取立即渲染
    fetchFromSheet();    // 背景同步 Sheet，完成後自動重繪
    const bind = (id, fn) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', fn);
    };
    bind('finance-tab-add', financeAddTab);
    bind('finance-tab-rename', financeEditTab);
    bind('finance-tab-delete', financeDeleteTab);
    window.setFinanceTab = setFinanceTab;
    window.financeAddTab = financeAddTab;

    // Treemap tooltip — event delegation on document
    // Use lazy lookup so it works even if tooltip div renders after init
    document.addEventListener('mousemove', e => {
      const tile = e.target.closest('.has-tooltip');
      const tooltip = document.getElementById('treemap-tooltip');
      if (!tooltip) return;
      if (tile && tile.dataset.show !== 'full') {
        document.getElementById('treemap-tooltip-code').textContent = tile.dataset.code || '';
        document.getElementById('treemap-tooltip-pct').textContent  = tile.dataset.pct  || '';
        tooltip.classList.add('visible');
        const pad = 14;
        let tx = e.clientX + pad;
        let ty = e.clientY + pad;
        const tw = tooltip.offsetWidth  || 120;
        const th = tooltip.offsetHeight || 32;
        if (tx + tw > window.innerWidth)  tx = e.clientX - tw - pad;
        if (ty + th > window.innerHeight) ty = e.clientY - th - pad;
        tooltip.style.left = tx + 'px';
        tooltip.style.top  = ty + 'px';
      } else {
        tooltip.classList.remove('visible');
      }
    });
    document.addEventListener('mouseleave', () => {
      const tooltip = document.getElementById('treemap-tooltip');
      if (tooltip) tooltip.classList.remove('visible');
    });
  }

