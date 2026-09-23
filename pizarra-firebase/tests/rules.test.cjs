// Start Firestore:8080 and Storage:9199 emulators with project demo-pizarra.
const fs=require('node:fs');const path=require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,updateDoc,query,where}=require('firebase/firestore');
const {ref,uploadBytes,getBytes,deleteObject}=require('firebase/storage');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-pizarra',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')},storage:{host:'127.0.0.1',port:9199,rules:fs.readFileSync(path.join(__dirname,'../storage.rules'),'utf8')}});
 let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
 try{
  await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{async function clear(r){const list=await r.listAll();await Promise.all(list.items.map(i=>i.delete()));for(const p of list.prefixes)await clear(p);}await clear(c.storage().ref());});
  await env.withSecurityRulesDisabled(async c=>{
   for(const [uid,role,status] of [['alice','user','authorized'],['bob','user','authorized'],['pending','user','pending'],['blocked','user','blocked'],['boss','admin','authorized'],['blockedAdmin','admin','blocked']])await setDoc(doc(c.firestore(),'users',uid),{ownerUid:uid,role,status});
   for(const uid of ['alice','pending','blocked'])await setDoc(doc(c.firestore(),'boards',uid,'items','n1'),{ownerUid:uid,state:'active'});
   await setDoc(doc(c.firestore(),'boards/alice/items/n1/uploads/file1'),{ownerUid:'alice',itemId:'n1',state:'pending',type:'text/plain',size:3});
  });
  const db=u=>env.authenticatedContext(u).firestore(), store=u=>env.authenticatedContext(u).storage();
  await check('unauthenticated read denied',()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'boards/alice/items/n1'))));
  await check('owner read succeeds',()=>assertSucceeds(getDoc(doc(db('alice'),'boards/alice/items/n1'))));
  await check('owner collection query succeeds',()=>assertSucceeds(getDocs(query(collection(db('alice'),'boards/alice/items'),where('ownerUid','==','alice')))));
  await check('cross-owner read denied',()=>assertFails(getDoc(doc(db('bob'),'boards/alice/items/n1'))));
  await check('cross-owner list denied',()=>assertFails(getDocs(collection(db('bob'),'boards/alice/items'))));
  await check('pending own read denied',()=>assertFails(getDoc(doc(db('pending'),'boards/pending/items/n1'))));
  await check('blocked own read denied',()=>assertFails(getDoc(doc(db('blocked'),'boards/blocked/items/n1'))));
  await check('admin board read succeeds',()=>assertSucceeds(getDoc(doc(db('boss'),'boards/alice/items/n1'))));
  await check('blocked admin denied',()=>assertFails(getDoc(doc(db('blockedAdmin'),'boards/alice/items/n1'))));
  await check('admin lists profiles',()=>assertSucceeds(getDocs(collection(db('boss'),'users'))));
  await check('ordinary user cannot list profiles',()=>assertFails(getDocs(collection(db('alice'),'users'))));
  await check('pending can read own status',()=>assertSucceeds(getDoc(doc(db('pending'),'users/pending'))));
  await check('self promotion denied',()=>assertFails(updateDoc(doc(db('alice'),'users/alice'),{role:'admin'})));
  await check('direct note writes denied',()=>assertFails(setDoc(doc(db('alice'),'boards/alice/items/x'),{ownerUid:'alice'})));
  await check('admin cannot bypass audit with direct writes',()=>assertFails(setDoc(doc(db('boss'),'boards/alice/items/x'),{ownerUid:'alice'})));
  const data=new Uint8Array([65,66,67]),meta={contentType:'text/plain',customMetadata:{ownerUid:'alice',itemId:'n1'}};
  await check('cross-owner file upload denied',()=>assertFails(uploadBytes(ref(store('bob'),'boards/alice/n1/file1'),data,meta)));
  await check('forged file owner denied',()=>assertFails(uploadBytes(ref(store('alice'),'boards/alice/n1/file1'),data,{...meta,customMetadata:{ownerUid:'bob',itemId:'n1'}})));
  await check('unreserved upload denied',()=>assertFails(uploadBytes(ref(store('alice'),'boards/alice/n1/unreserved'),data,meta)));
  await check('reserved owner upload succeeds',()=>assertSucceeds(uploadBytes(ref(store('alice'),'boards/alice/n1/file1'),data,meta)));
  await check('overwrite denied',()=>assertFails(uploadBytes(ref(store('alice'),'boards/alice/n1/file1'),data,meta)));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'boards/alice/items/n1/uploads/file1'),{state:'active'}));
  await check('owner file download succeeds',()=>assertSucceeds(getBytes(ref(store('alice'),'boards/alice/n1/file1'))));
  await check('admin file download succeeds',()=>assertSucceeds(getBytes(ref(store('boss'),'boards/alice/n1/file1'))));
  await check('cross-owner download denied',()=>assertFails(getBytes(ref(store('bob'),'boards/alice/n1/file1'))));
  await check('direct permanent deletion denied even for admin',()=>assertFails(deleteObject(ref(store('boss'),'boards/alice/n1/file1'))));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users/alice'),{status:'blocked'}));
  await check('live profile block stops file download',()=>assertFails(getBytes(ref(store('alice'),'boards/alice/n1/file1'))));
  console.log(`${passed} rules checks passed`);
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
