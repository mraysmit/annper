/* Run: node tools/Test-Mockups.cjs
 * Pure contract regressions extracted from the real single-file implementations.
 * UI dialogs/rendering are purpose-built protocol fixtures, not a browser or a
 * mocking framework. Browser interaction/reflow/focus checks remain separate.
 * UI-01..12: WDES-007/019/022, NFR-ACC-001, NFR-UI-001, design §§7,10,11.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'prototype/gdframework-web-mockup.html'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'prototype/gdframework-admin-mockup.html'), 'utf8');
function json(html, id) {
  const match = html.match(new RegExp('<script id="' + id + '" type="application/json">([\\s\\S]*?)</script>'));
  assert.ok(match, id + ' exists');
  return JSON.parse(match[1]);
}
for (const [name, html] of [['runtime', runtime], ['Studio', admin]]) {
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (match[1].includes('application/json')) JSON.parse(match[2]);
    else new vm.Script(match[2], { filename: name });
  }
}
function implementation(html, name) {
  const lines = html.split('\n');
  const start = lines.findIndex(line => new RegExp('^    (?:async )?function ' + name + '\\(').test(line));
  assert.ok(start >= 0, name + ' implementation exists');
  // Functions use a four-space declaration and either a one-line body or a
  // four-space closing brace; nested function bodies are further indented.
  if (lines[start].trimEnd().endsWith('}')) return lines[start];
  let end = start + 1;
  while (end < lines.length && !/^    }\s*$/.test(lines[end])) end++;
  assert.ok(end < lines.length, name + ' closes');
  return lines.slice(start, end + 1).join('\n');
}
const fixtures = json(admin, 'admin-fixtures');
const initial = json(admin, 'admin-metadata');
function studio() {
  const controls = { confirmPublish: { checked: true }, rollbackConfirm: { checked: true } };
  const messages = [], dialogs = [];
  const context = vm.createContext({
    structuredClone, Intl, Date, Object, Number, Set, JSON,
    document: { getElementById: id => controls[id] },
    toast: (...args) => messages.push(args), status: () => {},
    render: () => {}, updateChrome: () => {}, closeModal: () => {},
    showModal: (title, body, buttons) => dialogs.push({ title, body, buttons }),
  });
  const names = ['configuration','canonical','digest','hash','freeze','restore','readOnly','invalidate',
    'isStableId','configurationShapeIssues','importConfiguration','reconcileSelection','duplicateScreen','reportPreview',
    'renderValues','renderScreens','renderDataClasses','renderSecurity',
    'auditTarget','appendAudit','checkpoint','startNextDraft','selectVersion','comparison',
    'recordApproval','rollbackTo','publish','validationIssues','fixtureRows','previewValue','screenCanvas'];
  const bootstrap = admin.slice(admin.indexOf('    const configKeys='), admin.indexOf('    const modules=['));
  vm.runInContext(`const initial=${JSON.stringify(initial)},model=structuredClone(initial),fixtures=${JSON.stringify(fixtures)};
    const state={appId:'ops',selectedScreen:'orders',selectedField:'amount',selectedDataClass:'orders',
      selectedRole:'operations-editor',reviewActor:'Jordan Lee',viewVersion:null,validated:false,
      validation:null,approvals:{},history:[],future:[],dirty:0,publicationNote:''};
    ${admin.split('\n').find(line=>line.startsWith('    const esc='))}
    const host={innerHTML:''};
    const app=()=>model.applications.find(a=>a.id===state.appId);
    const dc=()=>model.dataClasses.find(d=>d.id===state.selectedDataClass);
    const list=()=>model.valueLists.find(v=>v.id===state.selectedList);
    const dcFor=s=>model.dataClasses.find(d=>d.id===s.dataClassId);
    const screen=()=>model.screens.find(s=>s.id===state.selectedScreen);
    ${names.map(name => implementation(admin, name)).join('\n')}
    ${bootstrap}`, context);
  return { run: code => vm.runInContext(code, context), messages, dialogs };
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function validCandidate(s) {
  s.run(`state.validated=true;state.validation={serialized:canonical(configuration()),digest:digest()};`);
}
test('UI-02: seed catalogue validates without blocking errors', () => {
  assert.equal(studio().run("validationIssues().filter(i=>i.severity==='error').length"), 0);
});
test('UI-02: missing currency format blocks publish after validation', () => {
  const s=studio(); validCandidate(s);
  s.run("screen().fields.find(f=>f.id==='amount').format='';publish();");
  assert.equal(s.dialogs.length, 0);
  assert.match(s.messages.at(-1)[0], /blocked/);
});
test('UI-02: invalid references and unapproved sources are diagnosed', () => {
  const s=studio();
  s.run("screen().dataClassId='missing';model.dataClasses[0].source='unsafe';");
  assert.ok(s.run("validationIssues().some(i=>i.code==='UNAPPROVED_SOURCE')"));
  assert.ok(s.run("validationIssues().some(i=>i.path==='screens.orders')"));
});
test('UI-03: author cannot approve own candidate', () => {
  const s=studio();validCandidate(s);s.run("recordApproval('Product')");
  assert.equal(s.run('Object.keys(state.approvals).length'),0);
});
test('UI-03: wrong checker role is rejected', () => {
  const s=studio();validCandidate(s);s.run("state.reviewActor='Priya Raman';recordApproval('Security')");
  assert.equal(s.run('Object.keys(state.approvals).length'),0);
});
test('UI-03: publication requires all three approvals', () => {
  const s=studio();validCandidate(s);s.run('publish()');assert.equal(s.dialogs.length,0);
  assert.match(s.messages.at(-1)[0],/approvals/);
});
test('UI-03/12: approvals and audit do not change configuration digest', () => {
  const s=studio();validCandidate(s);const before=s.run('digest()');
  s.run("state.reviewActor='Priya Raman';recordApproval('Product')");
  assert.equal(s.run('digest()'),before);
  assert.equal(s.run('state.approvals.Product.digest'),before);
});
test('UI-03: editing invalidates validation and all approvals', () => {
  const s=studio();validCandidate(s);
  s.run("state.reviewActor='Priya Raman';recordApproval('Product');checkpoint('Updated field',()=>screen().fields[0].caption='Changed');");
  assert.equal(s.run('state.validated'),false);assert.equal(s.run('Object.keys(state.approvals).length'),0);
});
test('UI-04: published selection loads a genuinely read-only snapshot', () => {
  const s=studio();s.run("selectVersion('ver-2026-09-1')");
  assert.equal(s.run("screen().fields.find(f=>f.id==='amount').format"),'GBP,0');
  s.run("checkpoint('Updated field',()=>screen().fields[0].caption='Bad edit')");
  assert.notEqual(s.run('screen().fields[0].caption'),'Bad edit');
  s.run("selectVersion('draft')");assert.equal(s.run("screen().fields.find(f=>f.id==='amount').format"),'GBP,0.00');
});
test('UI-04: snapshot payload cannot be changed by later draft edits', () => {
  const s=studio();const before=s.run('digest(releases[0].snapshot)');
  s.run("checkpoint('Updated field',()=>screen().fields[0].caption='Changed')");
  assert.equal(s.run('digest(releases[0].snapshot)'),before);
});
test('UI-04: publish supersedes old release and creates a fresh draft', () => {
  const s=studio();validCandidate(s);
  s.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Test Reviewer']]){state.reviewActor=actor;recordApproval(role);}state.publicationNote='Accepted fixture health warning';publish();`);
  assert.equal(s.dialogs.length,1);s.dialogs[0].buttons.find(b=>b.label==='Publish').action();
  assert.equal(s.run('releases[0].status'),'Published');assert.equal(s.run('releases[1].status'),'Superseded');
  assert.equal(s.run('model.draft.label'),'Draft 2026.09.3');assert.ok(s.run('Object.isFrozen(releases[0].snapshot.screens)'));
});
test('UI-04: rollback reactivates known-good and withdraws failed version', () => {
  const s=studio();const digest=s.run('releases[1].digest');s.run("rollbackTo('ver-2026-08-4')");
  s.dialogs[0].buttons.find(b=>b.label==='Rollback').action();
  assert.equal(s.run('releases[0].status'),'Withdrawn');assert.equal(s.run('releases[1].status'),'Published');
  assert.equal(s.run('digest()'),digest);assert.equal(s.run('audit[0].action'),'Rolled back publication');
});
test('UI-12: compensating configuration restore retains audit records', () => {
  const s=studio();s.run("checkpoint('Updated field',()=>screen().fields[0].caption='Changed')");
  const count=s.run('audit.length');
  s.run("const entry=state.history.pop();restore(entry.config);appendAudit('Undid configuration change',entry.target,entry.label)");
  assert.equal(s.run('audit.length'),count+1);assert.equal(s.run('audit[1].action'),'Updated field');
});
test('UI-11: fixture values follow binding and type, not column position', () => {
  const s=studio();assert.equal(s.run("previewValue({binding:'amount',type:'currency',format:'GBP,0.00'},fixtures.datasets.orders[0])"),'£48,250.00');
  assert.match(s.run("previewValue({binding:'order_date',type:'date'},fixtures.datasets.orders[0])"),/2026/);
  assert.equal(typeof fixtures.datasets.orders[0].amount,'number');
});
test('UI-06: empty required number remains empty; zero remains valid', () => {
  const ctx=vm.createContext({Number});
  vm.runInContext(implementation(runtime,'collectForm')+'\n'+implementation(runtime,'validate'),ctx);
  const form={querySelectorAll:()=>[{dataset:{field:'limit'},type:'number',value:''}]};ctx.form=form;
  assert.equal(vm.runInContext('collectForm(form).limit',ctx),'');
  assert.equal(vm.runInContext("validate([{id:'limit',label:'Limit',type:'number',required:true}],collectForm(form)).length",ctx),1);
  form.querySelectorAll=()=>[{dataset:{field:'limit'},type:'number',value:'0'}];
  assert.equal(vm.runInContext("validate([{id:'limit',label:'Limit',type:'number',required:true}],collectForm(form)).length",ctx),0);
});
test('UI-06: non-finite numeric input is rejected', () => {
  const ctx=vm.createContext({Number});vm.runInContext(implementation(runtime,'validate'),ctx);
  assert.equal(vm.runInContext("validate([{id:'x',label:'X',type:'number'}],{x:Infinity}).length",ctx),1);
});
test('UI-11: each seeded DataClass fixture conforms to its result schema', () => {
  const s=studio();assert.equal(s.run("model.dataClasses.flatMap(d=>fixtureRows(d).flatMap(row=>d.resultFields.filter(f=>!(f in row)))).length"),0);
});
test('UI-11: all seven preview renderer families consume registered fixtures', () => {
  const s=studio();
  assert.equal(s.run('new Set(model.screens.map(s=>s.type)).size'),7);
  assert.ok(s.run("model.screens.every(s=>screenCanvas(s).includes(s.caption))"));
  assert.ok(s.run("screenCanvas(screen()).includes('£48,250.00')"));
});
test('UI-11: incompatible fixture dates are reported without a rendering crash', () => {
  const s=studio();
  assert.equal(s.run("previewValue({binding:'amount',type:'date'},fixtures.datasets.orders[0])"),'Invalid date fixture');
});
test('Pass 2: malformed nested import leaves configuration and audit unchanged', () => {
  const s=studio(),before=s.run('canonical(configuration())'),count=s.run('audit.length');
  assert.throws(()=>s.run("const incoming=configuration();incoming.screens[0].fields=null;importConfiguration(incoming)"),/fields/);
  assert.equal(s.run('canonical(configuration())'),before);assert.equal(s.run('audit.length'),count);
});

test('Pass 2: editor IDs reject unsafe attribute/delimiter values consistently', () => {
  const s=studio();
  for(const id of ['good-id','limitCheck','new_field'])assert.equal(s.run(`isStableId(${JSON.stringify(id)})`),true);
  for(const id of ['bad"id','bad:id','__proto__','constructor','1bad'])assert.equal(s.run(`isStableId(${JSON.stringify(id)})`),false);
});

test('Pass 2: malformed collections and unsafe imported IDs are rejected', () => {
  const s=studio();
  assert.ok(s.run("const bad=configuration();bad.roles={};bad.navigation.ops[0].items='bad';configurationShapeIssues(bad).length>=2"));
  assert.ok(s.run("const unsafe=configuration();unsafe.screens[0].id='bad\" onclick=\"';configurationShapeIssues(unsafe).length>0"));
});

test('Pass 2: valid import is a configuration-only audited draft change', () => {
  const s=studio();s.run("const incoming=configuration();incoming.applications[0].name='Imported Ops';incoming.audit=[];importConfiguration(incoming)");
  assert.equal(s.run('model.applications[0].name'),'Imported Ops');assert.equal(s.run('audit[0].action'),'Imported JSON draft');
  assert.equal(s.run('state.history.length'),1);assert.equal(s.run('state.validated'),false);
});

test('Pass 2: empty editors show recoverable states rather than throwing', () => {
  const s=studio();
  for(const [collection,renderer,expected] of [['valueLists','renderValues','No value lists'],['screens','renderScreens','No screens'],['dataClasses','renderDataClasses','No DataClasses'],['roles','renderSecurity','No roles']]){
    s.run(`model.${collection}=[];${renderer}()`);assert.match(s.run('host.innerHTML'),new RegExp(expected));
  }
});

test('Pass 2: a new application exposes existing roles with no implicit grants', () => {
  const s=studio();s.run("model.screens.push({id:'new-home',appId:'new',caption:'New home'});state.appId='new';renderSecurity()");
  assert.match(s.run('host.innerHTML'),/Operations reader/);assert.match(s.run('host.innerHTML'),/New home/);
  assert.equal(s.run("host.innerHTML.includes('checked')"),false);
});

test('Pass 2: restoring configuration reconciles a deleted application selection', () => {
  const s=studio();s.run("state.appId='deleted';state.selectedScreen='deleted-home';state.navSelection='group:missing';reconcileSelection()");
  assert.equal(s.run('state.appId'),'ops');assert.equal(s.run('state.selectedScreen'),'orders');assert.equal(s.run('state.navSelection'),null);
});

test('Pass 2: repeated screen duplication allocates distinct stable IDs', () => {
  const s=studio();s.run("duplicateScreen();state.selectedScreen='orders';duplicateScreen()");
  assert.equal(s.run("model.screens.filter(s=>s.id.startsWith('orders-copy')).length"),2);
  assert.ok(s.run("model.screens.some(s=>s.id==='orders-copy-2')"));
});

test('Pass 2: report previews follow JSON bindings, order and currency format', () => {
  const s=studio(),html=s.run("reportPreview(model.reports.find(r=>r.id==='order-export'))");
  assert.match(html,/Northstar Retail/);assert.match(html,/£48,250\.00/);assert.doesNotMatch(html,/>Sample 2?</);
  s.run("model.reports[0].columns=[{field:'missing',caption:'Missing',format:''}]");
  assert.match(s.run('reportPreview(model.reports[0])'),/no fixture binding/);
});

function inventory() {
  const source=json(runtime,'mock-datasources'),messages=[];
  const context=vm.createContext({structuredClone,Number,Object,Set,JSON,
    renderAll:()=>{},renderTabs:()=>{},toast:(...args)=>messages.push(args)});
  vm.runInContext(`const db=${JSON.stringify(source.dataSources)},metadata=${JSON.stringify(source.screenDefinitions)};
    const state={screens:{},tabs:[{key:'inventory:ops',screenId:'inventory'}],activeTab:'inventory:ops'};
    ${['screenState','discardDraft','saveStock'].map(name=>implementation(runtime,name)).join('\n')}`,context);
  return {run:code=>vm.runInContext(code,context),messages};
}

test('Pass 2: stock change set validates every row before any mutation', () => {
  const s=inventory(),before=s.run('JSON.stringify(db.stock)');
  s.run("screenState('inventory').stockDrafts={[db.stock[0].id]:'999',[db.stock[1].id]:''};screenState('inventory').dirty=true");
  assert.equal(s.run('saveStock(metadata.inventory)'),false);assert.equal(s.run('JSON.stringify(db.stock)'),before);
  assert.equal(s.run("screenState('inventory').dirty"),true);
});

test('Pass 2: stock counts reject negative, fractional and non-finite quantities', () => {
  const s=inventory();for(const value of ['-1','0.5','Infinity','9007199254740992']){
    s.run(`screenState('inventory').stockDrafts={[db.stock[0].id]:${JSON.stringify(value)}}`);
    assert.equal(s.run('saveStock(metadata.inventory)'),false);
  }
});

test('Pass 2: zero stock commits and clears the in-memory dirty state', () => {
  const s=inventory();s.run("screenState('inventory').stockDrafts={[db.stock[0].id]:'0'};screenState('inventory').dirty=true");
  assert.equal(s.run('saveStock(metadata.inventory)'),true);
  assert.equal(s.run('db.stock[0].onHand'),s.run('db.stock[0].reserved'));assert.equal(s.run("screenState('inventory').dirty"),false);
});

async function checkSessionBoundary() {
  let release;
  const wait=new Promise(resolve=>release=resolve),context=vm.createContext({structuredClone,Date,Error,setTimeout});
  const apiSource=runtime.slice(runtime.indexOf('    const api = {'),runtime.indexOf('    const iconMap ='));
  vm.runInContext(`const state={sessionEpoch:0,signedOut:false},db={orders:[]};${apiSource}`,context);
  context.pendingWait=wait;vm.runInContext('api.wait=()=>pendingWait',context);
  const save=vm.runInContext("api.save('orders',{id:'test',version:0})",context);
  const removal=vm.runInContext("api.remove('orders','test')",context);
  vm.runInContext('state.signedOut=true;state.sessionEpoch++;delete db.orders',context);release();
  await assert.rejects(save,/Session ended/);await assert.rejects(removal,/Session ended/);
  assert.equal(vm.runInContext('Object.keys(db).length',context),0);
  passed++;console.log('PASS Pass 2: late save/delete cannot repopulate an ended session');
}
checkSessionBoundary().then(()=>console.log(`${passed} contract regressions passed; both HTML scripts and JSON parse.`)).catch(error=>{console.error(error);process.exitCode=1;});
