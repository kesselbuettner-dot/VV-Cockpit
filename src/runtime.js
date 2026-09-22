'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {SheetStore,clone}=require('./sheets');

const ALL_SOURCES=fs.readdirSync(path.resolve(__dirname,'../original')).filter(f=>f.endsWith('.gs')).sort();
const DISPATCHER=fs.readFileSync(path.resolve(__dirname,'../original/appServerCall.gs'),'utf8');
const ALLOWED=new Set([...DISPATCHER.matchAll(/case\s+['"]([\w]+)['"]\s*:/g)].map(m=>m[1]));
ALLOWED.add('ffhVerantwortlicheLaden');
ALLOWED.add('ffhVerantwortlicheSpeichern');
const ADMIN_MUTATIONS=new Set([
  'ablaufplanSpeichern','dienstplanungMehrfachAendern','dienstplanungSpeichern','dienstplanungTagesSpeichern',
  'helferHinzufuegen','helferSpeichern','helferLoeschen','kalenderMailVorlagenSpeichern','kalenderVersand',
  'kasseLoeschen','kasseSpeichern','kassenAblosungAnfordern','kassenArtikelNachschubGeliefert','kassenArtikelReihenfolgeSpeichern',
  'kassenArtikelStatusSetzen','mapsStationPunktLoeschen','mapsStationPunktSpeichern','saveSettings',
  'stationSpeichern','stationschichtenSpeichern','stationschichtenDienstplanErzeugen',
  'verkaufArtikelLoeschen','verkaufArtikelSpeichern','artikelSpeichern',
  'wunschplanPersistiertAendern','wunschplanPersistiertMehrfachAendern','wunschplanTagesSpeichern',
  'ffhVerantwortlicheSpeichern'
]);
const KASSE_MUTATIONS=new Set(['kassenVerkaufSpeichern']);

function gasFormatDate(value,zone,format){
  const d=new Date(value);if(!Number.isFinite(d.valueOf()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone||'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));
  const p=parts;const mapping={yyyy:p.year,MM:p.month,dd:p.day,HH:p.hour,mm:p.minute,ss:p.second};
  return format.replace(/'[^']*'|yyyy|MM|dd|HH|mm|ss/g,t=>t.startsWith("'")?t.slice(1,-1):mapping[t]);
}
function bootRuntime(store,initialPasswords){
  if(Object.keys(store.state.properties).length===0){
    store.state.properties={APP_PASSWORD:initialPasswords.admin,VIEWER_PASSWORD:initialPasswords.viewer,KASSE_PASSWORD:initialPasswords.kasse};store.mark();store.save();
  }
  const props={getProperty:key=>store.state.properties[key]??null,setProperty:(key,val)=>{store.state.properties[key]=String(val);store.mark();return props;}};
  const sheetApi={getActiveSpreadsheet:()=>store.spreadsheet(),getActive:()=>store.spreadsheet(),flush:()=>{},newDataValidation:()=>({requireValueInRange(){return this;},setAllowInvalid(){return this;},build(){return {};}})};
  const unsupported=name=>()=>{throw new Error(`${name} ist im Docker-Modus noch nicht angebunden.`);};
  const sandbox={
    console,Date,JSON,Math,Number,String,Boolean,Array,Object,Map,Set,RegExp,Error,TypeError,Promise,Intl,
    SpreadsheetApp:sheetApi,
    PropertiesService:{getScriptProperties:()=>props},
    Session:{getScriptTimeZone:()=>process.env.TZ||'Europe/Berlin',getActiveUser:()=>({getEmail:()=>''})},
    Utilities:{formatDate:gasFormatDate,getUuid:()=>crypto.randomUUID(),newBlob:unsupported('Dateianhänge')},
    LockService:{getScriptLock:()=>({waitLock(){return this;},releaseLock(){}})},
    CalendarApp:{getAllCalendars:()=>[],getCalendarById:()=>null},
    DriveApp:{getFileById:unsupported('Google Drive')},
    DocumentApp:{create:unsupported('PDF-Erstellung über Google Docs'),ParagraphHeading:{HEADING1:'HEADING1'}},
    MailApp:{sendEmail:unsupported('E-Mail-Versand')},
    MimeType:{PDF:'application/pdf'},
    Logger:{log:(...args)=>console.log(...args)},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutputFromFile:unsupported('HtmlService')}
  };
  const context=vm.createContext(sandbox,{name:'vv-cockpit-legacy'});
  for(const file of ALL_SOURCES){const src=fs.readFileSync(path.resolve(__dirname,'../original',file),'utf8');new vm.Script(src,{filename:file}).runInContext(context,{timeout:5000});}
  // Initialize empty named sheets using original project's own setup logic.
  if(Object.keys(store.state.sheets).length===0) {vm.runInContext('setup()',context,{timeout:5000});store.save();}
  return {context,store};
}
function call(runtime,name,args,role){
  if(!ALLOWED.has(name))throw Object.assign(new Error('Unbekannte Serverfunktion'),{status:400});
  if(name==='loginUser')throw Object.assign(new Error('Login nur über /api/login'),{status:400});
  if(!role)throw Object.assign(new Error('Bitte anmelden'),{status:401});
  if(ADMIN_MUTATIONS.has(name)&&role!=='admin')throw Object.assign(new Error('Administratorberechtigung erforderlich'),{status:403});
  if(KASSE_MUTATIONS.has(name)&&role!=='admin'&&role!=='kasse')throw Object.assign(new Error('Keine Kassenberechtigung'),{status:403});
  if(role==='kasse' && !name.startsWith('kasse') && !['appStartLaden','kalenderStatus','verkaufAllergene','verkaufZusatzstoffe'].includes(name))throw Object.assign(new Error('Keine Berechtigung'),{status:403});
  if(!Array.isArray(args)||args.length>12)throw Object.assign(new Error('Ungültige Parameter'),{status:400});
  // Existing functions taking passwords continue checking them. The transport session is independently authenticated.
  const fn=runtime.context[name];if(typeof fn!=='function')throw new Error('Serverfunktion nicht implementiert: '+name);
  const result=fn(...args);
  runtime.store.save();
  return clone(result===undefined?null:result);
}
function createRuntime(filename,initialPasswords){return bootRuntime(new SheetStore(filename),initialPasswords);}
module.exports={createRuntime,call,ALLOWED,gasFormatDate};
