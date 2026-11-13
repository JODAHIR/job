import {currentVerification} from '../docs/dpo/cdq-v3/src/lot-verification.js';

// Receives a complete, unfiltered management/period inventory, never table rows.
export function evaluateClosure(db, managementId, period) {
  const pending = [], reviews = [], remissions = [];
  if (!db.completeInventory) return {eligible:false,pending:['No se pudo comprobar el inventario completo.']};
  if (!Number.isInteger(period.year) || !Number.isInteger(period.month) || period.month<1 || period.month>12 || ![1,2].includes(period.half)) return {eligible:false,pending:['Período inválido.']};
  const cacs = db.cacs.filter(c=>c.gerenciaId===managementId && c.active===true).sort((a,b)=>a.id.localeCompare(b.id, 'es', {numeric:true}));
  if (!cacs.length) pending.push('La gerencia no tiene CAC activos documentados.');
  for (const cac of cacs) {
    const rows=db.remisiones.filter(r=>r.cacId===cac.id && Number(r.year)===period.year && Number(r.month)===period.month && Number(r.half)===period.half && !r.annulment);
    if (!rows.length) {pending.push(`${cac.name}: sin remisión vigente.`);continue;}
    for (const r of rows) {
      remissions.push(r);
      if (!r.receivedOn) {pending.push(`${cac.name}: remisión sin recepción.`);continue;}
      const lots=db.lotes.filter(l=>l.remisionId===r.id && !l.annulment && !l.deletion && l.state!=='Eliminado');
      if (!lots.length) {pending.push(`${cac.name}: sin lotes vigentes.`);continue;}
      for (const l of lots) {
        const control=db.remisionControls.find(c=>c.id===r.id);
        const v=control&&Number.isSafeInteger(control.version)?currentVerification(db.lotVerifications,l,control,false,db):null;
        if (!v || !Number.isSafeInteger(l.declared) || l.declared<=0 || !Number.isSafeInteger(v.registered) || v.registered!==l.declared || Number(v.missing||0)>0 || Number(v.excess||0)>0) {
          pending.push(`${cac.name}: ${l.label||l.id} sin conciliación completa.`);
        } else reviews.push(v);
      }
    }
  }
  return {eligible:pending.length===0,pending,reviews,remissions,cacCount:cacs.length};
}
