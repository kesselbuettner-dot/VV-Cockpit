'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createRuntime,call,ALLOWED}=require('../src/runtime');

const pw={admin:'TestAdminPasswordLong!',viewer:'TestViewerPasswordLong!',kasse:'TestKassePasswordLong!'};
function instance(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vv-cockpit-'));return {dir,rt:createRuntime(path.join(dir,'db.json'),pw)};}

test('Originalquellen werden geladen, Sheets automatisch angelegt und Anmeldung funktioniert',()=>{
 const {dir,rt}=instance();
 try{
  assert.deepEqual(Object.keys(rt.store.state.sheets),['Helferliste','Dienstplan','Stationen','Einstellungen']);
  assert.equal(rt.context.loginUser(pw.admin).role,'admin');
  assert.equal(rt.context.loginUser('falsch').success,false);
  assert.equal(call(rt,'appStartLaden',[],'viewer').ok,true);
  assert.deepEqual(call(rt,'ffhVerantwortlicheLaden',[pw.admin],'admin'),{});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Helfer anlegen, persistent speichern, erneut lesen, Viewer-Schreibschutz',()=>{
 const {dir,rt}=instance();
 try{
  assert.throws(()=>call(rt,'helferHinzufuegen',[pw.admin,{vorname:'Test',nachname:'Person'}],'viewer'),/Administrator/);
  const add=call(rt,'helferHinzufuegen',[pw.admin,{vorname:'Test',nachname:'Person',teilnahme:'Ja'}],'admin');
  assert.equal(add.success,true);
  assert.equal(call(rt,'helferListeLaden',[pw.admin],'admin')[0].vorname,'Test');
  const fresh=createRuntime(path.join(dir,'db.json'),pw);
  assert.equal(call(fresh,'helferListeLaden',[pw.admin],'admin')[0].nachname,'Person');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Frontend-Serveraufrufe stehen sämtlich in der Backend-Whitelist',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
 const names=[...html.matchAll(/\bserver\(\s*['"]([\w]+)['"]/g)].map(m=>m[1]);
 assert.ok(names.length>40);
 assert.deepEqual([...new Set(names.filter(name=>!ALLOWED.has(name)))],[]);
 assert.doesNotMatch(html,/Diese HTML-Datei muss innerhalb von Google Apps Script ausgeführt werden/);
});

test('Nicht freigegebene oder unauthentifizierte RPC-Funktionen werden abgelehnt',()=>{
 const {dir,rt}=instance();
 try{
  assert.throws(()=>call(rt,'setup',[],'admin'),/Unbekannte Serverfunktion/);
  assert.throws(()=>call(rt,'appStartLaden',[],null),/Bitte anmelden/);
  assert.throws(()=>call(rt,'ffhVerantwortlicheSpeichern',[pw.admin,2,[]],'viewer'),/Administrator/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Stationszeiten und Stationsverantwortliche werden persistent gespeichert',()=>{
 const {dir,rt}=instance();
 try{
  const station=call(rt,'stationSpeichern',[pw.admin,{name:'Teststation',short:'TS',color:'#bb0000',needed:2,tage:[{tag:1,datum:'2026-09-26',von:'14:00',bis:'21:00'}]}],'admin');
  assert.equal(station.ok,true);
  const stations=call(rt,'stationenLaden',[pw.admin],'admin');
  assert.equal(stations.length,1);
  assert.equal(stations[0].name,'Teststation');
  assert.equal(stations[0].tage[0].von,'14:00');
  call(rt,'ffhVerantwortlicheSpeichern',[pw.admin,stations[0].row,['1']],'admin');
  const fresh=createRuntime(path.join(dir,'db.json'),pw);
  assert.deepEqual(call(fresh,'ffhVerantwortlicheLaden',[pw.admin],'admin')[String(stations[0].row)],['1']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Inline-JavaScript der PWA wird ohne Syntaxfehler geparst',()=>{
 const vm=require('node:vm');
 const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 assert.ok(scripts.length>=3);
 for(const [i,script] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(script,{filename:`inline-${i}.js`}));
});
