import {mountEditor} from './editor.js';
import {clone, safeUrl} from './core.js';
import {escape as e} from './render.js';
import {previewStyles, loadVariables, defaultVariablesStyle} from './theme.js';

export function workspaceClient({csrfToken} = {}) {
  return async (url, method = 'GET', body, signal) => {
    const response = await fetch(url, {method, signal, credentials: 'same-origin', headers: {
      Accept: 'application/json', ...(body ? {'Content-Type': 'application/json'} : {}),
      ...(csrfToken ? {'X-CSRF-TOKEN': csrfToken} : {}),
    }, ...(body ? {body: JSON.stringify(body)} : {})});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 409
      ? 'Modificato in un’altra finestra. Esporta le modifiche e riapri prima di salvare.'
      : result.message || `Richiesta fallita (${response.status})`);
    return result;
  };
}

/** Record URLs and available media are supplied by the host, never inferred from model names. */
export async function mountWorkspace(root, options) {
  loadVariables(root, options);
  const request = workspaceClient(options), abort = new AbortController();
  const records = options.records ?? [];
  if (!records.length) { root.textContent = 'Nessun record modificabile disponibile.'; return {destroy() {}}; }
  let record = records[0], area = record.areas[0], mode = 'area', templates = [], templateId = null;
  let entity, editor, busy = false, editorBusy = false, disposed = false, nameAction, canCreate = true;
  root.classList.add('pb-manager');
  root.innerHTML = `<fieldset class="pb-manager-controls"><legend class="pb-sr-only">Gestione contenuti</legend>
    <label>Record<select data-record></select></label><label>Area<select data-area></select></label>
    <label>Modifica<select data-mode><option value="area">Contenuto del record</option><option value="template">Template condivisi</option></select></label>
    <label data-template-label>Template<select data-template></select></label>
    <div class="pb-manager-actions"><button type="button" data-manage="new">Nuovo template</button><button type="button" data-manage="rename">Rinomina</button><button type="button" data-manage="duplicate">Duplica template</button><button type="button" data-manage="apply">Applica al record</button><button type="button" data-manage="static">Pagina statica</button><button type="button" data-manage="history">Cronologia</button><button type="button" data-manage="recover">Recupera documento</button><button type="button" data-manage="reload">Aggiorna</button><a data-public target="_blank" rel="noopener">Pagina salvata ↗</a></div>
    </fieldset><p class="pb-manager-message" role="status" hidden></p><div data-editor></div>
    <dialog data-name-dialog class="pb-manager-dialog"><form><h2 data-name-title></h2><label>Nome del template<input name="name" required maxlength="255" autocomplete="off"></label><p data-name-error role="alert"></p><div class="pb-manager-actions"><button type="button" data-cancel>Annulla</button><button type="submit">Conferma</button></div></form></dialog>
    <dialog data-list-dialog class="pb-manager-dialog"><div class="pb-dialog-heading"><h2 data-list-title></h2><button type="button" data-close-list aria-label="Chiudi">×</button></div><p data-list-hint></p><p data-list-error role="alert"></p><div data-list></div></dialog>`;
  const q = selector => root.querySelector(selector);
  const message = text => {
    q('.pb-manager-message').textContent = text; q('.pb-manager-message').hidden = !text;
    if (q('[data-list-dialog]').open) q('[data-list-error]').textContent = text;
  };
  const dirty = () => !!editor?.engine?.dirty;
  const mayLeave = () => !dirty() || window.confirm('Cambiare documento? Le modifiche non salvate verranno perse. Puoi prima esportarle.');
  const templateUrl = id => `${options.templatesUrl}/${encodeURIComponent(id)}`;
  const currentUrl = () => mode === 'template' ? templateUrl(templateId) : area.url;
  const previewUrl = id => area.templatePreviewUrl?.replace('__TEMPLATE__', encodeURIComponent(id));
  const selectedTemplate = () => templates.find(t => String(t.id) === String(templateId));
  const option = (value, label, selected) => `<option value="${e(String(value))}" ${String(value) === String(selected) ? 'selected' : ''}>${e(label)}</option>`;
  function controls() {
    q('.pb-manager-controls').disabled = busy || editorBusy;
    q('[data-record]').innerHTML = records.map(r => option(r.id, r.label, record.id)).join('');
    q('[data-area]').innerHTML = record.areas.map(a => option(a.id, a.label, area.id)).join('');
    q('[data-mode]').value = mode;
    q('[data-mode] option[value=template]').disabled = !options.templatesUrl || area.kind !== 'page';
    q('[data-template]').innerHTML = option('', 'Scegli un template…', templateId) + templates.map(t => option(t.id, t.name, templateId)).join('');
    q('[data-template-label]').hidden = !options.templatesUrl || area.kind !== 'page';
    for (const action of ['new', 'rename', 'duplicate', 'apply']) q(`[data-manage=${action}]`).hidden = !options.templatesUrl || area.kind !== 'page';
    for (const action of ['rename', 'duplicate']) q(`[data-manage=${action}]`).disabled = !templateId;
    q('[data-manage=new]').disabled = !canCreate;
    q('[data-manage=duplicate]').disabled = !templateId || !canCreate;
    q('[data-manage=rename]').disabled = !templateId || selectedTemplate()?.can_update === false;
    q('[data-manage=apply]').disabled = !templateId || selectedTemplate()?.can_use === false || mode !== 'area' || (entity?.mode === 'template' && String(entity.template_id) === String(templateId));
    q('[data-manage=static]').hidden = mode !== 'area' || entity?.mode !== 'template';
    q('[data-manage=history]').disabled = !entity?.id;
    q('[data-manage=recover]').hidden = !options.recoveryUrl || mode !== 'area';
    const publicUrl = safeUrl(area.publicUrl ?? '');
    q('[data-public]').hidden = !publicUrl;
    if (publicUrl) q('[data-public]').href = publicUrl;
  }
  async function run(work) {
    if (busy || editorBusy || disposed) return;
    const previous = {record, area, mode, templateId, entity, editor};
    busy = true; message(''); controls();
    try { await work(); } catch (error) {
      if (editor === previous.editor) ({record, area, mode, templateId, entity} = previous);
      message(error.message);
    }
    finally { busy = false; if (!disposed) controls(); }
  }
  async function refreshTemplates() {
    if (!options.templatesUrl) return;
    const url = new URL(options.templatesUrl, location.href); url.searchParams.set('context', options.context);
    const result = await request(url);
    templates = result.templates;
    canCreate = result.canCreate !== false;
    if (templateId && !selectedTemplate()) templateId = null;
  }
  function frame(html) {
    const iframe = document.createElement('iframe'); iframe.title = 'Anteprima del contenuto salvato'; iframe.setAttribute('sandbox', '');
    const css = previewStyles(options);
    iframe.srcdoc = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https:; style-src http: https: 'unsafe-inline'; font-src http: https:; base-uri 'none'; form-action 'none'">${css.map(url => `<link rel="stylesheet" href="${e(url)}">`).join('')}${defaultVariablesStyle(options)}</head><body>${html}</body></html>`;
    return iframe;
  }
  async function open() {
    const url = currentUrl();
    const next = mode === 'template' && !templateId ? null : await request(url);
    if (disposed) return;
    editor?.destroy(); editor = null; editorBusy = false; entity = next;
    const container = q('[data-editor]'); container.classList.remove('pb-editor'); container.replaceChildren();
    if (!next) { container.innerHTML = '<div class="pb-manager-empty"><h2>Un layout per tutti i tuoi record</h2><p>Scegli un template oppure creane uno nuovo.</p></div>'; return; }
    if (mode === 'area' && next.mode === 'template') {
      templateId = templates.some(t => String(t.id) === String(next.template_id)) ? String(next.template_id) : null;
      container.innerHTML = `<div class="pb-manager-linked"><div><h2>Questo record usa un template condiviso</h2><p>${e(selectedTemplate()?.name ?? `Template ${next.template_id}`)} · Modifica le aree libere per cambiare soltanto questo record.</p></div>${options.templatesUrl ? '<button type="button" data-manage="edit-template">Modifica il template</button>' : ''}</div>`;
      const endpoint = previewUrl(next.template_id);
      if (endpoint) {
        try { container.append(frame((await request(endpoint, 'POST', {})).html)); }
        catch (error) { message(`Anteprima non disponibile: ${error.message}`); }
      }
      return;
    }
    const editorMode = mode === 'template' ? 'template' : area.kind === 'fragment' ? 'area' : 'static';
    editor = await mountEditor(container, {
      ...options, title: mode === 'template' ? next.name : `${record.label} · ${area.label}`, mode: editorMode, kind: area.kind,
      pickImage: options.pickImage ?? (!options.mediaLibrary && options.media?.length ? pickImage : undefined),
      onStatus(state) { editorBusy = state.saving || state.loading; if (!disposed) controls(); },
      adapter: {
        async load() { entity = await request(url); return entity.document; },
        async save(document) {
          const result = await request(url, 'PUT', editorMode === 'template' ? {name: entity.name, revision: entity.revision, document}
            : {id: entity.id, revision: entity.revision, mode: 'static', document});
          entity = result; return result.document;
        },
        async preview(document, {signal}) {
          const endpoint = mode === 'template' ? previewUrl(templateId) : area.previewUrl;
          if (!endpoint) throw new Error('URL di anteprima non configurato');
          return (await request(endpoint, 'POST', {document}, signal)).html;
        },
      },
    });
  }
  function listDialog(title, hint, html) {
    q('[data-list-title]').textContent = title; q('[data-list-hint]').textContent = hint; q('[data-list]').innerHTML = html;
    q('[data-list-error]').textContent = '';
    q('[data-list-dialog]').showModal();
  }
  function pickImage() {
    const media = options.media.filter(item => safeUrl(item.url) && /^(https?:\/\/|\/(?!\/))/.test(item.url));
    listDialog('Immagini pubbliche', 'Scegli un’immagine dalla libreria fornita dal sito.', `<div class="pb-media-grid">${media.map((item, i) => `<button type="button" data-media="${i}"><img src="${e(item.url)}" alt="${e(item.alt ?? '')}"><span>${e(item.label ?? item.alt ?? 'Immagine')}</span></button>`).join('')}</div>`);
    return new Promise(resolve => {
      const dialog = q('[data-list-dialog]'); let result = null;
      const click = event => { const index = event.target.closest('[data-media]')?.dataset.media; if (index !== undefined) { result = media[Number(index)]; dialog.close(); } };
      dialog.addEventListener('click', click);
      dialog.addEventListener('close', () => { dialog.removeEventListener('click', click); resolve(result); }, {once: true});
    });
  }
  async function showHistory() {
    const {revisions} = await request(`${currentUrl()}/history`);
    listDialog('Cronologia salvata', 'Ripristinare crea una nuova versione. Un template aggiornato cambia tutti i record collegati.', revisions.length
      ? revisions.map(item => `<div class="pb-history-row"><span>Versione ${e(String(item.revision))}<small>${e(item.created_at)}</small></span><button type="button" data-restore="${e(String(item.revision))}">Ripristina versione ${e(String(item.revision))}</button></div>`).join('')
      : '<p>Nessuna versione archiviata. La cronologia inizia dal prossimo salvataggio.</p>');
  }
  async function restore(payload) {
    if (!window.confirm('Ripristinare e salvare questo contenuto? Le modifiche locali verranno sostituite.')) return;
    if (mode === 'template') {
      await request(currentUrl(), 'PUT', {name: payload.name, document: payload.document, revision: entity.revision});
      await refreshTemplates();
    } else {
      if (payload.kind !== area.kind) throw new Error('Il documento non è compatibile con questa area.');
      await request(area.url, 'PUT', {id: entity.id, revision: entity.revision, mode: payload.mode, template_id: payload.template_id, document: payload.document});
    }
    q('[data-list-dialog]').close(); await open(); message('Contenuto ripristinato e salvato come nuova versione.');
  }
  root.addEventListener('change', event => {
    if (!event.target.matches('[data-record],[data-area],[data-mode],[data-template]')) return;
    const target = event.target, value = target.value;
    run(async () => {
      // Changing the example record must preserve an unsaved shared template.
      if (target.matches('[data-record]') && mode === 'template' && editor) {
        const nextRecord = records.find(r => String(r.id) === value);
        const nextArea = nextRecord.areas.find(a => a.id === area.id && a.kind === 'page');
        if (nextArea) { record = nextRecord; area = nextArea; await editor.setPreview({}); return; }
      }
      if (target.matches('[data-template]') && mode === 'area') { templateId = value || null; return; }
      if (!mayLeave()) return;
      const previous = {record, area, mode, templateId};
      try {
        if (target.matches('[data-record]')) { record = records.find(r => String(r.id) === value); area = record.areas.find(a => a.id === area.id) ?? record.areas[0]; }
        if (target.matches('[data-area]')) area = record.areas.find(a => a.id === value);
        if (target.matches('[data-mode]')) mode = value;
        if (target.matches('[data-template]')) templateId = value || null;
        if (area.kind !== 'page') mode = 'area';
        await open();
      } catch (error) { ({record, area, mode, templateId} = previous); throw error; }
    });
  }, {signal: abort.signal});
  q('[data-cancel]').addEventListener('click', () => q('[data-name-dialog]').close(), {signal: abort.signal});
  q('[data-close-list]').addEventListener('click', () => q('[data-list-dialog]').close(), {signal: abort.signal});
  q('[data-name-dialog] form').addEventListener('submit', event => {
    event.preventDefault(); const name = new FormData(event.target).get('name').trim();
    if (!name || busy || editorBusy) return;
    run(async () => {
      const dialog = q('[data-name-dialog]'); dialog.querySelector('button[type=submit]').disabled = true;
      const previous = {record, area, mode, templateId, entity, editor};
      try {
        let payload = {context: options.context, revision: 0, name, document: {version: 1, kind: 'page', children: []}};
        if (nameAction !== 'new') {
          const source = mode === 'template' && entity ? entity : await request(templateUrl(templateId));
          payload.document = clone(source.document);
          if (nameAction === 'rename') payload.revision = source.revision;
        }
        const saved = await request(nameAction === 'rename' ? templateUrl(templateId) : options.templatesUrl, nameAction === 'rename' ? 'PUT' : 'POST', payload);
        await refreshTemplates(); templateId = String(saved.id); mode = 'template'; dialog.close(); await open();
      } catch (error) {
        if (editor === previous.editor) ({record, area, mode, templateId, entity} = previous);
        q('[data-name-error]').textContent = error.message;
        message(error.message);
      }
      finally { dialog.querySelector('button[type=submit]').disabled = false; }
    });
  }, {signal: abort.signal});
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-manage]')?.dataset.manage;
    const revision = event.target.closest('[data-restore]')?.dataset.restore;
    const orphan = event.target.closest('[data-orphan]')?.dataset.orphan;
    if (!action && !revision && !orphan) return;
    run(async () => {
      if (revision) { await restore(await request(`${currentUrl()}/history/${encodeURIComponent(revision)}`)); return; }
      if (orphan) { await restore(await request(`${options.recoveryUrl}/${encodeURIComponent(orphan)}`)); return; }
      if (action === 'history') { await showHistory(); return; }
      if (action === 'recover') {
        const {contents} = await request(options.recoveryUrl);
        listDialog('Recupera un documento', 'Il recupero copia il contenuto in questa area e conserva l’originale.', contents.filter(c => c.kind === area.kind).map(c => `<div class="pb-history-row"><span>Documento ${e(String(c.id))}<small>${e(c.updated_at ?? '')}</small></span><button type="button" data-orphan="${e(String(c.id))}">Recupera ${e(String(c.id))}</button></div>`).join('') || '<p>Nessun documento compatibile da recuperare.</p>'); return;
      }
      if (!mayLeave()) return;
      if (['new', 'rename', 'duplicate'].includes(action)) {
        nameAction = action; q('[data-name-title]').textContent = {new: 'Nuovo template', rename: 'Rinomina template', duplicate: 'Duplica template'}[action];
        q('[name=name]').value = action === 'new' ? '' : `${selectedTemplate()?.name ?? ''}${action === 'duplicate' ? ' — copia' : ''}`;
        q('[data-name-error]').textContent = ''; q('[data-name-dialog]').showModal(); return;
      }
      if (action === 'apply') {
        if (!window.confirm('Applicare il template a questa area? Il layout attuale resta recuperabile nella cronologia.')) return;
        await request(area.url, 'PUT', {id: entity.id, revision: entity.revision, mode: 'template', template_id: selectedTemplate().id, document: null});
      }
      if (action === 'static') {
        if (!window.confirm('Creare una pagina statica vuota? Il collegamento attuale resta nella cronologia.')) return;
        await request(area.url, 'PUT', {id: entity.id, revision: entity.revision, mode: 'static', document: {version: 1, kind: area.kind, children: []}});
      }
      if (action === 'edit-template') { templateId = String(entity.template_id); mode = 'template'; }
      await refreshTemplates(); await open();
    });
  }, {signal: abort.signal});
  await run(async () => { await refreshTemplates(); await open(); });
  return {get editor() { return editor; }, destroy() { disposed = true; abort.abort(); editor?.destroy(); root.replaceChildren(); }};
}
