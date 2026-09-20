import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../resources/js/core.js';
import {render} from '../resources/js/render.js';
import {staticDocument,templateDocument,records,sources} from './seed.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'playground/.data');
await mkdir(data,{recursive:true});
const catalog=JSON.parse(await readFile(path.join(root,'resources/schema/catalog.json')));
const styles=JSON.parse(await readFile(path.join(root,'resources/schema/styles.json')));
const seed={page:staticDocument,template:templateDocument,'area-a':records.a.document,'area-b':records.b.document};
const files=new Set(Object.keys(seed));
async function load(key){try{return JSON.parse(await readFile(path.join(data,`${key}.json`),'utf8'));}catch(err){if(err.code==='ENOENT')return{revision:0,document:seed[key]};throw err;}}
async function body(req){let chunks='',size=0;for await(const chunk of req){size+=chunk.length;if(size>1100000)throw new Error('Documento troppo grande');chunks+=chunk;}return JSON.parse(chunks);}
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
let queue=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'&&!Buffer.isBuffer(value)?JSON.stringify(value):value);};
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`)return send(403,{message:'Origine non consentita'});
  const host=req.headers.host?.split(':')[0];if(!['127.0.0.1','localhost'].includes(host))return send(403,{message:'Host non consentito'});
  if(url.pathname.startsWith('/api/documents/')){
   const key=url.pathname.slice(15);if(!files.has(key))return send(404,{message:'Documento non trovato'});
   if(req.method==='GET')return send(200,await load(key));
   if(req.method!=='PUT')return send(405,{message:'Metodo non supportato'});
   const input=await body(req);validate(input.document,catalog,styles,{mode:key==='template'?'template':'static',kind:key.startsWith('area-')?'fragment':'page',sources:key==='template'?sources:null,areas:key==='template'?['description']:null});
   const job=queue.then(async()=>{const previous=await load(key);if(previous.revision!==input.revision)return send(409,{message:'Documento modificato in un’altra finestra. Riaprilo prima di salvare.'});const next={revision:previous.revision+1,document:input.document};const temp=path.join(data,`${key}.tmp`);await writeFile(temp,JSON.stringify(next,null,2));await rename(temp,path.join(data,`${key}.json`));send(200,next);});queue=job.catch(()=>{});await job;return;
  }
  if(url.pathname==='/public'){
   const record=records[url.searchParams.get('record')??'a'];if(!record)return send(404,'Record non trovato','text/plain');
   const useTemplate=url.searchParams.get('mode')==='template';const document=(await load(useTemplate?'template':'page')).document;
   const area=(await load(`area-${url.searchParams.get('record')??'a'}`)).document;
   const html=render(document,catalog,styles,{mode:useTemplate?'template':'static',values:record.values,areas:{description:area}});
   return send(200,`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PageBuilder · pagina salvata</title><link rel="stylesheet" href="/resources/vendor/uikit.min.css"><link rel="stylesheet" href="/resources/css/content.css"></head><body>${html}</body></html>`,'text/html');
  }
  if(req.method!=='GET')return send(405,{message:'Metodo non supportato'});
  const pathname=url.pathname==='/'?'/playground/index.html':decodeURIComponent(url.pathname);
  const allowed=pathname.startsWith('/resources/')||['/playground/index.html','/playground/app.js','/playground/seed.js','/playground/composition.svg'].includes(pathname);
  const file=path.resolve(root,'.'+pathname);if(!allowed||!file.startsWith(root+path.sep)||pathname.includes('/.'))return send(404,'Non trovato','text/plain');
  return send(200,await readFile(file),types[path.extname(file)]??'text/plain');
 }catch(err){if(!res.headersSent)send(err.code==='ENOENT'?404:422,{message:err.message});else res.end();}
});
server.listen(Number(process.env.PORT??4173),'127.0.0.1',()=>console.log(`PageBuilder: http://127.0.0.1:${server.address().port}`));
