import {escape as e} from './render.js';
import {safeUrl} from './core.js';

const imageUrl = url => typeof url === 'string' && /^(https?:\/\/|\/(?!\/))/.test(url) && safeUrl(url) === url;
const sizeLabel = bytes => bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

/** Independent picker: the host supplies a scoped, authenticated media endpoint. */
export function createMediaPicker(root, options) {
  const config = options.mediaLibrary;
  const endpoint = new URL(config.url, root.ownerDocument.baseURI);
  if (endpoint.origin !== location.origin) throw new Error('La libreria immagini deve appartenere a questo sito.');
  const dialog = document.createElement('dialog');
  dialog.className = 'pb-media-dialog'; dialog.setAttribute('aria-label', 'Libreria immagini');
  dialog.innerHTML = `<header class="pb-dialog-heading"><div><small>MEDIA MANAGER</small><h2>${e(config.label || 'Immagini del builder')}</h2></div><button type="button" data-media-close aria-label="Chiudi libreria immagini">×</button></header>
    <div class="pb-media-tabs"><button type="button" data-media-tab="library" aria-pressed="true">Libreria</button>${config.canUpload?'<button type="button" data-media-tab="upload" aria-pressed="false">Carica immagini</button>':''}</div>
    <p class="pb-media-error" role="alert" hidden></p><p class="pb-media-status" role="status" aria-live="polite"></p>
    <section data-media-panel="library"><div class="pb-media-filters"><label>Cerca immagini<input type="search" data-media-search placeholder="Cerca per nome…"></label><label>Cartella<select data-media-folder aria-label="Filtra per cartella"><option value="">Tutte le cartelle</option></select></label><button type="button" data-media-reload>Aggiorna libreria</button></div>
      <div class="pb-media-body"><div><div class="pb-media-items"></div><nav class="pb-media-pages" aria-label="Pagine della libreria"><button type="button" data-media-page="prev">← Precedente</button><span></span><button type="button" data-media-page="next">Successiva →</button></nav></div><aside class="pb-media-detail" aria-label="Dettagli immagine"><p>Seleziona un’immagine per vedere i dettagli.</p></aside></div></section>
    <section data-media-panel="upload" hidden><div class="pb-media-drop"><strong>Trascina qui le immagini</strong><p>JPEG, PNG, WebP o GIF · massimo ${e(sizeLabel(config.maxBytes || 10485760))} per file</p><label class="pb-media-file-button">Scegli dal computer<input type="file" data-media-file accept="image/jpeg,image/png,image/webp,image/gif" multiple></label></div><p data-media-files>Nessun file selezionato</p>
      <div class="pb-media-upload-fields"><label>Nome immagine<input data-media-upload-name maxlength="160" placeholder="Nome del file, se lasciato vuoto"></label><label>Cartella di destinazione<input data-media-upload-folder maxlength="120" placeholder="Es. Loghi, Sfondi, Eventi"></label><label>Testo alternativo<input data-media-upload-alt maxlength="500" placeholder="Descrivi l’immagine"></label></div><p class="pb-hint">Le immagini caricate saranno disponibili nella libreria e nei documenti in cui le inserisci.</p><button type="button" data-media-upload class="pb-primary" disabled>Carica nella libreria</button></section>
    <footer class="pb-media-footer"><button type="button" data-media-close>Annulla</button><button type="button" data-media-insert class="pb-primary" disabled>Inserisci immagine</button></footer>`;
  root.append(dialog);
  const q = selector => dialog.querySelector(selector);
  let selected = null, items = [], files = [], page = 1, lastPage = 1, busy = false, pending = null, result = null, sequence = 0, request, timer, disposed = false, tab = 'library';
  const error = message => { q('.pb-media-error').textContent = message; q('.pb-media-error').hidden = !message; };
  const status = message => { q('.pb-media-status').textContent = message; };
  const controls = () => {
    dialog.querySelectorAll('[data-media-close],[data-media-tab],[data-media-reload],[data-media-search],[data-media-folder],[data-media-file],.pb-media-upload-fields input,.pb-media-detail input').forEach(el => el.disabled = busy);
    q('[data-media-upload]').disabled = busy || !files.length;
    q('[data-media-insert]').disabled = busy || !selected || tab !== 'library';
    q('[data-media-page=prev]').disabled = busy || page <= 1; q('[data-media-page=next]').disabled = busy || page >= lastPage;
    q('[data-media-save]') && (q('[data-media-save]').disabled = busy);
  };
  async function api(url, {method='GET', body, signal}={}) {
    const response = await fetch(url, {method, body, signal, credentials:'same-origin', cache:'no-store',
      headers:{Accept:'application/json', 'X-CSRF-TOKEN':options.csrfToken ?? document.querySelector('meta[name="csrf-token"]')?.content ?? '', ...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{})}});
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(response.status === 413 ? 'File troppo grande per il server.' : response.status === 419 ? 'Sessione scaduta. Riapri la pagina prima di caricare.' : Object.values(data.errors ?? {}).flat().join(' ') || data.message || 'La libreria non è disponibile.');
    return data;
  }
  function showTab(next) {
    tab=next; dialog.querySelectorAll('[data-media-panel]').forEach(el=>el.hidden=el.dataset.mediaPanel!==next);
    dialog.querySelectorAll('[data-media-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mediaTab===next)));
    controls();
  }
  function detail() {
    if (!selected) {q('.pb-media-detail').innerHTML='<p>Seleziona un’immagine per vedere i dettagli.</p>';controls();return;}
    q('.pb-media-detail').innerHTML=`<img src="${e(selected.thumbnail || selected.url)}" alt="${e(selected.alt || '')}"><p>${selected.width && selected.height?`${e(selected.width)} × ${e(selected.height)} px · `:''}${e(sizeLabel(selected.bytes || 0))}</p>
      <label>Nome immagine<input data-media-name value="${e(selected.name)}" maxlength="160" required ${config.canUpdate?'':'readonly'}></label>
      <label>Testo alternativo<input data-media-alt value="${e(selected.alt || '')}" maxlength="500"></label>
      <label>Cartella<input data-media-detail-folder value="${e(selected.folder || '')}" maxlength="120" ${config.canUpdate?'':'readonly'}></label>
      ${config.canUpdate?'<button type="button" data-media-save>Salva dettagli nella libreria</button>':''}<small>Il testo alternativo viene inserito nel blocco. Gli sfondi sono decorativi.</small>`;
    controls();
  }
  function grid() {
    q('.pb-media-items').innerHTML = items.length ? items.map(item=>`<button type="button" data-media-id="${e(item.id)}" aria-label="Seleziona ${e(item.name)}" aria-pressed="${selected?.id===item.id}"><img loading="lazy" src="${e(item.thumbnail || item.url)}" alt=""><span>${e(item.name)}</span><small>${e(item.folder || 'Senza cartella')}</small></button>`).join('') : '<p class="pb-media-empty">Nessuna immagine trovata. Carica un file oppure modifica la ricerca.</p>';
    q('.pb-media-pages span').textContent=`Pagina ${page} di ${lastPage}`; controls();
  }
  async function load() {
    clearTimeout(timer); request?.abort(); request=new AbortController(); const current=++sequence;
    status('Caricamento immagini…'); error('');
    const url=new URL(endpoint);url.searchParams.set('q',q('[data-media-search]').value);url.searchParams.set('folder',q('[data-media-folder]').value);url.searchParams.set('page',page);
    try {
      const data=await api(url,{signal:request.signal});if(disposed || current!==sequence || !dialog.open)return;
      items=(data.data || []).filter(item=>imageUrl(item.url) && (!item.thumbnail || imageUrl(item.thumbnail))).map(item=>({...item,id:String(item.id)}));
      page=data.page || 1;lastPage=data.lastPage || 1;
      const folder=q('[data-media-folder]').value;
      const folders=[...new Set([...(data.folders || []),...(folder?[folder]:[])])];
      q('[data-media-folder]').innerHTML='<option value="">Tutte le cartelle</option>'+folders.map(f=>`<option value="${e(f)}" ${f===folder?'selected':''}>${e(f)}</option>`).join('');
      grid();status(`${data.total ?? items.length} immagini nella libreria`);
    } catch(err) {if(err.name!=='AbortError' && current===sequence){error(err.message);status('');}}
  }
  function selectFiles(next) {
    error('');
    const candidates=Array.from(next);
    files=[];q('[data-media-files]').textContent='Nessun file selezionato';controls();
    if(candidates.length>10){error('Seleziona al massimo 10 immagini alla volta.');return;}
    const invalid=candidates.find(file=>!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size>(config.maxBytes || 10485760));
    if(invalid){error(`${invalid.name}: formato non supportato o file troppo grande.`);return;}
    files=candidates;q('[data-media-files]').textContent=files.length?files.map(file=>`${file.name} (${sizeLabel(file.size)})`).join(', '):'Nessun file selezionato';controls();
  }
  async function upload() {
    if(busy || !files.length || !config.canUpload)return;
    busy=true;controls();error('');let failure='';let uploaded=null;
    try {
      for(let i=0;i<files.length;i++) {
        status(`Caricamento ${i+1} di ${files.length}…`);
        const file=files[i],body=new FormData();body.set('file',file);
        body.set('name',(files.length===1 && q('[data-media-upload-name]').value.trim() || file.name.replace(/\.[^.]+$/,'')).slice(0,160));
        body.set('folder',q('[data-media-upload-folder]').value.trim());body.set('alt',q('[data-media-upload-alt]').value.trim());
        uploaded=await api(endpoint,{method:'POST',body});if(disposed)return;
      }
    } catch(err){failure=err.message;}
    finally {busy=false;controls();}
    if(uploaded){selected={...uploaded,id:String(uploaded.id)};files=[];q('[data-media-file]').value='';q('[data-media-files]').textContent='Nessun file selezionato';page=1;q('[data-media-search]').value='';q('[data-media-folder]').value='';showTab('library');detail();await load();}
    status(failure?'Caricamento interrotto. Controlla la libreria prima di riprovare: le immagini già caricate restano disponibili.':'Immagini caricate. Puoi inserirle nel documento.');error(failure);
  }
  async function saveDetails() {
    if(!selected || busy || !config.canUpdate || !q('[data-media-name]').reportValidity())return;
    busy=true;controls();error('');
    try {
      const body=JSON.stringify({name:q('[data-media-name]').value.trim(),alt:q('[data-media-alt]').value.trim(),folder:q('[data-media-detail-folder]').value.trim()});
      const saved=await api(`${endpoint.href.replace(/\/$/,'')}/${encodeURIComponent(selected.id)}`,{method:'PATCH',body});
      if(disposed)return; selected={...saved,id:String(saved.id)};detail();await load();status('Dettagli salvati nella libreria.');
    } catch(err){error(err.message);} finally {busy=false;controls();}
  }
  dialog.addEventListener('click',event=>{
    event.stopPropagation();const target=event.target.closest('button');if(!target || busy)return;
    if(target.hasAttribute('data-media-close'))dialog.close();
    if(target.dataset.mediaTab)showTab(target.dataset.mediaTab);
    if(target.hasAttribute('data-media-reload'))load();
    if(target.dataset.mediaPage){page+=target.dataset.mediaPage==='next'?1:-1;load();}
    if(target.dataset.mediaId){selected=items.find(item=>item.id===target.dataset.mediaId);detail();grid();}
    if(target.hasAttribute('data-media-upload'))upload();
    if(target.hasAttribute('data-media-save'))saveDetails();
    if(target.hasAttribute('data-media-insert') && selected){result={url:selected.url,alt:q('[data-media-alt]').value};dialog.close();}
  });
  dialog.addEventListener('input',event=>{event.stopPropagation();if(event.target.hasAttribute('data-media-search')){page=1;clearTimeout(timer);timer=setTimeout(load,250);}});
  dialog.addEventListener('change',event=>{event.stopPropagation();if(event.target.hasAttribute('data-media-file'))selectFiles(event.target.files);if(event.target.hasAttribute('data-media-folder')){page=1;load();}});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{request?.abort();clearTimeout(timer);sequence++;const resolve=pending;pending=null;resolve?.(result);result=null;});
  const drop=q('.pb-media-drop');
  drop.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();if(!busy)drop.classList.add('is-dragging');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('is-dragging'));
  drop.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();drop.classList.remove('is-dragging');if(!busy)selectFiles(event.dataTransfer.files);});
  const pick = ({target='image'}={}) => {
    if(disposed || pending)return Promise.resolve(null);
    selected=null;result=null;page=1;error('');detail();showTab('library');
    q('[data-media-insert]').textContent=target==='background'?'Usa come sfondo':'Inserisci immagine';
    dialog.showModal();load();return new Promise(resolve=>{pending=resolve;});
  };
  pick.destroy = () => {disposed=true;request?.abort();clearTimeout(timer);pending?.(null);pending=null;dialog.remove();};
  return pick;
}
