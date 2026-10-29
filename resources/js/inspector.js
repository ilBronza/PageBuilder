import {escape as e} from './render.js';
import {designFields, designCss} from './design.js';
import {renderRich} from './richtext.js';

export const field = (label,body,hint='') => `<label class="pb-field"><span>${e(label)}</span>${body}${hint?`<small class="pb-hint">${e(hint)}</small>`:''}</label>`;
export const group = (label,body,open=true) => `<details class="pb-settings-group" ${open?'open':''}><summary>${e(label)}</summary><div>${body}</div></details>`;
export function designControls(n,device,canPick=false) {
  const design=device==='desktop'?n.design??{}:n.responsive?.[device]?.design??{};
  const input=key=>{
    const [label,kind,values]=designFields[key],v=design[key]??'';
    return field(label,kind==='enum'?`<select data-design="${key}"><option value="">Eredita</option>${values.map(x=>`<option ${v===x?'selected':''}>${x}</option>`).join('')}</select>`:`<input type="text" data-design="${key}" value="${e(v)}" placeholder="${kind==='image'?'/images/sfondo.jpg':kind==='font'?'var(--pb-font-family)':kind==='number'?'1.5':'24px / var(--pb-space-small)'}">`);
  };
  return group('Spaziature per lato',`<div class="pb-field-grid">${Object.keys(designFields).filter(k=>/^(padding|margin)/.test(k)).map(input).join('')}</div>`,false)
    +group('Misure e tipografia personalizzate',['maxWidth','minHeight','fontSize','lineHeight','letterSpacing','fontFamily'].map(input).join(''),false)
    +group('Sfondo immagine',input('backgroundImage')+(canPick?'<button type="button" data-action="background-image">Scegli immagine di sfondo</button>':'')+['backgroundSize','backgroundPosition'].map(input).join(''),false)
    +group('Bordi personalizzati',['borderStyle','borderWidth','borderColor','borderRadius'].map(input).join(''),false);
}
export function advancedControls(n,device,button) {
  const meta=n.meta??{},design=device==='desktop'?n.design??{}:n.responsive?.[device]?.design??{};
  return group('Identità e visibilità',field('Nome nel builder',`<input data-meta="name" value="${e(meta.name??'')}" maxlength="120" placeholder="Es. Intestazione cliente">`)
    +field('ID HTML',`<input data-meta="anchor" value="${e(meta.anchor??'')}" placeholder="dati-cliente">`,'Unico nel documento. Usalo anche per collegamenti come #dati-cliente.')
    +field('Classi CSS',`<input data-meta="classes" value="${e(meta.classes??'')}" placeholder="mia-card uk-text-uppercase">`,'Classi del tema locale separate da spazi.')
    +`<label class="pb-check"><input type="checkbox" data-meta="disabled" ${meta.disabled?'checked':''}> Disattiva elemento nell’output</label>`)
    +group('CSS controllato',field('Dichiarazioni CSS',`<textarea data-design-code rows="6" spellcheck="false">${e(designCss(design).replaceAll(';',';\n'))}</textarea>`,'Stili del dispositivo selezionato: misure, spaziature, font, bordi e sfondo. Usa anche var(--nome-variabile).')+`<p class="pb-hint">Proprietà ammesse: ${Object.keys(designFields).map(k=>k.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)).join(', ')}.</p>`,false)
    +group('Riutilizza gli stili',`<div class="pb-node-actions">${button('copy-style','Copia stili')}${button('paste-style','Incolla stili')}</div><p class="pb-hint">Include stili e impostazioni responsive. Nome, ID e contenuti restano quelli dell’elemento.</p>`);
}
export function richMarkup(blocks,sources={}) {
  return renderRich(blocks,e,text=>text,text=>e(text).replace(/\{\{(.*?)\}\}/gs,(_,token)=>`<span class="pb-variable-chip" contenteditable="false" data-variable-token="${e(token.trim())}" title="${e(token.trim())}">${e(sources?.[token.trim()]?.label??token.trim())}</span>`));
}
export function richControls(n,sources,button) {
  return `<div class="pb-rich-toolbar" role="toolbar" aria-label="Formattazione testo">${button('rich:bold','Grassetto','<b>B</b>')}${button('rich:italic','Corsivo','<i>I</i>')}${button('rich:link','Inserisci collegamento','↗ Link')}${button('rich:unlink','Rimuovi collegamento','Scollega')}${button('rich:insertUnorderedList','Elenco puntato','• Elenco')}${button('rich:insertOrderedList','Elenco numerato','1. Elenco')}</div><div class="pb-rich-editor" data-rich-editor contenteditable="true" role="textbox" aria-label="Testo formattato" aria-multiline="true">${richMarkup(n.props.richText,sources)}</div>`
    +(sources?field('Inserisci variabile',`<select data-rich-variable aria-label="Inserisci variabile nel testo formattato"><option value="">Scegli una variabile…</option>${Object.values(sources).filter(s=>s.cardinality==='one'&&['text','number','date','boolean'].includes(s.type)).map(s=>`<option value="${e(s.id)}">${e(s.label)}</option>`).join('')}</select>`):'')
    +button('rich-off','Converti in testo semplice');
}
export function tableControls(n,button) {
  const columns=n.props.columns,rows=n.props.rows;
  return `<div class="pb-table-editor"><p class="pb-hint">Intestazioni e celle. Puoi inserire segnaposto {{ sorgente }} nei valori.</p>${columns.map((name,i)=>field(`Colonna ${i+1}`,`<input data-table-header="${i}" value="${e(name)}">${button(`table-delcol:${i}`,`Rimuovi colonna ${i+1}`,'×',columns.length===1?'disabled':'')}`)).join('')}${button('table-addcol','Aggiungi colonna','+ Colonna',columns.length>=12?'disabled':'')}${rows.map((row,i)=>group(`Riga ${i+1}`,row.map((value,j)=>field(columns[j]||`Colonna ${j+1}`,`<input data-table-cell="${i}:${j}" value="${e(value)}">`)).join('')+button(`table-delrow:${i}`,`Rimuovi riga ${i+1}`))).join('')}${button('table-addrow','Aggiungi riga tabella','+ Riga',rows.length>=100?'disabled':'')}</div>`;
}
