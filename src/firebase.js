import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'firebase/auth';
import {getFirestore,doc,setDoc,serverTimestamp} from 'firebase/firestore';
import {execute,field} from 'firebase/firestore/pipelines';
const app=initializeApp({apiKey:'AIzaSyDK180C54PlNX-Ye6E4_PKSeEmrnIhWZcg',authDomain:'asistente-operativo-9ee58.firebaseapp.com',projectId:'asistente-operativo-9ee58',storageBucket:'asistente-operativo-9ee58.firebasestorage.app',messagingSenderId:'4247507337',appId:'1:4247507337:web:ec1f7d5bb91f8bbf2ed158'});
export const auth=getAuth(app),db=getFirestore(app,'conocimientos');
export const login=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth);
export const watchAuth=fn=>onAuthStateChanged(auth,fn);
export const isOwner=u=>!!u&&u.emailVerified&&u.email==='javier.odahir@gmail.com';
export function words(s){return [...new Set(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[])].filter(w=>w.length>2&&!['para','como','que','los','las','del','una','con','por','sobre','cual','debo','puedo','tengo','quiero','hacer','cliente','clientes'].includes(w)).slice(0,100)}
export async function listProcedures(){const result=await execute(db.pipeline().collection('procedimientos').sort(field('title').ascending()).limit(100));return result.results.map(d=>({id:d.id,...d.data()}))}
export async function searchProcedures(question){const tokens=words(question);if(!tokens.length)return [];const result=await execute(db.pipeline().collection('procedimientos').where(field('published').equal(true)).where(field('keywords').arrayContainsAny(tokens)).limit(6));return result.results.map(d=>({id:d.id,...d.data()}))}
export async function saveProcedure(id,data){if(!isOwner(auth.currentUser))throw new Error('Acceso no autorizado.');if(!data.title.trim()||!data.steps.trim())throw new Error('Completá el título y los pasos.');await setDoc(doc(db,'procedimientos',id||crypto.randomUUID()),{...data,keywords:words(data.title+' '+data.questions),updatedAt:serverTimestamp()});}
export function errorMessage(e){if(e.code==='auth/popup-closed-by-user')return 'Se cerró el inicio de sesión. Podés volver a intentarlo.';if(e.code==='permission-denied')return 'Tu cuenta no tiene acceso o las reglas de Firebase aún no están habilitadas.';if(e.code==='auth/unauthorized-domain')return 'Falta autorizar el dominio de esta página en Firebase.';return 'No se pudo completar la operación. Revisá la conexión y volvé a intentarlo.'}
