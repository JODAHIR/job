import {generateRemisiones} from './spark-remisiones.js';
import {doc,collection,getDocFromServer,getDocsFromServer,runTransaction,serverTimestamp,query,orderBy,startAfter,limit} from 'firebase/firestore';
import {sparkWriter} from './spark-records.js';
import {publishSparkCalendar} from './spark-calendar.js';
import {makeReport} from '../docs/dpo/cdq-v3/src/reports.js';
export function sparkAPI(api) {
 const {store,auth}=api, save=sparkWriter(store,auth);
 const requestAccess=()=>runTransaction(store,async tx=>{
  const u=auth.currentUser;
  if(!u?.emailVerified) throw Error('Inicie sesión con correo verificado.');
  const ref=doc(store,'accessRequests',u.uid), old=await tx.get(ref);
  if(!old.exists()) tx.set(ref,{id:u.uid,email:u.email,at:serverTimestamp()});
 });
 api.requestAccess=requestAccess;
 api.spark=true;
 return async(name,input)=>{
  if(name==='publishCalendar') return publishSparkCalendar(store,auth,input);
  if(name==='generateRemisiones') return generateRemisiones(store,auth,input);
  if(name==='saveRecord') return save(input);
  if(name==='setCacActive') {
   const snap=await getDocFromServer(doc(store,`gerencias/${input.gerenciaId}/cacs/${input.id}`));
   if(!snap.exists() || typeof input.active!=='boolean' || !input.reason?.trim())throw Error('CAC, estado y motivo obligatorios.');
   const c=snap.data();
   return save({gerenciaId:input.gerenciaId,collection:'cacs',row:{id:c.id,name:c.name,gerenciaId:c.gerenciaId,active:input.active},expectedRevision:input.expectedRevision,reason:input.reason});
  }
  if(name==='createGerencia') return save({gerenciaId:input.id,collection:'gerencias',row:{id:input.id,name:input.name,responsables:input.responsables}});
  if(name==='report') return makeReport(await api.load(),input.filters,{...input.options,source:'Firestore · datos autorizados'});
  if(name==='provisionUser'||name==='assignAssistant') return runTransaction(store,async tx=>{
   if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.uid)||!input.reason?.trim()) throw Error('Usuario y motivo obligatorios.');
   const ref=doc(store,'users',input.uid), snap=await tx.get(ref), before=snap.exists()?snap.data():null;
   if((before?.revision??0)!==input.expectedRevision) throw Error('El perfil cambió; actualice.');
   let after;
   if(name==='assignAssistant') {
    if(before?.role!=='asistente') throw Error('Seleccione un asistente.');
    after={...before,gerencias:[...new Set(input.gerencias)],revision:before.revision+1};
   } else {
    const req=await tx.get(doc(store,'accessRequests',input.uid));
    if(!req.exists()) throw Error('El usuario debe ingresar con Google y solicitar acceso primero.');
    after={id:input.uid,role:input.role,secondaryRole:input.role==='technical'?(input.secondaryRole||null):null,active:input.active,gerenciaId:input.role==='gerente'?input.gerenciaId:null,
      gerencias:input.role==='asistente'&&before?.role==='asistente'?before.gerencias:[],revision:(before?.revision??0)+1};
   }
   tx.set(ref,after);
   const kind=name==='assignAssistant'?'assignments':'profiles', id=`${input.uid}_${after.revision}`;
   tx.set(doc(store,`administration/${kind}/audit/${id}`),{id,actor:auth.currentUser.uid,collection:'users',recordId:input.uid,at:serverTimestamp(),before,after,reason:input.reason.trim()});
   return after;
  });
  if(name==='queryAudit') {
   const scope=input.gerenciaId ? 'g:'+input.gerenciaId : 'a:'+input.kind;
   if(typeof scope!=='string'||!scope.match(/^[ga]:[A-Za-z0-9_-]{1,128}$/)) throw Error('Ámbito inválido.');
   const path=scope.startsWith('g:')?`gerencias/${scope.slice(2)}/audit`:`administration/${scope.slice(2)}/audit`;
   const constraints=[orderBy('at'),orderBy('__name__')];
   if(input.cursor){const s=await getDocFromServer(doc(store,path,input.cursor));if(!s.exists())throw Error('Cursor inválido.');constraints.push(startAfter(s));}
   constraints.push(limit(50));
   const s=await getDocsFromServer(query(collection(store,path),...constraints));
   const rows=s.docs.map(d=>({...d.data(),id:d.id,at:d.data().at.toDate?.().toISOString()??d.data().at})).filter(r=>r.at>=input.from&&r.at.slice(0,10)<=input.to);
   return {rows,cursor:s.size===50?s.docs.at(-1).id:null};
  }
  throw Error('Esta operación todavía requiere el adaptador de Cloud Functions. En Spark no se ha registrado ningún cambio.');
 };
}
