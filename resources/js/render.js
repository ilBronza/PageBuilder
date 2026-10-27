import {nodeCss} from './design.js';
import {renderRich} from './richtext.js';
import {iconHtml} from './elements.js';
import {safeUrl, validate, interpolate} from './core.js';
export const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const scalar = value => ['string','number','boolean'].includes(typeof value);
export function render(document, catalog, styles, {values = {}, areas = {}, mode = 'static', custom = {}} = {}) {
  validate(document, catalog, styles, {mode});
  let css = '';
  function node(n) {
    if(n.meta?.disabled) return '';
    css+=nodeCss(n);
    const type = n.type, def = catalog[type];
    const p = {...Object.fromEntries(Object.entries(def.props).map(([k,s]) => [k,s.default])),...n.props};
    if (mode === 'template') for (const [key,spec] of Object.entries(def.props)) {
      if (Object.hasOwn(n.bindings,key)) continue;
      if (spec.binding === 'text') p[key] = interpolate(p[key],values);
      if (spec.kind === 'list') p[key] = p[key].map(item => interpolate(item,values));
      if (spec.kind === 'table') p[key] = p[key].map(row=>row.map(item=>interpolate(item,values)));
    }
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
        : key === 'vertical' ? `pb-valign-${value}` : '');
    }
    if (['primary','secondary','success','danger'].includes(n.styles.background)) classes.push('uk-light');
    if (type === 'row') classes.push('uk-grid');
    if(n.meta?.classes) classes.push(n.meta.classes);
    const attr = `${n.meta?.anchor?` id="${escape(n.meta.anchor)}"`:''} class="${escape(classes.join(' '))}" data-pb-id="${escape(n.id)}"`;
    if (type === 'section') return `<section${attr}><div class="uk-container${p.width === 'default' ? '' : ` uk-container-${p.width}`}">${children()}</div></section>`;
    if (type === 'row') return `<div${attr}>${n.children.map((c,i) => `<div class="uk-width-1-1 uk-width-${p.layout[i]}@s">${node(c)}</div>`).join('')}</div>`;
    if (type === 'column') return `<div${attr}>${children()}</div>`;
    if (type === 'heading') return `<div${attr}><${p.tag}${p.size === 'default' ? '' : ` class="uk-heading-${p.size}"`}>${escape(p.text)}</${p.tag}></div>`;
    if (type === 'text') return `<div${attr}>${p.richText?.length&&!Object.hasOwn(n.bindings,'text')?`<div class="pb-rich-text">${renderRich(p.richText,escape,text=>mode==='template'?interpolate(text,values):text)}</div>`:`<p class="pb-text">${escape(p.text)}</p>`}</div>`;
    if (type === 'image') return `<div${attr}>${p.src === '' || !safeUrl(p.src) ? '' : `<img src="${escape(safeUrl(p.src))}" alt="${escape(p.alt)}" class="pb-image pb-ratio-${p.ratio}" loading="lazy">`}</div>`;
    if (type === 'button') return `<div${attr}><a class="uk-button uk-button-${p.variant}" href="${escape(safeUrl(p.href))}">${escape(p.text)}</a></div>`;
    if (type === 'divider') return `<div${attr}><hr${p.variant === 'default' ? '' : ` class="uk-divider-${p.variant}"`}></div>`;
    if (type === 'list') return `<div${attr}><ul class="uk-list uk-list-${p.variant}">${p.items.map(i=>`<li>${escape(i)}</li>`).join('')}</ul></div>`;
    const img = p.src && safeUrl(p.src) ? `<img src="${escape(safeUrl(p.src))}" alt="${escape(p.alt)}" loading="lazy">` : '';
    if(type==='card') return `<div${attr}><article class="pb-card-inner">${img}<div class="pb-card-body"><h3>${escape(p.title)}</h3><p class="pb-text">${escape(p.text)}</p>${p.href&&safeUrl(p.href)?`<a href="${escape(safeUrl(p.href))}">${escape(p.linkText)}</a>`:''}</div></article></div>`;
    if(type==='imageText') return `<div${attr}><div class="pb-image-text pb-image-${p.position}">${img?`<div class="pb-image-text-media">${img}</div>`:''}<div class="pb-image-text-body"><h3>${escape(p.title)}</h3><p class="pb-text">${escape(p.text)}</p></div></div></div>`;
    if(type==='icon') return `<div${attr}>${iconHtml(p.icon,p.label,escape)}</div>`;
    if(type==='table') return `<div${attr}><div class="pb-table-scroll"><table class="pb-table"><thead><tr>${p.columns.map(c=>`<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${p.rows.map(row=>`<tr>${row.map(cell=>`<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    if (type === 'area') return `<div${attr}>${areas[p.area] ? render(areas[p.area], catalog, styles, {mode:'area',custom}) : ''}</div>`;
    return `<div${attr}>${Object.hasOwn(custom,type) ? custom[type](p) : ''}</div>`;
  }
  const html=document.children.map(node).join('');
  return `<div class="pb-document">${css?`<style data-pb-design>${css}</style>`:''}${html}</div>`;
}
