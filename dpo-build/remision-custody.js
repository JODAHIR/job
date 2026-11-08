import {doc,collection,getDocsFromServer,query,orderBy,limit,runTransaction,serverTimestamp} from 'firebase/firestore';
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
