import {doc,runTransaction,serverTimestamp,getDocFromServer} from 'firebase/firestore';
import {catalogChange} from './observation-catalog.js';
export async function readObservationCatalog(store){
 const snap=await getDocFromServer(doc(store,'observationCatalog/current'));
 return snap.exists()?snap.data():{revision:0,entries:{}};
}
export async function saveObservationCatalog(store,auth,input){
 return runTransaction(store,async tx=>{
  const ref=doc(store,'observationCatalog/current'),snap=await tx.get(ref);
  const current=snap.exists()?snap.data():{revision:0,entries:{}};
  const profile=(await tx.get(doc(store,'users',auth.currentUser.uid))).data();
  if(!profile?.active||!['technical','director'].includes(profile.role))throw Error('Solo los administradores del catálogo pueden modificarlo.');
  if(current.revision!==input.expectedRevision)throw Error('El catálogo cambió. Actualice y vuelva a intentar.');
  const entry=catalogChange(current,input.entry),revision=current.revision+1;
  const entries={...current.entries,[entry.id]:entry};
  if(Object.keys(entries).length>300)throw Error('El catálogo alcanzó 300 descripciones parametrizadas.');
  const after={entries,revision,changedId:entry.id,actor:auth.currentUser.uid,updatedAt:serverTimestamp()};
  tx.set(ref,after);
  tx.set(doc(store,'observationCatalogAudit',String(revision)),{revision,actor:auth.currentUser.uid,at:serverTimestamp(),before:current.entries[entry.id]||null,after:entry});
  return {revision};
 });
}
