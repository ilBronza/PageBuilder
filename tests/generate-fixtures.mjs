import {readFile,writeFile} from 'node:fs/promises';
import {node,clone} from '../resources/js/core.js';
import {staticDocument,templateDocument,records,sources} from '../playground/seed.js';
const catalog=JSON.parse(await readFile(new URL('../resources/schema/catalog.json',import.meta.url)));
const styles=JSON.parse(await readFile(new URL('../resources/schema/styles.json',import.meta.url)));
const fixtures=[{name:'static',document:staticDocument,mode:'static',valid:true},{name:'template-a',document:templateDocument,mode:'template',values:records.a.values,areas:{description:records.a.document},valid:true},{name:'template-b',document:templateDocument,mode:'template',values:records.b.values,areas:{description:records.b.document},valid:true},{name:'missing-values',document:templateDocument,mode:'template',values:{},valid:true},{name:'fragment',document:records.a.document,mode:'area',valid:true}];
const everything=clone(staticDocument);const col=everything.children[1].children[0].children[1];col.children=[];
for(const [type,def] of Object.entries(catalog))if(!def.children&&!def.templateOnly){const el=node(type,catalog);el.id=`all-${type}`;if(el.props.text)el.props.text='<img onerror="evil()"> & \'escaped\'';col.children.push(el);}
fixtures.push({name:'all-elements-escaping',document:everything,mode:'static',valid:true});
for (const [key,tokens] of Object.entries(styles))for(const token of tokens){const doc=clone(everything);const nodes=[];function visit(n){if(n.type&&catalog[n.type].styles.includes(key))nodes.push(n);n.children?.forEach(visit);}visit(doc);for(const n of nodes)n.styles[key]=token;fixtures.push({name:`style-${key}-${token}`,document:doc,mode:'static',valid:true});}
for(const [name,mutate] of Object.entries({version:d=>d.version=9,duplicate:d=>d.children[1].id=d.children[0].id,url:d=>d.children[0].children[0].children[0].children[3].props.href='javascript:evil()',unknown:d=>d.children[0].props.arbitrary=true,invalidStyle:d=>d.children[0].styles.padding='url(javascript:evil)',shape:d=>d.children[0].children[0].props.layout=['1-1'],nested:d=>d.children[0].children.push(clone(d.children[1]))})) {const doc=clone(staticDocument);mutate(doc);fixtures.push({name,document:doc,mode:'static',valid:false});}
await writeFile(new URL('fixtures/parity.json',import.meta.url),JSON.stringify(fixtures,null,2));
