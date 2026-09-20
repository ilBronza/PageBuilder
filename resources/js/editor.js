import {Engine, clone, layouts, locate, compatible} from './core.js';
import {render, escape as e} from './render.js';

const labels = {width:'Larghezza',text:'Testo',tag:'Tag HTML',size:'Dimensione del titolo',src:'URL immagine pubblica',alt:'Testo alternativo',ratio:'Proporzioni',href:'Collegamento',variant:'Aspetto',items:'Voci (una per riga)',area:'Area del record',background:'Sfondo',padding:'Spaziatura interna',margin:'Margine',align:'Allineamento',color:'Colore',gap:'Distanza colonne',rowGap:'Distanza righe',vertical:'Allineamento verticale'};
const tokenLabels = {default:'Predefinito',none:'Nessuno',small:'Piccolo',medium:'Medio',large:'Grande',xlarge:'Molto grande','2xlarge':'Extra grande',expand:'Tutta larghezza',muted:'Tenue',primary:'Primary',secondary:'Secondary',left:'Sinistra',center:'Centro',right:'Destra',top:'In alto',middle:'Al centro',bottom:'In basso',collapse:'Nessuna',auto:'Originale',square:'Quadrata',landscape:'Orizzontale',portrait:'Verticale',bullet:'Punti',decimal:'Numeri',divider:'Linee',striped:'Righe alternate',text:'Testo',icon:'Icona'};
const button = (action, label, content = label, extra = '') => `<button type="button" data-action="${action}" aria-label="${e(label)}" title="${e(label)}" ${extra}>${content}</button>`;
const choices = (values, selected) => values.map(value=>`<option value="${e(value)}" ${value===selected?'selected':''}>${e(tokenLabels[value] ?? value)}</option>`).join('');

