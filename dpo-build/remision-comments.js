import {doc,collection,getDocsFromServer,runTransaction,serverTimestamp} from 'firebase/firestore';
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export async function remisionComments(store,{gerenciaId,remisionId}){
 if(!validId(gerenciaId)||!validId(remisionId))throw Error('Remisión inválida.');
 return (await getDocsFromServer(collection(store,`gerencias/${gerenciaId}/remisiones/${remisionId}/comments`))).docs.map(d=>d.data()).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));
}
export async function addRemisionComment(store,auth,{gerenciaId,remisionId,operationId,description}){
 if(![gerenciaId,remisionId,operationId].every(validId)||typeof description!=='string'||!description.trim()||description.trim().length>2000)throw Error('Ingrese un comentario de hasta 2000 caracteres.');
 return runTransaction(store,async tx=>{
  const rr=doc(store,`gerencias/${gerenciaId}/remisiones/${remisionId}`),ref=doc(collection(rr,'comments'),operationId);
  const r=await tx.get(rr),p=await tx.get(doc(store,'users',auth.currentUser.uid)),old=await tx.get(ref);
  if(old.exists()){if(old.data().actor!==auth.currentUser.uid||old.data().description!==description.trim())throw Error('Operación ya utilizada.');return;}
  if(!r.exists()||r.data().annulment||!r.data().receivedOn)throw Error('Solo se puede comentar una remisión registrada y vigente.');
  if(!p.data()?.active)throw Error('Usuario inactivo.');
  tx.set(ref,{id:operationId,actor:auth.currentUser.uid,owner:p.data().description?.trim()||'Usuario sin descripción',description:description.trim(),at:serverTimestamp()});
 });
}
