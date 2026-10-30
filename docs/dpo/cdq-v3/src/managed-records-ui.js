import {lotReconciliation} from './lot-verification-ui.js?historial-20261030';
import {sortedTypes} from './lot-catalog.js?abm-documental-20261028';
export function managedState(db,c,row){
 if(!row||row.deletion)return 'Eliminado';
 const lot=c==='lotes'?row:db.lotes.find(l=>l.id===row.loteId);
 const guard=db.lotManagement?.find(g=>g.id===lot?.id);
 if(guard?.pending===false)return 'Conciliado';
 const {review}=lot?lotReconciliation(db,lot):{};
 if(review&&review.registered===lot.declared)return 'Conciliado';
 return c==='lotes'?'Pendiente':row.state==='Pendiente'?'Pendiente':row.state;
}
export function managedCollection({db,s,page,query,esc,table,period,canManage,profile,linked,selectedCac}){
 const lots=page==='lotes',types=sortedTypes(db.catalog),rows=lots?s.lots:s.docs;
 const canDelete=canManage(page)&&profile?.role!=='asistente';
 const remOf=row=>db.remisiones.find(r=>r.id===(lots?row:db.lotes.find(l=>l.id===row.loteId))?.remisionId);
 const typeOf=lot=>types.find(t=>t.id===lot?.typeId||t.code===lot?.typeCode)?.description||lot?.typeCode||'Sin descripción';
 const selected=rows.filter(row=>{const lot=lots?row:db.lotes.find(l=>l.id===row.loteId),rem=remOf(row),cac=db.cacs.find(c=>c.id===rem?.cacId);return [row.code,row.number,typeOf(lot),cac?.name,period(rem||{})].join(' ').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'));});
 const groups=new Map();for(const row of selected){const rem=remOf(row);if(!groups.has(rem?.cacId))groups.set(rem?.cacId,[]);groups.get(rem?.cacId).push(row);}
 const headers=lots?['Seleccionar','Lote','Tipo de documento','Período','Declarados','Registrados / Individualizados','Estado','Acciones']:['Seleccionar','Documento','Lote','Tipo de documento','Estado','Observaciones','Fecha','Regularización','Responsable','Acciones'];
 const markup=[...groups].sort(([a],[b])=>(db.cacs.find(c=>c.id===a)?.name||'').localeCompare(db.cacs.find(c=>c.id===b)?.name||'','es',{numeric:true})).map(([cacId,items])=>{
  items.sort((a,b)=>(a.code||db.lotes.find(l=>l.id===a.loteId)?.code||'').localeCompare(b.code||db.lotes.find(l=>l.id===b.loteId)?.code||'','es',{numeric:true})||String(a.number||'').localeCompare(String(b.number||''),'es',{numeric:true}));
  const rendered=items.map(row=>{
   const lot=lots?row:db.lotes.find(l=>l.id===row.loteId),state=managedState(db,page,row),pending=state==='Pendiente',rem=remOf(row),active=!rem?.annulment;
   const childCount=lots?db.documentos.filter(d=>d.loteId===row.id).length:0;
   const checkbox=canDelete&&pending&&active&&childCount===0?`<input type="checkbox" data-managed-select="${esc(row.id)}" aria-label="Seleccionar ${esc(row.code||row.number)}">`:'';
   let actions=canManage(page)&&pending&&active?`<button class="secondary" data-edit="${page}" data-id="${esc(row.id)}">Editar</button>`:'';
   if(lots&&active)actions+=`<button class="secondary" data-verify-lot="${esc(row.id)}">${state==='Conciliado'?'Comentar':'Conciliar y verificar'}</button>`;
   if(!lots&&active&&canManage('observaciones'))actions+=`<button class="secondary" data-add-document-observation="${esc(row.id)}">${pending?'Agregar observación':'Comentar'}</button>`;
   const badge=`<span class="badge ${state==='Conciliado'?'remision-green':state==='Pendiente'?'remision-red':'remision-yellow'}">${esc(state)}</span>`;
   if(lots)return [checkbox,`<strong>${esc(row.code)}</strong>`,esc(typeOf(lot)),esc(period(rem)),row.declared,`${lotReconciliation(db,row).registered} · <button class="link" data-related="lotes" data-id="${esc(row.id)}">${childCount} ${childCount===1?'documento individualizado':'documentos individualizados'} →</button>`,badge,`<div class="remision-actions">${actions}</div>`];
   const obs=db.observaciones.filter(o=>o.documentId===row.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),last=obs[0];
   return [checkbox,esc(row.number),esc(lot?.code),esc(typeOf(lot)||row.type),badge,obs.length,esc(last?.date||'—'),esc(last?.status||'Sin observaciones'),esc(last?.owner||'—'),`<div class="remision-actions">${actions}</div>`];
  });
  if(lots&&selectedCac)return table(headers,rendered);
  return `<details class="document-group"><summary>${esc(db.cacs.find(c=>c.id===cacId)?.name||'CAC')} · ${items.length} ${lots?(items.length===1?'lote':'lotes'):(items.length===1?'documento':'documentos')}</summary>${table(headers,rendered)}</details>`;
 }).join('');
 const remIds=new Set(s.rem.map(r=>r.id)),removed=(db.deletedRecords||[]).filter(r=>r.collection===page&&remIds.has(lots?r.remisionId:[...db.lotes,...(db.deletedRecords||[]).filter(l=>l.collection==='lotes')].find(l=>l.id===r.loteId)?.remisionId));
 return `<section class="panel" data-managed-collection="${page}"><div class="section-line"><h2>${lots?'Lotes documentales':'Documentos individualizados'}</h2>${canManage(page)?`<button class="primary" data-new="${page}">${lots?'+ Nuevo registro por GDZS':'+ Nuevo registro'}</button>${lots?'<button class="secondary" data-add-single-lot>+ Agregar lote individual</button>':''}`:''}</div>${linked?'<p>Documentos vinculados al lote seleccionado. <button id="clear-context" class="link">Ver todos</button></p>':''}<input class="search" id="search" aria-label="Buscar registros" placeholder="${lots?'Buscar lote, tipo o CAC…':'Buscar documento, tipo o CAC…'}" value="${esc(query)}">${canDelete?'<div class="collection-toolbar"><label><input type="checkbox" id="managed-select-visible"> Seleccionar registros disponibles</label><button class="secondary remision-danger" id="managed-delete" disabled>Eliminar seleccionados (0)</button></div>':''}${markup||'<p>No hay registros para esta selección.</p>'}${removed.length?`<details class="document-group"><summary>Registros eliminados (${removed.length})</summary>${table(['Registro','Estado','Motivo'],removed.map(r=>[esc(r.code||r.number),'Eliminado',esc(r.deletion.reason)]))}</details>`:''}</section>`;
}
export function bindManagedRecords({db,cloud,esc,load}){
 const panel=document.querySelector('[data-managed-collection]'),button=panel?.querySelector('#managed-delete');if(!button)return;
 const c=panel.dataset.managedCollection,selected=new Set(),all=panel.querySelector('#managed-select-visible');
 const boxes=()=>[...panel.querySelectorAll('[data-managed-select]')].filter(b=>!b.closest('tr')?.hidden);
 const update=()=>{button.disabled=!selected.size;button.textContent=`Eliminar seleccionados (${selected.size})`;const visible=boxes();all.checked=visible.length>0&&visible.every(b=>b.checked);all.indeterminate=visible.some(b=>b.checked)&&!all.checked;};
 panel.addEventListener('change',e=>{if(e.target.matches('[data-managed-select]')){e.target.checked?selected.add(e.target.dataset.managedSelect):selected.delete(e.target.dataset.managedSelect);update();}});
 all.onchange=()=>{for(const b of boxes()){b.checked=all.checked;all.checked?selected.add(b.dataset.managedSelect):selected.delete(b.dataset.managedSelect);}update();};
 button.onclick=()=>{
  const records=db[c].filter(r=>selected.has(r.id)),modal=document.querySelector('#modal');
  modal.innerHTML=`<form><h2>Eliminar ${records.length} registros</h2><p>Cambiarán al estado Eliminado. Se conservarán los datos y el historial.</p><ul>${records.map(r=>`<li>${esc(r.code||r.number)}</li>`).join('')}</ul><label>Motivo<textarea name="reason" required maxlength="2000"></textarea></label><p role="status" id="managed-result"></p><div class="form-actions"><button class="primary">Confirmar eliminación</button><button type="button" class="secondary" id="managed-close">Cancelar</button></div></form>`;modal.showModal();let busy=false;const close=modal.querySelector('#managed-close');close.onclick=()=>modal.close();const prevent=e=>{if(busy)e.preventDefault();};modal.addEventListener('cancel',prevent);modal.addEventListener('close',()=>modal.removeEventListener('cancel',prevent),{once:true});
  modal.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;e.submitter.disabled=true;close.disabled=true;let completed=0;
   try{for(const row of records){const lot=c==='lotes'?row:db.lotes.find(l=>l.id===row.loteId),rem=db.remisiones.find(r=>r.id===lot.remisionId),g=db.cacs.find(c=>c.id===rem.cacId)?.gerenciaId;await cloud.call('deleteManagedRecord',{gerenciaId:g,collection:c,id:row.id,expectedRevision:row.revision,reason:new FormData(e.target).get('reason')});completed++;}modal.close();await load();}
   catch(error){modal.querySelector('#managed-result').textContent=`${completed} registros eliminados. ${error.message}`;close.textContent='Cerrar y actualizar';close.onclick=async()=>{modal.close();await load();};}finally{busy=false;close.disabled=false;}
  };
 };
}
