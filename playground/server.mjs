import http from 'node:http';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../resources/js/core.js';
import {render} from '../resources/js/render.js';
import {staticDocument, templateDocument, records, sources} from './seed.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (condition, message, status = 422) => { if (!condition) throw Object.assign(new Error(message), {status}); };
const types = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml'};

export async function createPlayground({dataDir = path.join(root, 'playground/.data')} = {}) {
  await mkdir(dataDir, {recursive: true});
  const catalog = JSON.parse(await readFile(path.join(root, 'resources/schema/catalog.json')));
  const styles = JSON.parse(await readFile(path.join(root, 'resources/schema/styles.json')));
  const database = path.join(dataDir, 'workspace.json');
  async function old(key, fallback) {
    try { return JSON.parse(await readFile(path.join(dataDir, `${key}.json`), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {revision: 0, document: fallback}; throw error; }
  }
  let db;
  try { db = JSON.parse(await readFile(database, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const page = await old('page', staticDocument), template = await old('template', templateDocument);
    db = {templates: {'1': {id: 1, name: 'Scheda prodotto', context: 'product', kind: 'page', ...template}}, contents: {}, history: {}};
    db.contents['page/main'] = {id: 1, kind: 'page', mode: 'static', template_id: null, ...page};
    let id = 2;
    for (const [key, record] of Object.entries(records)) {
      db.contents[`${key}/main`] = {id: id++, kind: 'page', revision: 0, mode: 'template', template_id: 1, document: null};
      db.contents[`${key}/description`] = {id: id++, kind: 'fragment', mode: 'static', template_id: null, ...await old(`area-${key}`, record.document)};
    }
  }
  let queue = Promise.resolve();
  const archive = (state, key, entity) => {
    state.history[key] ??= [];
    if (!state.history[key].some(item => item.revision === entity.revision)) state.history[key].push({revision: entity.revision, created_at: new Date().toISOString(), payload: structuredClone(entity)});
  };
  for (const [key, entity] of Object.entries(db.contents)) archive(db, `content:${key}`, entity);
  for (const [key, entity] of Object.entries(db.templates)) archive(db, `template:${key}`, entity);
  const write = work => {
    const job = queue.then(async () => {
      const next = structuredClone(db), result = work(next);
      await writeFile(`${database}.tmp`, JSON.stringify(next, null, 2)); await rename(`${database}.tmp`, database); db = next; return result;
    });
    queue = job.catch(() => {}); return job;
  };
  const content = (state, key) => { const result = state.contents[key]; fail(result, 'Area non trovata', 404); return result; };
  const template = (state, id) => { const result = state.templates[id]; fail(result, 'Template non trovato', 404); return result; };
  const revision = (input, entity) => fail(input.revision === entity.revision, 'Documento modificato in un’altra finestra. Riaprilo prima di salvare.', 409);
  const checkDocument = (document, mode, kind) => validate(document, catalog, styles, {mode, kind, sources: mode === 'template' ? sources : null, areas: mode === 'template' ? ['description'] : null});
  const html = (document, recordId, mode = 'static') => render(document, catalog, styles, {mode, values: records[recordId]?.values ?? {}, areas: {description: db.contents[`${recordId}/description`]?.document}});
  const getHistory = (key, number) => {
    const history = db.history[key] ?? [];
    if (number === undefined) return {revisions: history.slice(-100).reverse().map(({revision, created_at}) => ({revision, created_at}))};
    const found = history.find(item => String(item.revision) === number); fail(found, 'Versione non trovata', 404); return found.payload;
  };
  const recordConfig = (id, label) => ({id, label, areas: Object.entries(db.contents).filter(([key]) => key.startsWith(`${id}/`)).map(([key, value]) => {
    const area = key.split('/')[1], url = `/api/records/products/${id}/areas/${area}`;
    return {id: area, label: area === 'main' ? 'Pagina completa' : 'Descrizione libera', kind: value.kind, url, previewUrl: `${url}/preview`, templatePreviewUrl: `/api/templates/__TEMPLATE__/preview/products/${id}/${area}`, publicUrl: `/public?record=${id}&area=${area}`};
  })});
  async function body(req) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; fail(size <= 1100000, 'Documento troppo grande', 413); chunks.push(chunk); }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    fail(value && typeof value === 'object' && !Array.isArray(value), 'Richiesta non valida'); return value;
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, value, type = 'application/json') => { res.writeHead(status, {'Content-Type': `${type}; charset=utf-8`, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}); res.end(type === 'application/json' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value); };
    try {
      fail(!req.headers.origin || req.headers.origin === `http://${req.headers.host}`, 'Origine non consentita', 403);
      fail(['127.0.0.1', 'localhost'].includes(req.headers.host?.split(':')[0]), 'Host non consentito', 403);
      const url = new URL(req.url, 'http://127.0.0.1'), route = url.pathname;
      if (route === '/api/workspace' && req.method === 'GET') return send(200, {context: 'product', templatesUrl: '/api/templates', sources, areas: ['description'], catalog, styles,
        records: [recordConfig('page', 'Pagina statica'), ...Object.entries(records).map(([id, record]) => recordConfig(id, record.label))],
        media: [{url: '/playground/composition.svg', alt: 'Composizione di forme geometriche', label: 'Composizione botanica'}]});
      const cm = route.match(/^\/api\/records\/products\/([^/]+)\/areas\/([^/]+)(?:\/(preview|history)(?:\/(\d+))?)?$/);
      if (cm) {
        const [, recordId, area, action, number] = cm, key = `${recordId}/${area}`; const current = content(db, key);
        if (req.method === 'GET') return send(200, action === 'history' ? getHistory(`content:${key}`, number) : current);
        const input = await body(req);
        if (action === 'preview' && req.method === 'POST') { checkDocument(input.document, 'static', current.kind); return send(200, {html: html(input.document, recordId)}); }
        fail(!action && req.method === 'PUT', 'Metodo non supportato', 405);
        return send(200, await write(state => {
          const previous = content(state, key); revision(input, previous); fail(input.id === previous.id, 'Identità del contenuto modificata', 409);
          fail(['static', 'template'].includes(input.mode), 'Invalid content mode');
          if (input.mode === 'static') checkDocument(input.document, 'static', previous.kind);
          else { fail(input.document === null && previous.kind === 'page', 'Template non compatibile'); template(state, input.template_id); }
          archive(state, `content:${key}`, previous);
          const next = {...previous, revision: previous.revision + 1, mode: input.mode, document: input.mode === 'static' ? input.document : null, template_id: input.mode === 'template' ? input.template_id : null};
          state.contents[key] = next; archive(state, `content:${key}`, next); return next;
        }));
      }
      const tm = route.match(/^\/api\/templates(?:\/(\d+))?(?:\/(history)(?:\/(\d+))?|\/preview\/products\/([^/]+)\/([^/]+))?$/);
      if (tm) {
        const [, id, action, number, recordId, area] = tm;
        if (req.method === 'GET') {
          if (!id) return send(200, {templates: Object.values(db.templates).map(({id, name, context, kind, revision}) => ({id, name, context, kind, revision})), sources, areas: ['description'], catalog, styles});
          const current = template(db, id); return send(200, action === 'history' ? getHistory(`template:${id}`, number) : current);
        }
        const input = await body(req);
        if (recordId && req.method === 'POST') {
          fail(content(db, `${recordId}/${area}`).kind === 'page', 'Anteprima non compatibile');
          const doc = input.document ?? template(db, id).document; checkDocument(doc, 'template', 'page'); return send(200, {html: html(doc, recordId, 'template')});
        }
        fail(!action && !recordId && (id ? req.method === 'PUT' : req.method === 'POST'), 'Metodo non supportato', 405);
        checkDocument(input.document, 'template', 'page');
        fail(typeof input.name === 'string' && input.name.trim() && Buffer.byteLength(input.name) <= 255, 'Nome template non valido');
        return send(200, await write(state => {
          const previous = id ? template(state, id) : null; revision(input, previous ?? {revision: 0});
          fail(previous || input.context === 'product', 'Contesto non valido');
          const key = id ?? String(Math.max(0, ...Object.keys(state.templates).map(Number)) + 1);
          if (previous) archive(state, `template:${key}`, previous);
          const next = {id: Number(key), name: input.name.trim(), context: 'product', kind: 'page', document: input.document, revision: (previous?.revision ?? 0) + 1};
          state.templates[key] = next; archive(state, `template:${key}`, next); return next;
        }));
      }
      if (route === '/public' && req.method === 'GET') {
        const recordId = url.searchParams.get('record') ?? 'page', area = url.searchParams.get('area') ?? 'main', current = content(db, `${recordId}/${area}`);
        const doc = current.mode === 'template' ? template(db, current.template_id).document : current.document;
        return send(200, `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PageBuilder · pagina salvata</title><link rel="stylesheet" href="/resources/vendor/uikit.min.css"><link rel="stylesheet" href="/resources/css/content.css"></head><body>${html(doc, recordId, current.mode)}</body></html>`, 'text/html');
      }
      fail(req.method === 'GET', 'Metodo non supportato', 405);
      const pathname = route === '/' ? '/playground/index.html' : decodeURIComponent(route);
      const allowed = pathname.startsWith('/resources/') || ['/playground/index.html', '/playground/app.js', '/playground/seed.js', '/playground/composition.svg'].includes(pathname);
      const file = path.resolve(root, `.${pathname}`);
      fail(allowed && file.startsWith(root + path.sep) && !pathname.includes('/.'), 'Non trovato', 404);
      return send(200, await readFile(file), types[path.extname(file)] ?? 'text/plain');
    } catch (error) { if (!res.headersSent) send(error.status ?? (error.code === 'ENOENT' ? 404 : 422), {message: error.message}); else res.end(); }
  });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createPlayground({dataDir: process.env.PAGEBUILDER_DATA_DIR});
  server.listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () => console.log(`PageBuilder: http://127.0.0.1:${server.address().port}`));
}
