// js/project.js — Mission Operations · Project / Milestone / Task Tracker
// Three-tier model: Project → Milestone (項目) → Task
// API mirrors library.js: Apps Script backend, action-based POST, local cache.

/* ============================================================
   DATA MODEL
   Projects:   { id, title, color, created_at }
   Milestones: { id, project_id, title, order, created_at }
   Tasks:      { id, milestone_id, project_id, title, status,
                 priority, start_date, due_date, order, tags, notes, created_at, updated_at }
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
  const ORDER_CACHE_KEY = 'lcars_proj_v2_display_order';

  // ── Local state ───────────────────────────────────────────────────────────
  let projProjects   = [];
  let projMilestones = [];
  let projTasks      = [];
  let projTemplates  = [];
  let projLoading    = false;
  let projError      = null;
  let projSavedOrders = null;

  function projectOrderStore() {
    if (!projSavedOrders) {
      const saved = typeof persistGet === 'function' ? persistGet(ORDER_CACHE_KEY) : null;
      projSavedOrders = saved && typeof saved === 'object' ? saved : { milestones:{}, tasks:{} };
      projSavedOrders.milestones ||= {};
      projSavedOrders.tasks ||= {};
    }
    return projSavedOrders;
  }

  function saveProjectOrder(kind, ownerId, ids) {
    projectOrderStore()[kind][String(ownerId)] = ids.map(String);
    if (typeof persistSet === 'function') persistSet(ORDER_CACHE_KEY, projSavedOrders);
  }

  function orderedProjectRows(rows, kind, ownerId) {
    const saved = projectOrderStore()[kind][String(ownerId)] || [];
    const positions = new Map(saved.map((id, index) => [String(id), index]));
    return rows.map((row, index) => ({ row, index })).sort((a, b) => {
      const aSaved = positions.get(String(a.row.id));
      const bSaved = positions.get(String(b.row.id));
      if (aSaved !== undefined || bSaved !== undefined) {
        if (aSaved === undefined) return 1;
        if (bSaved === undefined) return -1;
        return aSaved - bSaved;
      }
      const aOrder = Number(a.row.order), bOrder = Number(b.row.order);
      if (aOrder > 0 && bOrder > 0 && aOrder !== bOrder) return aOrder - bOrder;
      if (aOrder > 0 && !(bOrder > 0)) return -1;
      if (bOrder > 0 && !(aOrder > 0)) return 1;
      return a.index - b.index;
    }).map(entry => entry.row);
  }

  // UI state
  let projActiveProjectId   = null;   // which project is expanded
  let projActiveMilestoneId = null;   // which milestone's Kanban is shown
  let projSortMode          = 'priority'; // 'priority' | 'due' | 'created'

  // ── Config ────────────────────────────────────────────────────────────────
  const STATUS_CFG = {
    'TODO':        { icon: '◉', color: 'var(--lcars-blue)',   next: 'IN PROGRESS' },
    'IN PROGRESS': { icon: '▶', color: 'var(--lcars-orange)', next: 'DONE'        },
    'DONE':        { icon: '✓', color: '#2ecfb0',             next: 'TODO'        },
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
    const dates = pending.map(task => projDateInputValue(task.due_date)).filter(Boolean).sort();
    return {
      total: tasks.length,
      done: tasks.length - pending.length,
      active: pending.filter(task => task.status === 'IN PROGRESS').length,
      overdue: pending.filter(task => {
        const due = projDateInputValue(task.due_date);
        return due && new Date(due + 'T00:00:00') < today;
      }).length,
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
      if (detail) {
        const back = projProgressButton('', () => navigateProjectDetail(null), 'progress-back');
        back.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>';
        back.setAttribute('aria-label', projCopy('返回上一頁', 'Back to previous page'));
        back.title = projCopy('返回上一頁', 'Back to previous page');
        head.appendChild(back);
      }
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
        const milestones = orderedProjectRows(projMilestones.filter(ms => ms.project_id === proj.id), 'milestones', proj.id);
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
            if (projTemplates.length) {
              const msHead = el('div','progress-milestone-head');
              msHead.appendChild(projProgressButton(t('projApplyTemplate'), () => openTemplateModal(ms,proj)));
              section.appendChild(msHead);
            }
            const orderedTasks = orderedProjectRows(msTasks, 'tasks', ms.id);
            orderedTasks.forEach(task => section.appendChild(renderProgressTask(task,ms,proj)));
            if (!msTasks.length) { const empty = el('p','progress-empty'); empty.textContent = projCopy('尚無任務','No tasks yet'); section.appendChild(empty); }
            const taskActions = el('div', 'progress-task-actions');
            const editTasks = projProgressButton('', () => openTasksModal(ms, proj, orderedTasks), 'progress-tasks-edit');
            editTasks.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>';
            editTasks.setAttribute('aria-label', projCopy('編輯任務', 'Edit tasks'));
            editTasks.title = projCopy('編輯任務', 'Edit tasks');
            taskActions.appendChild(editTasks);
            section.appendChild(taskActions);
            content.appendChild(section);
          });
          const editItems = projProgressButton('', () => openItemsModal(proj, milestones), 'progress-items-edit');
          editItems.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>';
          editItems.setAttribute('aria-label', projCopy('編輯項目', 'Edit items'));
          editItems.title = projCopy('編輯項目', 'Edit items');
          nav.appendChild(editItems);
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
    const title = el('span', 'progress-task-name');
    title.textContent = task.title;
    const name = el('div', 'progress-task-name-wrap');
    name.appendChild(title);
    const dueValue = projDateInputValue(task.due_date);
    if (dueValue && task.status !== 'DONE') {
      const today = new Date(); today.setHours(0,0,0,0);
      const days = Math.round((new Date(dueValue + 'T00:00:00') - today) / 86400000);
      const countdown = el('span', 'progress-task-countdown' + (days < 0 ? ' progress-overdue' : ''));
      countdown.textContent = days > 0
        ? projCopy(`還有 ${days} 日`, `${days} days left`)
        : days === 0 ? projCopy('今天到期', 'Due today')
        : projCopy(`逾期 ${-days} 日`, `${-days} days overdue`);
      name.appendChild(countdown);
    }
    const priority = el('span','progress-task-priority');
    priority.setAttribute('role', 'img');
    priority.setAttribute('aria-label', t('projFieldPriority') + ': ' + t('projPriority' + (task.priority || 2)));
    priority.title = t('projPriority' + (task.priority || 2));
    priority.dataset.priority = String(task.priority || 2);
    const due = el('span','progress-task-date' + (projTaskStats([task]).overdue ? ' progress-overdue' : ''));
    due.textContent = task.due_date ? formatProjTaskDate(task.due_date) : '—';
    row.append(priority,name,due,status);
    return row;
  }

  function renderProgressStatus(task) {
    const current = el('button', 'progress-status-current');
    current.type = 'button';
    current.dataset.status = task.status;
    const statusLabel = t('projStatus_' + task.status.replace(' ', '_'));
    current.setAttribute('aria-label', task.title + ' ' + t('projFieldStatus') + ': ' + statusLabel);
    current.title = statusLabel;
    current.textContent = statusLabel;
    current.onclick = () => quickAdvance(task, STATUS_CFG[task.status]?.next || 'TODO');
    return current;
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

  function formatProjTaskDate(value) {
    const normalized = projDateInputValue(value);
    if (!normalized) return String(value);
    const date = new Date(normalized + 'T00:00:00');
    if (currentLang !== 'zh') return date.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
    const weekday = '日一二三四五六'[date.getDay()];
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日（${weekday}）`;
  }

  function projDateInputValue(value) {
    if (!value) return '';
    const raw = String(value).trim();
    const parts = raw.match(/^(\d{4})[-/年]\s*(\d{1,2})[-/月]\s*(\d{1,2})/);
    if (parts) {
      const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      }
      return '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
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
    head.innerHTML = `<span class="alert-head-title">${isNew ? t('projAddTask') : t('projEditTask')}</span>`;
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

    // Start date, due date, and tags
    const row2 = el('div', 'proj-modal-row');
    row2.innerHTML = `
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('projFieldStart')}</label>
        <input class="proj-modal-input" id="pm-start" type="date" lang="en"
               value="${projDateInputValue(task?.start_date)}">
      </div>
      <div class="proj-modal-field">
        <label class="proj-modal-label">${t('projFieldDue')}</label>
        <input class="proj-modal-input" id="pm-due" type="date" lang="en"
               value="${projDateInputValue(task?.due_date)}">
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
        start_date: v('pm-start') || '',
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

  function openItemsModal(proj, milestones) {
    const overlay = makeOverlay();
    const card = el('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-gold)';
    const head = el('div', 'alert-head');
    head.style.background = 'var(--lcars-gold)';
    head.innerHTML = `<span class="alert-head-title">${projCopy('編輯項目', 'Edit items')}</span>`;
    card.appendChild(head);

    const body = el('div', 'alert-body proj-modal-body');
    const list = el('div', 'progress-items-list');
    let dragged = null;
    milestones.forEach(ms => {
      const row = el('div', 'progress-items-row');
      row.dataset.id = ms.id;
      const handle = el('span', 'progress-items-handle');
      handle.textContent = '⠿';
      handle.draggable = true;
      handle.setAttribute('aria-hidden', 'true');
      const input = el('input', 'proj-modal-input');
      input.type = 'text';
      input.maxLength = 80;
      input.value = ms.title;
      input.setAttribute('aria-label', projCopy('項目名稱', 'Item name'));
      row.append(handle, input);
      const remove = projProgressButton('×', async () => {
        const taskCount = projTasks.filter(task => task.milestone_id === ms.id).length;
        const ok = await lcarsConfirm({
          title: t('projConfirmDeleteMsTitle'),
          body: taskCount > 0 ? t('projConfirmDeleteMs').replace('{n}', taskCount) : t('projConfirmDeleteMsEmpty'),
          okLabel: t('libDelete'), danger: true,
        });
        if (!ok) return;
        closeOverlay(overlay);
        await deleteMilestone(ms);
      }, 'progress-items-remove');
      remove.setAttribute('aria-label', t('libDelete') + ' ' + ms.title);
      row.appendChild(remove);
      handle.ondragstart = event => {
        dragged = row;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(ms.id));
        row.classList.add('dragging');
      };
      row.ondragover = event => {
        event.preventDefault();
        if (!dragged || dragged === row) return;
        const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
        list.insertBefore(dragged, after ? row.nextSibling : row);
      };
      row.ondrop = event => event.preventDefault();
      handle.ondragend = () => { row.classList.remove('dragging'); dragged = null; };
      list.appendChild(row);
    });
    body.appendChild(list);
    card.appendChild(body);

    const footer = el('div', 'alert-footer confirm');
    footer.appendChild(el('span'));
    const buttons = el('div'); buttons.style.cssText = 'display:flex;gap:8px';
    buttons.appendChild(makeBtn(t('libCancel'), 'var(--lcars-frame)', () => closeOverlay(overlay), 'var(--lcars-cream)'));
    const save = makeBtn(t('libSave'), 'var(--lcars-gold)', async () => {
      const rows = Array.from(list.children);
      const updates = rows.map((row, index) => ({
        id: row.dataset.id,
        title: row.querySelector('input').value.trim(),
        order: index + 1,
      }));
      const invalid = rows.find(row => !row.querySelector('input').value.trim());
      if (invalid) { invalid.querySelector('input').classList.add('invalid'); invalid.querySelector('input').focus(); return; }
      save.disabled = true; save.textContent = '…';
      try {
        for (const item of updates) {
          const original = milestones.find(ms => String(ms.id) === String(item.id));
          if (item.title !== original.title || item.order !== Number(original.order)) {
            await projPost({ action: 'update_milestone', ...item });
          }
        }
        saveProjectOrder('milestones', proj.id, updates.map(item => item.id));
        closeOverlay(overlay);
        await fetchProject();
        showProjToast(t('projUpdated'));
      } catch (error) {
        save.disabled = false; save.textContent = t('libSave');
        showProjToast(t('projSaveFailed'), 'error');
      }
    });
    buttons.appendChild(save);
    footer.appendChild(buttons);
    card.appendChild(footer);
    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
  }

  function openTasksModal(ms, proj, tasks) {
    const overlay = makeOverlay();
    overlay.classList.add('progress-tasks-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', projCopy('編輯任務', 'Edit tasks'));
    const card = el('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-cream)';
    const head = el('div', 'alert-head');
    head.style.background = 'var(--lcars-cream)';
    head.innerHTML = `<span class="alert-head-title">${projCopy('編輯任務', 'Edit tasks')}</span>`;
    card.appendChild(head);
    const body = el('div', 'alert-body proj-modal-body');
    const list = el('div', 'progress-task-edit-list');
    let dragged = null;
    const addRow = (task, isNew = false) => {
      const row = el('div', 'progress-task-edit-row');
      row.dataset.id = task.id || '';
      row.dataset.new = String(isNew);
      const grip = el('span', 'progress-items-handle');
      grip.textContent = '⠿'; grip.draggable = true;
      grip.setAttribute('aria-hidden', 'true');
      const fields = el('div', 'progress-task-edit-fields');
      const title = el('input', 'proj-modal-input progress-task-edit-title');
      title.type = 'text'; title.maxLength = 120; title.value = task.title;
      title.setAttribute('aria-label', t('projFieldTitle'));
      const details = el('div', 'progress-task-edit-details');
      const priorityField = el('div', 'progress-task-edit-priority-field');
      const priority = el('select', 'proj-modal-select progress-task-edit-priority');
      priority.setAttribute('aria-label', t('projFieldPriority'));
      Object.keys(PRIORITY_CFG).forEach(key => {
        const option = el('option'); option.value = key; option.textContent = t('projPriority' + key);
        priority.appendChild(option);
      });
      priority.value = String(task.priority || 2);
      priorityField.dataset.priority = priority.value;
      priority.onchange = () => { priorityField.dataset.priority = priority.value; };
      const priorityDot = el('span', 'progress-task-edit-priority-dot');
      priorityDot.setAttribute('aria-hidden', 'true');
      priorityField.append(priorityDot, priority);
      const due = el('input', 'proj-modal-input progress-task-edit-due');
      due.type = 'date'; due.value = projDateInputValue(task.due_date);
      due.setAttribute('aria-label', t('projFieldDue'));
      const start = el('input', 'proj-modal-input progress-task-edit-start');
      start.type = 'date'; start.value = projDateInputValue(task.start_date);
      start.setAttribute('aria-label', t('projFieldStart'));
      const status = el('select', 'proj-modal-select progress-task-edit-status');
      status.setAttribute('aria-label', t('projFieldStatus'));
      Object.keys(STATUS_CFG).forEach(key => {
        const option = el('option'); option.value = key;
        option.textContent = t('projStatus_' + key.replace(' ', '_'));
        status.appendChild(option);
      });
      status.value = task.status;
      details.append(priorityField, start, due, status);
      const notes = el('input', 'proj-modal-input progress-task-edit-notes');
      notes.type = 'text'; notes.value = task.notes || '';
      notes.placeholder = t('projFieldNotes');
      notes.setAttribute('aria-label', t('projFieldNotes'));
      fields.append(title, details, notes);
      const remove = projProgressButton('×', async () => {
        if (isNew) { row.remove(); return; }
        const ok = await lcarsConfirm({ title: t('projConfirmDeleteTitle'), body: t('projConfirmDelete'), okLabel: t('libDelete'), danger: true });
        if (!ok) return;
        await deleteTask(task);
        row.remove();
      }, 'progress-task-edit-remove');
      remove.setAttribute('aria-label', t('libDelete') + ' ' + task.title);
      row.append(grip, fields, remove);
      grip.ondragstart = event => {
        dragged = row;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(task.id));
        row.classList.add('dragging');
      };
      row.ondragover = event => {
        event.preventDefault();
        if (!dragged || dragged === row) return;
        const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
        list.insertBefore(dragged, after ? row.nextSibling : row);
      };
      row.ondrop = event => event.preventDefault();
      grip.ondragend = () => { row.classList.remove('dragging'); dragged = null; };
      list.appendChild(row);
      return row;
    };
    tasks.forEach(task => addRow(task));
    body.appendChild(list);
    const add = projProgressButton(projCopy('＋新增任務', '+ Add task'), () => {
      const row = addRow({ title:'', priority:2, start_date:'', due_date:'', status:'TODO', notes:'' }, true);
      row.querySelector('.progress-task-edit-title').focus();
    }, 'progress-task-edit-add');
    body.appendChild(add);
    card.appendChild(body);
    const footer = el('div', 'alert-footer confirm');
    footer.appendChild(el('span'));
    const buttons = el('div'); buttons.style.cssText = 'display:flex;gap:8px';
    buttons.appendChild(makeBtn(t('libCancel'), 'var(--lcars-frame)', () => closeOverlay(overlay), 'var(--lcars-cream)'));
    const save = makeBtn(t('libSave'), 'var(--lcars-cream)', async () => {
      const rows = Array.from(list.children);
      const invalid = rows.find(row => !row.querySelector('.progress-task-edit-title').value.trim());
      if (invalid) { const input = invalid.querySelector('.progress-task-edit-title'); input.classList.add('invalid'); input.focus(); return; }
      save.disabled = true; save.textContent = '…';
      try {
        for (const [index, row] of rows.entries()) {
          const isNew = row.dataset.new === 'true';
          const original = isNew ? null : tasks.find(task => String(task.id) === String(row.dataset.id));
          const change = {
            title: row.querySelector('.progress-task-edit-title').value.trim(),
            priority: Number(row.querySelector('.progress-task-edit-priority').value),
            start_date: row.querySelector('.progress-task-edit-start').value,
            due_date: row.querySelector('.progress-task-edit-due').value,
            status: row.querySelector('.progress-task-edit-status').value,
            notes: row.querySelector('.progress-task-edit-notes').value.trim(),
            order: index + 1,
          };
          if (isNew) {
            await projPost({ action:'add_task', project_id:proj.id, milestone_id:ms.id, tags:'', ...change, created_at:now() });
            continue;
          }
          if (change.title !== original.title || change.priority !== Number(original.priority) ||
              change.start_date !== projDateInputValue(original.start_date) ||
              change.due_date !== projDateInputValue(original.due_date) ||
              change.status !== original.status || change.notes !== (original.notes || '') ||
              change.order !== Number(original.order)) {
            await projPost({ action: 'update_task', id: original.id, ...change, updated_at: now() });
          }
        }
        saveProjectOrder('tasks', ms.id, rows.map(row => row.dataset.id).filter(Boolean));
        closeOverlay(overlay);
        await fetchProject();
        showProjToast(t('projUpdated'));
      } catch (error) {
        save.disabled = false; save.textContent = t('libSave');
        showProjToast(t('projSaveFailed'), 'error');
      }
    });
    buttons.appendChild(save); footer.appendChild(buttons); card.appendChild(footer);
    overlay.querySelector('.alert-stack').appendChild(card);
    openOverlay(overlay);
  }

  function openMilestoneModal(ms, proj) {
    const isNew = !ms;
    const overlay = makeOverlay();
    const card = el('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-gold)';

    const head = el('div', 'alert-head');
    head.style.background = 'var(--lcars-gold)';
    head.innerHTML = `<span class="alert-head-title">${isNew ? t('projAddMilestone') : t('projEditMilestone')}</span>`;
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
    head.innerHTML = `<span class="alert-head-title">${isNew ? t('projAddProject') : t('projEditProject')}</span>`;
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
    head.innerHTML = `<span class="alert-head-title">${t('projApplyTemplate')}</span>`;
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
    const ov = el('div', 'alert-overlay project-overlay');
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
