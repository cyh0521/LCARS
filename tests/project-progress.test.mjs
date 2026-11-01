import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
class Element {
  constructor(tag, cls='') { Object.assign(this,{tag,className:cls,children:[],attrs:{},dataset:{},style:{setProperty(){}}}); }
  get lastChild(){return this.children.at(-1);}
  appendChild(node){this.children.push(node);node.parentElement=this;return node;}
  append(...nodes){nodes.forEach(node=>this.appendChild(node));}
  setAttribute(key,value){this.attrs[key]=value;}
  querySelector(tag){return this.children.find(node=>node.tag===tag);}
  focus(){this.focused=true;}
}
function setup(){
 const c=vm.createContext({window:{},Date,URL,currentLang:'zh',t:key=>key,document:{querySelectorAll:()=>[],querySelector:()=>null}});
 vm.runInContext(fs.readFileSync(new URL('../js/project.js',import.meta.url),'utf8'),c);
 c.el=(tag,cls)=>new Element(tag,cls); c.showProjToast=()=>{}; c.now=()=> '2026-11-01';
 return {c,run:s=>vm.runInContext(s,c)};
}
test('status badge expands three choices and saves a changed status',()=>{
 const {c,run}=setup();let saved;
 c.quickAdvance=(task,status)=>{saved=status;task.status=status;};
 const picker=run("renderProgressStatus({title:'Task',status:'DONE'})");
 assert.equal(picker.children[0].dataset.status,'DONE');
 const choices=picker.children[1].children;
 assert.deepEqual(choices.map(button=>button.dataset.status),['TODO','IN PROGRESS','DONE']);
 assert.deepEqual(choices.map(button=>button.attrs['aria-pressed']),['false','false','true']);
 picker.open=true;choices[1].onclick({stopPropagation(){}});assert.equal(saved,'IN PROGRESS');assert.equal(picker.open,false);
 saved=null;choices[1].onclick({stopPropagation(){}});assert.equal(saved,null);
});
test('overview cards navigate to one project without applying overview filters to detail',()=>{
 const {c,run}=setup();
 const walk=node=>[node,...node.children.flatMap(walk)];
 c.escHtml=s=>s;
 run("projProjects=[{id:'p',title:'Project'},{id:'empty',title:'Empty'}];projMilestones=[{id:'m',project_id:'p',title:'Item'}];projTasks=[{id:'task',project_id:'p',milestone_id:'m',title:'Task',status:'TODO',priority:2}]");
 let nodes=walk(run('renderProgressOverview()'));
 assert.equal(nodes.filter(n=>n.className.includes('progress-small-card')).length,2);
 assert.equal(nodes.some(n=>n.className==='progress-project-body'),false);
 run("projDetailId='p';projProgressFilter='done'");
 nodes=walk(run('renderProgressOverview()'));
 assert.equal(nodes.filter(n=>n.className==='progress-project').length,1);
 assert.equal(nodes.filter(n=>n.className==='progress-task').length,1);
 const projectHead=nodes.find(n=>n.className==='progress-project-head');
 assert.equal(projectHead.children.some(n=>n.tag==='button'),false);
 assert.equal(nodes.some(n=>n.className==='progress-quick-add'),false);
 assert.equal(nodes.filter(n=>n.className?.includes('progress-milestone-add')).length,1);
 assert.equal(nodes.some(n=>n.className.includes('progress-back')),true);
 assert.equal(nodes.some(n=>n.className.includes('lib-filter-bar')),false);
 run("projDetailId=null;projProgressFilter='all'");
 nodes=walk(run('renderProgressOverview()'));
 assert.equal(nodes.filter(n=>n.className.includes('progress-small-card')).length,2);
 assert.equal(nodes.some(n=>n.className==='progress-project-body'),false);
});

test('header add creates an item in detail and a project in overview',()=>{
 const {c,run}=setup();let action;
 c.openMilestoneModal=(item,project)=>{action=project.id;};
 c.openProjectModal=()=>{action='new-project';};
 run("projProjects=[{id:'p',title:'Project'}];projDetailId='p';projectAddClick()");assert.equal(action,'p');
 run('projDetailId=null;projectAddClick()');assert.equal(action,'new-project');
 const button=new Element('button');c.document.querySelector=()=>button;
 run("projDetailId='p';updateProjectAddButton()");assert.equal(button.attrs['data-i18n-title'],'projAddMilestone');
 run('projDetailId=null;updateProjectAddButton()');assert.equal(button.attrs['data-i18n-title'],'projAddProject');
});

test('entering a project resets scroll to top and returning restores overview position',()=>{
 const {c,run}=setup();const page={scrollTop:720}, main={scrollTop:360};
 c.document.scrollingElement=page;c.document.querySelectorAll=selector=>selector.includes('progress-project-toggle') ? [] : [main];
 c.renderProjPage=()=>{};
 run("navigateProjectDetail('p')");assert.equal(page.scrollTop,0);assert.equal(main.scrollTop,0);
 page.scrollTop=100;run('navigateProjectDetail(null)');assert.equal(page.scrollTop,720);assert.equal(main.scrollTop,360);
});
