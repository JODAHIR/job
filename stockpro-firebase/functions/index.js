'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const D=require('./domain');
initializeApp();const fs=getFirestore();
const collections=[...D.arrays,'payments','cash','cashMoves','cashClosings'];
const timestamp=()=>FieldValue.serverTimestamp();
function signed(req){if(!req.auth)throw new HttpsError('unauthenticated','Iniciá sesión.');return req.auth.uid}
function safe(handler){return onCall({region:'us-central1',maxInstances:10,timeoutSeconds:60},async req=>{try{return await handler(req)}catch(e){if(e instanceof HttpsError)throw e;if(['invalid-argument','permission-denied','not-found','failed-precondition','aborted','resource-exhausted'].includes(e.code))throw new HttpsError(e.code,e.message);console.error('StockPro operation failed',e.code||e.message);throw new HttpsError('internal','No se pudo completar la operación. Reintentá sin borrar la copia local.')}})}
async function identity(tx,uid){const [cfg,member]=await Promise.all([tx.get(fs.doc('stockproConfig/main')),tx.get(fs.doc('stockproMembers/'+uid))]);if(!cfg.exists)D.fail('El superusuario debe activar StockPro 8.','failed-precondition');const m=member.data();if(!m?.active||!D.ROLES.includes(m.role))D.fail('Tu cuenta no está habilitada para esta despensa.','permission-denied');return {uid,...m,ownerUid:cfg.data().ownerUid}}
function root(actor){return fs.doc('stockproUsers/'+actor.ownerUid)}
function ownCash(id,actor){return actor.uid===actor.ownerUid?id==='current':id===actor.uid}
function owned(row,actor){return row.operatorUid===actor.uid||!row.operatorUid&&actor.uid===actor.ownerUid}
async function readState(tx,actor){
 const r=root(actor),snapshots=await Promise.all(collections.map(k=>tx.get(r.collection(k)))),meta=await tx.get(r.collection('meta').doc('state'));
 const groups=Object.fromEntries(collections.map((k,i)=>[k,snapshots[i].docs.map(d=>({key:d.id,value:d.data()}))]));
 const s=D.empty();for(const k of D.arrays)s[k]=groups[k].map(x=>x.value);
 s.credits.forEach(c=>{c.payments=groups.payments.map(x=>x.value).filter(p=>p.creditId===c.id).sort((a,b)=>a.position-b.position).map(({creditId,position,...p})=>p)});
 const cash=groups.cash.find(x=>ownCash(x.key,actor));if(cash)s.cash={...cash.value,moves:[],history:[]};
 s.cash.moves=groups.cashMoves.map(x=>x.value).filter(v=>owned(v,actor)).sort((a,b)=>b.id-a.id).map(({position,...v})=>v);
 s.cash.history=groups.cashClosings.map(x=>x.value).filter(v=>owned(v,actor)).sort((a,b)=>b.id-a.id).map(({position,...v})=>v);
 for(const k of ['sales','purchases','moves'])s[k].sort((a,b)=>b.id-a.id);
 return {state:s,revision:meta.exists?meta.data().revision:0,groups};
}
function flatten(s,actor){const map=new Map();for(const k of D.arrays)for(const item of s[k]){const row=D.clone(item);if(k==='credits'){delete row.payments;item.payments.forEach((p,n)=>map.set('payments/'+item.id+'_'+n,{...p,creditId:item.id,position:n}))}map.set(k+'/'+item.id,row)}
 const cash=D.clone(s.cash);delete cash.moves;delete cash.history;map.set('cash/'+(actor.uid===actor.ownerUid?'current':actor.uid),cash);
 for(const [k,arr] of [['cashMoves',s.cash.moves],['cashClosings',s.cash.history]])arr.forEach((row,n)=>map.set(k+'/'+(actor.uid===actor.ownerUid?'':actor.uid+'_')+(row.id??n),{...row,position:n}));return map;
}
function overview(groups,actor){if(actor.role!=='ADMIN')return [];return groups.cash.map(x=>{const owner=x.key==='current'?actor.ownerUid:x.key;const s=D.empty();s.cash={...x.value,moves:groups.cashMoves.map(m=>m.value).filter(v=>v.operatorUid===owner||!v.operatorUid&&owner===actor.ownerUid)};s.sales=groups.sales.map(v=>v.value);return {uid:owner,isOpen:s.cash.isOpen,openedAt:s.cash.openedAt,openingAmount:s.cash.openingAmount,expected:s.cash.isOpen?D.expected(s,owner):0}})}
function response(actor,state,revision,extra={}){return {role:actor.role,ownerUid:actor.ownerUid,revision,data:D.project(state,actor),...extra}}
exports.stockproSnapshot=safe(async req=>{const uid=signed(req);return fs.runTransaction(async tx=>{const actor=await identity(tx,uid),snapshot=await readState(tx,actor);return response(actor,snapshot.state,snapshot.revision,{cashOverview:overview(snapshot.groups,actor)})})});
exports.stockproOperate=safe(async req=>{
 const uid=signed(req),{action,payload,opid,revision}=req.data||{};
 if(typeof opid!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(opid)||!Number.isInteger(revision)||revision<0||!payload||JSON.stringify(payload).length>4e6)D.fail('Petición inválida.');
 return fs.runTransaction(async tx=>{
 const actor=await identity(tx,uid);D.authorize(actor.role,action);
 const r=root(actor),operationRef=r.collection('operations').doc(uid+'_'+opid),existing=await tx.get(operationRef),snapshot=await readState(tx,actor);
 if(existing.exists)return response(actor,snapshot.state,snapshot.revision,{opRevision:existing.data().revision});
 if(revision!==snapshot.revision)D.fail('CONFLICT','aborted');
 const next=D.apply(snapshot.state,action,payload,actor,{opid,now:new Date().toISOString()}),before=flatten(snapshot.state,actor),after=flatten(next,actor),changes=[];
 for(const [key,value] of after)if(JSON.stringify(value)!==JSON.stringify(before.get(key)))changes.push([key,value]);for(const key of before.keys())if(!after.has(key))changes.push([key,null]);
 if(changes.length>450)D.fail('La operación supera 450 documentos. Reducí el lote.','resource-exhausted');
 for(const [key,value] of changes){const target=r.collection(key.split('/')[0]).doc(key.split('/')[1]);if(value===null)tx.delete(target);else tx.set(target,value)}
 const nextRevision=snapshot.revision+1;
 tx.set(r.collection('meta').doc('state'),{schema:8,revision:nextRevision,txid:opid,updatedAt:timestamp()});
 tx.create(operationRef,{actorUid:uid,role:actor.role,action,revision:nextRevision,createdAt:timestamp()});
 return response(actor,next,nextRevision,{opRevision:nextRevision});
 });
});
exports.stockproUsers=safe(async req=>{
 const uid=signed(req),p=req.data||{};
 if(p.action==='list')return fs.runTransaction(async tx=>{const actor=await identity(tx,uid);if(!['ADMIN','ENCARGADO'].includes(actor.role))D.fail('Acceso denegado.','permission-denied');const all=await tx.get(fs.collection('stockproMembers'));return {users:all.docs.map(d=>({uid:d.id,...d.data()})).filter(m=>actor.role==='ADMIN'||m.role!=='ADMIN').map(({uid,email,name,role,active})=>({uid,email,name,role,active}))}});
 const name=D.str(p.name,200,true),role=D.str(p.role,20,true);if(typeof p.active!=='boolean')D.fail('Estado inválido.');
 // Check permission before any Auth side effect. Check again transactionally below.
 const actor=await fs.runTransaction(tx=>identity(tx,uid));
 if(!['ADMIN','ENCARGADO'].includes(actor.role)||actor.role==='ENCARGADO'&&role==='ADMIN')D.fail('Acceso denegado.','permission-denied');
 let targetUid=p.uid;
 if(p.action==='create'){
 const email=D.str(p.email,254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))D.fail('Correo inválido.');
 let user;try{user=await getAuth().getUserByEmail(email)}catch(e){if(e.code!=='auth/user-not-found')throw e;try{user=await getAuth().createUser({email,displayName:name})}catch(e){if(e.code!=='auth/email-already-exists')throw e;user=await getAuth().getUserByEmail(email)}}targetUid=user.uid;
 }else if(p.action!=='update')D.fail('Acción inválida.');
 if(typeof targetUid!=='string'||!/^[-_a-zA-Z0-9]{1,128}$/.test(targetUid))D.fail('Usuario inválido.');
 const user=await getAuth().getUser(targetUid);
 await fs.runTransaction(async tx=>{const fresh=await identity(tx,uid),ref=fs.doc('stockproMembers/'+targetUid),old=await tx.get(ref);D.manageAllowed(fresh,old.data(),role,targetUid,fresh.ownerUid);
 if(p.action==='create'&&old.exists)D.fail('El usuario ya tiene acceso. Editalo desde la lista.');
 if(p.action==='update'&&!old.exists)D.fail('Usuario no encontrado.','not-found');
 tx.set(ref,{name,email:user.email||'',role,active:p.active,updatedBy:uid,updatedAt:timestamp()});
 tx.create(root(fresh).collection('accessAudit').doc(),{actorUid:uid,targetUid,action:p.action,previous:old.exists?{role:old.data().role,active:old.data().active}:null,next:{role,active:p.active},createdAt:timestamp()});
 });
 return {uid:targetUid};
});
