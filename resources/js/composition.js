import {escape as e} from './render.js';

const action = (name, label, content, extra = '') => `<button type="button" data-action="${e(name)}" aria-label="${e(label)}" title="${e(label)}" ${extra}>${content}</button>`;

export function selectionPath(document, id) {
  function visit(children, path) {
    for (const child of children ?? []) {
      const next = [...path, child];
      if (child.id === id) return next;
      const found = visit(child.children, next);
      if (found) return found;
    }
    return null;
  }
  return visit(document.children, []) ?? [];
}

export function caption(n) {
  if (n.bindings.text) return `↗ ${n.bindings.text}`;
  if (['heading', 'text', 'button'].includes(n.type)) return n.props.text;
  if (n.type === 'image') return n.props.alt;
  if (n.type === 'area') return n.props.area;
  if (n.type === 'row') return (n.props.layout??['1-1']).map(w => w.replace('-', '/')).join(' + ');
  return '';
}

export function composition(document, catalog, {selected, view = 'layout', collapsed = new Set()} = {}) {
  function select(n, label = catalog[n.type].label, className = '') {
    label=n.meta?.name||label;
    const detail = caption(n);
    const badge=n.meta?.disabled?' · Disattivato':Object.keys(n.responsive??{}).length?' · Responsive':'';
    return `<button type="button" class="pb-tree-select ${className}" data-select="${e(n.id)}" draggable="${n.type !== 'column'}" aria-pressed="${selected === n.id}"><span class="pb-tree-icon">${e(catalog[n.type].icon)}</span><span>${e(label)}${e(badge)}${detail ? `<small>${e(detail)}</small>` : ''}</span></button>`;
  }
  function controls(n) {
    const target = `data-node-target="${e(n.id)}"`;
    return `<div class="pb-layout-actions">${action('duplicate', `Duplica ${catalog[n.type].label.toLowerCase()}`, '⧉', target)}${action('delete', `Elimina ${catalog[n.type].label.toLowerCase()}`, '×', target)}</div>`;
  }
  function tree(n, depth) {
    const branch = n.children?.length > 0;
    const closed = collapsed.has(n.id);
    return `<div class="pb-tree-item ${selected === n.id ? 'is-selected' : ''}" style="--depth:${depth}">${branch ? action(`toggle:${n.id}`, `${closed ? 'Espandi' : 'Comprimi'} ${catalog[n.type].label.toLowerCase()}`, closed ? '›' : '⌄', `class="pb-tree-toggle" aria-expanded="${!closed}"`) : '<span class="pb-tree-spacer"></span>'}${select(n)}${n.type === 'column' ? action(`catalog:${n.id}`, 'Aggiungi elemento alla colonna', '+') : ''}</div>${closed ? '' : (n.children ?? []).map(c => tree(c, depth + 1)).join('')}`;
  }
  function element(n) {
    return `<div class="pb-layout-element ${selected === n.id ? 'is-selected' : ''}">${select(n)}${controls(n)}${action(`after:${n.id}`, `Inserisci elemento dopo ${catalog[n.type].label.toLowerCase()}`, '+', 'class="pb-insert-here"')}</div>`;
  }
  function row(n) {
    return `<div class="pb-layout-row ${selected === n.id ? 'is-selected' : ''}"><div class="pb-layout-heading">${select(n)}${controls(n)}</div><div class="pb-layout-grid" style="grid-template-columns:${(n.props.layout??['1-1']).map(w => { const [a,b] = w.split('-').map(Number); return `minmax(0,${a / b}fr)`; }).join(' ')}">${n.children.map((column, i) => `<div class="pb-layout-column ${selected === column.id ? 'is-selected' : ''}" data-drop-parent="${e(column.id)}">${select(column, `Colonna ${i + 1}`, 'pb-column-label')}<div class="pb-layout-elements">${column.children.map(element).join('')}</div>${action(`catalog:${column.id}`, `Aggiungi elemento alla colonna ${i + 1}`, '+ <span>Elemento</span>', 'class="pb-column-add"')}</div>`).join('')}</div></div>`;
  }
  function section(n, index) {
    return `<section class="pb-layout-section ${selected === n.id ? 'is-selected' : ''}"><div class="pb-layout-heading">${select(n, `Sezione ${index + 1}`)}${controls(n)}</div>${n.children.map(row).join('')}${action(`addrow:${n.id}`, 'Aggiungi riga alla sezione', '+ Riga', 'class="pb-row-add"')}</section>`;
  }
  if (!document.children.length) return `<div class="pb-empty"><strong>Comincia dal layout</strong><p>Aggiungi ${document.kind === 'page' ? 'una sezione' : 'una riga'}, scegli le colonne e inserisci i contenuti.</p>${action('root', 'Crea la prima struttura', '+ Comincia')}</div>`;
  if (view === 'tree') return document.children.map(n => tree(n, 0)).join('');
  return document.children.map((n, i) => n.type === 'section' ? section(n, i) : row(n)).join('');
}
