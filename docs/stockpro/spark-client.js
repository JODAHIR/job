/* Spark adapter. Authenticated SDK requests are enforced by firestore.rules.
   No callable endpoints, private keys, or paid backend required. */
const sparkRoot=()=>cloud.doc('stockproStores/despensa');
const sparkEmail=()=>auth.currentUser.email.toLowerCase();
const sparkAccess=()=>cloud.doc('stockproAccess/'+sparkEmail());
function sparkError(message,code='PERMISSION_DENIED'){const e=Error(message);e.code=code;return e}
async function sparkActor(){
 const user=auth.currentUser;if(!user)throw sparkError('Iniciá sesión.');
 if(!user.emailVerified)throw sparkError('Verificá tu correo con el enlace recibido y volvé a iniciar sesión.','EMAIL_NOT_VERIFIED');
 const [doc,policy]=await Promise.all([sparkAccess().get({source:'server'}),Promise.all([cloud.doc('stockproConfig/main').get({source:'server'}),cloud.doc('stockproConfig/modules').get({source:'server'})])]),m=doc.data();
 if(!m?.active||!StockDomain.ROLES.includes(m.role))throw sparkError('Tu correo todavía no tiene acceso. Pedí al administrador que lo autorice.');
 const actor={...m,uid:user.uid};if(auth.currentUser?.uid!==user.uid)throw sparkError('La sesión cambió.');applyModulePolicy(policy[1].data()?.enabled||{},actor.role==='ADMIN'&&policy[0].data()?.ownerEmail===sparkEmail());return actor;
}
async function sparkSnapshot(){
 const root=sparkRoot(),meta=root.collection('meta').doc('state');
 const [actor,initial]=await Promise.all([sparkActor(),meta.get({source:'server'})]);
 for(let attempt=0;attempt<3;attempt++){
 const start=attempt===0?initial:await meta.get({source:'server'}),revision=start.exists?start.data().revision:0;
 const data=emptyDB(),keys=actor.role==='ENCARGADO'?['products','suppliers','purchases','moves']:actor.role==='CAJERO'?['products','clients','sales','credits','stamps','payments','cashMoves','cashClosings']:CLOUD_KEYS.filter(k=>k!=='cash');
 const costsTask=actor.role!=='CAJERO'?root.collection('productCosts').get({source:'server'}):Promise.resolve(null);
 const cashTask=actor.role!=='ENCARGADO'?root.collection('cash').doc(actor.uid).get({source:'server'}):Promise.resolve(null);
 const overviewTask=actor.role==='ADMIN'?root.collection('cash').get({source:'server'}):Promise.resolve(null);
 const groups={};const collectionsTask=Promise.all(keys.map(async k=>{let q=root.collection(k);if(actor.role==='CAJERO'&&['sales','cashMoves','cashClosings'].includes(k))q=q.where('operatorUid','==',actor.uid);const s=await q.get({source:'server'});groups[k]=s.docs.map(x=>x.data())}));
 const [costs,cash,all]=await Promise.all([costsTask,cashTask,overviewTask,collectionsTask]);
 for(const k of ENTITY_KEYS)data[k]=groups[k]||[];
 if(actor.role!=='CAJERO'){const byId=Object.fromEntries(costs.docs.map(d=>[d.id,d.data().cost]));data.products.forEach(p=>p.cost=byId[p.id]||0)}else data.products.forEach(p=>p.cost=0);
 data.credits.forEach(c=>c.payments=(groups.payments||[]).filter(p=>p.creditId===c.id).sort((a,b)=>a.position-b.position).map(({creditId,position,...p})=>p));
 let overview=[];
 if(actor.role!=='ENCARGADO'){
 if(cash.exists)data.cash={...cash.data(),moves:[],history:[]};
 data.cash.moves=(groups.cashMoves||[]).filter(m=>m.operatorUid===actor.uid).sort((a,b)=>b.id-a.id);data.cash.history=(groups.cashClosings||[]).filter(m=>m.operatorUid===actor.uid).sort((a,b)=>b.id-a.id);
 if(actor.role==='ADMIN'){overview=all.docs.map(d=>({uid:d.data().operatorEmail||d.id,...d.data(),expected:d.data().expectedBalance||0}))}
 }
 for(const k of ['sales','purchases','moves'])data[k].sort((a,b)=>b.id-a.id);
 const end=await meta.get({source:'server'});if((end.exists?end.data().revision:0)===revision)return {role:actor.role,ownerUid:'despensa',revision,data:validateDB(data),cashOverview:overview};
 }
 throw sparkError('Los datos cambiaron durante la lectura. Reintentá.','UNAVAILABLE');
}
function sparkFlat(data,actor){
 const map=new Map();
 for(const key of ENTITY_KEYS)for(const row of data[key]){const value=clone(row);if(key==='products'){if(actor.role!=='CAJERO')map.set('productCosts/'+row.id,{id:row.id,cost:row.cost});delete value.cost}
 if(key==='credits'){delete value.payments;row.payments.forEach((p,n)=>map.set('payments/'+row.id+'_'+n,{...p,creditId:row.id,position:n}))}
 map.set(key+'/'+row.id,value)}
 if(actor.role!=='ENCARGADO'&&data.cash.operatorUid){const cash=clone(data.cash);delete cash.moves;delete cash.history;map.set('cash/'+actor.uid,cash);for(const [key,rows] of [['cashMoves',data.cash.moves],['cashClosings',data.cash.history]])rows.forEach(m=>map.set(key+'/'+actor.uid+'_'+m.id,m))}
 return map;
}
function withoutOp(x){if(!x)return x;const d=clone(x);delete d._op;return d}
async function sparkOperate(command){
 const actor=await sparkActor(),root=sparkRoot(),meta=root.collection('meta').doc('state'),opRef=root.collection('operations').doc(actor.uid+'_'+command.opid);
 const priorReceipt=await opRef.get({source:'server'});if(priorReceipt.exists){const snap=await sparkSnapshot();return {...snap,opRevision:priorReceipt.data().revision}}
 // Restore was already validated before it entered the durable outbox.
 if(!actionModuleEnabled(command.action,command.payload))throw sparkError('El módulo de esta operación está desactivado. Los pendientes se conservan.','MODULE_DISABLED');
 const source=clone(envelope.base),before=sparkFlat(source,actor),now=new Date().toISOString();
 const state=StockDomain.apply(source,command.action,command.payload,actor,{opid:command.opid,now});
 const createdSale=command.action==='finishSale'&&state.sales.find(v=>!source.sales.some(old=>old.id===v.id));
 const createdCredit=command.action!=='restore'&&state.credits.find(v=>!source.credits.some(old=>old.id===v.id));
 if(createdCredit&&createdSale)createdCredit.saleId=createdSale.id;
 if(createdSale){let runningTotal=0;createdSale.items.forEach(i=>{runningTotal+=i.qty*i.price;i.runningTotal=runningTotal});createdSale.date=today();createdSale.creditId=createdCredit?.id||null;createdSale.items.forEach((item,index)=>{const p=state.products.find(p=>p.id===item.productId);p.lastSaleId=createdSale.id;p.lastSaleIndex=index});if(createdSale.invoice)state.stamps.find(st=>st.id===createdSale.invoice.stampId).lastSaleId=createdSale.id;}
 if(command.action==='restore')for(const v of state.sales){if(source.sales.some(old=>old.id===v.id))continue;let runningTotal=0;v.items.forEach(i=>{runningTotal+=i.qty*i.price;i.runningTotal=runningTotal});v.datetime=v.datetime||v.date+'T00:00:00.000Z';v.operatorUid=v.operatorUid||actor.uid;v.cashSessionId=v.cashSessionId||'legacy:'+v.id;v.creditId=v.creditId||null;}
 for(const c of state.clients)c.balance=state.credits.filter(cr=>cr.clientId===c.id).reduce((n,cr)=>n+cr.balance,0);
 let paymentId=null;if(command.action==='saveCreditPayment'){const cr=state.credits.find(c=>c.id===command.payload.id);paymentId=cr.id+'_'+(cr.payments.length-1);cr.lastPaymentId=paymentId;const move=state.cash.moves.find(m=>!source.cash.moves.some(old=>old.id===m.id));if(move)move.paymentId=paymentId;}
 if(actor.role!=='ENCARGADO'&&(['openCash','closeCash','addCashMove','finishSale','restore'].includes(command.action)||command.action==='saveCreditPayment'&&command.payload.method==='Efectivo')){state.cash.sessionId=state.cash.sessionId||null;state.cash.operatorUid=actor.uid;state.cash.operatorEmail=sparkEmail();state.cash.expectedBalance=state.cash.isOpen?StockDomain.expected(state,actor.uid):0;}
 const after=sparkFlat(state,actor),changed=[];if(createdSale){for(let start=0;start<createdSale.items.length;start+=5)after.set('saleChecks/'+createdSale.id+'_'+start,{saleId:createdSale.id,start,operatorUid:actor.uid})}
 for(const [key,value] of after)if(JSON.stringify(withoutOp(value))!==JSON.stringify(withoutOp(before.get(key)))||key==='cash/'+actor.uid&&(['openCash','closeCash','addCashMove','finishSale'].includes(command.action)||command.action==='saveCreditPayment'&&command.payload.method==='Efectivo'))changed.push([key,{...value,_op:command.opid}]);for(const key of before.keys())if(!after.has(key))changed.push([key,null]);
 if(changed.length>400)throw Error('El lote supera 400 documentos. Conservá el backup y dividí la importación.');
 const newCashMove=state.cash.moves.find(m=>!source.cash.moves.some(o=>o.id===m.id)),newClosing=state.cash.history.find(m=>!source.cash.history.some(o=>o.id===m.id));
 const context={role:actor.role,cashMoveId:newCashMove?actor.uid+'_'+newCashMove.id:'',closingId:newClosing?actor.uid+'_'+newClosing.id:'',action:command.action,opid:command.opid,actorUid:actor.uid,saleId:createdSale?.id||0,creditId:createdCredit?.id||command.payload.id||0,paymentId:paymentId||'',updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
 const result=await cloud.runTransaction(async tx=>{
 const op=await tx.get(opRef),current=await tx.get(meta);const revision=current.exists?current.data().revision:0;
 if(op.exists)return {revision,opRevision:op.data().revision,duplicate:true};
 if(revision!==command.revision)throw Error('CONFLICT');
 for(const [key,value] of changed){if(value===null)tx.delete(root.collection(key.split('/')[0]).doc(key.split('/')[1]));else tx.set(root.collection(key.split('/')[0]).doc(key.split('/')[1]),value)}
 tx.set(meta,{...context,revision:revision+1,schema:9});tx.set(opRef,{...context,revision:revision+1});
 return {revision:revision+1,opRevision:revision+1};
 });
 if(result.duplicate){const snap=await sparkSnapshot();return {...snap,opRevision:result.opRevision}}
 return {role:actor.role,ownerUid:'despensa',data:state,...result};
}
async function sparkUsers(p){
 const actor=await sparkActor();if(!moduleEnabled('usuarios'))throw Error('El módulo de usuarios está desactivado.');if(!['ADMIN','ENCARGADO'].includes(actor.role))throw sparkError('No podés gestionar usuarios.');
 if(p.action==='list'){let q=cloud.collection('stockproAccess');if(actor.role==='ENCARGADO')q=q.where('role','in',['CAJERO','ENCARGADO']);const snap=await q.get({source:'server'});return {users:snap.docs.map(d=>({uid:d.id,...d.data()}))}}
 const email=(p.uid||p.email||'').trim().toLowerCase();if(!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email))throw Error('Correo inválido.');
 const ref=cloud.doc('stockproAccess/'+email),old=await ref.get({source:'server'});
 if(p.action==='create'&&old.exists)throw Error('El correo ya está autorizado. Editalo desde la lista.');
 if(p.action==='update'&&!old.exists)throw Error('Acceso no encontrado.');
 await ref.set({email,name:StockDomain.str(p.name,200,true),role:p.role,active:p.active,updatedBy:actor.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});return {uid:email};
}
callRoles=async function(name,data={}){try{if(name==='stockproSnapshot')return await sparkSnapshot();if(name==='stockproOperate')return await sparkOperate(data);if(name==='stockproUsers')return await sparkUsers(data);throw Error('Operación desconocida.')}catch(e){if(e.code==='permission-denied')e.code='PERMISSION_DENIED';throw e}};
startCloud=async function(){
 try{firebase.initializeApp(firebaseConfig);auth=firebase.auth();auth.languageCode='es';cloud=firebase.firestore();
 if(window.STOCKPRO_EMULATOR==='localhost'&&['localhost','127.0.0.1'].includes(location.hostname)){auth.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});cloud.useEmulator('127.0.0.1',8088)}
 auth.onAuthStateChanged(async user=>{const generation=++authGeneration;if(stopWatch)stopWatch();if(stopModules)stopModules();stopLiveUpdates();applyModulePolicy({},false);syncing=false;reading=false;conflict=false;roleBlocked=false;serverVerified=false;activeOwner=user?user.uid:'local';db=load();cart=[];effectiveRole=user?(envelope.role||'BLOCKED'):'LOCAL';renderAll();
 if(!user){setSync('local','Modo local. Iniciá sesión para usar la despensa compartida.');return}
 if(!user.emailVerified){effectiveRole='BLOCKED';db=emptyDB();renderAll();setSync('error','Verificá tu correo y volvé a iniciar sesión. Si necesitás otro enlace, cerrá sesión y pulsá Crear mi cuenta con tu correo y contraseña.');return}
 startLiveUpdates(generation);await retrySync();if(generation!==authGeneration)return;
 stopModules=cloud.doc('stockproConfig/modules').onSnapshot(snap=>{if(generation!==authGeneration||snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;applyModulePolicy(snap.data()?.enabled||{},isSuperAdmin);renderAll()},cloudFailure);
 stopWatch=sparkAccess().onSnapshot(snap=>{if(generation!==authGeneration)return;if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;const m=snap.data();if(!m?.active||m.role!==effectiveRole){roleBlocked=true;effectiveRole='BLOCKED';db=emptyDB();cart=[];renderAll();setSync('error','Tu acceso cambió. Volvé a iniciar sesión. Los pendientes están conservados.')}},cloudFailure);
 },cloudFailure);
 }catch(e){cloudFailure(e)}
};
async function registerOwnAccount(){
 const email=loginEmail.value.trim().toLowerCase(),password=loginPassword.value;if(!email||password.length<8)return toast('Ingresá tu correo y una contraseña de al menos 8 caracteres.');
 try{auth.languageCode='es';let credential;try{credential=await auth.createUserWithEmailAndPassword(email,password)}catch(e){if(e.code!=='auth/email-already-in-use')throw e;credential=await auth.signInWithEmailAndPassword(email,password)}
 if(!credential.user.emailVerified){await credential.user.sendEmailVerification();toast('Revisá tu correo (también spam), abrí el enlace de verificación y luego iniciá sesión.');await auth.signOut()}else toast('Cuenta verificada. Iniciando sesión…');
 }catch(e){toast(e.code==='auth/weak-password'?'La contraseña no cumple los requisitos de seguridad. Usá una contraseña más larga.':e.code==='auth/invalid-email'?'El correo electrónico no es válido.':friendlyLoginError(e))}
}
const sparkCanMutate=canMutate;canMutate=function(){if(activeOwner!=='local'&&envelope.queue?.some(c=>(['saveProduct','saveClient','saveSupplier','saveCredit','restore'].includes(c.action)||c.action==='finishSale'&&c.payload.pay==='Crédito'))){toast('Sincronizá el alta pendiente antes de usar ese registro.');return false}return sparkCanMutate()};
const sparkFinishSale=finishSale;finishSale=function(...args){if(activeOwner!=='local'&&cart.length>10)return toast('Máximo 10 productos distintos por venta en esta versión del plan gratuito. Dividí el carrito en dos ventas.');return sparkFinishSale(...args)};
saveUser=async function(){const button=document.getElementById('saveUserButton');button.disabled=true;try{await sparkUsers({action:userUid.value?'update':'create',uid:userUid.value||null,name:userName.value.trim(),email:userEmail.value.trim(),role:userRole.value,active:userActive.checked});modal('userModal').hide();await loadUsers();toast('Correo autorizado. La persona debe crear su cuenta y verificar su correo para ingresar.')}catch(e){toast(e.message)}finally{button.disabled=false}};
