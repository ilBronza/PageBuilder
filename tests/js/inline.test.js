import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {interpolate, validateInline, node, validate} from '../../resources/js/core.js';
import {render} from '../../resources/js/render.js';
const catalog=JSON.parse(await readFile(new URL('../../resources/schema/catalog.json',import.meta.url)));
const styles=JSON.parse(await readFile(new URL('../../resources/schema/styles.json',import.meta.url)));
test('inline variables preserve zero, escape values and do not recursively interpolate',()=>{
  assert.equal(interpolate('{{ a }} / {{ b }} / {{ c }}', {a:0,b:false,c:'{{ a }}'}),'0 / false / {{ a }}');
  const section=node('section',catalog);
  section.children[0].children[0].children.push(node('text',catalog,{text:'Ciao {{ order.name }}'}));
  const doc={version:1,kind:'page',children:[section]};
  const html=render(doc,catalog,styles,{mode:'template',values:{'order.name':'<script>alert(1)</script>'}});
  assert.ok(html.includes('Ciao &lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(render(doc,catalog,styles).includes('{{ order.name }}'));
  assert.throws(()=>validate(doc,catalog,styles,{mode:'template',sources:{}}));
});
test('only declared scalar variables may be inserted into text',()=>{
  assert.throws(()=>validateInline('{{ x }}',{}));
  assert.throws(()=>validateInline('{{ x }}',{x:{type:'text',cardinality:'many'}}));
  assert.throws(()=>validateInline('{{ eval() }}'));
  validateInline('{{ x }}',{x:{type:'number',cardinality:'one'}});
});
