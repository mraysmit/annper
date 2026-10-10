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
    retireConfirm: { checked: true }, retireReason: { value: 'Retention period expired' } };
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
  const bootstrap = admin.slice(admin.indexOf('    const configKeys='), admin.indexOf('    const modules=['));
  vm.runInContext(`const initial=${JSON.stringify(initial)},model=structuredClone(initial),fixtures=${JSON.stringify(fixtures)};
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
  s.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,'Reviewed');}state.publicationNote='September order export release';publish();`);
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
  assert.match(s.run('reportPreview(model.reports[0])'),/no preview value/);
});

/* ---- Studio conformance pass (design 0.8, shared reference-application contract) ---- */
const errorCodes = s => s.run("validationIssues().filter(i=>i.severity==='error').map(i=>i.code+'@'+i.path)");
const hasIssue = (s, code, pathPrefix) => s.run(`validationIssues().some(i=>i.code===${JSON.stringify(code)}&&i.path.startsWith(${JSON.stringify(pathPrefix)}))`);
const bootstrapSource = admin.slice(admin.indexOf('    const configKeys='), admin.indexOf('    const modules=['));
// Whole-file checks report only the offending fragment, never the file.
function absent(text, pattern, what) { const m = pattern.exec(text); assert.equal(m ? m[0].slice(0, 120) : null, null, what || String(pattern)); }
function present(text, pattern, what) { assert.ok(pattern.test(text), what || 'expected ' + String(pattern)); }

test('Studio: embedded seed passes the validator unpatched, with one rule-covered warning', () => {
  assert.doesNotMatch(bootstrapSource, /\bmodel\./, 'start-up code must not patch the embedded model');
  const s=studio();
  assert.deepEqual([...errorCodes(s)],[]);
  assert.deepEqual([...s.run("validationIssues().map(i=>i.code+'@'+i.path)")],['COMMAND_NEVER_SHOWN@screens.risks.commands.Delete']);
  assert.ok(s.run("Boolean(warningRule('COMMAND_NEVER_SHOWN'))"));
});

test('Studio contract: applications, navigation, screens, DataClasses and value lists use the canonical identifiers', () => {
  assert.deepEqual(initial.applications.map(a=>[a.id,a.name,a.defaultScreen]),[['ops','Operations Hub','orders'],['risk','Risk & Controls','risks']]);
  assert.deepEqual(initial.navigation.ops.map(g=>g.id),['daily','tools','insights']);
  assert.deepEqual(initial.navigation.risk.map(g=>[g.id,g.items.map(i=>i.screenId)]),[['monitor',['risks','limitCheck']]]);
  assert.deepEqual(initial.screens.map(s=>`${s.id}:${s.type}:${s.appId}`),['orders:grid:ops','customers:field:ops','inventory:masterDetail:ops','repricing:action:ops',
    'regions:treeDetail:ops','associations:junction:ops','sales:chart:ops','risks:grid:risk','limitCheck:action:risk']);
  assert.equal(initial.screens.find(s=>s.id==='limitCheck').description,'Evaluate a position against a controlled limit rule.');
  assert.deepEqual(initial.dataClasses.map(d=>d.id).sort(),['apply-price-adjustment','customer-products','customers','employees','orders','products','regions','risks','run-limit-check','sales-summary','stock']);
  assert.deepEqual(initial.valueLists.filter(v=>v.mode==='static').map(v=>v.id).sort(),['desks','jurisdictions','order-status','regions','risk-category','risk-rating','risk-status','sales-period','segments']);
  assert.deepEqual(initial.valueLists.filter(v=>v.mode==='dataClass').map(v=>[v.id,v.keyField,v.displayField]),[['customers','id','name'],['products','id','name'],['employees','id','name']]);
  assert.ok(initial.valueLists.filter(v=>v.mode==='static').every(v=>v.values.every(x=>typeof x.value==='string'&&typeof x.label==='string'&&typeof x.active==='boolean')));
  assert.deepEqual(initial.valueLists.find(v=>v.id==='risk-status').values.map(v=>v.value),['active','monitoring','mitigated']);
  assert.deepEqual(initial.valueLists.find(v=>v.id==='regions').values.map(v=>`${v.value}=${v.label}`),['UK=United Kingdom','EU=European Union','NA=North America','APAC=Asia Pacific']);
  assert.ok(initial.valueLists.find(v=>v.id==='desks').values.some(v=>v.value==='global-equities'&&v.label==='Global Equities'));
});

