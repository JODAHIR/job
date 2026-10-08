import {filterProcedures,changedFields,displayValue} from './procedure-view.js';
import {auth,isOwner,listHistory,errorMessage} from './firebase.js';
const $=id=>document.getElementById(id);
let historyVersion=0;
export function clearHistory(){historyVersion++;$('history-list').replaceChildren();$('history-status').textContent='Seleccioná un procedimiento para consultar sus modificaciones.'}
export function renderLibrary(items,selected,onSelect){
 const query=$('procedure-search').value,category=$('category-filter').value,visible=filterProcedures(items,query,category),list=$('list');
 const opened=new Set([...list.querySelectorAll('details[open]')].map(d=>d.dataset.state)),first=!list.children.length;
 list.replaceChildren();$('search-status').textContent=`${visible.length} de ${items.length} procedimientos`;
 if(!visible.length){list.textContent=items.length?'No hay coincidencias. Probá con otro término.':'Todavía no hay procedimientos.';return}
 for(const [published,label,key] of [[true,'Publicados','published'],[false,'Borradores','draft']]){
  const group=visible.filter(item=>item.published===published),details=document.createElement('details');details.className='procedure-group';details.dataset.state=key;details.open=first||opened.has(key)||!!query;
  const summary=document.createElement('summary');summary.textContent=label;const count=document.createElement('span');count.className='group-count';count.textContent=group.length;summary.append(count);details.append(summary);
  const body=document.createElement('div');body.className='group-body';
  for(const item of group){const button=document.createElement('button'),name=document.createElement('span'),tag=document.createElement('small');button.type='button';name.textContent=item.title;tag.textContent=item.category||'Sin categoría';button.className='procedure-item';button.setAttribute('aria-pressed',String(item.id===selected));button.onclick=()=>onSelect(item);button.append(name,tag);body.append(button)}
  if(!group.length){const p=document.createElement('p');p.className='empty-state';p.textContent='Sin procedimientos en este estado.';body.append(p)}details.append(body);list.append(details);
 }
}
export async function showHistory(id){
 const version=++historyVersion;$('history-list').replaceChildren();$('history-status').textContent='Cargando historial…';
 try{const revisions=await listHistory(id);if(version!==historyVersion||!isOwner(auth.currentUser))return;
 $('history-status').textContent=revisions.length?`${revisions.length} modificaciones registradas.`:'Sin historial registrado. Se conservarán los cambios realizados desde la activación de esta función.';
 for(const revision of revisions){const detail=document.createElement('details');detail.className='history-entry';const summary=document.createElement('summary'),date=revision.changedAt?.toDate?.();summary.textContent=(date?new Intl.DateTimeFormat('es-PY',{dateStyle:'medium',timeStyle:'short'}).format(date):'Fecha pendiente')+' · '+(revision.before?'Modificación':'Creación');detail.append(summary);
  const author=document.createElement('p');author.className='history-author';author.textContent='Realizado por '+revision.changedEmail;detail.append(author);
  const changes=changedFields(revision.before,revision.after);if(!changes.length){const p=document.createElement('p');p.textContent='Guardado sin cambios en el contenido.';detail.append(p)}
  for(const change of changes){const block=document.createElement('div');block.className='history-change';const title=document.createElement('h4');title.textContent=change.label;block.append(title);
   for(const [label,value] of [['Antes',change.before],['Después',change.after]]){const caption=document.createElement('strong');caption.textContent=label;const text=document.createElement('p');text.textContent=displayValue(change.key,value);block.append(caption,text)}detail.append(block)
  }$('history-list').append(detail)
 }
 }catch(e){if(version===historyVersion)$('history-status').textContent=errorMessage(e)}
}
