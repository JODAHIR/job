import {collection,doc,getDocsFromServer,getDocFromServer} from 'firebase/firestore';
import {dateOnly} from './shared/deadlines.js';
import {sparkWriter} from './spark-records.js';
export async function generateRemisiones(store,auth,input){
 const {gerenciaId,year,month,half,receivedOn,remittedOn}=input;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(gerenciaId)||!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12||![1,2].includes(half))throw Error('Gerencia y período inválidos.');
 const expediente=typeof input.expediente==='string'?input.expediente.trim():'';
 if(!expediente||expediente.length>150)throw Error('Número de expediente obligatorio (máximo 150 caracteres).');
 dateOnly(receivedOn);dateOnly(remittedOn);
 if(remittedOn>receivedOn)throw Error('La fecha de remisión no puede ser posterior a la recepción.');
 const profile=(await getDocFromServer(doc(store,'users',auth.currentUser.uid))).data();
 if(!profile?.active||!(profile.role==='technical'||profile.role==='asistente'&&profile.gerencias.includes(gerenciaId)))throw Error('No tiene permisos de registro en esta gerencia.');
 const cacs=(await getDocsFromServer(collection(store,`gerencias/${gerenciaId}/cacs`))).docs.map(d=>d.data()).filter(c=>c.active!==false);
 if(cacs.length>200)throw Error('La generación admite hasta 200 CAC activos por gerencia.');
 const existing=(await getDocsFromServer(collection(store,`gerencias/${gerenciaId}/remisiones`))).docs.map(d=>d.data());
 const result={created:[],controls:[],skipped:[],failed:[]};
 const save=sparkWriter(store,auth);
 for(const cac of cacs){
  if(existing.some(r=>r.cacId===cac.id&&r.year===year&&r.month===month&&r.half===half)){result.skipped.push(cac.id);continue;}
  const row={id:crypto.randomUUID(),cacId:cac.id,year,month,half,receivedOn,remittedOn,expediente,origin:'automatic'};
  try{const saved=await save({gerenciaId,collection:'remisiones',row,reason:'Generación de remisiones por gerencia'});result.created.push(saved.saved);if(saved.control)result.controls.push(saved.control);}
  catch(error){
   // Otra sesión puede haber creado el mismo CAC/período mientras se procesaba.
   if(error.message==='Ya existe ese registro.')result.skipped.push(cac.id);
   else result.failed.push({id:cac.id,name:cac.name,error:error.message});
  }
 }
 return result;
}
