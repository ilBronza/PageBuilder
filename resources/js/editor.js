import {Engine, clone, layouts, locate, compatible, node, safeUrl} from './core.js';
import {render, escape as e} from './render.js';
import {composition, selectionPath, caption} from './composition.js';
import {previewStyles, loadVariables, defaultVariablesStyle} from './theme.js';
import {designControls, advancedControls, richControls, richMarkup, tableControls, field, group} from './inspector.js';
import {parseDesign} from './design.js';
import {readRich, fromPlain, richPlain} from './richtext.js';
import {createMediaPicker} from './media.js';

const labels = {width:'Larghezza',text:'Testo',tag:'Tag HTML',size:'Dimensione del titolo',src:'URL immagine pubblica',alt:'Testo alternativo',ratio:'Proporzioni',href:'Collegamento',variant:'Aspetto',items:'Voci (una per riga)',area:'Area del record',background:'Sfondo',padding:'Spaziatura interna',margin:'Margine',align:'Allineamento',color:'Colore',gap:'Distanza colonne',rowGap:'Distanza righe',vertical:'Allineamento verticale',fontSize:'Dimensione testo',fontWeight:'Peso del testo',radius:'Arrotondamento',border:'Bordo',shadow:'Ombra',maxWidth:'Larghezza massima',title:'Titolo',linkText:'Testo collegamento',position:'Posizione immagine',icon:'Icona',label:'Descrizione accessibile'};
const tokenLabels = {default:'Predefinito',none:'Nessuno',small:'Piccolo',medium:'Medio',large:'Grande',xlarge:'Molto grande','2xlarge':'Extra grande',expand:'Tutta larghezza',muted:'Tenue',primary:'Primary',secondary:'Secondary',success:'Successo',warning:'Avviso',danger:'Pericolo',emphasis:'Enfasi',inverse:'Bianco',left:'Sinistra',center:'Centro',right:'Destra',top:'In alto',middle:'Al centro',bottom:'In basso',collapse:'Nessuna',auto:'Originale',square:'Quadrata',landscape:'Orizzontale',portrait:'Verticale',bullet:'Punti',decimal:'Numeri',divider:'Linee',striped:'Righe alternate',text:'Testo',icon:'Icona',normal:'Normale',bold:'Grassetto',thin:'Sottile',thick:'Spesso',pill:'Pillola',star:'Stella',check:'Spunta',heart:'Cuore',info:'Informazioni',calendar:'Calendario',location:'Posizione',mail:'Email',phone:'Telefono'};
const button = (action, label, content = label, extra = '') => `<button type="button" data-action="${action}" aria-label="${e(label)}" title="${e(label)}" ${extra}>${content}</button>`;
const choices = (values, selected) => values.map(value=>`<option value="${e(value)}" ${value===selected?'selected':''}>${e(tokenLabels[value] ?? value)}</option>`).join('');
const palette = (key, tokens, value, group = 'styles') => `<fieldset class="pb-palette" data-palette="${key}"><legend>${e(labels[key]??key)}</legend><div class="pb-palette-options">${(group==='styles'?['',...tokens]:tokens).map(token=>button(`palette:${group}:${key}:${token}`,tokenLabels[token]??'Tema globale',`<span class="pb-swatch" data-color-token="${e(token)}" aria-hidden="true"></span><span>${e(tokenLabels[token]??'Tema globale')}</span>`,`class="pb-color-choice" aria-pressed="${token===(value??'')}"`)).join('')}</div></fieldset>`;
const deviceIcon = device => `<svg viewBox="0 0 24 24" aria-hidden="true">${device==='desktop' ? '<rect x="2" y="3" width="20" height="14" rx="1"/><path d="M12 17v4m-5 0h10"/>' : device==='tablet' ? '<rect x="5" y="2" width="14" height="20" rx="1.5"/><path d="M11 19h2"/>' : '<rect x="7" y="2" width="10" height="20" rx="1.5"/><path d="M11 19h2"/>'}</svg>`;
const elementInfo = {
  card:['Contenuti','Immagine, titolo, testo e collegamento in un blocco','scheda pannello'],
  icon:['Media','Icone vettoriali con descrizione accessibile','simbolo stella'],
  table:['Contenuti','Intestazioni e righe modificabili','tabella celle dati'],
  imageText:['Contenuti','Immagine affiancata a titolo e testo','foto media contenuto'],
  heading: ['Contenuti', 'Titoli e sottotitoli per organizzare la pagina', 'titolo intestazione'],
  text: ['Contenuti', 'Paragrafi e testi descrittivi', 'paragrafo descrizione'],
  list: ['Contenuti', 'Elenchi puntati, numerati o con separatori', 'lista punti'],
  image: ['Media', 'Un’immagine dalla tua libreria o da un URL', 'foto fotografia'],
  button: ['Azioni', 'Un invito all’azione con un collegamento', 'link cta bottone'],
  divider: ['Layout', 'Una linea per separare i contenuti', 'linea separazione'],
  area: ['Dati', 'Il contenuto di un’area libera del record', 'frammento dinamico'],
};

