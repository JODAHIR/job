import {executiveMetrics,asuncionDate,civilDate} from './intelligence.js';
import {reportLotCounts} from './report-lot-counts.js';
import {sortedTypes} from './lot-catalog.js';
import {escapeHTML as esc} from './intelligence-charts.js';

// Only current review evidence is used. This is not a reconstruction of old snapshots.
export function dailyVerification(db,filters={}) {
 const day=civilDate(filters.verificationDay)||asuncionDate();
 const model=executiveMetrics(db,{...filters,gerencia:'',cac:'',control:'',observation:'',remission:''});
 const groups=(db.gerencias||[]).map(g=>({id:g.id,name:g.name,declared:0,reviewed:0,today:0,closed:0,pendingObservations:0,inProgressObservations:0,pendingLots:[],observedCacs:[],unreviewedLots:[],pendingDocuments:0,regularizedDocuments:0}));
 const details=[];
 const types=sortedTypes(db.catalog);
 const observationsByDocument=new Map();
 for(const obs of model.observationRows||[]){
  if(!observationsByDocument.has(obs.documentId))observationsByDocument.set(obs.documentId,[]);
  observationsByDocument.get(obs.documentId).push(obs);
 }
 for(const row of model.lotEvidence){
  const rem=model.remissions.find(r=>r.id===row.remisionId),cac=db.cacs.find(c=>c.id===rem?.cacId),g=groups.find(g=>g.id===cac?.gerenciaId);
  if(!g||row.invalid)continue;
  g.declared+=row.declared;
  const lot=db.lotes.find(l=>l.id===row.id);
  const eligible=row.finished&&row.closedOn&&row.closedOn<=day;
  const reviewed=eligible?row.controlled:0;
  const docs=(model.documentRows||[]).filter(d=>d.loteId===row.id);
  const type=types.find(t=>t.id===lot.typeId||t.code===lot.typeCode);
  const unresolved=docs.filter(d=>{
   const observations=observationsByDocument.get(d.id)||[];
   return observations.length?observations.some(o=>o.status!=='Regularizada'):!['Conciliado','Verificado'].includes(d.state);
  });
  const counts=reportLotCounts(lot,unresolved.length,reviewed,type);
  const normalized=String(type?.code||lot.typeCode||'').toLowerCase();
  const adhesion=normalized==='adhe'||String(type?.description||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()==='acuerdo de adhesion';
  // Without a current reconciliation, an adhesion shortfall is unknown, not the entire declared quantity.
  const pending=adhesion?(eligible?counts.missing:0):counts.missing;
  g.pendingDocuments+=pending;
  if(pending){
   let summary=g.observedCacs.find(c=>c.id===cac.id);
   if(!summary){summary={id:cac.id,name:cac.name,documents:[],adhesionMissing:0};g.observedCacs.push(summary);}
   if(adhesion)summary.adhesionMissing+=pending;
   else for(const d of unresolved){
    if(!summary.documents.some(existing=>existing.id===d.id))summary.documents.push({id:d.id,number:d.number||d.code||d.id,lot:lot.code||lot.id});
   }
  }
  g.regularizedDocuments+=docs.filter(d=>{const os=observationsByDocument.get(d.id)||[];return os.length&&os.every(o=>o.status==='Regularizada');}).length;
  if(pending)g.pendingLots.push({lot:lot?.code||row.id,cac:cac?.name||rem?.cacId,declared:row.declared,reviewed:eligible?reviewed:'Sin conciliación vigente',pending,reason:adhesion?'Faltante según conciliación de Adhesión':'Documentos individualizados pendientes o con observación'});
  if(!eligible)g.unreviewedLots.push({lot:lot?.code||row.id,cac:cac?.name||rem?.cacId,reason:!row.finished?'Sin conciliación vigente':!row.closedOn?'Sin fecha de revisión':'Revisión posterior al día seleccionado'});
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
 return `<section class="panel"><h2>Avance diario de la verificación documental</h2><p><span style="color:#21824a">● Completa</span> · <span style="color:#806000">🟡 Parcial</span> · <span style="color:#bc3038">● Sin revisión</span> · <span style="color:#64748b">● Sin documentos declarados</span></p><label>Día de evaluación<input type="date" data-verification-day value="${day}"></label>${groups.map(g=>{const pct=g.declared?100*g.reviewed/g.declared:0;const color=!g.declared?'#64748b':pct>=100?'#21824a':pct>0?'#facc15':'#bc3038';const state=!g.declared?'Sin documentos declarados':pct>=100?'Revisión completa':pct>0?'Revisión parcial':'Sin revisión';return `<article style="margin:18px 0"><strong>${esc(g.name)}</strong> <span style="color:${color==='#facc15'?'#806000':color};font-weight:600">● ${state}</span><div style="display:flex;align-items:center;gap:12px"><progress style="width:65%;height:22px;accent-color:${color}" max="100" value="${pct}" aria-label="Avance de ${esc(g.name)}">${pct.toFixed(1)} %</progress><span style="color:${color==='#facc15'?'#806000':color};font-weight:700">${pct.toFixed(1)} %</span></div><small>${g.reviewed} de ${g.declared} documentos revisados · ${g.today} revisados el ${day}</small><p>Observaciones actuales: ${g.pendingObservations} pendientes · ${g.inProgressObservations} en proceso · ${g.regularizedDocuments} documentos regularizados</p>${observedCacSummary(g)}${g.unreviewedLots.length?`<details><summary>Lotes sin conciliación vigente al día seleccionado (${g.unreviewedLots.length})</summary><ul>${g.unreviewedLots.map(r=>`<li>${esc(r.cac)} · ${esc(r.lot)} · ${esc(r.reason)}</li>`).join('')}</ul></details>`:''}</article>`;}).join('')||'<p>No hay gerencias autorizadas disponibles.</p>'}<details><summary>Evidencia de cierre: fecha, responsable y resultado</summary><div class="table-scroll"><table><thead><tr>${['Gerencia','Lote','Fecha de revisión','Responsable','Cantidad revisada','Resultado'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${details.map(r=>`<tr>${[r.gerencia,r.lot,r.date,r.responsible,r.quantity,r.result].map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="6">Sin revisiones vigentes hasta esta fecha.</td></tr>'}</tbody></table></div></details></section>`;
}

function observedCacSummary(group){
 const rows=[...group.observedCacs].sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));
 if(!rows.length)return '';
 return `<details><summary>Documentos con observaciones</summary><div class="table-scroll"><table><thead><tr><th>CAC</th><th>Documentos con observaciones</th><th>Faltantes de Adhesión</th><th>Detalle</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.documents.length}</td><td>${c.adhesionMissing}</td><td>${c.documents.length?`<details><summary>Ver observaciones</summary>${c.documents.map(d=>`<p>${esc(d.lot)} · <button class="link" data-intel-record="documentos" data-id="${esc(d.id)}">Documento ${esc(d.number)} · Ver observaciones</button></p>`).join('')}</details>`:'Faltante según conciliación del lote'}</td></tr>`).join('')}</tbody></table></div></details>`;
}
