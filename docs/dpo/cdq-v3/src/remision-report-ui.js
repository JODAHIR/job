import {canManageCustody} from './remision-custody-domain.js';

export function reportContext(db,cloud,rows){
 if(!cloud?.spark)return null;
 const row=rows.find(r=>{
  const g=db.gerencias.find(g=>g.id===db.cacs.find(c=>c.id===r.cacId)?.gerenciaId);
  return !!g&&canManageCustody(cloud.profile,cloud.auth?.currentUser,g,r);
 });
 if(!row)return null;
 return {remisionId:row.id,gerenciaId:db.cacs.find(c=>c.id===row.cacId).gerenciaId};
}
export function reportButton(db,cloud,rows,esc){
 const target=reportContext(db,cloud,rows);
 return target?`<button type="button" class="secondary remision-report" data-remision-report="${esc(target.remisionId)}" data-report-gerencia="${esc(target.gerenciaId)}" title="Generar informe PDF de la gerencia y quincena">Informe</button>`:'';
}
export function bindRemisionReports({db,cloud}){
 document.querySelectorAll('[data-remision-report]').forEach(button=>button.onclick=async()=>{
  if(button.disabled)return;
  const row=db.remisiones.find(r=>r.id===button.dataset.remisionReport);
  const target=row&&reportContext(db,cloud,[row]);
  const status=button.closest('.remision-period-group').querySelector('[data-report-status]');
  status.hidden=false;
  if(!target||target.gerenciaId!==button.dataset.reportGerencia){status.textContent='No tiene permiso para generar el informe de esta gerencia.';return;}
  button.disabled=true;status.textContent='Comprobando la conciliación de todos los CAC de la gerencia…';
  try{
   const data=await cloud.call('readRemisionClosure',target);
   if(!data.closure.eligible){status.textContent='Informe pendiente: '+data.closure.pending.join(' ');return;}
   const {downloadClosure}=await import('./providencia.bundle.js');
   downloadClosure(data);status.textContent='Informe PDF generado.';
  }catch(error){status.textContent='No se pudo generar el informe: '+error.message;}
  finally{button.disabled=false;}
 });
}
