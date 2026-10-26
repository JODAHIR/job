import {ANNUL_LIMIT} from './remision-lifecycle.js';

// Selection is unlimited within the loaded, authorized scope. Each server
// transaction retains its existing bounded size and security checks.
export async function previewSelection(call,gerenciaId,ids,onProgress=()=>{}) {
 if(!gerenciaId||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Seleccione remisiones de una gerencia, sin duplicados.');
 const previews=[];
 for(let start=0;start<ids.length;start+=ANNUL_LIMIT) {
  previews.push(await call('previewAnnulments',{gerenciaId,ids:ids.slice(start,start+ANNUL_LIMIT)}));
  onProgress(Math.min(start+ANNUL_LIMIT,ids.length),ids.length);
 }
 return previews;
}
export async function confirmSelection(call,previews,{reason,confirmed,completed=new Map(),onProgress=()=>{}}) {
 if(confirmed!==true||typeof reason!=='string'||!reason.trim())throw Error('Se requiere confirmación y motivo.');
 const rows=[];let stopped=false;
 for(const preview of previews) {
  const omitted=preview.rows.filter(r=>r.omitted);
  rows.push(...omitted.map(r=>({id:r.id,status:'Omitida',message:r.omitted})));
  const eligible=preview.rows.filter(r=>!r.omitted);
  if(!eligible.length)continue;
  if(stopped){rows.push(...eligible.map(r=>({id:r.id,status:'No procesada',message:'Pendiente de resolver la operación anterior.'})));continue;}
  try {
   let result=completed.get(preview.operationId);
   if(!result) {
    result=await call('annulRemisiones',{preview,reason,confirmed});
    completed.set(preview.operationId,result);
   }
   rows.push(...result.ids.map(id=>({id,status:'Anulada',operationId:result.id,message:'Historial conservado.'})));
   rows.push(...(result.omitted||[]).map(r=>({id:r.id,status:'Omitida',message:r.reason})));
  }catch(error) {
   stopped=true;
   rows.push(...eligible.map(r=>({id:r.id,status:'Sin confirmar',operationId:preview.operationId,message:error.message})));
  }
  onProgress(rows.length,previews.reduce((n,p)=>n+p.rows.length,0));
 }
 return {rows,completed,stopped};
}
