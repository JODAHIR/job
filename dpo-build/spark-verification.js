import {doc,collection,query,where,limit,getDocsFromServer,getDocFromServer,runTransaction,serverTimestamp} from 'firebase/firestore';
import {lotPermission} from './lot-catalog.js';
import {reconcileLot,reconcilePresented,verificationResult} from './lot-verification.js';
const id=v=>{if(typeof v!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(v))throw Error('Identificador inválido.');return v;};
export async function reviewLot(store,auth,{gerenciaId,lotId}) {
 const g=id(gerenciaId),l=id(lotId),base=`gerencias/${g}`;
 const ls=await getDocFromServer(doc(store,base,'lotes',l));if(!ls.exists())throw Error('Lote inexistente.');
 if(ls.data().deletion)throw Error('El lote está eliminado.');
 const lot=ls.data(),ref=doc(store,base,'remisionControls',lot.remisionId),before=await getDocFromServer(ref);
 if(!before.exists())throw Error('El Administrador debe inicializar el control de la remisión.');
 const [ds,os,rs]=await Promise.all([
 getDocsFromServer(query(collection(store,base,'documentos'),where('loteId','==',l),limit(3001))),
 getDocsFromServer(query(collection(store,base,'observaciones'),limit(3001))),getDocFromServer(doc(store,base,'remisiones',lot.remisionId))]);
 // Read fence again after both inventory queries, not concurrently with them.
 const end=await getDocFromServer(ref);
 if(ds.size>3000||os.size>3000)throw Error('Inventario incompleto: revisión bloqueada.');
 if(before.data().version!==end.data().version)throw Error('Los documentos cambiaron. Revise nuevamente.');
 if(!rs.exists()||rs.data().annulment)throw Error('La remisión está anulada o no existe.');
 return {gerenciaId:g,lotId:l,lot,controlVersion:end.data().version,inventory:{documentos:ds.docs.map(d=>d.data()).filter(d=>!d.deletion),observaciones:os.docs.map(d=>d.data())},summary:reconcileLot(lot,ds.docs.map(d=>d.data()).filter(d=>!d.deletion),os.docs.map(d=>d.data()))};
}
export async function verifyLot(store,auth,{review,confirmed=false,comments='',operationId,registered}) {
 const g=id(review.gerenciaId),l=id(review.lotId),op=id(operationId),base=`gerencias/${g}`;
 // Refresh inventory and observations; manual presented totals are recorded separately.
 const fresh=await reviewLot(store,auth,{gerenciaId:g,lotId:l});
 if(fresh.controlVersion!==review.controlVersion||fresh.lot.revision!==review.lot.revision)throw Error('El lote cambió desde su revisión. Vuelva a conciliar.');
 const summary=registered===undefined?fresh.summary:reconcilePresented(fresh.summary,registered);
 if(fresh.summary.registered>0&&!comments.trim())throw Error('Ingrese un comentario sobre los documentos individualizados.');
 const result=verificationResult(summary,confirmed,comments);
 if(!confirmed&&!comments.trim())throw Error('Describa el resultado de la revisión.');
 return runTransaction(store,async tx=>{
 const target=doc(store,base,'lotVerifications',op);
 const [existing,ps,ls,cs,rs]=await Promise.all([tx.get(target),tx.get(doc(store,'users',auth.currentUser.uid)),tx.get(doc(store,base,'lotes',l)),tx.get(doc(store,base,'remisionControls',fresh.lot.remisionId)),tx.get(doc(store,base,'remisiones',fresh.lot.remisionId))]);
 if(existing.exists()){if(existing.data().actor!==auth.currentUser.uid)throw Error('Operación ajena.');return existing.data();}
 if(!lotPermission(ps.data(),g)||ps.data().role!=='technical')throw Error('Solo el Administrador puede cambiar el estado del lote.');
 if(!ls.exists()||ls.data().revision!==fresh.lot.revision||cs.data()?.version!==fresh.controlVersion||!rs.exists()||rs.data().annulment)throw Error('El lote cambió. Vuelva a conciliar.');
 const guardRef=doc(store,base,'lotManagement',l),guard=(await tx.get(guardRef)).data()||{id:l,documents:fresh.summary.registered,version:0};
 const {complete,...counts}=summary;
 const record={id:op,lotId:l,code:fresh.lot.code,remisionId:fresh.lot.remisionId,lotRevision:fresh.lot.revision,controlVersion:fresh.controlVersion,actor:auth.currentUser.uid,role:ps.data().role,at:serverTimestamp(),...counts,...result};
 tx.set(guardRef,{...guard,pending:summary.registered!==summary.declared,version:guard.version+1,event:'verification',recordId:op,updatedAt:serverTimestamp()});
 tx.set(target,record);return record;
 });
}
export async function lotVerificationHistory(store,{gerenciaId,lotId}) {
 const snap=await getDocsFromServer(query(collection(store,`gerencias/${id(gerenciaId)}/lotVerifications`),where('lotId','==',id(lotId)),limit(3001)));
 if(snap.size>3000)throw Error('Historial extenso: consulta incompleta bloqueada.');
 return snap.docs.map(d=>d.data()).sort((a,b)=>b.at.seconds-a.at.seconds||b.at.nanoseconds-a.at.nanoseconds);
}

export async function addVerificationComment(store,auth,{gerenciaId,lotId,verificationId,comments,operationId}){
 const g=id(gerenciaId),l=id(lotId),v=id(verificationId),op=id(operationId),base=`gerencias/${g}`;
 if(typeof comments!=='string'||!comments.trim()||comments.trim().length>2000)throw Error('Ingrese un comentario de hasta 2000 caracteres.');
 return runTransaction(store,async tx=>{
  const target=doc(store,base,'lotVerificationComments',op);
  const [existing,profile,review]=await Promise.all([tx.get(target),tx.get(doc(store,'users',auth.currentUser.uid)),tx.get(doc(store,base,'lotVerifications',v))]);
  if(!lotPermission(profile.data(),g))throw Error('Sin permisos para comentar este lote.');
  if(existing.exists()){if(existing.data().actor!==auth.currentUser.uid)throw Error('Operación ajena.');return existing.data();}
  if(!review.exists()||review.data().lotId!==l||review.data().registered!==review.data().declared)throw Error('Seleccione una verificación válida.');
  const record={id:op,lotId:l,verificationId:v,comments:comments.trim(),actor:auth.currentUser.uid,role:profile.data().role,at:serverTimestamp()};
  tx.set(target,record);return record;
 });
}
export async function verificationComments(store,{gerenciaId,lotId}){
 const snap=await getDocsFromServer(query(collection(store,`gerencias/${id(gerenciaId)}/lotVerificationComments`),where('lotId','==',id(lotId)),limit(3001)));
 if(snap.size>3000)throw Error('Historial de comentarios incompleto.');
 return snap.docs.map(d=>d.data()).sort((a,b)=>b.at.seconds-a.at.seconds||b.at.nanoseconds-a.at.nanoseconds);
}
