export const richPlain = blocks => blocks.map(b=>b.children.map(r=>r.text).join('')).join('\n');
export const fromPlain = text => text.split('\n').map(text=>({type:'paragraph',children:[{text}]}));
export function renderRich(blocks,escape,resolve=text=>text,paint=escape) {
  let html='',list='';
  for(const block of blocks) {
    const tag={paragraph:'',bullet:'ul',ordered:'ol'}[block.type];
    if(list!==tag) { if(list) html+=`</${list}>`; if(tag) html+=`<${tag}>`; list=tag; }
    const inner=block.children.map(run=>{
      let text=paint(resolve(run.text));
      if(run.marks?.includes('bold')) text=`<strong>${text}</strong>`;
      if(run.marks?.includes('italic')) text=`<em>${text}</em>`;
      if(run.href) text=`<a href="${escape(run.href)}">${text}</a>`;
      return text;
    }).join('');
    html+=`<${tag?'li':'p'}>${inner}</${tag?'li':'p'}>`;
  }
  return html+(list?`</${list}>`:'');
}
// Convert editor DOM to our data model. Unrecognised tags/attributes never reach storage.
export function readRich(root,safeUrl) {
  const blocks=[];
  function runs(node,marks=[],href) {
    if(node.nodeType===3) return [{text:node.textContent,...(marks.length?{marks}:{}),...(href?{href}:{})}];
    if(node.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName)) return [];
    if(node.dataset.variableToken) return [{text:`{{ ${node.dataset.variableToken} }}`,...(marks.length?{marks}:{}),...(href?{href}:{})}];
    if(node.tagName==='BR') return [{text:'\n'}];
    const next=[...new Set([...marks,...(['B','STRONG'].includes(node.tagName)?['bold']:[]),...(['I','EM'].includes(node.tagName)?['italic']:[])])];
    const link=node.tagName==='A'?safeUrl(node.getAttribute('href')):href;
    return [...node.childNodes].flatMap(child=>runs(child,next,link));
  }
  function visit(parent,type='paragraph') {
    let inline=[];
    const flush=()=>{if(inline.length){blocks.push({type,children:inline});inline=[];}};
    for(const child of parent.childNodes) {
      if(child.nodeType===1&&['UL','OL'].includes(child.tagName)) {flush();visit(child,child.tagName==='UL'?'bullet':'ordered');}
      else if(child.nodeType===1&&['P','DIV','LI'].includes(child.tagName)) {flush();if([...child.children].some(c=>['P','DIV','UL','OL'].includes(c.tagName)))visit(child,type);else blocks.push({type,children:runs(child)});}
      else inline.push(...runs(child));
    }
    flush();
  }
  visit(root);
  return blocks.length?blocks:[{type:'paragraph',children:[]}];
}
