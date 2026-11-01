// Conversations stay in memory; page data is collected only when sending.
(() => {
  const sessions = new Map();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let host, view, ready = false, checked = false;
  const session = page => {
    if (!sessions.has(page)) sessions.set(page, {messages:[], draft:'', busy:false, error:'', source:null});
    return sessions.get(page);
  };
  function snapshot(page) {
    let data;
    if (page === 'project') data = currentWsSubtab === 'attendance'
      ? {section:'attendance', year:attYear, records:attRecords, quotas:attQuotas, loading:attLoading, error:attError}
      : {section:'projects', projects:projProjects, milestones:projMilestones, tasks:projTasks, loading:projLoading, error:projError};
    if (page === 'finance') data = {tab:currentFinanceTab, quotes:cacheGet(STOCKS_CACHE_KEY), funds:cacheGet(FUND_CACHE_KEY), fx:cacheGet(FX_CACHE_KEY), holdings:_portfolioCache?.[currentFinanceTab] ?? null};
    if (page === 'scores') data = {games:lastEventsList};
    if (page === 'library') data = {section:currentLibSubtab, ...(currentLibSubtab === 'films' ? {films:filmsCache} : currentLibSubtab === 'reading' ? {books:booksCache} : {series:libSeriesCache, seasons:libSeasonsCache, episodes:libEpisodesCache})};
    if (page === 'weather') data = {selectedCity:wxCity, selectedDistrict:wxDistrict, forecast:wxData, loading:wxLoading};
    // Bound long collections explicitly and report omissions rather than silently truncating JSON.
    let omitted = false;
    const json = JSON.stringify(data, (key, value) => {
      if (Array.isArray(value) && value.length > 100) { omitted = true; return value.slice(0,100); }
      if (typeof value === 'string' && value.length > 1200) { omitted = true; return value.slice(0,1200)+'…'; }
      return value;
    });
    if (json.length > 90000) throw new Error('此頁資料過多，請先切換到較小的分類再試。 / Too much page data.');
    return {page, capturedAt:new Date().toISOString(), note:'Snapshot time is not source update time. Empty arrays may mean not loaded. No live web access.', omitted, data:JSON.parse(json)};
  }
  function paint() {
    if (!host || !view) return;
    const s = session(view.page), zh = view.language === 'zh', t = (a,b) => zh?a:b;
    host.innerHTML = `<div class="advisor-dialog-person">${view.portrait}<strong>${esc(view.name)}</strong><span class="advisor-presence">${t('一起商量 · AI 試辦','Let’s talk · AI pilot')}</span></div>
      <p class="advisor-connection" role="status">${!checked?t('檢查連線中…','Checking connection…'):ready?t('AI 已就緒','AI ready'):t('AI 尚未設定：請依 AI_SETUP.md 啟動本機服務並設定金鑰及模型。','AI unavailable. Follow AI_SETUP.md to configure the local server.')}</p>
      <div class="advisor-chat-log" role="log" aria-label="${t('對話紀錄','Conversation')}" aria-live="polite" aria-busy="${s.busy}">${s.messages.length?s.messages.map(m=>`<div class="advisor-chat-message ${m.role}"><small>${m.role==='user'?t('你','You'):esc(view.name)}</small><p>${esc(m.content)}</p></div>`).join(''):`<div class="advisor-chat-message"><p>${esc(view.greeting)}</p><small>${t('本機摘要，送出問題後由 AI 回答。','Local summary. Send a question for an AI response.')}</small></div>`}${s.busy?`<p role="status">${t('正在閱讀資料，請稍候…','Reading page data…')}</p>`:''}</div>
      <div class="advisor-prompts">${[t('幫我整理目前狀況','Summarize this page'),t('你建議我下一步怎麼做？','What should I do next?'),t('有哪些需要注意的地方？','What should I watch for?')].map(q=>`<button type="button" class="briefing-button" data-advisor-prompt="${esc(q)}" ${s.busy||!ready?'disabled':''}>${q}</button>`).join('')}</div>
      <form class="advisor-chat-form"><label for="advisor-question">${t('想商量什麼？','What’s on your mind?')}</label><textarea id="advisor-question" rows="3" maxlength="4000" placeholder="${t('輸入問題，可接續追問…','Ask a question or follow up…')}" ${s.busy?'disabled':''}>${esc(s.draft)}</textarea><div class="advisor-chat-actions"><button type="button" class="briefing-button" data-advisor-clear ${s.busy?'disabled':''}>${t('清除對話','Clear')}</button><button type="submit" class="briefing-button" ${s.busy||!ready?'disabled':''}>${t('送出','Send')}</button></div></form>
      <p class="advisor-chat-error" role="alert">${esc(s.error)}</p>
      <p class="advisor-disclaimer">${t('送出時會將目前功能頁資料與最近對話傳給 OpenAI。對話僅保留在此分頁，重新整理即清除；AI 不會修改資料。','Sending shares this page’s data and recent messages with OpenAI. Chat stays in this tab until reload. AI cannot edit your data.')}${s.source?'<br>'+esc(t('本次頁面快照：','Last page snapshot: ')+new Date(s.source.capturedAt).toLocaleTimeString())+(s.source.omitted?t('（部分資料省略）',' (some data omitted)'):''):''}</p>`;
    const log=host.querySelector('.advisor-chat-log'); log.scrollTop=log.scrollHeight;
  }
  async function send(text) {
    const page=view.page, s=session(page);
    text=text.trim(); if (!text || s.busy || !ready) return;
    s.draft=text;
    if (text.length>4000) return;
    s.busy=true; s.error='';
    const language=view.language;
    paint();
    try {
      const context=snapshot(page);
      const response=await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(65000), body:JSON.stringify({page, language, context, messages:[...s.messages.slice(-12),{role:'user',content:text}]})});
      const result=await response.json();
      if (!response.ok || typeof result.reply!=='string' || !result.reply.trim()) throw new Error(result.error || 'AI 回覆失敗 / AI request failed');
      s.messages.push({role:'user',content:text},{role:'assistant',content:result.reply});
      s.draft=''; s.source=context;
    } catch(error) { s.error=error.name==='TimeoutError'?'回覆逾時，問題已保留，可重試。 / Timed out. Please retry.':error.message; }
    finally { s.busy=false; if(view.page===page) { paint(); host.querySelector('textarea')?.focus({preventScroll:true}); } }
  }
  window.LcarsAdvisor={mount(element, options) {
    const changed=host!==element || view?.page!==options.page || view?.language!==options.language;
    if (!host) {
      element.addEventListener('input', e=>{if(e.target.matches('textarea')) session(view.page).draft=e.target.value;});
      element.addEventListener('submit', e=>{e.preventDefault();send(session(view.page).draft);});
      element.addEventListener('click', e=>{
        const prompt=e.target.closest('[data-advisor-prompt]'); if(prompt) send(prompt.dataset.advisorPrompt);
        if(e.target.closest('[data-advisor-clear]') && !session(view.page).busy) {sessions.delete(view.page);paint();}
      });
      fetch('/api/ai-status',{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).then(r=>{ready=r?.configured===true;}).catch(()=>{}).finally(()=>{checked=true;paint();});
    }
    host=element; view=options;
    if(changed) paint();
  }};
})();