test('Studio contract: field lists per screen carry id, binding, type, role and layout group and no coordinates', () => {
  const column=f=>f.role==='data'&&!['label','action','subscreen'].includes(f.type);
  const ids=id=>initial.screens.find(s=>s.id===id).fields.filter(column).map(f=>`${f.id}:${f.type}`);
  const others=id=>initial.screens.find(s=>s.id===id).fields.filter(f=>!column(f)).map(f=>`${f.id}:${f.type}:${f.role}`);
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
  const fields=initial.screens.flatMap(s=>s.fields.map(f=>({screen:s.id,...f})));
  assert.ok(fields.every(f=>['data','criteria'].includes(f.role)&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(f.group)));
  assert.ok(fields.every(f=>!('x' in f)&&!('y' in f)&&!('top' in f)&&!('left' in f)));
  assert.equal(initial.screens.find(s=>s.id==='repricing').fields[1].caption,'Adjustment percentage');
  assert.equal(initial.screens.find(s=>s.id==='customers').fields.find(f=>f.id==='email').format,'email');
  const snake=s=>s.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
  assert.deepEqual(fields.filter(f=>column(f)&&f.binding!==snake(f.id)).map(f=>`${f.screen}.${f.id}`),['inventory.product']);
});

test('Studio contract: commands use the canonical keys in toolbar order with all ten properties', () => {
  const keys=id=>initial.screens.find(s=>s.id===id).commands.map(c=>c.key);
  const grid=['New','Edit','Delete','Refresh','Filter','Search','GroupBy','Excel','Printer','Detach'];
  assert.deepEqual(keys('orders'),grid);assert.deepEqual(keys('risks'),grid);
  assert.deepEqual(keys('customers'),['Previous','Next','New','Save','Delete','Refresh','Detach']);
  assert.deepEqual(keys('inventory'),['Previous','Next','Save','Refresh','Excel','Detach']);
  assert.deepEqual(keys('repricing'),['Run','Detach']);assert.deepEqual(keys('limitCheck'),['Run','Detach']);
  assert.deepEqual(keys('regions'),['Refresh','Detach']);assert.deepEqual(keys('associations'),['Save','Refresh','Detach']);assert.deepEqual(keys('sales'),['Refresh','Excel','Detach']);
  const all=initial.screens.flatMap(s=>s.commands);
  for(const prop of ['key','scope','labelKey','iconKey','policy','enableWhen','confirmation','execution','concurrency','shortcut'])assert.ok(all.every(c=>typeof c[prop]==='string'),prop);
  const caption=key=>all.find(c=>c.key===key).label;
  assert.deepEqual(['New','GroupBy','Excel','Printer','Run'].map(caption),['Add','Customise view','Export','Print','Run action']);
});

test('Studio contract: capabilities and role permissions are named flags, never positional strings', () => {
  const capabilityKeys=['insert','update','delete','refresh','filter','search','export','print','personalize','detach'];
  assert.ok(initial.screens.every(s=>JSON.stringify(Object.keys(s.capabilities))===JSON.stringify(capabilityKeys)&&Object.values(s.capabilities).every(v=>typeof v==='boolean')));
  const granted=(role,screen)=>Object.keys(initial.roles.find(r=>r.id===role).permissions[screen]||{}).sort().join(' ');
  assert.deepEqual(initial.roles.map(r=>r.id),['operations-reader','operations-editor','risk-reader','risk-manager']);
  assert.equal(granted('operations-reader','orders'),'export print read');
  assert.equal(granted('operations-editor','orders'),'delete export insert print read update');
  assert.equal(granted('operations-editor','repricing'),'execute');
  assert.equal(granted('operations-editor','associations'),'insert read update');
  assert.equal(granted('risk-manager','risks'),'export insert print read update');
  assert.equal(granted('risk-manager','limitCheck'),'execute');
  assert.equal(granted('risk-reader','limitCheck'),'');
  assert.ok(initial.roles.filter(r=>r.id.startsWith('risk-')).every(r=>!('sales' in r.permissions)));
  assert.doesNotMatch(JSON.stringify(initial.roles),/"[-RWIDEP]{6}"/);
  const s=studio();
  s.run("model.roles[0].permissions.orders='R---EP'");
  assert.match(String(s.run('configurationShapeIssues(configuration())[0]')),/roles\.operations-reader\.permissions\.orders: expected named permission flags; positional strings are not accepted/);
  const t=studio();
  t.run("setFlag('roles.risk-reader.permissions','risks','export',false);setFlag('roles.risk-reader.permissions','limitCheck','execute',true)");
  assert.equal(t.run("JSON.stringify(model.roles.find(r=>r.id==='risk-reader').permissions)"),'{"risks":{"read":true,"print":true},"limitCheck":{"execute":true}}');
  assert.equal(t.run('audit[0].target'),'roles.risk-reader.permissions.limitCheck');
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
  const s=studio(),html=s.run("model.screens.map(x=>screenCanvas(x)).join('')+reportPreview(model.reports[0])+(renderScreens(),host.innerHTML)+(renderDataClasses(),host.innerHTML)+(renderConnections(),host.innerHTML)+(renderValues(),host.innerHTML)+(renderSecurity(),host.innerHTML)+(renderVersions(),host.innerHTML)+(renderValidation(),host.innerHTML)");
  absent(html,/mock-?up|\bdemo\b|fixture|simulat|prototype/i);
  present(admin,/About this prototype/);
});

