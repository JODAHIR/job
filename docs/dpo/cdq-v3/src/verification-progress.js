import {executiveMetrics,asuncionDate,civilDate} from './intelligence.js?dashboard-20261025';
import {escapeHTML as esc} from './intelligence-charts.js?dashboard-20261025';

// Only current review evidence is used. This is not a reconstruction of old snapshots.
export function dailyVerification(db,filters={}) {
 const day=civilDate(filters.verificationDay)||asuncionDate();
 const model=executiveMetrics(db,{...filters,gerencia:'',cac:'',control:'',observation:'',remission:''});
 const groups=(db.gerencias||[]).map(g=>({id:g.id,name:g.name,declared:0,reviewed:0,today:0,closed:0}));
 const details=[];
 for(const row of model.lotEvidence){
  const rem=model.remissions.find(r=>r.id===row.remisionId),cac=db.cacs.find(c=>c.id===rem?.cacId),g=groups.find(g=>g.id===cac?.gerenciaId);
  if(!g||row.invalid)continue;
  g.declared+=row.declared;
  if(!row.finished||!row.closedOn||row.closedOn>day)continue;
  g.reviewed+=row.controlled;g.closed++;
  if(row.closedOn===day)g.today+=row.controlled;
  const lot=db.lotes.find(l=>l.id===row.id);
  details.push({lot:lot?.code||row.id,gerencia:g.name,date:row.closedOn,quantity:row.controlled,responsible:db.users?.find(u=>u.id===row.reviewer)?.description||'Responsable no disponible',result:row.reviewResult||'Cierre registrado'});
 }
 return {day,groups,details};
}
export function dailyVerificationPanel(db,f){
 const {day,groups,details}=dailyVerification(db,f);
 return `<section class="panel"><h2>Avance diario de la verificación documental</h2><p>Todas las gerencias autorizadas · período seleccionado. Cantidad revisada acumulada hasta el día elegido y aporte de ese día, según las revisiones actualmente vigentes. Una nueva revisión reemplaza la anterior; no se suman duplicados. No representa una reconstrucción histórica.</p><p><span style="color:#21824a">● Completa</span> · <span style="color:#806000">🟡 Parcial</span> · <span style="color:#bc3038">● Sin revisión</span> · <span style="color:#64748b">● Sin documentos declarados</span>. El color representa el avance de revisión; las observaciones pendientes se muestran por separado.</p><label>Día de evaluación<input type="date" data-verification-day value="${day}"></label>${groups.map(g=>{const pct=g.declared?100*g.reviewed/g.declared:0;const color=!g.declared?'#64748b':pct>=100?'#21824a':pct>0?'#facc15':'#bc3038';const state=!g.declared?'Sin documentos declarados':pct>=100?'Revisión completa':pct>0?'Revisión parcial':'Sin revisión';return `<article style="margin:18px 0"><strong>${esc(g.name)}</strong> <span style="color:${color==='#facc15'?'#806000':color};font-weight:600">● ${state}</span><div style="display:flex;align-items:center;gap:12px"><progress style="width:65%;height:22px;accent-color:${color}" max="100" value="${pct}" aria-label="Avance de ${esc(g.name)}">${pct.toFixed(1)} %</progress><span style="color:${color==='#facc15'?'#806000':color};font-weight:700">${pct.toFixed(1)} %</span></div><small>${g.reviewed} de ${g.declared} documentos revisados · ${g.today} revisados el ${day} · ${Math.max(0,g.declared-g.reviewed)} pendientes</small></article>`;}).join('')||'<p>No hay gerencias autorizadas disponibles.</p>'}<details><summary>Evidencia de cierre: fecha, responsable y resultado</summary><div class="table-scroll"><table><thead><tr>${['Gerencia','Lote','Fecha de revisión','Responsable','Cantidad revisada','Resultado'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${details.map(r=>`<tr>${[r.gerencia,r.lot,r.date,r.responsible,r.quantity,r.result].map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="6">Sin revisiones vigentes hasta esta fecha.</td></tr>'}</tbody></table></div></details></section>`;
}
