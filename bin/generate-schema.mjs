import {readFile,writeFile} from 'node:fs/promises';
import {layouts} from '../resources/js/core.js';
const catalog=JSON.parse(await readFile(new URL('../resources/schema/catalog.json',import.meta.url)));
const styles=JSON.parse(await readFile(new URL('../resources/schema/styles.json',import.meta.url)));
const props = spec => spec.kind==='enum'?{enum:spec.values}:spec.kind==='layout'?{enum:layouts}:spec.kind==='list'?{type:'array',maxItems:200,items:{type:'string',maxLength:10000}}:spec.kind==='identifier'?{type:'string',pattern:'^[a-zA-Z0-9_-]{1,80}$'}:{type:'string',maxLength:spec.kind==='url'?2048:20000};
const defs={};
for (const [type,def] of Object.entries(catalog)) {
 const properties={id:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,80}$'},type:{const:type},props:{type:'object',additionalProperties:false,properties:Object.fromEntries(Object.entries(def.props).map(([k,v])=>[k,props(v)]))},styles:{type:'object',additionalProperties:false,properties:Object.fromEntries(def.styles.map(k=>[k,{enum:styles[k]}]))},bindings:{type:'object',additionalProperties:false,properties:Object.fromEntries(Object.entries(def.props).filter(([,s])=>s.binding).map(([k])=>[k,{type:'string',pattern:'^[a-zA-Z0-9_.:-]{1,120}$'}]))}};
 if(def.children)properties.children={type:'array',maxItems:500,items:{oneOf:def.children.map(t=>({$ref:`#/$defs/${t}`}))}};
 defs[type]={type:'object',additionalProperties:false,required:['id','type','props','styles','bindings',...(def.children?['children']:[])],properties};
 if(type==='row')defs[type].allOf=layouts.map(layout=>({if:{properties:{props:{required:['layout'],properties:{layout:{const:layout}}}}},then:{properties:{children:{minItems:layout.length,maxItems:layout.length}}}}));
}
const schema={$schema:'https://json-schema.org/draft/2020-12/schema',title:'IlBronza PageBuilder document v1',description:'Also validate mode, source permissions/types, ID uniqueness, total nodes/bytes and row defaults using the package validators.',type:'object',additionalProperties:false,required:['version','kind','children'],properties:{version:{const:1},kind:{enum:['page','fragment']},children:{type:'array',maxItems:500}},allOf:[{if:{properties:{kind:{const:'page'}}},then:{properties:{children:{items:{$ref:'#/$defs/section'}}}},else:{properties:{children:{items:{$ref:'#/$defs/row'}}}}}],$defs:defs};
await writeFile(new URL('../resources/schema/document.schema.json',import.meta.url),JSON.stringify(schema,null,2)+'\n');
