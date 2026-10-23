export const COMPLETE_COMMENT='Presentación sin inconvenientes, lote completo';
export function reconcileLot(lot,documents,observations=[]) {
 const docs=documents.filter(d=>d.loteId===lot.id),ids=new Set(docs.map(d=>d.id));
 const registered=docs.length,declared=lot.declared;
 if(!Number.isSafeInteger(declared)||declared<0)throw Error('Cantidad declarada inválida.');
 const openObservations=observations.filter(o=>ids.has(o.documentId)&&o.status!=='Regularizada').length+docs.filter(d=>d.state==='Rechazado').length;
 return {declared,registered,missing:Math.max(0,declared-registered),excess:Math.max(0,registered-declared),openObservations,complete:declared>0&&registered===declared&&openObservations===0};
}
export function verificationResult(summary,confirmed,comments='') {
 if(typeof comments!=='string'||comments.trim().length>2000)throw Error('Comentarios: máximo 2000 caracteres.');
 if(confirmed&&!summary.complete)throw Error('El lote tiene diferencias, observaciones pendientes o está vacío.');
 return {confirmed:confirmed===true,result:confirmed&&summary.complete?'Verificado':'Con observaciones',comments:confirmed&&summary.complete?COMPLETE_COMMENT:comments.trim(),reviewerComments:comments.trim()};
}
export function currentVerification(records,lot,control,annulled=false,inventory=null) {
 const rows=records.filter(v=>v.lotId===lot.id).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0)||(b.at?.nanoseconds||0)-(a.at?.nanoseconds||0));
 const latest=rows[0];
 if(!latest||annulled||latest.lotRevision!==lot.revision)return null;
 if(latest.controlVersion===control?.version)return latest;
 // A remisión fence also changes for sibling lots. Reuse a review only with
 // complete inventory and server timestamps proving its own dependencies unchanged.
 if(!inventory||!Array.isArray(inventory.documentos)||!Array.isArray(inventory.observaciones))return null;
 const stamp=t=>Number.isFinite(t?.seconds)?[t.seconds,t.nanoseconds||0]:null;
 const reviewed=stamp(latest.at);if(!reviewed)return null;
 const docs=inventory.documentos.filter(d=>d.loteId===lot.id),ids=new Set(docs.map(d=>d.id));
 const related=[lot,...docs,...inventory.observaciones.filter(o=>ids.has(o.documentId))];
 return related.every(row=>{const t=stamp(row.updatedAt);return t&&(t[0]<reviewed[0]||t[0]===reviewed[0]&&t[1]<=reviewed[1]);})?latest:null;
}

export function reconcilePresented(summary, registered) {
 if(!Number.isSafeInteger(registered)||registered<0||registered>1000000)throw Error('Ingrese una cantidad entera entre 0 y 1000000.');
 return {...summary,individualized:summary.registered,countSource:'manual',registered,missing:Math.max(0,summary.declared-registered),excess:Math.max(0,registered-summary.declared),complete:summary.declared>0&&registered===summary.declared&&summary.openObservations===0};
}
