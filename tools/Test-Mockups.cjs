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
  const controls = { confirmPublish: { checked: true }, rollbackConfirm: { checked: true }, rollbackReason: { value: 'Export regression in the failed version' },
    retireConfirm: { checked: true }, retireReason: { value: 'Retention period expired' }, sideNav: { innerHTML: '' } };
  const messages = [], dialogs = [];
  const context = vm.createContext({
    structuredClone, Intl, Date, Object, Number, Set, JSON,
    document: { getElementById: id => controls[id] },
    toast: (...args) => messages.push(args), status: () => {},
    render: () => {}, updateChrome: () => {}, closeModal: () => {},
    showModal: (title, body, buttons) => dialogs.push({ title, body, buttons }),
  });
  // Every top-level Studio function is extracted, except the six the fixture replaces with protocol stubs.
  const stubbed = ['toast','status','render','updateChrome','closeModal','showModal'];
  const names = admin.split('\n').map(line => /^    (?:async )?function (\w+)\(/.exec(line)?.[1]).filter(name => name && !stubbed.includes(name));
  const bootstrap = admin.slice(admin.indexOf('    const configKeys='), admin.indexOf('    const titles='));
  vm.runInContext(`const initial=${JSON.stringify(initial)},model={},fixtures=${JSON.stringify(fixtures)};
    const state={module:'overview',appId:'ops',selectedScreen:'orders',selectedField:'amount',selectedCommand:'New',selectedDataClass:'orders',
      selectedConnection:'ops-db',selectedList:'order-status',selectedReport:'order-export',selectedRole:'operations-editor',navSelection:null,
      inspectorTab:'properties',detailTab:'definition',securityTab:'permissions',systemTab:'settings',actor:'Jordan Lee',viewVersion:null,
      validated:false,validation:null,compiling:false,approvals:{},acceptedWarnings:{},schedule:null,history:[],future:[],dirty:0,
      publicationNote:'',previewRole:'',compareBase:'',compareOther:'',inspectorVisible:true,publicationRevision:7,focusPath:''};
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
  s.run(`state.validated=true;state.validation={serialized:canonical(configuration()),digest:digest()};
    state.acceptedWarnings=Object.fromEntries(validationIssues().filter(i=>i.severity==='warning'&&warningRule(i.code)).map(i=>[i.code,true]));`);
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
  assert.ok(s.run("validationIssues().some(i=>i.path==='screens.orders.dataClassId')"));
});
test('UI-03: author cannot approve own candidate', () => {
  const s=studio();validCandidate(s);s.run("recordApproval('Product','Reviewed')");
  assert.equal(s.run('Object.keys(state.approvals).length'),0);
});
test('UI-03: wrong checker role is rejected', () => {
  const s=studio();validCandidate(s);s.run("state.actor='Priya Raman';recordApproval('Security','Reviewed')");
  assert.equal(s.run('Object.keys(state.approvals).length'),0);
});
test('UI-03: publication requires all three approvals', () => {
  const s=studio();validCandidate(s);s.run('publish()');assert.equal(s.dialogs.length,0);
  assert.match(s.messages.at(-1)[0],/approvals/);
});
test('UI-03/12: approvals and audit do not change configuration digest', () => {
  const s=studio();validCandidate(s);const before=s.run('digest()');
  s.run("state.actor='Priya Raman';recordApproval('Product','Reviewed')");
  assert.equal(s.run('digest()'),before);
  assert.equal(s.run('state.approvals.Product.digest'),before);
});
test('UI-03: editing invalidates validation and all approvals', () => {
  const s=studio();validCandidate(s);
  s.run("state.actor='Priya Raman';recordApproval('Product','Reviewed');state.actor='Jordan Lee';checkpoint('Updated field',()=>screen().fields[0].caption='Changed');");
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
  s.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,'Reviewed');}state.actor='Jordan Lee';state.publicationNote='September order export release';publish();`);
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
  const s=studio();assert.equal(s.run("model.dataClasses.flatMap(d=>fixtureRows(d).flatMap(row=>d.resultFields.filter(f=>!(f.name in row)))).length"),0);
  assert.ok(s.run("model.dataClasses.every(d=>fixtureRows(d).length>0)"));
});
test('UI-11: all seven preview renderer families consume registered fixtures', () => {
  const s=studio();
  assert.equal(s.run('new Set(model.screens.map(s=>s.type)).size'),7);
  assert.ok(s.run("model.screens.every(s=>screenCanvas(s).includes(s.caption))"));
  assert.ok(s.run("screenCanvas(screen()).includes('£48,250.00')"));
});
test('UI-11: incompatible fixture dates are reported without a rendering crash', () => {
  const s=studio();
  assert.equal(s.run("previewValue({binding:'amount',type:'date'},fixtures.datasets.orders[0])"),'Invalid date value');
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
  for(const [collection,renderer,expected] of [['valueLists','renderValues','No value lists'],['screens','renderScreens','No screens'],['dataClasses','renderDataClasses','No DataClasses'],['roles','renderApplicationRoles','has no application roles'],['users','renderApplicationUsers','has no application users']]){
    s.run(`model.${collection}=[];${renderer}()`);assert.match(s.run('host.innerHTML'),new RegExp(expected));
  }
});

test('Pass 2: a new application starts with its own empty configuration and no implicit grants', () => {
  const s=studio();assert.equal(s.run("createApplication('finance','Finance Hub','FIN')"),true);
  s.run("switchApplication('finance');renderApplicationRoles()");
  assert.match(s.run('host.innerHTML'),/Finance Hub has no application roles/);
  assert.equal(s.run("host.innerHTML.includes('Operations reader')"),false);assert.equal(s.run("host.innerHTML.includes('checked')"),false);
  assert.deepEqual([...s.run("[model.roles.length,model.users.length,model.screens.length,model.connections.length,releases.length]")],[0,0,0,0,0]);
  assert.match(s.run('model.draft.label'),/^Draft \d{4}\.\d{2}\.1$/);
});

test('Pass 2: restoring configuration reconciles selections that no longer exist', () => {
  const s=studio();s.run("state.selectedScreen='deleted-home';state.selectedRole='gone';state.selectedUser='nobody';state.previewRole='user:nobody';state.navSelection='group:missing';reconcileSelection()");
  assert.deepEqual([...s.run('[state.appId,state.selectedScreen,state.selectedRole,state.selectedUser,state.previewRole,state.navSelection]')],['ops','orders','operations-reader','alex.smith','',null]);
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
  assert.match(s.run('reportPreview(model.reports[0])'),/no preview value/);
});

/* ---- Studio conformance pass (design 0.8, shared reference-application contract) ---- */
const errorCodes = s => s.run("validationIssues().filter(i=>i.severity==='error').map(i=>i.code+'@'+i.path)");
const hasIssue = (s, code, pathPrefix) => s.run(`validationIssues().some(i=>i.code===${JSON.stringify(code)}&&i.path.startsWith(${JSON.stringify(pathPrefix)}))`);
const bootstrapSource = admin.slice(admin.indexOf('    const configKeys='), admin.indexOf('    const titles='));
// Whole-file checks report only the offending fragment, never the file.
function absent(text, pattern, what) { const m = pattern.exec(text); assert.equal(m ? m[0].slice(0, 120) : null, null, what || String(pattern)); }
function present(text, pattern, what) { assert.ok(pattern.test(text), what || 'expected ' + String(pattern)); }

// The seed holds one self-contained configuration per application; the contract checks read them side by side.
const seedApps = Object.keys(initial.configurations);
const seed = Object.fromEntries(['applications','screens','dataClasses','connections','valueLists','reports','roles','users'].map(k => [k, seedApps.flatMap(id => initial.configurations[id][k])]));
seed.navigation = Object.fromEntries(seedApps.map(id => [id, initial.configurations[id].navigation[id]]));

test('Studio: each embedded application passes the validator unpatched, with one rule-covered warning', () => {
  assert.doesNotMatch(bootstrapSource, /\bmodel\./, 'start-up code must not patch the embedded model');
  const s=studio();
  assert.deepEqual([...errorCodes(s)],[]);
  assert.deepEqual([...s.run("validationIssues().map(i=>i.code+'@'+i.path)")],['USER_CANNOT_START@users.ken%2Eito']);
  s.run("switchApplication('risk')");
  assert.deepEqual([...s.run("validationIssues().map(i=>i.code+'@'+i.path)")],['COMMAND_NEVER_SHOWN@screens.risks.commands.Delete']);
  assert.ok(s.run("Boolean(warningRule('COMMAND_NEVER_SHOWN'))&&Boolean(warningRule('USER_CANNOT_START'))"));
});

test('Studio contract: applications, navigation, screens, DataClasses and value lists use the canonical identifiers', () => {
  assert.deepEqual(seed.applications.map(a=>[a.id,a.name,a.defaultScreen]),[['ops','Operations Hub','orders'],['risk','Risk & Controls','risks']]);
  assert.deepEqual(seed.navigation.ops.map(g=>g.id),['daily','tools','insights']);
  assert.deepEqual(seed.navigation.risk.map(g=>[g.id,g.items.map(i=>i.screenId)]),[['monitor',['risks','limitCheck']]]);
  assert.deepEqual(seed.screens.map(s=>`${s.id}:${s.type}:${s.appId}`),['orders:grid:ops','customers:field:ops','inventory:masterDetail:ops','repricing:action:ops',
    'regions:treeDetail:ops','associations:junction:ops','sales:chart:ops','risks:grid:risk','limitCheck:action:risk']);
  assert.equal(seed.screens.find(s=>s.id==='limitCheck').description,'Evaluate a position against a controlled limit rule.');
  assert.deepEqual(seed.dataClasses.map(d=>d.id).sort(),['apply-price-adjustment','customer-products','customers','employees','orders','products','regions','risks','run-limit-check','sales-summary','stock']);
  assert.deepEqual(seed.valueLists.filter(v=>v.mode==='static').map(v=>v.id).sort(),['desks','jurisdictions','order-status','regions','risk-category','risk-rating','risk-status','sales-period','segments']);
  assert.deepEqual(seed.valueLists.filter(v=>v.mode==='dataClass').map(v=>[v.id,v.keyField,v.displayField]),[['customers','id','name'],['products','id','name'],['employees','id','name']]);
  assert.ok(seed.valueLists.filter(v=>v.mode==='static').every(v=>v.values.every(x=>typeof x.value==='string'&&typeof x.label==='string'&&typeof x.active==='boolean')));
  assert.deepEqual(seed.valueLists.find(v=>v.id==='risk-status').values.map(v=>v.value),['active','monitoring','mitigated']);
  assert.deepEqual(seed.valueLists.find(v=>v.id==='regions').values.map(v=>`${v.value}=${v.label}`),['UK=United Kingdom','EU=European Union','NA=North America','APAC=Asia Pacific']);
  assert.ok(seed.valueLists.find(v=>v.id==='desks').values.some(v=>v.value==='global-equities'&&v.label==='Global Equities'));
});

test('Studio contract: field lists per screen carry id, binding, type, role and layout group and no coordinates', () => {
  const column=f=>f.role==='data'&&!['label','action','subscreen'].includes(f.type);
  const ids=id=>seed.screens.find(s=>s.id===id).fields.filter(column).map(f=>`${f.id}:${f.type}`);
  const others=id=>seed.screens.find(s=>s.id===id).fields.filter(f=>!column(f)).map(f=>`${f.id}:${f.type}:${f.role}`);
  assert.deepEqual(others('orders'),['browseCustomers:subscreen:data','filterText:text:criteria','filterStatus:select:criteria','filterRegion:select:criteria','filterCustomer:lookup:criteria','orderedFrom:date:criteria','openOnly:boolean:criteria','dataScope:hidden:criteria']);
  assert.deepEqual(others('risks'),['filterText:text:criteria','filterRating:select:criteria','filterStatus:select:criteria','reviewBy:date:criteria']);
  assert.deepEqual([others('customers'),others('repricing'),others('sales'),others('limitCheck')],[['serviceGuidance:label:data'],['guidance:label:data','run:action:data'],['period:select:criteria'],['run:action:data']]);
  assert.deepEqual(ids('orders'),['id:text','customer:lookup','region:select','product:select','orderDate:date','amount:currency','status:select','owner:text','updatedAt:datetime']);
  assert.deepEqual(ids('customers'),['id:text','name:text','segment:select','region:select','email:text','phone:text','creditLimit:currency','active:boolean','accountManager:lookup','notes:textarea']);
  assert.deepEqual(ids('inventory'),['product:lookup','warehouse:text','onHand:number','reserved:number','available:number','reorderAt:number','status:text']);
  assert.deepEqual(ids('repricing'),['region:select','adjustment:number','effectiveDate:date','reason:textarea']);
  assert.deepEqual(ids('regions'),['name:text','id:text','type:text','owner:text','status:text','parent:text','childCount:number']);
  assert.deepEqual(ids('associations'),['customer:lookup','product:lookup']);
  assert.deepEqual(ids('sales'),['month:text','actual:currency','target:currency']);
  assert.deepEqual(ids('risks'),['id:text','title:text','category:select','rating:select','owner:text','nextReview:date','status:select']);
  assert.deepEqual(ids('limitCheck'),['desk:select','position:currency','jurisdiction:select','asOf:date']);
  const fields=seed.screens.flatMap(s=>s.fields.map(f=>({screen:s.id,...f})));
  assert.ok(fields.every(f=>['data','criteria'].includes(f.role)&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(f.group)));
  assert.ok(fields.every(f=>!('x' in f)&&!('y' in f)&&!('top' in f)&&!('left' in f)));
  assert.equal(seed.screens.find(s=>s.id==='repricing').fields[1].caption,'Adjustment percentage');
  assert.equal(seed.screens.find(s=>s.id==='customers').fields.find(f=>f.id==='email').format,'email');
  const snake=s=>s.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
  assert.deepEqual(fields.filter(f=>column(f)&&f.binding!==snake(f.id)).map(f=>`${f.screen}.${f.id}`),['inventory.product']);
});

test('Studio contract: commands use the canonical keys in toolbar order with all ten properties', () => {
  const keys=id=>seed.screens.find(s=>s.id===id).commands.map(c=>c.key);
  const grid=['New','Edit','Delete','Refresh','Filter','Search','GroupBy','Excel','Printer','Detach'];
  assert.deepEqual(keys('orders'),grid);assert.deepEqual(keys('risks'),grid);
  assert.deepEqual(keys('customers'),['Previous','Next','New','Save','Delete','Refresh','Detach']);
  assert.deepEqual(keys('inventory'),['Previous','Next','Save','Refresh','Excel','Detach']);
  assert.deepEqual(keys('repricing'),['Run','Detach']);assert.deepEqual(keys('limitCheck'),['Run','Detach']);
  assert.deepEqual(keys('regions'),['Refresh','Detach']);assert.deepEqual(keys('associations'),['Save','Refresh','Detach']);assert.deepEqual(keys('sales'),['Refresh','Excel','Detach']);
  const all=seed.screens.flatMap(s=>s.commands);
  for(const prop of ['key','scope','labelKey','iconKey','policy','enableWhen','confirmation','execution','concurrency','shortcut'])assert.ok(all.every(c=>typeof c[prop]==='string'),prop);
  const caption=key=>all.find(c=>c.key===key).label;
  assert.deepEqual(['New','GroupBy','Excel','Printer','Run'].map(caption),['Add','Customise view','Export','Print','Run action']);
});

test('Studio contract: capabilities and role permissions are named flags, never positional strings', () => {
  const capabilityKeys=['insert','update','delete','refresh','filter','search','export','print','personalize','detach'];
  assert.ok(seed.screens.every(s=>JSON.stringify(Object.keys(s.capabilities))===JSON.stringify(capabilityKeys)&&Object.values(s.capabilities).every(v=>typeof v==='boolean')));
  const granted=(role,screen)=>Object.keys(seed.roles.find(r=>r.id===role).permissions[screen]||{}).sort().join(' ');
  assert.deepEqual(seedApps.map(id=>[id,initial.configurations[id].roles.map(r=>r.id).join()]),[['ops','operations-reader,operations-editor'],['risk','risk-reader,risk-manager']]);
  assert.equal(granted('operations-reader','orders'),'export print read');
  assert.equal(granted('operations-editor','orders'),'delete export insert print read update');
  assert.equal(granted('operations-editor','repricing'),'execute');
  assert.equal(granted('operations-editor','associations'),'insert read update');
  assert.equal(granted('risk-manager','risks'),'export insert print read update');
  assert.equal(granted('risk-manager','limitCheck'),'execute');
  assert.equal(granted('risk-reader','limitCheck'),'');
  assert.ok(seed.roles.filter(r=>r.id.startsWith('risk-')).every(r=>!('sales' in r.permissions)));
  assert.doesNotMatch(JSON.stringify(seed.roles),/"[-RWIDEP]{6}"/);
  const s=studio();
  s.run("model.roles[0].permissions.orders='R---EP'");
  assert.match(String(s.run('configurationShapeIssues(configuration())[0]')),/roles\.operations-reader\.permissions\.orders: expected named permission flags; positional strings are not accepted/);
  const t=studio();
  t.run("state.actor='Alex Morgan';switchApplication('risk');setFlag('roles.risk-reader.permissions','risks','export',false);setFlag('roles.risk-reader.permissions','limitCheck','execute',true)");
  assert.equal(t.run("JSON.stringify(model.roles.find(r=>r.id==='risk-reader').permissions)"),'{"risks":{"read":true,"print":true},"limitCheck":{"execute":true}}');
  assert.deepEqual([...t.run('[audit[0].target,audit[0].application,audit[0].action]')],['roles.risk-reader.permissions.limitCheck','risk','Updated application role permission']);
});

test('Studio contract: fixtures are the committed runtime rows keyed by binding, with coded values and row ids', () => {
  const d=fixtures.datasets;
  assert.deepEqual([d.orders.length,d.customers.length,d.employees.length,d.products.length,d.stock.length,d.regions.length,d['sales-summary'].length,d.risks.length],[8,7,4,5,8,8,9,4]);
  assert.deepEqual(d.orders[0],{id:'ORD-1042',customer:'CUS-001',region:'UK',product:'PRD-110',order_date:'2026-09-01',amount:48250,status:'Confirmed',owner:'Maya Chen',updated_at:'2026-09-06T08:42:00Z',version:3});
  assert.ok(d.orders.concat(d.risks).every(r=>!/^[A-Z]\. /.test(r.owner)));
  assert.equal(d.customers[0].account_manager,'EMP-101');
  assert.deepEqual([d.risks[0].category,d.risks[0].rating,d.risks[0].status],['operational','High','active']);
  assert.deepEqual(d.regions.map(r=>`${r.id}<${r.parent_id}`),['global<','emea<global','uk<emea','eu<emea','americas<global','na<americas','apac<global','sg<apac']);
  assert.equal(d['customer-products'].filter(r=>r.customer==='CUS-001').map(r=>r.product).join(),'PRD-100,PRD-110,PRD-130');
});

test('Studio contract: nothing from the forbidden list is present', () => {
  absent(admin,/\b(SQL Server|Oracle|Sybase|PostgreSQL|Postgres|MySQL|MariaDB|DB2|MongoDB|Azure|Amazon|AWS|Google Cloud|Okta|Entra|Keycloak|Auth0|React|Angular|Blazor)\b|Vue\.js|\.NET\b|Node\.js/);
  absent(admin,/\bdbo\.|password=|pwd=|user id=|Data Source=|jdbc:|Server=[^&]/i);
  absent(admin,/legacy import|migrat|coexist|cutover/i);
  absent(admin,/import a role definition|impact review until publication|Only imported and allow-listed|Reopen this editor to add more/);
  const s=studio(),html=s.run("model.screens.map(x=>screenCanvas(x)).join('')+reportPreview(model.reports[0])+(renderScreens(),host.innerHTML)+(renderDataClasses(),host.innerHTML)+(renderConnections(),host.innerHTML)+(renderValues(),host.innerHTML)+(renderApplicationRoles(),host.innerHTML)+(renderApplicationUsers(),host.innerHTML)+(renderStudioUsers(),host.innerHTML)+(renderStudioRoles(),host.innerHTML)+(renderAllApplications(),host.innerHTML)+(renderSystem(),host.innerHTML)+(renderOverview(),host.innerHTML)+(renderVersions(),host.innerHTML)+(renderValidation(),host.innerHTML)");
  absent(html,/mock-?up|\bdemo\b|fixture|simulat|prototype/i);
  present(admin,/About this prototype/);
});

test('Studio 11.4/14.3: a connection draft holds only id, name, provider, secret reference and active state', () => {
  assert.deepEqual([...new Set(seed.connections.flatMap(c=>Object.keys(c)))],['id','name','providerId','secretRef','active']);
  const s=studio();
  for(const key of ['endpoint','pool','timeout','encrypted','health']){
    s.run(`model.connections[0].${key}='x'`);
    assert.match(String(s.run("validationIssues()[0].code+' '+validationIssues()[0].path")),new RegExp('INVALID_SHAPE connections\\.ops-db\\.'+key));
    s.run(`delete model.connections[0].${key}`);
  }
  const before=s.run('digest()');
  s.run("fixtures.deployment.connections['ops-db'].health='Degraded';fixtures.deployment.connections['ops-db'].endpoint='elsewhere';fixtures.deployment.environment.id='prod';fixtures.operations.signIns.ops['alex.smith'].lastLogin='2030-01-01T00:00:00Z'");
  assert.equal(s.run('digest()'),before);
  assert.ok(!('environment' in JSON.parse(s.run('JSON.stringify(configuration())'))));
  s.run('renderConnections()');
  assert.match(s.run('host.innerHTML'),/Deployment mapping for UAT \(read-only; outside the digest\)/);
  assert.equal(s.run(`/data-path="connections\\.ops-db" data-prop="(endpoint|pool|timeout|health)"/.test(host.innerHTML)`),false);
});

test('Studio 11.4/11.6: provider comes from the registered catalogue; unknown or unqualified is an error', () => {
  assert.deepEqual(fixtures.providerCatalogue.map(p=>`${p.id}:${p.qualified}`),['engine-a:true','engine-b:true','engine-c:false']);
  const s=studio();
  s.run("model.connections[0].providerId='com.vendor.Driver'");assert.ok(hasIssue(s,'UNKNOWN_PROVIDER','connections.ops-db.providerId'));
  s.run("model.connections[0].providerId='engine-c'");assert.ok(hasIssue(s,'UNQUALIFIED_PROVIDER','connections.ops-db.providerId'));
  s.run("model.connections[0].providerId='engine-b'");assert.deepEqual([...errorCodes(s)],[]);
});

