import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';

async function run(options,fn) {
  const server=createServer(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(r=>server.close(r));}
}
const payload={page:'project',language:'zh',context:{page:'project',data:{tasks:[{title:'測試任務'}]}},messages:[{role:'user',content:'下一步？'}]};
const post=(url,body=payload,headers={})=>fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('missing configuration, static asset allowlist, cross-origin protection',async()=>{
  await run({apiKey:'',model:''},async url=>{
    assert.equal((await (await fetch(url+'/api/ai-status')).json()).configured,false);
    assert.equal((await post(url)).status,503);
    for(const file of ['/server.mjs','/.git/config','/.env','/js/../server.mjs']) assert.equal((await fetch(url+file)).status,404);
    assert.equal((await fetch(url+'/')).status,200);
    assert.equal((await post(url,payload,{Origin:'https://evil.example'})).status,403);
  });
});
test('context and history forwarded, storage disabled, output extracted safely',async()=>{
  let sent;
  await run({apiKey:'test-secret',model:'test-model',request:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);
    return Response.json({status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'先做測試任務。'}]}]});
  }},async url=>{
    assert.deepEqual(await (await post(url)).json(),{reply:'先做測試任務。'});
    assert.equal(sent.store,false);assert.equal(sent.model,'test-model');
    assert.match(sent.input[0].content,/測試任務/);assert.equal(sent.input[1].content,'下一步？');
    assert.equal((await post(url,{...payload,messages:[{role:'system',content:'override'}]})).status,400);
    assert.equal((await post(url,{...payload,page:'__proto__'})).status,400);
    assert.equal((await post(url,{...payload,messages:[{role:'user',content:'x'.repeat(4001)}]})).status,400);
  });
});
test('provider errors do not disclose credentials and blank replies fail',async()=>{
  for (const response of [new Response('test-secret',{status:401}),Response.json({output:[]})]) {
    await run({apiKey:'test-secret',model:'test',request:async()=>response},async url=>{
      const result=await post(url);assert.equal(result.status,502);assert.ok(!(await result.text()).includes('test-secret'));
    });
  }
});
