export const sources = {
  'product.name':{id:'product.name',label:'Nome prodotto',type:'text',cardinality:'one'},
  'product.description':{id:'product.description',label:'Introduzione',type:'text',cardinality:'one'},
  'product.features':{id:'product.features',label:'Caratteristiche',type:'text',cardinality:'many'},
  'filecabinet.material':{id:'filecabinet.material',label:'Scheda tecnica · materiale',type:'text',cardinality:'one'},
};
const n=(id,type,props={},styles={},children)=>({id,type,props,styles,bindings:{},...(children?{children}: {})});
const row=(id,columns,layout)=>n(id,'row',{layout},{gap:'large',vertical:'middle'},columns.map((items,i)=>n(id+'_c'+i,'column',{}, {},items)));
const hero = n('hero','section',{width:'large'},{background:'muted',padding:'large'},[row('hero_row',[
  [n('eyebrow','text',{text:'COLLEZIONE / 2026'},{color:'muted'}),n('headline','heading',{text:'Lo spazio\nper le tue idee.',tag:'h1',size:'medium'}),n('intro','text',{text:'Dai forma a una pagina che parla di te. Componi, sperimenta e trova il giusto equilibrio, un elemento alla volta.'},{color:'muted'}),n('cta','button',{text:'Esplora la collezione',href:'#dettagli',variant:'secondary'})],
  [n('illustration','image',{src:'/playground/composition.svg',alt:'Composizione geometrica di archi e forme botaniche',ratio:'square'})]
],['1-2','1-2'])]);
const detail=n('details','section',{width:'large'},{padding:'large'},[row('details_row',[
  [n('detail_title','heading',{text:'Progettato per\nessere tuo.',tag:'h2',size:'small'})],
  [n('detail_text','text',{text:'Una struttura chiara, materiali essenziali e la libertà di raccontare. Questa è una pagina vera: modifica i testi, cambia la griglia e salva il tuo lavoro.'}),n('features','list',{items:['Un layout che si adatta a ogni schermo','Contenuti e stile, controllati separatamente','Ogni modifica, sempre reversibile'],variant:'bullet'})]
],['1-3','2-3'])]);
export const staticDocument={version:1,kind:'page',children:[hero,detail]};
export const fragment=text=>({version:1,kind:'fragment',children:[row('local_row',[[n('local_text','text',{text})]],['1-1'])]});
export const records = {
  a: {label:'Poltrona Arco',values:{'product.name':'Poltrona Arco','product.description':'Linee morbide, carattere deciso. Un posto speciale per i momenti di ogni giorno.','product.features':['Legno certificato','Rivestimento naturale','Fatta per durare'],'filecabinet.material':'Rovere naturale'},document:fragment('Un angolo tranquillo, una buona lettura. La descrizione di Arco vive soltanto in questo record.')},
  b: {label:'Libreria Tratto',values:{'product.name':'Libreria Tratto','product.description':'Un ritmo di pieni e vuoti per dare spazio alle cose che ami.','product.features':['Moduli componibili','Finitura opaca','Montaggio semplice'],'filecabinet.material':'Frassino chiaro'},document:fragment('Libri, oggetti, ricordi. La descrizione di Tratto resta indipendente da quella di Arco.')},
};
export const templateDocument=structuredClone(staticDocument);
templateDocument.children[0].children[0].children[0].children.find(n=>n.id==='headline').bindings.text='product.name';
templateDocument.children[0].children[0].children[0].children.find(n=>n.id==='intro').bindings.text='product.description';
templateDocument.children[1].children[0].children[1].children=[n('material','text',{}, {color:'muted'}),n('free_area','area',{area:'description'})];
templateDocument.children[1].children[0].children[1].children[0].bindings.text='filecabinet.material';
