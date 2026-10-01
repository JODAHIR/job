'use strict';
// Run with Application Default Credentials; no service-account keys in the repository.
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const email=process.argv[2];if(!email||!email.includes('@'))throw Error('Uso: node bootstrap.js correo-del-superusuario');
initializeApp({projectId:'despensa-5dd6d',credential:applicationDefault()});
(async()=>{const user=await getAuth().getUserByEmail(email);const db=getFirestore();await db.runTransaction(async tx=>{const config=db.doc('stockproConfig/main'),profile=db.doc('stockproMembers/'+user.uid),prior=await tx.get(config),member=await tx.get(profile);
if(prior.exists){if(prior.data().ownerUid!==user.uid)throw Error('Ya existe un superusuario distinto. No se cambió nada.');if(member.data()?.role==='ADMIN'&&member.data()?.active){console.log('El superusuario ya está configurado.');return}throw Error('Configuración existente: revisar manualmente.')}
tx.create(config,{ownerUid:user.uid,createdAt:FieldValue.serverTimestamp()});tx.set(profile,{name:user.displayName||'Administrador',email:user.email,role:'ADMIN',active:true,updatedAt:FieldValue.serverTimestamp()});});console.log('Superusuario configurado para el UID existente. Datos anteriores conservados.');})().catch(e=>{console.error(e.message);process.exitCode=1});
