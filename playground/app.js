import {mountEditor} from '../resources/js/editor.js';
import {sources,records} from './seed.js';
let editor, activeMode='page',activeRecord='a';
const modeSelect=document.querySelector('#mode'),recordSelect=document.querySelector('#record');
async function request(key,method='GET',body){const r=await fetch(`/api/documents/${key}`,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();if(!r.ok)throw new Error(result.message);return result;}
async function open(){
 const mode=modeSelect.value,record=recordSelect.value;
 if(editor?.engine?.dirty && !(mode===activeMode&&mode==='template') && !confirm('Cambiare documento? Le modifiche non salvate verranno perse.')){modeSelect.value=activeMode;recordSelect.value=activeRecord;return;}
 document.querySelector('#record-label').hidden=mode==='page';
 document.querySelector('#public').href=`/public?mode=${mode==='page'?'page':'template'}&record=${record}`;
 if(mode===activeMode&&mode==='template'&&editor){activeRecord=record;await editor.setPreview(records[record].values,{description:(await request(`area-${record}`)).document});return;}
 editor?.destroy();activeMode=mode;activeRecord=record;
 const key=mode==='area'?`area-${record}`:mode;let revision;
 editor=await mountEditor(document.querySelector('#editor'),{
  title:mode==='template'?'Scheda prodotto':mode==='area'?`Descrizione · ${records[record].label}`:'Una pagina, infinite possibilità',
  mode:mode==='page'?'static':mode,kind:mode==='area'?'fragment':'page',sources,areas:['description'],areaLabels:{description:'Descrizione libera'},values:records[record].values,
  areaDocuments:{description:(await request(`area-${record}`)).document},
  adapter:{async load(){const result=await request(key);revision=result.revision;return result.document;},async save(document){const result=await request(key,'PUT',{document,revision});revision=result.revision;return result.document;}},
 });
}
modeSelect.addEventListener('change',()=>open().catch(showError));recordSelect.addEventListener('change',()=>open().catch(showError));
function showError(error){document.querySelector('#editor').textContent=`Impossibile aprire il playground: ${error.message}`;}
open().catch(showError);
