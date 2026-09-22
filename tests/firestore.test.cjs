const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocFromServer,getDocs,collection,query,where,serverTimestamp,deleteDoc,writeBatch}=require('firebase/firestore');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const {execute,field}=require('firebase/firestore/pipelines');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-access',firestore:{host:'127.0.0.1',port:Number(process.env.FIRESTORE_TEST_PORT||8088),rules:fs.readFileSync('firestore.rules','utf8')}});
 const admin=env.authenticatedContext('admin',{email:'javier.odahir@gmail.com',email_verified:true}).firestore();
 const reader=env.authenticatedContext('reader',{email:'Person@example.com',email_verified:true}).firestore();
 const outsider=env.authenticatedContext('outsider',{email:'out@example.com',email_verified:true}).firestore();
 const unverified=env.authenticatedContext('unverified',{email:'person@example.com',email_verified:false}).firestore();
 const anonymous=env.unauthenticatedContext().firestore();
 const member=(active=true)=>({email:'person@example.com',active,updatedAt:serverTimestamp(),updatedBy:'admin'});
 const procedure={title:'Prueba',questions:'prueba',support:'',steps:'Paso de prueba',hours:'',good:'',bad:'',published:true,keywords:['prueba'],updatedAt:serverTimestamp()};
 async function save(id,data,overrides={}){
  const ref=doc(admin,'procedimientos',id),old=await getDocFromServer(ref),revisionId=randomUUID();
  const after={...data,revisionId},history={procedureId:id,before:old.exists()?old.data():null,after,changedAt:serverTimestamp(),changedBy:'admin',changedEmail:'javier.odahir@gmail.com',...overrides};
  const batch=writeBatch(admin);batch.set(ref,after);batch.set(doc(admin,'procedure_history',revisionId),history);await batch.commit();return revisionId;
 }
 let checks=0;async function ok(p){await assertSucceeds(p);checks++}async function no(p){await assertFails(p);checks++}
 try{
 await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'procedimientos/legacy'),procedure));
 await ok(save('legacy',{...procedure,title:'Registro anterior actualizado'}));
 await ok(setDoc(doc(admin,'authorized_users/person@example.com'),member()));
 await ok(save('public',procedure));
 await ok(save('draft',{...procedure,published:false}));
 const revision=await save('public',{...procedure,title:'Título modificado'});
 await ok(getDoc(doc(admin,'procedure_history',revision)));
 await ok(execute(admin._delegate.pipeline().collection('procedure_history').where(field('procedureId').equal('public')).sort(field('changedAt').descending())));
 await no(execute(reader._delegate.pipeline().collection('procedure_history').where(field('procedureId').equal('public'))));
 await no(getDoc(doc(reader,'procedure_history',revision)));
 await no(setDoc(doc(admin,'procedure_history',revision),{changedBy:'other'},{merge:true}));
 await no(deleteDoc(doc(admin,'procedure_history',revision)));
 await no(save('public',procedure,{before:null}));
 await no(save('public',procedure,{changedBy:'other'}));
 await no(setDoc(doc(admin,'procedimientos/public'),{...procedure,revisionId:randomUUID()}));
 await ok(getDoc(doc(reader,'procedimientos/public')));
 await ok(execute(reader._delegate.pipeline().collection('procedimientos').where(field('published').equal(true)).where(field('keywords').arrayContainsAny(['prueba'])).limit(6)));
 await ok(getDocs(query(collection(reader,'procedimientos'),where('published','==',true))));
 await no(getDoc(doc(reader,'procedimientos/draft')));
 await no(getDocs(collection(reader,'procedimientos')));
 await no(execute(reader._delegate.pipeline().collection('procedimientos')));
 await ok(execute(admin._delegate.pipeline().collection('authorized_users').sort(field('email').ascending())));
 for(const db of [anonymous,outsider,unverified])await no(getDoc(doc(db,'procedimientos/public')));
 await ok(getDoc(doc(reader,'authorized_users/person@example.com')));
 await no(getDocs(collection(reader,'authorized_users')));
 await no(getDoc(doc(reader,'authorized_users/out@example.com')));
 await no(setDoc(doc(reader,'authorized_users/person@example.com'),member()));
 await no(setDoc(doc(outsider,'authorized_users/out@example.com'),{...member(),email:'out@example.com'}));
 await no(setDoc(doc(reader,'procedimientos/public'),procedure));
 await no(setDoc(doc(admin,'authorized_users/person@example.com'),{...member(),role:'admin'}));
 await no(setDoc(doc(admin,'authorized_users/person@example.com'),{...member(),active:'true'}));
 await no(setDoc(doc(admin,'authorized_users/person@example.com'),{...member(),email:'other@example.com'}));
 await no(setDoc(doc(admin,'procedimientos/public'),{...procedure,unexpected:true}));
 await no(deleteDoc(doc(admin,'procedimientos/public')));
 await ok(setDoc(doc(admin,'authorized_users/person@example.com'),member(false)));
 await no(getDoc(doc(reader,'procedimientos/public')));
 await ok(setDoc(doc(admin,'authorized_users/person@example.com'),member(true)));
 await ok(getDoc(doc(reader,'procedimientos/public')));
 await ok(getDoc(doc(admin,'procedimientos/draft')));
 console.log(`${checks} comprobaciones de permisos correctas.`);
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