test('Studio 11.4/15.4: a secret reference must match a reference scheme; credentials are refused and never stored', () => {
  const s=studio();
  for(const bad of ['Password=hunter2;User Id=sa','Server=db01;Database=ops','secret://gd/x y','user:pw@host','hunter2'])assert.notEqual(s.run(`secretRefIssue(${JSON.stringify(bad)})`),'',bad);
  for(const good of ['secret://gd/connections/ops-db','identity://gd/workloads/risk-reader'])assert.equal(s.run(`secretRefIssue(${JSON.stringify(good)})`),'',good);
  s.run("state.actor='Chris Doyle'");
  assert.equal(s.run("setProp('connections.ops-db','secretRef','Password=hunter2;User Id=sa','')"),false);
  assert.match(s.messages.at(-1)[0],/looks like a credential/);
  assert.equal(s.run('model.connections[0].secretRef'),'secret://gd/connections/ops-db');
  assert.equal(s.run('audit[0].outcome'),'Denied');assert.doesNotMatch(s.run('JSON.stringify(audit)'),/hunter2/);
  s.run("model.connections[0].secretRef='Password=hunter2'");assert.ok(hasIssue(s,'CREDENTIAL_REJECTED','connections.ops-db.secretRef'));
  s.run("model.connections[0].secretRef='vault-entry-7'");assert.ok(hasIssue(s,'INVALID_SECRET_REFERENCE','connections.ops-db.secretRef'));
});

test('Studio 11.3: source and update target are stable keys allow-listed per connection', () => {
  const s=studio();
  s.run("model.dataClasses[0].source='sales-summary-view'");assert.ok(hasIssue(s,'UNAPPROVED_SOURCE','dataClasses.orders.source'));
  s.run("model.dataClasses[0].source='orders-table'");assert.ok(hasIssue(s,'UNAPPROVED_SOURCE','dataClasses.orders.source'),'a table is not a view');
  s.run("model.dataClasses[0].source='orders-view';model.dataClasses[0].updateTarget='ops.orders; DROP TABLE x --'");assert.ok(hasIssue(s,'UNAPPROVED_TARGET','dataClasses.orders.updateTarget'));
  s.run("model.dataClasses[0].updateTarget='risk-register-table'");assert.ok(hasIssue(s,'UNAPPROVED_TARGET','dataClasses.orders.updateTarget'),'a table of another connection');
  s.run("model.dataClasses[0].updateTarget='orders-table'");assert.deepEqual([...errorCodes(s)],[]);
});

