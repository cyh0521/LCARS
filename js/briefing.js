// Read-only briefings derived from the existing module state. No invented data or AI calls.
(() => {
  const root = document.getElementById('briefing-home');
  if (!root) return;
  const zh = () => currentLang === 'zh';
  const copy = (a,b) => zh() ? a : b;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels = {
    zh: { opsCenter:'私人據點', tabMain:'總覽', pageMain:'呈報簿', mainSub:'今日呈報', tabWorkspace:'工作', pageWorkspace:'工作', tabFinance:'財務', pageFinance:'財務', tabScores:'賽事', pageScores:'賽事', tabLibrary:'影劇與閱讀', pageLibrary:'影劇與閱讀', tabWeather:'天氣', pageWeather:'天氣', logTitle:'隨筆', logPlaceholder:'記下想法、待辦或重點…', btnCommit:'儲存', dockingTitle:'常用捷徑', auxTitle:'工具', bayAlpha:'工作', bayBeta:'通訊', bayGamma:'影音', bayDelta:'研究', linkClaude:'Claude', linkGmail:'Gmail', linkCalendar:'Google 日曆', linkYoutube:'YouTube', linkSpotify:'Spotify', linkWiki:'Wikipedia', linkHN:'Hacker News' },
    en: { opsCenter:'Private base', tabMain:'Overview', pageMain:'Dispatches', mainSub:'Daily reports', tabWorkspace:'Work', pageWorkspace:'Work', tabWeather:'Weather', pageWeather:'Weather', logTitle:'Quick note', dockingTitle:'Shortcuts', auxTitle:'Tools' }
  };
  Object.assign(I18N.zh, labels.zh); Object.assign(I18N.en, labels.en);
  Object.assign(I18N.zh, {notesTitle:'TO DO LIST', notesAdd:'+ 新增', notesEmpty:'還沒有待辦，新增一項開始。', notesPlaceholder:'寫下待辦或備忘…'});
  Object.assign(I18N.en, {notesTitle:'TO DO LIST', notesEmpty:'No tasks yet. Add one to get started.', notesPlaceholder:'Add a task or note…'});
  applyLang(); updatePageHeader();
  // One consistent 24px icon family for navigation and briefing actions.
  const iconPaths = {
    main:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    project:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 11h18m-13 5h3m3 0h2"/>',
    finance:'<path d="M4 20V10m6 10V4m6 16v-7m5 7H2"/>',
    scores:'<circle cx="12" cy="12" r="9"/><path d="M6 5c5 4 5 10 0 14m12-14c-5 4-5 10 0 14M7 8l2-1m-1 5h2m-3 4 2 1m8-9-2-1m1 5h-2m3 4-2 1"/>',
    library:'<rect x="3" y="4" width="6" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><path d="m16 5 4-1 3 15-4 1-3-15M5 8h2m5 8h1"/>',
    weather:'<path d="M6 17a4 4 0 1 1 1-8 6 6 0 0 1 11 2 3 3 0 1 1 0 6H6m2 3-1 2m6-2-1 2m6-2-1 2"/>',
    notes:'<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M8 16l1-4L19 2l3 3-10 10-4 1Z"/>',
    refresh:'<path d="M20 7V3l-3 3a8 8 0 0 0-13 6m0 5v4l3-3a8 8 0 0 0 13-6"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  };
  function icon(name) { return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.main}</svg>`; }
  document.querySelectorAll('.tab-btn').forEach(button => {
    const svg=button.querySelector('svg');
    svg.outerHTML=icon(button.dataset.tab);
  });

  const brand=document.createElement('div');
  brand.className='workspace-brand';
  brand.innerHTML='<span class="workspace-mark" aria-hidden="true">◇</span><strong data-i18n="opsCenter">私人據點</strong>';
  document.querySelector('.sidebar').prepend(brand);
  document.querySelector('.sidebar').setAttribute('role','navigation');
  document.querySelector('.sidebar').setAttribute('aria-label','功能導覽 / Navigation');
  const headerDate=document.createElement('time');
  headerDate.className='workspace-date';
  document.querySelector('.header-status').prepend(headerDate);
  function updateDate() {
    const now=new Date();
    headerDate.dateTime=now.toLocaleDateString('sv-SE');
    headerDate.textContent=now.toLocaleDateString(zh()?'zh-TW':'en-US',{year:'numeric',month:'short',day:'numeric',weekday:'short'});
  }
  updateDate(); setInterval(updateDate,60000);
  const advisors = [
    { name:'景綱', en:'Kagetsuna', page:'project' },
    { name:'宗信', en:'Munenobu', page:'finance' },
    { name:'直澄', en:'Naozumi', page:'scores' },
    { name:'小夜', en:'Sayo', page:'library' },
    { name:'晴', en:'Haru', page:'weather' }
  ];
  const advisorName = index => copy(advisors[index].name, advisors[index].en);
  // A bundled portrait atlas: circular crops share one local image request.
  function avatar(index) {
    return `<span class="briefing-avatar portrait-${index}" aria-hidden="true"><img src="images/advisors/council-five-cel.png" alt="" decoding="async" draggable="false"></span>`;
  }
  function rows(items) { return `<ul class="briefing-items">${items.map(x => `<li>${x?.task ? `<strong>${safe(x.title)}</strong><small>${safe(x.date || copy('未設定期限','No deadline'))}${x.priority>=3?`<span class="task-priority">${copy('優先','Priority')}</span>`:''}</small>` : safe(x)}</li>`).join('')}</ul>`; }
  function card(index,category,title,body,items,page,explanation,visual='') {
    const action={project:copy('查看工作','Open work'),finance:copy('查看財務','Open finances'),scores:copy('查看賽況','Open scores'),library:copy('查看影劇與閱讀','Open media & reading'),weather:copy('查看天氣','Open weather')}[page];
    return `<article class="briefing-card" data-area="${page}" data-attention="${index===0}"><div class="briefing-card-top"><div class="dispatch-author">${avatar(index)}<span>${safe(advisorName(index))}</span></div><span class="briefing-category">${icon(page)}${safe(category)}</span></div><div class="briefing-card-body"><h3>${safe(title)}</h3><p>${safe(body)}</p>${items.length ? rows(items) : ''}<div class="briefing-actions"><button class="briefing-link" data-briefing-page="${page}">${action}${icon('arrow')}</button></div><details class="briefing-discussion" data-discussion="${page}"><summary><span>${copy('查閱資料與觀察','Data & observations')}</span></summary><div class="briefing-evidence">${visual}<p>${safe(explanation)}</p></div></details></div></article>`;
  }
  let filter = 'all';
  let selectedAdvisor = 'finance';
  let currentView = 'reports';
  root.innerHTML = '<div class="dispatch-layout"><aside class="retainer-panel"><div id="retainer-directory"></div></aside><div id="briefing-content"></div><aside class="dispatch-context" id="dispatch-context" aria-label="TO DO LIST"></aside></div>';
  const content = document.getElementById('briefing-content');
  const directory = document.getElementById('retainer-directory');
  const context = document.getElementById('dispatch-context');
  const workspace = document.querySelector('.main');
  const conversation = document.createElement('aside');
  conversation.className = 'advisor-dialog';
  conversation.hidden = true;
  workspace.append(conversation);
  const dialogModes = {};
  conversation.addEventListener('click', e => {
    const button = e.target.closest('[data-dialog-mode]');
    if (!button) return;
    dialogModes[currentPage] = button.dataset.dialogMode;
    render(true);
  });
  const notesPanel = document.getElementById('notes-panel');
  context.classList.add('home-notes','todo-panel');
  context.append(notesPanel);
  const pageObserver = new MutationObserver(() => { closeAllPopovers(); render(); });
  document.querySelectorAll('.main>.page').forEach(page => pageObserver.observe(page,{attributes:true,attributeFilter:['hidden']}));
  function applyFilter() {
    content.querySelectorAll('.briefing-card').forEach(card => {
      card.hidden = (selectedAdvisor && card.dataset.area!==selectedAdvisor) || !(filter==='all' || (filter==='attention' && card.dataset.attention==='true') || card.dataset.area===filter || (filter==='life' && ['library','scores','weather'].includes(card.dataset.area)));
    });
    root.querySelectorAll('[data-briefing-filter]').forEach(button => button.setAttribute('aria-pressed',String(!selectedAdvisor && button.dataset.briefingFilter===filter)));
    root.querySelectorAll('[data-advisor]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.advisor===selectedAdvisor)));
    content.querySelectorAll('[data-dispatch-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.dispatchView===currentView)));
    const dispatch = content.querySelector('.daily-dispatch');
    const agenda = content.querySelector('.home-tasks');
    if (dispatch) dispatch.hidden = currentView==='tasks';
    if (agenda) agenda.hidden = currentView!=='tasks';
    const selected = advisors.find(a => a.page===selectedAdvisor);
    const title = content.querySelector('#briefing-list-title');
    if (title) title.textContent = selected ? copy(`${selected.name}的呈報`,`${selected.en}’s report`) : copy('今日呈報','Daily reports');
    if (currentView==='evidence') content.querySelectorAll('.briefing-card:not([hidden]) .briefing-discussion').forEach(d => { d.open=true; });
    const empty=content.querySelector('.briefing-filter-empty');
    if(empty) empty.hidden=Boolean(content.querySelector('.briefing-card:not([hidden])'));
  }
  let lastSignature = '';
  let renderedLanguage = '';
  let loading = false;
  let status = '';
  let lastChecked = null;
  function render(force = false) {
    // Read state after each module has finished its own loading and normalization.
    const tasks = projTasks.filter(x => x.status !== 'DONE').slice().sort((a,b) => {
      const ad = a.due_date || '9999', bd = b.due_date || '9999';
      return ad.localeCompare(bd) || Number(b.priority || 2)-Number(a.priority || 2);
    });
    const stocks = cacheGet(STOCKS_CACHE_KEY);
    const quotes = [...(stocks?.tw || []),...(stocks?.us || [])];
    const games = lastEventsList || [];
    const featured = games.find(e => e.competitions?.[0]?.competitors?.some(c => c.team?.abbreviation === ORIOLES_ABBR)) || games[0];
    const watching = libSeasonsCache.filter(s => s.status === 'WATCHING');
    const reading = booksCache.filter(b => b.status === 'READING');
    const signature = JSON.stringify([currentLang,currentPage,tasks,stocks,featured,watching,reading,libSeriesCache,projLoading,libLoading,loading,status,dialogModes[currentPage]]);
    if (!force && lastSignature === signature) return;
    // Preserve open details and focused controls during automatic updates.
    if (!force && renderedLanguage === currentLang && root.contains(document.activeElement) && document.activeElement.matches('input,textarea,select,[contenteditable="true"]')) return;
    const opened = new Set([...content.querySelectorAll('.briefing-discussion[open]')].map(d => d.dataset.discussion));
    const tasksExpanded=Boolean(content.querySelector('.more-tasks[open]'));
    const focused = workspace.contains(document.activeElement) ? document.activeElement : null;
    let restoreSelector = '';
    if (focused?.id === 'briefing-refresh') restoreSelector = '#briefing-refresh';
    else if (focused?.dataset.advisor) restoreSelector = `[data-advisor="${focused.dataset.advisor}"]`;
    else if (focused?.dataset.dispatchView) restoreSelector = `[data-dispatch-view="${focused.dataset.dispatchView}"]`;
    else if (focused?.dataset.contextView) restoreSelector = `[data-context-view="${focused.dataset.contextView}"]`;
    else if (focused?.dataset.briefingFilter) restoreSelector = `[data-briefing-filter="${focused.dataset.briefingFilter}"]`;
    else if (focused?.dataset.briefingPage) restoreSelector = `${focused.closest('.dispatch-context') ? '.dispatch-context ' : focused.closest('.briefing-card') ? `[data-area="${focused.closest('.briefing-card').dataset.area}"] ` : '.home-tasks '}[data-briefing-page="${focused.dataset.briefingPage}"]`;
    else if (focused?.closest('.briefing-discussion')) restoreSelector = `[data-discussion="${focused.closest('.briefing-discussion').dataset.discussion}"] summary`;
    else if (focused?.closest('.more-tasks')) restoreSelector = '.more-tasks summary';
    lastSignature = signature;
    renderedLanguage = currentLang;
    const today = new Date(); today.setHours(0,0,0,0);
    const soon = new Date(today); soon.setDate(soon.getDate()+3);
    const overdue=tasks.filter(x => x.due_date && new Date(String(x.due_date).slice(0,10)+'T00:00:00')<today);
    const upcoming=tasks.filter(x => x.due_date && new Date(String(x.due_date).slice(0,10)+'T00:00:00')>=today && new Date(String(x.due_date).slice(0,10)+'T00:00:00')<=soon);
    const projectText = overdue.length || upcoming.length
      ? copy(`有 ${overdue.length} 項逾期、${upcoming.length} 項在三天內到期。建議先確認能否如期完成，再調整工作安排。`,`${overdue.length} overdue and ${upcoming.length} due within three days. Review feasibility before adjusting your schedule.`)
      : copy(`目前可查看 ${tasks.length} 項未完成任務，沒有逾期或三天內到期的項目。可先檢視範圍與優先順序。`,`${tasks.length} open tasks are available, with none overdue or due within three days. Review scope and priorities first.`);
    const competitors = featured?.competitions?.[0]?.competitors || [];
    const gameTitle = competitors.length ? competitors.map(x => `${x.team?.abbreviation || x.team?.displayName} ${x.score ?? '—'}`).join(' : ') : copy('目前沒有可用賽況','No scores available');
    const quoteVisual=quotes.length ? `<div class="quote-snapshot">${quotes.slice(0,3).map(q=>`<div class="quote-line"><span><strong>${safe(q.code)}</strong><small>${safe(q.currency)}</small></span><b>${safe(Number(q.price).toLocaleString())}</b><em class="${Number(q.pct)>=0?'quote-up':'quote-down'}">${Number.isFinite(q.pct)?safe((q.pct>0?'+':'')+q.pct+'%'):'—'}</em></div>`).join('')}</div>` : '';
    const scoreVisual=competitors.length ? `<div class="match-snapshot" aria-label="${safe(gameTitle)}">${competitors.slice(0,2).map(c=>`<div><span class="team-monogram">${safe(c.team?.abbreviation || '?')}</span><strong>${safe(c.score ?? '—')}</strong><small>${safe(c.team?.shortDisplayName || c.team?.abbreviation || '')}</small></div>`).join('<span class="match-divider">:</span>')}</div>` : '';
    const mediaEntries=watching.slice(0,2).map(season=>{
      const series=libSeriesCache.find(s=>String(s.id)===String(season.series_id));
      return {title:series?.title_zh || series?.title_original || copy('影集','Series'),meta:copy(`第 ${season.season_number} 季 · 觀看中`,`Season ${season.season_number} · Watching`),path:series?.id?`images/posters/series/${encodeURIComponent(series.id)}.jpg`:''};
    }).concat(reading.slice(0,2).map(book=>({title:book.title_zh || book.title,meta:copy('閱讀中','Reading'),path:book.id?`images/posters/books/${encodeURIComponent(book.id)}.jpg`:''})));
    const mediaVisual=mediaEntries.length ? `<div class="media-snapshot">${mediaEntries.map(m=>`<div class="media-snapshot-item"><div class="media-cover">${icon('library')}${m.path?`<img src="${safe(m.path)}" alt="" loading="lazy">`:''}</div><div><strong>${safe(m.title)}</strong><small>${safe(m.meta)}</small></div></div>`).join('')}</div>` : '';
    const taskRows=tasks.map(x => ({task:true,title:x.title,date:x.due_date,priority:Number(x.priority)}));
    const filters=[['all',copy('全部呈報','All reports')],['attention',copy('時程提醒','Deadlines')],['life',copy('生活','Life')]];
    updateDate();
    const isHome = currentPage === 'main';
    workspace.classList.toggle('has-advisor', !isHome);
    conversation.hidden = isHome;
    if (!isHome) {
      const person = {project:0,finance:1,scores:2,library:3,weather:4}[currentPage] ?? 0;
      const mode = dialogModes[currentPage] || 'status';
      const messages = {
        project: [projectText, copy('先挑一件能推進的工作。把下一步寫清楚，再決定今天要投入多少時間。','Choose one actionable task, define its next step, then set aside time.'), copy('先確認有期限的任務與依賴關係。未設定期限，不代表可以一直往後放。','Check due dates and dependencies. An undated task still needs a plan.')],
        finance: [quotes.length ? copy(`目前可查閱 ${quotes.length} 筆追蹤報價。先確認報價日期，再看漲跌。`,`${quotes.length} tracked quotes are available. Check their dates first.`) : copy('目前沒有可用報價，等資料更新後再判讀。','No quotes are available yet. Wait for an update.'), copy('先盤點持倉比例、可用現金與近期支出，再考慮是否需要調整。','Review allocation, cash and upcoming spending before considering changes.'), copy('單日漲跌不足以判斷方向。先確認資料時點與自己的風險承受範圍。','One day of movement does not establish a trend. Check data freshness and risk tolerance.')],
        scores: [featured ? copy(`這次先看：${featured.name || featured.shortName || '今日賽程'}。比分與狀態以頁面資料為準。`,`Start with ${featured.name || featured.shortName || 'today’s schedule'}. Check the page for current status.`) : copy('目前沒有可用賽程，先等資料載入。','No schedule is available yet.'), copy('先看關注球隊的比賽，再看分區戰績，會比較容易掌握整體狀況。','Start with your team, then compare the division standings.'), copy('比賽開始時間與即時比分可能有延遲，觀賽前再確認一次。','Start times and live scores can lag. Check again before watching.')],
        library: [copy(`目前有 ${watching.length} 部影集觀看中、${reading.length} 本書閱讀中。`,`${watching.length} shows and ${reading.length} books are in progress.`), copy('今晚先從正在進行的一部作品接著看或讀。留一點餘裕，不必把休閒也排滿。','Continue one title already in progress. Leave room to unwind.'), copy('如果一部作品已經停了很久，可以重新決定要繼續或暫停，不必為了完成而勉強。','Reconsider stalled titles. You can pause something without forcing yourself to finish.')],
        weather: [copy('出門安排交給我一起看。先確認所在地區，再看逐時預報。','Let’s review your outing. Check the selected area and hourly forecast.'), copy('把外出時間對照逐時降雨與氣溫，再決定雨具和衣著。','Compare your outing time with hourly rain and temperature before choosing what to bring.'), copy('不同地區的天氣可能差很多；跨區移動時，記得切換目的地查看。','Weather varies by area. Check your destination when travelling.')]
      };
      const options = [['status',copy('目前狀況','Status')],['advice',copy('給我建議','Advice')],['caution',copy('需要注意什麼','Watch for')]];
      const message = (messages[currentPage] || messages.project)[{status:0,advice:1,caution:2}[mode] || 0];
      conversation.setAttribute('aria-label',copy(`${advisorName(person)}的對話`,`${advisorName(person)}’s conversation`));
      conversation.innerHTML = `<div class="advisor-dialog-person">${avatar(person)}<strong>${safe(advisorName(person))}</strong><span class="advisor-presence">${copy('一起商量','Let’s talk')}</span></div><div class="advisor-speech" aria-live="polite"><p>${safe(message)}</p></div><div class="advisor-prompts">${options.map(([key,label])=>`<button class="briefing-button" data-dialog-mode="${key}" aria-pressed="${mode===key}">${label}</button>`).join('')}</div><p class="advisor-disclaimer">${copy('依現有資料與固定規則整理，尚未接入 AI 對話。','Based on available data and preset guidance. AI chat is not connected.')}</p>`;
    }

    context.setAttribute('aria-label','TO DO LIST');
    const datedTasks=taskRows.filter(task=>task.date);
    const recentTasks=(datedTasks.length?datedTasks:taskRows).slice(0,3);

    directory.innerHTML = `<h2 class="retainer-heading">${copy('一起商量的人','Your council')}</h2><nav class="retainer-directory" aria-label="${copy('選擇呈報人物','Select a contributor')}">${advisors.map((a,i)=>`<button class="retainer-choice" data-advisor="${a.page}" aria-pressed="${a.page===selectedAdvisor}" aria-controls="briefing-content">${avatar(i)}<span>${safe(advisorName(i))}</span><span class="retainer-pointer" aria-hidden="true">›</span></button>`).join('')}</nav><nav class="briefing-filters" aria-label="${copy('呈報篩選','Report filters')}">${filters.map(([key,label])=>`<button class="briefing-button" data-briefing-filter="${key}" aria-pressed="${!selectedAdvisor && filter===key}">${label}</button>`).join('')}</nav>`;
    content.innerHTML = `<nav class="dispatch-tabs" aria-label="${copy('呈報簿分頁','Dispatch views')}">${[['reports',copy('今日呈報','Reports')],['tasks',copy('交代的事','Tasks')],['evidence',copy('資料與觀察','Evidence')]].map(([key,label])=>`<button data-dispatch-view="${key}" aria-pressed="${currentView===key}">${label}</button>`).join('')}</nav><header class="briefing-heading"><div><p>${lastChecked?copy('上次檢查：','Last checked: ')+safe(lastChecked.toLocaleTimeString(zh()?'zh-TW':'en-US',{hour:'2-digit',minute:'2-digit'})):copy('正在取得各領域資料','Checking your sources')}</p></div><button class="briefing-button refresh-briefing" id="briefing-refresh" ${loading?'disabled':''}>${icon('refresh')}${loading?copy('更新中…','Updating…'):copy('更新呈報','Refresh')}</button></header>
      ${status?`<p class="briefing-error" role="status">${safe(status)}</p>`:''}
      <div class="home-workspace"><section class="home-tasks" aria-labelledby="home-task-title"><div class="home-section-heading"><h2 id="home-task-title">${copy('待辦事項','Tasks')} <span>${tasks.length}</span></h2><button class="briefing-link" data-briefing-page="project">${copy('查看全部工作','Open all work')}${icon('arrow')}</button></div>${tasks.length?rows(taskRows.slice(0,3)):`<p class="agenda-empty">${loading?copy('正在讀取任務…','Loading tasks…'):copy('目前沒有可顯示的未完成任務。','No open tasks available.')}</p>`}${tasks.length>3?`<details class="more-tasks" ${tasksExpanded?'open':''}><summary>${copy('其他','Show remaining')} ${tasks.length-3} ${copy('項待辦','tasks')}</summary>${rows(taskRows.slice(3))}</details>`:''}</section>
      <section class="daily-dispatch" aria-labelledby="briefing-list-title"><div class="dispatch-heading"><h2 id="briefing-list-title">${copy('今日呈報','Daily reports')}</h2></div><div class="briefing-list">`+
      card(0,copy('工作','Work'),copy('先確認範圍，再安排下一步。','Review the scope before the next step.'),projectText,[],'project',copy('以任務期限推算逾期與未來三天內到期的項目，不修改任務狀態。完整清單可在「交代的事」或工作頁查看。','Counts overdue and next-three-day tasks without changing their status. See Tasks or Work for the full list.'))+
      card(1,copy('財務','Finance'),quotes.length?copy(`已取得 ${quotes.length} 筆追蹤報價`,`${quotes.length} tracked quotes available`):copy('尚無可用報價','No quotes available'),quotes.length ? copy(`追蹤標的包含 ${quotes.slice(0,3).map(q=>q.code).join('、')}。展開可查看最近取得的價格與漲跌。`,`Including ${quotes.slice(0,3).map(q=>q.code).join(', ')}. Expand to see available prices and changes.`) : copy('可更新簡報，或前往財務頁確認資料。','Refresh or open Finance to check the source.'),[],'finance',copy('報價來自最近一次成功載入的資料；報價日期及完整持倉請以財務頁為準。','Quotes reflect the latest successful fetch. Check quote dates and holdings in Finance.'),quoteVisual)+
      card(2,copy('賽事','Sports'),gameTitle,featured ? `${featured.status?.type?.detail || ''}${featured.date?' · '+new Date(featured.date).toLocaleDateString(zh()?'zh-TW':'en-US'):''}` : copy('可前往賽事頁確認當日賽程。','Open Sports to check today’s schedule.'),[],'scores',copy('優先顯示金鶯隊比賽；沒有金鶯賽事時顯示當日第一場。賽程、進行中與完賽狀態以資料來源為準。','Shows the Orioles game first, otherwise the first available event. Status and scores come from the source.'),scoreVisual)+
      card(3,copy('影劇與閱讀','Media & reading'),mediaEntries.length?copy(`${watching.length} 部影集、${reading.length} 本書正在進行中`,`${watching.length} shows and ${reading.length} books in progress`):copy('沒有可用的進行中紀錄','No active records available'),mediaEntries.length ? mediaEntries.slice(0,3).map(m=>m.title).join('、') : copy('在影劇與閱讀頁設定觀看或閱讀進度。','Set viewing or reading progress in the Library.'),[],'library',copy('依觀看中及閱讀中的紀錄整理。可在影劇與閱讀頁查看集數、評分和筆記。','Based on watching and reading records. Open the Library for episodes, ratings and notes.'),mediaVisual)+
      card(4,copy('天氣','Weather'),copy('出門前，一起看看天氣。','Let’s check before heading out.'),copy('確認目的地與外出時間，再看逐時氣溫和降雨。','Check your destination and outing time, then review hourly temperature and rain.'),[],'weather',copy('實際預報請到天氣頁選擇地區查看。','Open Weather and select an area for the forecast.'))+'</div><p class="briefing-filter-empty" hidden>'+copy('這個分類目前沒有需要顯示的簡報。','No briefings in this category.')+'</p></section></div><p class="dispatch-footnote">'+copy('呈報依現有資料在本機整理；人物名稱為暫定，尚未接入 AI 對話。','Reports are derived locally from existing data. Names are provisional; AI chat is not connected.')+'</p>';
    content.querySelector('[data-area="project"]').dataset.attention=String(overdue.length+upcoming.length>0);
    content.querySelectorAll('.briefing-discussion').forEach(d => { d.open = opened.has(d.dataset.discussion); });
    applyFilter();
    if(restoreSelector) workspace.querySelector(restoreSelector)?.focus({preventScroll:true});
  }
  async function refresh() {
    if (loading) return;
    loading=true; status=''; render(true);
    try {
      const results = await Promise.allSettled([fetchProject(),fetchLibrary(),fetchReading(),fetchStocks(),fetchScores()]);
      if (results.some(x => x.status === 'rejected') || projError) {
        status=copy('部分資料更新未成功，目前顯示可取得的內容。可再次更新，或至各功能頁查看狀態。','Some updates failed. Available data remains visible. Retry or check the individual pages.');
      }
    } finally { lastChecked=new Date(); loading=false; render(true); }
  }
  root.addEventListener('click',e => {
    const button=e.target.closest('[data-briefing-page]');
    if(button) switchPage(button.dataset.briefingPage);
    if(e.target.closest('#briefing-refresh')) refresh();
    const filterButton=e.target.closest('[data-briefing-filter]');
    if(filterButton) { selectedAdvisor=null; filter=filterButton.dataset.briefingFilter; currentView='reports'; applyFilter(); }
    const advisorButton=e.target.closest('[data-advisor]');
    if(advisorButton) { selectedAdvisor=advisorButton.dataset.advisor; filter='all'; if(currentView==='tasks') currentView='reports'; applyFilter(); }
    const viewButton=e.target.closest('[data-dispatch-view]');
    if(viewButton) { currentView=viewButton.dataset.dispatchView; applyFilter(); }
  });
  context.addEventListener('click',e => {
    const pageButton=e.target.closest('[data-briefing-page]');
    if(pageButton) switchPage(pageButton.dataset.briefingPage);
    const viewButton=e.target.closest('[data-context-view]');
    if(viewButton) {
      currentView=viewButton.dataset.contextView;
      if(currentPage!=='main') switchPage('main');
      applyFilter();
      content.querySelector('[data-dispatch-view="tasks"]')?.focus({preventScroll:true});
    }
  });
  root.addEventListener('error',e => { if(e.target.matches('.media-cover img')) e.target.remove(); },true);
  // Existing page logic remains the source of truth; summaries never write business data.
  render();
  refresh();
  setInterval(() => { if(!document.hidden) render(); },2000);
})();
