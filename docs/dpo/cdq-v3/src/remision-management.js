import {openRemisionDetailWindow} from './remision-detail-window.js?remisiones-detalle-20261026';
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
export function managementActions(db,r,p,esc){const a=remisionActions(db,r,p);return `<div class="remision-actions">${a.edit?`<button class="secondary" data-edit="remisiones" data-id="${esc(r.id)}">Editar</button>`:''}${a.remove?`<button class="secondary remision-danger" data-remision-remove="${esc(r.id)}">Eliminar</button>`:''}<button class="secondary" data-remision-detail="${esc(r.id)}" title="Abrir ventana de detalle">Ver detalle</button></div>`;}
export function bindRemisionManagement(ctx){const {db,cloud,esc,load}=ctx;
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
