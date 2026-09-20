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
export function validate(document, catalog, styles, {mode = 'static', kind = null, sources = null, areas = null} = {}) {
  assert(['static','template','area'].includes(mode), 'Modalità non valida');
  keys(document, ['version','kind','children']);
  assert(document.version === 1, 'Versione documento non supportata');
  assert(['page','fragment'].includes(document.kind) && (!kind || kind === document.kind), 'Tipo documento non compatibile');
  assert(bytes(JSON.stringify(document)) <= 1048576, 'Documento oltre 1 MB');
  const ids = new Set();
  function walk(nodes, allowed, depth) {
    assert(Array.isArray(nodes) && depth <= 8, 'Struttura non valida');
    for (const n of nodes) {
      keys(n, ['id','type','props','styles','bindings','children']);
      assert(typeof n.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(n.id) && !ids.has(n.id), 'Identificativo non valido o duplicato');
      ids.add(n.id); assert(ids.size <= 500, 'Troppi elementi');
      assert(allowed.includes(n.type) && Object.hasOwn(catalog, n.type), 'Posizione o elemento non valido');
      const def = catalog[n.type];
      assert(!def.templateOnly || mode === 'template', 'Elemento disponibile solo nei template');
      keys(n.props, Object.keys(def.props)); keys(n.styles, def.styles);
      keys(n.bindings, Object.keys(def.props).filter(k => def.props[k].binding));
      for (const [key, value] of Object.entries(n.props)) {
        const spec = def.props[key];
        const valid = spec.kind === 'enum' ? spec.values.includes(value)
          : spec.kind === 'layout' ? layouts.some(l => JSON.stringify(l) === JSON.stringify(value))
          : spec.kind === 'list' ? Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && bytes(v) <= 10000)
          : spec.kind === 'identifier' ? typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
          : spec.kind === 'url' ? typeof value === 'string' && bytes(value) <= 2048 && safeUrl(value) === value
          : spec.kind === 'string' && typeof value === 'string' && bytes(value) <= 20000;
        assert(valid, `Valore non valido: ${key}`);
      }
      for (const [key, value] of Object.entries(n.styles)) assert(styles[key]?.includes(value), 'Stile non valido');
      for (const [key, source] of Object.entries(n.bindings)) {
        assert(mode === 'template' && typeof source === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(source), 'Sorgente non valida');
        if (sources) assert(Object.hasOwn(sources, source) && compatible(def.props[key].binding, sources[source]), 'Sorgente non disponibile o incompatibile');
      }
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
export function node(type, catalog, props = {}) {
  assert(Object.hasOwn(catalog, type), 'Elemento sconosciuto');
  const def = catalog[type];
  const result = {id: `n_${crypto.randomUUID().replaceAll('-', '')}`, type, props: {...Object.fromEntries(Object.entries(def.props).map(([k,v]) => [k,clone(v.default)])), ...props}, styles: {}, bindings: {}};
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
    assert(['props','styles','bindings'].includes(group), 'Gruppo non valido');
    this.change(doc => { const n = locate(doc, id)?.node; assert(n, 'Elemento non trovato'); value === undefined ? delete n[group][key] : n[group][key] = value; });
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
      function renew(n) { n.id = `n_${crypto.randomUUID().replaceAll('-', '')}`; n.children?.forEach(renew); }
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
    });
  }
}
