import {newLotGuard} from './spark-document-management.js';
import {readPool} from './read-pool.js';
import {doc,collection,query,limit,getDocsFromServer,getDocFromServer,runTransaction,serverTimestamp} from 'firebase/firestore';
import {lotPermission,lotQuantity,typedKey} from './lot-catalog.js';
import {lifecycleFence} from './spark-lifecycle.js';
const identifier=v=>{if(!/^[A-Za-z0-9_-]{1,128}$/.test(v))throw Error('Identificador inválido.');return v;};
export async function createTypedLot(store,auth,{gerenciaId,remisionId,typeId,declared,catalogRevision,reason='Generación de lote documental'}){
 const g=identifier(gerenciaId),rid=identifier(remisionId);identifier(typeId);declared=lotQuantity(declared);
 if(!reason.trim()||reason.length>2000)throw Error('Motivo obligatorio.');
 const lotId=crypto.randomUUID();let attemptedKey;
 return runTransaction(store,async tx=>{
  const reqRef=doc(store,`gerencias/${g}/lotRequirements/${rid}`),controlRef=doc(store,`gerencias/${g}/remisionControls/${rid}`),remRef=doc(store,`gerencias/${g}/remisiones/${rid}`);
  const [profileSnap,rs,currentSnap,reqSnap,control]=await Promise.all([
   tx.get(doc(store,'users',auth.currentUser.uid)),tx.get(remRef),tx.get(doc(store,'documentCatalog/current')),tx.get(reqRef),tx.get(controlRef)
  ]);
  const p=profileSnap.data();if(!lotPermission(p,g))throw Error('Sin permisos en esta gerencia.');
  if(!rs.exists()||rs.data().annulment)throw Error('Sin remisión registrada vigente.');const r=rs.data();
  const current=currentSnap.data();if(!current||current.revision!==catalogRevision)throw Error('El catálogo cambió: revise nuevamente la selección.');
  const type=current.types[typeId];if(!type?.enabled)throw Error('Tipo no habilitado.');
  const version=reqSnap.exists()?reqSnap.data().catalogVersion:current.revision;
  const key=typedKey(g,r,typeId);attemptedKey=key;const lock=doc(store,'sparkKeys',key);
  const seqId=`${r.cacId}_${r.year}_${r.half}`,seqRef=doc(store,`gerencias/${g}/lotSequences/${seqId}`);
  const [cs,frozenSnap,existing,seqSnap]=await Promise.all([
   tx.get(doc(store,`gerencias/${g}/cacs/${r.cacId}`)),tx.get(doc(store,'documentCatalogVersions',String(version))),tx.get(lock),tx.get(seqRef)
  ]);
  if(!cs.exists()||cs.data().active===false)throw Error('CAC deshabilitado.');
  const frozen=frozenSnap.data();
  if(!frozen?.types[typeId]?.enabled)throw Error('Tipo fuera de la configuración histórica de esta remisión.');
  if(existing.exists())return {status:'existing',id:existing.data().recordId,remisionId:rid,typeId};
  if(!control.exists())throw Error('Un Administrador debe inicializar el control de esta remisión.');
  if(!reqSnap.exists()&&control.data().lots>0)throw Error('Lotes históricos sin clasificación: requiere revisión administrativa; no se crearán duplicados.');
  const sequence=(seqSnap.data()?.value||0)+1;
  const cacCode=cs.data().name.split(' - ')[0].trim();
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(cacCode))throw Error('El CAC necesita un código inicial válido antes de generar.');
  const code=`LOT_${String(sequence).padStart(2,'0')}_${type.code}_${cacCode}_${r.year}_${r.half}`;
  const after={id:lotId,remisionId:rid,code,declared,revision:1,updatedAt:serverTimestamp(),uniqueKey:key,typeId,typeCode:type.code,typeRequired:frozen.types[typeId].required,catalogVersion:version,sequence,cacCode};
  // Reuse snapshots read by this same transaction, never a cross-transaction cache.
  const fence=await lifecycleFence({get:ref=>ref.path===remRef.path?Promise.resolve(rs):ref.path===controlRef.path?Promise.resolve(control):tx.get(ref)},store,g,'lotes',after,null);
  if(!reqSnap.exists())tx.set(reqRef,{id:rid,catalogVersion:version,actor:auth.currentUser.uid,at:serverTimestamp()});
  tx.set(doc(store,`gerencias/${g}/lotManagement/${lotId}`),newLotGuard(lotId));
  tx.set(seqRef,{value:sequence,lotId,updatedAt:serverTimestamp()});
  tx.set(doc(store,`gerencias/${g}/lotes/${lotId}`),after);
  tx.set(lock,{path:`gerencias/${g}/lotes/${lotId}`,gerenciaId:g,entity:'lotes',recordId:lotId});
  tx.set(doc(store,'sparkIds','lotes_'+lotId),{gerenciaId:g,entity:'lotes',recordId:lotId});
  tx.set(fence.ref,fence.after);
  tx.set(doc(store,`gerencias/${g}/audit/lotes_${lotId}_1`),{id:`lotes_${lotId}_1`,actor:auth.currentUser.uid,role:p.role,collection:'lotes',recordId:lotId,at:serverTimestamp(),before:null,after,reason:reason.trim()});
  return {status:'created',id:lotId,code,remisionId:rid,typeId,declared};
 }).catch(async error=>{
  // A concurrent commit may turn a create of the immutable requirements into an update.
  // Only report Existing after verifying the exact persisted uniqueness reservation.
  if(error.code==='permission-denied'&&attemptedKey){const saved=await getDocFromServer(doc(store,'sparkKeys',attemptedKey));if(saved.exists())return {status:'existing',id:saved.data().recordId,remisionId:rid,typeId};}
  throw error;
 });
}
export async function generateLots(store,auth,input){
 const {gerenciaId:g,year,month,half,items,catalogRevision}=input;identifier(g);
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12||![1,2].includes(half)||!Array.isArray(items)||!items.length||items.length>200)throw Error('Período inválido o selección fuera del límite de 200 lotes.');
 const keys=new Set();for(const i of items){identifier(i.cacId);identifier(i.typeId);lotQuantity(i.declared);const k=i.cacId+'|'+i.typeId;if(keys.has(k))throw Error('Selección duplicada.');keys.add(k);}
 const remSnap=await getDocsFromServer(query(collection(store,`gerencias/${g}/remisiones`),limit(3001)));if(remSnap.size>3000)throw Error('Consulta incompleta: reduzca el ámbito.');
 const rem=remSnap.docs.map(d=>d.data()),results=[];
 const byCac=new Map();items.forEach((item,index)=>{if(!byCac.has(item.cacId))byCac.set(item.cacId,[]);byCac.get(item.cacId).push({item,index});});const groups=[...byCac.values()];
 await readPool(groups,async group=>{for(const {item,index} of group){
  const r=rem.find(r=>r.cacId===item.cacId&&r.year===year&&r.month===month&&r.half===half&&!r.annulment);
  if(!r){results[index]={...item,status:'omitted',message:'Sin remisión registrada'};continue;}
  try{results[index]={...item,...await createTypedLot(store,auth,{gerenciaId:g,remisionId:r.id,typeId:item.typeId,declared:item.declared,catalogRevision})};}
  catch(e){results[index]={...item,status:'error',message:e.message};}
 }},3);
 return {results};
}
