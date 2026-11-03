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
test('status badge cycles through all three states',()=>{
 const {c,run}=setup();let saved;
 c.quickAdvance=(task,status)=>{saved=status;task.status=status;};
 const badge=run("renderProgressStatus({title:'Task',status:'DONE'})");
 assert.equal(badge.dataset.status,'DONE');
 assert.equal(badge.textContent,'projStatus_DONE');
 assert.equal(badge.attrs['aria-label'],'Task projFieldStatus: projStatus_DONE');
 badge.onclick();assert.equal(saved,'TODO');
 badge.onclick();assert.equal(saved,'IN PROGRESS');
 badge.onclick();assert.equal(saved,'DONE');
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
 assert.equal(projectHead.children[0].className.includes('progress-back'),true);
 assert.match(projectHead.children[0].innerHTML,/<svg /);
 assert.equal(projectHead.children[1].className,'progress-detail-title');
 assert.equal(nodes.some(n=>n.className==='progress-quick-add'),false);
 assert.equal(nodes.filter(n=>n.className?.includes('progress-milestone-add')).length,0);
 assert.equal(nodes.some(n=>n.className?.includes('progress-add-task')),false);
 const editTasks=nodes.find(n=>n.className?.includes('progress-tasks-edit'));
 assert.equal(editTasks.parentElement.className,'progress-task-actions');
 assert.equal(editTasks.parentElement.parentElement.className,'progress-milestone');
 const editItems=nodes.find(n=>n.className?.includes('progress-items-edit'));
 assert.equal(editItems.parentElement.className,'progress-item-nav');
 assert.equal(editItems.parentElement.lastChild,editItems);
 assert.equal(nodes.some(n=>n.className?.includes('progress-milestone-edit')),false);
 assert.equal(nodes.some(n=>n.className.includes('progress-back')),true);
 assert.equal(nodes.some(n=>n.className.includes('lib-filter-bar')),false);
 run("projDetailId=null;projProgressFilter='all'");
 nodes=walk(run('renderProgressOverview()'));
 assert.equal(nodes.filter(n=>n.className.includes('progress-small-card')).length,2);
 assert.equal(nodes.some(n=>n.className==='progress-project-body'),false);
});
test('saved task order controls the task list',()=>{
 const {c,run}=setup();
 const walk=node=>[node,...node.children.flatMap(walk)];
 c.escHtml=s=>s;
 run("projProjects=[{id:'p',title:'Project'}];projMilestones=[{id:'m',project_id:'p',title:'Item'}];projTasks=[{id:'a',project_id:'p',milestone_id:'m',title:'First',status:'DONE',priority:1,order:1},{id:'b',project_id:'p',milestone_id:'m',title:'Second',status:'TODO',priority:4,order:2}];projDetailId='p'");
 const titles=walk(run('renderProgressOverview()')).filter(node=>node.className==='progress-task-name');
 assert.deepEqual(titles.map(node=>node.textContent),['First','Second']);
 assert.equal(titles[0].tag,'span');
 assert.equal(titles[0].onclick,undefined);
 const priorities=walk(run('renderProgressOverview()')).filter(node=>node.className==='progress-task-priority');
 assert.deepEqual(priorities.map(node=>node.dataset.priority),['1','4']);
 assert.equal(priorities[0].textContent,undefined);
 assert.equal(priorities[0].attrs['aria-label'],'projFieldPriority: projPriority1');
});
test('editor order persists and controls project and task display',()=>{
 const first=setup(); let stored;
 first.c.persistSet=(_key,value)=>{ stored=structuredClone(value); };
 first.run("saveProjectOrder('milestones','p',['m2','m1']);saveProjectOrder('tasks','m2',['b','a'])");
 assert.deepEqual(stored.milestones.p,['m2','m1']);
 const {c,run}=setup();
 c.persistGet=()=>stored;
 c.escHtml=s=>s;
 const walk=node=>[node,...node.children.flatMap(walk)];
 run("projProjects=[{id:'p',title:'Project'}];projMilestones=[{id:'m1',project_id:'p',title:'Item 1'},{id:'m2',project_id:'p',title:'Item 2'}];projTasks=[{id:'a',project_id:'p',milestone_id:'m2',title:'Task A',status:'TODO',priority:4},{id:'b',project_id:'p',milestone_id:'m2',title:'Task B',status:'DONE',priority:1}];projDetailId='p'");
 const nodes=walk(run('renderProgressOverview()'));
 assert.deepEqual(nodes.filter(node=>node.className==='progress-button progress-item-link').map(node=>node.textContent),['Item 2','Item 1']);
 assert.deepEqual(nodes.filter(node=>node.className==='progress-task-name').map(node=>node.textContent),['Task B','Task A']);
});
test('completion does not reorder tasks and due dates include Chinese weekdays',()=>{
 const {c,run}=setup();
 const walk=node=>[node,...node.children.flatMap(walk)];
 c.escHtml=s=>s;
 run("projProjects=[{id:'p',title:'Project'}];projMilestones=[{id:'m',project_id:'p',title:'Item'}];projTasks=[{id:'a',project_id:'p',milestone_id:'m',title:'First',status:'DONE',priority:1,due_date:'2026-11-02'},{id:'b',project_id:'p',milestone_id:'m',title:'Second',status:'TODO',priority:4}];projDetailId='p'");
 const nodes=walk(run('renderProgressOverview()'));
 assert.deepEqual(nodes.filter(node=>node.className==='progress-task-name').map(node=>node.textContent),['First','Second']);
 const firstRow=nodes.find(node=>node.className==='progress-task');
 assert.equal(firstRow.children[0].className,'progress-task-priority');
 assert.equal(firstRow.children[1].className,'progress-task-name-wrap');
 assert.equal(nodes.find(node=>node.className?.includes('progress-task-date')).textContent,'2026 年 11 月 2 日（一）');
 assert.equal(run("projDateInputValue('2026/11/2')"),'2026-11-02');
 assert.equal(run("projDateInputValue('2026年11月2日')"),'2026-11-02');
 assert.equal(run("formatProjTaskDate('2026/11/2')"),'2026 年 11 月 2 日（一）');
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
