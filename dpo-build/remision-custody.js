import {evaluateClosure} from './providencia-domain.js';
import {doc,getDocFromServer,collection,getDocsFromServer,query,orderBy,limit,runTransaction,serverTimestamp} from 'firebase/firestore';
import {custodyPayload,canManageCustody,archiveMetadata} from './remision-custody-domain.js';
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
function path(input){
 if(!validId(input.gerenciaId)||!validId(input.remisionId))throw Error('Remisión inválida.');
 return `gerencias/${input.gerenciaId}/remisiones/${input.remisionId}`;
}
export async function readRemisionCustody(store,input){
 return (await getDocsFromServer(query(collection(store,path(input),'custodyEvents'),orderBy('at','desc'),limit(100)))).docs.map(d=>d.data());
}
export async function saveRemisionCustody(store,auth,input){
 const parent=path(input);
 if(!validId(input.operationId)||!auth.currentUser?.uid)throw Error('Sesión u operación inválida.');
 const uid=auth.currentUser.uid;
 return runTransaction(store,async tx=>{
  const ref=doc(store,parent,'custodyEvents',input.operationId);
  const [row,profile,management,old]=await Promise.all([tx.get(doc(store,parent)),tx.get(doc(store,'users',uid)),tx.get(doc(store,'gerencias',input.gerenciaId)),tx.get(ref)]);
  if(!row.exists()||!canManageCustody(profile.data(),auth.currentUser,{...management.data(),id:input.gerenciaId},row.data()))throw Error('Solo los responsables designados, Director y Administrador pueden registrar esta acción en una remisión vigente y recibida.');
  const payload=custodyPayload(input.kind==='archive'?{kind:'archive',...archiveMetadata(row.data(),management.data(),input.number)}:input);
  if(old.exists()){
   if(old.data().actor!==uid||Object.entries(payload).some(([key,value])=>old.data()[key]!==value))throw Error('Identificador de operación ya utilizado.');
   return;
  }
  tx.set(ref,{...payload,id:input.operationId,actor:uid,owner:profile.data().description?.trim()||'Usuario sin descripción',at:serverTimestamp(),remisionRevision:row.data().revision});
 });
}

// Server-only inventory: table filters and cached rows cannot certify closure.
export async function readRemisionClosure(store,auth,input){
 const parent=path(input),uid=auth.currentUser?.uid;
 if(!uid)throw Error('Inicie sesión.');
 const [row,profile,management]=await Promise.all([getDocFromServer(doc(store,parent)),getDocFromServer(doc(store,'users',uid)),getDocFromServer(doc(store,'gerencias',input.gerenciaId))]);
 if(!row.exists()||!management.exists()||!canManageCustody(profile.data(),auth.currentUser,{...management.data(),id:input.gerenciaId},row.data()))throw Error('No tiene permiso para emitir la providencia.');
 const period={year:Number(row.data().year),month:Number(row.data().month),half:Number(row.data().half)};
 const read=async entity=>{
  const snapshot=await getDocsFromServer(query(collection(store,'gerencias',input.gerenciaId,entity),limit(3001)));
  if(snapshot.size>3000)throw Error('Inventario incompleto: no se puede emitir la providencia.');
  return snapshot.docs.map(d=>({...d.data(),id:d.id,gerenciaId:input.gerenciaId}));
 };
 const before=await read('remisionControls'),managementBefore=await read('lotManagement');
 const entities=['cacs','remisiones','lotes','documentos','observaciones','lotVerifications'];
 const values=await Promise.all(entities.map(read));
 const after=await read('remisionControls'),managementAfter=await read('lotManagement');
 const fence=rows=>JSON.stringify(rows.map(r=>[r.id,r.version]).sort((a,b)=>a[0].localeCompare(b[0])));
 if(fence(before)!==fence(after)||fence(managementBefore)!==fence(managementAfter))throw Error('Los datos cambiaron durante la comprobación. Intente generar el PDF nuevamente.');
 if(auth.currentUser?.uid!==uid)throw Error('La sesión cambió.');
 const db={...Object.fromEntries(entities.map((e,i)=>[e,values[i]])),remisionControls:after,completeInventory:true};
 const closure=evaluateClosure(db,input.gerenciaId,period);
 return {closure,period,issuer:profile.data().description||'',management:{...management.data(),id:input.gerenciaId}};
}
