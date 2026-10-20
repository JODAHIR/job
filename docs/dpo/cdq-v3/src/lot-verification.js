export const COMPLETE_COMMENT='Presentación sin inconvenientes, lote completo';
export function reconcileLot(lot,documents,observations=[]) {
 const docs=documents.filter(d=>d.loteId===lot.id),ids=new Set(docs.map(d=>d.id));
 const registered=docs.length,declared=lot.declared;
 if(!Number.isSafeInteger(declared)||declared<0)throw Error('Cantidad declarada inválida.');
 const openObservations=observations.filter(o=>ids.has(o.documentId)&&o.status!=='Regularizada').length;
 return {declared,registered,missing:Math.max(0,declared-registered),excess:Math.max(0,registered-declared),openObservations,complete:declared>0&&registered===declared&&openObservations===0};
}
export function verificationResult(summary,confirmed,comments='') {
 if(typeof comments!=='string'||comments.trim().length>2000)throw Error('Comentarios: máximo 2000 caracteres.');
 if(confirmed&&!summary.complete)throw Error('El lote tiene diferencias, observaciones pendientes o está vacío.');
 return {confirmed:confirmed===true,result:confirmed&&summary.complete?'Verificado':'Con observaciones',comments:confirmed&&summary.complete?COMPLETE_COMMENT:comments.trim(),reviewerComments:comments.trim()};
}
export function currentVerification(records,lot,control,annulled=false) {
 const rows=records.filter(v=>v.lotId===lot.id).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0)||(b.at?.nanoseconds||0)-(a.at?.nanoseconds||0));
 const latest=rows[0];
 return latest&&!annulled&&latest.lotRevision===lot.revision&&latest.controlVersion===control?.version?latest:null;
}
