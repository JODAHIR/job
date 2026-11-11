import {executiveMetrics,asuncionDate,civilDate} from './intelligence.js';
import {escapeHTML as esc} from './intelligence-charts.js';

// Only current review evidence is used. This is not a reconstruction of old snapshots.
export function dailyVerification(db,filters={}) {
 const day=civilDate(filters.verificationDay)||asuncionDate();
 const model=executiveMetrics(db,{...filters,gerencia:'',cac:'',control:'',observation:'',remission:''});
 const groups=(db.gerencias||[]).map(g=>({id:g.id,name:g.name,declared:0,reviewed:0,today:0,closed:0,pendingObservations:0,inProgressObservations:0,pendingLots:[]}));
 const details=[];
 for(const row of model.lotEvidence){
  const rem=model.remissions.find(r=>r.id===row.remisionId),cac=db.cacs.find(c=>c.id===rem?.cacId),g=groups.find(g=>g.id===cac?.gerenciaId);
  if(!g||row.invalid)continue;
  g.declared+=row.declared;
  const lot=db.lotes.find(l=>l.id===row.id);
  const eligible=row.finished&&row.closedOn&&row.closedOn<=day;
  const reviewed=eligible?row.controlled:0;
  const pending=Math.max(0,row.declared-reviewed);
  if(pending)g.pendingLots.push({lot:lot?.code||row.id,cac:cac?.name||rem?.cacId,declared:row.declared,reviewed,pending,reason:!row.finished?'Sin revisión vigente':!row.closedOn?'Sin fecha de revisión':row.closedOn>day?'Revisión posterior al día seleccionado':'Cantidad revisada menor a la declarada'});
  if(!eligible)continue;
  g.reviewed+=row.controlled;g.closed++;
  if(row.closedOn===day)g.today+=row.controlled;
  details.push({lot:lot?.code||row.id,gerencia:g.name,date:row.closedOn,quantity:row.controlled,responsible:db.users?.find(u=>u.id===row.reviewer)?.description||'Responsable no disponible',result:row.reviewResult||'Cierre registrado'});
 }
 const docs=new Map((model.documentRows||[]).map(d=>[d.id,d]));
 const lots=new Map((db.lotes||[]).map(l=>[l.id,l]));
 for(const obs of model.observationRows||[]){
  const lot=lots.get(docs.get(obs.documentId)?.loteId);
  const rem=model.remissions.find(r=>r.id===lot?.remisionId);
  const cac=db.cacs.find(c=>c.id===rem?.cacId);
  const g=groups.find(g=>g.id===cac?.gerenciaId);
  if(!g)continue;
  if(obs.status==='Pendiente')g.pendingObservations++;
  if(obs.status==='En proceso')g.inProgressObservations++;
 }
 return {day,groups,details};
}
export function dailyVerificationPanel(db,f){
 const {day,groups,details}=dailyVerification(db,f);
 return `<section class="panel"><h2>Avance diario de la verificación documental</h2><p><span style="color:#21824a">● Completa</span> · <span style="color:#806000">🟡 Parcial</span> · <span style="color:#bc3038">● Sin revisión</span> · <span style="color:#64748b">● Sin documentos declarados</span></p><label>Día de evaluación<input type="date" data-verification-day value="${day}"></label>${groups.map(g=>{const pct=g.declared?100*g.reviewed/g.declared:0;const color=!g.declared?'#64748b':pct>=100?'#21824a':pct>0?'#facc15':'#bc3038';const state=!g.declared?'Sin documentos declarados':pct>=100?'Revisión completa':pct>0?'Revisión parcial':'Sin revisión';return `<article style="margin:18px 0"><strong>${esc(g.name)}</strong> <span style="color:${color==='#facc15'?'#806000':color};font-weight:600">● ${state}</span><div style="display:flex;align-items:center;gap:12px"><progress style="width:65%;height:22px;accent-color:${color}" max="100" value="${pct}" aria-label="Avance de ${esc(g.name)}">${pct.toFixed(1)} %</progress><span style="color:${color==='#facc15'?'#806000':color};font-weight:700">${pct.toFixed(1)} %</span></div><small>${g.reviewed} de ${g.declared} documentos revisados · ${g.today} revisados el ${day} · ${Math.max(0,g.declared-g.reviewed)} documentos pendientes de revisión</small><p>Observaciones actuales: ${g.pendingObservations} pendientes · ${g.inProgressObservations} en proceso</p>${g.pendingLots.length?`<details><summary>Ver lotes con documentos pendientes de revisión (${g.pendingLots.length})</summary><p>La diferencia corresponde a cantidades sin revisión acreditada para el día seleccionado; no es el número de observaciones.</p><div class="table-scroll"><table><thead><tr>${['CAC','Lote','Declarados','Revisados','Pendientes de revisión','Motivo'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${g.pendingLots.map(r=>`<tr>${[r.cac,r.lot,r.declared,r.reviewed,r.pending,r.reason].map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:''}</article>`;}).join('')||'<p>No hay gerencias autorizadas disponibles.</p>'}<details><summary>Evidencia de cierre: fecha, responsable y resultado</summary><div class="table-scroll"><table><thead><tr>${['Gerencia','Lote','Fecha de revisión','Responsable','Cantidad revisada','Resultado'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${details.map(r=>`<tr>${[r.gerencia,r.lot,r.date,r.responsible,r.quantity,r.result].map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="6">Sin revisiones vigentes hasta esta fecha.</td></tr>'}</tbody></table></div></details></section>`;
}