test('Studio 11.4/14.3: a connection draft holds only id, name, provider, secret reference and active state', () => {
  assert.deepEqual([...new Set(initial.connections.flatMap(c=>Object.keys(c)))],['id','name','providerId','secretRef','active']);
  const s=studio();
  for(const key of ['endpoint','pool','timeout','encrypted','health']){
    s.run(`model.connections[0].${key}='x'`);
    assert.match(String(s.run("validationIssues()[0].code+' '+validationIssues()[0].path")),new RegExp('INVALID_SHAPE connections\\.ops-db\\.'+key));
    s.run(`delete model.connections[0].${key}`);
  }
  const before=s.run('digest()');
  s.run("fixtures.deployment.connections['ops-db'].health='Degraded';fixtures.deployment.connections['ops-db'].endpoint='elsewhere';fixtures.deployment.environment.id='prod';fixtures.deployment.roleMembers['operations-reader']=999");
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
  assert.equal(s.run("setProp('connections.ops-db','secretRef','Password=hunter2;User Id=sa','')"),false);
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
  s.run("state.actor='Jordan Lee';acceptWarning('COMMAND_NEVER_SHOWN',true)");
  s.run("state.actor='Priya Raman'");assert.equal(s.run("recordApproval('Product','')"),false,'an approval needs a reason');
  s.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,role+' review complete');}`);
  assert.equal(s.run('draftStatus()'),'Approved');
  assert.equal(s.run("audit.find(a=>a.action==='Approved candidate').reason"),'Test review complete');
  assert.match(s.run('publicationBlockers()[0]'),/publication reason is required/);
  s.run("state.publicationNote='Order export release';");assert.equal(s.run('performPublish()'),true);
  assert.equal(s.run('releases[0].status+releases[1].status'),'PublishedSuperseded');
  assert.equal(s.run("audit.find(a=>a.action==='Published version').reason"),'Order export release');
  assert.equal(s.run('state.publicationRevision'),8);
  s.run('renderVersions()');
  for(const stateName of ['Draft','Validating','Approved','Published','Superseded','Withdrawn','Retired'])assert.match(s.run('host.innerHTML'),new RegExp('<li class="[a-z]*"[^>]*>'+stateName+'</li>'));
});

test('Studio 11.2: an accepted warning needs an approved rule; changing acceptance clears approvals', () => {
  const s=studio();validCandidate(s);
  s.run("state.actor='Priya Raman';recordApproval('Product','Reviewed');state.actor='Jordan Lee';acceptWarning('COMMAND_NEVER_SHOWN',false)");
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
  s.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,'Reviewed');}state.publicationNote='Night release';`);
  assert.equal(s.run("schedulePublication('2000-01-01T00:00')"),false,'a past time is refused');
  assert.equal(s.run("schedulePublication(new Date(Date.now()+3600000).toISOString())"),true);
  assert.equal(s.run('tickSchedule(Date.now())'),false);assert.equal(s.run('releases[0].status'),'Published');assert.equal(s.run('releases.length'),2);
  assert.equal(s.run('tickSchedule(Date.now()+7200000)'),true);
  assert.equal(s.run('releases.length+releases[0].summary+releases[1].status'),'3Night releaseSuperseded');
  const t=studio();validCandidate(t);
  t.run(`for(const [role,actor] of [['Product','Priya Raman'],['Security','Alex Morgan'],['Test','Dana Whitlock']]){state.actor=actor;recordApproval(role,'Reviewed');}state.publicationNote='Night release';schedulePublication(new Date(Date.now()+3600000).toISOString());state.actor='Jordan Lee';setProp('screens.orders','caption','Orders','')`);
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
    model.roles[0].fieldPolicies[0].fieldId='nope';model.roles[0].rowScopes[0].field='nope';model.overrides[0].screenId='nope'`);
  for(const [code,path] of [['INVALID_REFERENCE','dataClasses.orders.writeConnectionId'],['INVALID_REFERENCE','screens.orders.reportId'],['UNDEFINED_POLICY','screens.orders.commands.New.policy'],['UNDEFINED_POLICY','screens.orders.commands.Edit.policy'],
    ['INVALID_REFERENCE','roles.operations-reader.permissions.ghost'],['INVALID_REFERENCE','valueLists.customers.displayField'],['INVALID_REFERENCE','dataClasses.customers.uniqueKey'],['INVALID_REFERENCE','reports.order-export.appId'],
    ['INVALID_REFERENCE','roles.operations-reader.fieldPolicies.#0'],['INVALID_REFERENCE','roles.operations-reader.rowScopes.#0'],['INVALID_REFERENCE','overrides.ovr-sara-evans-customers.screenId']])assert.ok(hasIssue(s,code,path),path);
  const t=studio();
  t.run("model.navigation.ops[1].id='daily';model.navigation.ops[2].items[0].id='nav-orders';model.screens[0].commands.push({...model.screens[0].commands[0]});model.dataClasses[0].parameters.push({name:'status',type:'string',source:'request',required:false});model.screens[1].commands[2].shortcut='Ctrl+S'");
  for(const path of ['navigation.ops.daily','navigation.ops.items.nav-orders','screens.orders.commands.New','dataClasses.orders.parameters.status','screens.customers.commands.New.shortcut'])assert.ok(hasIssue(t,'DUPLICATE_ID',path),path);
});

test('Studio 11.3: screen-type and read/write consistency are enforced', () => {
  const s=studio();
  s.run("delete model.screens.find(x=>x.id==='inventory').detailDataClassId;model.screens.find(x=>x.id==='repricing').dataClassId='orders';model.screens.find(x=>x.id==='orders').dataClassId='apply-price-adjustment';model.screens.find(x=>x.id==='sales').chart.series=['month'];model.screens.find(x=>x.id==='regions').tree.parentField='nope';model.screens.find(x=>x.id==='associations').junction.memberField='nope';model.screens.find(x=>x.id==='limitCheck').commands.shift()");
  for(const path of ['screens.inventory.detailDataClassId','screens.repricing.dataClassId','screens.orders.dataClassId','screens.sales.chart','screens.regions.tree','screens.associations.junction','screens.limitCheck.commands'])assert.ok(hasIssue(s,'SCREEN_TYPE_INCONSISTENT',path),path);
  const t=studio();
  t.run("model.screens.find(x=>x.id==='risks').capabilities.delete=true;model.dataClasses.find(d=>d.id==='customers').updateable=false;model.dataClasses.find(d=>d.id==='products').insertable=true;model.dataClasses.find(d=>d.id==='stock').uniqueKey=[]");
  for(const path of ['screens.risks.capabilities.delete','screens.customers.capabilities.update','dataClasses.products.writeRouting','dataClasses.stock.uniqueKey'])assert.ok(hasIssue(t,'WRITE_INCONSISTENT',path),path);
});

test('Studio 11.3/15.2: security coverage denies by default and reports ambiguity', () => {
  const s=studio();
  s.run("model.roles.find(r=>r.id==='operations-editor').permissions.orders.execute=true;model.roles.find(r=>r.id==='risk-manager').permissions.limitCheck.read=true;model.roles.find(r=>r.id==='risk-reader').permissions.orders={read:true}");
  for(const path of ['roles.operations-editor.permissions.orders.execute','roles.risk-manager.permissions.limitCheck.read','roles.risk-reader.permissions.orders'])assert.ok(hasIssue(s,'AMBIGUOUS_PERMISSION',path),path);
  const t=studio();
  t.run("model.roles.forEach(r=>{delete r.permissions.regions;delete r.permissions.orders?.print;});model.roles.find(r=>r.id==='risk-manager').active=false");
  assert.ok(hasIssue(t,'SCREEN_UNREACHABLE','screens.regions'));assert.ok(hasIssue(t,'COMMAND_UNREACHABLE','screens.orders.commands.Printer'));assert.ok(hasIssue(t,'COMMAND_UNREACHABLE','screens.limitCheck.commands.Run'),'an inactive role grants nothing');
  assert.equal(t.run("roleGrants(model.roles.find(r=>r.id==='risk-manager'),'limitCheck','execute')"),false);
  assert.equal(t.run("commandShown(model.screens.find(x=>x.id==='risks'),model.screens.find(x=>x.id==='risks').commands.find(c=>c.key==='Delete'),null)"),false,'capability off hides the command');
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
  assert.equal(claimed,'Structure · references · duplicates · option values · screen types · read/write consistency · security coverage · connections and providers · cache eligibility · expressions');
  assert.match(s.run('host.innerHTML'),/data-action="open" data-path="screens\.risks\.commands\.Delete"/);
  s.run("openPath('screens.risks.commands.Delete')");
  assert.deepEqual([...s.run('[state.module,state.appId,state.selectedScreen,state.selectedCommand,state.inspectorTab]')],['screens','risk','risks','Delete','command']);
  s.run("openPath('dataClasses.sales-summary.cacheMode')");
  assert.deepEqual([...s.run('[state.module,state.appId,state.selectedDataClass,state.detailTab,state.focusPath]')],['dataclasses','ops','sales-summary','caching','dataClasses.sales-summary.cacheMode']);
  s.run("openPath('roles.risk-reader.fieldPolicies.#0')");assert.deepEqual([...s.run('[state.module,state.selectedRole,state.securityTab]')],['security','risk-reader','fields']);
  s.run("openPath('navigation.risk.monitor.items.nav-limits.screenId')");assert.deepEqual([...s.run('[state.module,state.appId,state.navSelection]')],['navigation','risk','item:monitor:nav-limits']);
  s.run("openPath('connections.risk-db.secretRef')");assert.deepEqual([...s.run('[state.module,state.selectedConnection]')],['connections','risk-db']);
  assert.ok(s.run("validationIssues().concat(configurationShapeIssues({}).map(t=>({path:'configuration'}))).every(i=>typeof i.path==='string'&&i.path.length>0)"));
});

test('Studio 11.4: impact analysis lists affected applications, screens, DataClasses, roles, reports and tests', () => {
  const s=studio();
  const seed=JSON.parse(s.run('JSON.stringify(impactAnalysis(activeRelease().snapshot,configuration()))'));
  assert.deepEqual(seed.changed,['roles.risk-manager','screens.orders']);
  assert.deepEqual(seed.applications,['applications.ops']);assert.deepEqual(seed.screens,['screens.orders']);assert.deepEqual(seed.roles.includes('roles.operations-editor'),true);
  assert.deepEqual(seed.tests.map(t=>t.id),['AT-ORD-001','AT-SEC-001','AT-NAV-001'],'orders is a navigation target and the default screen');
  s.run("model.dataClasses.find(d=>d.id==='products').timeoutSeconds=11");
  const next=JSON.parse(s.run('JSON.stringify(impactAnalysis(activeRelease().snapshot,configuration()))'));
  assert.ok(next.dataClasses.includes('dataClasses.products'));assert.ok(next.valueLists.includes('valueLists.products'));
  for(const screen of ['screens.inventory','screens.orders','screens.associations'])assert.ok(next.screens.includes(screen),screen);
  assert.ok(!next.screens.includes('screens.risks'));assert.ok(next.tests.some(t=>t.id==='AT-INV-001'));
  s.run("model.connections.find(c=>c.id==='risk-db').name='Risk data store'");
  const third=JSON.parse(s.run('JSON.stringify(impactAnalysis(activeRelease().snapshot,configuration()))'));
  assert.ok(third.applications.includes('applications.risk'));assert.ok(third.reports.includes('reports.risk-export'));assert.ok(third.screens.includes('screens.limitCheck'));
  s.run("state.module='impact';renderImpact()");assert.match(s.run('host.innerHTML'),/Acceptance tests \(\d+\)/);
});

test('Studio 11.4: comparison is field-level and side by side; dependencies are navigable', () => {
  const s=studio();
  const rows=JSON.parse(s.run('JSON.stringify(diffEntries(activeRelease().snapshot,configuration()))'));
  assert.deepEqual(rows.find(r=>r.path==='screens.orders.fields.amount.format'),{path:'screens.orders.fields.amount.format',before:'GBP,0',after:'GBP,0.00',change:'changed'});
  assert.ok(rows.some(r=>r.path==='screens.orders.commands.Excel.key'&&r.change==='added'));
  assert.deepEqual(rows.find(r=>r.path==='roles.risk-manager.permissions.risks.export'),{path:'roles.risk-manager.permissions.risks.export',after:'true',change:'added'});
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
  assert.equal(s.run("deletionPlan('screens.orders').blocking.map(r=>r.via).join()"),'default screen');
  assert.deepEqual([...s.run("deletionPlan('screens.regions').cascade.map(r=>r.from).sort()")],['navigation.ops.tools.items.nav-regions','roles.operations-editor.permissions.regions','roles.operations-reader.permissions.regions']);
  assert.equal(s.run("deleteEntity('screens.regions')"),true);
  assert.equal(s.run("model.screens.some(x=>x.id==='regions')||model.navigation.ops[1].items.some(i=>i.screenId==='regions')||model.roles.some(r=>'regions' in r.permissions)"),false);
  assert.equal(s.run('audit[0].action+\"@\"+audit[0].target'),'Deleted screen@screens.regions');
  assert.equal(s.run("deleteEntity('roles.risk-reader')"),true);assert.equal(s.run('model.roles.length'),3);
  assert.deepEqual([...errorCodes(s)],[]);
  const t=studio();
  assert.equal(t.run("deleteEntity('applications.risk')"),true);
  assert.equal(t.run("model.screens.some(x=>x.appId==='risk')||model.dataClasses.some(d=>d.appId==='risk')||model.reports.some(r=>r.appId==='risk')||'risk' in model.navigation||model.roles.some(r=>r.applications.includes('risk')||'risks' in r.permissions)"),false);
  assert.deepEqual([...errorCodes(t)],[],'no orphan is left behind');
  assert.equal(t.run("deletionPlan('applications.ops').blocking[0].via"),'the last application cannot be deleted');
  const u=studio();
  u.run("model.screens.find(x=>x.id==='risks').fields.push({id:'product',caption:'Product',binding:'title',type:'lookup',role:'data',group:'columns',required:false,visible:true,editable:true,sequence:80,valueList:'products'})");
  assert.equal(u.run("deletionPlan('applications.ops').blocking.map(r=>r.from+'>'+r.to).join()"),'valueLists.products>dataClasses.products','a lookup still used by another application blocks deletion');
  assert.equal(u.run("deleteEntity('applications.ops')"),false);
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
  s.run("setProp('connections.risk-db','name','Risk data store','')");assert.equal(s.run('audit[0].target+\"|\"+audit[0].detail'),'connections.risk-db|name: Risk data to Risk data store');
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
    model.reports[0].outputs=[${JSON.stringify(tag)}];model.reports[0].columns[0].caption=${JSON.stringify(tag)};model.navigation.ops[0].label=${JSON.stringify(tag)};model.dataClasses[0].source=${JSON.stringify(hostile)};model.dataClasses[0].parameters[0].name=${JSON.stringify(hostile)};model.connections[0].secretRef=${JSON.stringify(tag)};model.connections[0].providerId=${JSON.stringify(hostile)};model.roles[1].name=${JSON.stringify(tag)};model.valueLists[0].values[0].label=${JSON.stringify(tag)};model.valueLists[0].values[0].value=${JSON.stringify(hostile)};model.overrides[0].subject=${JSON.stringify(hostile)};
    state.selectedField='customer';state.navSelection='group:daily';state.selectedList='order-status';`);
  let html='';
  for(const tab of ['properties','field','command','behavior','access']){s.run(`state.inspectorTab='${tab}';renderScreens()`);html+=s.run('host.innerHTML');}
  for(const tab of ['definition','parameters','result','caching','write','dependencies']){s.run(`state.detailTab='${tab}';renderDataClasses()`);html+=s.run('host.innerHTML');}
  for(const tab of ['permissions','access','fields','rows','overrides']){s.run(`state.securityTab='${tab}';renderSecurity()`);html+=s.run('host.innerHTML');}
  html+=s.run("renderNavigation(),host.innerHTML")+s.run("renderReports(),host.innerHTML")+s.run("renderConnections(),host.innerHTML")+s.run("renderValues(),host.innerHTML")+s.run("renderValidation(),host.innerHTML")+s.run("renderVersions(),host.innerHTML")+s.run("renderAudit(),host.innerHTML")+s.run("reportPreview(model.reports[0])")+s.run("comparison('ver-2026-09-1','draft')");
  absent(html,/<img src=x/);absent(html,/" onfocus="alert/);
  present(html,/&lt;img src=x onerror=alert\(1\)&gt;/);present(html,/x&quot; onfocus=&quot;alert\(1\)&quot;/);
});

