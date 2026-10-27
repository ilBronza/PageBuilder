// Shared, deliberately bounded CSS vocabulary. No selectors, scripts or arbitrary declarations.
export const designFields = {
  paddingTop:['Padding superiore','length'],paddingRight:['Padding destro','length'],paddingBottom:['Padding inferiore','length'],paddingLeft:['Padding sinistro','length'],
  marginTop:['Margine superiore','spacing'],marginRight:['Margine destro','spacing'],marginBottom:['Margine inferiore','spacing'],marginLeft:['Margine sinistro','spacing'],
  maxWidth:['Larghezza massima','size'],minHeight:['Altezza minima','length'],fontSize:['Dimensione testo','length'],lineHeight:['Interlinea','number'],letterSpacing:['Spaziatura lettere','spacing'],fontFamily:['Font','font'],
  borderWidth:['Spessore bordo','length'],borderRadius:['Raggio bordo','length'],borderColor:['Colore bordo','color'],borderStyle:['Tipo bordo','enum',['none','solid','dashed','dotted']],backgroundImage:['Immagine di sfondo','image'],backgroundSize:['Dimensione sfondo','enum',['cover','contain','auto']],backgroundPosition:['Posizione sfondo','enum',['center','top','bottom','left','right']],
};
const variable = /^var\(--[a-zA-Z][a-zA-Z0-9_-]*\)$/;
const dimension = /^(?:0|(?:\d{1,4}(?:\.\d{1,3})?|\.\d{1,3})(?:px|rem|em|%|vh|vw))$/;
export const cssName = key => key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`);
export function validDesign(key,value,safeUrl) {
  if (!Object.hasOwn(designFields,key) || typeof value!=='string' || value.length>2048) return false;
  const [,kind,values]=designFields[key];
  if (kind==='image') return /^(https?:\/\/|\/(?!\/))/.test(value) && safeUrl(value)===value && !/[<>"'(){};]/.test(value);
  if (kind==='enum') return values.includes(value);
  if (variable.test(value)) return true;
  if (kind==='color') return /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent|currentColor)$/.test(value);
  if (kind==='font') return ['inherit','serif','sans-serif','monospace','system-ui'].includes(value);
  if (kind==='number') return /^(?:[0-3](?:\.\d{1,3})?|4)$/.test(value);
  return dimension.test(value) || (kind==='size' && value==='none') || (kind==='spacing' && (value==='auto'||dimension.test(value.replace(/^-/,''))));
}
export const designCss = design => Object.entries(design??{}).map(([k,v])=>`${cssName(k)}:${k==='backgroundImage'?`url("${v}")`:v};`).join('');
export function parseDesign(css,safeUrl) {
  const result={};
  for(const part of css.split(';').map(s=>s.trim()).filter(Boolean)) {
    const match=part.match(/^([a-z-]+)\s*:\s*(.+)$/);
    const key=match?.[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    let value=match?.[2].trim();
    if(key==='backgroundImage') value=value.replace(/^url\(["']?(.+?)["']?\)$/,'$1');
    if(!validDesign(key,value,safeUrl)) throw new Error(`Stile non supportato: ${match?.[1]??part}`);
    result[key]=value;
  }
  return result;
}
export function tokenDeclarations(styles,type) {
  const result={};
  const space=value=>value==='none'||value==='collapse'?'0':`var(--pb-space-${value})`;
  for(const [key,value] of Object.entries(styles??{})) {
    if(key==='background') {
      const dark=['primary','secondary','success','warning','danger'].includes(value);
      Object.assign(result,{'background-color':`var(--pb-palette-${value})`,'--pb-context-text':`var(--pb-palette-${dark?`${value}-contrast`:'ink'})`,'--pb-context-heading':`var(--pb-palette-${dark?`${value}-contrast`:'emphasis'})`,'--pb-context-muted':`var(--pb-palette-${dark?`${value}-contrast`:'muted-ink'})`,color:'var(--pb-context-text)'});
    }
    if(key==='color') result.color=value==='default'?'var(--pb-context-text, var(--pb-palette-ink))':value==='muted'?'var(--pb-context-muted, var(--pb-palette-muted-ink))':value==='emphasis'?'var(--pb-context-heading, var(--pb-palette-emphasis))':`var(--pb-palette-${value==='warning'?'warning-ink':value})`;
    if(key==='padding'||key==='margin') result[key]=space(value);
    if(key==='align') result['text-align']=value;
    if(key==='rowGap') result['row-gap']=space(value);
    if(key==='vertical') result[type==='column'?'justify-content':'align-items']={top:'flex-start',middle:'center',bottom:'flex-end'}[value];
    if(key==='fontSize') result['font-size']=`var(--pb-font-${value})`;
    if(key==='fontWeight') result['font-weight']={normal:'400',medium:'500',bold:'700'}[value];
    if(key==='radius') result['border-radius']=value==='none'?'0':`var(--pb-radius-${value})`;
    if(key==='border') result.border=value==='none'?'0':`var(--pb-border-${value}) solid var(--pb-border-color)`;
    if(key==='shadow') result['box-shadow']=value==='none'?'none':`var(--pb-shadow-${value})`;
    if(key==='maxWidth') result['max-width']=value==='none'?'none':`var(--pb-width-${value})`;
  }
  if(styles?.color&&styles?.background) result.color=tokenDeclarations({color:styles.color},type).color;
  return result;
}
export function nodeCss(n) {
  const selector=`.pb-document [data-pb-id="${n.id}"]`;
  function rules(styles={},design={},columns,hidden) {
    const declarations=tokenDeclarations(styles,n.type);
    for(const [k,v] of Object.entries(design)) declarations[cssName(k)]=k==='backgroundImage'?`url("${v}")`:v;
    if(hidden!==undefined) declarations.display=hidden?'none':['column','row'].includes(n.type)?'flex':'block';
    const decl=Object.entries(declarations).map(([k,v])=>`${k}:${v}!important;`).join('');
    let css=decl?`${selector}{${decl}}`:'';
    // UIkit defines typography on headings; explicitly inherit an edited wrapper font.
    const font=Object.keys(declarations).filter(k=>['font-size','font-family','font-weight','line-height','letter-spacing'].includes(k));
    if(font.length) css+=`${selector}>:is(h1,h2,h3,h4,h5,h6){${font.map(k=>`${k}:inherit!important;`).join('')}}`;
    if(styles.gap) css+=`${selector}{margin-left:0!important;column-gap:0!important;}${selector}>*{padding-left:${styles.gap==='collapse'?'0':`var(--pb-space-${styles.gap})`}!important;}`;
    if(columns) css+=columns.map((w,i)=>`${selector}>:nth-child(${i+1}){width:${Number((100*Number(w.split('-')[0])/Number(w.split('-')[1])).toFixed(6))}%!important;}`).join('');
    return css;
  }
  let css=rules(n.styles,n.design);
  for(const [device,width] of [['tablet',1199],['mobile',639]]) {
    const r=n.responsive?.[device];
    if(r) {const body=rules(r.styles,r.design,r.columns,r.hidden);if(body)css+=`@media(max-width:${width}px){${body}}`;}
  }
  return css;
}
