'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {randomUUID}=require('node:crypto');
initializeApp();
const db=getFirestore(), bucket=getStorage().bucket();
const fail=(message,code='invalid-argument')=>{throw new HttpsError(code,message);};
const str=(v,max=200)=>{if(typeof v!=='string'||v.length>max) fail('Texto no válido o demasiado largo.');return v;};
const id=v=>{if(typeof v!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(v)) fail('Identificador no válido.');return v;};
const coord=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000) fail('Posición no válida.');return v;};
const colors=['note-yellow','note-blue','note-green','note-pink','note-white'];
const itemRef=(u,i)=>db.doc(`boards/${u}/items/${i}`);
const uploadRef=(u,i,f)=>itemRef(u,i).collection('uploads').doc(f);
const isAdmin=p=>p?.role==='admin'&&p?.status==='authorized';
const audit=(tx,actor,ownerUid,action,target,extra={})=>tx.create(db.collection('audit').doc(),{actorUid:actor,ownerUid,action,target,at:Timestamp.now(),...extra});

exports.boardAction=onCall({region:'us-central1',maxInstances:10,timeoutSeconds:120},async req=>{
 if(!req.auth) fail('Iniciá sesión.','unauthenticated');
 const actor=req.auth.uid, d=req.data||{}, action=d.action;
 const me=db.doc(`users/${actor}`);
 if(action==='ensureProfile'){
  await db.runTransaction(async tx=>{const s=await tx.get(me);if(!s.exists){tx.create(me,{ownerUid:actor,email:req.auth.token.email||'',role:'user',status:'pending',createdAt:Timestamp.now(),updatedAt:Timestamp.now()});audit(tx,actor,actor,'register',actor);}});
  return {ok:true};
 }
 // Purging has a durable lock. A failed Storage deletion can be retried safely.
 if(action==='purge'){
  const owner=id(d.ownerUid), iid=id(d.id), ref=itemRef(owner,iid);
  await db.runTransaction(async tx=>{
   const [p,s]=await Promise.all([tx.get(me),tx.get(ref)]);
   if(!isAdmin(p.data())) fail('Solo administrador autorizado.','permission-denied');
   if(!s.exists) fail('Elemento inexistente.','not-found');
   if(!['deleted','purging'].includes(s.data().state)) fail('Primero enviá el elemento a la papelera.');
   tx.update(ref,{state:'purging',updatedAt:Timestamp.now(),updatedBy:actor});audit(tx,actor,owner,'purge-start',iid);
  });
  const lockedUploads=await ref.collection('uploads').get();
  for(const u of lockedUploads.docs) await u.ref.update({state:'purging'});
  await bucket.deleteFiles({prefix:`boards/${owner}/${iid}/`,force:true});
  // Upload rules deny new objects while purging; recursive deletion is retryable.
  const uploads=await ref.collection('uploads').get();
  for(const s of uploads.docs) await s.ref.delete();
  await db.runTransaction(async tx=>{const s=await tx.get(ref);if(s.exists){tx.delete(ref);audit(tx,actor,owner,'purge-complete',iid,{title:s.data().title});}});
  return {ok:true};
 }
 if(action==='purgeUpload'){
  const owner=id(d.ownerUid), iid=id(d.id), fid=id(d.fileId), ref=uploadRef(owner,iid,fid);
  let path;
  await db.runTransaction(async tx=>{
   const [p,s,parent]=await Promise.all([tx.get(me),tx.get(ref),tx.get(itemRef(owner,iid))]);
   if(!isAdmin(p.data())) fail('Solo administrador autorizado.','permission-denied');
   if(!s.exists||!parent.exists) fail('Archivo inexistente.','not-found');
   if(parent.data().file?.id===fid||parent.data().attachment?.id===fid) fail('Primero quitá o reemplazá el adjunto.');
   if(!['trash','pending','purging'].includes(s.data().state)) fail('Estado no válido.');
   path=s.data().path;tx.update(ref,{state:'purging',deletedBy:actor,deletedAt:Timestamp.now()});audit(tx,actor,owner,'purge-file-start',iid,{fileId:fid});
  });
  await bucket.file(path).delete({ignoreNotFound:true});
  await db.runTransaction(async tx=>{tx.delete(ref);audit(tx,actor,owner,'purge-file-complete',iid,{fileId:fid});});
  return {ok:true};
 }
 // Verify actual object before attaching. The reservation is read again in the transaction.
 let verified=null;
 if(action==='attach'||action==='restoreUpload'){
  const owner=id(d.ownerUid), iid=id(d.id), fid=id(d.fileId);
  const p=(await me.get()).data();
  if(!p||p.status!=='authorized'||(!isAdmin(p)&&owner!==actor))fail('Sin permiso.','permission-denied');
  const u=(await uploadRef(owner,iid,fid).get()).data();if(!u)fail('Reserva inexistente.');
  try{const [m]=await bucket.file(u.path).getMetadata();verified={size:Number(m.size),type:m.contentType||'application/octet-stream'};}catch{fail('La carga no está completa.');}
  if(verified.size!==u.size)fail('El tamaño del archivo no coincide.');
 }
 return db.runTransaction(async tx=>{
  const profile=(await tx.get(me)).data();
  if(!profile||profile.status!=='authorized')fail('Tu cuenta no está autorizada.','permission-denied');
  const admin=isAdmin(profile);
  if(action==='setStatus'){
   if(!admin)fail('Solo administrador.','permission-denied');
   const target=id(d.uid), status=d.status;if(!['pending','authorized','blocked'].includes(status))fail('Estado no válido.');
   const ref=db.doc(`users/${target}`), p=await tx.get(ref);if(!p.exists)fail('Usuario inexistente.');
   if(p.data().role==='admin')fail('Las cuentas admin se administran desde Console para evitar bloqueos accidentales.');
   tx.update(ref,{status,updatedBy:actor,updatedAt:Timestamp.now()});audit(tx,actor,target,'user-'+status,target);return {ok:true};
  }
  const owner=id(d.ownerUid);if(!admin&&owner!==actor)fail('Esta pizarra no te pertenece.','permission-denied');
  const iid=id(d.id), ref=itemRef(owner,iid), s=await tx.get(ref), item=s.data(), now=Timestamp.now();
  if(action==='create'){
   if(s.exists)return {id:iid,exists:true}; // stable IDs make migration retryable
   const p=d.item||{}, type=p.type;if(!['note','image','file'].includes(type))fail('Tipo no válido.');
   const title=str(p.title||'Nota',240), text=str(p.text||'',60000), color=colors.includes(p.color)?p.color:'note-yellow';
   const comments=(p.comments||[]);if(!Array.isArray(comments)||comments.length>200)fail('Máximo 200 comentarios por nota.');
   const cleanComments=comments.map(c=>({id:randomUUID(),text:str(c.text,2000),createdAt:now.toDate().toISOString(),authorUid:actor,legacyDateLabel:str(c.dateLabel||c.createdAt||'',100)}));
   tx.create(ref,{ownerUid:owner,type,title,text,color,x:coord(p.x||0),y:coord(p.y||0),comments:cleanComments,file:null,attachment:null,state:'active',legacyCreatedAt:str(p.legacyCreatedAt||'',100),legacyUpdatedAt:str(p.legacyUpdatedAt||'',100),createdAt:now,createdBy:actor,updatedAt:now,updatedBy:actor,deletedAt:null,deletedBy:null,restoredAt:null,restoredBy:null,revision:1});
   audit(tx,actor,owner,'create',iid);return {id:iid};
  }
  if(!s.exists)fail('El elemento ya no existe.','not-found');
  if(item.ownerUid!==owner)fail('Propietario incoherente.','permission-denied');
  if(action==='trash'||action==='restore'){
   if(action==='restore'&&!admin)fail('Solo el administrador restaura elementos.','permission-denied');
   if(item.state!==(action==='trash'?'active':'deleted'))fail('El estado del elemento cambió.');
   tx.update(ref,{state:action==='trash'?'deleted':'active',...(action==='trash'?{deletedAt:now,deletedBy:actor}:{restoredAt:now,restoredBy:actor}),updatedAt:now,updatedBy:actor,revision:item.revision+1});audit(tx,actor,owner,action,iid);return {ok:true};
  }
  if(item.state!=='active')fail('El elemento está en la papelera o se está eliminando.');
  let patch={};
  if(action==='move')patch={x:coord(d.x),y:coord(d.y)};
  else if(action==='edit'){
   if(item.type!=='note')fail('Solo se editan notas.');
   if(d.revision!==item.revision)fail('Otra sesión cambió esta nota. Volvé a abrirla.','aborted');
   if(!colors.includes(d.color))fail('Color no válido.');
   patch={title:str(d.title||'Nota',240),text:str(d.text,60000),color:d.color};
  }else if(action==='comment'){
   if(item.type!=='note'||item.comments.length>=200)fail('Máximo 200 comentarios por nota.');
   const text=str(d.text,2000).trim();if(!text)fail('Comentario vacío.');
   patch={comments:[...item.comments,{id:randomUUID(),text,createdAt:now.toDate().toISOString(),authorUid:actor}]};
  }else if(action==='reserveUpload'){
   const fid=randomUUID(),name=str(d.name,240),type=str(d.type||'application/octet-stream',120),size=d.size;
   if(!Number.isInteger(size)||size<0||size>25*1024*1024)fail('Máximo 25 MB por archivo.');
   const path=`boards/${owner}/${iid}/${fid}`;
   tx.create(uploadRef(owner,iid,fid),{ownerUid:owner,itemId:iid,id:fid,name,type,size,path,state:'pending',createdAt:now,createdBy:actor});
   audit(tx,actor,owner,'reserve-upload',iid,{fileId:fid});return {id:fid,path,name,type,size};
  }else if(['attach','restoreUpload','removeAttachment'].includes(action)){
   if(action==='restoreUpload'&&!admin)fail('Solo administrador.','permission-denied');
   const slot=item.type==='note'?'attachment':'file';
   if(action==='removeAttachment'&&slot!=='attachment')fail('Solo adjuntos de notas.');
   let next=null, newRef=null;
   if(action!=='removeAttachment'){
    newRef=uploadRef(owner,iid,id(d.fileId));const u=(await tx.get(newRef)).data();
    if(!u||!['pending','trash'].includes(u.state))fail('Archivo no disponible.');
    if(u.size!==verified.size)fail('Archivo inválido.');
    next={id:u.id,path:u.path,name:u.name,size:u.size,type:u.type};
   }
   if(item[slot])tx.update(uploadRef(owner,iid,item[slot].id),{state:'trash',deletedAt:now,deletedBy:actor});
   if(newRef)tx.update(newRef,{state:'active',attachedAt:now,attachedBy:actor});
   patch={[slot]:next};
  }else fail('Operación desconocida.');
  tx.update(ref,{...patch,updatedAt:now,updatedBy:actor,revision:item.revision+1});audit(tx,actor,owner,action,iid);return {ok:true};
 });
});
