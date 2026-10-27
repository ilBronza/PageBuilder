import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Engine,node,clone,validate,safeUrl} from '../../resources/js/core.js';
import {parseDesign} from '../../resources/js/design.js';
import {render} from '../../resources/js/render.js';
const catalog=JSON.parse(await readFile(new URL('../../resources/schema/catalog.json',import.meta.url)));
const styles=JSON.parse(await readFile(new URL('../../resources/schema/styles.json',import.meta.url)));
function fixture(){const section=node('section',catalog),text=node('text',catalog);section.children[0].children[0].children.push(text);return {document:{version:1,kind:'page',children:[section]},text,section};}
test('CSS, metadata and rich text reject executable values before any import mutation',()=>{
  const {document,text}=fixture(),engine=new Engine(document,catalog,styles);
  for(const patch of [
    {design:{paddingTop:'10px;position:fixed'}},{design:{fontFamily:'</style><script>alert(1)</script>'}},{design:{backgroundImage:'javascript:evil()'}},{design:{backgroundImage:'/x</style>.png'}},
    {meta:{classes:'ok" onclick="evil()'}},{meta:{anchor:'x x'}},{responsive:{mobile:{hidden:'true'}}},
    {props:{...text.props,richText:[{type:'paragraph',children:[{text:'ok',href:'javascript:evil()'}]}]}},
    {props:{...text.props,richText:[{type:'script',children:[]}]}},
  ]){const next=clone(document);Object.assign(next.children[0].children[0].children[0].children[0],patch);assert.throws(()=>engine.import(next));assert.deepEqual(engine.document,document);}
  assert.deepEqual(parseDesign('padding-top: var(--pb-space-small);border-style: dashed;',safeUrl),{paddingTop:'var(--pb-space-small)',borderStyle:'dashed'});
  assert.throws(()=>parseDesign('position:fixed;',safeUrl));
});
test('copying styles preserves target identity; duplication clears anchors; disabling is reversible',()=>{
  const {document,text,section}=fixture();text.meta={name:'Note',anchor:'note',classes:'custom-note'};text.design={paddingLeft:'12px'};text.responsive={mobile:{design:{paddingLeft:'0'},hidden:true}};
  const target=node('heading',catalog);target.meta={anchor:'title'};section.children[0].children[0].children.push(target);
  const engine=new Engine(document,catalog,styles);engine.pasteStyles(target.id,text);
  assert.equal(engine.document.children[0].children[0].children[0].children[1].meta.anchor,'title');
  const id=engine.duplicate(text.id),duplicate=engine.document.children[0].children[0].children[0].children.find(n=>n.id===id);
  assert.equal(duplicate.meta.anchor,undefined);assert.equal(duplicate.meta.name,'Note');
  engine.update(section.id,'meta','disabled',true);assert.equal(render(engine.document,catalog,styles),'<div class="pb-document"></div>');
  engine.undo();assert.match(render(engine.document,catalog,styles),/custom-note/);
});
test('rich variables are validated, escaped once and remain in serialized templates',()=>{
  const {document,text}=fixture();text.props.richText=[{type:'paragraph',children:[{text:'Cliente: ',marks:['bold']},{text:'{{ client.name }}',marks:['italic'],href:'/cliente'}]},{type:'bullet',children:[{text:'Un dettaglio'}]}];
  const sources={'client.name':{type:'text',cardinality:'one'}};
  validate(document,catalog,styles,{mode:'template',sources});
  const html=render(document,catalog,styles,{mode:'template',values:{'client.name':'<img onerror="evil()">'}});
  assert.match(html,/<strong>Cliente: <\/strong>/);assert.match(html,/<ul><li>Un dettaglio<\/li><\/ul>/);assert.match(html,/&lt;img/);assert.ok(!html.includes('<img'));
  assert.throws(()=>validate(document,catalog,styles,{mode:'template',sources:{}}));
  assert.ok(JSON.stringify(document).includes('{{ client.name }}'));
});
test('changing base grid retains responsive data and removes only incompatible column widths',()=>{
  const {document,section}=fixture(),engine=new Engine(document,catalog,styles),id=section.children[0].id;
  engine.responsive(id,'mobile',null,'columns',['1-1']);engine.responsive(id,'mobile','design','paddingLeft','2px');
  engine.grid(id,['1-2','1-2']);const row=engine.document.children[0].children[0];
  assert.equal(row.responsive.mobile.columns,undefined);assert.equal(row.responsive.mobile.design.paddingLeft,'2px');
  engine.undo();assert.deepEqual(engine.document.children[0].children[0].responsive.mobile.columns,['1-1']);
});