export async function mountEditor(root, options) {
  const base = new URL('../',import.meta.url);
  const [catalog, styles] = await Promise.all([options.catalog ?? fetch(new URL('schema/catalog.json',base)).then(r=>r.json()),options.styles ?? fetch(new URL('schema/styles.json',base)).then(r=>r.json())]);
  const mode = options.mode ?? 'static';
  const css = options.previewStyles ?? [new URL('vendor/uikit.min.css',base).href,new URL('css/content.css',base).href];
  const abort = new AbortController();
  let loadFailed = false;
  let engine = null, selected = null, saving = false, loading = false, error = '', notice = '', propertyTab = 'content', previewRequest = null, sequence = 0, dragged = null, raw = null, disposed = false;
  root.classList.add('pb-editor');
  root.innerHTML = `<header class="pb-toolbar"><div class="pb-brand"><span class="pb-mark">▥</span><div><strong>${e(options.title ?? 'PageBuilder')}</strong><small>${e(mode === 'template' ? 'TEMPLATE CONDIVISO' : mode === 'area' ? 'AREA DEL RECORD' : 'PAGINA STATICA')}</small></div></div><div class="pb-history">${button('undo','Annulla','↶')}${button('redo','Ripristina','↷')}</div><div class="pb-devices" role="group" aria-label="Larghezza anteprima">${button('desktop','Desktop','▰','aria-pressed="true"')}${button('tablet','Tablet','▯','aria-pressed="false"')}${button('mobile','Mobile','▯','aria-pressed="false"')}</div><span class="pb-status" role="status"></span>${button('export','Esporta JSON','↓ JSON')}${button('reload','Riapri documento','Riapri')}${button('save','Salva documento','Salva','class="pb-primary"')}</header><div class="pb-message" role="alert" hidden></div><div class="pb-workspace"><aside class="pb-sidebar" aria-label="Struttura e proprietà"><div class="pb-side-heading"><div><small>IL TUO DOCUMENTO</small><h2>Struttura</h2></div>${button('root','Aggiungi struttura','+')}</div><div class="pb-tree"></div><div class="pb-inspector"></div></aside><main class="pb-stage"><div class="pb-stage-label"><span>ANTEPRIMA LIVE</span><span class="pb-size-label">Desktop · fluida</span></div><div class="pb-preview-wrap"><iframe title="Anteprima del documento" sandbox="allow-same-origin"></iframe></div><div class="pb-stage-footer">Seleziona un elemento per modificarlo <span>UIkit · PageBuilder</span></div></main></div><dialog class="pb-catalog"><div class="pb-dialog-heading"><div><small>DAI FORMA AL CONTENUTO</small><h2>Aggiungi un elemento</h2></div>${button('close','Chiudi catalogo','×')}</div><div class="pb-catalog-grid"></div></dialog>`;
  const q = selector => root.querySelector(selector);
  const frame = q('iframe');
  const status = () => {
    q('.pb-status').textContent = loading ? 'Caricamento…' : saving ? 'Salvataggio…' : engine?.dirty ? '● Modifiche da salvare' : notice || (engine ? '✓ Tutto salvato' : 'Documento non caricato');
    q('[data-action=save]').disabled = !engine || saving || loading || loadFailed || !!q('.pb-inspector :invalid') || !engine.dirty;
    q('[data-action=undo]').disabled = !engine?.past.length;
    q('[data-action=redo]').disabled = !engine?.future.length;
    q('[data-action=reload]').disabled = saving || loading;
    q('.pb-message').hidden = !error; q('.pb-message').textContent = error;
  };
  function item(n, depth) {
    const def = catalog[n.type];
    const caption = n.type === 'heading' || n.type === 'text' || n.type === 'button' ? n.props.text : n.type === 'area' ? n.props.area : n.type === 'row' ? n.props.layout.map(w=>w.replace('-','/')).join(' + ') : '';
    return `<div class="pb-tree-item ${selected===n.id?'is-selected':''}" style="--depth:${depth}"><button type="button" class="pb-tree-select" data-select="${n.id}" draggable="${n.type!=='column'}" aria-pressed="${selected===n.id}"><span class="pb-tree-icon">${e(def.icon)}</span><span>${e(def.label)}${caption?`<small>${e(caption)}</small>`:''}</span></button>${n.type==='column'?button(`catalog:${n.id}`,'Aggiungi elemento alla colonna','+') : ''}</div>${(n.children??[]).map(c=>item(c,depth+1)).join('')}`;
  }
  function tree() {
    q('.pb-tree').innerHTML = engine ? engine.document.children.map(n=>item(n,0)).join('') || '<p class="pb-empty">La pagina è ancora vuota.<br>Aggiungi la prima struttura con +.</p>' : '<p class="pb-empty">Carica un documento per iniziare.</p>';
  }
  function inspector() {
    const n = engine && locate(engine.document,selected)?.node;
    if (!n) { q('.pb-inspector').innerHTML = '<div class="pb-inspector-empty"><span>↖</span><h3>Ogni dettaglio, al suo posto.</h3><p>Seleziona un elemento nella struttura o nell’anteprima per modificarlo.</p></div>'; return; }
    const def = catalog[n.type];
    let content = `<div class="pb-inspector-title"><span>${e(def.icon)}</span><h3>${e(def.label)}</h3></div><div class="pb-tabs" role="group" aria-label="Proprietà">${button('content','Contenuto','Contenuto',`aria-pressed="${propertyTab==='content'}"`)}${button('style','Stile','Stile',`aria-pressed="${propertyTab==='style'}"`)}</div>`;
    if (propertyTab==='content') {
      if (n.type==='row') {
        content += '<label class="pb-field-title">Griglia</label><div class="pb-grid-picker">'+layouts.map((l,i)=>button(`grid:${i}`,l.map(w=>w.replace('-','/')).join(' + '),`<span class="pb-grid-option">${l.map(w=>`<i style="flex:${Number(w.split('-')[0])/Number(w.split('-')[1])}"></i>`).join('')}</span><small>${l.map(w=>w.replace('-','/')).join(' · ')}</small>`,`aria-pressed="${JSON.stringify(l)===JSON.stringify(n.props.layout)}"`)).join('')+'</div><p class="pb-hint">Riducendo le colonne, i contenuti vengono spostati nell’ultima colonna rimasta.</p>';
      }
      for (const [key,spec] of Object.entries(def.props)) {
        if (spec.kind==='layout') continue;
        const value = n.props[key] ?? spec.default;
        const binding = n.bindings[key];
        content += `<label class="pb-field"><span>${e(labels[key]??key)}</span>`;
        if (mode==='template' && spec.binding) content += `<select data-binding="${key}" aria-label="Sorgente ${e(labels[key]??key)}"><option value="">Contenuto manuale</option>${Object.values(options.sources??{}).filter(s=>compatible(spec.binding,s)).map(s=>`<option value="${e(s.id)}" ${s.id===binding?'selected':''}>${e(s.label)} · ${e(s.type)}</option>`).join('')}</select>`;
        if (binding) content += `<small class="pb-binding">↗ ${e(binding)} · valore del record in anteprima</small>`;
        else if (spec.kind==='enum') content += `<select data-prop="${key}">${choices(spec.values,value)}</select>`;
        else if (n.type==='area') content += `<select data-prop="${key}">${(options.areas??[]).map(a=>`<option value="${e(a)}" ${a===value?'selected':''}>${e(options.areaLabels?.[a]??a)}</option>`).join('')}</select>`;
        else if (spec.kind==='list' || (key==='text' && n.type==='text')) content += `<textarea data-prop="${key}" rows="5">${e(Array.isArray(value)?value.join('\n'):value)}</textarea>`;
        else content += `<input data-prop="${key}" value="${e(value)}" type="text">`;
        content += '</label>';
        if (key==='src' && !binding && options.pickImage) content += button('image','Scegli immagine','Scegli dalla libreria');
      }
      if (n.type==='section') content += button(`addrow:${n.id}`,'Aggiungi riga','+ Aggiungi riga','class="pb-wide"');
      if (n.type==='column') content += button(`catalog:${n.id}`,'Aggiungi elemento','+ Aggiungi elemento','class="pb-wide"');
    } else for (const key of def.styles) content += `<label class="pb-field"><span>${e(labels[key]??key)}</span><select data-style="${key}"><option value="">Tema globale</option>${choices(styles[key],n.styles[key])}</select></label>`;
    if (n.type!=='column') {
      content += `<div class="pb-node-actions">${button('up','Sposta su','↑')}${button('down','Sposta giù','↓')}${button('duplicate','Duplica elemento','Duplica')}${button('delete','Elimina elemento','Elimina','class="pb-danger"')}</div>`;
      const destinations = [];
      function visit(parent) { if (parent.children && (parent.type ? catalog[parent.type].children?.includes(n.type) : n.type === (engine.document.kind==='page'?'section':'row'))) destinations.push(parent); parent.children?.forEach(visit); }
      visit(engine.document);
      content += `<label class="pb-field"><span>Sposta in…</span><select data-destination><option value="">Scegli destinazione</option>${destinations.filter(d=>d.id!==n.id && !locate({children:[n]},d.id)).map((d,i)=>`<option value="${d.id??'root'}">${d.type ? catalog[d.type].label : 'Documento'} ${i+1}${d.id ? ' · '+d.id.slice(-5) : ''}</option>`).join('')}</select></label>`;
    }
    q('.pb-inspector').innerHTML = content;
  }
  function highlight() {
    frame.contentDocument?.querySelectorAll('[data-pb-id]').forEach(n=>n.classList.toggle('pb-selected',n.dataset.pbId===selected));
  }
  async function preview() {
    if (!engine) return;
    const seq = ++sequence;
    previewRequest?.abort(); previewRequest = new AbortController();
    const scroll = frame.contentWindow?.scrollY ?? 0;
    try {
      const html = options.adapter.preview ? await options.adapter.preview(clone(engine.document), {signal:previewRequest.signal}) : render(engine.document,catalog,styles,{mode,values:options.values??{},areas:options.areaDocuments??{},custom:options.renderers??{}});
      if (seq!==sequence || disposed) return;
      frame.onload = () => {
        highlight(); frame.contentWindow.scrollTo(0,scroll);
        frame.contentDocument.addEventListener('click',event=>{
          event.preventDefault(); const id = event.target.closest('[data-pb-id]')?.dataset.pbId;
          if (id && locate(engine.document,id)) { selected=id; tree(); inspector(); highlight(); }
        });
      };
      frame.srcdoc = `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https:; style-src http: https: 'unsafe-inline'; font-src http: https:; base-uri 'none'; form-action 'none'">${css.map(url=>`<link rel="stylesheet" href="${e(url)}">`).join('')}<style>body{margin:0;background:white}.pb-node{position:relative;cursor:pointer}.pb-selected{outline:2px solid #347565;outline-offset:3px}.pb-column:empty{min-height:90px;border:1px dashed #b8c9c3}.pb-section:empty{min-height:120px}.pb-image:empty{min-height:100px;background:#f2f4f1}.pb-document:empty{min-height:200px}</style></head><body>${html}</body></html>`;
    } catch (err) { if (err.name!=='AbortError' && seq===sequence) { error=`Anteprima non disponibile: ${err.message}`; status(); } }
  }
  function refresh(full = true) { notice=''; tree(); if (full) inspector(); status(); preview(); }
  async function load() {
    loading=true; error=''; status();
    try {
      raw = options.adapter.load ? await options.adapter.load() : clone(options.document);
      const next = new Engine(raw,catalog,styles,{mode,kind:options.kind??null,sources:mode==='template'?options.sources:null,areas:mode==='template'?options.areas:null});
      engine=next; loadFailed=false; selected=null; refresh();
    } catch (err) { loadFailed=true; error=`Caricamento non riuscito: ${err.message}. Il documento non è stato sovrascritto.`; }
    finally { loading=false; status(); }
  }
  function catalogDialog(id) {
    selected=id; tree(); inspector(); highlight();
    q('.pb-catalog-grid').innerHTML = Object.entries(catalog).filter(([,d])=>!d.children && (!d.templateOnly || mode==='template')).map(([type,d])=>button(`insert:${type}`,`Aggiungi ${d.label}`,`<span>${e(d.icon)}</span><strong>${e(d.label)}</strong>`)).join('');
    q('dialog').showModal();
  }
  root.addEventListener('click',async event=>{
    const select=event.target.closest('[data-select]');
    if (select && engine) { selected=select.dataset.select; tree(); inspector(); highlight(); status(); return; }
    const action=event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    try {
      error='';
      if (action==='export') {
        const blob = new Blob([JSON.stringify(loadFailed?raw:engine?.document??raw,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pagebuilder.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
      }
      if (action==='reload') { if (!engine?.dirty || window.confirm('Riaprire il documento salvato? Le modifiche locali verranno perse. Puoi prima esportarle.')) await load(); return; }
      if (['desktop','tablet','mobile'].includes(action)) {
        const size={desktop:'100%',tablet:'820px',mobile:'390px'}[action];
        q('.pb-preview-wrap').style.width=size;
        q('.pb-size-label').textContent={desktop:'Desktop · fluida',tablet:'Tablet · 820 px',mobile:'Mobile · 390 px'}[action];
        root.querySelectorAll('.pb-devices button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===action)));return;
      }
      if (action==='close') { q('dialog').close();return; }
      if (!engine || loading || loadFailed) return;
      if (action==='save') {
        if (saving) return;
        saving=true; const snapshot=clone(engine.document);status();
        try { await options.adapter.save(snapshot); engine.markSaved(snapshot); notice='✓ Salvato adesso'; }
        catch(err) { error=`Salvataggio non riuscito: ${err.message}. Le modifiche sono ancora nell’editor.`; }
        finally { saving=false;status(); }return;
      }
      if (action.startsWith('catalog:')) { catalogDialog(action.slice(8));return; }
      if (action.startsWith('insert:')) {
        selected=engine.add(selected,action.slice(7),action.slice(7)==='area'?{area:options.areas?.[0]??'description'}:{});
        q('dialog').close();
      }
      if (action==='root') selected=engine.add(null,engine.document.kind==='page'?'section':'row');
      if (action.startsWith('addrow:')) selected=engine.add(action.slice(7),'row');
      if (action.startsWith('grid:')) engine.grid(selected,layouts[Number(action.slice(5))]);
      if (action==='undo') engine.undo(); if(action==='redo')engine.redo();
      if (action==='duplicate') selected=engine.duplicate(selected);
      if (action==='delete') {engine.remove(selected);selected=null;}
      if (action==='up') engine.reorder(selected,-1); if(action==='down')engine.reorder(selected,1);
      if (action==='content' || action==='style') propertyTab=action;
      if (action==='image') { const result=await options.pickImage(); if(result) {engine.update(selected,'props','src',result.url);engine.update(selected,'props','alt',result.alt??'');} }
      refresh();
    } catch(err){error=err.message;status();}
  },{signal:abort.signal});
  function propertyChange(event) {
    if (!engine || !selected) return;
    const t=event.target;
    try {
      error=''; t.setCustomValidity?.('');
      if(t.dataset.prop){const spec=catalog[locate(engine.document,selected).node.type].props[t.dataset.prop];engine.update(selected,'props',t.dataset.prop,spec.kind==='list'?t.value.split('\n'):t.value);}
      else if(t.dataset.style)engine.update(selected,'styles',t.dataset.style,t.value||undefined);
      else if(t.dataset.binding){engine.update(selected,'bindings',t.dataset.binding,t.value||undefined);inspector();}
      else if(t.hasAttribute('data-destination')&&t.value){const target=t.value==='root'?null:t.value;engine.move(selected,target,500);inspector();}
      else return;
      refresh(false);
    }catch(err){t.setCustomValidity?.(err.message);error=`Il valore non è stato applicato: ${err.message}`;status();}
  }
  root.addEventListener('change',propertyChange,{signal:abort.signal});
  root.addEventListener('input',event=>{if(event.target.matches('textarea,[data-prop=text],[data-prop=alt]'))propertyChange(event);},{signal:abort.signal});
  root.addEventListener('dragstart',event=>{dragged=event.target.closest('[data-select]')?.dataset.select; if(dragged)event.dataTransfer.setData('text/plain',dragged);},{signal:abort.signal});
  root.addEventListener('dragover',event=>{if(event.target.closest('[data-select]'))event.preventDefault();},{signal:abort.signal});
  root.addEventListener('drop',event=>{
    event.preventDefault();const targetId=event.target.closest('[data-select]')?.dataset.select;
    if(!dragged||!targetId||dragged===targetId)return;
    try{const from=locate(engine.document,dragged),to=locate(engine.document,targetId);const isParent=catalog[to.node.type].children?.includes(from.node.type);engine.move(dragged,isParent?to.node.id:to.parent.id,isParent?to.node.children.length:to.index);selected=dragged;refresh();}catch(err){error=err.message;status();}finally{dragged=null;}
  },{signal:abort.signal});
  root.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();q('[data-action=save]').click();}
    if((event.ctrlKey||event.metaKey)&&event.key==='z'&&!event.target.matches('input,textarea,select')){event.preventDefault();engine?.[event.shiftKey?'redo':'undo']();refresh();}
  },{signal:abort.signal});
  window.addEventListener('beforeunload',event=>{if(engine?.dirty){event.preventDefault();event.returnValue='';}},{signal:abort.signal});
  await load();
  return {get engine(){return engine;},reload:load,async setPreview(values,areaDocuments={}){options.values=values;options.areaDocuments=areaDocuments;await preview();},destroy(){disposed=true;abort.abort();previewRequest?.abort();frame.onload=null;root.replaceChildren();}};
}
