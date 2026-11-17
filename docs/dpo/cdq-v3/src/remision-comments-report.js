import {scope} from './domain.js?v=cah-lotes-20261019';
import {makeReport} from './reports.js?reportes-20261106';
export function commentsReport(db,f,source='Firestore · datos autorizados'){
 const base=makeReport(db,f,{type:'documentos',source});
 return {...base,title:'Comentarios generales de remisiones',headers:['Gerencia','CAC','Período','Expediente','Comentario general','Autor','Fecha y hora (Paraguay)','Estado administrativo'],rows:[],pdfIntroduction:[],note:'Comentarios generales registrados en las remisiones del ámbito seleccionado. Una fila por comentario; se omiten remisiones sin comentarios. Fecha y hora de Paraguay.'};
}
export async function loadCommentsReport(db,f,cloud,isCurrent=()=>true){
 const report=commentsReport(db,f),remisiones=scope(db,f).rem;
 let cursor=0;const rows=[];
 await Promise.all(Array.from({length:Math.min(3,remisiones.length)},async()=>{
  while(isCurrent()&&cursor<remisiones.length){
   const r=remisiones[cursor++],cac=db.cacs.find(c=>c.id===r.cacId),g=db.gerencias.find(g=>g.id===cac?.gerenciaId);
   if(!g)throw Error('No se pudo determinar la gerencia de una remisión.');
   const comments=await cloud.call('remisionComments',{gerenciaId:g.id,remisionId:r.id});
   for(const c of comments){
    const seconds=c.at?.seconds??c.at?._seconds;
    const date=Number.isFinite(seconds)?new Date(seconds*1000):null;
    rows.push({time:seconds||0,row:[g.name,cac.name,`${String(r.month).padStart(2,'0')}/${r.year} · ${r.half===1?'1ª':'2ª'} quincena`,r.expediente||'Sin expediente',c.description||'',c.owner||'Sin autor registrado',date?date.toLocaleString('es-PY',{timeZone:'America/Asuncion'}):'Sin fecha registrada',r.annulment?'Anulada':'Vigente']});
   }
  }
 }));
 if(!isCurrent())return null;
 rows.sort((a,b)=>a.row[0].localeCompare(b.row[0],'es')||a.row[1].localeCompare(b.row[1],'es',{numeric:true})||b.time-a.time);
 report.rows=rows.map(x=>x.row);report.generatedAt=new Date().toISOString();return report;
}
