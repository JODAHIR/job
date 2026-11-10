import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {canConciliate} from './conciliation-permission.js';
import {archiveMetadata} from './remision-custody-domain.js';
export async function createIndependentArchive(store,auth,input){
 const {gerenciaId,year,month,number,description='',shelf='',row='',section='',scanned=false}=input;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(gerenciaId)||typeof description!=='string'||description.length>1000||typeof scanned!=='boolean')throw Error('Datos de archivo inválidos.');
 if((shelf||row||section)&&(!/^E(0[1-9]|10)$/.test(shelf)||!/^F[1-5]$/.test(row)||!['D','A'].includes(section)))throw Error('Complete una ubicación válida.');
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Inicie sesión.');
 return runTransaction(store,async tx=>{
  const base=`gerencias/${gerenciaId}`;
  const [g,p]=await Promise.all([tx.get(doc(store,base)),tx.get(doc(store,'users',uid))]);
  if(!g.exists()||!canConciliate(p.data(),auth.currentUser,{...g.data(),id:gerenciaId}))throw Error('No tiene permiso para registrar archivos en esta gerencia.');
  const meta=archiveMetadata({year,month},g.data(),String(Number(number)));
  const id=`${meta.year}_${meta.month}_${meta.number}`,ref=doc(store,base,'independentArchives',id),old=await tx.get(ref);
  if(old.exists())throw Error('Ya existe este archivo independiente.');
  tx.set(ref,{id,gerenciaId,...meta,description:description.trim(),shelf,row,section,scanned,origin:'independent',actor:uid,owner:p.data().description?.trim()||'Usuario sin descripción',at:serverTimestamp()});
  return {id};
 });
}
