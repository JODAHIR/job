import {previewSelection,confirmSelection} from './annul-selection.js';
import {openRemisionDetailWindow} from './remision-detail-window.js';
import {currentVerification} from './lot-verification.js';
export function remisionState(db,r){
 if(r?.annulment)return 'Anulada';
 const lots=(db.lotes||[]).filter(l=>l.remisionId===r.id);
 const control=(db.remisionControls||[]).find(c=>c.id===r.id);
 const complete=lots.length>0&&lots.every(l=>{const v=currentVerification(db.lotVerifications||[],l,control,false,db);return v&&Number.isInteger(v.registered)&&v.registered===l.declared;});
 return complete?'Conciliada':r.receivedOn?'Registrada':'Pendiente';
}
export const canCreateRemision=p=>p?.active&&['technical','director','gerente'].includes(p.role);
export function remisionActions(db,r,p){const state=remisionState(db,r),locked=['Conciliada','Anulada'].includes(state);return {state,edit:!locked&&p?.active&&['technical','director','gerente','asistente'].includes(p.role),remove:!locked&&canCreateRemision(p)};}
export function remisionBadge(state,esc){return `<span class="badge remision-state ${state==='Conciliada'?'remision-green':state==='Registrada'?'remision-yellow':state==='Pendiente'?'remision-red':'neutral'}">${esc(state)}</span>`;}
export function managementActions(db,r,p,esc){const a=remisionActions(db,r,p);return `<div class="remision-actions">${a.remove?`<input type="checkbox" data-remision-select="${esc(r.id)}" aria-label="Seleccionar remisión ${esc(r.expediente||r.id)}">`:""}${a.edit?`<button class="secondary" data-edit="remisiones" data-id="${esc(r.id)}">Editar</button>`:''}${a.remove?`<button class="secondary remision-danger" data-remision-remove="${esc(r.id)}">Eliminar</button>`:''}<button class="secondary" data-remision-detail="${esc(r.id)}" title="Abrir ventana de detalle">Ver detalle</button></div>`;}
export function bindRemisionManagement(ctx){const {db,cloud,esc,load}=ctx;
 bindBulkRemisiones(ctx);
 document.querySelectorAll('[data-remision-detail]').forEach(b=>b.onclick=()=>{
 const r=db.remisiones.find(r=>r.id===b.dataset.remisionDetail),control=db.remisionControls?.find(c=>c.id===r.id);
 const types=Array.isArray(db.catalog?.types)?db.catalog.types:Object.values(db.catalog?.types||{});
 const rows=db.lotes.filter(l=>l.remisionId===r.id).map(l=>{const v=currentVerification(db.lotVerifications||[],l,control,!!r.annulment,db),type=types.find(t=>t.id===l.typeId||t.code===l.typeCode);return {...l,description:type?.description||l.typeCode||'—',registered:v?.registered,state:v&&v.registered===l.declared?'Conciliada':v?'Registrada':'Pendiente'};});
 openRemisionDetailWindow(`Lotes de ${r.expediente||r.id}`,rows);
 });
 document.querySelectorAll('[data-remision-remove]').forEach(b=>b.onclick=async()=>{
 const r=db.remisiones.find(r=>r.id===b.dataset.remisionRemove);if(!cloud?.spark||!remisionActions(db,r,cloud.profile).remove)return;
 const g=db.cacs.find(c=>c.id===r.cacId)?.gerenciaId,modal=document.querySelector('#modal');
 modal.innerHTML=`<form id="remision-delete-form"><h2>Eliminar remisión</h2><p>${esc(r.expediente||r.id)}</p><p>Se dará de baja la remisión. Sus lotes, documentos e historial se conservarán para consulta.</p><label>Motivo<textarea name="reason" maxlength="2000" required></textarea></label><p id="remision-delete-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" id="remision-delete-cancel">Cancelar</button><button class="primary">Confirmar baja</button></div></form>`;modal.showModal();document.querySelector('#remision-delete-cancel').onclick=()=>modal.close();document.querySelector('#remision-delete-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{const preview=await cloud.call('previewAnnulments',{gerenciaId:g,ids:[r.id]});await cloud.call('annulRemisiones',{preview,reason:new FormData(e.target).get('reason'),confirmed:true});modal.close();await load();}catch(error){document.querySelector('#remision-delete-error').textContent=error.message;e.submitter.disabled=false;}};
 });
}
export function unifyCollectionToolbar(){document.querySelectorAll('section.panel').forEach(panel=>{const search=panel.querySelector(':scope > input.search');const heading=panel.querySelector(':scope > .section-line');if(!search||!heading)return;const bar=document.createElement('div');bar.className='collection-toolbar';bar.append(search);for(const child of [...heading.children].slice(1))bar.append(child);heading.after(bar);});}

function bindBulkRemisiones({db,cloud,esc,load}){
 if(!cloud?.spark||!canCreateRemision(cloud.profile))return;
 const panel=document.querySelector('[data-remision-select]')?.closest('section.panel');if(!panel)return;
 const selected=new Set(),bar=document.createElement('div');bar.className='collection-toolbar';
 bar.innerHTML='<label><input type="checkbox" id="remision-select-page"> Seleccionar página</label><span id="remision-selected-count">0 seleccionadas</span><button class="secondary remision-danger" id="remision-bulk-delete" disabled>Eliminar seleccionadas</button>';
 panel.querySelector('.collection-toolbar')?.after(bar);
 const page=bar.querySelector('input'),count=bar.querySelector('span'),button=bar.querySelector('button');
 const update=()=>{count.textContent=selected.size+' seleccionadas';button.disabled=!selected.size;const boxes=[...panel.querySelectorAll('[data-remision-select]')];for(const b of boxes)b.checked=selected.has(b.dataset.remisionSelect);page.checked=boxes.length>0&&boxes.every(b=>b.checked);page.indeterminate=boxes.some(b=>b.checked)&&!page.checked;};
 panel.addEventListener('change',e=>{if(e.target.matches('[data-remision-select]')){e.target.checked?selected.add(e.target.dataset.remisionSelect):selected.delete(e.target.dataset.remisionSelect);update();}});
 page.onchange=()=>{for(const b of panel.querySelectorAll('[data-remision-select]'))page.checked?selected.add(b.dataset.remisionSelect):selected.delete(b.dataset.remisionSelect);update();};
 button.onclick=()=>{
 const rows=db.remisiones.filter(r=>selected.has(r.id)&&remisionActions(db,r,cloud.profile).remove);if(!rows.length)return;
 const modal=document.querySelector('#modal');modal.innerHTML=`<form id="bulk-remision-form"><h2>Eliminar ${rows.length} remisiones</h2><ul>${rows.map(r=>`<li>${esc(db.cacs.find(c=>c.id===r.cacId)?.name)} · ${esc(r.expediente||r.id)}</li>`).join('')}</ul><p>Se dará de baja cada remisión conservando sus lotes, documentos e historial.</p><label>Motivo<textarea name="reason" required maxlength="2000"></textarea></label><p id="bulk-result" role="status"></p><div class="form-actions"><button type="button" id="bulk-close" class="secondary">Cancelar</button><button class="primary">Confirmar eliminación</button></div></form>`;modal.showModal();const close=modal.querySelector('#bulk-close');close.onclick=()=>modal.close();
 modal.querySelector('form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;close.disabled=true;const reason=new FormData(e.target).get('reason'),groups=new Map();for(const r of rows){const g=db.cacs.find(c=>c.id===r.cacId)?.gerenciaId;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r.id);}let completed=0;
 try{for(const [g,ids] of groups){const previews=await previewSelection(cloud.call.bind(cloud),g,ids);const result=await confirmSelection(cloud.call.bind(cloud),previews,{reason,confirmed:true});completed+=result.rows.filter(r=>r.status==='Anulada').length;if(result.stopped||result.rows.some(r=>r.status!=='Anulada'))throw Error(result.rows.filter(r=>r.status!=='Anulada').map(r=>r.message).join(' · '));}modal.close();await load();}
 catch(error){modal.querySelector('#bulk-result').textContent=`${completed} dadas de baja. ${error.message} Cierre y actualice antes de volver a seleccionar.`;close.textContent='Cerrar y actualizar';close.onclick=async()=>{modal.close();await load();};}finally{close.disabled=false;}
 };
 };
}
