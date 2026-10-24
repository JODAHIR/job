import {scope} from './domain.js';
import {sortedTypes} from './lot-catalog.js';
import {currentVerification} from './lot-verification.js';

export function managementFilters(filters,profile,gerencias) {
 if(!profile)return {...filters};
 if(['director','technical'].includes(profile.role))return {...filters};
 const allowed=profile.role==='gerente'?[profile.gerenciaId]:(profile.gerencias||[]);
 const available=gerencias.filter(g=>allowed.includes(g.id));
 const id=available.some(g=>g.id===filters.gerencia)?filters.gerencia:available[0]?.id;
 return {...filters,gerencia:id||'__sin_gerencia_autorizada__'};
}
export function managementSummary(db, filters={}) {
 const selected=scope(db,filters), types=sortedTypes(db.catalog);
 const lots=[...selected.lots].sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),'es',{numeric:true}));
 const remissions=new Map(db.remisiones.map(r=>[r.id,r]));
 const groups=new Map();
 for(const lot of lots){
  const type=types.find(t=>t.id===lot.typeId||t.code===lot.typeCode);
  const key=type?.id||lot.typeId||lot.typeCode||'unclassified';
  if(!groups.has(key))groups.set(key,[type?.description||lot.typeCode||'Sin clasificación',0,0,0,0]);
  const row=groups.get(key), docs=db.documentos.filter(d=>d.loteId===lot.id);
  const review=currentVerification(db.lotVerifications||[],lot,db.remisionControls?.find(c=>c.id===lot.remisionId),!!remissions.get(lot.remisionId)?.annulment,db);
  const missing=Math.max(0,lot.declared-(review?.registered??docs.length));
  row[1]+=lot.declared;row[2]+=docs.length;row[3]+=missing;row[4]+=lot.declared-(docs.length+missing);
 }
 const headers=['Tipo de documento','Declarados','Individualizados','Faltantes','Verificados correctamente'];
 const rows=[...groups.values()];
 if(rows.length)rows.push(['TOTAL GENERAL',...headers.slice(1).map((_,i)=>rows.reduce((sum,row)=>sum+row[i+1],0))]);
 return {headers,rows};
}
