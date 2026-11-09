import {collection,doc,getDocsFromServer,query,orderBy,limit,runTransaction,serverTimestamp} from 'firebase/firestore';
import {canManageCustody} from './remision-custody-domain.js';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const key=e=>`${e.year}_${e.month}_${e.number}`;
async function pool(items,fn){let cursor=0;const out=[];await Promise.all(Array.from({length:Math.min(5,items.length)},async()=>{while(cursor<items.length){const i=cursor++;out[i]=await fn(items[i]);}}));return out;}
export async function readOperationalArchive(store,{gerenciaId}){
 if(!valid(gerenciaId))throw Error('Gerencia inválida.');
 const base=`gerencias/${gerenciaId}`;
 const rows=(await getDocsFromServer(collection(store,base,'remisiones'))).docs.map(d=>({...d.data(),id:d.id})).filter(r=>!r.annulment&&r.receivedOn);
 const entries=await pool(rows,async row=>{
  // Read the full history so scan confirmations cannot hide older archive assignments.
  const events=(await getDocsFromServer(collection(store,base,'remisiones',row.id,'custodyEvents'))).docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0)||(b.at?.nanoseconds||0)-(a.at?.nanoseconds||0));
  const archive=events.find(e=>e.kind==='archive');if(!archive)return null;
  return {row,archive,scanned:events.some(e=>e.kind==='scan'&&e.confirmed===true&&e.remisionRevision===row.revision)};
 });
 const groups=new Map();for(const e of entries.filter(Boolean)){const id=key(e.archive);if(!groups.has(id))groups.set(id,{id,gerenciaId,name:e.archive.name,year:e.archive.year,month:e.archive.month,number:e.archive.number,remisiones:[],anchor:{remisionId:e.row.id,eventId:e.archive.id}});groups.get(id).remisiones.push({...e.row,scanned:e.scanned});}
 return pool([...groups.values()],async g=>({...g,locations:(await getDocsFromServer(query(collection(store,base,'archives',g.id,'locations'),orderBy('at','desc'),limit(100)))).docs.map(d=>d.data())}));
}
export async function saveArchiveLocation(store,auth,input){
 const {gerenciaId,archiveId,remisionId,eventId,operationId,shelf,row,section}=input;
 if(![gerenciaId,archiveId,remisionId,eventId,operationId].every(valid)||!/^E(0[1-9]|10)$/.test(shelf)||!/^F[1-5]$/.test(row)||!['D','A'].includes(section))throw Error('Seleccione estante, fila y sección válidos.');
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Inicie sesión.');
 const base=`gerencias/${gerenciaId}`,ref=doc(store,base,'archives',archiveId,'locations',operationId);
 return runTransaction(store,async tx=>{
  const [r,g,p,e,old]=await Promise.all([tx.get(doc(store,base,'remisiones',remisionId)),tx.get(doc(store,base)),tx.get(doc(store,'users',uid)),tx.get(doc(store,base,'remisiones',remisionId,'custodyEvents',eventId)),tx.get(ref)]);
  if(!r.exists()||!e.exists()||e.data().kind!=='archive'||key(e.data())!==archiveId||!canManageCustody(p.data(),auth.currentUser,{...g.data(),id:gerenciaId},r.data()))throw Error('No tiene permiso para ubicar este archivo.');
  if(old.exists()){if(old.data().actor!==uid||old.data().shelf!==shelf||old.data().row!==row||old.data().section!==section)throw Error('Operación ya utilizada.');return;}
  tx.set(ref,{id:operationId,remisionId,eventId,shelf,row,section,actor:uid,owner:p.data().description?.trim()||'Usuario sin descripción',at:serverTimestamp()});
 });
}
