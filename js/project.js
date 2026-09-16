// js/project.js — Mission Operations · Project / Milestone / Task Tracker
// Three-tier model: Project → Milestone (章節) → Task
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

    // Layout: left sidebar (project tree) + right panel (kanban)
    const layout = el('div', 'proj-layout');

    // ── Left: project tree ────────────────────────────────────────────────
    const sidebar = el('div', 'proj-sidebar');

    // "All projects" header
    const sideHead = el('div', 'proj-side-head');
    const sideTitle = el('span', 'proj-side-title');
    sideTitle.textContent = t('projMissionOps');
    sideHead.appendChild(sideTitle);
    const addProjBtn = el('button', 'proj-side-add-btn');
    addProjBtn.textContent = '+';
    addProjBtn.title = t('projAddProject');
    addProjBtn.onclick = () => openProjectModal(null);
    sideHead.appendChild(addProjBtn);
    sidebar.appendChild(sideHead);

    if (projProjects.length === 0) {
      const empty = el('div', 'proj-side-empty');
      empty.textContent = t('projNoProjects');
      sidebar.appendChild(empty);
    } else {
      projProjects.forEach(proj => {
        sidebar.appendChild(renderProjSidebarItem(proj));
      });
    }

    layout.appendChild(sidebar);

    // ── Drag resizer ──────────────────────────────────────────────────────
    const resizer = el('div', 'proj-resizer');
    layout.appendChild(resizer);
    attachProjResizer(resizer, layout);

    // ── Right: kanban panel ───────────────────────────────────────────────
    const kanban = el('div', 'proj-kanban-area');
    kanban.appendChild(renderKanbanArea());
    layout.appendChild(kanban);

    root.appendChild(layout);
  }

  // ── Sidebar project + milestones ──────────────────────────────────────────

  function renderProjSidebarItem(proj) {
    const isOpen = projActiveProjectId === proj.id;
    const milestones = projMilestones.filter(m => m.project_id === proj.id);

    const wrap = el('div', 'proj-proj-item' + (isOpen ? ' open' : ''));

    // Project row
    const projRow = el('div', 'proj-proj-row');
    projRow.style.setProperty('--proj-color', proj.color || PROJ_COLORS[0]);

    const chevron = el('span', 'proj-chevron');
    chevron.textContent = isOpen ? '▾' : '▸';
    projRow.appendChild(chevron);

    const dot = el('span', 'proj-proj-dot');
    projRow.appendChild(dot);

    const label = el('span', 'proj-proj-label');
    label.textContent = proj.title;
    projRow.appendChild(label);

    // task count badge
    const taskCount = projTasks.filter(t => t.project_id === proj.id && t.status !== 'DONE').length;
    if (taskCount > 0) {
      const badge = el('span', 'proj-proj-badge');
      badge.textContent = taskCount;
      projRow.appendChild(badge);
    }

    const editBtn = el('button', 'proj-proj-edit-btn');
    editBtn.textContent = '⋯';
    editBtn.title = t('projEdit');
    editBtn.onclick = e => { e.stopPropagation(); openProjectModal(proj); };
    projRow.appendChild(editBtn);

    projRow.onclick = () => {
      if (projActiveProjectId === proj.id) {
        projActiveProjectId   = null;
        projActiveMilestoneId = null;
      } else {
        projActiveProjectId = proj.id;
        // auto-select first milestone
        projActiveMilestoneId = milestones.length > 0 ? milestones[0].id : null;
      }
      renderProjPage();
    };
    wrap.appendChild(projRow);

    // Milestone list (only when project is open)
    if (isOpen) {
      const msList = el('div', 'proj-ms-list');

      milestones.forEach(ms => {
        const msRow = buildMilestoneRow(ms, proj);
        msList.appendChild(msRow);
      });

      // Add milestone button
      const addMsRow = el('div', 'proj-ms-add-row');
      const addMsBtn = el('button', 'proj-ms-add-btn');
      addMsBtn.textContent = t('projAddMilestone');
      addMsBtn.onclick = () => openMilestoneModal(null, proj);
      addMsRow.appendChild(addMsBtn);
      msList.appendChild(addMsRow);

      wrap.appendChild(msList);
    }

    return wrap;
  }

  function buildMilestoneRow(ms, proj) {
    const isActive = projActiveMilestoneId === ms.id;
    const tasks    = projTasks.filter(t => t.milestone_id === ms.id);
    const done     = tasks.filter(t => t.status === 'DONE').length;
    const total    = tasks.length;
    const pct      = total > 0 ? Math.round(done / total * 100) : 0;

    const msRow = el('div', 'proj-ms-row' + (isActive ? ' active' : ''));
    msRow.style.setProperty('--proj-color', proj.color || PROJ_COLORS[0]);

    const msLabel = el('span', 'proj-ms-label');
    msLabel.textContent = ms.title;
    msRow.appendChild(msLabel);

    // progress pill
    const prog = el('span', 'proj-ms-prog');
    prog.textContent = total > 0 ? `${done}/${total}` : '—';
    if (pct === 100) prog.classList.add('done');
    msRow.appendChild(prog);

    // edit button
    const editBtn = el('button', 'proj-ms-edit-btn');
    editBtn.textContent = '⋯';
    editBtn.title = t('projEdit');
    editBtn.onclick = e => { e.stopPropagation(); openMilestoneModal(ms, proj); };
    msRow.appendChild(editBtn);

    msRow.onclick = () => {
      projActiveMilestoneId = ms.id;
      projActiveProjectId   = proj.id;
      renderProjPage();
    };

    // mini progress bar
    if (total > 0) {
      const bar = el('div', 'proj-ms-bar');
      const fill = el('div', 'proj-ms-bar-fill');
      fill.style.width = pct + '%';
      fill.style.setProperty('--proj-color', proj.color || PROJ_COLORS[0]);
      bar.appendChild(fill);
      const barWrap = el('div', 'proj-ms-bar-wrap');
      barWrap.appendChild(msRow);
      barWrap.appendChild(bar);
      return barWrap;
    }

    return msRow;
  }

  // ── Kanban area ───────────────────────────────────────────────────────────

  function renderKanbanArea() {
    const wrap = el('div');

    // No project selected
    if (!projActiveProjectId) {
      // Show overview: all projects summary
      return renderProjectsOverview();
    }

    const proj = projProjects.find(p => p.id === projActiveProjectId);
    if (!proj) return wrap;

    // No milestone selected (project has none yet)
    const milestones = projMilestones.filter(m => m.project_id === proj.id);
    if (!projActiveMilestoneId || !milestones.find(m => m.id === projActiveMilestoneId)) {
      const hint = el('div', 'proj-kanban-hint');
      hint.innerHTML = `<span style="opacity:0.4">${t('projSelectMilestone')}</span>`;
      return hint;
    }

    const ms = projMilestones.find(m => m.id === projActiveMilestoneId);

    // Kanban header
    const header = el('div', 'proj-kanban-header');
    header.style.setProperty('--proj-color', proj.color || PROJ_COLORS[0]);

    const breadcrumb = el('div', 'proj-breadcrumb');
    breadcrumb.innerHTML = `<span class="proj-bc-proj">${escHtml(proj.title)}</span><span class="proj-bc-sep">›</span><span class="proj-bc-ms">${escHtml(ms.title)}</span>`;
    header.appendChild(breadcrumb);

    const headerActions = el('div', 'proj-kanban-header-actions');

    // Sort control
    const sortWrap = el('div', 'proj-sort-row');
    const sortLbl = el('span', 'proj-sort-label');
    sortLbl.textContent = t('projSortBy');
    sortWrap.appendChild(sortLbl);
    [
      { key: 'priority', label: t('projSortPriority') },
      { key: 'due',      label: t('projSortDue')      },
    ].forEach(({ key, label }) => {
      const b = el('button', 'proj-sort-btn' + (projSortMode === key ? ' active' : ''));
      b.textContent = label;
      b.onclick = () => { projSortMode = key; renderProjPage(); };
      sortWrap.appendChild(b);
    });
    headerActions.appendChild(sortWrap);

    // Apply template button
    if (projTemplates.length > 0) {
      const tmplBtn = el('button', 'proj-tmpl-btn');
      tmplBtn.textContent = t('projApplyTemplate');
      tmplBtn.onclick = () => openTemplateModal(ms, proj);
      headerActions.appendChild(tmplBtn);
    }

    // Add task button
    const addBtn = el('button', 'proj-add-task-btn');
    addBtn.textContent = t('projAddTask');
    addBtn.onclick = () => openTaskModal(null, ms, proj);
    headerActions.appendChild(addBtn);

    header.appendChild(headerActions);
    wrap.appendChild(header);

    // Kanban columns
    const board = el('div', 'proj-board');
    Object.keys(STATUS_CFG).forEach(status => {
      board.appendChild(renderKanbanColumn(status, ms, proj));
    });
    wrap.appendChild(board);

    return wrap;
  }

  function renderProjectsOverview() {
    const wrap = el('div', 'proj-overview');

    if (projProjects.length === 0) {
      const empty = el('div', 'proj-kanban-hint');
      const msg = el('div', 'proj-overview-empty');
      msg.innerHTML = `<svg class="icon icon-lg" style="opacity:0.25"><use href="#i-missions"/></svg><p>${t('projEmptyHint')}</p>`;
      empty.appendChild(msg);
      return empty;
    }

    projProjects.forEach(proj => {
      const card = el('div', 'proj-overview-card');
      card.style.setProperty('--proj-color', proj.color || PROJ_COLORS[0]);

      const cardHead = el('div', 'proj-overview-head');
      const dot = el('span', 'proj-overview-dot');
      cardHead.appendChild(dot);
      const title = el('span', 'proj-overview-title');
      title.textContent = proj.title;
      cardHead.appendChild(title);
      card.appendChild(cardHead);

      const milestones = projMilestones.filter(m => m.project_id === proj.id);
      milestones.forEach(ms => {
        const tasks = projTasks.filter(t => t.milestone_id === ms.id);
        const done  = tasks.filter(t => t.status === 'DONE').length;
        const total = tasks.length;
        const pct   = total > 0 ? Math.round(done / total * 100) : 0;

        const msRow = el('div', 'proj-overview-ms');
        msRow.textContent = ms.title;

        const prog = el('span', 'proj-overview-prog');
        prog.textContent = total > 0 ? `${pct}%` : '—';
        if (pct === 100) prog.classList.add('done');
        msRow.appendChild(prog);

        msRow.onclick = () => {
          projActiveProjectId   = proj.id;
          projActiveMilestoneId = ms.id;
          renderProjPage();
        };
        card.appendChild(msRow);
      });

      wrap.appendChild(card);
    });

    return wrap;
  }

  // ── Kanban column ─────────────────────────────────────────────────────────

  function renderKanbanColumn(status, ms, proj) {
    const cfg = STATUS_CFG[status];

    let tasks = projTasks.filter(t =>
      t.milestone_id === ms.id && t.status === status
    );

    // Sort
    tasks = [...tasks].sort((a,b) => {
      if (projSortMode === 'due') {
        const ad = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
        const bd = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
        return ad - bd;
      }
      return (b.priority||2) - (a.priority||2);
    });

    const col = el('div', 'proj-column');

    const colHead = el('div', 'proj-col-head');
    colHead.style.setProperty('--col-color', cfg.color);
    const colIcon = el('span', 'proj-col-icon');
    colIcon.textContent = cfg.icon;
    colHead.appendChild(colIcon);
    const colLabel = el('span', 'proj-col-label');
    colLabel.textContent = t('projStatus_' + status.replace(' ','_')) || status;
    colHead.appendChild(colLabel);
    const colCount = el('span', 'proj-col-count');
    colCount.textContent = tasks.length;
    colHead.appendChild(colCount);
    col.appendChild(colHead);

    if (tasks.length === 0) {
      const empty = el('div', 'proj-col-empty');
      empty.textContent = t('projColEmpty');
      col.appendChild(empty);
    } else {
      tasks.forEach(task => col.appendChild(renderTaskCard(task, ms, proj)));
    }

    return col;
  }

  // ── Task card ─────────────────────────────────────────────────────────────

  function renderTaskCard(task, ms, proj) {
    const pCfg  = PRIORITY_CFG[task.priority] || PRIORITY_CFG[2];
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = task.due_date ? new Date(task.due_date) : null;
    const overdue  = due && due < today && task.status !== 'DONE';
    const dueToday = due && due.getTime() === today.getTime();

    const card = el('div', 'proj-task-card' + (overdue ? ' overdue' : '') + (dueToday ? ' due-today' : ''));
    card.style.setProperty('--proj-color', proj.color || PROJ_COLORS[0]);

    // Priority badge
    const badge = el('span', 'proj-task-badge');
    badge.textContent = pCfg.dot;
    badge.style.color = pCfg.color;
    card.appendChild(badge);

    // Title
    const titleEl = el('div', 'proj-task-title');
    titleEl.textContent = task.title;
    card.appendChild(titleEl);

    // Due date
    if (due) {
      const duePill = el('span', 'proj-task-due' + (overdue ? ' overdue' : '') + (dueToday ? ' today' : ''));
      duePill.textContent = formatProjDate(due);
      card.appendChild(duePill);
    }

    // Tags
    if (task.tags && task.tags.trim()) {
      const tagsEl = el('div', 'proj-task-tags');
      task.tags.split(',').map(s=>s.trim()).filter(Boolean).forEach(tag => {
        const span = el('span', 'proj-task-tag');
        span.textContent = tag;
        tagsEl.appendChild(span);
      });
      card.appendChild(tagsEl);
    }

    // Notes snippet
    if (task.notes && task.notes.trim()) {
      const notesEl = el('div', 'proj-task-notes');
      const txt = task.notes.trim();
      notesEl.textContent = txt.length > 72 ? txt.slice(0,69)+'…' : txt;
      card.appendChild(notesEl);
    }

    // Actions
    const actions = el('div', 'proj-task-actions');

    const editBtn = el('button', 'proj-task-btn');
    editBtn.textContent = t('projEdit');
    editBtn.onclick = e => { e.stopPropagation(); openTaskModal(task, ms, proj); };
    actions.appendChild(editBtn);

    const cfg = STATUS_CFG[task.status];
    if (cfg && cfg.next) {
      const nextCfg = STATUS_CFG[cfg.next];
      const advBtn  = el('button', 'proj-task-btn advance');
      advBtn.textContent = nextCfg.icon + ' ' + (t('projStatus_' + cfg.next.replace(' ','_')) || cfg.next);
      advBtn.style.setProperty('--adv-color', nextCfg.color);
      advBtn.onclick = e => { e.stopPropagation(); quickAdvance(task, cfg.next); };
      actions.appendChild(advBtn);
    } else if (task.status === 'DONE') {
      const reopenBtn = el('button', 'proj-task-btn');
      reopenBtn.textContent = t('projReopen');
      reopenBtn.onclick = e => { e.stopPropagation(); quickAdvance(task, 'TODO'); };
      actions.appendChild(reopenBtn);
    }

    card.appendChild(actions);
    card.onclick = () => openTaskModal(task, ms, proj);

    return card;
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

    const card = el('div', 'alert-card');
    card.style.borderColor = 'var(--lcars-cream)';

    const head = el('div', 'alert-head');
    head.style.background = 'var(--lcars-cream)';
    head.innerHTML = `<span class="alert-head-title"><svg class="alert-head-icon"><use href="#i-missions"/></svg>${isNew ? t('projAddTask') : t('projEditTask')}</span>`;
    card.appendChild(head);

    const body = el('div', 'alert-body proj-modal-body');

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
