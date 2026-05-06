// js/notes.js — Personal note cards (localStorage)

  /* ============================================================
     NOTES — personal note cards stored in localStorage
     ============================================================ */
  const NOTES_KEY = 'lcars_notes_v1';
  let notesCache = [];

  function loadNotes() {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveNotes() {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notesCache));
    } catch (e) { /* quota or disabled — silently ignore */ }
  }

  // Format an epoch ms into a compact stamp: 2026.05.04 / 14:23
  function formatNoteStamp(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate())
      + ' / ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // Auto-grow a textarea to fit its content
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function updateNotesCount() {
    const el = document.getElementById('notes-count');
    if (el) el.textContent = String(notesCache.length).padStart(2, '0');
  }

  // Available color slots — keys must match the .color-* CSS classes
  const NOTE_COLORS = ['gold', 'orange', 'violet', 'blue', 'cream'];

  // Migrate any legacy notes that lack `order` or `color` fields.
  // Older notes get default color and an order derived from creation time
  // (newer = higher order, so they appear at the top).
  function migrateNotes() {
    let changed = false;
    notesCache.forEach(n => {
      if (typeof n.order !== 'number') { n.order = n.created || 0; changed = true; }
      if (!n.color) { n.color = 'gold'; changed = true; }
      if (n.remindAt === undefined) { n.remindAt = null; changed = true; }
      if (n.notified === undefined) { n.notified = false; changed = true; }
    });
    if (changed) saveNotes();
  }

  // Close any open popover (more menu + reminder panel)
  function closeAllPopovers() {
    document.querySelectorAll('.note-menu, .note-reminder-panel').forEach(p => p.remove());
  }

  // Sorted view of notes, highest order first
  function sortedNotes() {
    return notesCache.slice().sort((a, b) => (b.order || 0) - (a.order || 0));
  }

  /* ----- Drag & drop state (module-scoped so handlers can share it) ----- */
  let dragSourceId = null;

  function clearDropMarkers() {
    document.querySelectorAll('.note-card.drop-before, .note-card.drop-after')
      .forEach(c => c.classList.remove('drop-before', 'drop-after'));
  }

  function reorderNotes(sourceId, targetId, placeBefore) {
    if (sourceId === targetId) return;
    const sorted = sortedNotes();
    const ids = sorted.map(n => n.id);
    const from = ids.indexOf(sourceId);
    let to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    // Pull the source out, then insert relative to the target's NEW position
    ids.splice(from, 1);
    if (from < to) to--;          // target shifted left after removal
    if (!placeBefore) to++;       // insert after target
    ids.splice(to, 0, sourceId);
    // Re-stamp order: highest first → so we count down from a base.
    // Use spaced integers so future single-item moves don't have to renumber everything.
    const base = (ids.length + 1) * 1000;
    ids.forEach((id, i) => {
      const note = notesCache.find(n => n.id === id);
      if (note) note.order = base - i * 1000;
    });
    saveNotes();
    renderNotes();
  }

  // Position a fixed-positioned popover relative to an anchor element.
  // The popover is appended to <body> (not the anchor) so it escapes
  // any sidebar / grid stacking context that would otherwise clip it.
  // After mounting we measure the popover and clamp it inside the viewport.
  // opts.preferAbove — try placing the popover above the anchor first
  // (used by the reminder panel so the native datetime calendar picker,
  // which expands downward from the input, has room below).
  function positionPopoverBelow(popover, anchor, opts) {
    const gap = (opts && opts.gap) || 6;
    const pad = 8;  // viewport padding
    const preferAbove = !!(opts && opts.preferAbove);
    document.body.appendChild(popover);
    const a = anchor.getBoundingClientRect();
    const p = popover.getBoundingClientRect();

    // Default: align right edge of popover with right edge of anchor.
    let left = a.right - p.width;
    let top;

    if (preferAbove) {
      // Try above first; fall back below if there's no room
      const above = a.top - p.height - gap;
      if (above >= pad) {
        top = above;
      } else {
        top = a.bottom + gap;
      }
    } else {
      top = a.bottom + gap;
      // If below would overflow, flip above
      if (top + p.height > window.innerHeight - pad) {
        const above = a.top - p.height - gap;
        if (above >= pad) top = above;
      }
    }

    // Clamp horizontally so it doesn't fall off either side
    if (left < pad) left = pad;
    if (left + p.width > window.innerWidth - pad) {
      left = window.innerWidth - p.width - pad;
    }
    // Last-resort vertical clamp
    if (top < pad) top = pad;
    if (top + p.height > window.innerHeight - pad) {
      top = window.innerHeight - p.height - pad;
    }
    popover.style.left = left + 'px';
    popover.style.top  = top + 'px';
  }

  // Combined "more actions" menu: color picker row + DELETE button
  function buildMoreMenu(noteId, anchor) {
    closeAllPopovers();
    const note = notesCache.find(n => n.id === noteId);
    if (!note) return;
    const menu = document.createElement('div');
    menu.className = 'note-menu';
    menu.dataset.owner = noteId;
    menu.addEventListener('mousedown', e => e.stopPropagation());

    // Color section
    const colorLabel = document.createElement('div');
    colorLabel.className = 'note-menu-section-label';
    colorLabel.textContent = t('notesColorTip');

    const colorRow = document.createElement('div');
    colorRow.className = 'note-menu-colors';
    NOTE_COLORS.forEach(color => {
      const dot = document.createElement('button');
      dot.className = 'note-menu-dot dot-' + color;
      if (note.color === color) dot.classList.add('active');
      dot.title = color.toUpperCase();
      dot.addEventListener('click', (ev) => {
        ev.stopPropagation();
        note.color = color;
        saveNotes();
        renderNotes();
        beep(500);
      });
      colorRow.appendChild(dot);
    });

    const divider = document.createElement('div');
    divider.className = 'note-menu-divider';

    // Delete button — opens the LCARS confirm dialog instead of native confirm()
    const delBtn = document.createElement('button');
    delBtn.className = 'note-menu-delete';
    delBtn.textContent = t('notesDelete');
    delBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeAllPopovers();
      lcarsConfirm({
        title: t('notesConfirmDelTitle'),
        body: t('notesConfirmDel'),
        okLabel: t('notesConfirmYes'),
        cancelLabel: t('notesConfirmNo'),
        danger: true
      }).then(ok => {
        if (!ok) return;
        notesCache = notesCache.filter(n => n.id !== note.id);
        saveNotes();
        renderNotes();
      });
    });

    menu.appendChild(colorLabel);
    menu.appendChild(colorRow);
    menu.appendChild(divider);
    menu.appendChild(delBtn);
    positionPopoverBelow(menu, anchor);
  }

  /* ----- Reminder logic ------------------------------------------- */

  // Format the gap between now and a reminder time as a compact countdown.
  // > 1 day  -> "2D 4H"
  // > 1 hr   -> "3H 22M"
  // > 1 min  -> "45M"
  // <= 1 min -> "30S"
  function formatRemindCountdown(remindAt) {
    const ms = remindAt - Date.now();
    if (ms <= 0) return '0S';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins  = Math.floor((totalSec % 3600) / 60);
    const secs  = totalSec % 60;
    if (days > 0)  return days + 'D ' + hours + 'H';
    if (hours > 0) return hours + 'H ' + mins + 'M';
    if (mins > 0)  return mins + 'M';
    return secs + 'S';
  }

  // Format an absolute time for the "fired" badge: 5/10 14:00
  function formatFiredAt(remindAt) {
    const d = new Date(remindAt);
    const pad = n => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // Format a reminder time as a value for <input type="datetime-local">
  // (yyyy-mm-ddThh:mm in *local* time — the input is timezone-naive)
  function toDatetimeLocalValue(epochMs) {
    if (!epochMs) {
      // Default new reminder to "now + 1 hour", rounded to the next 5 minutes
      const d = new Date(Date.now() + 60 * 60 * 1000);
      d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
      epochMs = d.getTime();
    }
    const d = new Date(epochMs);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function buildReminderPanel(noteId, anchor) {
    closeAllPopovers();
    const note = notesCache.find(n => n.id === noteId);
    if (!note) return;
    const panel = document.createElement('div');
    panel.className = 'note-reminder-panel';
    panel.dataset.owner = noteId;
    panel.addEventListener('mousedown', e => e.stopPropagation());

    const head = document.createElement('div');
    head.className = 'note-reminder-head';
    head.textContent = t('notesReminderHead');

    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.className = 'note-reminder-input';
    input.value = toDatetimeLocalValue(note.remindAt);

    const actions = document.createElement('div');
    actions.className = 'note-reminder-actions';

    const setBtn = document.createElement('button');
    setBtn.className = 'note-reminder-btn';
    setBtn.textContent = t('notesReminderSet');
    setBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!input.value) return;
      // datetime-local is parsed as local time
      const ts = new Date(input.value).getTime();
      if (isNaN(ts)) return;
      note.remindAt = ts;
      // If user re-arms a previously-fired reminder for the future, reset notified
      note.notified = ts <= Date.now();
      saveNotes();
      // Closing the panel before re-render avoids a flicker where the old
      // panel briefly survives the renderNotes() DOM swap. Acts as the
      // "confirmed and exit" signal users were missing.
      closeAllPopovers();
      renderNotes();
      beep(560);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'note-reminder-btn secondary';
    clearBtn.textContent = t('notesReminderClear');
    clearBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      note.remindAt = null;
      note.notified = false;
      saveNotes();
      closeAllPopovers();
      renderNotes();
      beep(380);
    });

    actions.appendChild(setBtn);
    actions.appendChild(clearBtn);
    // Layout: HEAD → ACTIONS → INPUT.
    // The native datetime-local calendar picker drops *downward* from the
    // input, which would cover anything below it. Putting SET / CLEAR
    // above the input keeps them tappable while the picker is open.
    panel.appendChild(head);
    panel.appendChild(actions);
    panel.appendChild(input);
    positionPopoverBelow(panel, anchor, { preferAbove: true });

    // Focus the input so user can immediately type
    requestAnimationFrame(() => input.focus());
  }

  /* ----- Alert modal (LCARS-style in-page popup) ------------------ */
  const alertQueue = [];   // notes whose reminder has fired but not yet acknowledged

  function ensureAlertOverlay() {
    let overlay = document.getElementById('alert-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'alert-overlay';
      overlay.className = 'alert-overlay';
      const stack = document.createElement('div');
      stack.className = 'alert-stack';
      stack.id = 'alert-stack';
      overlay.appendChild(stack);
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function renderAlerts() {
    const overlay = document.getElementById('alert-overlay');
    if (alertQueue.length === 0) {
      if (overlay) overlay.remove();
      return;
    }
    const ov = ensureAlertOverlay();
    const stack = document.getElementById('alert-stack');
    stack.innerHTML = '';
    alertQueue.forEach(note => {
      const card = document.createElement('div');
      card.className = 'alert-card';

      const head = document.createElement('div');
      head.className = 'alert-head';
      const headTitle = document.createElement('span');
      headTitle.className = 'alert-head-title';
      // Bell icon + label, mirroring the same icon used on the note card
      headTitle.innerHTML = '<svg class="icon icon-md alert-head-icon"><use href="#i-bell"/></svg>'
        + '<span>' + escapeHtml(t('notesAlertTitle')) + '</span>';
      const stamp = document.createElement('span');
      stamp.className = 'alert-stamp';
      stamp.textContent = formatNoteStamp(note.remindAt || Date.now());
      head.appendChild(headTitle);
      head.appendChild(stamp);

      const body = document.createElement('div');
      body.className = 'alert-body';
      const text = (note.text || '').trim();
      if (text) {
        body.textContent = text;
      } else {
        body.classList.add('empty');
        body.textContent = t('notesNoText');
      }

      const footer = document.createElement('div');
      footer.className = 'alert-footer';
      const okBtn = document.createElement('button');
      okBtn.className = 'alert-ok';
      okBtn.textContent = t('notesAlertOk');
      okBtn.addEventListener('click', () => acknowledgeAlert(note.id));
      footer.appendChild(okBtn);

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
    });

    // Focus the topmost OK button so Enter / Space dismisses
    requestAnimationFrame(() => {
      const firstOk = stack.querySelector('.alert-ok');
      if (firstOk) firstOk.focus();
    });
  }

  function acknowledgeAlert(noteId) {
    const idx = alertQueue.findIndex(n => n.id === noteId);
    if (idx >= 0) alertQueue.splice(idx, 1);
    renderAlerts();
    beep(420);
  }

  /* ----- Generic LCARS-styled confirm dialog ---------------------
     Replaces the browser's native confirm() so destructive actions
     match the rest of the UI. Returns a promise that resolves to
     true (confirmed) or false (canceled).
     Usage:
       lcarsConfirm({ title: '…', body: '…', danger: true })
         .then(ok => { if (ok) doIt(); });
  ----------------------------------------------------------------- */
  // LCARS-styled text prompt — replaces native prompt() so user input
  // (e.g. naming a finance tab) feels native to the rest of the UI.
  // Resolves with the trimmed string the user entered, or null on cancel.
  function lcarsPrompt(opts) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      // Sit above any other overlay currently mounted (same logic as
      // lcarsConfirm — see comments there).
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
      card.className = 'alert-card confirm';

      const head = document.createElement('div');
      head.className = 'alert-head';
      const headTitle = document.createElement('span');
      headTitle.textContent = opts.title || 'INPUT';
      head.appendChild(headTitle);

      const body = document.createElement('div');
      body.className = 'alert-body';
      // Override the global pre-wrap so labels + input lay out cleanly
      body.style.whiteSpace = 'normal';
      body.style.padding = '20px 24px';

      if (opts.label) {
        const lbl = document.createElement('div');
        lbl.className = 'lib-form-label';
        lbl.style.marginBottom = '8px';
        lbl.textContent = opts.label;
        body.appendChild(lbl);
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'lib-form-input';
      input.style.width = '100%';
      input.value = opts.defaultValue || '';
      if (opts.placeholder) input.placeholder = opts.placeholder;
      body.appendChild(input);

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = opts.cancelLabel || t('libCancel');

      const okBtn = document.createElement('button');
      okBtn.className = 'alert-ok';
      okBtn.style.background = 'var(--lcars-cream)';
      okBtn.style.color = 'var(--lcars-bg)';
      okBtn.textContent = opts.okLabel || t('libSave');

      const finish = (result) => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        beep(result === null ? 380 : 540);
        resolve(result);
      };
      const onKey = (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); finish(null); }
        else if (ev.key === 'Enter') { ev.stopPropagation(); finish(input.value); }
      };

      cancelBtn.addEventListener('click', () => finish(null));
      okBtn.addEventListener('click', () => finish(input.value));
      overlay.addEventListener('click', ev => {
        if (ev.target === overlay) finish(null);
      });
      document.addEventListener('keydown', onKey);

      footer.appendChild(cancelBtn);
      footer.appendChild(okBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      document.body.appendChild(overlay);

      // Focus + select existing text so users can immediately overwrite or
      // edit. Microtask timing matters — the input must be in the DOM first.
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    });
  }

  function lcarsConfirm(opts) {
    return new Promise(resolve => {
      // Confirm dialogs use their own overlay so they stack correctly
      // alongside any active reminder alerts. Dynamically pick a z-index
      // that's higher than any other overlay currently mounted, so when
      // confirm() is called from inside another modal (e.g. the episode
      // editor sits at z=10001) the confirm dialog renders ON TOP of it
      // and stays clickable.
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
      card.className = 'alert-card confirm';

      const head = document.createElement('div');
      head.className = 'alert-head';
      const headTitle = document.createElement('span');
      headTitle.textContent = opts.title || 'CONFIRM';
      head.appendChild(headTitle);

      const body = document.createElement('div');
      body.className = 'alert-body';
      body.textContent = opts.body || '';

      const footer = document.createElement('div');
      footer.className = 'alert-footer confirm';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'alert-ok';
      cancelBtn.textContent = opts.cancelLabel || t('notesConfirmNo');

      const okBtn = document.createElement('button');
      okBtn.className = 'alert-ok' + (opts.danger ? ' danger' : '');
      okBtn.textContent = opts.okLabel || t('notesConfirmYes');

      const finish = (result) => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        beep(result ? 540 : 380);
        resolve(result);
      };
      const onKey = (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); finish(false); }
        else if (ev.key === 'Enter') { ev.stopPropagation(); finish(true); }
      };

      cancelBtn.addEventListener('click', () => finish(false));
      okBtn.addEventListener('click', () => finish(true));
      // Click on backdrop = cancel (only when clicking the overlay itself,
      // not when bubbling from the card)
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) finish(false);
      });
      document.addEventListener('keydown', onKey);

      // Pass cancelLabel: '' (empty string) to render a single-button info
      // dialog. The OK button still acknowledges; backdrop / Esc still close.
      const singleButton = (opts.cancelLabel === '');
      if (!singleButton) footer.appendChild(cancelBtn);
      footer.appendChild(okBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(footer);
      stack.appendChild(card);
      document.body.appendChild(overlay);

      // Focus the OK button so Enter accepts. For destructive actions,
      // focusing cancel would be safer — but Enter is also bound to OK
      // above, so we keep visual focus on the action the user came for.
      requestAnimationFrame(() => okBtn.focus());
    });
  }

  // Three-tone alert sequence — more attention-grabbing than a single beep
  function playAlertChime() {
    beep(660);
    setTimeout(() => beep(660), 180);
    setTimeout(() => beep(880), 360);
  }

  // Scan all notes for reminders that have just elapsed.
  // Fires the alert modal for each newly-due reminder (in chronological order).
  function scanReminders() {
    const now = Date.now();
    let firedAny = false;
    // Sort by remindAt so multiple due reminders queue oldest-first
    const due = notesCache
      .filter(n => n.remindAt && !n.notified && n.remindAt <= now)
      .sort((a, b) => a.remindAt - b.remindAt);
    due.forEach(n => {
      n.notified = true;
      // Avoid duplicating an alert if scanReminders runs while one is already queued
      if (!alertQueue.find(q => q.id === n.id)) alertQueue.push(n);
      firedAny = true;
    });
    if (firedAny) {
      saveNotes();
      renderAlerts();
      playAlertChime();
      // Refresh the cards so their meta row flips to "✓ NOTIFIED"
      renderNotes();
    }
  }

  // Update only the live countdown text without re-rendering the entire list
  // (a full re-render every second would steal focus from any open textarea).
  function tickReminderCountdowns() {
    const now = Date.now();
    document.querySelectorAll('.note-card').forEach(card => {
      const id = card.dataset.id;
      const note = notesCache.find(n => n.id === id);
      if (!note || !note.remindAt || note.notified) return;
      const span = card.querySelector('.note-reminder-status');
      if (span) {
        // Monochrome inline SVG stopwatch — picks up currentColor via the
        // .note-card colour scheme so it stays single-colour like every
        // other LCARS icon. Stopwatch reads as "countdown" more clearly
        // than the bell, which is reused for the bell-button trigger.
        span.innerHTML =
          '<svg class="icon icon-sm note-reminder-icon"><use href="#i-timer"/></svg>'
          + escapeHtml(formatRemindCountdown(note.remindAt));
      }
      // If this tick crossed the deadline, scanReminders will catch it on its
      // own 30s schedule. Trigger immediately for a snappier response:
      if (note.remindAt <= now) scanReminders();
    });
  }

  function renderNotes() {
    const list = document.getElementById('notes-list');
    if (!list) return;
    list.innerHTML = '';
    closeAllPopovers();

    if (notesCache.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notes-empty';
      empty.setAttribute('data-i18n', 'notesEmpty');
      empty.textContent = t('notesEmpty');
      list.appendChild(empty);
      updateNotesCount();
      return;
    }

    sortedNotes().forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card color-' + (note.color || 'gold');
      card.dataset.id = note.id;
      card.draggable = true;

      // ----- Drag handlers -----
      card.addEventListener('dragstart', (ev) => {
        // Don't initiate card drag when starting from inside the textarea —
        // the textarea has its own native text-selection drag behaviour.
        if (ev.target.classList.contains('note-text')) {
          ev.preventDefault();
          return;
        }
        dragSourceId = note.id;
        card.classList.add('dragging');
        try {
          ev.dataTransfer.effectAllowed = 'move';
          // Some browsers refuse the drag without setData
          ev.dataTransfer.setData('text/plain', note.id);
        } catch(e) {}
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        clearDropMarkers();
        dragSourceId = null;
      });
      card.addEventListener('dragover', (ev) => {
        if (!dragSourceId || dragSourceId === note.id) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        const rect = card.getBoundingClientRect();
        const before = (ev.clientY - rect.top) < rect.height / 2;
        clearDropMarkers();
        card.classList.add(before ? 'drop-before' : 'drop-after');
      });
      card.addEventListener('dragleave', (ev) => {
        // Only clear if leaving the card entirely (not crossing into a child)
        if (!card.contains(ev.relatedTarget)) {
          card.classList.remove('drop-before', 'drop-after');
        }
      });
      card.addEventListener('drop', (ev) => {
        if (!dragSourceId || dragSourceId === note.id) return;
        ev.preventDefault();
        const rect = card.getBoundingClientRect();
        const before = (ev.clientY - rect.top) < rect.height / 2;
        const sourceId = dragSourceId;
        clearDropMarkers();
        reorderNotes(sourceId, note.id, before);
        beep(440);
      });

      // ----- Meta row: stamp/reminder-status + actions -----
      const meta = document.createElement('div');
      meta.className = 'note-meta';

      const stamp = document.createElement('span');
      // If the note has an active reminder, show the countdown / fired status
      // in place of the creation stamp. Otherwise show creation time.
      if (note.remindAt) {
        stamp.className = 'note-reminder-status' + (note.notified ? ' fired' : '');
        if (note.notified) {
          stamp.textContent = t('notesReminderFired') + ' · ' + formatFiredAt(note.remindAt);
        } else {
          // Inline SVG stopwatch — single-colour (inherits currentColor)
          // and reads as "countdown" more clearly than a bell.
          stamp.innerHTML =
            '<svg class="icon icon-sm note-reminder-icon"><use href="#i-timer"/></svg>'
            + escapeHtml(formatRemindCountdown(note.remindAt));
        }
      } else {
        stamp.className = 'note-stamp';
        stamp.textContent = formatNoteStamp(note.created);
      }

      const actions = document.createElement('div');
      actions.className = 'note-actions';

      // Bell — opens the reminder set/clear panel
      const bell = document.createElement('button');
      bell.className = 'note-bell'
        + (note.remindAt && !note.notified ? ' active' : '')
        + (note.notified ? ' fired' : '');
      bell.title = t('notesReminderTip');
      bell.setAttribute('data-i18n-title', 'notesReminderTip');
      bell.innerHTML = '<svg class="icon icon-sm"><use href="#i-bell"/></svg>';
      bell.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // Popovers live on <body> (not inside actions), so look them up globally.
        // Each popover is tagged with the owning note's id for correct toggling.
        const existing = document.querySelector('.note-reminder-panel[data-owner="' + note.id + '"]');
        if (existing) { closeAllPopovers(); return; }
        buildReminderPanel(note.id, bell);
      });
      bell.addEventListener('mousedown', e => e.stopPropagation());

      // Three-dot menu — combines color picker + delete in one popover
      const more = document.createElement('button');
      more.className = 'note-more';
      more.title = t('notesMoreTip');
      more.setAttribute('data-i18n-title', 'notesMoreTip');
      more.innerHTML = '<svg class="icon icon-sm"><use href="#i-more"/></svg>';
      more.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const existing = document.querySelector('.note-menu[data-owner="' + note.id + '"]');
        if (existing) { closeAllPopovers(); return; }
        buildMoreMenu(note.id, more);
      });
      more.addEventListener('mousedown', e => e.stopPropagation());

      actions.appendChild(bell);
      actions.appendChild(more);

      meta.appendChild(stamp);
      meta.appendChild(actions);

      // ----- Body: the textarea -----
      const ta = document.createElement('textarea');
      ta.className = 'note-text';
      ta.value = note.text || '';
      ta.setAttribute('data-i18n-placeholder', 'notesPlaceholder');
      ta.placeholder = t('notesPlaceholder');
      ta.rows = 1;
      ta.draggable = false;
      ta.addEventListener('input', () => {
        autoGrow(ta);
        const target = notesCache.find(n => n.id === note.id);
        if (target) {
          target.text = ta.value;
          saveNotes();
        }
      });

      card.appendChild(meta);
      card.appendChild(ta);
      list.appendChild(card);

      // Size after insertion (scrollHeight needs the element to be in the DOM)
      autoGrow(ta);
    });

    updateNotesCount();
  }

  function addNote() {
    // Place new notes at the top → highest order so far +1000
    const maxOrder = notesCache.reduce((m, n) => Math.max(m, n.order || 0), 0);
    // Cycle through the LCARS palette so consecutive notes don't all look
    // the same. Start with gold; for each subsequent note, advance one slot
    // past the most recently created note's color.
    let nextColor = NOTE_COLORS[0];
    if (notesCache.length > 0) {
      const newest = notesCache.reduce((a, b) => (a.created > b.created ? a : b));
      const idx = NOTE_COLORS.indexOf(newest.color);
      nextColor = NOTE_COLORS[(idx + 1) % NOTE_COLORS.length];
    }
    const newNote = {
      id: 'n' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      text: '',
      created: Date.now(),
      color: nextColor,
      order: maxOrder + 1000,
      remindAt: null,
      notified: false
    };
    notesCache.push(newNote);
    saveNotes();
    renderNotes();
    beep(620);

    // Focus the new note's textarea (it'll be at the top — highest order first)
    requestAnimationFrame(() => {
      const list = document.getElementById('notes-list');
      const first = list && list.querySelector('.note-card .note-text');
      if (first) first.focus();
    });
  }

  function initNotes() {
    notesCache = loadNotes();
    migrateNotes();
    renderNotes();
    const addBtn = document.getElementById('notes-add');
    if (addBtn) addBtn.addEventListener('click', addNote);
    // Close popovers when clicking anywhere outside their UI
    document.addEventListener('click', (ev) => {
      if (ev.target.closest('.note-menu, .note-more, .note-reminder-panel, .note-bell')) return;
      closeAllPopovers();
    });
    // ESC closes any open color/reminder popover (but NOT alert modals —
    // those require manual acknowledgement)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !document.getElementById('alert-overlay')) {
        closeAllPopovers();
      }
    });
    // Popovers are position:fixed and won't follow their anchor on scroll
    // or resize — close them rather than letting them drift out of place.
    window.addEventListener('resize', closeAllPopovers);
    const notesList = document.getElementById('notes-list');
    if (notesList) notesList.addEventListener('scroll', closeAllPopovers);

    // Catch any reminders that were already overdue when the page loaded
    scanReminders();
    // Then scan periodically. 30s is fine — countdown text updates every 1s
    // via tickReminderCountdowns, which also triggers an immediate scan
    // when it crosses the deadline so users never wait the full 30s.
    setInterval(scanReminders, 30000);
    setInterval(tickReminderCountdowns, 1000);
  }