test('Studio 3.7/8.4: a new screen binds a real field; all fifteen control types validate and render', () => {
  const s=studio();
  s.run("model.screens.push(newScreen('trend','Trend','grid','sales-summary'));model.screens.push(newScreen('check2','Second check','action','run-limit-check'))");
  assert.equal(s.run("model.screens.at(-2).fields[0].binding+'|'+model.screens.at(-1).fields[0].binding+'|'+model.screens.at(-1).commands.map(c=>c.key+':'+c.policy).join()"),'month|desk|Run:check2.execute,Detach:check2.execute');
  assert.equal(s.run("validationIssues().filter(i=>i.severity==='error'&&/^screens\\.(trend|check2)/.test(i.path)).length"),0);
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
  s.run("state.previewRole='risk-reader'");assert.match(s.run("screenCanvas(model.screens[0],false)"),/is granted nothing on this screen/);
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
  s.run('renderSecurity()');assert.match(s.run('host.innerHTML'),/class="role-pill active" role="tab" aria-selected="true"/);
  s.run('renderConnections()');assert.match(s.run('host.innerHTML'),/<button class="link" data-action="select" data-kind="connection" data-id="risk-db"/);
  present(admin,/aria-current="page"/);present(admin,/setAttribute\('role',sticky\?'alert':'status'\)/);present(admin,/Dismiss message/);
  present(admin,/function stored\(key\)\{try\{return localStorage\.getItem\(key\);\}catch/);assert.equal((admin.match(/localStorage\./g)||[]).length,2);
  absent(admin,/\.page-actions \.button:not\(\.primary\)\{display:none\}/);
  present(admin,/<button class="button small" data-action="importJson"/);absent(admin,/<label[^>]*for="importJson"/);
  absent(admin,/\bconfirm\(/);absent(admin,/\.drop-zone|\.diff-col|\.diff-head|\.diff-line/);
  const inputs=s.run("(renderDataClasses(),host.innerHTML)+(renderSecurity(),host.innerHTML)+(renderReports(),host.innerHTML)+(renderValues(),host.innerHTML)");
  for(const m of inputs.matchAll(/<(input|select|textarea)\b([^>]*)>/g))assert.ok(/aria-label=|id="/.test(m[2])||/type="checkbox"/.test(m[2]),m[0]);
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

test('RT-01: reference application uses the canonical identifiers', () => {
  assert.deepEqual(rt.applications.map(a => [a.id, a.defaultScreen]), [['ops', 'orders'], ['risk', 'risks']]);
  assert.deepEqual(rt.applications.map(a => a.nav.map(g => g.id)), [['daily', 'tools', 'insights'], ['monitor']]);
  assert.deepEqual(Object.keys(rt.dataSources).sort(), ['customer-products', 'customers', 'employees', 'orders', 'products', 'regions', 'risks', 'sales-summary', 'stock']);
  assert.deepEqual(Object.keys(rt.valueLists).sort(), ['desks', 'jurisdictions', 'order-status', 'regions', 'risk-category', 'risk-rating', 'risk-status', 'sales-period', 'segments']);
  assert.deepEqual(Object.keys(rt.screenDefinitions), ['orders', 'customers', 'inventory', 'repricing', 'regions', 'associations', 'sales', 'risks', 'limitCheck']);
  assert.ok(Object.values(rt.screenDefinitions).every(d => d.app === (['risks', 'limitCheck'].includes(d.id) ? 'risk' : 'ops')), 'no shared screens');
  assert.ok(Array.isArray(rt.messages) && rt.dataSources.messages === undefined, 'messages are not a data source');
  assert.deepEqual(rt.session.roles, ['operations-editor', 'risk-manager']);
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

test('RT-04: a command is offered only when screen capability and role permission both allow it', () => {
  const run = rtContext(['permissionsFor', 'canOpen', 'may', 'currentRecord', 'commandState'], "const state={view:'workspace',detached:{},connection:'online',support:false};");
  const visible = id => run(`(() => { const def=metadata[${JSON.stringify(id)}], s={life:'ready',selected:new Set(),rows:[{},{}],dirty:false};
    return def.commands.filter(k => commandState(k,{key:def.id+':x'},def,s).visible).join(' '); })()`);
  assert.equal(visible('orders'), 'New Edit Delete Refresh Filter Search GroupBy Excel Printer Detach');
  assert.equal(visible('risks'), 'New Edit Refresh Filter Search GroupBy Excel Printer Detach', 'risk-manager cannot delete');
  assert.equal(visible('customers'), 'Previous Next New Save Delete Refresh Detach');
  assert.equal(visible('inventory'), 'Previous Next Save Refresh Excel Detach');
  assert.equal(visible('associations'), 'Save Refresh Detach');
  assert.equal(visible('repricing'), 'Run Detach');
  assert.equal(run("may(metadata.associations,'insert')"), true);
  assert.equal(run("may(metadata.associations,'delete')"), false, 'capability alone is not enough');
  assert.equal(run("may(metadata.customers,'export')"), false, 'permission alone is not enough');
  assert.equal(run("source.roles.every(r => r.id.startsWith('risk') ? !('sales' in r.permissions) : true)"), true, 'sales is not granted to risk roles');
  assert.equal(run("(() => { const def=metadata.orders, s={life:'ready',selected:new Set(),rows:[],dirty:false,unknown:{}}; return ['New','Edit','Delete'].every(k => commandState(k,{key:'k'},def,s).disabled) && !commandState('Refresh',{key:'k'},def,s).disabled; })()"), true, 'unknown outcome blocks New/Edit/Delete');
  assert.equal(run("(() => { const def=metadata.customers, s={life:'ready',selected:new Set(),rows:[{},{}],dirty:true,withdrawn:{}}; return commandState('Save',{key:'k'},def,s).disabled; })()"), true, 'Save is unavailable under a withdrawn definition');
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
test('Cross-prototype: applications, navigation, screens, commands and capabilities agree', () => {
  const granted = o => Object.keys(o || {}).filter(k => o[k]).sort();
  assert.equal(rt.metadataVersion, initial.releases.find(r => r.status === 'Published').label);
  assert.deepEqual(rt.applications.map(a => [a.id, a.name, a.description, a.defaultScreen, a.allowPersonalMenus]),
    initial.applications.map(a => [a.id, a.name, a.description, a.defaultScreen, a.options.allowPersonalMenus]));
  for (const app of rt.applications) {
    const shape = groups => groups.map(g => [g.id, g.label, g.items.map(i => [i.id, i.label, i.screenId, i.icon])]);
    assert.deepEqual(shape(app.nav), shape(initial.navigation[app.id]), app.id + ' navigation');
  }
  assert.deepEqual(Object.keys(rt.screenDefinitions), initial.screens.map(s => s.id));
  for (const def of Object.values(rt.screenDefinitions)) {
    const s = initial.screens.find(x => x.id === def.id);
    assert.deepEqual([def.type, def.app, def.caption, def.description, def.autoRefresh || 0], [s.type, s.appId, s.caption, s.description, s.autoRefresh], def.id + ' identity');
    assert.deepEqual(granted(def.capabilities), granted(s.capabilities), def.id + ' capabilities');
    assert.deepEqual(def.commands, s.commands.map(c => c.key), def.id + ' commands');
  }
  assert.deepEqual(rt.roles.map(r => r.id), rt.session.roles);
  for (const role of rt.roles) {
    const studioRole = initial.roles.find(r => r.id === role.id);
    for (const screen of new Set([...Object.keys(role.permissions), ...Object.keys(studioRole.permissions)]))
      assert.deepEqual(granted(role.permissions[screen]), granted(studioRole.permissions[screen]), role.id + ' on ' + screen);
  }
});

test('Cross-prototype: fields, criteria, value lists and sample rows agree', () => {
  const column = f => !['label', 'action', 'subscreen'].includes(f.type);
  for (const def of Object.values(rt.screenDefinitions)) {
    const s = initial.screens.find(x => x.id === def.id);
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
  const staticLists = Object.fromEntries(initial.valueLists.filter(v => v.mode === 'static').map(v => [v.id, v.values]));
  assert.deepEqual(rt.valueLists, staticLists);
  assert.deepEqual(Object.fromEntries(Object.entries(rt.lookups).map(([id, l]) => [id, [l.dataSource, l.keyField, l.displayField]])),
    Object.fromEntries(initial.valueLists.filter(v => v.mode === 'dataClass').map(v => [v.id, [v.dataClassId, v.keyField, v.displayField]])));
  assert.deepEqual(Object.keys(rt.dataSources).sort(), initial.dataClasses.filter(d => d.kind !== 'action').map(d => d.id).sort());
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