export async function mountEditor(root, options) {
  const base = new URL('../',import.meta.url);
  const [catalog, styles] = await Promise.all([options.catalog ?? fetch(new URL('schema/catalog.json',base),{cache:'no-cache'}).then(r=>r.json()),options.styles ?? fetch(new URL('schema/styles.json',base),{cache:'no-cache'}).then(r=>r.json())]);
  const mode = options.mode ?? 'static';
  const css = previewStyles(options);
  loadVariables(root, options);
  const abort = new AbortController();
  let loadFailed = false;
  let engine = null, selected = null, saving = false, loading = false, error = '', notice = '', propertyTab = 'content', previewRequest = null, sequence = 0, dragged = null, raw = null, disposed = false;
  let structureView = 'layout', insertion = null, sidebarPage = 'builder';
  const collapsed = new Set(), groupState = new Map();
  let device='desktop',copiedStyle=null,lastHtml='',richRange=null,codeTab='html',codeDraft='',richInvalid=false;
  root.classList.add('pb-editor');
  root.innerHTML = `<header class="pb-toolbar"><div class="pb-brand"><span class="pb-mark">▥</span><div><strong>${e(options.title ?? 'PageBuilder')}</strong><small>${e(mode === 'template' ? 'TEMPLATE CONDIVISO' : mode === 'area' ? 'AREA DEL RECORD' : 'PAGINA STATICA')}</small></div></div><div class="pb-history">${button('undo','Annulla','↶')}${button('redo','Ripristina','↷')}</div><div class="pb-devices" role="group" aria-label="Larghezza anteprima">${button('desktop','Desktop',deviceIcon('desktop'),'aria-pressed="true"')}${button('tablet','Tablet',deviceIcon('tablet'),'aria-pressed="false"')}${button('mobile','Mobile',deviceIcon('mobile'),'aria-pressed="false"')}</div><span class="pb-status" role="status"></span>${button('import','Importa JSON','↑ JSON')}<input type="file" data-import accept=".json,application/json" hidden>${button('export','Esporta JSON','↓ JSON')}${button('code','Mostra codice','</> Codice')}${button('fullscreen','Schermo intero','⛶')}${button('reload','Riapri documento','Riapri')}${button('save','Salva documento','Salva','class="pb-primary"')}</header><div class="pb-message" role="alert" hidden></div><div class="pb-workspace"><aside class="pb-sidebar" aria-label="Builder"><div class="pb-structure-panel"><div class="pb-side-heading"><div><h2>Builder</h2></div>${button('root','Aggiungi struttura','+')}</div><p class="pb-document-title">${e(options.title ?? 'La mia pagina')}</p><div class="pb-structure-views" role="group" aria-label="Vista della struttura">${button('view:layout','Vista layout','▥ Layout','aria-pressed="true"')}${button('view:tree','Vista albero','☷ Albero','aria-pressed="false"')}</div><div class="pb-tree" data-view="layout"></div></div><div class="pb-properties-panel" hidden><div class="pb-sidebar-back">${button('builder','Torna al builder','← Builder')}</div><div class="pb-inspector"></div></div><footer class="pb-sidebar-footer">${button('hide-sidebar','Nascondi pannello','«')}</footer></aside><main class="pb-stage">${button('show-sidebar','Mostra pannello','» Builder','class="pb-sidebar-show" hidden')}<div class="pb-stage-label"><span>ANTEPRIMA LIVE</span><span class="pb-size-label">Desktop · 1280 px</span></div><div class="pb-contextbar" role="group" aria-label="Azioni sull’elemento selezionato" hidden></div><div class="pb-preview-wrap"><iframe title="Anteprima del documento" sandbox="allow-same-origin"></iframe></div><div class="pb-stage-footer">Seleziona un elemento per modificarlo <span>UIkit · PageBuilder</span></div></main></div><dialog class="pb-catalog" aria-label="Catalogo elementi"><div class="pb-dialog-heading"><div><small>DAI FORMA AL CONTENUTO</small><h2>Aggiungi un elemento</h2></div>${button('close','Chiudi catalogo','×')}</div><p class="pb-catalog-context"></p><label class="pb-catalog-search"><span>Cerca elementi</span><input type="search" data-catalog-search placeholder="Titolo, immagine, elenco…" autocomplete="off"></label><p class="pb-catalog-count" role="status"></p><div class="pb-catalog-grid"></div></dialog>`;
  root.insertAdjacentHTML('beforeend',`<dialog class="pb-code-dialog" aria-label="Codice del documento"><div class="pb-dialog-heading"><h2>Codice del documento</h2>${button('code-close','Chiudi codice','×')}</div><div class="pb-code-tabs">${button('code-html','HTML risultante')}${button('code-json','Documento JSON')}</div><p class="pb-code-hint"></p><textarea data-code spellcheck="false" aria-label="Codice"></textarea><p class="pb-code-error" role="alert"></p><div class="pb-node-actions">${button('code-copy','Copia codice')}${button('code-apply','Applica JSON')}</div></dialog>`);
  const q = selector => root.querySelector(selector);
  const managedPicker = !options.pickImage && options.mediaLibrary ? createMediaPicker(root,options) : null;
  const pickImage = options.pickImage ?? managedPicker;
  const frame = q('iframe');
  const fitPreview=()=>{const wrap=q('.pb-preview-wrap'),width={desktop:1280,tablet:820,mobile:390}[device],scale=Math.min(1,wrap.clientWidth/width);frame.style.width=`${width}px`;frame.style.height=`${wrap.clientHeight/Math.max(scale,.1)}px`;frame.style.transform=`scale(${scale})`;};
  const previewResize=new ResizeObserver(fitPreview);previewResize.observe(q('.pb-preview-wrap'));
  q('.pb-sidebar-footer').append(q('.pb-devices'));
  const fitEditor = () => root.style.setProperty('--pb-editor-top', `${Math.max(0,root.getBoundingClientRect().top + window.scrollY)}px`);
  fitEditor();
  window.addEventListener('resize',fitEditor,{signal:abort.signal});
  const status = () => {
    q('.pb-status').textContent = loading ? 'Caricamento…' : saving ? 'Salvataggio…' : (engine?.dirty || options.isDirty?.()) ? '● Modifiche da salvare' : notice || (engine ? '✓ Tutto salvato' : 'Documento non caricato');
    q('[data-action=save]').disabled = !engine || saving || loading || loadFailed || richInvalid || !!q('.pb-inspector :invalid') || !(engine.dirty || options.isDirty?.());
    q('[data-action=undo]').disabled = !engine?.past.length;
    q('[data-action=redo]').disabled = !engine?.future.length;
    q('[data-action=reload]').disabled = saving || loading;
    q('[data-action=import]').disabled = !engine || saving || loading || loadFailed;
    options.onStatus?.({saving, loading, dirty: !!engine?.dirty, loadFailed});
    q('.pb-message').hidden = !error; q('.pb-message').textContent = error;
  };
  function tree() {
    q('.pb-tree').dataset.view = structureView;
    q('.pb-tree').innerHTML = engine ? composition(engine.document, catalog, {selected, view:structureView, collapsed}) : '<p class="pb-empty">Carica un documento per iniziare.</p>';
    root.querySelectorAll('.pb-structure-views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.action === `view:${structureView}`)));
  }
  function choose(id, reveal = false) {
    if (!engine || !locate(engine.document, id)) return;
    if (selected !== id || sidebarPage === 'builder') propertyTab = catalog[locate(engine.document,id).node.type].children ? 'style' : 'content';
    selected = id;
    sidebarPage = 'inspector';
    q('.pb-sidebar').hidden=false; q('[data-action=show-sidebar]').hidden=true;
    selectionPath(engine.document, id).slice(0, -1).forEach(n => collapsed.delete(n.id));
    tree(); inspector(); highlight(); status();
    q('[data-action=builder]').focus({preventScroll:true});
    if (reveal) {
      const element = [...(frame.contentDocument?.querySelectorAll('[data-pb-id]') ?? [])].find(n => n.dataset.pbId === id);
      element?.scrollIntoView({block:'nearest', behavior:'smooth'});
    }
  }
  function panels() {
    q('.pb-structure-panel').hidden = sidebarPage !== 'builder';
    q('.pb-properties-panel').hidden = sidebarPage !== 'inspector';
  }
  function builder() {
    sidebarPage='builder'; panels(); tree();
    const current = [...root.querySelectorAll('.pb-tree [data-select]')].find(n=>n.dataset.select===selected);
    current?.scrollIntoView({block:'nearest'});
    (current ?? q('.pb-structure-views button[aria-pressed=true]')).focus({preventScroll:true});
  }
  function contextbar() {
    const found = engine && locate(engine.document, selected);
    const bar = q('.pb-contextbar');
    bar.hidden = !found;
    if (!found) { bar.replaceChildren(); return; }
    const {node:n, parent, index} = found;
    const canManage = n.type !== 'column';
    const addLabel = n.type === 'section' ? 'Aggiungi sezione dopo' : n.type === 'row' ? 'Aggiungi riga dopo' : 'Aggiungi elemento';
    bar.innerHTML = `<strong>${e(catalog[n.type].icon)} ${e(catalog[n.type].label)}</strong><div class="pb-context-actions">${button('parent','Seleziona contenitore','↑ Contenitore',parent.id ? '' : 'disabled')}${button('add',addLabel,'+ Aggiungi')}${canManage ? `${button('up','Sposta su','↑',index === 0 ? 'disabled' : '')}${button('down','Sposta giù','↓',index === parent.children.length - 1 ? 'disabled' : '')}${button('duplicate','Duplica elemento','⧉ Duplica')}${button('delete','Elimina elemento','×','class="pb-danger"')}` : ''}</div>`;
  }
  function destinationLabel(container) {
    if (!container.id) return 'Documento';
    return selectionPath(engine.document,container.id).map(part=>`${catalog[part.type].label} ${locate(engine.document,part.id).index+1}`).join(' › ');
  }
  function inspector() {
    const n = engine && locate(engine.document,selected)?.node;
    if (!n) sidebarPage='builder';
    panels();
    contextbar();
    if (!n) { q('.pb-inspector').innerHTML = '<div class="pb-inspector-empty"><span>↖</span><h3>Ogni dettaglio, al suo posto.</h3><p>Seleziona un elemento nella struttura o nell’anteprima per modificarlo.</p></div>'; return; }
    const def = catalog[n.type];
    const presentationProps = new Set(['width','tag','size','ratio','variant','layout']);
    const hasContent = Object.keys(def.props).some(key=>!presentationProps.has(key));
    if (!hasContent && propertyTab==='content') propertyTab='style';
    const localStyles=device==='desktop'?n.styles:n.responsive?.[device]?.styles??{};
    let content = `<div class="pb-properties-heading"><h2>${e(def.label)}</h2><div class="pb-tabs" role="group" aria-label="Proprietà">${hasContent ? button('content','Contenuto','Contenuto',`aria-pressed="${propertyTab==='content'}"`) : ''}${button('style','Impostazioni','Impostazioni',`aria-pressed="${propertyTab==='style'}"`)}${button('advanced','Avanzate','Avanzate',`aria-pressed="${propertyTab==='advanced'}"`)}</div></div>`;
    if(propertyTab!=='content') content+=`<div class="pb-breakpoints" role="group" aria-label="Modifica stili per dispositivo">${['desktop','tablet','mobile'].map(d=>button(`device:${d}`,`Stili ${d}`,d==='desktop'?'Base':d==='tablet'?'Tablet':'Mobile',`aria-pressed="${device===d}"`)).join('')}</div><p class="pb-hint">${device==='desktop'?'Impostazioni di base per tutti i dispositivi.':'Modifiche per '+(device==='tablet'?'schermi fino a 1199 px; ereditate anche dal mobile.':'schermi fino a 639 px; eredita da Base e Tablet.')}</p>`;
    if (propertyTab!=='advanced') {
      if (n.type==='row' && propertyTab==='style' && device==='desktop') {
        content += '<label class="pb-field-title">Griglia</label><div class="pb-grid-picker">'+layouts.map((l,i)=>button(`grid:${i}`,l.map(w=>w.replace('-','/')).join(' + '),`<span class="pb-grid-option">${l.map(w=>`<i style="flex:${Number(w.split('-')[0])/Number(w.split('-')[1])}"></i>`).join('')}</span><small>${l.map(w=>w.replace('-','/')).join(' · ')}</small>`,`aria-pressed="${JSON.stringify(l)===JSON.stringify(n.props.layout)}"`)).join('')+'</div><p class="pb-hint">Riducendo le colonne, i contenuti vengono spostati nell’ultima colonna rimasta.</p>';
      }
      if(n.type==='row'&&propertyTab==='style'&&device!=='desktop') {
        const current=n.responsive?.[device]?.columns;
        const variants=[Array(n.children.length).fill('1-1'),...layouts.filter(l=>l.length===n.children.length)];
        content+=group('Colonne responsive',`<div class="pb-grid-picker">${button('responsive-grid:inherit','Eredita griglia','Eredita')}${variants.map((l,i)=>button(`responsive-grid:${i}`,`Colonne ${l.join(' ')}`,l.map(w=>w.replace('-','/')).join(' · '),`aria-pressed="${JSON.stringify(l)===JSON.stringify(current)}"`)).join('')}</div>`);
      }
      if(n.type==='table'&&propertyTab==='content') content+=tableControls({...n,props:{...Object.fromEntries(Object.entries(def.props).map(([k,v])=>[k,v.default])),...n.props}},button);
      for (const [key,spec] of Object.entries(def.props)) {
        if (spec.kind==='layout'||spec.kind==='richtext'||n.type==='table') continue;
        if(propertyTab==='style'&&device!=='desktop') continue;
        if(n.type==='text'&&key==='text'&&n.props.richText?.length&&!n.bindings.text&&propertyTab==='content'){content+=richControls(n,mode==='template'?options.sources:null,button);continue;}
        if ((propertyTab==='style') !== presentationProps.has(key)) continue;
        const value = n.props[key] ?? spec.default;
        const binding = n.bindings[key];
        if (n.type==='button' && key==='variant') { content += palette(key,spec.values,value,'props'); continue; }
        content += `<label class="pb-field"><span>${e(labels[key]??key)}</span>`;
        if (mode==='template' && spec.binding) content += `<select data-binding="${key}" aria-label="Sorgente ${e(labels[key]??key)}"><option value="">Contenuto manuale</option>${Object.values(options.sources??{}).filter(s=>compatible(spec.binding,s)).map(s=>`<option value="${e(s.id)}" ${s.id===binding?'selected':''}>${e(s.label)} · ${e(s.type)}</option>`).join('')}</select>`;
        if (binding) content += `<small class="pb-binding">↗ ${e(binding)} · valore del record in anteprima</small>`;
        else if (spec.kind==='enum') content += `<select data-prop="${key}">${choices(spec.values,value)}</select>`;
        else if (n.type==='area') content += `<select data-prop="${key}">${(options.areas??[]).map(a=>`<option value="${e(a)}" ${a===value?'selected':''}>${e(options.areaLabels?.[a]??a)}</option>`).join('')}</select>`;
        else if (spec.kind==='list' || key==='text') content += `<textarea data-prop="${key}" rows="${n.type==='text'?10:4}">${e(Array.isArray(value)?value.join('\n'):value)}</textarea>`;
        else content += `<input data-prop="${key}" value="${e(value)}" type="text">`;
        content += '</label>';
        if(n.type==='text'&&key==='text'&&!binding) content+=button('rich-on','Attiva testo formattato','B / I · Testo formattato');
        if (mode==='template' && !binding && (spec.binding==='text' || spec.kind==='list')) content += `<label class="pb-field"><span>Inserisci variabile nel testo</span><select data-variable="${key}" aria-label="Inserisci variabile in ${e(labels[key]??key)}"><option value="">Scegli una variabile…</option>${Object.values(options.sources??{}).filter(s=>compatible('text',s)).map(s=>`<option value="${e(s.id)}">${e(s.label)}</option>`).join('')}</select></label>`;
        if (key==='src' && !binding && pickImage) content += button('image','Scegli immagine','Scegli dalla libreria');
      }
      if(propertyTab==='style') {
        const groups={Layout:['align','vertical','gap','rowGap','maxWidth'],Tipografia:['color','fontSize','fontWeight'],Sfondo:['background'],Spaziature:['padding','margin'],'Bordi e ombre':['radius','border','shadow']};
        for(const [title,keys] of Object.entries(groups)) {
          const fields=keys.filter(key=>def.styles.includes(key)).map(key=>['background','color'].includes(key)?palette(key,styles[key],localStyles[key]).replaceAll('Tema globale',device==='desktop'?'Tema globale':'Eredita'):field(labels[key]??key,`<select data-style="${key}"><option value="">${device==='desktop'?'Tema globale':'Eredita'}</option>${choices(styles[key],localStyles[key])}</select>`)).join('');
          if(fields) content+=group(title,fields);
        }
        content+=designControls(n,device,!!pickImage);
        if(device!=='desktop') content+=field('Visibilità',`<select data-visibility><option value="">Eredita</option><option value="show" ${n.responsive?.[device]?.hidden===false?'selected':''}>Mostra</option><option value="hide" ${n.responsive?.[device]?.hidden===true?'selected':''}>Nascondi</option></select>`)+button('reset-responsive','Ripristina impostazioni del dispositivo');
      }
    }
    if(propertyTab==='advanced') content+=advancedControls(n,device,button);
    if (propertyTab==='advanced' && n.type!=='column') {
      const destinations = [];
      function visit(parent) { if (parent.children && (parent.type ? catalog[parent.type].children?.includes(n.type) : n.type === (engine.document.kind==='page'?'section':'row'))) destinations.push(parent); parent.children?.forEach(visit); }
      visit(engine.document);
      content += `<label class="pb-field"><span>Sposta in…</span><select data-destination><option value="">Scegli destinazione</option>${destinations.filter(d=>d.id!==n.id && !locate({children:[n]},d.id)).map(d=>`<option value="${e(d.id??'root')}">${e(destinationLabel(d))}</option>`).join('')}</select></label>`;
      content += `<p class="pb-hint">Sposta l’elemento in un altro contenitore. I suoi contenuti e le sue impostazioni vengono mantenuti.</p><div class="pb-node-actions">${button('up','Sposta su','↑ Sposta su')}${button('down','Sposta giù','↓ Sposta giù')}${button('duplicate','Duplica elemento','Duplica')}${button('delete','Elimina elemento','Elimina','class="pb-danger"')}</div>`;
    }
    content += `<nav class="pb-breadcrumbs" aria-label="Percorso dell’elemento">${selectionPath(engine.document,selected).map((part,i,parts)=>`<button type="button" data-jump="${e(part.id)}" ${i === parts.length-1 ? 'aria-current="true"' : ''}>${e(catalog[part.type].label)}</button>`).join('<span aria-hidden="true">›</span>')}</nav>`;
    q('.pb-inspector').querySelectorAll('.pb-settings-group').forEach(g=>groupState.set(g.querySelector('summary').textContent,g.open));
    q('.pb-inspector').innerHTML = content;
    q('.pb-inspector').querySelectorAll('.pb-settings-group').forEach(g=>{const name=g.querySelector('summary').textContent;if(groupState.has(name))g.open=groupState.get(name);});
    richRange=null;richInvalid=false;
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
      lastHtml=html;
      frame.onload = () => {
        highlight(); frame.contentWindow.scrollTo(0,scroll);
        const doc=frame.contentDocument;
        const tools=doc.createElement('div');tools.className='pb-inline-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Azioni rapide elemento');
        tools.innerHTML='<button type="button" data-inline="edit">Modifica</button><button type="button" data-inline="duplicate">Duplica</button><button type="button" data-inline="delete">Elimina</button>';
        doc.body.append(tools);tools.hidden=true;
        let targetId=null;
        doc.addEventListener('mouseover',event=>{
          const el=event.target.closest('[data-pb-id]'); if(!el){if(!tools.contains(event.target)){tools.hidden=true;hover(null);}return;}
          targetId=el.dataset.pbId;hover(targetId);
          const rect=el.getBoundingClientRect();tools.hidden=false;tools.style.top=`${Math.max(0,rect.top)}px`;tools.style.left=`${Math.max(0,Math.min(rect.left,doc.documentElement.clientWidth-240))}px`;
          const isColumn=locate(engine.document,targetId)?.node.type==='column';tools.querySelectorAll('[data-inline]').forEach(b=>b.disabled=isColumn&&b.dataset.inline!=='edit');
        });
        doc.addEventListener('mouseleave',()=>{tools.hidden=true;hover(null);});
        doc.addEventListener('scroll',()=>{tools.hidden=true;hover(null);},true);
        doc.addEventListener('click',event=>{const control=event.target.closest('[data-inline]');if(!control)return;event.preventDefault();event.stopImmediatePropagation();choose(targetId);if(control.dataset.inline!=='edit')q(`[data-action=${control.dataset.inline}]`).click();});
        frame.contentDocument.addEventListener('click',event=>{
          event.preventDefault(); const id = event.target.closest('[data-pb-id]')?.dataset.pbId;
          if (id && locate(engine.document,id)) choose(id);
        });
      };
      frame.srcdoc = `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https:; style-src http: https: 'unsafe-inline'; font-src http: https:; base-uri 'none'; form-action 'none'">${css.map(url=>`<link rel="stylesheet" href="${e(url)}">`).join('')}${defaultVariablesStyle(options)}<style>body{margin:0;background:white}.pb-node{position:relative;cursor:pointer}.pb-selected{outline:2px solid #347565;outline-offset:3px}.pb-column:empty{min-height:90px;border:1px dashed #b8c9c3}.pb-section:empty{min-height:120px}.pb-image:empty{min-height:100px;background:#f2f4f1}.pb-document:empty{min-height:200px}.pb-hovered{outline:1px dashed #347565!important;outline-offset:2px}.pb-inline-tools{position:fixed;z-index:100000;display:flex;background:#fff;border:1px solid #cad9c4;border-radius:4px;box-shadow:0 3px 12px #0002;font:12px sans-serif}.pb-inline-tools[hidden]{display:none}.pb-inline-tools button{border:0;background:transparent;padding:6px;cursor:pointer}.pb-inline-tools button:disabled{opacity:.4}</style></head><body>${html}</body></html>`;
    } catch (err) { if (err.name!=='AbortError' && seq===sequence) { error=`Anteprima non disponibile: ${err.message}`; status(); } }
  }
  function hover(id) {
    frame.contentDocument?.querySelectorAll('[data-pb-id]').forEach(n=>n.classList.toggle('pb-hovered',n.dataset.pbId===id));
    root.querySelectorAll('[data-select]').forEach(n=>n.classList.toggle('pb-hovered',n.dataset.select===id));
  }
  function setDevice(next) {
    device=next;const size={desktop:'1280px',tablet:'820px',mobile:'390px'}[device];q('.pb-preview-wrap').style.width=size;
    q('.pb-size-label').textContent={desktop:'Desktop · 1280 px',tablet:'Tablet · 820 px',mobile:'Mobile · 390 px'}[device];
    root.querySelectorAll('.pb-devices button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===device)));
    fitPreview();if(propertyTab!=='content')inspector();
  }
  function changeStyle(group,key,value) {if(device==='desktop')engine.update(selected,group,key,value);else engine.responsive(selected,device,group,key,value);}
  function insertRichHtml(html) {
    const editor=q('[data-rich-editor]');editor.focus();const selection=window.getSelection();
    let range=selection.rangeCount&&editor.contains(selection.getRangeAt(0).commonAncestorContainer)?selection.getRangeAt(0):richRange;
    if(!range||!editor.contains(range.commonAncestorContainer)){range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}
    const fragment=range.createContextualFragment(html),tail=document.createTextNode('');fragment.append(tail);
    range.deleteContents();range.insertNode(fragment);range.setStart(tail,0);range.collapse(true);selection.removeAllRanges();selection.addRange(range);richRange=range.cloneRange();
  }
  function syncRich() {
    try {
      const blocks=readRich(q('[data-rich-editor]'),safeUrl);
      engine.change(doc=>{const n=locate(doc,selected).node;n.props.richText=blocks;n.props.text=richPlain(blocks);});
      richInvalid=false;refresh(false);
    } catch(err) {richInvalid=true;throw err;}
  }
  function showCode() {
    q('[data-code]').value=codeTab==='html'?lastHtml:codeDraft;
    q('[data-code]').readOnly=codeTab==='html';q('[data-action=code-apply]').hidden=codeTab!=='json';
    q('.pb-code-hint').textContent=codeTab==='html'?'HTML dell’anteprima corrente, inclusi gli stili. La modifica avviene dai blocchi o dal JSON.':'Documento strutturato modificabile. Applica valida l’intero documento; puoi annullare prima di salvare.';
    q('.pb-code-error').textContent='';
  }
  function refresh(full = true) {
    notice='';
    if (selected && !locate(engine.document,selected)) { selected=null; sidebarPage='builder'; }
    selectionPath(engine.document,selected).slice(0,-1).forEach(n=>collapsed.delete(n.id));
    tree(); if (full) inspector(); else contextbar(); status(); preview();
  }
  function importDocument(document) {
    if (!engine || loading || saving || loadFailed) throw new Error('Attendi il caricamento del documento prima di importare.');
    engine.import(document); selected=null; sidebarPage='builder'; collapsed.clear(); refresh();
  }
  async function load() {
    loading=true; error=''; status();
    try {
      raw = options.adapter.load ? await options.adapter.load() : clone(options.document);
      const next = new Engine(raw,catalog,styles,{mode,kind:options.kind??null,sources:mode==='template'?options.sources:null,areas:mode==='template'?options.areas:null});
      engine=next; loadFailed=false; selected=null; sidebarPage='builder'; collapsed.clear(); refresh();
    } catch (err) { loadFailed=true; error=`Caricamento non riuscito: ${err.message}. Il documento non è stato sovrascritto.`; }
    finally { loading=false; status(); }
  }
  function insertNode(parentId, type, afterId = null, props = {}) {
    const fresh = node(type,catalog,props);
    engine.change(doc => {
      const parent = parentId ? locate(doc,parentId)?.node : doc;
      if (!parent?.children) throw new Error('La destinazione non è più disponibile.');
      const index = afterId === null ? parent.children.length : parent.children.findIndex(n=>n.id===afterId)+1;
      if (afterId !== null && index === 0) throw new Error('L’elemento di inserimento non è più disponibile.');
      parent.children.splice(index,0,fresh);
    });
    return fresh.id;
  }
  function renderCatalog() {
    const search = q('[data-catalog-search]').value.trim().toLocaleLowerCase('it');
    const entries = Object.entries(catalog).filter(([type,d]) => !d.children && (!d.templateOnly || mode==='template') && `${d.label} ${(elementInfo[type]??[]).join(' ')}`.toLocaleLowerCase('it').includes(search));
    q('.pb-catalog-count').textContent = `${entries.length} ${entries.length === 1 ? 'elemento disponibile' : 'elementi disponibili'}`;
    q('.pb-catalog-grid').innerHTML = entries.map(([type,d]) => {
      const [group, description] = elementInfo[type] ?? ['Dal progetto', 'Elemento personalizzato'];
      return button(`insert:${type}`,`Aggiungi ${d.label}`,`<span class="pb-catalog-icon">${e(d.icon)}</span><small>${e(group)}</small><strong>${e(d.label)}</strong><p>${e(description)}</p>`);
    }).join('') || '<p class="pb-catalog-empty">Nessun elemento trovato. Prova con un altro nome.</p>';
  }
  function catalogDialog(id, afterId = null) {
    insertion = {parentId:id, afterId};
    const after = afterId && locate(engine.document,afterId)?.node;
    q('.pb-catalog-context').textContent = after ? `Inserisci dopo: ${caption(after) || catalog[after.type].label}` : 'Inserisci nella colonna selezionata';
    q('[data-catalog-search]').value=''; renderCatalog();
    q('dialog').showModal(); q('[data-catalog-search]').focus();
  }
  root.addEventListener('click',async event=>{
    const select=event.target.closest('[data-select]');
    if (select && engine) { choose(select.dataset.select,true); return; }
    const jump=event.target.closest('[data-jump]');
    if (jump && engine) { choose(jump.dataset.jump,true); return; }
    const action=event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    try {
      error='';
      if (action==='import') { q('[data-import]').click(); return; }
      if (action==='export') {
        const blob = new Blob([JSON.stringify(loadFailed?raw:engine?.document??raw,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pagebuilder.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
      }
      if (action==='reload') { if (!(engine?.dirty || options.isDirty?.()) || window.confirm('Riaprire il documento salvato? Le modifiche locali verranno perse. Puoi prima esportarle.')) await load(); return; }
      if (['desktop','tablet','mobile'].includes(action)||action.startsWith('device:')) { setDevice(action.replace('device:',''));return;}
      if(action==='fullscreen'){root.classList.toggle('pb-fullscreen');q('[data-action=fullscreen]').setAttribute('aria-pressed',String(root.classList.contains('pb-fullscreen')));return;}
      if(action==='code-close'){q('.pb-code-dialog').close();return;}
      if(action==='code-copy'){try{await navigator.clipboard.writeText(q('[data-code]').value);q('.pb-code-error').textContent='Codice copiato.';}catch{q('[data-code]').select();q('.pb-code-error').textContent='Premi ⌘C / Ctrl+C per copiare.';}return;}
      if(action==='code-html'||action==='code-json'){if(codeTab==='json')codeDraft=q('[data-code]').value;codeTab=action.slice(5);showCode();return;}
      if(action==='code-apply'){try{importDocument(JSON.parse(q('[data-code]').value));q('.pb-code-dialog').close();}catch(err){q('.pb-code-error').textContent=`JSON non applicato: ${err.message}`;}return;}
      if (action==='close') { q('dialog').close();return; }
      if (action==='hide-sidebar' || action==='show-sidebar') {
        q('.pb-sidebar').hidden=action==='hide-sidebar'; q('[data-action=show-sidebar]').hidden=action!=='hide-sidebar'; return;
      }
      if (!engine || loading || loadFailed) return;
      if(action==='code'){await preview();codeDraft=JSON.stringify(engine.document,null,2);codeTab='html';showCode();q('.pb-code-dialog').showModal();return;}
      if(action==='copy-style'){const n=locate(engine.document,selected).node;copiedStyle=clone({styles:n.styles,design:n.design,responsive:n.responsive});notice='Stili copiati';q('[data-action=copy-style]').textContent='Stili copiati ✓';status();return;}
      if(action==='paste-style'){if(!copiedStyle)throw new Error('Copia prima gli stili di un elemento.');engine.pasteStyles(selected,copiedStyle);refresh();return;}
      if(action==='reset-responsive'){engine.change(doc=>{delete locate(doc,selected).node.responsive?.[device];});refresh();return;}
      if(action==='rich-on'||action==='rich-off'){engine.change(doc=>{const n=locate(doc,selected).node;n.props.richText=action==='rich-on'?fromPlain(n.props.text??catalog[n.type].props.text.default):[];});refresh();return;}
      if(action.startsWith('rich:')) {
        const editor=q('[data-rich-editor]');editor.focus();
        if(richRange&&editor.contains(richRange.commonAncestorContainer)){const selection=window.getSelection();selection.removeAllRanges();selection.addRange(richRange);}
        const cmd=action.slice(5);let value=null;
        if(cmd==='link'){value=window.prompt('URL del collegamento (https://…, /percorso o #ancora)');if(value===null)return;if(!value||safeUrl(value)!==value)throw new Error('Collegamento non valido.');}
        document.execCommand(cmd==='link'?'createLink':cmd,false,value);syncRich();return;
      }
      if(action.startsWith('table-')) {
        engine.change(doc=>{const p=locate(doc,selected).node.props;p.columns??=clone(catalog.table.props.columns.default);p.rows??=clone(catalog.table.props.rows.default);const i=Number(action.split(':')[1]);
          if(action==='table-addrow')p.rows.push(p.columns.map(()=>''));
          if(action==='table-addcol'){p.columns.push('Nuova colonna');p.rows.forEach(row=>row.push(''));}
          if(action.startsWith('table-delrow:'))p.rows.splice(i,1);
          if(action.startsWith('table-delcol:')){p.columns.splice(i,1);p.rows.forEach(row=>row.splice(i,1));}
        });refresh();return;
      }
      if(action.startsWith('responsive-grid:')) {
        const n=locate(engine.document,selected).node;
        const variants=[Array(n.children.length).fill('1-1'),...layouts.filter(l=>l.length===n.children.length)];
        engine.responsive(selected,device,null,'columns',action.endsWith(':inherit')?undefined:variants[Number(action.split(':')[1])]);refresh();return;
      }
      if (action==='builder') { builder(); return; }
      const target=event.target.closest('[data-node-target]')?.dataset.nodeTarget;
      if (target) selected=target;
      if (action.startsWith('view:')) { structureView=action.slice(5); tree(); return; }
      if (action.startsWith('toggle:')) {
        const id=action.slice(7); collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); tree(); return;
      }
      if (action==='parent') { const parent=locate(engine.document,selected)?.parent; if(parent?.id) choose(parent.id,true); return; }
      if (action==='add' || action.startsWith('after:')) {
        const found=locate(engine.document,action==='add'?selected:action.slice(6));
        if (!found) return;
        if (found.node.type==='column') { catalogDialog(found.node.id); return; }
        if (!catalog[found.node.type].children) { catalogDialog(found.parent.id,found.node.id); return; }
        selected=insertNode(found.parent.id,found.node.type,found.node.id); refresh(); return;
      }
      if (action==='save') {
        if (saving) return;
        saving=true; const snapshot=clone(engine.document);status();
        try { await options.adapter.save(snapshot); engine.markSaved(snapshot); notice='✓ Salvato adesso'; }
        catch(err) { error=`Salvataggio non riuscito: ${err.message}. Le modifiche sono ancora nell’editor.`; }
        finally { saving=false;status(); }return;
      }
      if (action.startsWith('catalog:')) { catalogDialog(action.slice(8));return; }
      if (action.startsWith('insert:')) {
        if (!insertion) return;
        selected=insertNode(insertion.parentId,action.slice(7),insertion.afterId,action.slice(7)==='area'?{area:options.areas?.[0]??'description'}:{});
        sidebarPage='inspector'; propertyTab='content';
        q('.pb-sidebar').hidden=false; q('[data-action=show-sidebar]').hidden=true;
        insertion=null;
        q('dialog').close();
      }
      if (action.startsWith('palette:')) {
        const [,group,key,value] = action.split(':');
        if(group==='styles')changeStyle(group,key,value||undefined);else engine.update(selected,group,key,value||undefined);
        refresh();
        [...q('.pb-inspector').querySelectorAll('[data-action]')].find(b=>b.dataset.action===action)?.focus({preventScroll:true});
        return;
      }
      if (action==='root') selected=engine.add(null,engine.document.kind==='page'?'section':'row');
      if (action.startsWith('addrow:')) selected=engine.add(action.slice(7),'row');
      if (action.startsWith('grid:')) engine.grid(selected,layouts[Number(action.slice(5))]);
      if (action==='undo') engine.undo(); if(action==='redo')engine.redo();
      if (action==='duplicate') selected=engine.duplicate(selected);
      if (action==='delete') {engine.remove(selected);selected=null;}
      if (action==='up') engine.reorder(selected,-1); if(action==='down')engine.reorder(selected,1);
      if (action==='content' || action==='style' || action==='advanced') { propertyTab=action; inspector(); q(`.pb-tabs [data-action=${action}]`).focus({preventScroll:true}); status(); return; }
      if (action==='image' || action==='background-image') {
        const current=engine,id=selected,targetDevice=device,background=action==='background-image';
        const result=await pickImage({target:background?'background':'image'});
        if(disposed || current!==engine || !locate(engine.document,id))return;
        if(result)engine.change(doc=>{
          const n=locate(doc,id).node;
          if(background){
            let target=n;if(targetDevice!=='desktop'){n.responsive??={};target=n.responsive[targetDevice]??={};}
            target.design??={};target.design.backgroundImage=result.url;
            if(!target.design.backgroundSize && !n.design?.backgroundSize)target.design.backgroundSize='cover';
          } else {n.props.src=result.url;n.props.alt=result.alt??'';}
        });
      }
      refresh();
    } catch(err){error=err.message;status();}
  },{signal:abort.signal});
  q('[data-import]').addEventListener('change', async event => {
    const file = event.target.files[0], current = engine;
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1048576) throw new Error('Documento oltre 1 MB');
      const document = JSON.parse(await file.text());
      new Engine(document, catalog, styles, {...engine.options, kind: engine.document.kind});
      if (disposed || current !== engine) return;
      if (!window.confirm('Importare questo documento? Sostituisce il contenuto nell’editor. Puoi annullare prima di salvare.')) return;
      importDocument(document);
    } catch (err) { error = `Importazione non riuscita: ${err.message}`; status(); }
  }, {signal: abort.signal});
  function propertyChange(event) {
    if (!engine || !selected) return;
    const t=event.target;
    try {
      error=''; t.setCustomValidity?.('');
      if(t.hasAttribute('data-rich-variable')&&t.value) {
        const editor=q('[data-rich-editor]');editor.focus();const selection=window.getSelection();
        if(richRange&&editor.contains(richRange.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(richRange);}else{const r=document.createRange();r.selectNodeContents(editor);r.collapse(false);selection.removeAllRanges();selection.addRange(r);}
        insertRichHtml(richMarkup([{type:'paragraph',children:[{text:`{{ ${t.value} }}`}]}],options.sources).replace(/^<p>|<\/p>$/g,''));
        t.value='';syncRich();return;
      }
      if(t.closest('[data-rich-editor]')){syncRich();return;}
      if(t.dataset.meta){engine.update(selected,'meta',t.dataset.meta,t.type==='checkbox'?t.checked:t.value.trim());}
      else if(t.dataset.design){changeStyle('design',t.dataset.design,t.value.trim()||undefined);}
      else if(t.hasAttribute('data-design-code')) {
        const design=parseDesign(t.value,safeUrl);
        engine.change(doc=>{const n=locate(doc,selected).node;if(device==='desktop')n.design=design;else{n.responsive??={};n.responsive[device]??={};n.responsive[device].design=design;}});
      }
      else if(t.hasAttribute('data-visibility')) engine.responsive(selected,device,null,'hidden',t.value===''?undefined:t.value==='hide');
      else if(t.hasAttribute('data-table-header')||t.hasAttribute('data-table-cell'))engine.change(doc=>{const p=locate(doc,selected).node.props;p.columns??=clone(catalog.table.props.columns.default);p.rows??=clone(catalog.table.props.rows.default);if(t.hasAttribute('data-table-header'))p.columns[Number(t.dataset.tableHeader)]=t.value;else{const [r,c]=t.dataset.tableCell.split(':').map(Number);p.rows[r][c]=t.value;}});
      else if (t.dataset.variable && t.value) {
        const input=q(`[data-prop="${t.dataset.variable}"]`), token=`{{ ${t.value} }}`;
        const start=input.selectionStart??input.value.length, end=input.selectionEnd??start;
        input.value=input.value.slice(0,start)+token+input.value.slice(end);
        const spec=catalog[locate(engine.document,selected).node.type].props[t.dataset.variable];
        engine.update(selected,'props',t.dataset.variable,spec.kind==='list'?input.value.split('\n'):input.value);
        input.setCustomValidity(''); t.value=''; input.focus(); input.setSelectionRange(start+token.length,start+token.length);
      }
      else if(t.dataset.prop){const spec=catalog[locate(engine.document,selected).node.type].props[t.dataset.prop];engine.update(selected,'props',t.dataset.prop,spec.kind==='list'?t.value.split('\n'):t.value);}
      else if(t.dataset.style)changeStyle('styles',t.dataset.style,t.value||undefined);
      else if(t.dataset.binding){engine.update(selected,'bindings',t.dataset.binding,t.value||undefined);inspector();}
      else if(t.hasAttribute('data-destination')&&t.value){const target=t.value==='root'?null:t.value;engine.move(selected,target,500);inspector();}
      else return;
      refresh(false);
    }catch(err){t.setCustomValidity?.(err.message);error=`Il valore non è stato applicato: ${err.message}`;status();}
  }
  root.addEventListener('change',propertyChange,{signal:abort.signal});
  root.addEventListener('input',event=>{if(event.target.matches('[data-catalog-search]')) renderCatalog(); else if(event.target.matches('textarea:not([data-code]),[data-prop=text],[data-prop=alt],[data-rich-editor],[data-table-cell],[data-table-header]'))propertyChange(event);},{signal:abort.signal});
  root.addEventListener('mouseover',event=>{const el=event.target.closest('[data-select]');if(el)hover(el.dataset.select);},{signal:abort.signal});
  q('.pb-tree').addEventListener('mouseleave',()=>hover(null),{signal:abort.signal});
  root.addEventListener('mousedown',event=>{if(event.target.closest('[data-action^="rich:"]'))event.preventDefault();},{signal:abort.signal});
  document.addEventListener('selectionchange',()=>{const editor=q('[data-rich-editor]'),selection=window.getSelection();if(editor&&selection?.rangeCount&&editor.contains(selection.anchorNode))richRange=selection.getRangeAt(0).cloneRange();},{signal:abort.signal});
  root.addEventListener('paste',event=>{if(!event.target.closest('[data-rich-editor]'))return;event.preventDefault();const html=event.clipboardData.getData('text/html');const inert=new DOMParser().parseFromString(html||e(event.clipboardData.getData('text/plain')).replaceAll('\n','<br>'),'text/html');try{insertRichHtml(richMarkup(readRich(inert.body,safeUrl),options.sources));syncRich();}catch(err){error=`Testo non applicato: ${err.message}`;status();}},{signal:abort.signal});
  root.addEventListener('dragstart',event=>{dragged=event.target.closest('[data-select]')?.dataset.select; if(dragged)event.dataTransfer.setData('text/plain',dragged);},{signal:abort.signal});
  root.addEventListener('dragend',()=>{dragged=null;},{signal:abort.signal});
  root.addEventListener('dragover',event=>{if(event.target.closest('[data-select],[data-drop-parent]'))event.preventDefault();},{signal:abort.signal});
  root.addEventListener('drop',event=>{
    event.preventDefault();const targetId=event.target.closest('[data-select]')?.dataset.select ?? event.target.closest('[data-drop-parent]')?.dataset.dropParent;
    if(!dragged||!targetId||dragged===targetId)return;
    try{const from=locate(engine.document,dragged),to=locate(engine.document,targetId);const isParent=catalog[to.node.type].children?.includes(from.node.type);engine.move(dragged,isParent?to.node.id:to.parent.id,isParent?to.node.children.length:to.index);selected=dragged;refresh();}catch(err){error=err.message;status();}finally{dragged=null;}
  },{signal:abort.signal});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape')root.classList.remove('pb-fullscreen');
    if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();q('[data-action=save]').click();}
    if((event.ctrlKey||event.metaKey)&&event.key==='z'&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();engine?.[event.shiftKey?'redo':'undo']();refresh();}
  },{signal:abort.signal});
  window.addEventListener('beforeunload',event=>{if(engine?.dirty || options.isDirty?.()){event.preventDefault();event.returnValue='';}},{signal:abort.signal});
  await load();
  return {get engine(){return engine;},get busy(){return saving || loading;},importDocument,reload:load,refreshStatus:status,async setPreview(values,areaDocuments={}){options.values=values;options.areaDocuments=areaDocuments;await preview();},destroy(){disposed=true;managedPicker?.destroy();abort.abort();previewResize.disconnect();previewRequest?.abort();frame.onload=null;root.replaceChildren();}};
}
