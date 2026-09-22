'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createRuntime,call}=require('./runtime');
const {clone}=require('./sheets');

const dataDir=process.env.VV_DATA_DIR||path.resolve(__dirname,'../data');
const passwords={admin:process.env.VV_ADMIN_PASSWORD,viewer:process.env.VV_VIEWER_PASSWORD,kasse:process.env.VV_KASSE_PASSWORD};
const secret=process.env.VV_SESSION_SECRET||'';
if(Object.values(passwords).some(p=>!p||p.length<12)||secret.length<32){
  console.error('Bitte VV_ADMIN_PASSWORD, VV_VIEWER_PASSWORD, VV_KASSE_PASSWORD (je >=12 Zeichen) und VV_SESSION_SECRET (>=32 Zeichen) in .env hinterlegen.');
  process.exit(1);
}
const runtime=createRuntime(path.join(dataDir,'database.json'),passwords);
const staticRoot=path.resolve(__dirname,'../public');
const failedLogins=new Map();
const maxPayload=1024*1024;
const sign=s=>crypto.createHmac('sha256',secret).update(s).digest('base64url');
const hash=s=>crypto.createHash('sha256').update(secret+'|'+s).digest('hex');
function currentPassword(role){const key={admin:'APP_PASSWORD',viewer:'VIEWER_PASSWORD',kasse:'KASSE_PASSWORD'}[role];return runtime.store.state.properties[key]||'';}
function makeSession(role){const body=Buffer.from(JSON.stringify({role,exp:Date.now()+24*3600*1000,pw:hash(currentPassword(role))})).toString('base64url');return body+'.'+sign(body);}
function cookieRole(req){
  const m=(req.headers.cookie||'').match(/(?:^|;\s*)vv_session=([^;]+)/);if(!m)return null;
  const [body,signature,...extra]=m[1].split('.');if(!body||!signature||extra.length)return null;
  const good=Buffer.from(sign(body));const given=Buffer.from(signature);
  if(good.length!==given.length||!crypto.timingSafeEqual(good,given))return null;
  try{const p=JSON.parse(Buffer.from(body,'base64url').toString());return p.exp>Date.now()&&p.pw===hash(currentPassword(p.role))?p.role:null;}catch{return null;}
}
function cookieHeader(req,value){const secure=(process.env.VV_COOKIE_SECURE||'true')!=='false' ? '; Secure':'';return `vv_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value?86400:0}${secure}`;}
function security(res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function requestBody(req){
  if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw Object.assign(new Error('JSON erwartet'),{status:415});
  let len=0,chunks=[];
  for await (const chunk of req){len+=chunk.length;if(len>maxPayload)throw Object.assign(new Error('Anfrage zu groß'),{status:413});chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Ungültiges JSON'),{status:400});}
}
function originAllowed(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
function serveStatic(url,res){
  const pathname=new URL(url,'http://localhost').pathname;
  const file=pathname==='/'?'/index.html':pathname;
  const target=path.resolve(staticRoot,'.'+decodeURIComponent(file));
  if(!target.startsWith(staticRoot+path.sep))return json(res,403,{error:'Nicht erlaubt'});
  let stat;try{stat=fs.statSync(target);if(!stat.isFile())throw new Error();}catch{return json(res,404,{error:'Nicht gefunden'});}
  const ext=path.extname(target);
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json'}[ext]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':file==='/sw.js'?'no-cache':'public, max-age=300'});
  fs.createReadStream(target).pipe(res);
}
function loginBlocked(ip){const entry=failedLogins.get(ip);if(!entry)return false;if(Date.now()-entry.since>15*60*1000){failedLogins.delete(ip);return false;}return entry.count>=10;}
function recordFailure(ip){const now=Date.now();const old=failedLogins.get(ip);failedLogins.set(ip,old&&now-old.since<15*60*1000?{...old,count:old.count+1}:{since:now,count:1});}
let active=Promise.resolve();
function serialize(action){const next=active.then(action,action);active=next.catch(()=>{});return next;}
const handler=http.createServer((req,res)=>{
  security(res);
  const route=new URL(req.url||'/','http://localhost').pathname;
  if(route==='/healthz'&&req.method==='GET')return json(res,200,{status:'ok'});
  if(!route.startsWith('/api/')){
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Methode nicht erlaubt'});
    return serveStatic(req.url,res);
  }
  if(req.method!=='POST')return json(res,405,{error:'Methode nicht erlaubt'});
  if(!originAllowed(req))return json(res,403,{error:'Ungültiger Origin'});
  serialize(async()=>{
    try{
      if(route==='/api/logout'){res.setHeader('Set-Cookie',cookieHeader(req,''));return json(res,200,{ok:true});}
      const body=await requestBody(req);
      if(route==='/api/login'){
        const ip=req.socket.remoteAddress||'unknown';
        if(loginBlocked(ip))return json(res,429,{error:'Zu viele fehlgeschlagene Anmeldungen. Bitte später erneut versuchen.'});
        const password=typeof body.password==='string'?body.password:'';
        const result=runtime.context.loginUser(password);
        if(!result?.success){recordFailure(ip);return json(res,401,{success:false,message:'Anmeldung fehlgeschlagen.'});}
        failedLogins.delete(ip);res.setHeader('Set-Cookie',cookieHeader(req,makeSession(result.role)));
        return json(res,200,{success:true,role:result.role,message:'Anmeldung erfolgreich.'});
      }
      if(route!=='/api/rpc')return json(res,404,{error:'Unbekannte API'});
      const role=cookieRole(req);
      if(!role)return json(res,401,{error:'Sitzung abgelaufen. Bitte erneut anmelden.'});
      if(!body||typeof body.name!=='string'||!Array.isArray(body.args))return json(res,400,{error:'Ungültige Anfrage'});
      const before=clone(runtime.store.state);
      const dirty=runtime.store.dirty;
      try{return json(res,200,{ok:true,result:call(runtime,body.name,body.args,role)});}
      catch(e){runtime.store.state=before;runtime.store.dirty=dirty;throw e;}
    }catch(e){console.error('API:',e?.message||e);return json(res,e?.status&&Number.isInteger(e.status)?e.status:500,{error:e?.status?e.message:'Interner Serverfehler: '+e.message});}
  });
});
const port=Number(process.env.PORT||3000);
handler.listen(port,'0.0.0.0',()=>console.log('VV-Cockpit bereit auf Port '+port));
