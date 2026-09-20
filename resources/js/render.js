import {safeUrl, validate} from './core.js';
export const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const scalar = value => ['string','number','boolean'].includes(typeof value);
export function render(document, catalog, styles, {values = {}, areas = {}, mode = 'static', custom = {}} = {}) {
  validate(document, catalog, styles, {mode});
  function node(n) {
    const type = n.type, def = catalog[type];
    const p = {...Object.fromEntries(Object.entries(def.props).map(([k,s]) => [k,s.default])),...n.props};
    for (const [key,source] of Object.entries(n.bindings)) {
      const value = Object.hasOwn(values, source) ? values[source] : null;
      p[key] = def.props[key].kind === 'list' ? (Array.isArray(value) ? value.filter(scalar) : []) : (scalar(value) ? String(value) : '');
    }
    const children = () => (n.children ?? []).map(node).join('');
    const classes = ['pb-node',`pb-${type}`];
    for (const [key,value] of Object.entries(n.styles)) {
      classes.push(key === 'background' ? `uk-background-${value}`
        : key === 'color' ? (value === 'default' ? 'pb-color-default' : `uk-text-${value}`)
        : key === 'align' ? `uk-text-${value}`
        : key === 'padding' ? (value === 'none' ? 'uk-padding-remove' : (value === 'default' ? 'uk-padding' : `uk-padding-${value}`))
        : key === 'margin' ? (value === 'none' ? 'uk-margin-remove' : (value === 'default' ? 'uk-margin' : `uk-margin-${value}`))
        : key === 'gap' ? (value === 'default' ? 'uk-grid' : `uk-grid-${value}`)
        : key === 'rowGap' ? `pb-row-gap-${value}`
        : `pb-valign-${value}`);
    }
    if (['primary','secondary'].includes(n.styles.background)) classes.push('uk-light');
    if (type === 'row') classes.push('uk-grid');
    const attr = ` class="${escape(classes.join(' '))}" data-pb-id="${escape(n.id)}"`;
    if (type === 'section') return `<section${attr}><div class="uk-container${p.width === 'default' ? '' : ` uk-container-${p.width}`}">${children()}</div></section>`;
    if (type === 'row') return `<div${attr}>${n.children.map((c,i) => `<div class="uk-width-1-1 uk-width-${p.layout[i]}@s">${node(c)}</div>`).join('')}</div>`;
    if (type === 'column') return `<div${attr}>${children()}</div>`;
    if (type === 'heading') return `<div${attr}><${p.tag}${p.size === 'default' ? '' : ` class="uk-heading-${p.size}"`}>${escape(p.text)}</${p.tag}></div>`;
    if (type === 'text') return `<div${attr}><p class="pb-text">${escape(p.text)}</p></div>`;
    if (type === 'image') return `<div${attr}>${p.src === '' || !safeUrl(p.src) ? '' : `<img src="${escape(safeUrl(p.src))}" alt="${escape(p.alt)}" class="pb-image pb-ratio-${p.ratio}" loading="lazy">`}</div>`;
    if (type === 'button') return `<div${attr}><a class="uk-button uk-button-${p.variant}" href="${escape(safeUrl(p.href))}">${escape(p.text)}</a></div>`;
    if (type === 'divider') return `<div${attr}><hr${p.variant === 'default' ? '' : ` class="uk-divider-${p.variant}"`}></div>`;
    if (type === 'list') return `<div${attr}><ul class="uk-list uk-list-${p.variant}">${p.items.map(i=>`<li>${escape(i)}</li>`).join('')}</ul></div>`;
    if (type === 'area') return `<div${attr}>${areas[p.area] ? render(areas[p.area], catalog, styles, {mode:'area',custom}) : ''}</div>`;
    return `<div${attr}>${Object.hasOwn(custom,type) ? custom[type](p) : ''}</div>`;
  }
  return `<div class="pb-document">${document.children.map(node).join('')}</div>`;
}
