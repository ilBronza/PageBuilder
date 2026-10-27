import {validDesign} from './design.js';
export const layouts = [['1-1'], ['1-2','1-2'], ['1-3','2-3'], ['2-3','1-3'], ['1-4','3-4'], ['3-4','1-4'], ['1-3','1-3','1-3'], ['1-4','1-4','1-4','1-4']];
export const clone = value => structuredClone(value);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bytes = value => new TextEncoder().encode(value).length;
const keys = (value, allowed) => { assert(object(value), 'Oggetto non valido'); assert(Object.keys(value).every(k => allowed.includes(k)), 'Proprietà sconosciuta'); };
export function safeUrl(value) {
  if (typeof value !== 'string' || /[\x00-\x20\x7f\\]/.test(value)) return '';
  return value === '' || /^(https?:\/\/[^/]+|\/(?!\/)|#|mailto:|tel:)/i.test(value) ? value : '';
}
export function compatible(binding, source) {
  const scalarTypes = ['text','number','date','boolean'];
  if (binding === 'list') return source.cardinality === 'many' && scalarTypes.includes(source.type);
  return source.cardinality === 'one' && (binding === 'text' ? scalarTypes.includes(source.type) : source.type === binding);
}
export function validateInline(text, sources = null) {
  for (const match of text.matchAll(/\{\{(.*?)\}\}/gs)) {
    const id = match[1].trim();
    assert(/^[a-zA-Z0-9_.:-]{1,120}$/.test(id) && (!sources || (Object.hasOwn(sources,id) && compatible('text',sources[id]))), `Variabile non disponibile o incompatibile: ${id}`);
  }
}
export function interpolate(text, values) {
  return text.replace(/\{\{(.*?)\}\}/gs, (_, token) => {
    const id = token.trim(), value = Object.hasOwn(values,id) ? values[id] : null;
    return ['string','number','boolean'].includes(typeof value) ? String(value) : '';
  });
}
export function validate(document, catalog, styles, {mode = 'static', kind = null, sources = null, areas = null} = {}) {
  assert(['static','template','area'].includes(mode), 'Modalità non valida');
  keys(document, ['version','kind','children']);
  assert(document.version === 1, 'Versione documento non supportata');
  assert(['page','fragment'].includes(document.kind) && (!kind || kind === document.kind), 'Tipo documento non compatibile');
  assert(bytes(JSON.stringify(document)) <= 1048576, 'Documento oltre 1 MB');
  const ids = new Set(), anchors = new Set();
  const design = value => {keys(value,Object.keys(value));for(const [k,v] of Object.entries(value)) assert(validDesign(k,v,safeUrl),`Stile CSS non valido: ${k}`);};
  function walk(nodes, allowed, depth) {
    assert(Array.isArray(nodes) && depth <= 8, 'Struttura non valida');
    for (const n of nodes) {
      keys(n, ['id','type','props','styles','bindings','children','meta','design','responsive']);
      assert(typeof n.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(n.id) && !ids.has(n.id), 'Identificativo non valido o duplicato');
      ids.add(n.id); assert(ids.size <= 500, 'Troppi elementi');
      assert(allowed.includes(n.type) && Object.hasOwn(catalog, n.type), 'Posizione o elemento non valido');
      const def = catalog[n.type];
      assert(!def.templateOnly || mode === 'template', 'Elemento disponibile solo nei template');
      keys(n.props, Object.keys(def.props)); keys(n.styles, def.styles);
      if(n.meta!==undefined) {
        keys(n.meta,['name','anchor','classes','disabled']);
        if(n.meta.name!==undefined) assert(typeof n.meta.name==='string'&&bytes(n.meta.name)<=120,'Nome non valido');
        if(n.meta.disabled!==undefined) assert(typeof n.meta.disabled==='boolean','Stato non valido');
        if(n.meta.classes!==undefined) assert(typeof n.meta.classes==='string'&&n.meta.classes.length<=500&&/^(?:[a-zA-Z_][a-zA-Z0-9_-]*(?: +[a-zA-Z_][a-zA-Z0-9_-]*)*)?$/.test(n.meta.classes),'Classi CSS non valide');
        if(n.meta.anchor) {assert(typeof n.meta.anchor==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(n.meta.anchor)&&!anchors.has(n.meta.anchor),'ID HTML non valido o duplicato');anchors.add(n.meta.anchor);}
        else if(n.meta.anchor!==undefined) assert(n.meta.anchor==='','ID HTML non valido');
      }
      if(n.design!==undefined) design(n.design);
      if(n.responsive!==undefined) {
        keys(n.responsive,['tablet','mobile']);
        for(const r of Object.values(n.responsive)) {
          keys(r,['styles','design','columns','hidden']);
          if(r.styles!==undefined) {keys(r.styles,def.styles);for(const [k,v] of Object.entries(r.styles)) assert(styles[k]?.includes(v),'Stile responsive non valido');}
          if(r.design!==undefined) design(r.design);
          if(r.hidden!==undefined) assert(typeof r.hidden==='boolean','Visibilità non valida');
          if(r.columns!==undefined) assert(n.type==='row'&&Array.isArray(r.columns)&&r.columns.length===n.children?.length&&r.columns.every(w=>['1-1','1-2','1-3','2-3','1-4','3-4'].includes(w)),'Colonne responsive non valide');
        }
      }
      keys(n.bindings, Object.keys(def.props).filter(k => def.props[k].binding));
      for (const [key, value] of Object.entries(n.props)) {
        const spec = def.props[key];
        const valid = spec.kind === 'enum' ? spec.values.includes(value)
          : spec.kind === 'layout' ? layouts.some(l => JSON.stringify(l) === JSON.stringify(value))
          : spec.kind === 'list' ? Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && bytes(v) <= 10000)
          : spec.kind === 'richtext' ? validRich(value,mode,sources)
          : spec.kind === 'table' ? Array.isArray(value)&&value.length<=100&&value.every(row=>Array.isArray(row)&&row.length<=12&&row.every(v=>typeof v==='string'&&bytes(v)<=10000))
          : spec.kind === 'identifier' ? typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
          : spec.kind === 'url' ? typeof value === 'string' && bytes(value) <= 2048 && safeUrl(value) === value
          : spec.kind === 'string' && typeof value === 'string' && bytes(value) <= 20000;
        assert(valid, `Valore non valido: ${key}`);
        if (mode === 'template' && !Object.hasOwn(n.bindings,key)) {
          if (spec.binding === 'text') validateInline(value,sources);
          if (spec.kind === 'list') value.forEach(item => validateInline(item,sources));
          if (spec.kind === 'table') value.flat().forEach(item => validateInline(item,sources));
        }
      }
      for (const [key, value] of Object.entries(n.styles)) assert(styles[key]?.includes(value), 'Stile non valido');
      for (const [key, source] of Object.entries(n.bindings)) {
        assert(mode === 'template' && typeof source === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(source), 'Sorgente non valida');
        if (sources) assert(Object.hasOwn(sources, source) && compatible(def.props[key].binding, sources[source]), 'Sorgente non disponibile o incompatibile');
      }
      if (n.type==='table') assert((n.props.columns??def.props.columns.default).length>=1&&(n.props.columns??def.props.columns.default).length<=12&&(n.props.rows??def.props.rows.default).every(row=>row.length===(n.props.columns??def.props.columns.default).length),'Celle non coerenti con le colonne');
      if (n.type === 'area' && areas) assert(areas.includes(n.props.area ?? 'description'), 'Area non disponibile');
      if (def.children) {
        walk(n.children, def.children, depth + 1);
        if (n.type === 'row') assert(n.children.length === (n.props.layout ?? ['1-1']).length, 'Colonne non coerenti con la griglia');
      } else assert(!Object.hasOwn(n, 'children'), 'Un elemento non può avere figli');
    }
  }
  walk(document.children, document.kind === 'page' ? ['section'] : ['row'], 0);
  return document;
}
function validRich(value,mode,sources) {
  if(!Array.isArray(value)||value.length>200) return false;
  let count=0;
  for(const block of value) {
    keys(block,['type','children']);
    if(!['paragraph','bullet','ordered'].includes(block.type)||!Array.isArray(block.children)) return false;
    for(const run of block.children) {
      keys(run,['text','marks','href']);
      if(++count>2000||typeof run.text!=='string'||bytes(run.text)>20000) return false;
      if(run.marks!==undefined&&(!Array.isArray(run.marks)||run.marks.length>2||new Set(run.marks).size!==run.marks.length||!run.marks.every(m=>['bold','italic'].includes(m)))) return false;
      if(run.href!==undefined&&(typeof run.href!=='string'||run.href.length>2048||safeUrl(run.href)!==run.href)) return false;
      if(mode==='template') validateInline(run.text,sources);
    }
  }
  return true;
}
function nodeId() {
  if (typeof crypto.randomUUID === 'function') return `n_${crypto.randomUUID().replaceAll('-', '')}`;
  // getRandomValues is also available on HTTP, where randomUUID requires a secure context.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return `n_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
export function node(type, catalog, props = {}) {
  assert(Object.hasOwn(catalog, type), 'Elemento sconosciuto');
  const def = catalog[type];
  const result = {id: nodeId(), type, props: {...Object.fromEntries(Object.entries(def.props).map(([k,v]) => [k,clone(v.default)])), ...props}, styles: {}, bindings: {}};
  if (def.children) result.children = [];
  if (type === 'section') result.children.push(node('row', catalog));
  if (type === 'row') result.children = result.props.layout.map(() => node('column', catalog));
  return result;
}
export function locate(document, id) {
  function visit(parent) {
    for (let index = 0; index < (parent.children?.length ?? 0); index++) {
      const n = parent.children[index];
      if (n.id === id) return {node: n, parent, index};
      const found = visit(n); if (found) return found;
    }
    return null;
  }
  return visit(document);
}
export class Engine {
  constructor(document, catalog, styles, options = {}) {
    this.catalog = catalog; this.styles = styles; this.options = options;
    this.document = clone(validate(document, catalog, styles, options));
    this.past = []; this.future = []; this.saved = JSON.stringify(this.document);
  }
  get dirty() { return JSON.stringify(this.document) !== this.saved; }
  markSaved(document = this.document) { this.saved = JSON.stringify(document); }
  replace(document) {
    this.document = clone(validate(document, this.catalog, this.styles, this.options));
    this.past = []; this.future = []; this.markSaved();
  }
  import(document) {
    const next = clone(validate(document, this.catalog, this.styles, {...this.options, kind: this.document.kind}));
    this.change(current => Object.assign(current, next));
  }
  change(callback) {
    const next = clone(this.document); callback(next);
    validate(next, this.catalog, this.styles, this.options);
    if (JSON.stringify(next) === JSON.stringify(this.document)) return;
    this.past.push(this.document); if (this.past.length > 100) this.past.shift();
    this.document = next; this.future = [];
  }
  undo() { if (this.past.length) { this.future.push(this.document); this.document = this.past.pop(); } }
  redo() { if (this.future.length) { this.past.push(this.document); this.document = this.future.pop(); } }
  update(id, group, key, value) {
    assert(['props','styles','bindings','meta','design'].includes(group), 'Gruppo non valido');
    this.change(doc => { const n = locate(doc, id)?.node; assert(n, 'Elemento non trovato'); n[group]??={}; value === undefined ? delete n[group][key] : n[group][key] = value; });
  }
  responsive(id,device,group,key,value) {
    this.change(doc=>{const n=locate(doc,id)?.node;assert(n,'Elemento non trovato');n.responsive??={};const r=n.responsive[device]??={};if(group){r[group]??={};value===undefined?delete r[group][key]:r[group][key]=value;}else{value===undefined?delete r[key]:r[key]=value;}});
  }
  pasteStyles(id,source) {
    this.change(doc=>{
      const n=locate(doc,id).node, allowed=this.catalog[n.type].styles;
      n.styles=Object.fromEntries(Object.entries(source.styles??{}).filter(([k])=>allowed.includes(k)));
      n.design=clone(source.design??{});n.responsive=clone(source.responsive??{});
      for(const r of Object.values(n.responsive)) {if(r.styles) r.styles=Object.fromEntries(Object.entries(r.styles).filter(([k])=>allowed.includes(k)));if(n.type!=='row'||r.columns?.length!==n.children.length) delete r.columns;}
    });
  }
  add(parentId, type, props = {}) {
    const fresh = node(type, this.catalog, props);
    this.change(doc => { const parent = parentId ? locate(doc, parentId)?.node : doc; assert(parent?.children, 'Destinazione non valida'); parent.children.push(fresh); });
    return fresh.id;
  }
  remove(id) {
    this.change(doc => { const f = locate(doc,id); assert(f && f.node.type !== 'column', 'Modifica le colonne dalla griglia'); f.parent.children.splice(f.index,1); });
  }
  duplicate(id) {
    let fresh;
    this.change(doc => {
      const f = locate(doc,id); assert(f && f.node.type !== 'column', 'Modifica le colonne dalla griglia'); fresh = clone(f.node);
      function renew(n) { n.id = nodeId(); if(n.meta) delete n.meta.anchor; n.children?.forEach(renew); }
      renew(fresh); f.parent.children.splice(f.index+1,0,fresh);
    });
    return fresh.id;
  }
  move(id, targetParentId, index) {
    this.change(doc => {
      const f = locate(doc,id), target = targetParentId ? locate(doc,targetParentId)?.node : doc;
      assert(f && target?.children && f.node.type !== 'column', 'Spostamento non valido');
      assert(f.node !== target && !locate({children:[f.node]}, targetParentId), 'Spostamento ciclico');
      f.parent.children.splice(f.index,1);
      target.children.splice(Math.max(0,Math.min(index,target.children.length)),0,f.node);
    });
  }
  reorder(id, delta) { const f = locate(this.document,id); if (f) this.move(id,f.parent.id, f.index+delta); }
  grid(id, layout) {
    this.change(doc => {
      const row = locate(doc,id)?.node; assert(row?.type === 'row', 'Seleziona una riga');
      while (row.children.length < layout.length) row.children.push(node('column',this.catalog));
      if (row.children.length > layout.length) {
        const removed = row.children.splice(layout.length);
        row.children.at(-1).children.push(...removed.flatMap(c => c.children));
      }
      row.props.layout = clone(layout);
      for(const r of Object.values(row.responsive??{})) if(r.columns?.length!==layout.length) delete r.columns;
    });
  }
}
