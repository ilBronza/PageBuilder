import test from 'node:test';
import assert from 'node:assert/strict';
import {httpAdapter} from '../../resources/js/adapters.js';
test('HTTP adapter carries revision, identity and CSRF; failures do not advance its checkpoint',async()=>{
 const original=globalThis.fetch; const requests=[];let fail=false;
 globalThis.fetch=async(url,request)=>{requests.push({url,...request});if(fail)return new Response(JSON.stringify({message:'Conflict'}),{status:409});return new Response(JSON.stringify({id:7,revision:request.method==='PUT'?2:1,document:{version:1,kind:'page',children:[]}}));};
 try{const adapter=httpAdapter({url:'/content',csrfToken:'test-token'});const doc=await adapter.load();fail=true;await assert.rejects(()=>adapter.save(doc),/modificato altrove/);fail=false;await adapter.save(doc);const saved=JSON.parse(requests.at(-1).body);assert.equal(saved.id,7);assert.equal(saved.revision,1);assert.equal(requests.at(-1).headers['X-CSRF-TOKEN'],'test-token');}finally{globalThis.fetch=original;}
});
test('template-backed areas cannot open a competing local layout',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({id:4,mode:'template',document:null}));
 try{await assert.rejects(()=>httpAdapter({url:'/content'}).load(),/template condiviso/);}finally{globalThis.fetch=original;}
});
