import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Engine, clone, validate, safeUrl, locate, node} from '../../resources/js/core.js';
import {render} from '../../resources/js/render.js';
import {staticDocument,templateDocument,sources,records} from '../../playground/seed.js';
const catalog=JSON.parse(await readFile(new URL('../../resources/schema/catalog.json',import.meta.url)));
const styles=JSON.parse(await readFile(new URL('../../resources/schema/styles.json',import.meta.url)));
const engine=()=>new Engine(staticDocument,catalog,styles);
const allIds=doc=>{const ids=[];function walk(n){if(n.id)ids.push(n.id);n.children?.forEach(walk);}walk(doc);return ids;};
test('layout shrink preserves order and IDs; undo/redo restores columns and styles',()=>{
 const e=engine();const row=locate(e.document,'hero_row').node;const ids=row.children.flatMap(c=>c.children.map(n=>n.id));
 e.grid('hero_row',['1-1']);assert.deepEqual(locate(e.document,'hero_row').node.children[0].children.map(n=>n.id),ids);
 assert.equal(e.dirty,true);e.undo();assert.deepEqual(e.document,staticDocument);assert.equal(e.dirty,false);e.redo();assert.equal(locate(e.document,'hero_row').node.children.length,1);
});
test('duplication regenerates all IDs, moves preserve IDs, failed edits are atomic',()=>{
 const e=engine();const copy=e.duplicate('hero');const ids=allIds(e.document);assert.equal(new Set(ids).size,ids.length);assert.notEqual(copy,'hero');
 e.move('headline','details_row_c1',0);assert.equal(locate(e.document,'headline').parent.id,'details_row_c1');
 const before=clone(e.document);assert.throws(()=>e.move('hero','hero_row_c0',0));assert.deepEqual(e.document,before);
 assert.throws(()=>e.remove('hero_row_c0'));assert.deepEqual(e.document,before);
 e.undo();assert.equal(locate(e.document,'headline').parent.id,'hero_row_c0');
});
test('dirty checkpoint uses saved snapshot during asynchronous save',()=>{
 const e=engine();e.update('headline','props','text','First');const snapshot=clone(e.document);e.update('headline','props','text','Second');e.markSaved(snapshot);assert.equal(e.dirty,true);e.undo();assert.equal(e.dirty,false);
});
test('reopen a serialized document preserves content and bindings without preview values',()=>{
 const e=new Engine(templateDocument,catalog,styles,{mode:'template',sources,areas:['description']});
 assert.deepEqual(JSON.parse(JSON.stringify(e.document)),templateDocument);
 const html=render(e.document,catalog,styles,{mode:'template',values:records.a.values,areas:{description:records.a.document}});
 assert.match(html,/Poltrona Arco/);assert.equal(JSON.stringify(e.document).includes('Poltrona Arco'),false);
 assert.equal(e.dirty,false);
});
test('escaping and URL policy block executable content',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hi','//evil.test','https:\\evil.test','https://a/\n'])assert.equal(safeUrl(url),'');
 const e=engine();e.update('headline','props','text','<script>&"\'');const html=render(e.document,catalog,styles);assert.match(html,/&lt;script&gt;&amp;&quot;&#039;/);assert.doesNotMatch(html,/<script>/);
 assert.throws(()=>e.update('cta','props','href','javascript:alert(1)'));
});
test('schema rejects unknown keys, duplicate IDs, nested sections, bindings in static mode, versions',()=>{
 const changes=[d=>d.version=2,d=>d.bad=true,d=>d.children[0].id=d.children[1].id,d=>d.children[0].children[0].children.push(node('section',catalog)),d=>d.children[0].bindings={text:'x'}];
 for(const mutate of changes){const d=clone(staticDocument);mutate(d);assert.throws(()=>validate(d,catalog,styles));}
 assert.throws(()=>validate(templateDocument,catalog,styles));
 assert.throws(()=>validate(templateDocument,catalog,styles,{mode:'template',sources:{},areas:[]}));
});
test('history branches discard redo and reorder is keyboard accessible',()=>{
 const e=engine();e.reorder('details',-1);assert.equal(e.document.children[0].id,'details');e.undo();assert.equal(e.future.length,1);e.update('headline','props','text','new branch');assert.equal(e.future.length,0);
});
