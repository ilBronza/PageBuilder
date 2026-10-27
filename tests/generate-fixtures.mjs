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
for (const variant of catalog.button.props.variant.values) {
  const doc=clone(everything);
  doc.children[1].children[0].children[1].children.find(n=>n.type==='button').props.variant=variant;
  fixtures.push({name:`button-${variant}`,document:doc,mode:'static',valid:true});
}
for(const [name,mutate] of Object.entries({version:d=>d.version=9,duplicate:d=>d.children[1].id=d.children[0].id,url:d=>d.children[0].children[0].children[0].children[3].props.href='javascript:evil()',unknown:d=>d.children[0].props.arbitrary=true,invalidStyle:d=>d.children[0].styles.padding='url(javascript:evil)',shape:d=>d.children[0].children[0].props.layout=['1-1'],nested:d=>d.children[0].children.push(clone(d.children[1]))})) {const doc=clone(staticDocument);mutate(doc);fixtures.push({name,document:doc,mode:'static',valid:false});}
const advanced=clone(everything), section=advanced.children[0], row=section.children[0];
section.meta={name:'Intestazione',anchor:'intro-page',classes:'project-theme'};
section.design={paddingTop:'var(--pb-space-small)',backgroundImage:'/images/photo.jpg',backgroundSize:'cover',borderStyle:'solid',borderColor:'#123456',fontFamily:'var(--pb-font-family)'};
section.responsive={tablet:{styles:{padding:'small',background:'primary'},design:{paddingTop:'20px'},hidden:true},mobile:{styles:{align:'center'},design:{paddingTop:'0'},hidden:false}};
row.responsive={tablet:{columns:['1-3','2-3']},mobile:{columns:['1-1','1-1']}};
row.children[0].children.find(n=>n.type==='text').props.richText=[{type:'paragraph',children:[{text:'Ciao ',marks:['bold']},{text:'{{ product.name }}',marks:['bold','italic'],href:'/cliente'}]},{type:'bullet',children:[{text:'Primo'}]},{type:'bullet',children:[{text:'Secondo'}]},{type:'ordered',children:[{text:'Terzo'}]}];
const advancedTable=advanced.children[1].children[0].children[1].children.find(n=>n.type==='table');advancedTable.props.rows=[['{{ product.name }}','0']];
fixtures.push({name:'advanced-responsive-rich-and-table',document:advanced,mode:'template',values:{'product.name':'<script>unsafe</script>'},valid:true});
const disabled=clone(advanced);disabled.children[0].meta.disabled=true;fixtures.push({name:'disabled-section',document:disabled,mode:'template',valid:true});
for(const [name,mutate] of Object.entries({cssInjection:d=>d.children[0].design.paddingTop='0;position:fixed',cssUrl:d=>d.children[0].design.backgroundImage='javascript:evil()',cssClosingTag:d=>d.children[0].design.backgroundImage='/</style><script>.jpg',htmlClass:d=>d.children[0].meta.classes='x" onclick="alert(1)',anchorDuplicate:d=>d.children[1].meta={anchor:'intro-page'},invalidResponsive:d=>d.children[0].responsive.mobile.hidden='true',responsiveColumnCount:d=>d.children[0].children[0].responsive.mobile.columns=['1-1'],invalidRichLink:d=>d.children[0].children[0].children[0].children.find(n=>n.type==='text').props.richText[0].children[1].href='javascript:evil()',tableShape:d=>d.children[1].children[0].children[1].children.find(n=>n.type==='table').props.rows=[['only one']]})) {const document=clone(advanced);mutate(document);fixtures.push({name,document,mode:'template',valid:false});}
await writeFile(new URL('fixtures/parity.json',import.meta.url),JSON.stringify(fixtures,null,2));
