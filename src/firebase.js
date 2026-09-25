import {normalizeEmail,validateEmail} from './access.js';
import {relatedProcedures} from './procedure-search.js';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'firebase/auth';
import {getFirestore,doc,setDoc,getDocFromServer,serverTimestamp,runTransaction} from 'firebase/firestore';
import {execute,field} from 'firebase/firestore/pipelines';
const app=initializeApp({apiKey:'AIzaSyDK180C54PlNX-Ye6E4_PKSeEmrnIhWZcg',authDomain:'asistente-operativo-9ee58.firebaseapp.com',projectId:'asistente-operativo-9ee58',storageBucket:'asistente-operativo-9ee58.firebasestorage.app',messagingSenderId:'4247507337',appId:'1:4247507337:web:ec1f7d5bb91f8bbf2ed158'});
export const auth=getAuth(app),db=getFirestore(app,'conocimientos');
export const login=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth);
export const watchAuth=fn=>onAuthStateChanged(auth,fn);
export const isOwner=u=>!!u&&u.emailVerified&&u.email==='javier.odahir@gmail.com';
export function words(s){return [...new Set(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[])].filter(w=>w.length>2&&!['para','como','que','los','las','del','una','con','por','sobre','cual','debo','puedo','tengo','quiero','hacer','cliente','clientes'].includes(w)).slice(0,100)}
export async function listProcedures(){const result=await execute(db.pipeline().collection('procedimientos').sort(field('title').ascending()).limit(100));return result.results.map(d=>({id:d.id,...d.data()}))}
export async function searchProcedures(question){const tokens=words(question);if(!tokens.length)return [];const result=await execute(db.pipeline().collection('procedimientos').where(field('published').equal(true)).sort(field('title').ascending()).limit(100));return relatedProcedures(result.results.map(d=>({id:d.id,...d.data()})),tokens,question)}
export async function saveProcedure(id,data,expectedUpdatedAt){
 const user=auth.currentUser;
 if(!isOwner(user))throw new Error('Acceso no autorizado.');
 if(!data.title.trim()||!data.steps.trim())throw new Error('Completá el título y los pasos.');
 const procedureId=id||crypto.randomUUID(),revisionId=crypto.randomUUID();
 const ref=doc(db,'procedimientos',procedureId),history=doc(db,'procedure_history',revisionId);
 await runTransaction(db,async transaction=>{
  const snapshot=await transaction.get(ref);
  if(id&&(!snapshot.exists()||!expectedUpdatedAt?.isEqual(snapshot.data().updatedAt)))throw new Error('Este procedimiento cambió desde que lo abriste. Volvé a seleccionarlo antes de guardar.');
  const after={...data,keywords:words(data.title+' '+data.questions),updatedAt:serverTimestamp(),revisionId};
  transaction.set(ref,after);
  transaction.set(history,{procedureId,before:snapshot.exists()?snapshot.data():null,after,changedAt:serverTimestamp(),changedBy:user.uid,changedEmail:user.email});
 });
 return procedureId;
}
export async function listHistory(procedureId){
 const result=await execute(db.pipeline().collection('procedure_history').where(field('procedureId').equal(procedureId)).sort(field('changedAt').descending()));
 return result.results.map(d=>({id:d.id,...d.data()}));
}
export function errorMessage(e){if(e.code==='auth/popup-closed-by-user')return 'Se cerró el inicio de sesión. Podés volver a intentarlo.';if(e.code==='permission-denied')return 'Tu cuenta no tiene acceso o las reglas de Firebase aún no están habilitadas.';if(e.code==='auth/unauthorized-domain')return 'Falta autorizar el dominio de esta página en Firebase.';return 'No se pudo completar la operación. Revisá la conexión y volvé a intentarlo.'}

export async function accessFor(user){
  if(isOwner(user))return 'admin';
  if(!user?.emailVerified||!user.email)return 'denied';
  const snapshot=await getDocFromServer(doc(db,'authorized_users',normalizeEmail(user.email)));
  return snapshot.exists()&&snapshot.data().active===true?'reader':'denied';
}
export async function listUsers(){
  const result=await execute(db.pipeline().collection('authorized_users').sort(field('email').ascending()));
  return result.results.map(d=>({id:d.id,...d.data()}));
}
export async function setUserAccess(email,active){
  if(!isOwner(auth.currentUser))throw new Error('Solo el administrador puede autorizar personas.');
  email=validateEmail(email);
  await setDoc(doc(db,'authorized_users',email),{email,active,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
}
