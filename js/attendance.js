// js/attendance.js — Workspace · Attendance Tracker
// 考勤紀錄模組：特休 / 補休 / 事假 / 病假

  const ATT_API_URL = 'https://script.google.com/macros/s/AKfycbwxdY5k3EDJXmow24aeRFq-zDBrTUh2M5dzKfFdJ2vs2uSdztlMz14t6x_ncv9rNJJr/exec';

  // ── Cache keys ────────────────────────────────────────────────────────────
  const ATT_REC_CACHE  = 'lcars_att_records';
  const ATT_QUO_CACHE  = 'lcars_att_quotas';

  // ── State ─────────────────────────────────────────────────────────────────
  let attRecords  = [];   // [{id, date, type, hours, notes, created_at}]
  let attQuotas   = [];   // [{year, annual_leave_quota, comp_leave_balance}]
  let attLoading  = false;
  let attError    = null;
  let attYear     = new Date().getFullYear();

  // ── Config ────────────────────────────────────────────────────────────────
  const ATT_TYPES = ['annual', 'comp', 'personal', 'sick'];

  const ATT_TYPE_CFG = {
    annual:   { color: 'var(--lcars-orange)', key: 'attLeaveAnnual'   },
    comp:     { color: 'var(--lcars-violet)', key: 'attLeaveComp'     },
    personal: { color: 'var(--lcars-gold)',   key: 'attLeavePersonal' },
    sick:     { color: 'var(--lcars-rust)',   key: 'attLeaveSick'     },
  };

  const WEEKDAYS_ZH = ['日','一','二','三','四','五','六'];
  const WEEKDAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // ── API helpers ───────────────────────────────────────────────────────────

  function attUnwrap(payload) {
    if (payload && typeof payload === 'object' && 'ok' in payload) {
      if (!payload.ok) throw new Error(payload.error || 'API error');
      return payload.data;
    }
    return payload;
  }

  async function attGet(params = {}) {
    const url = new URL(ATT_API_URL);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return attUnwrap(await res.json());
  }

  async function attPost(body) {
    const res = await fetch(ATT_API_URL, {
      method:  'POST',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return attUnwrap(await res.json());
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function fetchAttendance() {
    attLoading = true;
    attError   = null;
    renderAttPage();
    try {
      const data = await attGet({ sheet: 'all' });
      attRecords = Array.isArray(data.records) ? data.records : [];
      attQuotas  = Array.isArray(data.quotas)  ? data.quotas  : [];
      attRecords = attRecords.map(r => ({ ...r, hours: parseFloat(r.hours) || 0, date: attParseDate(r.date) }));
      cacheSet(ATT_REC_CACHE, attRecords);
      cacheSet(ATT_QUO_CACHE, attQuotas);
      attError = null;
    } catch(e) {
      console.warn('[LCARS ATT] Fetch failed:', e);
      attError   = e.message;
      attRecords = (cacheGet(ATT_REC_CACHE) || []).map(r => ({ ...r, hours: parseFloat(r.hours)||0, date: attParseDate(r.date) }));
      attQuotas  = cacheGet(ATT_QUO_CACHE) || [];
    }
    attLoading = false;
    renderAttPage();
  }
  window.fetchAttendance = fetchAttendance;

  // ── Render ────────────────────────────────────────────────────────────────

  function renderAttPage() {
    const root = document.getElementById('att-root');
    if (!root) return;
    root.innerHTML = '';

    if (attLoading && attRecords.length === 0) {
      root.innerHTML = '<div class="proj-loading" data-i18n="loadingMsg">LOADING…</div>';
      return;
    }

    if (attError) {
      const banner = attEl('div', 'proj-error-banner');
      banner.innerHTML = `⚠ ${t('attOffline')} `;
      const btn = attEl('button'); btn.textContent = t('libRetry'); btn.onclick = fetchAttendance;
      banner.appendChild(btn);
      root.appendChild(banner);
    }

    // Year navigator
    root.appendChild(renderAttYearNav());

    // Summary cards
    root.appendChild(renderAttSummary());

    // Monthly breakdown
    root.appendChild(renderAttMonths());
  }

  // ── Year navigator ────────────────────────────────────────────────────────

  function renderAttYearNav() {
    const wrap = attEl('div', 'att-year-nav');

    const prevBtn = attEl('button', 'att-year-btn');
    prevBtn.textContent = '◀';
    prevBtn.onclick = () => { attYear = parseInt(attYear) - 1; renderAttPage(); };
    wrap.appendChild(prevBtn);

    const label = attEl('span', 'att-year-label');
    label.textContent = attYear;
    wrap.appendChild(label);

    const nextBtn = attEl('button', 'att-year-btn');
    nextBtn.textContent = '▶';
    nextBtn.onclick = () => { attYear = parseInt(attYear) + 1; renderAttPage(); };
    wrap.appendChild(nextBtn);

    // Settings: quota + comp balance
    const settingsBtn = attEl('button', 'att-settings-btn');
    settingsBtn.textContent = '⚙ ' + t('attSetQuota');
    settingsBtn.onclick = () => openAttSettingsModal();
    wrap.appendChild(settingsBtn);

    // Add record button
    const addBtn = attEl('button', 'att-add-btn');
    addBtn.textContent = t('attAddRecord');
    addBtn.onclick = () => openAttModal(null);
    wrap.appendChild(addBtn);

    return wrap;
  }

  // ── Summary cards ─────────────────────────────────────────────────────────

  function renderAttSummary() {
    const wrap = attEl('div', 'att-summary');
    const quota = attGetQuota(attYear);

    // Calculate used hours per type for this year
    const yearRecords = attRecords.filter(r => r.date && String(r.date).slice(0,4) === String(attYear));
    const used = { annual: 0, comp: 0, personal: 0, sick: 0 };
    yearRecords.forEach(r => { if (used[r.type] !== undefined) used[r.type] += r.hours; });

    ATT_TYPES.forEach(type => {
      const cfg  = ATT_TYPE_CFG[type];
      const card = attEl('div', 'att-summary-card');
      card.style.setProperty('--att-color', cfg.color);

      const typeLabel = attEl('div', 'att-summary-type');
      typeLabel.textContent = t(cfg.key);
      card.appendChild(typeLabel);

      const usedEl = attEl('div', 'att-summary-used');
      usedEl.innerHTML = `<span class="att-summary-num">${attToDH(used[type]) || used[type] + t('attHours')}</span>`;
      const usedLabel = attEl('span', 'att-summary-sublabel');
      usedLabel.textContent = t('attUsed');
      usedEl.appendChild(usedLabel);
      card.appendChild(usedEl);

      if (type === 'annual' && quota.annual > 0) {
        // Quota bar
        const remaining = Math.max(0, quota.annual - used.annual);
        const pct = Math.min(100, Math.round(used.annual / quota.annual * 100));

        const barWrap = attEl('div', 'att-summary-bar-wrap');
        const bar = attEl('div', 'att-summary-bar');
        const fill = attEl('div', 'att-summary-bar-fill');
        fill.style.width = pct + '%';
        bar.appendChild(fill);
        barWrap.appendChild(bar);
        card.appendChild(barWrap);

        const detail = attEl('div', 'att-summary-detail');
        detail.innerHTML = `<span>${t('attRemaining')} <strong>${attToDH(remaining) || remaining + t('attHours')}</strong></span><span>${t('attQuota')} ${attToDH(quota.annual) || quota.annual + t('attHours')}</span>`;
        card.appendChild(detail);
      }

      if (type === 'comp') {
        const remaining = Math.max(0, quota.comp - used.comp);
        const detail = attEl('div', 'att-summary-detail');
        detail.innerHTML = `<span>${t('attRemaining')} <strong>${attToDH(remaining) || remaining + t('attHours')}</strong></span><span>${t('attBalance')} ${attToDH(quota.comp) || quota.comp + t('attHours')}</span>`;
        card.appendChild(detail);
      }

      wrap.appendChild(card);
    });

    return wrap;
  }

  // ── Monthly breakdown ─────────────────────────────────────────────────────

  function renderAttMonths() {
    const wrap = attEl('div', 'att-months');
    const yearRecords = attRecords.filter(r => r.date && r.date.startsWith(String(attYear)));

    // Group by month (1–12), show only months that have records
    // Plus always show current month
    const nowMonth = new Date().getMonth() + 1;
    const nowYear  = new Date().getFullYear();

    const monthsWithRecords = new Set(
      yearRecords.filter(r => r.date).map(r => parseInt(String(r.date).slice(5,7)))
    );
    if (attYear === nowYear) monthsWithRecords.add(nowMonth);

    if (monthsWithRecords.size === 0) {
      const empty = attEl('div', 'att-empty');
      empty.textContent = t('attNoRecords');
      wrap.appendChild(empty);
      return wrap;
    }

    // Sort months descending (most recent first)
    const sortedMonths = [...monthsWithRecords].sort((a,b) => b - a);

    sortedMonths.forEach(month => {
      const monthRecords = yearRecords
        .filter(r => r.date && parseInt(String(r.date).slice(5,7)) === month)
        .sort((a,b) => b.date.localeCompare(a.date)); // newest first

      wrap.appendChild(renderAttMonth(month, monthRecords));
    });

    return wrap;
  }

  function renderAttMonth(month, records) {
    const isZh = (typeof currentLang !== 'undefined') && currentLang === 'zh';

    // Monthly totals per type
    const totals = { annual: 0, comp: 0, personal: 0, sick: 0 };
    records.forEach(r => { if (totals[r.type] !== undefined) totals[r.type] += r.hours; });

    // Summary string for collapsed header
    const summaryParts = ATT_TYPES
      .filter(type => totals[type] > 0)
      .map(type => `${t(ATT_TYPE_CFG[type].key)} ${totals[type]}${t('attHours')}`);

    const monthNames = isZh
      ? ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
      : ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

    const section = attEl('div', 'att-month-section');

    // Month header (always visible)
    const header = attEl('div', 'att-month-header');

    const monthLabel = attEl('span', 'att-month-label');
    monthLabel.textContent = monthNames[month - 1];
    header.appendChild(monthLabel);

    const monthSummary = attEl('span', 'att-month-summary');
    monthSummary.textContent = summaryParts.length > 0 ? summaryParts.join('  ·  ') : '—';
    header.appendChild(monthSummary);

    section.appendChild(header);

    // Records
    if (records.length === 0) {
      const empty = attEl('div', 'att-month-empty');
      empty.textContent = t('attNoRecords');
      section.appendChild(empty);
    } else {
      const list = attEl('div', 'att-record-list');
      records.forEach(r => list.appendChild(renderAttRecord(r)));
      section.appendChild(list);
    }

    return section;
  }

  function renderAttRecord(record) {
    const cfg  = ATT_TYPE_CFG[record.type] || ATT_TYPE_CFG.annual;
    const date = new Date(record.date + 'T12:00:00'); // avoid UTC offset issues
    const isZh = (typeof currentLang !== 'undefined') && currentLang === 'zh';
    const dow  = isZh ? `（${WEEKDAYS_ZH[date.getDay()]}）` : ` ${WEEKDAYS_EN[date.getDay()]}`;

    const row = attEl('div', 'att-record-row');
    row.style.setProperty('--att-color', cfg.color);

    // Date + weekday
    const dateEl = attEl('span', 'att-record-date');
    const mm = String(date.getMonth()+1).padStart(2,'0');
    const dd = String(date.getDate()).padStart(2,'0');
    dateEl.textContent = `${mm}/${dd}${dow}`;
    row.appendChild(dateEl);

    // Type pill
    const typePill = attEl('span', 'att-record-type');
    typePill.textContent = t(cfg.key);
    row.appendChild(typePill);

    // Hours
    const hoursEl = attEl('span', 'att-record-hours');
    hoursEl.textContent = record.hours + t('attHours');
    row.appendChild(hoursEl);

    // Notes
    if (record.notes && record.notes.trim()) {
      const notesEl = attEl('span', 'att-record-notes');
      notesEl.textContent = record.notes.trim();
      row.appendChild(notesEl);
    }

    // Edit button
    const editBtn = attEl('button', 'att-record-edit-btn');
    editBtn.textContent = t('projEdit');
    editBtn.onclick = e => { e.stopPropagation(); openAttModal(record); };
    row.appendChild(editBtn);

    return row;
  }

  // ── Quota helper ──────────────────────────────────────────────────────────

  function attGetQuota(year) {
    const q = attQuotas.find(q => String(q.year) === String(year));
    return {
      annual: parseFloat(q?.annual_leave_quota)   || 0,
      comp:   parseFloat(q?.comp_leave_balance)   || 0,
    };
  }

  // ── Record modal ──────────────────────────────────────────────────────────

  function openAttModal(record) {
    const isNew = !record;
    const overlay = attMakeOverlay();
    const card = attEl('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-orange)';

    const head = attEl('div', 'alert-head');
    head.style.background = 'var(--lcars-orange)';
    head.innerHTML = `<span class="alert-head-title"><svg class="alert-head-icon"><use href="#i-missions"/></svg>${isNew ? t('attAddTitle') : t('attEditTitle')}</span>`;
    card.appendChild(head);

    const body = attEl('div', 'alert-body proj-modal-body');

    // Date
    const today = new Date().toISOString().slice(0,10);
    body.appendChild(attField(t('attFieldDate'),
      `<input class="proj-modal-input" id="am-date" type="date"
              value="${record?.date ? record.date.slice(0,10) : today}">`));

    // Type + Hours row
    const row = attEl('div', 'proj-modal-row');
    row.innerHTML = `
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('attFieldType')}</label>
        <select class="proj-modal-select" id="am-type">
          ${ATT_TYPES.map(tp =>
            `<option value="${tp}" ${(record?.type||'annual')===tp?'selected':''}>${t(ATT_TYPE_CFG[tp].key)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('attFieldHours')}</label>
        <input class="proj-modal-input" id="am-hours" type="number"
               min="0.5" max="24" step="0.5"
               value="${record?.hours || 8}">
      </div>`;
    body.appendChild(row);

    // Notes
    body.appendChild(attField(t('attFieldNotes'),
      `<input class="proj-modal-input" id="am-notes" type="text"
              placeholder="${t('attFieldNotesPH')}"
              value="${attEsc(record?.notes||'')}">`));

    card.appendChild(body);

    const footer = attEl('div', 'alert-footer confirm');

    if (!isNew) {
      const delBtn = attMakeBtn(t('libDelete'), 'var(--lcars-rust)', async () => {
        const confirmed = await lcarsConfirm({
          title:   t('attConfirmDeleteTitle'),
          body:    t('attConfirmDelete'),
          okLabel: t('libDelete'),
          danger:  true,
        });
        if (!confirmed) return;
        attCloseOverlay(overlay);
        await deleteAttRecord(record);
      });
      footer.appendChild(delBtn);
    } else { footer.appendChild(attEl('span')); }

    const btnRow = attEl('div'); btnRow.style.cssText = 'display:flex;gap:8px';
    btnRow.appendChild(attMakeBtn(t('libCancel'), 'var(--lcars-frame)', () => attCloseOverlay(overlay), 'var(--lcars-cream)'));

    const saveBtn = attMakeBtn(t('libSave'), 'var(--lcars-orange)', async () => {
      const date  = attV('am-date');
      const hours = parseFloat(attV('am-hours'));
      const hoursValid = !isNaN(hours) && hours >= 0.5 && Math.round(hours * 2) === hours * 2;
      if (!date || !hoursValid) {
        document.getElementById('am-date')?.classList.add('invalid');
        return;
      }
      saveBtn.style.minWidth = saveBtn.offsetWidth + 'px';
      saveBtn.disabled = true; saveBtn.textContent = '…';
      const payload = { date, type: attV('am-type'), hours, notes: attV('am-notes') };
      try {
        if (isNew) await attPost({ action: 'add_record',    ...payload });
        else       await attPost({ action: 'update_record', id: record.id, ...payload });
        attCloseOverlay(overlay);
        await fetchAttendance();
        attToast(isNew ? t('attSaved') : t('attUpdated'));
      } catch(e) {
        saveBtn.disabled = false; saveBtn.textContent = t('libSave');
        attToast(t('attSaveFailed'), 'error');
      }
    });
    btnRow.appendChild(saveBtn);
    footer.appendChild(btnRow);
    card.appendChild(footer);

    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
    setTimeout(() => document.getElementById('am-date')?.focus(), 60);
  }

  // ── Settings modal (quota + comp balance) ─────────────────────────────────

  function openAttSettingsModal() {
    const quota = attGetQuota(attYear);
    const overlay = attMakeOverlay();
    const card = attEl('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-gold)';

    const head = attEl('div', 'alert-head');
    head.style.background = 'var(--lcars-gold)';
    head.innerHTML = `<span class="alert-head-title" style="color:var(--lcars-bg)"><svg class="alert-head-icon"><use href="#i-missions"/></svg>${attYear} · ${t('attSetQuota')}</span>`;
    card.appendChild(head);

    const body = attEl('div', 'alert-body proj-modal-body');

    body.appendChild(attField(t('attQuotaLabel'),
      `<input class="proj-modal-input" id="as-quota" type="number" min="0" step="1"
              value="${quota.annual}" placeholder="40">`));

    body.appendChild(attField(t('attCompLabel'),
      `<input class="proj-modal-input" id="as-comp" type="number" min="0" step="0.5"
              value="${quota.comp}" placeholder="0">`));

    card.appendChild(body);

    const footer = attEl('div', 'alert-footer confirm');
    footer.appendChild(attEl('span'));
    const btnRow = attEl('div'); btnRow.style.cssText = 'display:flex;gap:8px';
    btnRow.appendChild(attMakeBtn(t('libCancel'), 'var(--lcars-frame)', () => attCloseOverlay(overlay), 'var(--lcars-cream)'));

    const saveBtn = attMakeBtn(t('libSave'), 'var(--lcars-gold)', async () => {
      const quotaVal = parseFloat(attV('as-quota'));
      const compVal  = parseFloat(attV('as-comp'));
      if (isNaN(quotaVal) || isNaN(compVal)) return;
      saveBtn.style.minWidth = saveBtn.offsetWidth + 'px';
      saveBtn.disabled = true; saveBtn.textContent = '…';
      try {
        await attPost({ action: 'set_quota', year: attYear, annual_leave_quota: quotaVal });
        await attPost({ action: 'set_comp_balance', year: attYear, comp_leave_balance: compVal });
        attCloseOverlay(overlay);
        await fetchAttendance();
        attToast(t('attUpdated'));
      } catch(e) {
        saveBtn.disabled = false; saveBtn.textContent = t('libSave');
        attToast(t('attSaveFailed'), 'error');
      }
    });
    saveBtn.style.color = 'var(--lcars-bg)';
    btnRow.appendChild(saveBtn);
    footer.appendChild(btnRow);
    card.appendChild(footer);

    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
    setTimeout(() => document.getElementById('as-quota')?.focus(), 60);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteAttRecord(record) {
    attRecords = attRecords.filter(r => r.id !== record.id);
    cacheSet(ATT_REC_CACHE, attRecords);
    renderAttPage();
    try {
      await attPost({ action: 'delete_record', id: record.id });
      attToast(t('attDeleted'));
    } catch(e) {
      attToast(t('attSaveFailed'), 'error');
      await fetchAttendance();
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function attToast(msg, type='ok') {
    document.getElementById('att-toast')?.remove();
    const toast = attEl('div', 'proj-toast' + (type==='error'?' error':''));
    toast.id = 'att-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(()=>toast.remove(),300); }, 2200);
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  function attToDH(hours) {
    const h = parseFloat(hours) || 0;
    if (h === 0) return '';
    const days = Math.floor(h / 8);
    const rem  = h % 8;
    if (days === 0) return `${rem}h`;
    if (rem  === 0) return `${days}d`;
    return `${days}d ${rem}h`;
  }

  function attParseDate(raw) {
    // Handles both 'YYYY-MM-DD' and 'Mon Jan 05 2026 00:00:00 GMT+...' formats
    if (!raw) return '';
    const s = String(raw);
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // Date string like 'Mon Jan 05 2026 ...' — parse and reformat
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y  = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return y + '-' + mo + '-' + dy;
    }
    return s.slice(0, 10);
  }

  function attEl(tag, cls) { const e = document.createElement(tag); if(cls) e.className=cls; return e; }
  function attV(id) { return document.getElementById(id)?.value?.trim() || ''; }
  function attEsc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function attField(label, html) { const w=attEl('div','proj-modal-field'); w.innerHTML=`<label class="proj-modal-label">${label}</label>${html}`; return w; }
  function attMakeBtn(label, bg, onclick, color) {
    const b = attEl('button','alert-ok');
    b.style.background=bg; if(color) b.style.color=color;
    b.textContent=label; b.onclick=onclick; return b;
  }
  function attMakeOverlay() {
    const ov = attEl('div','alert-overlay'); ov.style.zIndex='10001';
    const stack = attEl('div','alert-stack'); stack.style.maxWidth='420px';
    ov.appendChild(stack);
    ov.addEventListener('click', e => { if(e.target===ov) attCloseOverlay(ov); });
    return ov;
  }
  function attCloseOverlay(el) { closeOverlay(el); }

  // ── Init ──────────────────────────────────────────────────────────────────

  function initAttendance() {
    attRecords = (cacheGet(ATT_REC_CACHE)||[]).map(r=>({...r,hours:parseFloat(r.hours)||0,date:attParseDate(r.date)}));
    attQuotas  = cacheGet(ATT_QUO_CACHE)||[];
    window.openAttModal = openAttModal;
  }

  window.fetchAttendance = fetchAttendance;
  window.initAttendance  = initAttendance;
  window.openAttModal    = openAttModal;
