import {readPool} from './read-pool.js';
import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {currentVerification} from './lot-verification.js';
import {lifecycleFence} from './spark-lifecycle.js';
export const newLotGuard=id=>({id,pending:true,documents:0,version:1,event:'create',recordId:id,updatedAt:serverTimestamp()});
export async function initializeManagement(store,auth,state,onProgress=()=>{}){
 if(state.profile?.role!=='technical')return;
 const remissions=new Map(state.remisiones.map(r=>[r.id,r])), cacs=new Map(state.cacs.map(c=>[c.id,c])), guards=new Set((state.lotManagement||[]).map(m=>m.id));
 const controls=new Map(state.remisionControls.map(c=>[c.id,c]));
 const counts=new Map();for(const d of state.documentos)if(!d.deletion)counts.set(d.loteId,(counts.get(d.loteId)||0)+1);
 const pending=state.lotes.filter(l=>!guards.has(l.id)&&!l.deletion);let done=0;
 await readPool(pending,async lot=>{
  const rem=remissions.get(lot.remisionId),g=cacs.get(rem?.cacId)?.gerenciaId;
  if(!g||lot.deletion||rem?.annulment||guards.has(lot.id))return;
  const control=controls.get(rem.id),review=currentVerification(state.lotVerifications,lot,control,false,state);
  const initialized=await runTransaction(store,async tx=>{
   const ref=doc(store,`gerencias/${g}/lotManagement/${lot.id}`);
   const [old,ls,cs]=await Promise.all([tx.get(ref),tx.get(doc(store,`gerencias/${g}/lotes/${lot.id}`)),tx.get(doc(store,`gerencias/${g}/remisionControls/${rem.id}`))]);
   if(old.exists())return old.data();
   if(ls.data()?.revision!==lot.revision||cs.data()?.version!==control?.version)return null;
   const guard={id:lot.id,pending:!review||review.registered!==lot.declared,documents:counts.get(lot.id)||0,version:1,event:'initialize',recordId:lot.id,updatedAt:serverTimestamp()};
   tx.set(ref,guard);return guard;
  });
  if(initialized)state.lotManagement.push(initialized);
  onProgress({phase:"Preparando controles de lotes",done:++done,total:pending.length});
 },3);
}
export async function deleteManagedRecord(store,auth,{gerenciaId:g,collection:c,id,expectedRevision,reason}){
 if(!['lotes','documentos'].includes(c)||![g,id].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)))throw Error('Registro inválido.');
 if(typeof reason!=='string'||!reason.trim()||reason.trim().length>2000)throw Error('Ingrese un motivo de hasta 2000 caracteres.');
 return runTransaction(store,async tx=>{
  const profile=(await tx.get(doc(store,'users',auth.currentUser.uid))).data();
  const ref=doc(store,`gerencias/${g}/${c}/${id}`),snap=await tx.get(ref),before=snap.data();
  if(!before||before.deletion||before.revision!==expectedRevision)throw Error('El registro cambió. Actualice antes de continuar.');
  const lotId=c==='lotes'?id:before.loteId,guardRef=doc(store,`gerencias/${g}/lotManagement/${lotId}`),gs=await tx.get(guardRef),guard=gs.data();
  if(!guard?.pending||c==='documentos'&&before.state!=='Pendiente')throw Error('Solo se pueden eliminar registros pendientes.');
  if(c==='lotes'&&guard.documents!==0)throw Error('El lote tiene documentos vinculados.');
  const after={...before,deletion:{state:'Eliminado',actor:auth.currentUser.uid,at:serverTimestamp(),reason:reason.trim()},revision:before.revision+1,updatedAt:serverTimestamp()};
  const fence=await lifecycleFence(tx,store,g,c,after,before);
  tx.set(ref,after);tx.set(fence.ref,fence.after);
  if(c==='documentos')tx.set(guardRef,{...guard,documents:guard.documents-1,version:guard.version+1,event:'document',recordId:id,updatedAt:serverTimestamp()});
  tx.set(doc(store,`gerencias/${g}/audit/${c}_${id}_${after.revision}`),{id:`${c}_${id}_${after.revision}`,actor:auth.currentUser.uid,...(c==='lotes'?{role:profile.role}:{}),collection:c,recordId:id,at:serverTimestamp(),before,after,reason:reason.trim()});
  return {id,state:'Eliminado'};
 });
}
