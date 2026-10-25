import {doc,getDocFromServer} from 'firebase/firestore';
import {sparkWriter,sparkRow} from './spark-records.js';
export async function registerDocument(store,auth,{gerenciaId,row,observation}){
 const write=sparkWriter(store,auth);
 row=sparkRow('documentos',{...row,state:'Pendiente'});
 const profile=(await getDocFromServer(doc(store,'users',auth.currentUser.uid))).data();
 if(observation){
  const owner=profile?.description?.trim();
  if(!owner||owner.length>150)throw Error('Complete una descripción de usuario de hasta 150 caracteres antes de registrar la observación.');
  observation=sparkRow('observaciones',{...observation,documentId:row.id,owner});
  if(!['Pendiente','En proceso','Regularizada'].includes(observation.status)||!/^\d{4}-\d{2}-\d{2}$/.test(observation.date)||Number.isNaN(Date.parse(observation.date))||new Date(observation.date).toISOString().slice(0,10)!==observation.date)throw Error('Fecha o estado de observación inválido.');
 }
 const base='gerencias/'+gerenciaId;
 const existing=await getDocFromServer(doc(store,base,'documentos',row.id));
 if(existing.exists()){
  if(['type','number','loteId'].some(k=>existing.data()[k]!==row[k]))throw Error('El documento ya guardado tiene otros datos. Actualice antes de continuar.');
 }else await write({gerenciaId,collection:'documentos',row});
 if(observation){
  try{
   const prior=await getDocFromServer(doc(store,base,'observaciones',observation.id));
   if(prior.exists()){
    if(['documentId','description','date','status'].some(k=>prior.data()[k]!==observation[k]))throw Error('La observación guardada tiene otros datos.');
   }else await write({gerenciaId,collection:'observaciones',row:observation});
  }catch(e){throw Error('El documento está guardado; falta confirmar la observación. Pulse Guardar nuevamente para reintentar sin duplicar. '+e.message);}
 }
 return {id:row.id};
}
