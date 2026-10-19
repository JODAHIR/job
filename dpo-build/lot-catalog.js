import {scope} from './domain.js';
// Only the explicit initialization uses these defaults; runtime reads Firestore.
export const INITIAL_TYPES=['SCA','RES','CON','REC66','SCA-EVAL','CI','RUC','CIPYNES','CRC','F120','EQUI','ACP-FPY','DCOMP','adhe'].map((code,i)=>({id:code,code,description:code,required:i<4,enabled:true,order:i+1}));
export function catalogType(value){
 const keys=['id','code','description','required','enabled','order'];
 if(!value||Object.keys(value).some(k=>!keys.includes(k)))throw Error('Campos de tipo documental no admitidos.');
 const t={...value,description:value.description?.trim()};
 if(!/^[A-Za-z0-9_-]{1,40}$/.test(t.code)||t.id!==t.code)throw Error('Código inválido: use letras, números, guiones o guion bajo (hasta 40). El código no cambia.');
 if(!t.description||t.description.length>200)throw Error('Descripción obligatoria (máximo 200).');
 if(typeof t.required!=='boolean'||typeof t.enabled!=='boolean'||!Number.isSafeInteger(t.order)||t.order<0||t.order>10000)throw Error('Condición, estado u orden inválidos.');
 if(['SCA','RES','CON','REC66'].includes(t.code)&&(!t.required||!t.enabled))throw Error('Tipo obligatorio protegido: requiere autorización funcional expresa.');
 return t;
}
export const sortedTypes=c=>Object.values(c?.types||{}).sort((a,b)=>a.order-b.order||a.code.localeCompare(b.code));
export function lotQuantity(value){if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>1000000)throw Error('Cantidad obligatoria: entero entre 0 y 1000000.');return Number(value);}
export const lotPermission=(p,g)=>p?.active===true&&(p.role==='technical'||p.role==='director'||p.role==='gerente'&&p.gerenciaId===g||p.role==='asistente'&&(p.gerencias||[]).includes(g));
export const typedKey=(g,r,type)=>`typed|${g}|${r.cacId}|${r.year}|${r.month}|${r.half}|${type}`;
export function lotTracking(db,f){
 const scoped=scope(db,f),allowed=new Set(scoped.rem.map(r=>r.id));
 const rows=[];const months=f.month?[+f.month]:Array.from({length:12},(_,i)=>i+1),halves=f.half?[+f.half]:[1,2];
 for(const cac of db.cacs.filter(c=>(!f.gerencia||c.gerenciaId===f.gerencia)&&(!f.cac||c.id===f.cac)))for(const month of months)for(const half of halves){
  const r=db.remisiones.find(r=>r.cacId===cac.id&&r.year===+f.year&&r.month===month&&r.half===half);
  if(r&&!allowed.has(r.id)||!r&&!scoped.pendingRows.some(x=>x.cacId===cac.id&&x.month===month&&x.half===half))continue;
  const allLots=r?db.lotes.filter(l=>l.remisionId===r.id):[],lots=scoped.lots.filter(l=>l.remisionId===r?.id),req=(db.lotRequirements||[]).find(x=>x.id===r?.id),version=(db.catalogVersions||[]).find(x=>x.revision===req?.catalogVersion);
  const required=sortedTypes(version).filter(t=>t.enabled&&t.required),have=new Set(allLots.map(l=>l.typeId));
  const pending=required.filter(t=>!have.has(t.id));
  const docs=scoped.docs.filter(d=>lots.some(l=>l.id===d.loteId));
  const missing=lots.reduce((n,l)=>n+Math.max(0,l.declared-db.documentos.filter(d=>d.loteId===l.id).length),0);
  rows.push({cacId:cac.id,gerenciaId:cac.gerenciaId,year:+f.year,month,half,remisionId:r?.id,lots:lots.length,declared:lots.reduce((n,l)=>n+l.declared,0),received:docs.length,reviewed:docs.filter(d=>d.state!=='Pendiente').length,missing,observed:docs.filter(d=>d.state==='Verificado con observación').length,status:r?.annulment?'Anulada':!r?'Sin remisión':!lots.length?'Sin lotes':!version||lots.some(l=>!l.typeId)?'Histórico sin clasificación':pending.length?'Carga incompleta':'Carga completa',pending:pending.map(t=>t.code).join(', ')});
 }
 return rows;
}