test('Studio 11.2: lifecycle shows Draft, Validating, Approved and publishes with a reason in the audit entry', () => {
  const s=studio();
  assert.equal(s.run('draftStatus()'),'Draft');
  s.run('state.compiling=true');assert.equal(s.run('draftStatus()'),'Validating');
  s.run('state.compiling=false;completeValidation()');assert.equal(s.run('draftStatus()'),'Validating');
  assert.match(s.run('draftStatusNote()'),/warnings await acceptance/);
  s.run("state.actor='Priya Raman'");assert.equal(s.run("recordApproval('Product','Reviewed')"),false,'warnings must be accepted first');
  s.run("state.actor='Jordan Lee';acceptWarning('USER_CANNOT_START',true)");
  s.run("state.actor='Priya Raman'");assert.equal(s.run("recordApproval('Product','')"),false,'an approval needs a reason');
  s.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,role+' review complete');}`);
  assert.equal(s.run('draftStatus()'),'Approved');
  assert.equal(s.run("audit.find(a=>a.action==='Approved candidate').reason"),'Test review complete');
  assert.match(s.run('publicationBlockers()[0]'),/publication reason is required/);
  s.run("state.publicationNote='Order export release';");assert.equal(s.run('performPublish()'),false,'an approver is not a configurator');
  s.run("state.actor='Jordan Lee'");assert.equal(s.run('performPublish()'),true);
  assert.equal(s.run('releases[0].status+releases[1].status'),'PublishedSuperseded');
  assert.equal(s.run("audit.find(a=>a.action==='Published version').reason"),'Order export release');
  assert.equal(s.run('state.publicationRevision'),8);
  s.run('renderVersions()');
  for(const stateName of ['Draft','Validating','Approved','Published','Superseded','Withdrawn','Retired'])assert.match(s.run('host.innerHTML'),new RegExp('<li class="[a-z]*"[^>]*>'+stateName+'</li>'));
});

test('Studio 11.2: an accepted warning needs an approved rule; changing acceptance clears approvals', () => {
  const s=studio();validCandidate(s);
  s.run("state.actor='Priya Raman';recordApproval('Product','Reviewed');state.actor='Jordan Lee';acceptWarning('USER_CANNOT_START',false)");
  assert.equal(s.run('Object.keys(state.approvals).length'),0);
  s.run('publish()');assert.match(s.messages.at(-1)[0],/every warning must be accepted under an approved rule/);
  assert.equal(s.run("acceptWarning('NO_SUCH_RULE',true)"),false);
});

test('Studio 11.2: rollback, retire and their reasons follow the allowed transitions', () => {
  const s=studio();
  assert.equal(s.run("performRollback('ver-2026-08-4','')"),false,'rollback needs a reason');
  s.run("rollbackTo('ver-2026-08-4')");
  const body=s.dialogs[0].body;
  for(const text of ['Open screens','Queued work','Admitted transactions','Unknown operations','Generated outputs','Save is unavailable','Blocked before it starts','report their real outcome','read-only status checks','fails closed','revision 7 to 8'])assert.match(body,new RegExp(text));
  s.dialogs[0].buttons.find(b=>b.label==='Rollback').action();
  assert.equal(s.run('audit[0].reason'),'Export regression in the failed version');
  assert.equal(s.run('releases[0].status'),'Withdrawn');
  assert.equal(s.run("performRollback('ver-2026-09-1','again')"),false,'a withdrawn version is not a rollback target');
  assert.equal(s.run("performRetire('ver-2026-09-1','')"),false,'retire needs a reason');
  assert.equal(s.run("performRetire('ver-2026-09-1','Nothing left to reconcile')"),true);
  assert.equal(s.run('releases[0].status'),'Retired');
  assert.equal(s.run('audit[0].action+\"|\"+audit[0].reason+\"|\"+audit[0].detail.slice(0,20)'),'Retired version|Nothing left to reconcile|Withdrawn to Retired');
  assert.equal(s.run("performRetire('ver-2026-09-1','twice')"),false,'Retired is terminal');
  const t=studio();
  assert.equal(t.run("performRetire('ver-2026-08-4','Retention expired')"),true,'Superseded to Retired');
  t.run("rollbackTo('ver-2026-08-4')");assert.equal(t.dialogs.length,0,'a retired version cannot be reactivated');
  assert.equal(t.run("performRetire('ver-2026-09-1','Application retired')"),true,'Published to Retired');
  assert.equal(t.run('activeRelease()'),undefined);
  t.run("performClone('ver-2026-09-1')");assert.equal(t.run('model.draft.basedOn+draftStatus()'),'ver-2026-09-1Draft');
});

test('Studio 11.4: scheduled publication activates the approved candidate at its time; an edit cancels it', () => {
  const s=studio();validCandidate(s);
  s.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,'Reviewed');}state.actor='Jordan Lee';state.publicationNote='Night release';`);
  assert.equal(s.run("schedulePublication('2000-01-01T00:00')"),false,'a past time is refused');
  assert.equal(s.run("schedulePublication(new Date(Date.now()+3600000).toISOString())"),true);
  assert.equal(s.run('tickSchedule(Date.now())'),false);assert.equal(s.run('releases[0].status'),'Published');assert.equal(s.run('releases.length'),2);
  assert.equal(s.run('tickSchedule(Date.now()+7200000)'),true);
  assert.equal(s.run('releases.length+releases[0].summary+releases[1].status'),'3Night releaseSuperseded');
  const t=studio();validCandidate(t);
  t.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,'Reviewed');}state.actor='Jordan Lee';state.publicationNote='Night release';schedulePublication(new Date(Date.now()+3600000).toISOString());state.actor='Jordan Lee';setProp('screens.orders','caption','Orders','')`);
  assert.equal(t.run('state.schedule'),null);assert.equal(t.run("audit.some(a=>a.action==='Cancelled scheduled publication')"),true);
});

test('Studio 11.3: unknown option values, capabilities and permissions are rejected with exact paths', () => {
  const s=studio();
  s.run("model.screens[0].filterMode='weird';model.screens[0].fields[1].type='combo';model.dataClasses[0].deleteMode='soft';model.dataClasses[0].parameters[0].type='rawsql';model.screens[0].commands[0].execution='eval';model.screens[0].commands[1].key='Approve'");
  for(const path of ['screens.orders.filterMode','screens.orders.fields.customer.type','dataClasses.orders.deleteMode','dataClasses.orders.parameters.user_region.type','screens.orders.commands.New.execution','screens.orders.commands.Approve.key'])assert.ok(hasIssue(s,'UNKNOWN_OPTION',path),path);
  const t=studio();t.run("model.screens[0].capabilities.launch=true");
  assert.match(String(t.run('validationIssues()[0].path')),/^screens\.orders\.capabilities\.launch$/);
  const u=studio();u.run("model.roles[0].permissions.orders.approve=true");
  assert.match(String(u.run('validationIssues()[0].path')),/^roles\.operations-reader\.permissions\.orders\.approve$/);
});

test('Studio 11.3: every reference is resolved and duplicates are detected', () => {
  const s=studio();
  s.run(`model.dataClasses[0].writeConnectionId='nope';model.screens[0].reportId='missing-report';model.screens[0].commands[0].policy='orders.approve';model.screens[0].commands[1].policy='customers.update';
    model.roles[0].permissions.ghost={read:true};model.valueLists.find(v=>v.id==='customers').displayField='title';model.dataClasses[1].uniqueKey=['customer_id'];model.reports[0].appId='gone';
    model.roles[0].fieldPolicies[0].fieldId='nope';model.roles[0].rowScopes[0].field='nope'`);
  for(const [code,path] of [['INVALID_REFERENCE','dataClasses.orders.writeConnectionId'],['INVALID_REFERENCE','screens.orders.reportId'],['UNDEFINED_POLICY','screens.orders.commands.New.policy'],['UNDEFINED_POLICY','screens.orders.commands.Edit.policy'],
    ['INVALID_REFERENCE','roles.operations-reader.permissions.ghost'],['INVALID_REFERENCE','valueLists.customers.displayField'],['INVALID_REFERENCE','dataClasses.customers.uniqueKey'],['INVALID_REFERENCE','reports.order-export.appId'],
    ['INVALID_REFERENCE','roles.operations-reader.fieldPolicies.#0'],['INVALID_REFERENCE','roles.operations-reader.rowScopes.#0']])assert.ok(hasIssue(s,code,path),path);
  const t=studio();
  t.run("model.navigation.ops[1].id='daily';model.navigation.ops[2].items[0].id='nav-orders';model.screens[0].commands.push({...model.screens[0].commands[0]});model.dataClasses[0].parameters.push({name:'status',type:'string',source:'request',required:false});model.screens[1].commands[2].shortcut='Ctrl+S'");
  for(const path of ['navigation.ops.daily','navigation.ops.items.nav-orders','screens.orders.commands.New','dataClasses.orders.parameters.status','screens.customers.commands.New.shortcut'])assert.ok(hasIssue(t,'DUPLICATE_ID',path),path);
});

test('Studio 11.3: screen-type and read/write consistency are enforced', () => {
  const s=studio();
  s.run("delete model.screens.find(x=>x.id==='inventory').detailDataClassId;model.screens.find(x=>x.id==='repricing').dataClassId='orders';model.screens.find(x=>x.id==='orders').dataClassId='apply-price-adjustment';model.screens.find(x=>x.id==='sales').chart.series=['month'];model.screens.find(x=>x.id==='regions').tree.parentField='nope';model.screens.find(x=>x.id==='associations').junction.memberField='nope'");
  for(const path of ['screens.inventory.detailDataClassId','screens.repricing.dataClassId','screens.orders.dataClassId','screens.sales.chart','screens.regions.tree','screens.associations.junction'])assert.ok(hasIssue(s,'SCREEN_TYPE_INCONSISTENT',path),path);
  const t=studio();
  t.run("model.dataClasses.find(d=>d.id==='customers').updateable=false;model.dataClasses.find(d=>d.id==='products').insertable=true;model.dataClasses.find(d=>d.id==='stock').uniqueKey=[]");
  for(const path of ['screens.customers.capabilities.update','dataClasses.products.writeRouting','dataClasses.stock.uniqueKey'])assert.ok(hasIssue(t,'WRITE_INCONSISTENT',path),path);
  const r=studio();
  r.run("switchApplication('risk');model.screens.find(x=>x.id==='limitCheck').commands.shift();model.screens.find(x=>x.id==='risks').capabilities.delete=true");
  assert.ok(hasIssue(r,'SCREEN_TYPE_INCONSISTENT','screens.limitCheck.commands'));assert.ok(hasIssue(r,'WRITE_INCONSISTENT','screens.risks.capabilities.delete'));
});

test('Studio 11.3/15.2: security coverage denies by default and reports ambiguity', () => {
  const s=studio();
  s.run("model.roles.find(r=>r.id==='operations-editor').permissions.orders.execute=true");
  assert.ok(hasIssue(s,'AMBIGUOUS_PERMISSION','roles.operations-editor.permissions.orders.execute'));
  const r=studio();
  r.run("switchApplication('risk');model.roles.find(x=>x.id==='risk-manager').permissions.limitCheck.read=true");
  assert.ok(hasIssue(r,'AMBIGUOUS_PERMISSION','roles.risk-manager.permissions.limitCheck.read'));
  r.run("delete model.roles.find(x=>x.id==='risk-manager').permissions.limitCheck.read;model.roles.find(x=>x.id==='risk-manager').active=false");
  assert.ok(hasIssue(r,'COMMAND_UNREACHABLE','screens.limitCheck.commands.Run'),'an inactive application role grants nothing');
  assert.equal(r.run("roleGrants(model.roles.find(x=>x.id==='risk-manager'),'limitCheck','execute')"),false);
  assert.equal(r.run("commandShown(model.screens.find(x=>x.id==='risks'),model.screens.find(x=>x.id==='risks').commands.find(c=>c.key==='Delete'),null)"),false,'capability off hides the command');
  const t=studio();
  t.run("model.roles.forEach(r=>{delete r.permissions.regions;delete r.permissions.orders?.print;})");
  assert.ok(hasIssue(t,'SCREEN_UNREACHABLE','screens.regions'));assert.ok(hasIssue(t,'COMMAND_UNREACHABLE','screens.orders.commands.Printer'));
  assert.equal(t.run("commandShown(model.screens[0],model.screens[0].commands.find(c=>c.key==='Delete'),model.roles[0])"),false,'the reader is not granted delete');
  assert.equal(t.run("commandShown(model.screens[0],model.screens[0].commands.find(c=>c.key==='Delete'),model.roles[1])"),true);
});

test('Studio 14.3/14.7/14.6: inactive connections, cache eligibility and dual-source routing block the definition', () => {
  const s=studio();
  s.run("model.connections.find(c=>c.id==='ops-db').active=false");
  assert.ok(hasIssue(s,'INACTIVE_CONNECTION','dataClasses.orders.connectionId'));assert.ok(hasIssue(s,'INACTIVE_CONNECTION','dataClasses.orders.writeConnectionId'));
  const t=studio();
  assert.deepEqual([...t.run("cacheGaps(model.dataClasses[0])")],[]);
  t.run("model.dataClasses[0].cacheScope=['application'];model.dataClasses[0].cacheInvalidation=[]");
  assert.ok(hasIssue(t,'CACHE_NOT_ELIGIBLE','dataClasses.orders.cacheMode'));
  assert.equal(t.run("cacheGaps(model.dataClasses[0]).length"),4);
  t.run("model.dataClasses[0].cacheMode='always-refresh'");assert.equal(hasIssue(t,'CACHE_NOT_ELIGIBLE','dataClasses.orders'),false);
  t.run("const a=model.dataClasses.find(d=>d.kind==='action');a.cacheMode='cached';a.cacheSeconds=30;a.cacheScope=['application','parameters','security-scope'];a.cacheInvalidation=['expiry']");
  assert.ok(hasIssue(t,'CACHE_NOT_ELIGIBLE','dataClasses.apply-price-adjustment.cacheMode'));
  const u=studio();
  u.run("Object.assign(model.dataClasses[0],{writeRouting:'dual-source',secondaryConnectionId:'risk-db',secondaryTarget:'risk-register-table'})");
  assert.ok(hasIssue(u,'DUAL_SOURCE_BLOCKED','dataClasses.orders.writeRouting'));
  u.run("state.detailTab='write';renderDataClasses()");assert.match(u.run('host.innerHTML'),/Dual-source routing is blocked/);
});

test('Studio 11.3: validation expressions follow a closed grammar and compile to a typed tree', () => {
  const s=studio();
  assert.equal(s.run("expressionTree(parseExpression('value >= 0 and value <= 100').tree)"),'and(ge(value, 0), le(value, 100))');
  assert.equal(s.run("expressionTree(parseExpression('length <= 2000').tree)"),'le(length, 2000)');
  for(const bad of ['alert(document.cookie)','value >= 0; drop','value == 1','amount > 1','value > other','1=1 or value > 0'])assert.equal(s.run(`parseExpression(${JSON.stringify(bad)}).ok`),false,bad);
  s.run("model.screens[0].fields[5].validation='alert(document.cookie)'");assert.ok(hasIssue(s,'INVALID_EXPRESSION','screens.orders.fields.amount.validation'));
  s.run("model.screens[0].fields[5].validation='value >= 0'");assert.deepEqual([...errorCodes(s)],[]);
});

test('Studio 11.3: the panel claims only checks that exist and Open navigates to the diagnosed entity', () => {
  const s=studio();
  s.run('renderValidation()');
  const claimed=s.run('host.innerHTML').match(/<p class="right">([^<]+)<\/p>/)[1];
  assert.equal(claimed,'Structure · references · application boundary · duplicates · option values · screen types · read/write consistency · security coverage · application users · connections and providers · cache eligibility · expressions');
  assert.match(s.run('host.innerHTML'),/data-action="open" data-path="users\.ken%2Eito" aria-label="Open users\.ken\.ito"/);
  s.run("openPath('users.ken%2Eito')");
  assert.deepEqual([...s.run('[state.module,state.appId,state.selectedUser]')],['appusers','ops','ken.ito']);
  s.run("openPath('dataClasses.sales-summary.cacheMode')");
  assert.deepEqual([...s.run('[state.module,state.appId,state.selectedDataClass,state.detailTab,state.focusPath]')],['dataclasses','ops','sales-summary','caching','dataClasses.sales-summary.cacheMode']);
  s.run("openPath('roles.operations-reader.fieldPolicies.#0')");assert.deepEqual([...s.run('[state.module,state.selectedRole,state.securityTab]')],['approles','operations-reader','fields']);
  s.run("switchApplication('risk');renderValidation()");
  assert.match(s.run('host.innerHTML'),/data-action="open" data-path="screens\.risks\.commands\.Delete"/);
  s.run("openPath('screens.risks.commands.Delete')");
  assert.deepEqual([...s.run('[state.module,state.appId,state.selectedScreen,state.selectedCommand,state.inspectorTab]')],['screens','risk','risks','Delete','command']);
  s.run("openPath('navigation.risk.monitor.items.nav-limits.screenId')");assert.deepEqual([...s.run('[state.module,state.appId,state.navSelection]')],['navigation','risk','item:monitor:nav-limits']);
  s.run("openPath('connections.risk-db.secretRef')");assert.deepEqual([...s.run('[state.module,state.selectedConnection]')],['connections','risk-db']);
  assert.ok(s.run("validationIssues().concat(configurationShapeIssues({}).map(t=>({path:'configuration'}))).every(i=>typeof i.path==='string'&&i.path.length>0)"));
});

test('Studio 11.4: impact analysis lists affected applications, screens, DataClasses, roles, reports and tests', () => {
  const s=studio();
  const seed=JSON.parse(s.run('JSON.stringify(impactAnalysis(activeRelease().snapshot,configuration()))'));
  assert.deepEqual(seed.changed,['screens.orders','users.sara%2Eevans']);
  assert.deepEqual(seed.applications,['applications.ops']);assert.deepEqual(seed.screens,['screens.orders']);assert.deepEqual(seed.roles.includes('roles.operations-editor'),true);
  assert.deepEqual(seed.users,['users.sara%2Eevans']);
  assert.deepEqual(seed.tests.map(t=>t.id),['AT-ORD-001','AT-SEC-OPS','AT-NAV-OPS'],'orders is a navigation target and the default screen; no test of another application is listed');
  s.run("model.dataClasses.find(d=>d.id==='products').timeoutSeconds=11");
  const next=JSON.parse(s.run('JSON.stringify(impactAnalysis(activeRelease().snapshot,configuration()))'));
  assert.ok(next.dataClasses.includes('dataClasses.products'));assert.ok(next.valueLists.includes('valueLists.products'));
  for(const screen of ['screens.inventory','screens.orders','screens.associations'])assert.ok(next.screens.includes(screen),screen);
  assert.ok(!next.screens.includes('screens.risks'));assert.ok(next.tests.some(t=>t.id==='AT-INV-001'));
  s.run("state.module='impact';renderImpact()");assert.match(s.run('host.innerHTML'),/Acceptance tests \(\d+\)/);assert.match(s.run('host.innerHTML'),/Application users \(1\)/);
  s.run("switchApplication('risk')");
  const risk=JSON.parse(s.run('JSON.stringify(impactAnalysis(activeRelease().snapshot,configuration()))'));
  assert.deepEqual(risk.changed,['roles.risk-manager']);assert.deepEqual(risk.tests.map(t=>t.id),['AT-SEC-RSK']);
  assert.deepEqual(risk.users,['users.alex%2Esmith'],'the application user who holds the changed application role');
  s.run("model.connections.find(c=>c.id==='risk-db').name='Risk data store'");
  const third=JSON.parse(s.run('JSON.stringify(impactAnalysis(activeRelease().snapshot,configuration()))'));
  assert.ok(third.applications.includes('applications.risk'));assert.ok(third.reports.includes('reports.risk-export'));assert.ok(third.screens.includes('screens.limitCheck'));
  assert.ok(!third.screens.includes('screens.orders')&&!third.tests.some(t=>t.application==='ops'),'nothing of Operations Hub is affected');
});

test('Studio 11.4: comparison is field-level and side by side; dependencies are navigable', () => {
  const s=studio();
  const rows=JSON.parse(s.run('JSON.stringify(diffEntries(activeRelease().snapshot,configuration()))'));
  assert.deepEqual(rows.find(r=>r.path==='screens.orders.fields.amount.format'),{path:'screens.orders.fields.amount.format',before:'GBP,0',after:'GBP,0.00',change:'changed'});
  assert.ok(rows.some(r=>r.path==='screens.orders.commands.Excel.key'&&r.change==='added'));
  assert.deepEqual(rows.find(r=>r.path==='users.sara%2Eevans.overrides.#0.reason'),{path:'users.sara%2Eevans.overrides.#0.reason',after:'Read-only access during secondment',change:'added'});
  assert.equal(rows.some(r=>r.path.startsWith('roles.risk-')),false,'the comparison holds nothing of another application');
  const other=studio();other.run("switchApplication('risk')");
  assert.deepEqual(JSON.parse(other.run('JSON.stringify(diffEntries(activeRelease().snapshot,configuration()))')),[{path:'roles.risk-manager.permissions.risks.export',after:'true',change:'added'}]);
  assert.match(other.run("comparison('ver-2026-08-2','draft')"),/<th scope="col">Published 2026\.08\.2<\/th><th scope="col">Draft 2026\.08\.3<\/th>/);
  assert.match(other.run("comparison('ver-2026-07-1','ver-2026-08-2')"),/cacheSeconds/);
  const html=s.run("comparison('ver-2026-09-1','draft')");
  assert.match(html,/<th scope="col">Published 2026\.09\.1<\/th><th scope="col">Draft 2026\.09\.2<\/th>/);
  assert.match(html,/<td class="before">GBP,0<\/td><td class="after">GBP,0\.00<\/td>/);
  assert.match(s.run("comparison('ver-2026-08-4','ver-2026-09-1')"),/autoRefresh/);
  s.run("rowMove('screens.orders.fields',0,1)");
  assert.ok(JSON.parse(s.run('JSON.stringify(diffEntries(activeRelease().snapshot,configuration()))')).some(r=>r.path==='screens.orders.fields.#order'));
  assert.deepEqual([...s.run("dependents('dataClasses.products').map(r=>r.from).sort()")],['screens.inventory','valueLists.products']);
  s.run("state.selectedDataClass='products';state.detailTab='dependencies';renderDataClasses()");
  assert.match(s.run('host.innerHTML'),/data-action="open" data-path="screens\.inventory"/);
  assert.match(s.run('host.innerHTML'),/data-action="open" data-path="connections\.ops-db"/);
});

test('Studio 11.5: compatibility major moves only when the DataClass set or key fields change', () => {
  const s=studio();
  const compat=()=>JSON.parse(s.run('JSON.stringify(compatibility(activeRelease().snapshot,configuration(),activeRelease().majors))'));
  assert.ok(compat().every(c=>c.from===1&&c.to===1&&c.breaking.length===0));
  s.run("const o=model.screens[0];o.fields=o.fields.filter(f=>f.id!=='owner');o.fields.find(f=>f.id==='amount').type='number';o.caption='Orders'");
  assert.deepEqual(compat().find(c=>c.screenId==='orders'),{screenId:'orders',from:1,to:1,breaking:['amount','owner'],note:'Compatible, except client state bound to the listed fields'});
  s.run("model.screens.find(x=>x.id==='customers').fields[0].key=false");assert.equal(compat().find(c=>c.screenId==='customers').to,2);
  s.run("model.screens.find(x=>x.id==='sales').dataClassId='orders'");assert.equal(compat().find(c=>c.screenId==='sales').to,2);
  s.run("model.screens.push(newScreen('extra','Extra','grid','products'))");assert.equal(compat().find(c=>c.screenId==='extra').from,null);
});

test('Studio 11.4: parameters and result fields are editable through entity paths', () => {
  const s=studio();
  s.run("rowAdd('dataClasses.products.parameters','parameter');rowAdd('dataClasses.products.parameters','parameter')");
  assert.deepEqual([...s.run("model.dataClasses.find(d=>d.id==='products').parameters.map(p=>p.name)")],['new_parameter','new_parameter_2']);
  s.run("setProp('dataClasses.products.parameters.#0','name','category','');setProp('dataClasses.products.parameters.category','type','integer','');setProp('dataClasses.products.parameters.#1','required',true,'boolean')");
  assert.equal(s.run("JSON.stringify(model.dataClasses.find(d=>d.id==='products').parameters)"),'[{"name":"category","type":"integer","source":"request","required":false},{"name":"new_parameter_2","type":"string","source":"request","required":true}]');
  s.run("rowMove('dataClasses.products.parameters',1,-1);rowDelete('dataClasses.products.parameters',0)");
  assert.deepEqual([...s.run("model.dataClasses.find(d=>d.id==='products').parameters.map(p=>p.name)")],['category']);
  s.run("rowAdd('dataClasses.products.resultFields','resultField');setProp('dataClasses.products.resultFields.new_field','name','stock_code','');setMember('dataClasses.products','uniqueKey','stock_code',true)");
  assert.deepEqual([...s.run("model.dataClasses.find(d=>d.id==='products').uniqueKey")],['id','stock_code']);
  assert.equal(s.run('audit[1].action+\"@\"+audit[1].target+\"|\"+audit[1].detail'),'Updated result field@dataClasses.products.resultFields.new_field|name: new_field to stock_code');
  s.run("state.selectedDataClass='products';state.detailTab='parameters';renderDataClasses()");
  assert.match(s.run('host.innerHTML'),/data-path="dataClasses\.products\.parameters\.#0" data-prop="name"[^>]*value="category"/);
  assert.equal(s.run("setProp('dataClasses.nope','name','x','')"),false);
});

test('Studio 11.4: delete checks dependencies, cascades only what it lists, and leaves a valid draft', () => {
  const s=studio();
  for(const path of ['dataClasses.products','connections.ops-db','valueLists.regions','reports.order-export']){
    assert.ok(s.run(`deletionPlan(${JSON.stringify(path)}).blocking.length`)>0,path);assert.equal(s.run(`deleteEntity(${JSON.stringify(path)})`),false,path);
  }
  // A configurator cannot remove what an application role or an application user holds: those references block the deletion.
  assert.equal(s.run("deletionPlan('screens.orders').blocking.map(r=>r.via).join()"),'default screen,permission screen: only a security administrator can remove it,permission screen: only a security administrator can remove it');
  assert.deepEqual([...s.run("deletionPlan('screens.regions').cascade.map(r=>r.from)")],['navigation.ops.tools.items.nav-regions']);
  assert.equal(s.run("deleteEntity('screens.regions')"),false);assert.equal(s.run("model.screens.some(x=>x.id==='regions')"),true);
  // The security administrator removes the grants; the configurator can then delete the screen.
  s.run("state.actor='Alex Morgan';setFlag('roles.operations-reader.permissions','regions','read',false);setFlag('roles.operations-editor.permissions','regions','read',false);state.actor='Jordan Lee'");
  assert.deepEqual([...s.run("[deletionPlan('screens.regions').blocking.length,deletionPlan('screens.regions').cascade.map(r=>r.from).join()]")],[0,'navigation.ops.tools.items.nav-regions']);
  assert.equal(s.run("deleteEntity('screens.regions')"),true);
  assert.equal(s.run("model.screens.some(x=>x.id==='regions')||model.navigation.ops[1].items.some(i=>i.screenId==='regions')||model.roles.some(r=>'regions' in r.permissions)"),false);
  assert.equal(s.run('audit[0].action+\"@\"+audit[0].target'),'Deleted screen@screens.regions');
  // A person who holds both Studio roles sees the dependent grants and overrides cascade, and only those listed.
  const both=studio();
  both.run("administration.administrators.find(a=>a.name==='Jordan Lee').grants.push({id:'grant-90',role:'security-administrator',state:'granted',proposedBy:'sam.okafor',proposedAt:'2026-09-01T09:00:00Z',reason:'Test fixture',approvedBy:'elena.ruiz',approvedAt:'2026-09-01T10:00:00Z',approvalReason:'Test fixture'})");
  assert.equal(both.run("deletionPlan('screens.orders').blocking.map(r=>r.via).join()"),'default screen');
  assert.deepEqual([...both.run("deletionPlan('screens.regions').cascade.map(r=>r.from).sort()")],['navigation.ops.tools.items.nav-regions','roles.operations-editor.permissions.regions','roles.operations-reader.permissions.regions']);
  assert.ok(both.run("deletionPlan('screens.customers').cascade.some(r=>r.from==='users.sara%2Eevans.overrides.#0'&&r.via==='override screen')"));
  assert.equal(both.run("deleteEntity('screens.regions')"),true);
  assert.deepEqual([...both.run("deletionPlan('roles.operations-reader').cascade.map(r=>r.from).sort()")],['users.daniel%2Eweber','users.jay%2Epatel']);
  assert.equal(both.run("deleteEntity('roles.operations-reader')"),true);
  assert.deepEqual([...both.run("[model.roles.length,model.users.some(u=>u.roles.includes('operations-reader')),model.users.length]")],[1,false,6]);
  assert.deepEqual([...errorCodes(both)],[],'no orphan is left behind');
  assert.ok(hasIssue(both,'USER_CANNOT_START','users.jay%2Epatel'),'a person left without an application role is reported');
  // An application is never deleted from its own draft.
  assert.match(s.run("deletionPlan('applications.ops').blocking[0].via"),/deleted under Platform, All applications/);
  assert.equal(s.run("deleteEntity('applications.ops')"),false);
});

test('Studio 3.1: navigation reordering works and no move control is nested in a selection control', () => {
  const s=studio();
  assert.equal(s.run("moveNav('ops','daily','',1)"),true);assert.deepEqual([...s.run("model.navigation.ops.map(g=>g.id+':'+g.sequence)")],['tools:10','daily:20','insights:30']);
  assert.equal(s.run("moveNav('ops','daily','nav-inventory',-1)"),true);assert.deepEqual([...s.run("model.navigation.ops[1].items.map(i=>i.id)")],['nav-orders','nav-inventory','nav-customers']);
  assert.equal(s.run("moveNav('ops','insights','',1)"),false);
  assert.equal(s.run("moveNavItemToGroup('ops','daily','nav-orders','insights')"),true);assert.deepEqual([...s.run("model.navigation.ops[2].items.map(i=>i.id)")],['nav-sales','nav-orders']);
  s.run("state.module='navigation';renderNavigation()");
  const html=s.run('host.innerHTML');
  assert.match(html,/data-action="moveNav" data-group="daily" data-item="nav-inventory" data-delta="-1"/);
  absent(html,/<button[^>]*data-kind="nav"[^>]*>(?:(?!<\/button>)[\s\S])*data-action="moveNav"/);
  absent(admin,/closest\('\[data-nav-selection\]'\)/);
});

test('Studio 3.3/15.5: audit records the real target, outcome, reason and before/after digests', () => {
  const s=studio(),before=s.run('digest()');
  s.run("checkpoint('Created screen',()=>model.screens.push(newScreen('exceptions','Exceptions','grid','orders')),'screens.exceptions')");
  assert.deepEqual([...s.run('[audit[0].action,audit[0].target,audit[0].application,audit[0].outcome,audit[0].before,audit[0].after===digest(),audit[0].version,audit[0].actor]')],['Created screen','screens.exceptions','ops','Succeeded',before,true,'ver-2026-09-2','Jordan Lee']);
  assert.match(s.run('audit[0].time'),/^\d{4}-\d\d-\d\dT/);
  const named=s.run("model.connections.find(c=>c.id==='analytics-db').name");
  assert.equal(s.run("setProp('connections.analytics-db','name','Analytics data store','')"),false,'a configurator does not change connections');
  s.run("state.actor='Chris Doyle';setProp('connections.analytics-db','name','Analytics data store','');state.actor='Jordan Lee'");assert.equal(s.run('audit[0].target+\"|\"+audit[0].detail'),`connections.analytics-db|name: ${named} to Analytics data store`);
  s.run("recordApproval('Product','x')");assert.equal(s.run('audit[0].action+audit[0].outcome'),'Refused approvalDenied');
  s.run('publish()');assert.equal(s.run('audit[0].action+audit[0].outcome'),'Refused publicationBlocked');
  assert.ok(initial.audit.every(a=>/^\d{4}-\d\d-\d\dT/.test(a.time)&&'outcome' in a&&'reason' in a));
  assert.ok(s.run('Object.isFrozen(audit[0])'));
});

test('Studio 3.4: imported values cannot reach HTML unescaped', () => {
  const s=studio();
  const hostile=`x" onfocus="alert(1)" y="`,tag='<img src=x onerror=alert(1)>';
  s.run(`const bad=configuration();bad.screens[0].capabilities={[${JSON.stringify(hostile)}]:true};bad.screens[0].commands[0].key=${JSON.stringify(hostile)};bad.screens[0].autoRefresh=${JSON.stringify(hostile)};bad.navigation.ops[0].sequence=${JSON.stringify(hostile)};bad.reports[0].outputs=[${JSON.stringify(tag)}];globalThis.shapeErrors=configurationShapeIssues(bad);`);
  assert.ok(s.run('shapeErrors.length')>=4);assert.throws(()=>s.run('importConfiguration(bad)'));
  s.run(`const o=model.screens[0];o.caption=${JSON.stringify(tag)};o.description=${JSON.stringify(hostile)};o.fields[1].caption=${JSON.stringify(tag)};o.fields[1].group=${JSON.stringify(hostile)};o.fields[1].format=${JSON.stringify(hostile)};o.commands[0].label=${JSON.stringify(tag)};o.commands[0].shortcut=${JSON.stringify(hostile)};o.commands[0].policy=${JSON.stringify(hostile)};o.filterMode=${JSON.stringify(hostile)};
    model.reports[0].outputs=[${JSON.stringify(tag)}];model.reports[0].columns[0].caption=${JSON.stringify(tag)};model.navigation.ops[0].label=${JSON.stringify(tag)};model.dataClasses[0].source=${JSON.stringify(hostile)};model.dataClasses[0].parameters[0].name=${JSON.stringify(hostile)};model.connections[0].secretRef=${JSON.stringify(tag)};model.connections[0].providerId=${JSON.stringify(hostile)};model.roles[1].name=${JSON.stringify(tag)};model.valueLists[0].values[0].label=${JSON.stringify(tag)};model.valueLists[0].values[0].value=${JSON.stringify(hostile)};
    Object.assign(model.users[3],{displayName:${JSON.stringify(tag)},email:${JSON.stringify(hostile)},subject:${JSON.stringify(hostile)},region:${JSON.stringify(hostile)}});model.users[3].overrides[0].reason=${JSON.stringify(tag)};model.users[3].overrides[0].screenId=${JSON.stringify(hostile)};model.users[3].roles.push(${JSON.stringify(hostile)});state.selectedUser=${JSON.stringify(hostile)};
    model.applications[0].name=${JSON.stringify(tag)};model.applications[0].shortName=${JSON.stringify(hostile)};
    state.selectedField='customer';state.navSelection='group:daily';state.selectedList='order-status';`);
  let html='';
  for(const tab of ['properties','field','command','behavior','access']){s.run(`state.inspectorTab='${tab}';renderScreens()`);html+=s.run('host.innerHTML');}
  for(const tab of ['definition','parameters','result','caching','write','dependencies']){s.run(`state.detailTab='${tab}';renderDataClasses()`);html+=s.run('host.innerHTML');}
  for(const tab of ['permissions','access','fields','rows','users']){s.run(`state.securityTab='${tab}';renderApplicationRoles()`);html+=s.run('host.innerHTML');}
  html+=s.run("renderApplicationUsers(),host.innerHTML")+s.run("userEffectiveAccess(state.selectedUser),''")+s.dialogs.at(-1).body+s.run("userOverrideDialog(state.selectedUser),''")+s.dialogs.at(-1).body;
  html+=s.run("renderOverview(),host.innerHTML")+s.run("renderApplication(),host.innerHTML")+s.run("renderAllApplications(),host.innerHTML")+s.run("renderSide(),document.getElementById('sideNav').innerHTML")+s.run("renderImpact(),host.innerHTML");
  html+=s.run("renderNavigation(),host.innerHTML")+s.run("renderReports(),host.innerHTML")+s.run("renderConnections(),host.innerHTML")+s.run("renderValues(),host.innerHTML")+s.run("renderValidation(),host.innerHTML")+s.run("renderVersions(),host.innerHTML")+s.run("renderAudit(),host.innerHTML")+s.run("reportPreview(model.reports[0])")+s.run("comparison('ver-2026-09-1','draft')");
  absent(html,/<img src=x/);absent(html,/" onfocus="alert/);
  present(html,/&lt;img src=x onerror=alert\(1\)&gt;/);present(html,/x&quot; onfocus=&quot;alert\(1\)&quot;/);
});

test('Studio 3.7/8.4: a new screen binds a real field; all fifteen control types validate and render', () => {
  const s=studio();
  const r=studio();
  s.run("model.screens.push(newScreen('trend','Trend','grid','sales-summary'))");r.run("switchApplication('risk');model.screens.push(newScreen('check2','Second check','action','run-limit-check'))");
  assert.equal(s.run("model.screens.at(-1).fields[0].binding")+'|'+r.run("model.screens.at(-1).appId+'|'+model.screens.at(-1).fields[0].binding+'|'+model.screens.at(-1).commands.map(c=>c.key+':'+c.policy).join()"),'month|risk|desk|Run:check2.execute,Detach:check2.execute');
  for(const x of [s,r])assert.equal(x.run("validationIssues().filter(i=>i.severity==='error'&&/^screens\\.(trend|check2)/.test(i.path)).length"),0);
  assert.deepEqual([...s.run('FIELD_TYPES')],['text','textarea','number','currency','percentage','date','datetime','time','boolean','select','lookup','label','hidden','action','subscreen']);
  s.run(`const c=model.screens.find(x=>x.id==='customers'),base={role:'data',group:'extra',required:false,visible:true,editable:true};
    c.fields.push({...base,id:'pct',caption:'Share',binding:'credit_limit',type:'percentage',sequence:110},{...base,id:'since',caption:'Reviewed at',binding:'name',type:'time',sequence:120},{...base,id:'note',caption:'Read the service notes first',binding:'',type:'label',sequence:130},
      {...base,id:'scope',caption:'Scope',binding:'region',type:'hidden',role:'criteria',sequence:140},{...base,id:'go',caption:'Save now',binding:'id',type:'action',command:'Save',sequence:150},{...base,id:'pick',caption:'Pick order',binding:'id',type:'subscreen',targetScreen:'orders',sequence:160},{...base,id:'find',caption:'Find by name',binding:'name',type:'text',role:'criteria',sequence:170});`);
  assert.deepEqual([...errorCodes(s)],[]);
  const html=s.run("screenCanvas(model.screens.find(x=>x.id==='customers'))");
  for(const text of ['250000%','Read the service notes first','preview-button">Save now','opens Order register','Find by name <em>\\(criteria\\)</em>','Scope \\(hidden criteria\\)','☑ Yes','Maya Chen'])assert.match(html,new RegExp(text));
  s.run("model.screens.find(x=>x.id==='customers').fields.find(f=>f.id==='scope').role='data';model.screens.find(x=>x.id==='customers').fields.find(f=>f.id==='go').command='Nope';delete model.screens.find(x=>x.id==='customers').fields.find(f=>f.id==='pick').targetScreen");
  for(const path of ['screens.customers.fields.scope.role','screens.customers.fields.go.command','screens.customers.fields.pick.targetScreen'])assert.ok(hasIssue(s,'FIELD_INCOMPLETE',path),path);
});

test('Studio 11.4/15.2: preview and effective access follow role permissions, field policies and capabilities', () => {
  const s=studio();
  const tools=role=>{s.run(`state.previewRole=${JSON.stringify(role)}`);return [...s.run("screenCanvas(model.screens[0],false)").matchAll(/preview-tool">([^<]+)</g)].map(m=>m[1]).join();};
  assert.equal(tools(''),'Add,Edit,Delete,Refresh,Filter,Search,Customise view,Export,Print,Detach');
  assert.equal(tools('operations-reader'),'Refresh,Filter,Search,Customise view,Export,Print,Detach');
  s.run("state.previewRole='user:ken.ito'");assert.match(s.run("screenCanvas(model.screens[0],false)"),/Ken Ito is granted nothing on this screen \(no role\)/);
  s.run("state.previewRole='user:sara.evans'");
  assert.equal([...s.run("screenCanvas(model.screens.find(x=>x.id==='customers'),false)").matchAll(/preview-tool">([^<]+)</g)].map(m=>m[1]).join(),'Previous record,Next record,Refresh,Detach','the application user override leaves read only');
  assert.equal(tools('user:sara.evans'),'Add,Edit,Delete,Refresh,Filter,Search,Customise view,Export,Print,Detach','without an override the application roles decide');
  s.run("state.previewRole='operations-reader'");assert.doesNotMatch(s.run("screenCanvas(model.screens.find(x=>x.id==='customers'),false)"),/Credit limit/);
  s.run("state.previewRole='operations-editor'");assert.match(s.run("screenCanvas(model.screens.find(x=>x.id==='customers'),false)"),/Credit limit/);
  assert.doesNotMatch(s.run("screenCanvas(model.screens[0],false)"),/data-action/,'a preview carries no authoring control');
});

test('Studio: undo and redo are both audited and restore exact content', () => {
  const s=studio(),before=s.run('digest()');
  s.run("setProp('screens.orders','caption','Orders','')");const changed=s.run('digest()');
  assert.equal(s.run('undo()'),true);assert.equal(s.run('digest()'),before);
  assert.equal(s.run('redo()'),true);assert.equal(s.run('digest()'),changed);
  assert.deepEqual([...s.run('audit.slice(0,3).map(a=>a.action)')],['Reapplied configuration change','Undid configuration change','Updated screen']);
  assert.equal(s.run('redo()'),false);
});

test('Studio accessibility and robustness contracts are present in the source', () => {
  const s=studio();
  s.run('renderScreens()');
  assert.match(s.run('host.innerHTML'),/role="tablist" aria-label="Inspector sections"/);assert.match(s.run('host.innerHTML'),/role="tab" id="tab-inspectorTab-properties" aria-selected="true" tabindex="0"/);
  assert.match(s.run('host.innerHTML'),/role="tabpanel" aria-labelledby="tab-inspectorTab-properties"/);
  s.run('renderApplicationRoles()');assert.match(s.run('host.innerHTML'),/class="role-pill active" role="tab" aria-selected="true"/);
  s.run('renderConnections()');assert.match(s.run('host.innerHTML'),/<button class="link" data-action="select" data-kind="connection" data-id="analytics-db"/);
  present(admin,/aria-current="page"/);present(admin,/setAttribute\('role',sticky\?'alert':'status'\)/);present(admin,/Dismiss message/);
  present(admin,/function stored\(key\)\{try\{return localStorage\.getItem\(key\);\}catch/);assert.equal((admin.match(/localStorage\./g)||[]).length,2);
  absent(admin,/\.page-actions \.button:not\(\.primary\)\{display:none\}/);
  present(admin,/<button class="button small" data-action="importJson"/);absent(admin,/<label[^>]*for="importJson"/);
  absent(admin,/\bconfirm\(/);absent(admin,/\.drop-zone|\.diff-col|\.diff-head|\.diff-line/);
  const inputs=s.run("(renderDataClasses(),host.innerHTML)+(renderApplicationRoles(),host.innerHTML)+(renderApplicationUsers(),host.innerHTML)+(renderApplication(),host.innerHTML)+(renderReports(),host.innerHTML)+(renderValues(),host.innerHTML)");
  for(const m of inputs.matchAll(/<(input|select|textarea)\b([^>]*)>/g))assert.ok(/aria-label=|id="/.test(m[2])||/type="checkbox"/.test(m[2]),m[0]);
});

/* ---- Application-owned access: each application has its own version line, application roles and application users ---- */
const security = () => { const s = studio(); s.run("state.actor='Alex Morgan'"); return s; };
const as = (name, s = studio()) => { s.run(`state.actor=${JSON.stringify(name)}`); return s; };
const draftFacts = "JSON.stringify([digest(),state.dirty,state.validated,state.validation&&state.validation.digest,Object.keys(state.approvals),state.history.length,canonical(configuration())])";
// Everything one version line holds, for every application, whichever one is open in the editor.
const lineFacts = "JSON.stringify(Object.fromEntries(Object.keys(lines).map(id=>{const l=lineOf(id);return [id,[digest(l.draftConfig),l.draft.label,l.dirty,l.validated,l.validation&&l.validation.digest,Object.keys(l.approvals).join(),JSON.stringify(l.schedule),l.history.length,l.future.length,l.publicationRevision,l.releases.map(v=>v.label+':'+v.status+':'+v.digest).join()]];})))";
const approveAll = "for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,'Reviewed');}state.actor='Jordan Lee';";

test('Seed: the application users of each application are the agreed sample, and hold no credential', () => {
  const row=u=>[u.subject,u.displayName,u.email,u.region,u.active,u.default,u.roles.join(),u.overrides.length];
  assert.deepEqual(initial.configurations.ops.users.map(row),[['alex.smith','Alex Smith','alex.smith@example.test','EU',true,true,'operations-editor',0],['maya.chen','Maya Chen','maya.chen@example.test','UK',true,true,'operations-editor',0],
    ['jay.patel','Jay Patel','jay.patel@example.test','UK',true,false,'operations-reader',0],['sara.evans','Sara Evans','sara.evans@example.test','NA',true,true,'operations-editor',1],
    ['daniel.weber','Daniel Weber','daniel.weber@example.test','EU',false,true,'operations-reader',0],['ken.ito','Ken Ito','ken.ito@example.test','APAC',true,true,'',0]]);
  assert.deepEqual(initial.configurations.risk.users.map(row),[['alex.smith','Alex Smith','alex.smith@example.test','EU',true,false,'risk-manager',0],['jay.patel','Jay Patel','jay.patel@example.test','UK',true,true,'risk-reader',0]]);
  assert.deepEqual(initial.configurations.ops.users[3].overrides,[{screenId:'customers',permissions:{read:true},reason:'Read-only access during secondment'}]);
  assert.ok(seed.users.every(u=>JSON.stringify(Object.keys(u))===JSON.stringify(['subject','displayName','email','region','active','default','roles','overrides'])));
  const keys=new Set();(function walk(v){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){keys.add(k);walk(x);}})(seed.users);
  assert.deepEqual([...keys].filter(k=>/pass|pwd|secret|credential|token|hash|salt|pin$/i.test(k)),[]);
  const s=studio();
  assert.deepEqual([...s.run("[releases[0].label,releases[0].snapshot.users.length,releases[0].snapshot.users.find(u=>u.subject==='sara.evans').overrides.length,findUser('sara.evans').overrides.length]")],['2026.09.1',6,0,1],'the override is new in the draft');
  assert.ok(s.run('configKeys').includes('users'));
  const before=s.run('digest()');s.run("model.users[0].region='UK'");assert.notEqual(s.run('digest()'),before,'application users are inside the configuration and its digest');
  s.run("model.users[0].password='x'");
  assert.match(String(s.run('configurationShapeIssues(configuration())[0]')),/^users\.alex%2Esmith\.password: expected absent: an application user entry holds only .* never a credential/);
  s.run("delete model.users[0].password");const changed=s.run('digest()');
  s.run("fixtures.operations.signIns.ops['alex.smith'].lastLogin='2031-01-01T00:00:00Z';administration.policyRevision=99");
  assert.equal(s.run('digest()'),changed,'sign-in times and Studio access are outside the digest');
  assert.equal(fixtures.operations.signIns.ops['alex.smith'].lastLogin,'2026-09-06T07:58:00Z');assert.deepEqual(Object.keys(fixtures.operations.signIns),['ops','risk']);
  s.run("state.selectedUser='sara.evans';renderApplicationUsers()");
  absent(admin,/type="password"/i);absent(s.run('host.innerHTML'),/password|passphrase|credential field/i);
});

test('Seed: no group mapping, group directory, shared collection or live user list remains', () => {
  assert.deepEqual(Object.keys(initial),['configurations','platform','audit']);
  for(const id of seedApps){
    const c=initial.configurations[id];
    assert.deepEqual(Object.keys(c),['draft','publicationRevision','applications','navigation','screens','dataClasses','connections','valueLists','reports','roles','users','releases'],id);
    assert.deepEqual([c.applications.map(a=>a.id).join(),Object.keys(c.navigation).join()],[id,id]);
    assert.ok([...c.screens,...c.dataClasses,...c.reports].every(x=>x.appId===id),id+' holds nothing of another application');
  }
  assert.deepEqual(seedApps.map(id=>[id,initial.configurations[id].connections.map(c=>c.id).join(),initial.configurations[id].valueLists.map(v=>v.id).sort().join()]),
    [['ops','ops-db,analytics-db','customers,employees,order-status,products,regions,sales-period,segments'],['risk','risk-db','desks,jurisdictions,risk-category,risk-rating,risk-status']]);
  assert.ok(seed.roles.every(r=>JSON.stringify(Object.keys(r))===JSON.stringify(['id','name','active','permissions','fieldPolicies','rowScopes'])),'no applications list and no subjects on an application role');
  assert.deepEqual(Object.keys(initial.platform),['settings','messages']);
  assert.deepEqual(Object.keys(fixtures.administration),['policyRevision','signIns','administrators']);
  assert.ok(!('roleMembers' in fixtures.deployment));
  absent(admin,/' \(group\)'|group mapping|subject mapping|"subjects"|subjectType|identity-provider group|roleMembers|administration\.(users|directory)|userGroups|operations-readers|risk-managers/i);
  absent(admin,/Refused user administration|canAdministerUsers|\[data-admin\]|registerUser|assignApplication|setDefaultApplication|Policy revision \(users\)|model\.workspace/);
  const s=studio();
  assert.deepEqual([...s.run('configKeys')],['applications','navigation','screens','dataClasses','connections','valueLists','reports','roles','users']);
  assert.deepEqual([...s.run("Object.keys(STUDIO_CAPABILITIES)")].includes('users'),false);
});

test('Application versions: each application has its own version line with the agreed labels', () => {
  assert.deepEqual(seedApps.map(id=>[id,initial.configurations[id].draft.label,...initial.configurations[id].releases.map(v=>v.status+' '+v.label)]),
    [['ops','Draft 2026.09.2','Published 2026.09.1','Superseded 2026.08.4'],['risk','Draft 2026.08.3','Published 2026.08.2','Superseded 2026.07.1']]);
  const s=studio(),facts=JSON.parse(s.run(lineFacts));
  assert.deepEqual(Object.keys(facts),['ops','risk']);
  assert.notEqual(facts.ops[0],facts.risk[0],'each application has its own digest');
  assert.deepEqual([facts.ops.slice(1,10),facts.risk.slice(1,10)],[['Draft 2026.09.2',0,false,null,'','null',0,0,7],['Draft 2026.08.3',0,false,null,'','null',0,0,4]]);
  assert.match(facts.ops[10],/^2026\.09\.1:Published:[0-9a-f]{8},2026\.08\.4:Superseded:[0-9a-f]{8}$/);assert.match(facts.risk[10],/^2026\.08\.2:Published:[0-9a-f]{8},2026\.07\.1:Superseded:[0-9a-f]{8}$/);
  assert.equal(s.run('digest()'),facts.ops[0],'the digest of an application covers exactly its own configuration');
  absent(s.run('canonical(configuration())'),/risk-db|risk-manager|limitCheck|"settings"|"messages"|adm-0/,'nothing of another application, of the platform or of Studio access is in it');
  s.run("switchApplication('risk')");
  assert.deepEqual([...s.run("[state.appId,model.draft.label,model.draft.basedOn,releases.map(v=>v.id).join(),model.applications.map(a=>a.id).join(),model.screens.map(x=>x.id).join(),state.selectedScreen,state.selectedRole,state.selectedUser]")],
    ['risk','Draft 2026.08.3','ver-2026-08-2','ver-2026-08-2,ver-2026-07-1','risk','risks,limitCheck','risks','risk-reader','alex.smith']);
  assert.equal(s.run('digest()'),facts.risk[0]);
  s.run("selectVersion('ver-2026-08-2')");
  assert.equal(s.run("roleGrants(model.roles.find(r=>r.id==='risk-manager'),'risks','export')"),false,'the published version of this application, not of the other');
  s.run("switchApplication('ops')");assert.deepEqual([...s.run('[state.viewVersion,readOnly(),model.draft.label]')],[null,false,'Draft 2026.09.2']);
  s.run("switchApplication('risk')");assert.deepEqual([...s.run('[state.viewVersion,readOnly()]')],['ver-2026-08-2',true],'each line remembers the version it was showing');
  s.run('renderVersions()');present(s.run('host.innerHTML'),/This is the version line of Risk &amp; Controls alone/);absent(s.run('host.innerHTML'),/2026\.09\./);
});

test('Application versions: editing, validating, approving, publishing or rolling back one application leaves the other untouched', () => {
  const s=studio(),facts=()=>JSON.parse(s.run(lineFacts)),records=id=>s.run(`audit.filter(a=>a.application===${JSON.stringify(id)}).length`),risk=facts().risk,riskRecords=records('risk');
  s.run("setProp('screens.orders','caption','Orders','')");
  assert.deepEqual(facts().risk,risk);
  s.run("switchApplication('risk')");
  assert.deepEqual([...s.run('[state.dirty,state.history.length,undo(),redo()]')],[0,0,false,false],'a change in one application is not on the other application\'s undo stack');
  s.run("switchApplication('ops')");assert.deepEqual([...s.run('[state.dirty,state.history.length,model.screens[0].caption]')],[1,1,'Orders']);
  validCandidate(s);s.run(approveAll+"state.publicationNote='Order caption'");
  assert.equal(s.run('draftStatus()'),'Approved');assert.equal(facts().risk[3],false,'the other application is neither validated nor approved by this');
  assert.equal(s.run('performPublish()'),true);
  const published=facts();
  assert.deepEqual(published.risk,risk,'the other application keeps its draft, digest, validation, approvals, schedule, history and releases');
  assert.equal(published.ops[1],'Draft 2026.09.3');assert.equal(published.ops[9],8);assert.match(published.ops[10],/^2026\.09\.2:Published:[0-9a-f]{8},2026\.09\.1:Superseded:/);
  assert.equal(records('risk'),riskRecords,'no audit record is written for the other application');
  s.run("switchApplication('risk')");
  assert.deepEqual([...s.run("[state.validated,Object.keys(state.approvals).length,state.publicationRevision,releases.map(v=>v.label+' '+v.status).join()]")],[false,0,4,'2026.08.2 Published,2026.07.1 Superseded']);
  const ops=facts().ops,opsRecords=records('ops');
  s.run("state.actor='Chris Doyle';setProp('connections.risk-db','name','Risk data store','');state.actor='Jordan Lee'");
  validCandidate(s);s.run(approveAll+"state.publicationNote='Risk export'");
  assert.equal(s.run('performPublish()'),true);assert.equal(s.run("performRollback('ver-2026-08-2','Export regression')"),true);assert.equal(s.run("performRetire('ver-2026-07-1','Retention expired')"),true);
  assert.deepEqual([...s.run("[model.draft.label,state.publicationRevision,releases.map(v=>v.label+' '+v.status).join()]")],['Draft 2026.08.4',7,'2026.08.3 Withdrawn,2026.08.2 Published,2026.07.1 Retired']);
  assert.deepEqual(facts().ops,ops);assert.equal(records('ops'),opsRecords);
});

test('Application versions: a scheduled publication activates its own application only, whichever application is open', () => {
  const s=studio(),facts=()=>JSON.parse(s.run(lineFacts));validCandidate(s);
  s.run(approveAll+"state.publicationNote='Night release'");
  assert.equal(s.run("schedulePublication(new Date(Date.now()+3600000).toISOString())"),true);
  s.run("switchApplication('risk')");const risk=facts().risk;
  assert.equal(s.run('state.schedule'),null,'the other application has no schedule');
  assert.equal(s.run('tickSchedule(Date.now())'),false);assert.equal(s.run('tickSchedule(Date.now()+7200000)'),true);
  assert.deepEqual([...s.run('[state.appId,model.draft.label,releases.length,audit[0].action,audit[0].application]')],['risk','Draft 2026.08.3',2,'Published version','ops']);
  assert.deepEqual(facts().risk,risk);
  assert.deepEqual([...s.run("[lines.ops.releases[0].label,lines.ops.releases[0].status,lines.ops.releases[0].summary,lines.ops.draft.label,lines.ops.schedule]")],['2026.09.2','Published','Night release','Draft 2026.09.3',null]);
});

test('Application boundary: a reference to another application\'s screen, DataClass, connection, value list, report or role is an error', () => {
  const s=studio();
  s.run(`model.screens[0].fields.find(f=>f.id==='region').valueList='risk-rating';model.screens[1].dataClassId='risks';model.dataClasses[0].connectionId='risk-db';model.screens[2].reportId='risk-export';
    model.navigation.ops[0].items[0].screenId='risks';model.roles[0].permissions.risks={read:true};model.reports[0].appId='risk';model.valueLists.find(v=>v.id==='products').dataClassId='run-limit-check';model.roles[1].rowScopes[0].dataClassId='risks'`);
  for(const path of ['screens.orders.fields.region.valueList','screens.customers.dataClassId','dataClasses.orders.connectionId','screens.inventory.reportId','navigation.ops.daily.items.nav-orders.screenId','roles.operations-reader.permissions.risks','reports.order-export.appId','valueLists.products.dataClassId','roles.operations-editor.rowScopes.#0.dataClassId'])assert.ok(hasIssue(s,'CROSS_APPLICATION_REFERENCE',path),path);
  assert.ok(s.run("validationIssues().filter(i=>i.code==='CROSS_APPLICATION_REFERENCE').every(i=>i.severity==='error'&&/belongs to Risk & Controls\\. Nothing is shared between applications/.test(i.text))"));
  s.run("model.screens[3].dataClassId='nowhere'");
  assert.ok(hasIssue(s,'INVALID_REFERENCE','screens.repricing.dataClassId'),'a name that exists in no application is an ordinary missing reference');
  assert.equal(s.run("state.actor='Jordan Lee',completeValidation()"),false);assert.match(s.run('publicationBlockers()[0]'),/resolve errors/);
  const r=studio();r.run("switchApplication('risk');model.screens[0].fields.push({id:'product',caption:'Product',binding:'title',type:'lookup',role:'data',group:'columns',required:false,visible:true,editable:true,sequence:80,valueList:'products'});model.dataClasses[0].connectionId='ops-db'");
  for(const path of ['screens.risks.fields.product.valueList','dataClasses.risks.connectionId'])assert.ok(hasIssue(r,'CROSS_APPLICATION_REFERENCE',path),path);
  assert.match(r.run("validationIssues().find(i=>i.code==='CROSS_APPLICATION_REFERENCE').text"),/belongs to Operations Hub/);
  for(const id of seedApps){const clean=studio();clean.run(`switchApplication(${JSON.stringify(id)})`);assert.equal(hasIssue(clean,'CROSS_APPLICATION_REFERENCE',''),false,id);}
  s.run('renderValidation()');present(s.run('host.innerHTML'),/<strong>CROSS_APPLICATION_REFERENCE<\/strong>/);
});

test('Application roles: a role belongs to one application and cannot be attached to a second', () => {
  const s=security();
  s.run("model.roles[0].applications=['ops','risk']");
  assert.match(String(s.run('configurationShapeIssues(configuration()).join()')),/roles\.operations-reader\.applications: expected absent: an application role belongs to the one application whose configuration holds it/);
  assert.ok(hasIssue(s,'INVALID_SHAPE','roles.operations-reader.applications'));
  s.run("delete model.roles[0].applications;model.roles[0].subjects=[{type:'group',id:'readers'}]");assert.ok(hasIssue(s,'INVALID_SHAPE','roles.operations-reader.subjects'));
  s.run("delete model.roles[0].subjects");assert.deepEqual([...errorCodes(s)],[]);
  assert.throws(()=>s.run("const attached=configuration();attached.roles[0].applications=['risk'];importConfiguration(attached)"),/roles\.operations-reader\.applications/);
  assert.equal(s.run("setMember('roles.operations-reader','applications','risk',true)"),true,'the generic editor can be driven to add the property');
  assert.ok(hasIssue(s,'INVALID_SHAPE','roles.operations-reader.applications'),'and the candidate is then rejected');s.run('undo()');
  for(const tab of ['permissions','access','fields','rows','users']){s.run(`state.securityTab='${tab}';renderApplicationRoles()`);absent(s.run('host.innerHTML'),/data-prop="applications"|data-prop="subjects"|Application access|Subject mappings?/);}
  s.run("state.securityTab='access';renderApplicationRoles()");
  present(s.run('host.innerHTML'),/<label>Belongs to application<\/label><input value="Operations Hub" disabled/);present(s.run('host.innerHTML'),/An application role belongs to Operations Hub and to no other application\./);
  s.run("switchApplication('risk')");
  assert.deepEqual([...s.run("model.roles.map(r=>r.id)")],['risk-reader','risk-manager']);
  assert.equal(s.run("setUserRole('jay.patel','operations-reader',true)"),false);
  assert.match(s.messages.at(-1)[0],/operations-reader is an application role of Operations Hub\. An application user of Risk & Controls holds roles of Risk & Controls only\./);
  s.run("state.securityTab='permissions';renderApplicationRoles()");
  absent(s.run('host.innerHTML'),/Operations reader|data-key="orders"/,'the permission matrix names only screens of the owning application');
  present(admin,/model\.roles\.push\(\{id:v\.newId,name:v\.newName,active:true,permissions:\{\},fieldPolicies:\[\],rowScopes:\[\]\}\)/);
});

test('Application users: a change is a draft change of its own application and is not live until that application is published', () => {
  const s=studio(),facts=()=>JSON.parse(s.run(lineFacts)),start=subject=>s.run(`JSON.stringify(canStart(${JSON.stringify(subject)}))`);validCandidate(s);
  s.run("state.actor='Priya Raman';recordApproval('Product','Reviewed');state.actor='Alex Morgan'");
  const before=facts(),digest=s.run('digest()'),revision=s.run('administration.policyRevision');
  assert.deepEqual([...s.run('[state.dirty,state.validated,Object.keys(state.approvals).length]')],[0,true,1]);
  assert.equal(s.run("setMember(userPath('ken.ito'),'roles','operations-reader',true)"),true);
  assert.deepEqual([...s.run('[state.dirty,state.validated,state.validation,Object.keys(state.approvals).length,state.history.length]')],[1,false,null,0,1],'it raises the change count and clears validation and approvals');
  assert.notEqual(s.run('digest()'),digest);assert.deepEqual(facts().risk,before.risk,'only this application\'s digest changes');
  assert.deepEqual([...s.run('[audit[0].action,audit[0].target,audit[0].application,audit[0].actor,audit[0].version,audit[0].detail]')],['Updated application user','users.ken%2Eito','ops','Alex Morgan','ver-2026-09-2','roles: operations-reader added']);
  assert.equal(s.run('administration.policyRevision'),revision,'no live policy revision is involved');
  assert.equal(s.run("JSON.stringify(userStart(findUser('ken.ito')))"),'{"ok":true,"reason":""}','the draft would admit him');
  assert.equal(start('ken.ito'),'{"ok":false,"reason":"No role"}','GD Workspace still applies the published version');
  assert.equal(s.run('undo()'),true);assert.equal(s.run('digest()'),digest);assert.deepEqual([...s.run("[state.dirty,findUser('ken.ito').roles.length]")],[0,0],'Undo takes it back');
  assert.equal(s.run('redo()'),true);
  for(const change of ["setProp(userPath('maya.chen'),'email','maya.chen@example.org','')","setProp(userPath('maya.chen'),'active',false,'boolean')","setProp(userPath('jay.patel'),'default',true,'boolean')","setUserOverride('maya.chen','orders',{read:true},'Read-only while covering leave')",
    "removeUserOverride('sara.evans','customers')","addUser('new.person','New Person','new.person@example.test','UK','operations-reader')","deleteEntity(userPath('daniel.weber'))"]){
    const dirty=s.run('state.dirty'),records=s.run('audit.length');assert.equal(s.run(change),true,change);
    assert.deepEqual([...s.run('[state.dirty,audit.length,audit[0].application,state.validated]')],[dirty+1,records+1,'ops',false],change);
  }
  assert.equal(s.run('JSON.stringify(model.users.at(-1))'),'{"subject":"new.person","displayName":"New Person","email":"new.person@example.test","region":"UK","active":true,"default":false,"roles":["operations-reader"],"overrides":[]}');
  for(const bad of [["","X","x@example.test"],["Has Space","X","x@example.test"],["alex.smith","X","x@example.test"],["ok.subject","","x@example.test"],["ok.subject","X","not-an-email"]])assert.equal(s.run(`addUser(${JSON.stringify(bad[0])},${JSON.stringify(bad[1])},${JSON.stringify(bad[2])},'UK')`),false,bad.join('|'));
  assert.deepEqual([start('new.person'),start('daniel.weber'),start('maya.chen')],['{"ok":false,"reason":"Not a user of this application"}','{"ok":false,"reason":"Inactive"}','{"ok":true,"reason":""}'],'nothing of the draft is live');
  assert.deepEqual(facts().risk,before.risk);assert.equal(s.run("findUser('alex.smith',lines.risk.draftConfig).roles.join()"),'risk-manager');
  // Publication: the security administrator contributed, so the Security review needs a different, independent checker.
  s.run("state.actor='Jordan Lee';completeValidation()");assert.equal(s.run('state.validated'),true);
  s.run("state.actor='Priya Raman';recordApproval('Product','Reviewed');state.actor='Dana Whitlock';recordApproval('Test','Reviewed');state.actor='Alex Morgan'");
  assert.equal(s.run("recordApproval('Security','Reviewed')"),false);assert.match(s.messages.at(-1)[0],/author or a contributor cannot approve this candidate/);
  assert.equal(s.run("approverNote('Security')"),'Can be recorded by Nadia Hassan. Alex Morgan is the author or a contributor of this draft and cannot approve it.');
  assert.equal(s.run("approverNote('Product')"),'Can be recorded by Priya Raman.');
  // The genuine dead end, made explicitly: the only independent Security checker loses the Studio role.
  const nadia=s.run("administration.administrators.find(a=>a.name==='Nadia Hassan').id");
  assert.equal(s.run(`state.actor='Sam Okafor';revokeGrant(${JSON.stringify(nadia)},'approver-security','Leaves the review rota')`),true);
  assert.deepEqual([...s.run("eligibleCheckers('Security')")],[]);
  assert.equal(s.run("approverNote('Security')"),'Nobody can record it yet: Alex Morgan holds approver-security but is the author or a contributor of this draft. A different Studio user must be granted the role under Studio users.');
  s.run('renderVersions()');present(s.run('host.innerHTML'),/<strong>Security approval<\/strong><p class="muted">Nobody can record it yet: Alex Morgan holds approver-security but is the author or a contributor of this draft\./);
  assert.equal(s.run("state.actor='Alex Morgan';recordApproval('Security','Reviewed')"),false);assert.equal(s.run("state.actor='Jordan Lee';performPublish()"),false,'the dead end blocks publication');
  assert.match(s.run('publicationBlockers()[0]'),/all three digest-bound checker approvals are required/);
  assert.equal(s.run(`state.actor='Sam Okafor';revokeGrant('adm-03','approver-security','Rota change')`),true);
  assert.equal(s.run("approverNote('Security')"),'Nobody holds approver-security yet. It is granted under Studio users.');
  const chris=s.run("administration.administrators.find(a=>a.name==='Chris Doyle').id");
  assert.equal(s.run(`state.actor='Sam Okafor';proposeGrant(${JSON.stringify(chris)},'approver-security','Independent checker for access changes')`),true);
  assert.equal(s.run(`state.actor='Elena Ruiz';decideGrant(${JSON.stringify(chris)},findAdministrator(${JSON.stringify(chris)}).grants.at(-1).id,true,'Agreed')`),true);
  assert.equal(s.run("state.actor='Chris Doyle';recordApproval('Security','Reviewed')"),true);
  assert.equal(s.run("state.actor='Jordan Lee';state.publicationNote='Access changes';performPublish()"),true);
  assert.deepEqual([start('ken.ito'),start('new.person'),start('daniel.weber'),start('maya.chen')],['{"ok":true,"reason":""}','{"ok":true,"reason":""}','{"ok":false,"reason":"Not a user of this application"}','{"ok":false,"reason":"Inactive"}'],'live once published');
  assert.deepEqual(facts().risk,before.risk,'publishing the user changes of one application changes nothing in the other');
  assert.equal(s.run("JSON.stringify(canStart('alex.smith','risk'))"),'{"ok":true,"reason":""}');
});

test('Application users: naming an application role or an override screen of another application is an error', () => {
  const s=security();
  s.run("findUser('jay.patel').roles.push('risk-reader');findUser('maya.chen').overrides.push({screenId:'risks',permissions:{read:true},reason:'Observer'})");
  assert.ok(hasIssue(s,'CROSS_APPLICATION_REFERENCE','users.jay%2Epatel.roles'));assert.ok(hasIssue(s,'CROSS_APPLICATION_REFERENCE','users.maya%2Echen.overrides.#0.screenId'));
  assert.match(s.run("validationIssues().find(i=>i.path==='users.jay%2Epatel.roles').text"),/^Application role held "risk-reader" belongs to Risk & Controls\. Nothing is shared between applications/);
  assert.deepEqual([...s.run("userRoles(findUser('jay.patel')).map(r=>r.id)")],['operations-reader'],'the foreign role grants nothing');
  assert.equal(s.run("canStart('maya.chen','risk').reason"),'Not a user of this application','and an entry in one application admits nobody to another');
  s.run("findUser('ken.ito').roles.push('retired-role')");assert.ok(hasIssue(s,'INVALID_REFERENCE','users.ken%2Eito.roles'),'a role of no application is an ordinary missing reference');
  s.run("state.selectedUser='jay.patel';renderApplicationUsers()");
  present(s.run('host.innerHTML'),/<code>risk-reader<\/code> is not an application role of Operations Hub; it belongs to Risk &amp; Controls\. It grants nothing and blocks publication\./);
  assert.equal(s.run("setUserRole('jay.patel','risk-reader',false)"),true);assert.equal(hasIssue(s,'CROSS_APPLICATION_REFERENCE','users.jay%2Epatel'),false);
  const t=security();
  assert.equal(t.run("setUserRole('maya.chen','risk-manager',true)"),false);assert.match(t.messages.at(-1)[0],/risk-manager is an application role of Risk & Controls\. An application user of Operations Hub holds roles of Operations Hub only\./);
  assert.equal(t.run("setUserOverride('maya.chen','risks',{read:true},'Observer')"),false);assert.match(t.messages.at(-1)[0],/Screen "risks" belongs to Risk & Controls\. An override names a screen of Operations Hub only\./);
  assert.equal(t.run("addUser('new.person','New Person','new.person@example.test','UK','risk-reader')"),false);assert.match(t.messages.at(-1)[0],/risk-reader is not an application role of Operations Hub/);
  for(const [call,why] of [["setUserOverride('sara.evans','repricing',{read:true},'x')",'read on an action screen'],["setUserOverride('sara.evans','orders',{read:true},' ')",'no reason'],["setUserOverride('sara.evans','nope',{read:true},'x')",'unknown screen'],["setUserRole('maya.chen','nope',true)",'unknown role']])assert.equal(t.run(call),false,why);
  assert.equal(t.run('state.dirty'),0,'a refused change is no change');
  const u=studio();
  u.run("model.users.push(structuredClone(model.users[0]))");assert.ok(hasIssue(u,'DUPLICATE_ID','users.alex%2Esmith'),'one entry per person in an application');
  u.run("model.users.pop();model.users.forEach(x=>{x.default=false;});model.users[1].email='not-an-email';model.users[2].displayName=' ';model.users[3].overrides[0].reason='';model.users[3].overrides[0].permissions={execute:true}");
  for(const [code,path] of [['FIELD_INCOMPLETE','users.maya%2Echen.email'],['CAPTION_REQUIRED','users.jay%2Epatel.displayName'],['FIELD_INCOMPLETE','users.sara%2Eevans.overrides.#0.reason'],['AMBIGUOUS_PERMISSION','users.sara%2Eevans.overrides.#0.permissions.execute']])assert.ok(hasIssue(u,code,path),path);
  assert.deepEqual([...u.run("validationIssues().filter(i=>i.severity==='warning').map(i=>i.code+'@'+i.path)")],['USER_CANNOT_START@users.ken%2Eito','NO_DEFAULT_USER@users'],'no role and no default are warnings, not errors');
  assert.deepEqual([...u.run("['USER_CANNOT_START','NO_DEFAULT_USER'].map(code=>warningRule(code).id)")],['WR-05','WR-06']);
  assert.match(u.run("validationIssues().find(i=>i.code==='USER_CANNOT_START').text"),/Ken Ito is active but holds no active application role, so start-up is refused: No role\./);
});

test('Studio roles: only a security-administrator changes application roles and users, only a database-owner connections, only a configurator the rest', () => {
  const changes={
    access:["setFlag('roles.operations-reader.permissions','sales','print',false)","setProp('roles.operations-reader','name','Reader','')","rowAdd('roles.operations-reader.fieldPolicies','fieldPolicy')","deleteEntity('roles.operations-reader')","setProp(userPath('maya.chen'),'region','EU','')","setProp(userPath('maya.chen'),'active',false,'boolean')",
      "setMember(userPath('ken.ito'),'roles','operations-reader',true)","addUser('new.person','New Person','new.person@example.test','UK')","setUserOverride('maya.chen','orders',{read:true},'Cover')","removeUserOverride('sara.evans','customers')","deleteEntity(userPath('ken.ito'))"],
    connections:["setProp('connections.analytics-db','name','Analytics store','')","setProp('connections.analytics-db','active',false,'boolean')"],
    draft:["setProp('screens.orders','caption','Orders','')","setProp('applications.ops','description','Changed','')","rowAdd('dataClasses.products.parameters','parameter')","setProp('valueLists.segments','name','Segment','')","setProp('reports.order-export','name','Orders','')","moveNav('ops','daily','',1)"]
  },holder={access:'Alex Morgan',connections:'Chris Doyle',draft:'Jordan Lee'},need={access:'security-administrator',connections:'database-owner',draft:'configurator'};
  for(const [capability,calls] of Object.entries(changes))for(const call of calls)for(const actor of ['Jordan Lee','Alex Morgan','Chris Doyle']){
    const s=as(actor),before=s.run('canonical(configuration())');
    assert.equal(s.run(call),actor===holder[capability],`${actor}: ${call}`);
    if(actor===holder[capability]){assert.deepEqual([...s.run('[state.dirty,audit[0].outcome,audit[0].actor]')],[1,'Succeeded',actor],call);continue;}
    assert.equal(s.run('canonical(configuration())'),before,`${actor}: ${call}`);
    assert.deepEqual([...s.run('[audit[0].action,audit[0].outcome,audit[0].reason,state.dirty]')],['Refused Studio action','Denied','Requires '+need[capability],0],`${actor}: ${call}`);
  }
  for(const actor of ['Priya Raman','Dana Whitlock','Sam Okafor','Elena Ruiz'])for(const call of [changes.access[4],changes.connections[0],changes.draft[0]])assert.equal(as(actor).run(call),false,`${actor}: ${call}`);
  const s=security();assert.equal(s.run(changes.access[4]),true);
  assert.equal(as('Jordan Lee',s).run('undo()'),false,'a configurator cannot undo a change to an application user');assert.match(s.messages.at(-1)[0],/Undoing that change needs the security-administrator role/);
  assert.equal(as('Alex Morgan',s).run('undo()'),true);assert.equal(as('Jordan Lee',s).run('redo()'),false);
  for(const call of ['completeValidation()','performPublish()',"schedulePublication(new Date(Date.now()+3600000).toISOString())","performRollback('ver-2026-08-4','x')","performRetire('ver-2026-08-4','x')","performClone('ver-2026-08-4')","acceptWarning('USER_CANNOT_START',true)"])assert.equal(security().run(call),false,'a security administrator does not '+call);
  const submit=(actor,mutation)=>{const x=as(actor);try{x.run(`const incoming=configuration();${mutation};importConfiguration(incoming)`);return 'accepted';}catch(error){return error.message;}};
  assert.match(submit('Jordan Lee',"incoming.users[0].roles=[]"),/cannot change application roles or application users unless a security administrator submits it/);
  assert.match(submit('Jordan Lee',"incoming.roles[0].permissions.orders.delete=true"),/unless a security administrator submits it/);
  assert.match(submit('Alex Morgan',"incoming.screens[0].caption='X'"),/unless a configurator submits it/);
  assert.match(submit('Jordan Lee',"incoming.connections[0].name='X'"),/cannot change connections unless a database owner submits it/);
  assert.match(submit('Jordan Lee',"incoming.applications[0].id='risk';incoming.navigation={risk:[]}"),/holds the configuration of application "risk"\. The draft of Operations Hub accepts only its own configuration/);
  assert.deepEqual([submit('Alex Morgan',"incoming.users[0].region='UK'"),submit('Jordan Lee',"incoming.screens[0].caption='X'"),submit('Chris Doyle',"incoming.connections[0].name='X'")],['accepted','accepted','accepted']);
  const page=as('Jordan Lee'),controls=html=>[...html.matchAll(/<(?:input|select|textarea|button)\b[^>]*data-mutates[^>]*>/g)].map(m=>m[0]);
  let access='';
  for(const tab of ['permissions','access','fields','rows','users']){page.run(`state.securityTab='${tab}';renderApplicationRoles()`);access+=page.run('host.innerHTML');}
  access+=page.run("state.selectedUser='sara.evans';renderApplicationUsers(),host.innerHTML")+page.run("state.module='approles',pageActions()")+page.run("state.module='appusers',pageActions()");
  assert.ok(controls(access).length>40);for(const control of controls(access))assert.ok(/ data-needs="access"/.test(control),control.slice(0,160));
  for(const control of controls(page.run('renderConnections(),host.innerHTML')))assert.ok(/ data-needs="connections"/.test(control),control.slice(0,160));
  for(const control of controls(page.run('renderApplication(),host.innerHTML')+page.run('renderValues(),host.innerHTML')+page.run('renderReports(),host.innerHTML')))assert.ok(!/ data-needs=/.test(control),control.slice(0,160));
  present(page.run("accessNotice('appusers')"),/<strong>Read-only\.<\/strong> Only a security administrator \(Alex Morgan\) can change application roles and application users\. You are signed in as Jordan Lee \(configurator\)\./);
  present(page.run("accessNotice('approles')"),/Only a security administrator \(Alex Morgan\)/);present(page.run("accessNotice('connections')"),/Only a database owner \(Chris Doyle\)/);
  assert.deepEqual([page.run("accessNotice('screens')"),security().run("accessNotice('appusers')"),security().run("accessNotice('approles')")],['','','']);
  present(security().run("accessNotice('screens')"),/Only a configurator \(Jordan Lee\) can change this part of the draft\./);
  present(security().run("accessNotice('versions')"),/Only a configurator \(Jordan Lee\) can validate, publish, schedule, roll back or retire\..* You can record the Security approval below\./);
});

test('Application users: the can-start rule and each refusal reason follow the published version of that application', () => {
  const s=security(),start=(subject,app='ops')=>s.run(`JSON.stringify(canStart(${JSON.stringify(subject)},${JSON.stringify(app)}))`),yes='{"ok":true,"reason":""}',no=reason=>JSON.stringify({ok:false,reason});
  assert.deepEqual(['alex.smith','maya.chen','jay.patel','sara.evans','daniel.weber','ken.ito','priya.raman'].map(x=>start(x)),[yes,yes,yes,yes,no('Inactive'),no('No role'),no('Not a user of this application')]);
  assert.deepEqual(['alex.smith','jay.patel','maya.chen','ken.ito'].map(x=>start(x,'risk')),[yes,yes,no('Not a user of this application'),no('Not a user of this application')],'an entry in one application admits nobody to another');
  assert.deepEqual([start('alex.morgan'),start('jordan.lee'),s.run("Boolean(administratorBySubject('alex.smith'))")],[no('Not a user of this application'),no('Not a user of this application'),false],'a Studio user is not an application user, and the reverse');
  assert.equal(s.run("(()=>{const c=structuredClone(liveConfig());c.roles.find(r=>r.id==='operations-reader').active=false;return userStart(findUser('jay.patel',c),c).reason})()"),'No role','an inactive application role grants nothing');
  assert.equal(s.run("(()=>{const c=structuredClone(liveConfig());findUser('jay.patel',c).roles=['risk-reader'];return userStart(findUser('jay.patel',c),c).reason})()"),'No role','a role of another application does not count');
  s.run("setProp(userPath('daniel.weber'),'active',true,'boolean');setProp(userPath('alex.smith'),'active',false,'boolean');setMember(userPath('ken.ito'),'roles','operations-editor',true)");
  assert.deepEqual(['daniel.weber','alex.smith','ken.ito'].map(x=>start(x)),[no('Inactive'),yes,no('No role')],'a draft changes nothing that GD Workspace applies');
  assert.deepEqual([...s.run("['daniel.weber','alex.smith','ken.ito'].map(x=>userStart(findUser(x)).reason||'ok')")],['ok','Inactive','ok'],'the selected version shows what publishing would do');
  s.run('renderApplicationUsers()');const html=s.run('host.innerHTML');
  for(const text of ['<th scope="col">Can start in this version</th><th scope="col">Can start today \\(published\\)</th><th scope="col">Last sign-in</th>','<span class="status bad">No</span> Inactive','<span class="status bad">No</span> No role','<span class="status good">Yes</span>','aria-label="Search application users by name or subject"','Showing Draft 2026\\.09\\.2 · GD Workspace applies Published 2026\\.09\\.1','<caption class="sr-only">Application users of Operations Hub</caption>'])present(html,new RegExp(text));
  absent(html,/Risk manager|Risk reader|policy revision/,'only this application\'s roles; no live policy revision');
  s.run("selectVersion('ver-2026-09-1');state.selectedUser='sara.evans';renderApplicationUsers()");
  assert.deepEqual([...s.run("[findUser('sara.evans').overrides.length,userAccess(findUser('sara.evans'),model.screens[1]).source,userStart(findUser('daniel.weber')).reason]")],[0,'application roles','Inactive'],'the page follows the selected version');
  present(s.run('host.innerHTML'),/Showing Published 2026\.09\.1/);
  assert.equal(s.run("setProp(userPath('sara.evans'),'region','EU','')"),false,'a published version is read-only, its application users included');
  s.run("selectVersion('draft');state.actor='Jordan Lee';performRetire('ver-2026-09-1','Application retired')");
  assert.deepEqual([start('alex.smith'),start('alex.smith','risk')],[no('Not a user of this application'),yes],'nobody can start an application with no published version; the other application is unaffected');
  s.run('renderApplicationUsers()');present(s.run('host.innerHTML'),/GD Workspace applies no version, so nobody can start/);
});

test('Application users: effective access combines the application roles held, with the override applied last, in the selected version', () => {
  const s=security(),access=(subject,screen)=>JSON.parse(s.run(`JSON.stringify(userAccess(findUser('${subject}'),model.screens.find(x=>x.id==='${screen}')))`));
  assert.deepEqual(access('jay.patel','orders'),{permissions:['read','export','print'],source:'application roles',hiddenFields:[],roles:['operations-reader']});
  assert.deepEqual(access('jay.patel','customers').hiddenFields,['creditLimit']);
  assert.equal(s.run("setMember(userPath('jay.patel'),'roles','operations-editor',true)"),true);
  assert.deepEqual(access('jay.patel','orders'),{permissions:['read','insert','update','delete','export','print'],source:'application roles',hiddenFields:[],roles:['operations-reader','operations-editor']});
  assert.deepEqual(access('jay.patel','customers').hiddenFields,[],'a field is withheld only when every granting application role withholds it');
  assert.deepEqual(access('sara.evans','customers'),{permissions:['read'],source:'application user override',hiddenFields:[],roles:['operations-editor']});
  assert.deepEqual(access('sara.evans','orders').permissions,['read','insert','update','delete','export','print']);
  assert.deepEqual(access('ken.ito','orders'),{permissions:[],source:'no role',hiddenFields:[],roles:[]});
  assert.equal(s.run("setUserOverride('sara.evans','orders',{},'Suspended from orders pending review')"),true);assert.deepEqual(access('sara.evans','orders').permissions,[],'an empty override denies the screen');
  s.run("userEffectiveAccess('sara.evans')");const dialog=s.dialogs.at(-1);
  assert.equal(dialog.title,'Effective access: Sara Evans in Operations Hub');
  for(const text of ['Combined from application roles','Application user override','Read-only access during secondment','Can start\\.','receives in Operations Hub under Draft 2026\\.09\\.2','A draft takes effect only when it is published','orders\\.region equals session\\.region \\(Operations editor\\)'])present(dialog.body,new RegExp(text));
  absent(dialog.body,/Risk register|Limit check|risk-manager/,'only screens and roles of the selected application');
  s.run("state.previewRole='user:sara.evans'");
  assert.equal([...s.run("screenCanvas(model.screens.find(x=>x.id==='customers'),false)").matchAll(/preview-tool">([^<]+)</g)].map(m=>m[1]).join(),'Previous record,Next record,Refresh,Detach');
  s.run("setProp(userPath('sara.evans'),'active',false,'boolean')");assert.deepEqual(access('sara.evans','customers'),{permissions:[],source:'inactive',hiddenFields:[],roles:[]},'an override cannot bypass an inactive entry');
  present(s.run("screenCanvas(model.screens.find(x=>x.id==='customers'),false)"),/Sara Evans is granted nothing on this screen \(inactive\)/);
  s.run("state.previewRole='operations-reader'");
  assert.equal(s.run("JSON.stringify(previewSubject(model.screens[0]))"),s.run("JSON.stringify({name:'Operations reader',...subjectAccess([model.roles[0]],[],model.screens[0])})"),'the application role preview uses the same rule');
  s.run("switchApplication('risk')");
  assert.equal(s.run('state.previewRole'),'','a preview subject of one application is not carried into another');
  assert.deepEqual([access('jay.patel','risks').permissions,access('jay.patel','limitCheck').permissions,access('alex.smith','risks').roles],[['read','export','print'],[],['risk-manager']],'the same person has a separate entry and a separate result in the other application');
  s.run("userEffectiveAccess('alex.smith')");
  assert.equal(s.dialogs.at(-1).title,'Effective access: Alex Smith in Risk & Controls');absent(s.dialogs.at(-1).body,/Order register|operations-editor|Operations editor/);
  s.run("state.selectedRole='risk-manager';effectiveAccess()");
  present(s.dialogs.at(-1).body,/What an application user of Risk &amp; Controls who holds only this application role receives\./);absent(s.dialogs.at(-1).body,/Order register/);
});

test('Application roles and application users: the pages are linked to each other, follow the selected application and keep its audit apart', () => {
  const s=security();
  assert.equal(s.run("openPath('users.sara%2Eevans')"),true);assert.deepEqual([...s.run('[state.module,state.selectedUser]')],['appusers','sara.evans']);
  present(admin,/\['user','selectedUser'\]/);present(admin,/parts\.push\(`user=\$\{state\.selectedUser\}`\)/);
  s.run("state.selectedRole='operations-editor';state.securityTab='users';renderApplicationRoles()");
  present(s.run('host.innerHTML'),/data-action="open" data-path="users\.sara%2Eevans">Sara Evans<\/button>/);present(s.run('host.innerHTML'),/3 application users in this version · in the published version/);
  s.run("model.roles.push({id:'auditor',name:'Auditor',active:true,permissions:{},fieldPolicies:[],rowScopes:[]});state.selectedRole='auditor';renderApplicationRoles()");
  present(s.run('host.innerHTML'),/0 application users in this version · not yet published/);
  s.run("model.roles.pop();state.selectedUser='alex.smith';renderApplicationUsers()");const html=s.run('host.innerHTML');
  for(const text of ['Identity-provider subject','Application roles of Operations Hub held','Application user overrides','Last sign-out','Remove application user','◉ Effective access','Operations Hub opens first for this person','holds no credential','Alex Smith also has a separate entry in Risk &amp; Controls\\.','Sign-in activity \\(operational data, read-only\\)','It is not part of the configuration, its digest or any version\\.'])present(html,new RegExp(text));
  s.run("setProp(userPath('alex.smith'),'region','UK','');renderAudit()");
  present(s.run('host.innerHTML'),/data-action="open" data-path="users\.alex%2Esmith">users\.alex\.smith<\/button>/);present(s.run('host.innerHTML'),/Operations Hub only · append-only/);
  absent(s.run('host.innerHTML'),/Risk register review cycle|administrators\.adm/,'no record of another application or of Studio access');
  s.run("switchApplication('risk');renderAudit()");
  present(s.run('host.innerHTML'),/Risk register review cycle/);absent(s.run('host.innerHTML'),/users\.alex\.smith|screens\.orders/,'the audit history shows the selected application only');
  assert.deepEqual([...s.run("[findUser('alex.smith').region,findUser('alex.smith').roles.join(),findUser('alex.smith').default]")],['EU','risk-manager',false],'the entry of the same person in the other application is separate');
  s.run("state.selectedUser='jay.patel';renderApplicationUsers()");
  for(const text of ['Application users of Risk &amp; Controls','Risk &amp; Controls opens first for this person','Jay Patel also has a separate entry in Operations Hub\\.','Showing Draft 2026\\.08\\.3 · GD Workspace applies Published 2026\\.08\\.2'])present(s.run('host.innerHTML'),new RegExp(text));
  absent(s.run('host.innerHTML'),/Maya Chen|Operations editor/);
  s.run('renderOverview()');present(s.run('host.innerHTML'),/2 application roles · 2 application users, 2 of whom can start under Draft 2026\.08\.3/);present(s.run('host.innerHTML'),/Risk &amp; Controls only: its properties, navigation, screens, DataClasses, connections, value lists, reports, application roles and application users\./);
  s.run("state.actor='Jordan Lee';state.validated=true;state.validation={serialized:canonical(configuration()),digest:digest()};state.acceptedWarnings={COMMAND_NEVER_SHOWN:true};"+approveAll+"state.publicationNote='Risk export';publish()");
  assert.equal(s.dialogs.at(-1).title,'Publish Risk & Controls Draft 2026.08.3');present(s.dialogs.at(-1).body,/<strong>Scope\.<\/strong> Risk &amp; Controls only: .* application roles and application users\. .* No other application changes\./);
});

test('Menu: exactly the three groups and the entry names agreed; only the first follows the selected application', () => {
  const s=studio();
  assert.deepEqual(JSON.parse(s.run("JSON.stringify(modules.map(g=>[g.section,g.caption||'',g.items.map(i=>i[1])]))")),[
    ['Application configuration','',['Overview','Application','Navigation','Screen designer','DataClasses','Connections','Value lists','Reports & export','Application roles','Application users','Validation','Impact analysis','Versions & publish','Audit history']],
    ['Studio access','not part of any application',['Studio users','Studio roles']],
    ['Platform','',['All applications','System']]]);
  const side=()=>{s.run('renderSide()');return s.run("document.getElementById('sideNav').innerHTML");},headings=html=>[...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map(m=>m[1].replace(/<[^>]+>/g,'|'));
  assert.deepEqual(headings(side()),['Application configuration|Operations Hub|','Studio access|not part of any application|','Platform']);
  assert.deepEqual([...side().matchAll(/<span>([^<]+)<\/span>/g)].map(m=>m[1]),['Overview','Application','Navigation','Screen designer','DataClasses','Connections','Value lists','Reports &amp; export','Application roles','Application users','Validation','Impact analysis','Versions &amp; publish','Audit history','Studio users','Studio roles','All applications','System']);
  s.run("switchApplication('risk')");assert.equal(headings(side())[0],'Application configuration|Risk &amp; Controls|');
  assert.deepEqual([...s.run("modules.flatMap(g=>g.items.map(i=>i[0])).filter(id=>!applicationScoped(id))")],['studiousers','studioroles','allapplications','system']);
  present(admin,/el\.disabled=!scoped;el\.title=scoped\?'':elsewhere;/);present(admin,/for\(const id of \['jsonButton','previewButton'\]\)document\.getElementById\(id\)\.disabled=!scoped;/);
  present(admin,/set\('changeChip',!scoped\?'Not part of any application':/);
  // Each access page opens with one sentence: what it defines, whom it affects and when a change takes effect.
  const opening=renderer=>{s.run(`${renderer}()`);return /^<p class="lead">([\s\S]*?)<\/p>/.exec(s.run('host.innerHTML'))?.[1].replace(/<[^>]+>/g,'')||'';};
  assert.equal(opening('renderApplicationRoles'),"Application roles define what their holders may do on the screens of Risk &amp; Controls, affect only the application users of Risk &amp; Controls who hold them, and change for those people only when this application's draft is validated, approved and published.");
  assert.equal(opening('renderApplicationUsers'),"Application users are the people who may start Risk &amp; Controls in GD Workspace, each with the application roles they hold; they affect Risk &amp; Controls only, and a change takes effect when this application's draft is validated, approved and published.");
  assert.equal(opening('renderStudioUsers'),'Studio users are the people who run GD Studio, each with the fixed Studio roles they hold; they affect GD Studio only and no application, and a change takes effect at once: a grant when a second platform administrator approves it, a revocation immediately.');
  assert.equal(opening('renderStudioRoles'),'Studio roles are the fixed set that decides what a Studio user may do in GD Studio; they affect Studio users only and grant nothing in any application, and because the platform defines them nothing here is edited or published, while who holds one changes at once under Studio users.');
  for(const renderer of ['renderApplicationRoles','renderApplicationUsers','renderStudioUsers','renderStudioRoles'])assert.equal((opening(renderer).match(/\. /g)||[]).length,0,renderer+' opens with one sentence');
  const before=s.run("(renderStudioUsers(),host.innerHTML)+(renderStudioRoles(),host.innerHTML)+(renderSystem(),host.innerHTML)");
  s.run("switchApplication('ops')");
  assert.equal(s.run("(renderStudioUsers(),host.innerHTML)+(renderStudioRoles(),host.innerHTML)+(renderSystem(),host.innerHTML)"),before,'Studio access and System pages do not depend on the selected application');
  absent(before,/data-mutates/,'nothing on them is a draft control');
  absent(admin,/>(Security|Users|Administrators|Roles|Applications)<|'(Users|Administrators|Roles|Applications|Security sections|Add role|Register user)'/,'no bare role, user, security or administrator page name');
  assert.deepEqual([...s.run("modules.flatMap(g=>g.items.map(i=>i[1])).filter(name=>/^(roles?|users?|security|administrators?)$/i.test(name))")],[]);
});

test('Platform: applications are created and deleted as wholes, each with its own version line', () => {
  const s=studio(),facts=()=>JSON.parse(s.run(lineFacts)),before=facts();
  assert.equal(as('Alex Morgan',s).run("createApplication('finance','Finance Hub','FIN')"),false);assert.match(s.messages.at(-1)[0],/Creating an application needs the configurator role/);
  as('Jordan Lee',s);
  for(const bad of [['ops','Operations again','OPS'],['bad id','X','X'],['finance','','FIN'],['finance','Finance Hub','']])assert.equal(s.run(`createApplication(${JSON.stringify(bad[0])},${JSON.stringify(bad[1])},${JSON.stringify(bad[2])})`),false,bad.join('|'));
  assert.equal(s.run("createApplication('finance','Finance Hub','FIN')"),true);
  assert.deepEqual([...s.run('[Object.keys(lines).join(),state.appId,audit[0].action,audit[0].target,audit[0].application,audit[0].actor]')],['ops,risk,finance','ops','Created application','applications.finance','','Jordan Lee']);
  assert.deepEqual([facts().ops,facts().risk],[before.ops,before.risk],'creating an application touches no other');
  s.run('renderAllApplications()');
  for(const text of ['<strong>Finance Hub</strong>','<strong>Operations Hub</strong> <span class="status info">selected</span>','None: nobody can start it','2026\\.08\\.2','Draft 2026\\.09\\.2','aria-label="Delete Risk &amp; Controls"','<h2>Platform audit</h2>','Created application'])present(s.run('host.innerHTML'),new RegExp(text));
  absent(s.run('host.innerHTML'),/data-mutates/);
  assert.equal(s.run("deleteApplication('ops','No longer needed')"),false);assert.match(s.messages.at(-1)[0],/Operations Hub has a Published version, so its application users can start it\. Retire that version first\./);
  assert.deepEqual([...s.run('[audit[0].action,audit[0].outcome,audit[0].application]')],['Refused application deletion','Denied','']);
  assert.equal(s.run("deleteApplication('finance',' ')"),false);assert.match(s.messages.at(-1)[0],/reason is required to delete an application/);
  assert.equal(as('Sam Okafor',s).run("deleteApplication('finance','x')"),false);as('Jordan Lee',s);
  s.run("switchApplication('finance')");assert.deepEqual([...s.run('[state.appId,model.applications[0].name,model.users.length,validationIssues().filter(i=>i.severity==="error").map(i=>i.code).join()]')],['finance','Finance Hub',0,'INVALID_REFERENCE']);
  assert.equal(s.run("deleteApplication('finance','Created in error')"),true);
  assert.deepEqual([...s.run('[Object.keys(lines).join(),state.appId,model.draft.label,audit[0].action,audit[0].reason,audit[0].application]')],['ops,risk','ops','Draft 2026.09.2','Deleted application','Created in error','']);
  assert.deepEqual(facts(),before,'deleting an application touches no other');
  s.run("switchApplication('risk')");assert.equal(s.run("performRetire('ver-2026-08-2','Application withdrawn')"),true);
  s.run("switchApplication('ops')");assert.equal(s.run("deleteApplication('risk','Application withdrawn')"),true);
  assert.deepEqual([...s.run("[Object.keys(lines).join(),canStart('alex.smith','risk').reason]")],['ops','Not a user of this application']);
  assert.equal(facts().ops[0],before.ops[0]);
  assert.equal(s.run("performRetire('ver-2026-09-1','Application withdrawn')"),true);assert.equal(s.run("deleteApplication('ops','x')"),false);assert.match(s.messages.at(-1)[0],/The last application cannot be deleted/);
});

/* ---- Studio access: Studio users, the fixed Studio roles, two-person grants; not part of any application ---- */
const heldBy = (s, name) => [...s.run(`adminRoles(administration.administrators.find(a=>a.name===${JSON.stringify(name)}))`)].join();
const denied = (s, pattern) => { assert.match(s.messages.at(-1)[0], pattern); assert.deepEqual([...s.run('[audit[0].action,audit[0].outcome,audit[0].application]')], ['Refused Studio access change', 'Denied', '']); };

test('Studio users: the fixed Studio roles, the sample people and the bootstrap administrators are as decided', () => {
  const s=studio(),people=fixtures.administration.administrators;
  assert.deepEqual([...s.run('Object.keys(ADMIN_ROLES)')],['platform-administrator','configurator','approver-product','approver-security','approver-test','security-administrator','support-operator','database-owner','integration-owner']);
  assert.deepEqual(fixtures.deployment.bootstrapAdministrators,['sam.okafor','elena.ruiz']);
  for(const [name,roles] of [['Jordan Lee','configurator'],['Priya Raman','approver-product'],['Alex Morgan','approver-security,security-administrator'],['Dana Whitlock','approver-test'],['Sam Okafor','platform-administrator'],['Elena Ruiz','platform-administrator,support-operator'],['Chris Doyle','database-owner'],['Nadia Hassan','approver-security']])assert.equal(heldBy(s,name),roles,name);
  assert.deepEqual(people.map(a=>`${a.id}:${a.subject}:${a.name}:${a.email}`),['adm-01:jordan.lee:Jordan Lee:jordan.lee@example.test','adm-02:priya.raman:Priya Raman:priya.raman@example.test','adm-03:alex.morgan:Alex Morgan:alex.morgan@example.test','adm-04:dana.whitlock:Dana Whitlock:dana.whitlock@example.test',
    'adm-05:sam.okafor:Sam Okafor:sam.okafor@example.test','adm-06:elena.ruiz:Elena Ruiz:elena.ruiz@example.test','adm-07:chris.doyle:Chris Doyle:chris.doyle@example.test','adm-08:nadia.hassan:Nadia Hassan:nadia.hassan@example.test']);
  assert.deepEqual(people.at(-1).grants.map(g=>[g.role,g.state,g.proposedBy,g.approvedBy]),[['approver-security','granted','sam.okafor','elena.ruiz']],'granted through the ordinary two-person history');
  assert.ok(people.every(a=>/^\d{4}-\d\d-\d\dT/.test(fixtures.administration.signIns[a.subject])),'every sample Studio user has a last sign-in');
  // The sample never dead-ends: whoever may change a draft, each review still has a checker who cannot have contributed to it.
  const editors=people.filter(a=>s.run(`['draft','connections','access'].some(c=>can(c,findAdministrator(${JSON.stringify(a.id)})))`)).map(a=>a.name);
  assert.deepEqual(editors,['Jordan Lee','Alex Morgan','Chris Doyle']);
  for(const role of ['Product','Security','Test'])assert.ok([...s.run(`capabilityHolders('approve-${role}')`)].some(name=>!editors.includes(name)),`${role} has an approver who cannot edit a draft`);
  assert.deepEqual([...s.run("capabilityHolders('approve-Security')")],['Alex Morgan','Nadia Hassan']);
  assert.equal(s.run("approverNote('Security')"),'Can be recorded by Alex Morgan or Nadia Hassan.');
  assert.deepEqual([...s.run("pendingGrants().map(p=>[p.admin.name,p.grant.role,administratorName(p.grant.proposedBy),eligibleApprovers(p.admin,p.grant).map(x=>x.name).join()].join(':'))")],['Chris Doyle:integration-owner:Sam Okafor:Elena Ruiz']);
  assert.ok(people.filter(a=>fixtures.deployment.bootstrapAdministrators.includes(a.subject)).every(a=>!a.grants.some(g=>g.role==='platform-administrator')),'a bootstrap role is not a stored grant');
  for(const a of people)for(const g of a.grants.filter(x=>x.approvedBy))assert.ok(g.proposedBy!==g.approvedBy&&g.proposedBy!==a.subject&&g.approvedBy!==a.subject,`${a.name} ${g.role} was granted by two other people`);
  present(admin,/actor:'Jordan Lee'/);absent(admin,/reviewers/);assert.ok(!('reviewers' in fixtures)&&!('administrators' in initial));
  for(const id of seedApps){s.run(`switchApplication(${JSON.stringify(id)})`);absent(s.run('canonical(configuration())'),/sam\.okafor|jordan\.lee|grant-0|platform-administrator/,'Studio users are outside every application and its digest');}
  assert.ok(seed.users.every(u=>!people.some(a=>a.subject===u.subject)),'no sample person is both a Studio user and an application user');
});

test('Studio users: a record holds no credential-like property', () => {
  const keys=new Set();(function walk(v){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){keys.add(k);walk(x);}})(fixtures.administration.administrators);
  assert.deepEqual([...keys].filter(k=>/pass|pwd|secret|credential|token|hash|salt|pin$/i.test(k)),[]);
  assert.ok(fixtures.administration.administrators.every(a=>JSON.stringify(Object.keys(a))===JSON.stringify(['id','subject','name','email','grants'])));
  const s=as('Sam Okafor');
  assert.equal(s.run("registerAdministrator('lena.hoff','Lena Hoff','lena.hoff@example.test')"),true);
  assert.equal(s.run('JSON.stringify(administration.administrators.at(-1))'),'{"id":"adm-09","subject":"lena.hoff","name":"Lena Hoff","email":"lena.hoff@example.test","grants":[]}');
  assert.equal(heldBy(s,'Lena Hoff'),'','a new Studio user holds nothing');
  for(const [subject,name,email,why] of [['jordan.lee','J','j@example.test',/already a Studio user/],['Bad Subject','B','b@example.test',/subject identifier/],['ok.one','','o@example.test',/display name is required/],['ok.two','Jordan Lee','o@example.test',/already has that display name/],['ok.three','Three','nope',/valid email/]]){
    assert.equal(s.run(`registerAdministrator(${JSON.stringify(subject)},${JSON.stringify(name)},${JSON.stringify(email)})`),false);denied(s,why);
  }
  s.run('renderStudioUsers()');absent(s.run('host.innerHTML'),/password|passphrase/i);
});

test('Studio users: a proposed grant gives nothing until a different platform administrator, not the recipient, approves it', () => {
  const s=as('Sam Okafor'),revision=s.run('administration.policyRevision');
  assert.equal(s.run("proposeGrant('adm-01','support-operator','')"),false);denied(s,/reason is required to propose/);
  assert.equal(s.run("proposeGrant('adm-01','configurator','x')"),false);denied(s,/already holds configurator/);
  assert.equal(s.run("proposeGrant('adm-01','root','x')"),false);denied(s,/not one of the fixed Studio roles/);
  assert.equal(s.run("proposeGrant('adm-01','support-operator','Needs read access to diagnostics')"),true);
  assert.equal(s.run("proposeGrant('adm-01','support-operator','again')"),false);denied(s,/already pending/);
  const grant=s.run("findAdministrator('adm-01').grants.at(-1).id");
  assert.deepEqual([heldBy(s,'Jordan Lee'),s.run('administration.policyRevision'),s.run("findAdministrator('adm-01').grants.at(-1).state")],['configurator',revision,'pending'],'pending gives nothing and is not an effective change');
  assert.equal(s.run(`decideGrant('adm-01','${grant}',true,'Looks right')`),false);denied(s,/person who proposed a grant cannot decide it/);
  s.run("proposeGrant('adm-06','database-owner','Cover for the database owner')");const own=s.run("findAdministrator('adm-06').grants.at(-1).id");
  as('Elena Ruiz',s);assert.equal(s.run(`decideGrant('adm-06','${own}',true,'Fine')`),false);denied(s,/Nobody can change their own Studio roles/);
  assert.equal(s.run(`withdrawGrant('adm-06','${own}')`),false);denied(s,/Only the person who proposed a grant can withdraw it/);
  for(const name of ['Jordan Lee','Alex Morgan','Chris Doyle']){as(name,s);assert.equal(s.run("proposeGrant('adm-02','support-operator','x')"),false,name);denied(s,/Only a platform administrator can change Studio roles/);assert.equal(s.run(`decideGrant('adm-01','${grant}',true,'x')`),false,name);denied(s,/Only a platform administrator|Nobody can change their own/);}
  as('Elena Ruiz',s);assert.equal(s.run(`decideGrant('adm-01','${grant}',true,'')`),false);denied(s,/reason is required to approve/);
  assert.equal(s.run(`decideGrant('adm-01','${grant}',true,'Agreed with the support lead')`),true);
  assert.deepEqual([heldBy(s,'Jordan Lee'),s.run('administration.policyRevision')],['configurator,support-operator',revision+1],'effective at once and the policy revision rises');
  assert.deepEqual([...s.run('[audit[0].action,audit[0].target,audit[0].actor,audit[0].outcome,audit[0].reason,audit[0].version]')],['Approved Studio role','administrators.adm-01','Elena Ruiz','Succeeded','Agreed with the support lead','policy revision '+(revision+1)]);
  assert.deepEqual([...s.run("(g=>[g.state,g.proposedBy,g.approvedBy,g.reason,g.approvalReason])(findAdministrator('adm-01').grants.at(-1))")],['granted','sam.okafor','elena.ruiz','Needs read access to diagnostics','Agreed with the support lead']);
  assert.equal(s.run(`decideGrant('adm-01','${grant}',true,'twice')`),false);denied(s,/not pending/);
  assert.equal(s.run("decideGrant('adm-07','grant-09',false,'Extension scope is not approved yet')"),true);
  assert.deepEqual([heldBy(s,'Chris Doyle'),s.run("findAdministrator('adm-07').grants.at(-1).state"),s.run('administration.policyRevision'),s.run('audit[0].action')],['database-owner','rejected',revision+1,'Rejected Studio role']);
  as('Sam Okafor',s);assert.equal(s.run(`withdrawGrant('adm-06','${own}')`),true);assert.deepEqual([s.run("findAdministrator('adm-06').grants.at(-1).state"),heldBy(s,'Elena Ruiz')],['withdrawn','platform-administrator,support-operator']);
});

test('Studio users: nobody changes their own Studio roles; revocation is immediate with a reason; bootstrap and the floor of two hold', () => {
  const s=as('Sam Okafor'),revision=s.run('administration.policyRevision');
  for(const own of ["proposeGrant('adm-05','configurator','For myself')","revokeGrant('adm-05','platform-administrator','Stepping down')","removeAdministrator('adm-05','Leaving')"]){assert.equal(s.run(own),false,own);denied(s,/Nobody can change their own Studio roles\. Another platform administrator must do it\./);}
  assert.equal(s.run("revokeGrant('adm-07','database-owner','  ')"),false);denied(s,/reason is required to revoke/);
  assert.equal(s.run("revokeGrant('adm-07','configurator','x')"),false);denied(s,/does not hold configurator/);
  assert.equal(s.run("can('connections',findAdministrator('adm-07'))"),true);
  assert.equal(s.run("revokeGrant('adm-07','database-owner','Moved to another team')"),true);
  assert.deepEqual([heldBy(s,'Chris Doyle'),s.run("can('connections',findAdministrator('adm-07'))"),s.run('administration.policyRevision')],['',false,revision+1],'immediate, with no second person');
  assert.deepEqual([...s.run('[audit[0].action,audit[0].reason,audit[0].actor,audit[0].outcome]')],['Revoked Studio role','Moved to another team','Sam Okafor','Succeeded']);
  assert.equal(s.run("revokeGrant('adm-06','platform-administrator','Trying')"),false);denied(s,/holds platform-administrator from deployment configuration\. It is read-only here/);
  assert.equal(heldBy(s,'Elena Ruiz'),'platform-administrator,support-operator');
  s.run(`fixtures.deployment.bootstrapAdministrators=['sam.okafor'];for(const id of ['adm-06','adm-07'])findAdministrator(id).grants.push({id:'grant-9'+id.slice(-1),role:'platform-administrator',state:'granted',proposedBy:'sam.okafor',proposedAt:'2026-09-01T00:00:00Z',reason:'Cover',approvedBy:'dana.whitlock',approvedAt:'2026-09-01T01:00:00Z',approvalReason:'Cover'})`);
  assert.equal(s.run('platformAdministrators().length'),3);
  assert.equal(s.run("revokeGrant('adm-07','platform-administrator','Reducing cover')"),true);assert.equal(s.run('platformAdministrators().length'),2);
  assert.equal(s.run("revokeGrant('adm-06','platform-administrator','One too many')"),false);denied(s,/At least two platform administrators are required, because every grant needs a second one to approve it\./);
  assert.equal(s.run('platformAdministrators().length'),2);
  assert.equal(s.run("removeAdministrator('adm-01','x')"),false);denied(s,/still holds a Studio role/);
  assert.equal(s.run("removeAdministrator('adm-07','x')"),false);denied(s,/grant is still pending/);
  assert.equal(s.run("withdrawGrant('adm-07','grant-09')&&!removeAdministrator('adm-07','')"),true);denied(s,/reason is required to remove/);
  assert.equal(s.run("removeAdministrator('adm-07','Left the organization')"),true);assert.equal(s.run("Boolean(findAdministrator('adm-07'))"),false);
});

test('Studio users: grants take effect at once and never touch any application draft, its digest, validation, approvals or Undo', () => {
  const s=studio();validCandidate(s);s.run("state.actor='Priya Raman';recordApproval('Product','Reviewed')");
  const before=s.run(draftFacts),lines=s.run(lineFacts),revision=s.run('administration.policyRevision');
  as('Sam Okafor',s);s.run("proposeGrant('adm-04','support-operator','Covers the support rota');registerAdministrator('lena.hoff','Lena Hoff','lena.hoff@example.test')");
  as('Elena Ruiz',s);s.run("decideGrant('adm-04',findAdministrator('adm-04').grants.at(-1).id,true,'Agreed');revokeGrant('adm-04','support-operator','Rota changed')");
  assert.equal(s.run(draftFacts),before);assert.equal(s.run(lineFacts),lines,'no application line is touched');assert.equal(s.run('administration.policyRevision'),revision+2,'approval and revocation are the effective changes');
  assert.ok(s.run("audit.slice(0,4).every(a=>a.application===''&&/^policy revision \\d+$/.test(a.version))"),'Studio access records belong to no application');
  assert.equal(s.run('undo()'),false);
  as('Jordan Lee',s);s.run("setProp('screens.orders','caption','Orders','')");as('Sam Okafor',s);s.run("proposeGrant('adm-02','support-operator','Second line')");as('Jordan Lee',s);s.run('undo()');
  assert.deepEqual([...s.run("[model.screens[0].caption,findAdministrator('adm-02').grants.at(-1).state,findAdministrator('adm-04').grants.at(-1).state]")],['Order register','pending','revoked']);
  assert.equal(s.run('fixtures.administration.administrators[3].grants.length'),1,'the embedded sample is not written to');
  s.run("selectVersion('ver-2026-08-4')");as('Sam Okafor',s);assert.equal(s.run("proposeGrant('adm-03','support-operator','Viewing an old version does not lock administration')"),true);
});

test('Studio capabilities follow the Studio roles by one shared rule, and the Studio roles page shows that same rule', () => {
  const s=studio(),caps=name=>s.run(`Object.keys(STUDIO_CAPABILITIES).filter(c=>can(c,administration.administrators.find(a=>a.name===${JSON.stringify(name)}))).join()`);
  for(const [name,expected] of [['Jordan Lee','draft,release,applications,read'],['Priya Raman','approve-Product,read'],['Alex Morgan','access,approve-Security,read'],['Dana Whitlock','approve-Test,read'],['Sam Okafor','administrators,read'],['Elena Ruiz','administrators,read'],['Chris Doyle','connections,read'],['Nadia Hassan','approve-Security,read']])assert.equal(caps(name),expected,name);
  s.run('renderStudioRoles()');const matrix=s.run('host.innerHTML');
  assert.deepEqual([...matrix.matchAll(/<th scope="col"><code>([^<]+)<\/code><\/th>/g)].map(m=>m[1]),[...s.run('Object.keys(ADMIN_ROLES)')]);
  assert.deepEqual([...s.run('CAPABILITY_TEXT.map(x=>x[0])')].sort(),[...s.run('Object.keys(STUDIO_CAPABILITIES)')].sort(),'every capability the code checks has a row');
  const rows=[...matrix.matchAll(/<tr><th scope="row">([^<]+)<\/th>([\s\S]*?)<\/tr>/g)].map(m=>[m[1],[...m[2].matchAll(/<span class="sr-only">(Allowed|Not allowed)<\/span>/g)].map(x=>x[1]==='Allowed')]);
  assert.deepEqual(rows,JSON.parse(s.run("JSON.stringify(CAPABILITY_TEXT.map(([c,text])=>[text,Object.keys(ADMIN_ROLES).map(r=>STUDIO_CAPABILITIES[c].includes(r))]))")),'the matrix is the rule the code applies');
  for(const text of ['Change application roles and application users in an application draft','Change connections in an application draft','Validate, accept warnings, publish, schedule, roll back, retire and clone versions of an application','Create or delete an application','Held by Alex Morgan','Read-only · 9 fixed Studio roles'])present(matrix,new RegExp(text));
  absent(matrix,/data-mutates|data-platform|data-requires|<input|<select|<textarea/,'the Studio roles page is read-only');
  validCandidate(s);as('Priya Raman',s);
  for(const change of ["setProp('screens.orders','caption','X','')","rowAdd('dataClasses.orders.parameters','parameter')","acceptWarning('USER_CANNOT_START',false)","completeValidation()","performClone('ver-2026-08-4')","performRollback('ver-2026-08-4','x')","performRetire('ver-2026-08-4','x')","schedulePublication(new Date(Date.now()+3600000).toISOString())","performPublish()"]){
    assert.equal(s.run(change),false,change);assert.match(s.messages.at(-1)[0],/needs the configurator role\. Priya Raman does not hold it; Jordan Lee does\./);
    assert.deepEqual([...s.run('[audit[0].action,audit[0].outcome,audit[0].actor]')],['Refused Studio action','Denied','Priya Raman']);
  }
  assert.throws(()=>s.run('importConfiguration(configuration())'),/Only a configurator can import a draft/);
  assert.deepEqual([...s.run("[model.screens[0].caption,releases[0].status,state.validated,model.roles.length]")],['Order register','Published',true,2],'nothing changed');
  assert.equal(s.run("recordApproval('Product','Reviewed')"),true);as('Dana Whitlock',s);assert.equal(s.run("recordApproval('Security','Reviewed')"),false);assert.match(s.messages.at(-1)[0],/Dana Whitlock does not hold the approver-security role/);
  as('Jordan Lee',s);assert.equal(s.run("setProp('connections.ops-db','name','Ops','')"),false);assert.match(s.messages.at(-1)[0],/Changing a connection needs the database-owner role\. Jordan Lee does not hold it; Chris Doyle does\./);
  assert.throws(()=>s.run("(()=>{const c=configuration();c.connections[0].name='Renamed';importConfiguration(c)})()"),/cannot change connections unless a database owner submits it/);
  as('Chris Doyle',s);assert.equal(s.run("setProp('connections.ops-db','name','Ops','')"),true);assert.equal(s.run("setProp('screens.orders','caption','X','')"),false);
  assert.equal(s.run('undo()'),true,'the database owner undoes a connection change');as('Jordan Lee',s);
  assert.equal(s.run("setProp(userPath('maya.chen'),'displayName','X','')"),false);assert.match(s.messages.at(-1)[0],/Changing application roles or application users needs the security-administrator role\. Jordan Lee does not hold it; Alex Morgan does\./);
  as('Alex Morgan',s);assert.equal(s.run("setProp(userPath('maya.chen'),'displayName','Maya L. Chen','')"),true);assert.equal(s.run("setProp('screens.orders','caption','X','')"),false);
  as('Sam Okafor',s);assert.equal(s.run("revokeGrant('adm-01','configurator','Rotated off the workspace')"),true);
  as('Jordan Lee',s);assert.equal(s.run("setProp('screens.orders','caption','X','')"),false,'a revoked role is gone on the next request');assert.match(s.messages.at(-1)[0],/Jordan Lee does not hold it\.$/);
  const t=as('Priya Raman');
  assert.match(t.run("accessNotice('screens')"),/<strong>Read-only\.<\/strong> Only a configurator \(Jordan Lee\) can change this part of the draft\. You are signed in as Priya Raman \(approver-product\)\.<\/div>/);
  assert.match(t.run("accessNotice('versions')"),/You can record the Product approval below\./);assert.match(t.run("accessNotice('connections')"),/Only a database owner \(Chris Doyle\) can change connections; a configurator uses them from DataClasses\./);
  assert.equal(t.run("accessNotice('studiousers')+accessNotice('studioroles')+accessNotice('system')+accessNotice('audit')+accessNotice('overview')+accessNotice('impact')"),'');
  assert.match(t.run("accessNotice('allapplications')"),/Only a configurator \(Jordan Lee\) can create or delete an application\./);
  as('Jordan Lee',t);assert.equal(t.run("accessNotice('screens')+accessNotice('versions')"),'');assert.match(t.run("accessNotice('connections')"),/signed in as Jordan Lee \(configurator\)/);
  t.run('renderConnections()');for(const m of t.run('host.innerHTML').matchAll(/<[a-z]+\b[^>]*data-mutates[^>]*>/g))assert.ok(/data-needs="connections"/.test(m[0]),m[0].slice(0,140));
  present(t.run('host.innerHTML'),/Connections are changed by a database owner\./);
  t.run('renderVersions()');present(t.run('host.innerHTML'),/data-action="approve" data-role="Security" data-mutates data-needs="approve-Security"/);
  present(admin,/if\(\(lock&&readOnly\(\)\)\|\|!can\(el\.dataset\.needs\|\|'draft'\)\)el\.disabled=true/);present(admin,/if\(!can\('administrators'\)\)root\.querySelectorAll\('\[data-platform\]'\)/);
  present(admin,/id="signedInRoles">Signed in: /);
});

test('Studio users: the page shows people, pending approvals and history, and states that it is not part of any application', () => {
  const s=as('Elena Ruiz');
  assert.equal(s.run("openPath('administrators.adm-07')"),true);assert.deepEqual([...s.run('[state.module,state.selectedAdmin]')],['studiousers','adm-07']);
  s.run('renderStudioUsers()');let html=s.run('host.innerHTML');
  for(const text of ['A Studio role grants nothing in any application, and a Studio user needs no application user entry\\.','<h2>Studio access audit</h2>','aria-label="Search Studio users by name or subject"','＋ Register Studio user','Remove Studio user','<h2>Pending approvals</h2>','Awaiting Elena Ruiz','<th scope="col">Studio roles held</th>','<th scope="col">Pending changes</th>','＋ Propose a Studio role','<th scope="col">Last sign-in</th>','platform-administrator <span class="muted">\\(from deployment configuration\\)</span>','<code>integration-owner</code> pending','Grant history','Revoked by Sam Okafor','Moved to database ownership','What each of the fixed Studio roles allows is shown under <button class="link" data-action="go" data-id="studioroles">Studio roles</button>','two people for every grant','data-action="adminDecide" data-admin-id="adm-07" data-grant="grant-09" data-approve="1" data-platform'])present(html,new RegExp(text));
  absent(html,/Read-only\./);absent(html,/Administrators? (are|is)\b|>Administrators<|administrative role|data-mutates/);
  for(const m of html.matchAll(/<button\b[^>]*data-action="admin(?:Register|Propose|Decide|Withdraw|Revoke|Remove)"[^>]*>/g))assert.ok(/ data-platform/.test(m[0]),m[0].slice(0,120));
  s.run("state.selectedAdmin='adm-06';renderStudioUsers()");html=s.run('host.innerHTML');
  present(html,/This is your own record\. Nobody can propose, approve, reject or revoke a change to their own Studio roles/);present(html,/From deployment configuration<\/td><td class="row-actions"><span class="muted">Read-only here<\/span>/);
  as('Jordan Lee',s);s.run('renderStudioUsers()');
  present(s.run('host.innerHTML'),/<strong>Read-only\.<\/strong> Only a platform administrator \(Sam Okafor, Elena Ruiz\) can change Studio roles\. You are signed in as Jordan Lee \(configurator\)\./);
  s.run('renderApplicationUsers()');present(s.run('host.innerHTML'),/Being an application user grants nothing in GD Studio, and a Studio user needs no entry here\./);
  present(admin,/\['studiousers','Studio users','◉'\],\['studioroles','Studio roles','▣'\]/);present(admin,/\['admin','selectedAdmin'\]/);present(admin,/parts\.push\(`admin=\$\{state\.selectedAdmin\}`\)/);
  as('Sam Okafor',s);s.run("revokeGrant('adm-07','database-owner','Moved');renderStudioUsers()");
  present(s.run('host.innerHTML'),/<tr data-filterable="studio-audit">[\s\S]*?Revoked Studio role[\s\S]*?data-action="open" data-path="administrators\.adm-07">administrators\.adm-07<\/button>/);
  for(const id of seedApps){s.run(`switchApplication(${JSON.stringify(id)});renderAudit()`);absent(s.run('host.innerHTML'),/administrators\.adm-07|Revoked Studio role/,'Studio access records are not in any application\'s audit history');}
  const hostile=`x" onfocus="alert(1)" y="`,tag='<img src=x onerror=alert(1)>';
  s.run(`Object.assign(administration.administrators[6],{name:${JSON.stringify(tag)},email:${JSON.stringify(hostile)},subject:${JSON.stringify(hostile)}});Object.assign(administration.administrators[6].grants[0],{role:${JSON.stringify(hostile)},reason:${JSON.stringify(tag)},closedReason:${JSON.stringify(tag)},proposedBy:${JSON.stringify(hostile)}});administration.administrators[6].grants.push({id:${JSON.stringify(hostile)},role:${JSON.stringify(tag)},state:'pending',proposedBy:${JSON.stringify(tag)},proposedAt:${JSON.stringify(hostile)},reason:${JSON.stringify(hostile)}});state.selectedAdmin='adm-07';renderStudioUsers();globalThis.pages=host.innerHTML;renderStudioRoles();globalThis.pages+=host.innerHTML;host.innerHTML=globalThis.pages`);
  absent(s.run('host.innerHTML'),/<img src=x/);absent(s.run('host.innerHTML'),/" onfocus="alert/);present(s.run('host.innerHTML'),/&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('Owner flow: the security administrator changes an application user, three independent checkers approve, the configurator publishes, and only that application changes', () => {
  const s=studio(),facts=()=>JSON.parse(s.run(lineFacts)),before=facts(),records=id=>s.run(`audit.filter(a=>a.application===${JSON.stringify(id)}).length`),riskRecords=records('risk');
  const start=(subject,app='ops')=>s.run(`canStart(${JSON.stringify(subject)},${JSON.stringify(app)}).reason||'ok'`),published=()=>s.run("(v=>v.label+':'+v.snapshot.users.find(u=>u.subject==='ken.ito').roles.join())(lines.ops.releases.find(v=>v.status==='Published'))");
  // 1. The security administrator changes an application user in the draft of Operations Hub.
  as('Alex Morgan',s);assert.equal(s.run("setMember(userPath('ken.ito'),'roles','operations-reader',true)"),true);
  assert.deepEqual([...s.run('[state.dirty,state.validated,model.draft.contributors.join(),audit[0].action,audit[0].actor,audit[0].application]')],[1,false,'Alex Morgan','Updated application user','Alex Morgan','ops']);
  assert.deepEqual([start('ken.ito'),published()],['No role','2026.09.1:'],'nothing is live yet');
  // 2. The configurator validates.
  assert.equal(s.run('completeValidation()'),false,'validation stays with the configurator');
  as('Jordan Lee',s);assert.equal(s.run('completeValidation()'),true);
  assert.deepEqual([...s.run("[draftStatus(),validationIssues().length,blockingWarnings().length]")],['Validating',0,0]);
  // 3. Product, Security and Test approve. The security administrator contributed, so the Security checker is Nadia Hassan.
  assert.equal(s.run("approverNote('Security')"),'Can be recorded by Nadia Hassan. Alex Morgan is the author or a contributor of this draft and cannot approve it.');
  s.run('renderVersions()');present(s.run('host.innerHTML'),/<strong>Security approval<\/strong><p class="muted">Can be recorded by Nadia Hassan\. Alex Morgan is the author or a contributor of this draft and cannot approve it\.<\/p>/);
  absent(s.run('host.innerHTML'),/Nobody can record it yet|Nobody holds/);
  assert.equal(as('Alex Morgan',s).run("recordApproval('Security','Reviewed my own change')"),false);assert.match(s.messages.at(-1)[0],/author or a contributor cannot approve this candidate/);
  assert.equal(as('Jordan Lee',s).run("recordApproval('Product','Reviewed')"),false,'the author cannot approve either');
  for(const [role,name] of [['Product','Priya Raman'],['Security','Nadia Hassan'],['Test','Dana Whitlock']])assert.equal(as(name,s).run(`recordApproval(${JSON.stringify(role)},'Reviewed the access change')`),true,name);
  assert.deepEqual([...s.run("[draftStatus(),REVIEW_ROLES.map(r=>state.approvals[r].actor).join(),state.approvals.Security.digest===digest()]")],['Approved','Priya Raman,Nadia Hassan,Dana Whitlock',true]);
  assert.deepEqual([start('ken.ito'),published()],['No role','2026.09.1:'],'approved is still not live');
  // 4. The configurator publishes; an approver cannot.
  assert.equal(s.run("state.publicationNote='Ken Ito joins the operations readers';performPublish()"),false,'an approver does not publish');
  assert.equal(as('Jordan Lee',s).run('performPublish()'),true);
  // 5. Only now does the published version of Operations Hub show the change.
  assert.deepEqual([start('ken.ito'),published()],['ok','2026.09.2:operations-reader']);
  assert.deepEqual([...s.run("[releases.map(v=>v.label+' '+v.status).join(),releases[1].snapshot.users.find(u=>u.subject==='ken.ito').roles.length,releases[0].approvals.Security.actor,model.draft.label,state.publicationRevision]")],
    ['2026.09.2 Published,2026.09.1 Superseded,2026.08.4 Superseded',0,'Nadia Hassan','Draft 2026.09.3',8]);
  assert.match(s.run("audit.find(a=>a.action==='Published version').detail"),/approved by Priya Raman, Nadia Hassan, Dana Whitlock/);
  s.run("selectVersion('draft');state.selectedUser='ken.ito';renderApplicationUsers()");
  present(s.run('host.innerHTML'),/GD Workspace applies Published 2026\.09\.2/);present(s.run('host.innerHTML'),/In GD Workspace today \(Published 2026\.09\.2\) Ken Ito can start\./);
  // 6. The other application's version line is untouched, and so is everything it decides.
  assert.deepEqual(facts().risk,before.risk);assert.equal(records('risk'),riskRecords);
  assert.deepEqual([start('alex.smith','risk'),start('ken.ito','risk'),s.run("lines.risk.releases.map(v=>v.label+' '+v.status).join()")],['ok','Not a user of this application','2026.08.2 Published,2026.07.1 Superseded']);
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

// ---- runtime prototype (GD Workspace)
const rt = json(runtime, 'mock-datasources');
function rtContext(names, prelude = '', globals = {}) {
  const context = vm.createContext({ structuredClone, Date, Error, setTimeout, URLSearchParams, ...globals });
  vm.runInContext(`const source=${JSON.stringify(rt)},session=source.session,metadata=source.screenDefinitions,db=structuredClone(source.dataSources);${prelude}
    ${names.map(name => implementation(runtime, name)).join('\n')}`, context);
  return code => vm.runInContext(code, context);
}

test('RT-01: canonical identifiers; roles, users and version belong to each application', () => {
  assert.deepEqual(rt.applications.map(a => [a.id, a.defaultScreen, a.version]), [['ops', 'orders', '2026.09.2'], ['risk', 'risks', '2026.08.3']]);
  assert.deepEqual(rt.applications.map(a => a.nav.map(g => g.id)), [['daily', 'tools', 'insights'], ['monitor']]);
  assert.deepEqual(Object.keys(rt.dataSources).sort(), ['customer-products', 'customers', 'employees', 'orders', 'products', 'regions', 'risks', 'sales-summary', 'stock']);
  assert.deepEqual(Object.keys(rt.valueLists).sort(), ['desks', 'jurisdictions', 'order-status', 'regions', 'risk-category', 'risk-rating', 'risk-status', 'sales-period', 'segments']);
  assert.deepEqual(Object.keys(rt.screenDefinitions), ['orders', 'customers', 'inventory', 'repricing', 'regions', 'associations', 'sales', 'risks', 'limitCheck']);
  assert.ok(Object.values(rt.screenDefinitions).every(d => d.app === (['risks', 'limitCheck'].includes(d.id) ? 'risk' : 'ops')), 'no shared screens');
  assert.ok(Array.isArray(rt.messages) && rt.dataSources.messages === undefined, 'messages are not a data source');
  // Nothing about access or version is workspace-wide.
  assert.equal(rt.roles, undefined, 'no top-level roles');
  assert.equal(rt.metadataVersion, undefined, 'no top-level version');
  assert.deepEqual(Object.keys(rt.session).sort(), ['displayName', 'initials', 'locale', 'subject', 'timeZone']);
  assert.equal(rt.session.subject, 'alex.smith');
  assert.doesNotMatch(runtime, /metadataVersion|subjectId|userId|session\.roles|source\.roles/);
  assert.deepEqual(rt.applications.map(a => a.roles.map(r => r.id)), [['operations-reader', 'operations-editor'], ['risk-reader', 'risk-manager']]);
  for (const a of rt.applications) {
    const screens = Object.values(rt.screenDefinitions).filter(d => d.app === a.id).map(d => d.id);
    for (const role of a.roles) {
      assert.deepEqual(Object.keys(role).sort(), ['active', 'fieldPolicies', 'id', 'name', 'permissions', 'rowScopes']);
      assert.ok(Object.keys(role.permissions).every(id => screens.includes(id)), role.id + ' names only screens of ' + a.id);
      assert.ok(Object.values(role.permissions).every(p => Object.values(p).every(v => v === true)), role.id + ' lists what is granted');
    }
    assert.equal(a.users.length, 1, a.id + ' carries only the signed-in person');
    const user = a.users[0];
    assert.deepEqual(Object.keys(user).sort(), ['active', 'default', 'displayName', 'email', 'overrides', 'region', 'roles', 'subject']);
    assert.deepEqual([user.subject, user.displayName, user.email, user.active], ['alex.smith', 'Alex Smith', 'alex.smith@example.test', true]);
    assert.ok(user.roles.every(id => a.roles.some(r => r.id === id)), 'a user holds roles of the same application only');
    assert.ok(user.overrides.every(o => screens.includes(o.screenId)), 'an override names a screen of the same application');
    const note = rt.messages.find(m => m.application === a.id && m.title === 'Application updated');
    assert.ok(note && note.text.includes(a.name) && note.text.includes(a.version), a.id + ' update message carries its own version');
  }
  assert.deepEqual(rt.applications.map(a => [a.users[0].default, a.users[0].roles]), [[true, ['operations-editor']], [false, ['risk-manager']]]);
  assert.deepEqual(rt.applications[0].roles[1].permissions.associations, { read: true, update: true, insert: true });
  assert.deepEqual(rt.applications[1].roles[1].permissions, { risks: { read: true, update: true, insert: true, export: true, print: true }, limitCheck: { execute: true } });
});

test('RT-02: value lists are value/label/active; rows store the value or the row id, never the label', () => {
  for (const list of Object.values(rt.valueLists)) for (const entry of list) assert.deepEqual(Object.keys(entry).sort(), ['active', 'label', 'value']);
  const values = id => rt.valueLists[id].map(e => e.value), ids = name => rt.dataSources[name].map(r => r.id);
  for (const o of rt.dataSources.orders) {
    assert.ok(ids('customers').includes(o.customer) && ids('products').includes(o.product), o.id + ' lookups store ids');
    assert.ok(values('regions').includes(o.region) && values('order-status').includes(o.status), o.id + ' coded values');
    assert.doesNotMatch(o.owner, /^[A-Z]\. /, 'people are written in full');
  }
  for (const c of rt.dataSources.customers) assert.ok(ids('employees').includes(c.accountManager) && values('segments').includes(c.segment));
  for (const r of rt.dataSources.risks) assert.ok(values('risk-category').includes(r.category) && values('risk-status').includes(r.status) && values('risk-rating').includes(r.rating));
  for (const l of rt.dataSources['customer-products']) assert.ok(ids('customers').includes(l.customer) && ids('products').includes(l.product));
  assert.deepEqual(values('desks'), ['LON-RATES', 'EMEA-CR', 'global-equities']);
});

test('RT-03: screens declare their fields, criteria and canonical command keys', () => {
  const d = rt.screenDefinitions, ids = list => list.map(f => f.id);
  assert.deepEqual(ids(d.inventory.masterFields), ['product']);
  assert.deepEqual(ids(d.inventory.detailFields), ['warehouse', 'onHand', 'reserved', 'available', 'reorderAt', 'status']);
  assert.deepEqual(ids(d.regions.fields), ['name', 'id', 'type', 'owner', 'status', 'parent', 'childCount']);
  assert.deepEqual(ids(d.associations.fields), ['customer', 'product']);
  assert.deepEqual(ids(d.sales.fields), ['month', 'actual', 'target']);
  assert.equal(d.orders.fields.find(f => f.id === 'customer').type, 'lookup');
  assert.ok(Object.values(d).flatMap(x => x.fields || []).every(f => f.role === 'data'));
  assert.ok(Object.values(d).flatMap(x => x.criteria || []).every(f => f.role === 'criteria'));
  assert.deepEqual([...new Set(d.orders.criteria.map(c => c.type))].sort(), ['boolean', 'date', 'hidden', 'lookup', 'select', 'text']);
  assert.deepEqual(d.orders.commands, ['New', 'Edit', 'Delete', 'Refresh', 'Filter', 'Search', 'GroupBy', 'Excel', 'Printer', 'Detach']);
  assert.deepEqual(d.customers.commands, ['Previous', 'Next', 'New', 'Save', 'Delete', 'Refresh', 'Detach']);
  assert.deepEqual(d.inventory.commands, ['Previous', 'Next', 'Save', 'Refresh', 'Excel', 'Detach']);
  assert.deepEqual([d.repricing.commands, d.regions.commands, d.associations.commands, d.sales.commands], [['Run', 'Detach'], ['Refresh', 'Detach'], ['Save', 'Refresh', 'Detach'], ['Refresh', 'Excel', 'Detach']]);
  const registered = [...runtime.matchAll(/^    register\('([A-Za-z]+)'/gm)].map(m => m[1]);
  for (const key of ['New', 'Edit', 'Save', 'Delete', 'Refresh', 'Filter', 'Search', 'GroupBy', 'Excel', 'Printer', 'Previous', 'Next', 'Run', 'Detach', 'Dock', 'Close', 'Select', 'SelectGDApplication', 'XLExportAll', 'About', 'Messages', 'Help', 'Theme']) assert.ok(registered.includes(key), key + ' is registered');
  assert.equal(registered.filter(k => k === 'Close').length, 2, 'Close exists for the tab and for the shell (Sign out)');
  assert.doesNotMatch(runtime, /\sonclick=|\sonchange=|\soninput=/, 'no inline handlers: actions go through the dispatcher');
});

test('RT-04: access comes from the screen\'s application: its entry for the person, its roles, then its override', () => {
  const make = () => rtContext(['applicationAccess', 'permissionsFor', 'canOpen', 'may', 'currentRecord', 'commandState'], "const state={view:'workspace',detached:{},connection:'online',support:false};");
  let run = make();
  const visible = id => run(`(() => { const def=metadata[${JSON.stringify(id)}], s={life:'ready',selected:new Set(),rows:[{},{}],dirty:false};
    return def.commands.filter(k => commandState(k,{key:def.id+':x'},def,s).visible).join(' '); })()`);
  // What Alex Smith can see and do: capability and permission both required.
  assert.equal(visible('orders'), 'New Edit Delete Refresh Filter Search GroupBy Excel Printer Detach');
  assert.equal(visible('risks'), 'New Edit Refresh Filter Search GroupBy Excel Printer Detach', 'risk-manager cannot delete');
  assert.equal(visible('customers'), 'Previous Next New Save Delete Refresh Detach');
  assert.equal(visible('inventory'), 'Previous Next Save Refresh Excel Detach');
  assert.equal(visible('associations'), 'Save Refresh Detach');
  assert.equal(visible('repricing'), 'Run Detach');
  assert.equal(visible('limitCheck'), 'Run Detach');
  assert.equal(run("may(metadata.associations,'insert')"), true);
  assert.equal(run("may(metadata.associations,'delete')"), false, 'capability alone is not enough');
  assert.equal(run("may(metadata.customers,'export')"), false, 'permission alone is not enough');
  assert.equal(run("JSON.stringify(source.applications.map(applicationAccess))"), '["",""]', 'both applications can be started');
  assert.equal(run("(() => { const def=metadata.orders, s={life:'ready',selected:new Set(),rows:[],dirty:false,unknown:{}}; return ['New','Edit','Delete'].every(k => commandState(k,{key:'k'},def,s).disabled) && !commandState('Refresh',{key:'k'},def,s).disabled; })()"), true, 'unknown outcome blocks New/Edit/Delete');
  assert.equal(run("(() => { const def=metadata.customers, s={life:'ready',selected:new Set(),rows:[{},{}],dirty:true,withdrawn:{}}; return commandState('Save',{key:'k'},def,s).disabled; })()"), true, 'Save is unavailable under a withdrawn definition');
  // Each application decides alone, from its own users and roles.
  run("source.applications[1].users=[]");
  assert.equal(run('applicationAccess(source.applications[1])'), 'Not a user of this application');
  assert.equal(run('canOpen(metadata.risks) || canOpen(metadata.limitCheck)'), false);
  assert.equal(run('canOpen(metadata.orders)'), true, 'the other application is untouched');
  run = make(); run('source.applications[0].users[0].active=false');
  assert.equal(run('applicationAccess(source.applications[0])'), 'Inactive');
  assert.equal(run('canOpen(metadata.orders)'), false);
  assert.equal(run('canOpen(metadata.risks)'), true);
  run = make(); run('source.applications[0].users[0].roles=[]');
  assert.equal(run('applicationAccess(source.applications[0])'), 'No role');
  run = make(); run('source.applications[0].roles[1].active=false');
  assert.equal(run('applicationAccess(source.applications[0])'), 'No role', 'an inactive role grants nothing');
  assert.equal(run('canOpen(metadata.orders)'), false);
  run = make(); run("source.applications[0].users[0].roles=['risk-manager']");
  assert.equal(run('applicationAccess(source.applications[0])'), 'No role', 'a role of another application grants nothing here');
  // The reader role, and an override that replaces the role grants for one screen only.
  run = make(); run("source.applications[0].users[0].roles=['operations-reader']");
  assert.equal(visible('orders'), 'Refresh Filter Search GroupBy Excel Printer Detach');
  assert.equal(run('canOpen(metadata.repricing)'), false);
  run = make(); run("source.applications[0].users[0].overrides=[{screenId:'customers',permissions:{read:true},reason:'Read-only access during secondment'}]");
  assert.equal(visible('customers'), 'Previous Next Refresh Detach');
  assert.equal(visible('orders'), 'New Edit Delete Refresh Filter Search GroupBy Excel Printer Detach', 'an override touches one screen');
});

test('RT-05: routes restore application, screen and record; state belongs to a tab key', () => {
  const run = rtContext(['parseRoute', 'routeHash', 'parseRouteKey', 'screenState'], "const state={tabs:[{key:'orders:ops',screenId:'orders'},{key:'orders:ops:2',screenId:'orders'}],activeTab:'orders:ops:2',screens:{}};");
  assert.deepEqual(JSON.parse(run("JSON.stringify(parseRoute('#/ops/customers/CUS-003?view=detached'))")), { appId: 'ops', screenId: 'customers', subkey: 'CUS-003', params: { view: 'detached' } });
  assert.equal(run("routeHash({appId:'ops',screenId:'customers',subkey:'CUS-003',view:'detached'})"), '#/ops/customers/CUS-003?view=detached');
  assert.equal(run("routeHash({appId:'risk',screenId:'',view:'workspace'})"), '#/risk');
  assert.equal(run("parseRouteKey('#/ops/orders?sim=conflict')"), run("parseRouteKey('#/ops/orders')"));
  assert.equal(run("parseRoute('#/%E0%A4%A').appId"), '', 'malformed addresses do not throw');
  assert.equal(run("screenState('orders:ops') !== screenState('orders:ops:2')"), true, 'two tabs of one screen do not share state');
  assert.equal(run("screenState('orders') === screenState('orders:ops:2')"), true, 'a screen id resolves to the active tab of that screen');
});

test('RT-06: validation problems name the field and code; optional empty numbers are not range-checked', () => {
  const ctx = vm.createContext({ Number });
  vm.runInContext(implementation(runtime, 'validate'), ctx);
  const v = (fields, values) => JSON.parse(vm.runInContext(`JSON.stringify(validate(${JSON.stringify(fields)},${JSON.stringify(values)}))`, ctx));
  assert.deepEqual(v([{ id: 'name', label: 'Name', type: 'text', required: true }], { name: '' }).map(p => [p.field, p.code, p.severity]), [['name', 'REQUIRED', 'error']]);
  assert.equal(v([{ id: 'n', label: 'N', type: 'number', min: 5 }], { n: '' }).length, 0);
  assert.deepEqual(v([{ id: 'n', label: 'N', type: 'number', min: -20, max: 20 }], { n: 25 }).map(p => p.code), ['ABOVE_MAXIMUM']);
  assert.deepEqual(v([{ id: 'e', label: 'E', type: 'text', format: 'email' }], { e: 'nope' }).map(p => p.code), ['BAD_EMAIL']);
  assert.deepEqual(v([{ id: 't', label: 'T', type: 'text', maxLength: 3 }], { t: 'abcd' }).map(p => p.code), ['TOO_LONG']);
  assert.deepEqual(v([{ id: 'q', label: 'Q', type: 'number', integer: true }], { q: 1.5 }).map(p => p.code), ['NOT_WHOLE']);
});

test('RT-07: export file is one multi-sheet workbook and neutralises formula text', () => {
  const run = rtContext(['safeCellText', 'xmlText', 'workbookXml']);
  for (const lead of ['=', '+', '-', '@']) assert.equal(run(`safeCellText(${JSON.stringify(lead + 'SUM(A1)')})`), "'" + lead + 'SUM(A1)');
  assert.equal(run("safeCellText('Maya Chen')"), 'Maya Chen');
  const xml = run(`workbookXml([{name:'Order register',columns:['Order','Owner','Amount','Date'],rows:[[{type:'string',value:'ORD-1'},{type:'string',value:'=HYPERLINK("x")'},{type:'float',value:12.5},{type:'date',value:'2026-09-01'}]]},{name:'Order register',columns:['A'],rows:[]}])`);
  assert.equal((xml.match(/<table:table /g) || []).length, 2, 'one file, one sheet per screen');
  assert.match(xml, /table:name="Order register"[\s\S]*table:name="Order register 2"/, 'sheet names are unique');
  assert.ok(xml.includes("<text:p>'=HYPERLINK(&quot;x&quot;)</text:p>"), 'formula text is escaped and prefixed');
  assert.match(xml, /office:value-type="float" office:value="12.5"/);
  assert.match(xml, /office:date-value="2026-09-01"/);
  const printer = runtime.split('\n').find(line => line.includes("register('Printer'"));
  assert.match(printer, /openPrintDocument/);
  assert.doesNotMatch(printer, /window\.print/, 'Print opens the print document, not the interactive layout');
});

test('RT-08: message intents are data; unknown, duplicate and expired messages do nothing', () => {
  const calls = [];
  const run = rtContext(['deliverMessage'], `const state={signedOut:false,seenMessages:new Set(),messages:[],tabs:[{key:'orders:ops',screenId:'orders'},{key:'customers:ops',screenId:'customers'}],screens:{'orders:ops':{dirty:false},'customers:ops':{dirty:true}},pollingSeconds:10};
    const telemetry=[];const nextId=p=>p+'-1';const paintMessages=()=>{},announce=()=>{},refreshChrome=()=>{};
    const messageBox=o=>calls.push('box:'+o.modeless),endSession=r=>calls.push('end:'+r),refreshScreen=(k,o)=>calls.push('refresh:'+k+':'+o.auto);`, { calls });
  assert.equal(run("deliverMessage({id:'a',type:'notification',title:'T',text:'x'})"), 'delivered');
  assert.equal(run("deliverMessage({id:'a',type:'notification',title:'T',text:'x'})"), 'duplicate');
  assert.equal(run('state.messages.length'), 1);
  assert.equal(run("deliverMessage({id:'b',type:'notification',title:'T',text:'x',expires:'2000-01-01T00:00:00Z'})"), 'expired');
  assert.equal(run("deliverMessage({id:'c',type:'runScript',code:'alert(1)'})"), 'ignored');
  assert.equal(run("deliverMessage({id:'d',type:'setPollingInterval',seconds:0})") + run('state.pollingSeconds'), 'delivered10');
  assert.equal(run("deliverMessage({id:'e',type:'setPollingInterval',seconds:'-5'})"), 'rejected');
  assert.equal(run("deliverMessage({id:'f',type:'setPollingInterval',seconds:'soon'})"), 'rejected');
  assert.equal(run("deliverMessage({id:'g',type:'invalidateDataset',dataset:'orders'})") + run("state.screens['orders:ops'].stale"), 'deliveredtrue');
  run("deliverMessage({id:'h',type:'refreshScreen',dataset:'orders'});deliverMessage({id:'i',type:'refreshScreen',dataset:'customers'})");
  assert.equal(run("state.screens['customers:ops'].refreshWaiting"), true, 'a dirty screen is not refreshed');
  run("deliverMessage({id:'j',type:'dialogNotice',title:'N',text:'x'});deliverMessage({id:'k',type:'terminateSession'})");
  assert.deepEqual(calls, ['refresh:orders:ops:true', 'box:true', 'end:terminated']);
});

// ---- both prototypes embed the same reference application
// The runtime shows each application as its own Studio draft authors it. Each application configuration is
// self-contained, so every comparison is made application by application.
test('Cross-prototype: each application agrees on version, navigation, screens, commands, roles and the signed-in user', () => {
  const granted = o => Object.keys(o || {}).filter(k => o[k]).sort();
  assert.deepEqual(rt.applications.map(a => a.id), seedApps);
  for (const app of rt.applications) {
    const cfg = initial.configurations[app.id], studioApp = cfg.applications[0];
    assert.equal('Draft ' + app.version, cfg.draft.label, app.id + ' version');
    assert.deepEqual([app.id, app.name, app.description, app.defaultScreen, app.allowPersonalMenus],
      [studioApp.id, studioApp.name, studioApp.description, studioApp.defaultScreen, studioApp.options.allowPersonalMenus]);
    const shape = groups => groups.map(g => [g.id, g.label, g.items.map(i => [i.id, i.label, i.screenId, i.icon])]);
    assert.deepEqual(shape(app.nav), shape(cfg.navigation[app.id]), app.id + ' navigation');
    const screens = Object.values(rt.screenDefinitions).filter(d => d.app === app.id);
    assert.deepEqual(screens.map(d => d.id), cfg.screens.map(s => s.id), app.id + ' screens');
    for (const def of screens) {
      const s = cfg.screens.find(x => x.id === def.id);
      assert.deepEqual([def.type, def.app, def.caption, def.description, def.autoRefresh || 0], [s.type, s.appId, s.caption, s.description, s.autoRefresh], def.id + ' identity');
      assert.deepEqual(granted(def.capabilities), granted(s.capabilities), def.id + ' capabilities');
      assert.deepEqual(def.commands, s.commands.map(c => c.key), def.id + ' commands');
    }
    // Roles and users belong to the application: same roles, same grants, and the same entry for the signed-in person.
    assert.deepEqual(app.roles.map(r => [r.id, r.name, r.active]), cfg.roles.map(r => [r.id, r.name, r.active]), app.id + ' roles');
    for (const role of app.roles) {
      const studioRole = cfg.roles.find(r => r.id === role.id);
      for (const screen of new Set([...Object.keys(role.permissions), ...Object.keys(studioRole.permissions)]))
        assert.deepEqual(granted(role.permissions[screen]), granted(studioRole.permissions[screen]), role.id + ' on ' + screen);
      assert.ok(Object.keys(studioRole.permissions).every(id => cfg.screens.some(s => s.id === id)), role.id + ' names only screens of ' + app.id);
    }
    assert.deepEqual(app.users, cfg.users.filter(u => u.subject === rt.session.subject), app.id + ' entry for the signed-in person');
  }
});

test('Cross-prototype: fields, criteria, value lists and sample rows agree', () => {
  const column = f => !['label', 'action', 'subscreen'].includes(f.type);
  for (const def of Object.values(rt.screenDefinitions)) {
    const s = seed.screens.find(x => x.id === def.id);
    const data = [...(def.masterFields || []), ...(def.fields || []), ...(def.detailFields || [])];
    assert.deepEqual(data.map(f => [f.id, f.label, f.type]), s.fields.filter(f => f.role === 'data' && column(f)).map(f => [f.id, f.caption, f.type]), def.id + ' data fields');
    assert.deepEqual((def.criteria || []).map(f => [f.id, f.label, f.type]), s.fields.filter(f => f.role === 'criteria').map(f => [f.id, f.caption, f.type]), def.id + ' criteria');
    assert.deepEqual((def.elements || []).map(f => [f.id, f.type]), s.fields.filter(f => !column(f)).map(f => [f.id, f.type]), def.id + ' elements');
    // Sample rows: a runtime row is keyed by field id, a Studio fixture row by the field's binding.
    const rows = rt.dataSources[def.dataSource], fixture = fixtures.datasets[s.dataClassId];
    if (!Array.isArray(rows) || rows.some(r => r.children)) continue;
    assert.equal(rows.length, fixture.length, def.id + ' row count');
    const binding = Object.fromEntries(s.fields.filter(f => f.role === 'data' && f.binding).map(f => [f.id, f.binding]));
    rows.forEach((row, i) => { for (const f of def.fields || []) if (f.id in row) assert.deepEqual(row[f.id], fixture[i][binding[f.id]], `${def.id} ${row.id} ${f.id}`); });
  }
  const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  assert.deepEqual(sorted(rt.valueLists), sorted(Object.fromEntries(seed.valueLists.filter(v => v.mode === 'static').map(v => [v.id, v.values]))));
  assert.deepEqual(sorted(Object.fromEntries(Object.entries(rt.lookups).map(([id, l]) => [id, [l.dataSource, l.keyField, l.displayField]]))),
    sorted(Object.fromEntries(seed.valueLists.filter(v => v.mode === 'dataClass').map(v => [v.id, [v.dataClassId, v.keyField, v.displayField]]))));
  assert.deepEqual(Object.keys(rt.dataSources).sort(), seed.dataClasses.filter(d => d.kind !== 'action').map(d => d.id).sort());
  for (const id of ['products', 'stock', 'employees']) assert.deepEqual(rt.dataSources[id].map(r => r.id), fixtures.datasets[id].map(r => r.id), id + ' rows');
  // The runtime holds the hierarchy as a tree and Studio as flat rows; the nodes are the same.
  const flatten = nodes => nodes.flatMap(n => [[n.id, n.name, n.type, n.owner, n.status], ...flatten(n.children || [])]);
  assert.deepEqual(flatten(rt.dataSources.regions).sort(), fixtures.datasets.regions.map(r => [r.id, r.name, r.type, r.owner, r.status]).sort());
});

async function checkRuntimeService() {
  const apiSource = runtime.slice(runtime.indexOf('    const api = {'), runtime.indexOf('    const iconMap ='));
  const service = () => {
    const context = vm.createContext({ structuredClone, Date, Error, setTimeout });
    vm.runInContext(`const source=${JSON.stringify(rt)},session=source.session,metadata=source.screenDefinitions,db=structuredClone(source.dataSources),state={sessionEpoch:0,signedOut:false};
      ${implementation(runtime, 'validate')}\n${implementation(runtime, 'permissionsFor')}\n${apiSource}\napi.wait=()=>Promise.resolve();`, context);
    return code => vm.runInContext(code, context);
  };
  const order = "{customer:'CUS-001',region:'UK',product:'PRD-100',orderDate:'2026-10-01',amount:10,status:'Pending',owner:'Maya Chen'}";
  const ok = name => { passed++; console.log('PASS ' + name); };

  let s = service();
  let r = await s(`api.save('orders',${order})`);
  assert.equal(r.outcome, 'committed'); assert.equal(r.results[0].key, 'ORD-1043'); assert.equal(r.results[0].row.version, 1); assert.ok(r.results[0].row.updatedAt);
  assert.ok(r.operationId && r.correlationId && r.effects === 'complete');
  assert.equal((await s(`api.save('orders',${order})`)).results[0].key, 'ORD-1044');
  ok('RT-09: the service allocates keys, versions and audit stamps');

  s = service();
  r = await s("api.save('orders',{id:'ORD-1042',version:2,owner:'Jay Patel'})");
  assert.equal(r.outcome, 'conflict'); assert.equal(r.results[0].reason, 'version'); assert.equal(r.results[0].current.version, 3);
  assert.equal(s("db.orders.find(o=>o.id==='ORD-1042').owner"), 'Maya Chen');
  r = await s("api.save('orders',{id:'ORD-9999',version:1,owner:'Jay Patel'})");
  assert.equal(r.outcome, 'conflict'); assert.equal(r.results[0].reason, 'missing');
  assert.equal((await s("api.remove('orders','ORD-9999')")).outcome, 'conflict');
  r = await s("api.change('orders',[{op:'delete',token:'a',key:'ORD-1041',version:1},{op:'delete',token:'b',key:'ORD-9999'}])");
  assert.equal(r.outcome, 'conflict'); assert.equal(s('db.orders.length'), 8);
  ok('RT-10: stale versions and zero affected rows are conflicts; a change set is all or nothing');

  s = service();
  r = await s(`api.save('orders',${order},{idempotencyKey:'k1'})`);
  const again = await s(`api.save('orders',${order},{idempotencyKey:'k1'})`);
  assert.equal(again.operationId, r.operationId); assert.equal(s('db.orders.length'), 9);
  r = await s(`api.save('orders',{...${order},amount:11},{idempotencyKey:'k1'})`);
  assert.equal(r.outcome, 'rejected'); assert.equal(r.results[0].problems[0].code, 'KEY_REUSED'); assert.equal(s('db.orders.length'), 9);
  ok('RT-11: an idempotency key identifies one operation and cannot be reused for different changes');

  s = service();
  s("sim.next='unknown'");
  r = await s(`api.save('orders',${order},{idempotencyKey:'k2'})`);
  assert.equal(r.outcome, 'unknown'); assert.equal(s('db.orders.length'), 8);
  assert.equal((await s(`api.status('${r.operationId}')`)).outcome, 'unknown');
  assert.equal((await s(`api.status('${r.operationId}')`)).outcome, 'committed');
  await s(`api.status('${r.operationId}')`);
  assert.equal(s('db.orders.length'), 9, 'a status check never applies the change twice');
  ok('RT-12: an unknown outcome is resolved by read-only status checks');

  s = service();
  r = await s("api.save('orders',{customer:'CUS-001',amount:-1})");
  assert.equal(r.outcome, 'rejected'); assert.ok(r.results[0].problems.some(p => p.field === 'region' && p.code === 'SERVER_REQUIRED')); assert.ok(r.results[0].problems.some(p => p.field === 'amount'));
  r = await s("api.change('customer-products',[{op:'insert',token:'x',values:{customer:'CUS-001',product:'PRD-140'}}])");
  assert.equal(r.results[0].problems[0].code, 'INACTIVE_REFERENCE');
  r = await s("api.change('customer-products',[{op:'insert',token:'x',values:{customer:'CUS-001',product:'PRD-100'}}])");
  assert.equal(r.results[0].problems[0].code, 'DUPLICATE');
  await assert.rejects(s("api.change('customer-products',[{op:'delete',token:'x',key:{customer:'CUS-001',product:'PRD-100'}}])"), e => e.kind === 'forbidden' && /^corr-/.test(e.correlationId));
  await assert.rejects(s("api.remove('risks','RSK-021')"), e => e.kind === 'forbidden');
  assert.equal(s("db['customer-products'].length"), 12);
  ok('RT-13: the service repeats validation and decides authority; the browser hint is not trusted');

  s = service();
  r = await s("api.execute('run-limit-check',{desk:'LON-RATES',position:850000,jurisdiction:'united-kingdom',asOf:'2026-09-06'},{stepMs:0})");
  assert.equal(r.outcome, 'committed'); assert.equal(r.result.verdict, 'Pass');
  r = await s("api.execute('run-limit-check',{desk:'EMEA-CR',position:850000,jurisdiction:'united-kingdom',asOf:'2026-09-06'},{stepMs:0})");
  assert.equal(r.result.verdict, 'Breach');
  s("sim.next='connection-lost'");
  await assert.rejects(s("api.query('orders')"), e => e.kind === 'unreachable');
  assert.equal((await s("api.query('orders')")).rows.length, 8, 'a simulated condition applies once');
  await assert.rejects(s("api.definition('sales','risk')"), e => e.kind === 'configError');
  ok('RT-14: actions are evaluated by the service; request failures are typed and carry a correlation ID');
}

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
checkSessionBoundary().then(checkRuntimeService).then(()=>console.log(`${passed} contract regressions passed; both HTML scripts and JSON parse.`)).catch(error=>{console.error(error);process.exitCode=1;});
