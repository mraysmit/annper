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
    'auditTarget','appendAudit','checkpoint','startNextDraft','selectVersion','comparison',
    'recordApproval','rollbackTo','publish','validationIssues','fixtureRows','previewValue','screenCanvas'];
  const bootstrap = admin.slice(admin.indexOf('    const configKeys='), admin.indexOf('    const modules=['));
  vm.runInContext(`const initial=${JSON.stringify(initial)},model=structuredClone(initial),fixtures=${JSON.stringify(fixtures)};
    const state={appId:'ops',selectedScreen:'orders',selectedField:'amount',selectedDataClass:'orders',
      selectedRole:'operations-editor',reviewActor:'Jordan Lee',viewVersion:null,validated:false,
      validation:null,approvals:{},history:[],future:[],dirty:0,publicationNote:''};
    ${admin.split('\n').find(line=>line.startsWith('    const esc='))}
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
console.log(`${passed} contract regressions passed; both HTML scripts and JSON parse.`);
