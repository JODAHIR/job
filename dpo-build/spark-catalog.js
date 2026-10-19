import {doc,getDocFromServer,runTransaction,serverTimestamp,collection,query,orderBy,where,limit,getDocsFromServer} from 'firebase/firestore';
import {catalogType,INITIAL_TYPES} from './lot-catalog.js';
export async function saveCatalog(store,auth,{type,expectedRevision,reason}){
 const t=catalogType(type);if(!reason?.trim()||reason.trim().length>2000)throw Error('Motivo obligatorio (máximo 2000).');
 return runTransaction(store,async tx=>{
  const ref=doc(store,'documentCatalog/current'),old=await tx.get(ref),before=old.exists()?old.data():null;
  if((before?.revision||0)!==expectedRevision)throw Error('El catálogo cambió; actualice antes de guardar.');
  const p=(await tx.get(doc(store,'users',auth.currentUser.uid))).data();if(!p?.active||!['director','technical'].includes(p.role))throw Error('No puede administrar el catálogo.');
  const revision=expectedRevision+1,after={revision,types:{...(before?.types||{}),[t.id]:t},changedId:t.id,actor:auth.currentUser.uid,updatedAt:serverTimestamp()};
  if(Object.keys(after.types).length>100)throw Error('Máximo 100 tipos; revise el tamaño del catálogo.');
  tx.set(ref,after);tx.set(doc(store,'documentCatalogVersions',String(revision)),after);
  tx.set(doc(store,'catalogAudit',String(revision)),{revision,actor:auth.currentUser.uid,role:p.role,at:serverTimestamp(),reason:reason.trim(),before:before?.types[t.id]||null,after:t});
  return after;
 });
}
export async function initializeCatalog(store,auth){
 const snap=await getDocFromServer(doc(store,'documentCatalog/current'));let current=snap.exists()?snap.data():null;
 for(const type of INITIAL_TYPES){if(current?.types[type.id])continue;current=await saveCatalog(store,auth,{type,expectedRevision:current?.revision||0,reason:'Inicialización explícita del catálogo CAH'});}
 return {revision:current.revision};
}

export async function catalogHistory(store,{beforeRevision}){
 const constraints=[orderBy('revision','desc'),limit(50)];
 if(beforeRevision!==undefined){if(!Number.isSafeInteger(beforeRevision)||beforeRevision<1)throw Error('Cursor inválido.');constraints.push(where('revision','<',beforeRevision));}
 return (await getDocsFromServer(query(collection(store,'catalogAudit'),...constraints))).docs.map(d=>d.data());
}
