import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../js/advisor.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture() {
  const handlers={},calls=[];
  const host={innerHTML:'',addEventListener:(event,fn)=>handlers[event]=fn,querySelector:()=>({scrollTop:0,scrollHeight:100,focus(){}})};
  let resolveChat;
  const scope={window:{},AbortSignal,Date,Map,JSON,String,Error,
    currentWsSubtab:'project',projProjects:[],projMilestones:[],projTasks:[{title:'任務 <script>'}],projLoading:false,projError:null,
    attYear:2026,attRecords:[],attQuotas:[],attLoading:false,attError:null,
    currentFinanceTab:'watchlist',STOCKS_CACHE_KEY:'stocks',FUND_CACHE_KEY:'funds',FX_CACHE_KEY:'fx',cacheGet:()=>null,_portfolioCache:null,
    lastEventsList:[],currentLibSubtab:'series',libSeriesCache:[],libSeasonsCache:[],libEpisodesCache:[],filmsCache:[],booksCache:[],
    wxCity:'臺北市',wxDistrict:'中正區',wxData:null,wxLoading:false,
    fetch:async(url,options)=>{
      if(url==='/api/ai-status') return {ok:true,json:async()=>({configured:true})};
      calls.push(JSON.parse(options.body));
      return new Promise(resolve=>{resolveChat=resolve;});
    }};
  vm.runInNewContext(source,scope);
  const mount=page=>scope.window.LcarsAdvisor.mount(host,{page,name:page,portrait:'',greeting:'本機摘要',language:'zh'});
  const send=text=>handlers.click({target:{closest:selector=>selector==='[data-advisor-prompt]'?{dataset:{advisorPrompt:text}}:null}});
  const reply=(text,ok=true)=>resolveChat({ok,json:async()=>ok?{reply:text}:{error:text}});
  return {host,handlers,calls,scope,mount,send,reply};
}
test('page sessions, history, escaped output, background updates preserve draft',async()=>{
  const f=fixture();f.mount('project');await tick();
  f.send('第一題');assert.equal(f.calls.length,1);assert.equal(f.calls[0].context.page,'project');
  f.mount('weather');f.reply('<img src=x onerror=alert(1)>');await tick();
  assert.ok(!f.host.innerHTML.includes('&lt;img'));
  f.mount('project');assert.ok(f.host.innerHTML.includes('&lt;img'));assert.ok(!f.host.innerHTML.includes('<img src=x'));
  f.handlers.input({target:{matches:()=>true,value:'尚未送出的草稿'}});
  const html=f.host.innerHTML;f.mount('project');assert.equal(f.host.innerHTML,html);
  f.send('追問');assert.equal(f.calls[1].messages.length,3);f.reply('完成');await tick();
  f.mount('weather');f.send('天氣？');assert.equal(f.calls[2].messages.length,1);assert.equal(f.calls[2].context.data.selectedCity,'臺北市');f.reply('預報未載入');await tick();
});
test('failure retains question for retry and never enters history; all page contexts work',async()=>{
  const f=fixture();f.mount('finance');await tick();f.send('失敗問題');f.reply('額度不足',false);await tick();
  assert.ok(f.host.innerHTML.includes('額度不足'));assert.ok(f.host.innerHTML.includes('>失敗問題</textarea>'));
  f.send('重試');assert.equal(f.calls[1].messages.length,1);f.reply('成功');await tick();
  for(const page of ['project','scores','library','weather']) {
    f.mount(page);f.send('摘要');assert.equal(f.calls.at(-1).context.page,page);f.reply('摘要完成');await tick();
  }
  f.scope.currentWsSubtab='attendance';f.mount('project');f.send('假勤？');assert.equal(f.calls.at(-1).context.data.section,'attendance');f.reply('無紀錄');await tick();
  f.scope.currentLibSubtab='films';f.mount('library');f.send('電影？');assert.ok('films' in f.calls.at(-1).context.data);f.reply('無紀錄');await tick();
  f.scope.currentLibSubtab='reading';f.send('閱讀？');assert.ok('books' in f.calls.at(-1).context.data);f.reply('無紀錄');await tick();
});
