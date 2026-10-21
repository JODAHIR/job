import {previewSelection,confirmSelection} from './annul-selection.js?v=cah-ajustes-20261020';
import {annulEligibility,treeCounts} from './remision-lifecycle.js?v=cah-lotes-20261019';
let origin='',status='active',lastResult='',lastSummary='',panelOpen=false;
export function annulPanel({db,cloud,f,esc,table}) {
  if(!cloud?.spark || !['technical','director','gerente'].includes(cloud.profile?.role))return '';
  const cacs=new Map(db.cacs.map(c=>[c.id,c]));
  const rows=db.remisiones.filter(r=>(!f.gerencia||cacs.get(r.cacId)?.gerenciaId===f.gerencia)&&(!f.cac||r.cacId===f.cac)&&(!f.year||r.year===+f.year)&&(!f.month||r.month===+f.month)&&(!f.half||r.half===+f.half)&&(status==='all'||(status==='annulled')===!!r.annulment)&&(!origin||(r.origin||'unknown')===origin));
  return `<details id="annul-section" class="access-section" ${panelOpen?'open':''}><summary>Anulación administrativa de remisiones${lastSummary?' · '+esc(lastSummary):''}</summary><div class="lifecycle-content"><p>Conserva los documentos y su historial. Puede seleccionar desde una remisión hasta todas las elegibles de esta selección. Se procesan en operaciones consecutivas y se informa el resultado de cada registro; no hay eliminación física.</p><div class="form-actions"><label>Origen<select id="annul-origin"><option value="">Todos</option><option value="automatic" ${origin==='automatic'?'selected':''}>Automáticas</option><option value="manual" ${origin==='manual'?'selected':''}>Manuales</option><option value="unknown" ${origin==='unknown'?'selected':''}>Origen no determinado</option></select></label><label>Estado administrativo<select id="annul-status">${[['active','Vigentes'],['annulled','Anuladas'],['all','Todas']].map(([v,t])=>`<option value="${v}" ${v===status?'selected':''}>${t}</option>`).join('')}</select></label><button id="annul-select" class="secondary">Seleccionar todas las elegibles</button></div>${table(['Seleccionar','CAC / período','Expediente','Origen','Lotes','Documentos','Observaciones','Elegibilidad / estado'],rows.map(r=>{const g=cacs.get(r.cacId)?.gerenciaId,control=db.remisionControls?.find(c=>c.id===r.id&&c.gerenciaId===g),counts=treeCounts(db,r.id),denial=annulEligibility(cloud.profile,g,r,control);return [`<input type="checkbox" aria-label="Seleccionar remisión ${esc(r.id)}" data-annul-id="${esc(r.id)}" data-annul-gerencia="${esc(g)}" ${denial?'disabled':''}>`,`${esc(cacs.get(r.cacId)?.name)} · ${r.year}/${r.month} · ${r.half}ª quincena`,esc(r.expediente||'—'),esc(r.origin==='automatic'?'Automática':r.origin==='manual'?'Manual':'No determinado'),counts.lots,counts.documents,counts.observations,r.annulment?`Anulada · ${esc(r.annulment.reason)} · ${esc(r.annulment.actor)} (${esc(r.annulment.role)}) · ${esc(r.annulment.at?.toDate?.().toLocaleString('es-PY')||'Fecha en auditoría')}`:(denial?esc(denial):'Elegible')+(!control&&cloud.profile.role==='technical'?` <button class="link" data-init-control="${esc(r.id)}" data-gerencia="${esc(g)}">Inicializar control</button>`:'')];}))}<p id="annul-count" role="status">0 seleccionadas</p><button class="secondary" id="annul-clear">Quitar selección</button><button class="primary" id="annul-preview" disabled>Revisar anulación</button><p id="annul-result" role="status" style="white-space:pre-line">${esc(lastResult)}</p></div></details>`;
}
export function bindAnnulPanel(ctx){
  const {db,cloud,esc,render,load}=ctx,$=s=>document.querySelector(s);
  if(!$('#annul-preview'))return;
  $('#annul-section').ontoggle=e=>{panelOpen=e.target.open;};
  $('#annul-origin').onchange=e=>{origin=e.target.value;render()};$('#annul-status').onchange=e=>{status=e.target.value;render()};
  const boxes=[...document.querySelectorAll('[data-annul-id]')];
  const update=()=>{const n=boxes.filter(b=>b.checked).length;$('#annul-preview').disabled=!n;$('#annul-count').textContent=`${n} seleccionadas de ${boxes.filter(b=>!b.disabled).length} elegibles (incluye todas las páginas)`;};boxes.forEach(b=>b.onchange=update);update();
  $('#annul-select').onclick=()=>{boxes.forEach(b=>{b.checked=!b.disabled});update()};
  $('#annul-clear').onclick=()=>{boxes.forEach(b=>b.checked=false);update()};
  document.querySelectorAll('[data-init-control]').forEach(b=>b.onclick=()=>{
    const modal=$('#modal');modal.innerHTML=`<form id="init-control-form"><h2>Inicializar control histórico</h2><p>Se inventariarán los registros de esta remisión. No se anulará ni eliminará ningún dato.</p><label>Motivo<input name="reason" required maxlength="2000"></label><p role="status" id="init-result"></p><div class="form-actions"><button type="button" id="init-close">Cancelar</button><button class="primary">Inicializar</button></div></form>`;modal.showModal();$('#init-close').onclick=()=>modal.close();$('#init-control-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await cloud.call('initializeControl',{gerenciaId:b.dataset.gerencia,remisionId:b.dataset.initControl,reason:new FormData(e.target).get('reason')});modal.close();lastResult='Control histórico inicializado.';await load()}catch(err){$('#init-result').textContent=err.message;e.submitter.disabled=false}};
  });
  $('#annul-preview').onclick=async e=>{
    e.target.disabled=true;
    try{
      const groups=new Map();
      for(const b of boxes.filter(b=>b.checked)){const g=b.dataset.annulGerencia;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(b.dataset.annulId);}
      const previews=[];
      for(const [g,ids] of groups)previews.push(...await previewSelection((name,input)=>cloud.call(name,input),g,ids,(done,total)=>{$('#annul-result').textContent=`Verificando ${done} de ${total} remisiones de ${db.gerencias.find(x=>x.id===g)?.name||g}…`;}));
      const preview={rows:previews.flatMap(p=>p.rows.map(r=>({...r,gerenciaId:p.gerenciaId})))};
      const groupSummary=[...groups].map(([g,ids])=>`${db.gerencias.find(x=>x.id===g)?.name||g}: ${ids.length}`).join(' · ');
      const eligible=preview.rows.filter(r=>!r.omitted),counts=eligible.reduce((a,r)=>({lots:a.lots+r.control.lots,documents:a.documents+r.control.documents,observations:a.observations+r.control.observations}),{lots:0,documents:0,observations:0});
      const modal=$('#modal');modal.innerHTML=`<form id="annul-confirm-form"><h2>Confirmar anulación administrativa</h2><p><strong>${esc(groupSummary)}</strong>: ${eligible.length} remisiones, ${counts.lots} lotes, ${counts.documents} documentos y ${counts.observations} observaciones.</p><ul>${preview.rows.map(r=>`<li>${esc(db.gerencias.find(g=>g.id===r.gerenciaId)?.name||r.gerenciaId)} · ${esc(r.id)} · ${esc(r.remision?.expediente||'Sin expediente')} · ${esc(r.omitted||'Elegible')}${r.dependencies?`<details><summary>Ver registros relacionados</summary><p>Lotes: ${esc(r.dependencies.lots.map(x=>x.code+' ['+x.id+']').join(', ')||'ninguno')}</p><p>Documentos: ${esc(r.dependencies.documents.map(x=>x.number+' ['+x.id+']').join(', ')||'ninguno')}</p><p>Observaciones: ${esc(r.dependencies.observations.map(x=>x.id+' (documento '+x.documentId+')').join(', ')||'ninguna')}</p></details>`:''}</li>`).join('')}</ul><p>Todos los registros se conservan. La remisión y sus dependencias quedarán bloqueadas para nuevas operaciones. Cada revisión vence en cinco minutos. La selección completa no es una única transacción: si una operación falla, se detiene el proceso y se muestran las confirmadas, las omitidas y las pendientes.</p><label>Motivo obligatorio<textarea name="reason" required maxlength="2000"></textarea></label><label class="check-label"><input type="checkbox" name="confirmed" required>Confirmo la anulación de las remisiones indicadas.</label><p id="annul-error" role="alert"></p><div class="form-actions"><button type="button" id="annul-close">Cancelar</button><button class="primary" ${eligible.length?'':'disabled'}>Confirmar anulación</button></div></form>`;modal.showModal();$('#annul-close').onclick=()=>modal.close();
      const completed=new Map();let confirmedReason=null,busy=false;
      const preventClose=event=>{if(busy)event.preventDefault();};modal.addEventListener('cancel',preventClose);modal.addEventListener('close',()=>modal.removeEventListener('cancel',preventClose),{once:true});
      $('#annul-confirm-form').onsubmit=async ev=>{
        ev.preventDefault();if(busy)return;busy=true;ev.submitter.disabled=true;$('#annul-close').disabled=true;
        const data=new FormData(ev.target);confirmedReason??=data.get('reason');
        const reasonInput=ev.target.querySelector('[name="reason"]');reasonInput.readOnly=true;
        try{
          const result=await confirmSelection((name,input)=>cloud.call(name,input),previews,{reason:confirmedReason,confirmed:data.get('confirmed')==='on',completed,onProgress:(done,total)=>{$('#annul-error').textContent=`Procesando ${done} de ${total} remisiones…`;}});
          lastSummary=`${result.rows.filter(r=>r.status==='Anulada').length} anuladas · ${result.rows.filter(r=>r.status==='Omitida').length} omitidas · ${result.rows.filter(r=>['Sin confirmar','No procesada'].includes(r.status)).length} pendientes de resolver`;
          lastResult=result.rows.map(r=>`${r.id}: ${r.status} — ${r.message}${r.operationId?' · Operación '+r.operationId:''}`).join('\n');
          if(result.stopped){$('#annul-error').textContent=lastResult+'\nEl proceso se detuvo. Puede reintentar la misma revisión sin repetir operaciones confirmadas. Si venció o cambiaron los registros, cierre y vuelva a revisar.';$('#annul-error').style.whiteSpace='pre-line';ev.submitter.textContent='Reintentar pendientes';$('#annul-close').textContent='Cerrar y actualizar';$('#annul-close').onclick=async()=>{modal.close();await load();};}
          else {panelOpen=false;modal.close();await load();}
        }catch(err){$('#annul-error').textContent=err.message;}
        finally {busy=false;ev.submitter.disabled=false;if($('#annul-close'))$('#annul-close').disabled=false;}
      };
    }catch(err){$('#annul-result').textContent=err.message}finally{update()}
  };
}
