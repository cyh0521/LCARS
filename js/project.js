// js/project.js — Mission Operations · Project / Milestone / Task Tracker
// Three-tier model: Project → Milestone (項目) → Task
// API mirrors library.js: Apps Script backend, action-based POST, local cache.

/* ============================================================
   DATA MODEL
   Projects:   { id, title, color, created_at }
   Milestones: { id, project_id, title, order, created_at }
   Tasks:      { id, milestone_id, project_id, title, status,
                 priority, due_date, tags, notes, created_at, updated_at }
   Templates:  { id, name, tasks_json }

   Status:   'TODO' | 'IN PROGRESS' | 'DONE'
   Priority: 1=LOW  2=NORMAL  3=HIGH  4=CRITICAL
   ============================================================ */

  const PROJECT_API_URL = 'https://script.google.com/macros/s/AKfycbwSzvyUEt88cp-uWU6u60OvCColLCl28bJKwEf_Y_rJ5rw8TRmDGvRXNuG4as3Vg-gy/exec';

  // ── Cache keys ────────────────────────────────────────────────────────────
  const PROJ_CACHE_KEY  = 'lcars_proj_v2_projects';
  const MS_CACHE_KEY    = 'lcars_proj_v2_milestones';
  const TASK_CACHE_KEY  = 'lcars_proj_v2_tasks';
  const TMPL_CACHE_KEY  = 'lcars_proj_v2_templates';

  // ── Local state ───────────────────────────────────────────────────────────
  let projProjects   = [];
  let projMilestones = [];
  let projTasks      = [];
  let projTemplates  = [];
  let projLoading    = false;
  let projError      = null;

  // UI state
  let projActiveProjectId   = null;   // which project is expanded
  let projActiveMilestoneId = null;   // which milestone's Kanban is shown
  let projSortMode          = 'priority'; // 'priority' | 'due' | 'created'

  // ── Config ────────────────────────────────────────────────────────────────
  const STATUS_CFG = {
    'TODO':        { icon: '◉', color: 'var(--lcars-blue)',   next: 'IN PROGRESS' },
    'IN PROGRESS': { icon: '▶', color: 'var(--lcars-orange)', next: 'DONE'        },
    'DONE':        { icon: '✓', color: '#2ecfb0',             next: null          },
  };

  const PRIORITY_CFG = {
    1: { dot: '■', color: '#4a6080' },   /* muted blue-grey — LOW    */
    2: { dot: '■', color: '#7a9bd6' },   /* blue            — NORMAL */
    3: { dot: '■', color: '#d4a23a' },   /* gold            — HIGH   */
    4: { dot: '■', color: '#cc6666' },   /* red             — CRITICAL */
  };

  const PROJ_COLORS = [
    'var(--lcars-orange)', 'var(--lcars-violet)', 'var(--lcars-blue)',
    'var(--lcars-gold)',   '#2ecfb0',              'var(--lcars-rust)',
  ];

  // ── API helpers ───────────────────────────────────────────────────────────

  function projUnwrap(payload) {
    if (payload && typeof payload === 'object' && 'ok' in payload) {
      if (!payload.ok) throw new Error(payload.error || 'API error');
      return payload.data;
    }
    return payload;
  }

  async function projGet(params = {}) {
    const url = new URL(PROJECT_API_URL);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return projUnwrap(await res.json());
  }

  async function projPost(body) {
    const res = await fetch(PROJECT_API_URL, {
      method:  'POST',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return projUnwrap(await res.json());
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function fetchProject() {
    projLoading = true;
    projError   = null;
    renderProjPage();
    try {
      const data = await projGet({ sheet: 'all' });
      projProjects   = Array.isArray(data.projects)   ? data.projects   : [];
      projMilestones = Array.isArray(data.milestones) ? data.milestones : [];
      projTasks      = Array.isArray(data.tasks)      ? data.tasks      : [];
      projTemplates  = Array.isArray(data.templates)  ? data.templates  : [];
      // normalise priority to number
      projTasks = projTasks.map(t => ({ ...t, priority: parseInt(t.priority) || 2 }));
      // sort milestones by order
      projMilestones.sort((a,b) => (parseInt(a.order)||0) - (parseInt(b.order)||0));
      cacheSet(PROJ_CACHE_KEY, projProjects);
      cacheSet(MS_CACHE_KEY,   projMilestones);
      cacheSet(TASK_CACHE_KEY, projTasks);
      cacheSet(TMPL_CACHE_KEY, projTemplates);
      projError = null;
    } catch(e) {
      console.warn('[LCARS PROJECT] Fetch failed:', e);
      projError = e.message;
      // fall back to cache
      projProjects   = cacheGet(PROJ_CACHE_KEY)  || [];
      projMilestones = cacheGet(MS_CACHE_KEY)    || [];
      projTasks      = (cacheGet(TASK_CACHE_KEY) || []).map(t => ({ ...t, priority: parseInt(t.priority)||2 }));
      projTemplates  = cacheGet(TMPL_CACHE_KEY)  || [];
    }
    projLoading = false;
    renderProjPage();
  }
  window.fetchProject = fetchProject;

  // ── Top-level render ──────────────────────────────────────────────────────

  function renderProjPage() {
    const root = document.getElementById('proj-root');
    if (!root) return;
    root.innerHTML = '';

    if (projLoading && projProjects.length === 0) {
      root.innerHTML = '<div class="proj-loading" data-i18n="loadingMsg">LOADING…</div>';
      return;
    }

    if (projError) {
      const banner = el('div', 'proj-error-banner');
      banner.innerHTML = `⚠ ${t('projOffline')} `;
      const retryBtn = el('button');
      retryBtn.textContent = t('libRetry');
      retryBtn.onclick = fetchProject;
      banner.appendChild(retryBtn);
      root.appendChild(banner);
    }

    root.appendChild(renderProgressOverview());
  }

  let projProgressFilter = 'all';
  let projDetailId = null;
  let projSelectedItemId = null;
  let projOverviewPosition = [];
  let projOverviewFocusId = null;

  function navigateProjectDetail(id) {
    if (id) {
      projOverviewFocusId = id;
      projOverviewPosition = [document.scrollingElement, ...document.querySelectorAll('main, .main, .workspace, .main-content')]
        .filter(Boolean).map(node => [node, node.scrollTop]);
    }
    projDetailId = id;
    renderProjPage();
    if (id) {
      document.querySelector('.progress-back')?.focus({preventScroll:true});
      projOverviewPosition.forEach(([node]) => { node.scrollTop = 0; });
    } else {
      const target = Array.from(document.querySelectorAll('.progress-project-toggle'))
        .find(button => button.dataset.projectId === String(projOverviewFocusId));
      target?.focus({preventScroll:true});
      projOverviewPosition.forEach(([node, top]) => { node.scrollTop = top; });
    }
  }
  const projCopy = (zh, en) => currentLang === 'zh' ? zh : en;

  function projTaskStats(tasks) {
    const today = new Date(); today.setHours(0,0,0,0);
    const pending = tasks.filter(task => task.status !== 'DONE');
    const dates = pending.map(task => task.due_date).filter(Boolean).sort();
    return {
      total: tasks.length,
      done: tasks.length - pending.length,
      active: pending.filter(task => task.status === 'IN PROGRESS').length,
      overdue: pending.filter(task => task.due_date && new Date(task.due_date) < today).length,
      next: dates[0],
    };
  }

  function projProgressButton(label, action, className = '') {
    const button = el('button', 'progress-button ' + className);
    button.type = 'button'; button.textContent = label; button.onclick = action;
    return button;
  }

  function updateProjectAddButton() {
    const button = document.querySelector('.project-add-control button');
    if (!button) return;
    const key = projDetailId ? 'projAddMilestone' : 'projAddProject';
    button.setAttribute('data-i18n-title', key);
    button.setAttribute('data-i18n-aria', key);
    button.title = t(key);
    button.setAttribute('aria-label', t(key));
  }

  function projectAddClick() {
    const project = projProjects.find(proj => proj.id === projDetailId);
    if (project) openMilestoneModal(null, project);
    else openProjectModal(null);
  }
  window.projectAddClick = projectAddClick;

  function renderProgressOverview() {
    if (projDetailId && !projProjects.some(proj => proj.id === projDetailId)) projDetailId = null;
    const detail = projDetailId !== null;
    updateProjectAddButton();
    const wrap = el('div', 'progress-overview' + (detail ? ' progress-detail' : ''));
    if (detail) wrap.appendChild(projProgressButton(projCopy('← 所有專案', '← All projects'), () => navigateProjectDetail(null), 'progress-back'));
    const filters = el('div', 'lib-filter-bar progress-filters');
    const options = [['all', projCopy('全部','All')], ['active',projCopy('進行中','In progress')], ['overdue',projCopy('逾期','Overdue')], ['done',projCopy('已完成','Completed')]];
    options.forEach(([key,label]) => {
      const button = el('button', 'lib-filter-btn' + (projProgressFilter === key ? ' active' : ''));
      button.type = 'button';
      button.textContent = label;
      button.onclick = () => { projProgressFilter = key; renderProjPage(); };
      button.setAttribute('aria-pressed', String(projProgressFilter === key));
      filters.appendChild(button);
    });
    if (!detail) wrap.appendChild(filters);
    const grid = el('div', detail ? 'progress-detail-content' : 'progress-card-grid');
    wrap.appendChild(grid);
    let visible = 0;
    projProjects.forEach(proj => {
      const tasks = projTasks.filter(task => task.project_id === proj.id);
      const stats = projTaskStats(tasks);
      const complete = stats.total > 0 && stats.done === stats.total;
      if (detail && proj.id !== projDetailId) return;
      if (!detail && projProgressFilter === 'active' && (!stats.total || complete)) return;
      if (!detail && projProgressFilter === 'overdue' && !stats.overdue) return;
      if (!detail && projProgressFilter === 'done' && !complete) return;
      visible++;
      const card = el('section', 'progress-project' + (detail ? '' : ' series-card progress-small-card'));
      const head = el('div', 'progress-project-head');
      const expanded = detail;
      const toggle = detail ? el('h2', 'progress-detail-title') : projProgressButton(proj.title, () => navigateProjectDetail(proj.id), 'progress-project-toggle');
      toggle.textContent = proj.title;
      toggle.dataset.projectId = proj.id;
      if (!detail) {
        card.onclick = event => { if (!event.target.closest('button')) navigateProjectDetail(proj.id); };
      }
      const count = el('span', 'progress-count'); count.textContent = `${stats.done} / ${stats.total} ` + projCopy('項完成','completed');
      head.append(toggle, count);
      if (!detail) {
        const editProject = projProgressButton('⋯', () => openProjectModal(proj));
        editProject.setAttribute('aria-label', t('projEditProject'));
        head.appendChild(editProject);
      }
      card.appendChild(head);
      const pct = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
      const meter = el('div', 'progress-meter');
      meter.setAttribute('role','progressbar'); meter.setAttribute('aria-label',proj.title + ' ' + projCopy('任務完成率','task completion'));
      meter.setAttribute('aria-valuemin','0'); meter.setAttribute('aria-valuemax','100'); meter.setAttribute('aria-valuenow',String(pct));
      const fill = el('span'); fill.style.width = pct + '%'; meter.appendChild(fill);
      const progress = el('div','progress-meter-row');
      const percent = el('span'); percent.textContent = projCopy('任務完成率 ','Task completion ') + (stats.total ? pct + '%' : '—');
      progress.append(meter,percent); card.appendChild(progress);
      const meta = el('div','progress-meta');
      const active = el('span'); active.textContent = `${stats.active} ` + projCopy('項進行中','in progress');
      const overdue = el('span', stats.overdue ? 'progress-overdue' : ''); overdue.textContent = `${stats.overdue} ` + projCopy('項逾期','overdue');
      const due = el('span'); due.textContent = stats.next ? projCopy('最近期限 ','Next due ') + formatProjDate(new Date(stats.next)) : projCopy('無待辦期限','No pending due date');
      meta.append(active,overdue,due); card.appendChild(meta);
      if (expanded) {
        const body = el('div','progress-project-body');
        const milestones = projMilestones.filter(ms => ms.project_id === proj.id);
        if (!milestones.some(ms => ms.id === projSelectedItemId)) projSelectedItemId = milestones[0]?.id || null;
        if (!milestones.length) {
          const empty = el('p','progress-empty'); empty.textContent = projCopy('尚無項目，請用右上加號新增。','No items yet. Use the plus button above.'); body.appendChild(empty);
        } else {
          const layout = el('div', 'progress-item-layout');
          const nav = el('nav', 'progress-item-nav');
          nav.setAttribute('aria-label', projCopy('項目目錄','Item list'));
          const content = el('div', 'progress-item-content');
          milestones.forEach(ms => {
            const msTasks = tasks.filter(task => task.milestone_id === ms.id);
            const msStats = projTaskStats(msTasks);
            const link = projProgressButton(ms.title, () => { projSelectedItemId = ms.id; renderProjPage(); }, 'progress-item-link');
            link.setAttribute('aria-current', ms.id === projSelectedItemId ? 'true' : 'false');
            const count = el('span', 'progress-count'); count.textContent = `${msStats.done}/${msStats.total}`;
            link.appendChild(count);
            nav.appendChild(link);
            if (ms.id !== projSelectedItemId) return;
            const section = el('section','progress-milestone');
            const msHead = el('div','progress-milestone-head');
            const edit = projProgressButton('✎', () => openMilestoneModal(ms,proj), 'progress-milestone-edit');
            edit.setAttribute('aria-label',t('projEdit') + ' ' + ms.title);
            const addTask = projProgressButton('+', () => openTaskModal(null,ms,proj), 'progress-milestone-add');
            addTask.setAttribute('aria-label', t('projAddTask'));
            addTask.title = t('projAddTask');
            msHead.append(edit,addTask);
            if (projTemplates.length) msHead.appendChild(projProgressButton(t('projApplyTemplate'), () => openTemplateModal(ms,proj)));
            section.appendChild(msHead);
            const orderedTasks = [...msTasks].sort((a,b) => {
              if (a.status === 'DONE' && b.status !== 'DONE') return 1;
              if (b.status === 'DONE' && a.status !== 'DONE') return -1;
              return (b.priority || 2) - (a.priority || 2);
            });
            orderedTasks.forEach(task => section.appendChild(renderProgressTask(task,ms,proj)));
            if (!msTasks.length) { const empty = el('p','progress-empty'); empty.textContent = projCopy('尚無任務','No tasks yet'); section.appendChild(empty); }
            content.appendChild(section);
          });
          layout.append(nav,content);
          body.appendChild(layout);
        }
        card.appendChild(body);
      }
      grid.appendChild(card);
    });
    if (!visible) { const empty = el('p','progress-empty'); empty.textContent = projProjects.length ? projCopy('沒有符合條件的專案。','No matching projects.') : t('projNoProjects'); wrap.appendChild(empty); }
    return wrap;
  }

  function renderProgressTask(task, ms, proj) {
    const row = el('div','progress-task');
    const status = renderProgressStatus(task);
    const title = projProgressButton(task.title, () => openTaskModal(task,ms,proj),'progress-task-name');
    const priority = el('span','progress-task-priority'); priority.textContent = t('projPriority' + (task.priority || 2));
    const due = el('span','progress-task-date' + (projTaskStats([task]).overdue ? ' progress-overdue' : ''));
    due.textContent = task.due_date ? String(task.due_date).slice(0,10) : '—';
    row.append(title,priority,due,status);
    return row;
  }

  function renderProgressStatus(task) {
    const picker = el('details', 'progress-status-picker');
    const current = el('summary', 'progress-status-current');
    current.dataset.status = task.status;
    current.textContent = t('projStatus_' + task.status.replace(' ', '_'));
    current.setAttribute('aria-label', task.title + ' ' + t('projFieldStatus') + ': ' + current.textContent);
    picker.appendChild(current);
    const choices = el('div', 'progress-status-choices');
    Object.keys(STATUS_CFG).forEach(status => {
      const button = el('button', 'progress-status-choice');
      button.type = 'button';
      button.textContent = t('projStatus_' + status.replace(' ', '_'));
      button.dataset.status = status;
      button.setAttribute('aria-pressed', String(task.status === status));
      button.onclick = event => {
        event.stopPropagation();
        picker.open = false;
        if (task.status !== status) quickAdvance(task, status);
      };
      choices.appendChild(button);
    });
    picker.appendChild(choices);
    return picker;
  }

  function formatProjDate(date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const diff  = Math.round((date - today) / 86400000);
    const zh    = (typeof currentLang !== 'undefined') && currentLang === 'zh';
    if (diff === 0)  return zh ? '今天'   : 'TODAY';
    if (diff === 1)  return zh ? '明天'   : 'TOMORROW';
    if (diff === -1) return zh ? '昨天'   : 'YESTERDAY';
    if (diff < 0)    return zh ? `${Math.abs(diff)}天前` : `${Math.abs(diff)}D AGO`;
    if (diff < 8)    return zh ? `${diff}天後` : `IN ${diff}D`;
    return date.toLocaleDateString('zh-TW', { month:'numeric', day:'numeric' });
  }

  // ── Quick status advance ──────────────────────────────────────────────────

  async function quickAdvance(task, newStatus) {
    const idx = projTasks.findIndex(t => t.id === task.id);
    if (idx >= 0) projTasks[idx] = { ...projTasks[idx], status: newStatus };
    cacheSet(TASK_CACHE_KEY, projTasks);
    renderProjPage();
    try {
      await projPost({ action: 'update_task', id: task.id, status: newStatus,
                       updated_at: new Date().toISOString() });
    } catch(e) {
      console.warn('[LCARS PROJECT] advance failed:', e);
      if (idx >= 0) projTasks[idx] = task;
      renderProjPage();
      showProjToast(t('projSaveFailed'), 'error');
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showProjToast(msg, type='ok') {
    document.getElementById('proj-toast')?.remove();
    const toast = el('div', 'proj-toast' + (type==='error' ? ' error' : ''));
    toast.id = 'proj-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(()=>toast.remove(),300); }, 2200);
  }

  // ── Task modal ────────────────────────────────────────────────────────────

  function openTaskModal(task, ms, proj) {
    const isNew = !task;
    const overlay = makeOverlay();
    overlay.classList.add('progress-editor-overlay');
    if (isNew) overlay.classList.add('progress-create-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isNew ? t('projAddTask') : t('projEditTask'));

    const card = el('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-cream)';

    const head = el('div', 'alert-head');
    head.style.background = 'var(--lcars-cream)';
    head.innerHTML = `<span class="alert-head-title"><svg class="alert-head-icon"><use href="#i-missions"/></svg>${isNew ? t('projAddTask') : t('projEditTask')}</span>`;
    card.appendChild(head);

    const body = el('div', 'alert-body proj-modal-body');
    const context = el('p', 'progress-editor-context');
    context.textContent = proj.title + ' › ' + ms.title;
    body.appendChild(context);


    // Title
    body.appendChild(mField(t('projFieldTitle'),
      `<input class="proj-modal-input" id="pm-title" type="text" maxlength="120"
              placeholder="${t('projFieldTitlePH')}" value="${escHtml(task?.title||'')}">`
    ));

    // Status + Priority row
    const row1 = el('div', 'proj-modal-row');
    row1.innerHTML = `
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('projFieldStatus')}</label>
        <select class="proj-modal-select" id="pm-status">
          ${Object.keys(STATUS_CFG).map(s =>
            `<option value="${s}" ${(task?.status||'TODO')===s?'selected':''}>${t('projStatus_'+s.replace(' ','_'))||s}</option>`
          ).join('')}
        </select>
      </div>
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('projFieldPriority')}</label>
        <select class="proj-modal-select proj-priority-select" id="pm-priority"
                onchange="projPriorityChange(this)">
          ${Object.entries(PRIORITY_CFG).map(([k,v]) =>
            `<option value="${k}" ${(task?.priority||2)==k?'selected':''}>${t('projPriority'+k)||k}</option>`
          ).join('')}
        </select>
      </div>`;
    body.appendChild(row1);
    // Set initial priority border colour
    requestAnimationFrame(() => {
      const sel = document.getElementById('pm-priority');
      if (sel) projPriorityChange(sel);
    });

    // Due date + Tags row
    const row2 = el('div', 'proj-modal-row');
    row2.innerHTML = `
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('projFieldDue')}</label>
        <input class="proj-modal-input" id="pm-due" type="date" lang="en"
               value="${task?.due_date ? task.due_date.slice(0,10) : ''}">
      </div>
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('projFieldTags')}</label>
        <input class="proj-modal-input" id="pm-tags" type="text"
               placeholder="${t('projFieldTagsPH')}" value="${escHtml(task?.tags||'')}">
      </div>`;
    body.appendChild(row2);

    // Notes
    body.appendChild(mField(t('projFieldNotes'),
      `<textarea class="proj-modal-input proj-modal-textarea" id="pm-notes"
                 placeholder="${t('projFieldNotesPH')}">${escHtml(task?.notes||'')}</textarea>`
    ));

    card.appendChild(body);

    const footer = el('div', 'alert-footer confirm');

    if (!isNew) {
      const delBtn = makeBtn(t('libDelete'), 'var(--lcars-rust)', async () => {
        const ok = await lcarsConfirm({
          title:   t('projConfirmDeleteTitle'),
          body:    t('projConfirmDelete'),
          okLabel: t('libDelete'),
          danger:  true
        });
        if (!ok) return;
        closeOverlay(overlay);
        await deleteTask(task);
      });
      footer.appendChild(delBtn);
    } else {
      footer.appendChild(el('span'));
    }

    const btnRow = el('div'); btnRow.style.cssText = 'display:flex;gap:8px';
    btnRow.appendChild(makeBtn(t('libCancel'), 'var(--lcars-frame)', () => closeOverlay(overlay), 'var(--lcars-cream)'));

    const saveBtn = makeBtn(t('libSave'), 'var(--lcars-cream)', async () => {
      const title = v('pm-title');
      if (!title) { document.getElementById('pm-title')?.classList.add('invalid'); return; }
      saveBtn.disabled = true; saveBtn.textContent = '…';
      const payload = {
        title,
        milestone_id: ms.id,
        project_id:   proj.id,
        status:   v('pm-status')   || 'TODO',
        priority: parseInt(v('pm-priority')) || 2,
        due_date: v('pm-due')      || '',
        tags:     v('pm-tags')     || '',
        notes:    v('pm-notes')    || '',
      };
      try {
        if (isNew) await projPost({ action: 'add_task', ...payload, created_at: now() });
        else       await projPost({ action: 'update_task', id: task.id, ...payload, updated_at: now() });
        closeOverlay(overlay);
        await fetchProject();
        showProjToast(isNew ? t('projSaved') : t('projUpdated'));
      } catch(e) {
        saveBtn.disabled = false; saveBtn.textContent = t('libSave');
        showProjToast(t('projSaveFailed'), 'error');
      }
    });
    btnRow.appendChild(saveBtn);
    footer.appendChild(btnRow);
    card.appendChild(footer);

    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
    setTimeout(() => document.getElementById('pm-title')?.focus(), 60);
  }

  // ── Milestone modal ───────────────────────────────────────────────────────

  function openMilestoneModal(ms, proj) {
    const isNew = !ms;
    const overlay = makeOverlay();
    const card = el('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-gold)';

    const head = el('div', 'alert-head');
    head.style.background = 'var(--lcars-gold)';
    head.innerHTML = `<span class="alert-head-title"><svg class="alert-head-icon"><use href="#i-missions"/></svg>${isNew ? t('projAddMilestone') : t('projEditMilestone')}</span>`;
    card.appendChild(head);

    const body = el('div', 'alert-body proj-modal-body');
    body.appendChild(mField(t('projFieldTitle'),
      `<input class="proj-modal-input" id="msm-title" type="text" maxlength="80"
              placeholder="${t('projFieldMilestoneTitlePH')}" value="${escHtml(ms?.title||'')}">`
    ));
    card.appendChild(body);

    const footer = el('div', 'alert-footer confirm');

    if (!isNew) {
      const delBtn = makeBtn(t('libDelete'), 'var(--lcars-rust)', async () => {
        const taskCount = projTasks.filter(t => t.milestone_id === ms.id).length;
        const ok = await lcarsConfirm({
          title:   t('projConfirmDeleteMsTitle'),
          body:    taskCount > 0
            ? t('projConfirmDeleteMs').replace('{n}', taskCount)
            : t('projConfirmDeleteMsEmpty'),
          okLabel: t('libDelete'),
          danger:  true
        });
        if (!ok) return;
        closeOverlay(overlay);
        await deleteMilestone(ms);
      });
      footer.appendChild(delBtn);
    } else {
      footer.appendChild(el('span'));
    }

    const btnRow = el('div'); btnRow.style.cssText = 'display:flex;gap:8px';
    btnRow.appendChild(makeBtn(t('libCancel'), 'var(--lcars-frame)', () => closeOverlay(overlay), 'var(--lcars-cream)'));
    const saveBtn = makeBtn(t('libSave'), 'var(--lcars-gold)', async () => {
      const title = v('msm-title');
      if (!title) { document.getElementById('msm-title')?.classList.add('invalid'); return; }
      saveBtn.disabled = true; saveBtn.textContent = '…';
      try {
        if (isNew) await projPost({ action: 'add_milestone', project_id: proj.id, title, created_at: now() });
        else       await projPost({ action: 'update_milestone', id: ms.id, title });
        closeOverlay(overlay);
        await fetchProject();
        showProjToast(isNew ? t('projSaved') : t('projUpdated'));
      } catch(e) {
        saveBtn.disabled = false; saveBtn.textContent = t('libSave');
        showProjToast(t('projSaveFailed'), 'error');
      }
    });
    btnRow.appendChild(saveBtn);
    footer.appendChild(btnRow);
    card.appendChild(footer);

    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
    setTimeout(() => document.getElementById('msm-title')?.focus(), 60);
  }

  // ── Project modal ─────────────────────────────────────────────────────────

  function openProjectModal(proj) {
    const isNew = !proj;
    const overlay = makeOverlay();
    const card = el('div', 'alert-card');
    const MODAL_COLOR = 'var(--lcars-cream)';
    let selectedColor = proj?.color || PROJ_COLORS[0];
    card.style.borderColor = MODAL_COLOR;

    const head = el('div', 'alert-head');
    head.style.background = MODAL_COLOR;
    head.innerHTML = `<span class="alert-head-title"><svg class="alert-head-icon"><use href="#i-missions"/></svg>${isNew ? t('projAddProject') : t('projEditProject')}</span>`;
    card.appendChild(head);

    const body = el('div', 'alert-body proj-modal-body');
    body.appendChild(mField(t('projFieldTitle'),
      `<input class="proj-modal-input" id="pjm-title" type="text" maxlength="60"
              placeholder="${t('projFieldProjectTitlePH')}" value="${escHtml(proj?.title||'')}">`
    ));

    // Color picker
    const colorField = el('div', 'proj-modal-field');
    const colorLbl = el('label', 'proj-modal-label');
    colorLbl.textContent = t('projFieldColor');
    colorField.appendChild(colorLbl);
    const colorRow = el('div', 'proj-color-row');
    PROJ_COLORS.forEach(c => {
      const dot = el('button', 'proj-color-dot' + (c===selectedColor?' selected':''));
      dot.style.background = c;
      dot.onclick = e => {
        e.preventDefault();
        selectedColor = c;
        colorRow.querySelectorAll('.proj-color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
      };
      colorRow.appendChild(dot);
    });
    colorField.appendChild(colorRow);
    body.appendChild(colorField);
    card.appendChild(body);

    const footer = el('div', 'alert-footer confirm');
    if (!isNew) {
      const delBtn = makeBtn(t('libDelete'), 'var(--lcars-rust)', async () => {
        const msCount = projMilestones.filter(m => m.project_id === proj.id).length;
        const ok = await lcarsConfirm({
          title:   t('projConfirmDeleteProjTitle'),
          body:    msCount > 0
            ? t('projConfirmDeleteProj').replace('{n}', msCount)
            : t('projConfirmDeleteProjEmpty'),
          okLabel: t('libDelete'),
          danger:  true
        });
        if (!ok) return;
        closeOverlay(overlay);
        await deleteProject(proj);
      });
      footer.appendChild(delBtn);
    } else { footer.appendChild(el('span')); }

    const btnRow = el('div'); btnRow.style.cssText = 'display:flex;gap:8px';
    btnRow.appendChild(makeBtn(t('libCancel'), 'var(--lcars-frame)', () => closeOverlay(overlay), 'var(--lcars-cream)'));
    const saveBtn = makeBtn(t('libSave'), MODAL_COLOR, async () => {
      const title = v('pjm-title');
      if (!title) { document.getElementById('pjm-title')?.classList.add('invalid'); return; }
      saveBtn.disabled = true; saveBtn.textContent = '…';
      try {
        if (isNew) await projPost({ action: 'add_project', title, color: selectedColor, created_at: now() });
        else       await projPost({ action: 'update_project', id: proj.id, title, color: selectedColor });
        closeOverlay(overlay);
        await fetchProject();
        showProjToast(isNew ? t('projSaved') : t('projUpdated'));
      } catch(e) {
        saveBtn.disabled = false; saveBtn.textContent = t('libSave');
        showProjToast(t('projSaveFailed'), 'error');
      }
    });
    btnRow.appendChild(saveBtn);
    footer.appendChild(btnRow);
    card.appendChild(footer);

    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
    setTimeout(() => document.getElementById('pjm-title')?.focus(), 60);
  }

  // ── Template apply modal ──────────────────────────────────────────────────

  function openTemplateModal(ms, proj) {
    const overlay = makeOverlay();
    const card = el('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-gold)';

    const head = el('div', 'alert-head');
    head.style.background = 'var(--lcars-gold)';
    head.innerHTML = `<span class="alert-head-title"><svg class="alert-head-icon"><use href="#i-missions"/></svg>${t('projApplyTemplate')}</span>`;
    card.appendChild(head);

    const body = el('div', 'alert-body proj-modal-body');
    const lbl = el('p'); lbl.style.cssText = 'font-size:11px;opacity:0.7;margin-bottom:8px';
    lbl.textContent = t('projTemplateHint');
    body.appendChild(lbl);

    projTemplates.forEach(tmpl => {
      let taskDefs = [];
      try { taskDefs = JSON.parse(tmpl.tasks_json); } catch(e) {}

      const row = el('div', 'proj-tmpl-row');
      const name = el('span', 'proj-tmpl-name');
      name.textContent = tmpl.name;
      row.appendChild(name);
      const count = el('span', 'proj-tmpl-count');
      count.textContent = taskDefs.length + ' ' + t('projTasks');
      row.appendChild(count);
      const applyBtn = el('button', 'proj-tmpl-apply-btn');
      applyBtn.textContent = t('projApply');
      applyBtn.onclick = async () => {
        applyBtn.disabled = true; applyBtn.textContent = '…';
        try {
          await projPost({ action: 'apply_template', template_id: tmpl.id, milestone_id: ms.id, project_id: proj.id });
          closeOverlay(overlay);
          await fetchProject();
          showProjToast(t('projTemplateApplied'));
        } catch(e) {
          applyBtn.disabled = false; applyBtn.textContent = t('projApply');
          showProjToast(t('projSaveFailed'), 'error');
        }
      };
      row.appendChild(applyBtn);
      body.appendChild(row);
    });

    card.appendChild(body);

    const footer = el('div', 'alert-footer');
    const closeBtn = makeBtn(t('libClose'), 'var(--lcars-frame)', () => closeOverlay(overlay), 'var(--lcars-cream)');
    footer.appendChild(closeBtn);
    card.appendChild(footer);

    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  async function deleteTask(task) {
    projTasks = projTasks.filter(t => t.id !== task.id);
    cacheSet(TASK_CACHE_KEY, projTasks);
    renderProjPage();
    try {
      await projPost({ action: 'delete_task', id: task.id });
      showProjToast(t('projDeleted'));
    } catch(e) {
      showProjToast(t('projSaveFailed'), 'error');
      await fetchProject();
    }
  }

  async function deleteMilestone(ms) {
    projTasks      = projTasks.filter(t => t.milestone_id !== ms.id);
    projMilestones = projMilestones.filter(m => m.id !== ms.id);
    if (projActiveMilestoneId === ms.id) projActiveMilestoneId = null;
    cacheSet(MS_CACHE_KEY,   projMilestones);
    cacheSet(TASK_CACHE_KEY, projTasks);
    renderProjPage();
    try {
      await projPost({ action: 'delete_milestone', id: ms.id });
      showProjToast(t('projDeleted'));
    } catch(e) {
      showProjToast(t('projSaveFailed'), 'error');
      await fetchProject();
    }
  }

  async function deleteProject(proj) {
    projTasks      = projTasks.filter(t => t.project_id !== proj.id);
    projMilestones = projMilestones.filter(m => m.project_id !== proj.id);
    projProjects   = projProjects.filter(p => p.id !== proj.id);
    if (projActiveProjectId === proj.id) { projActiveProjectId = null; projActiveMilestoneId = null; }
    cacheSet(PROJ_CACHE_KEY, projProjects);
    cacheSet(MS_CACHE_KEY,   projMilestones);
    cacheSet(TASK_CACHE_KEY, projTasks);
    renderProjPage();
    try {
      await projPost({ action: 'delete_project', id: proj.id });
      showProjToast(t('projDeleted'));
    } catch(e) {
      showProjToast(t('projSaveFailed'), 'error');
      await fetchProject();
    }
  }

  // ── Utility helpers ───────────────────────────────────────────────────────

  function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }
  function v(id) { return document.getElementById(id)?.value?.trim() || ''; }
  function now() { return new Date().toISOString(); }
  function escHtml(s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function projPriorityChange(sel) {
    const cfg = PRIORITY_CFG[sel.value];
    if (cfg) sel.style.borderLeftColor = cfg.color;
  }
  window.projPriorityChange = projPriorityChange;

  function mField(label, inputHtml) {
    const w = el('div', 'proj-modal-field');
    w.innerHTML = `<label class="proj-modal-label">${label}</label>${inputHtml}`;
    return w;
  }
  function makeBtn(label, bg, onclick, color) {
    const b = el('button', 'alert-ok');
    b.style.background = bg;
    if (color) b.style.color = color;
    b.textContent = label;
    b.onclick = onclick;
    // Tag destructive (rust-coloured) buttons so CSS layout recognises them
    if (bg && bg.indexOf('rust') >= 0) b.classList.add('danger');
    return b;
  }
  function makeOverlay() {
    const ov = el('div', 'alert-overlay');
    ov.style.zIndex = '10001';
    const stack = el('div', 'alert-stack');
    stack.style.maxWidth = '480px';
    ov.appendChild(stack);
    /* backdrop-close disabled */
    return ov;
  }
  function closeOverlay(el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.15s';
    setTimeout(() => {
      // Use the shared closeOverlay from notes.js (exposed as window.closeOverlay)
      // which handles scroll-lock counter. Fallback to plain remove().
      const globalClose = window._overlayClose;
      if (globalClose) globalClose(el); else el.remove();
    }, 160);
  }

  // ── Sidebar drag-resize ──────────────────────────────────────────────────

  const PROJ_SIDEBAR_KEY = 'lcars_proj_sidebar_w';
  const PROJ_SIDEBAR_MIN = 160;
  const PROJ_SIDEBAR_MAX = 480;

  function attachProjResizer(resizer, layout) {
    // Restore saved width
    const saved = parseInt(localStorage.getItem(PROJ_SIDEBAR_KEY));
    if (saved && saved >= PROJ_SIDEBAR_MIN && saved <= PROJ_SIDEBAR_MAX) {
      layout.style.setProperty('--proj-sidebar-w', saved + 'px');
    }

    let startX, startW;

    function onMove(e) {
      const dx  = (e.clientX || e.touches?.[0]?.clientX || startX) - startX;
      const w   = Math.min(PROJ_SIDEBAR_MAX, Math.max(PROJ_SIDEBAR_MIN, startW + dx));
      layout.style.setProperty('--proj-sidebar-w', w + 'px');
    }

    function onUp() {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onUp);
      // Save width
      const w = parseInt(getComputedStyle(layout).getPropertyValue('--proj-sidebar-w'));
      if (w) localStorage.setItem(PROJ_SIDEBAR_KEY, w);
    }

    resizer.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX;
      startW = parseInt(getComputedStyle(layout).getPropertyValue('--proj-sidebar-w')) || 280;
      resizer.classList.add('dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    resizer.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startW = parseInt(getComputedStyle(layout).getPropertyValue('--proj-sidebar-w')) || 280;
      resizer.classList.add('dragging');
      document.addEventListener('touchmove', onMove, { passive: true });
      document.addEventListener('touchend',  onUp);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function initProject() {
    // Restore cache immediately
    projProjects   = cacheGet(PROJ_CACHE_KEY)  || [];
    projMilestones = (cacheGet(MS_CACHE_KEY)   || []).sort((a,b)=>(parseInt(a.order)||0)-(parseInt(b.order)||0));
    projTasks      = (cacheGet(TASK_CACHE_KEY) || []).map(t=>({...t,priority:parseInt(t.priority)||2}));
    projTemplates  = cacheGet(TMPL_CACHE_KEY)  || [];

    // Register + ADD TASK button in core's PAGE_ACTIONS
    if (typeof PAGE_ACTIONS !== 'undefined') {
      PAGE_ACTIONS.project = () =>
        projActiveMilestoneId
          ? {
              labelKey: 'projAddTask',
              handler: () => {
                const ms   = projMilestones.find(m => m.id === projActiveMilestoneId);
                const proj = projProjects.find(p => p.id === projActiveProjectId);
                if (ms && proj) openTaskModal(null, ms, proj);
              }
            }
          : null;
    }

    renderProjPage();
  }

  window.fetchProject  = fetchProject;
  window.initProject   = initProject;
