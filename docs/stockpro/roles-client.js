/* StockPro 8: account roles and durable command outbox. This file is embedded
   into index.html by stockpro-firebase/build-client.py for standalone offline use. */
let effectiveRole='LOCAL',commandContext=null,roleBlocked=false;
const ROLE_NAMES={ADMIN:'Administrador · superusuario',CAJERO:'Cajero',ENCARGADO:'Encargado',LOCAL:'Demo local',BLOCKED:'Sin acceso'};
const ROLE_ACTIONS={ADMIN:['saveProduct','deleteProduct','saveStockMove','saveSupplier','deleteSupplier','savePurchase','finishSale','saveClient','deleteClient','saveCredit','saveStamp','deleteStamp','openCash','closeCash','addCashMove','saveCreditPayment','restore'],CAJERO:['finishSale','saveClient','openCash','closeCash','addCashMove','saveCreditPayment'],ENCARGADO:['saveProduct','deleteProduct','saveStockMove','saveSupplier','deleteSupplier','savePurchase']};
const ROLE_PAGES={ADMIN:['dashboard','productos','ventas','clientes','proveedores','compras','creditos','facturacion','caja','movimientos','datos','usuarios'],CAJERO:['ventas','clientes','creditos','caja','datos'],ENCARGADO:['dashboard','productos','proveedores','compras','movimientos','datos','usuarios'],LOCAL:['dashboard','productos','ventas','clientes','proveedores','compras','creditos','facturacion','caja','movimientos','datos'],BLOCKED:['datos']};
function allowed(action){return activeOwner==='local'||!roleBlocked&&ROLE_ACTIONS[effectiveRole]?.includes(action)}
function roleUI(){
 const pages=ROLE_PAGES[effectiveRole]||['datos'];
 document.querySelectorAll('[data-page]').forEach(el=>el.hidden=!pages.includes(el.dataset.page));
 document.querySelectorAll('.page').forEach(el=>{if(!pages.includes(el.id))el.classList.remove('active')});
 if(!document.querySelector('.page.active')){document.getElementById(pages[0]).classList.add('active');document.querySelector('[data-page="'+pages[0]+'"]').classList.add('active')}
 document.getElementById('roleLabel').textContent=ROLE_NAMES[effectiveRole]||'Sin acceso';
 const protectedActions=['openCredit','deleteClient','openStamp','deleteStamp','exportBackup','importBackup','migrateV6','resetDemo'];
 document.querySelectorAll('button[onclick]').forEach(el=>{const f=el.getAttribute('onclick').split('(')[0];if(protectedActions.includes(f))el.hidden=activeOwner!=='local'&&(f==='openStamp'||f==='deleteStamp'?!roleHasModule('facturacion'):effectiveRole!=='ADMIN')});
 document.querySelectorAll('label').forEach(el=>{if(el.querySelector('input[type=file]'))el.hidden=activeOwner!=='local'&&effectiveRole!=='ADMIN'});
 document.getElementById('cLimit').disabled=activeOwner!=='local'&&effectiveRole!=='ADMIN';
 document.getElementById('userRole').querySelector('option[value=ADMIN]').hidden=effectiveRole!=='ADMIN';
 if(!accessProfile(effectiveRole).sales){
 document.getElementById('dashKpis').innerHTML='<div class="col-md-6"><div class="card p-3"><span>Stock valorizado</span><div class="kpi">'+money(db.products.reduce((n,p)=>n+p.cost*p.stock,0))+'</div></div></div>';
 document.querySelector('.chart-card').hidden=true;
 }else document.querySelector('.chart-card').hidden=false;
}
const renderedBeforeRoles=renderAll;renderAll=function(){renderedBeforeRoles();roleUI()};
const canMutateBeforeRoles=canMutate;canMutate=function(){if(roleBlocked){toast('Tu acceso cambió. Iniciá sesión nuevamente.');return false}return canMutateBeforeRoles()};
const roleValue=id=>document.getElementById(id).value;
const roleNumber=id=>Number(roleValue(id));
function captureCommand(action,args){
 switch(action){
 case 'saveProduct':return {id:roleNumber('productId'),sku:roleValue('pSku').trim(),name:roleValue('pName').trim(),category:roleValue('pCategory').trim(),cost:roleNumber('pCost'),price:roleNumber('pPrice'),stock:roleNumber('pStock'),min:roleNumber('pMin'),avg:roleNumber('pAvg'),vat:roleNumber('pVat')};
 case 'deleteProduct':case 'deleteClient':case 'deleteSupplier':case 'deleteStamp':return {id:args[0]};
 case 'saveStockMove':return {id:roleNumber('stockProductId'),type:roleValue('stockType'),qty:roleNumber('stockQty'),detail:roleValue('stockDetail')};
 case 'saveClient':return {id:roleNumber('clientId'),name:roleValue('cName'),doc:roleValue('cDoc'),phone:roleValue('cPhone'),address:roleValue('cAddress'),limit:roleNumber('cLimit')};
 case 'saveSupplier':return {id:roleNumber('supplierId'),name:roleValue('sName'),ruc:roleValue('sRuc'),phone:roleValue('sPhone'),contact:roleValue('sContact')};
 case 'savePurchase':return {date:roleValue('buyDate'),supplierId:roleNumber('buySupplier'),productId:roleNumber('buyProduct'),qty:roleNumber('buyQty'),cost:roleNumber('buyCost'),invoice:roleValue('buyInvoice')};
 case 'finishSale':return {items:clone(cart),clientId:roleNumber('saleClient')||null,pay:roleValue('salePay'),dueDate:roleValue('saleDue'),invoice:saleInvoice.checked?{stampId:roleNumber('invStampSelect'),doc:roleValue('invDoc'),name:roleValue('invName')}:null};
 case 'saveCredit':return {id:roleNumber('creditId'),clientId:roleNumber('crClient'),date:roleValue('crDate'),dueDate:roleValue('crDue'),amount:roleNumber('crAmount'),note:roleValue('crNote')};
 case 'saveCreditPayment':return {id:roleNumber('paymentCreditId'),date:roleValue('payDate'),amount:roleNumber('payAmount'),method:roleValue('payMethod'),detail:roleValue('payDetail')};
 case 'saveStamp':return {id:roleNumber('stampId'),number:roleValue('stNumber'),establishment:pad3(roleValue('stEst')),point:pad3(roleValue('stPoint')),validFrom:roleValue('stFrom'),validTo:roleValue('stTo'),start:roleNumber('stStart'),end:roleNumber('stEnd'),next:roleNumber('stNext'),enabled:roleValue('stEnabled')==='true',note:roleValue('stNote')};
 case 'openCash':return {amount:roleNumber('cashOpening')};
 case 'closeCash':return {declared:roleNumber('cashDeclared')};
 case 'addCashMove':return {type:roleValue('cashMoveType'),amount:roleNumber('cashMoveAmount'),detail:roleValue('cashMoveDetail')};
 }
}
for(const action of ROLE_ACTIONS.ADMIN.filter(x=>x!=='restore')){
 const original=window[action];window[action]=function(...args){
 if(!allowed(action))return toast('Tu rol no permite esta operación.');
 if(action==='finishSale'&&effectiveRole==='CAJERO'&&salePay.value==='Crédito'){
 const customer=db.clients.find(c=>c.id===Number(saleClient.value));if(!customer||debt(customer.id)+taxBreakdown(cart).total>customer.limit)return toast('La venta supera el límite de crédito autorizado.');
 }
 if(action==='saveClient'&&effectiveRole==='CAJERO')cLimit.value=db.clients.find(c=>c.id===Number(clientId.value))?.limit||0;
 const payload=captureCommand(action,args);if(typeof actionModuleEnabled==='function'&&!actionModuleEnabled(action,payload))return toast('Un módulo necesario para esta operación está desactivado.');
 const prior=commandContext;commandContext={action,payload};
 try{return original(...args)}finally{commandContext=prior}
 };
}
const localSave=save;
save=function(){
 if(activeOwner==='local')return localSave();
 const command=commandContext||{action:'restore',payload:{data:clone(db)}};
 if(!allowed(command.action)){db=clone(envelope.data);renderAll();throw Error('Tu rol no permite guardar esta operación.')}
 const prior=clone(envelope.data);
 try{const data=validateDB(db),queue=[...(envelope.queue||[]),{...clone(command),opid:randomId()}];persist({...envelope,schema:8,data,pending:true,queue,txid:null,role:effectiveRole})}
 catch(e){db=prior;renderAll();alert('La operación no pudo guardarse: '+e.message);throw e}
 setSync('pending','Operación guardada localmente; pendiente de validación por el servidor.');queueMicrotask(flushCloud);
};
async function callRoles(name,data={}){
 if(!auth?.currentUser)throw Error('Iniciá sesión.');
 const token=await auth.currentUser.getIdToken(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
 try{const prefix=window.STOCKPRO_EMULATOR==='localhost'&&['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:5008/demo-stockpro/us-central1/':'https://us-central1-despensa-5dd6d.cloudfunctions.net/';
 const response=await fetch(prefix+name,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({data}),signal:controller.signal});const body=await response.json();
 if(body.error){const error=Error(body.error.message);error.code=body.error.status;throw error}if(!response.ok)throw Error('Servidor no disponible.');return body.result;
 }finally{clearTimeout(timeout)}
}
const failureBeforeRoles=cloudFailure;cloudFailure=function(e){if(e.code==='ABORTED'||e.message==='CONFLICT')e=Error('CONFLICT');if(e.code==='PERMISSION_DENIED'){roleBlocked=true;effectiveRole='BLOCKED';db=emptyDB();renderAll()}failureBeforeRoles(e)};
function acceptSnapshot(result){effectiveRole=result.role;roleBlocked=false;serverVerified=true;db=validateDB(result.data);persist({...envelope,schema:8,role:result.role,data:clone(db),base:clone(db),revision:result.revision,pending:false,queue:[],txid:null});renderAll();
 const box=document.getElementById('cashOverview');box.innerHTML=effectiveRole==='ADMIN'?(result.cashOverview||[]).map(t=>'<div class="border-bottom py-2">'+esc(t.uid)+' · '+(t.isOpen?'Abierta':'Cerrada')+' · '+money(t.expected)+'</div>').join(''):'';
}
flushCloud=async function(){
 if(activeOwner==='local'||syncing||reading||conflict||roleBlocked||!auth?.currentUser)return false;
 if(!navigator.onLine){setSync('offline','Sin conexión. Las operaciones pendientes se validarán al reconectar.');return false}
 if(!envelope.pending)return refreshCloud();
 if(!envelope.queue?.length){cloudFailure(Error('La caché antigua debe migrarse con un backup por el administrador.'));return false}
 const generation=authGeneration;syncing=true;setSync('syncing','Validando permisos y operaciones…');
 try{
 while(envelope.queue.length){const command=envelope.queue[0],result=await callRoles('stockproOperate',{...command,revision:envelope.revision});if(generation!==authGeneration)return false;
 const remaining=envelope.queue.slice(1);effectiveRole=result.role;persist({...envelope,base:validateDB(result.data),revision:result.revision,queue:remaining,pending:remaining.length>0,role:result.role});
 if(remaining.length&&result.opRevision!==result.revision)throw Error('CONFLICT');
 if(!remaining.length)acceptSnapshot(result);
 }
 setSync('connected','Operaciones confirmadas por Firebase. '+ROLE_NAMES[effectiveRole]);return true;
 }catch(e){if(generation===authGeneration)cloudFailure(e);return false}finally{if(generation===authGeneration)syncing=false}
};
refreshCloud=async function(){
 if(activeOwner==='local'||syncing||reading||conflict||roleBlocked||!auth?.currentUser)return false;if(envelope.pending)return flushCloud();
 if(!navigator.onLine){setSync('offline','Sin conexión. Usando la caché de esta cuenta.');return false}
 if(cart.length||document.querySelector('.modal.show'))return false;
 const generation=authGeneration;reading=true;
 try{const result=await callRoles('stockproSnapshot');if(generation!==authGeneration)return false;acceptSnapshot(result);setSync('connected','Firebase conectado · '+ROLE_NAMES[effectiveRole]);return true}
 catch(e){if(generation===authGeneration)cloudFailure(e);return false}finally{if(generation===authGeneration)reading=false}
};
startCloud=async function(){
 if(storageBroken){setSync('error',lastCloudError);return}
 try{firebase.initializeApp(firebaseConfig);auth=firebase.auth();cloud=firebase.firestore();
 if(window.STOCKPRO_EMULATOR==='localhost'&&['localhost','127.0.0.1'].includes(location.hostname)){auth.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});cloud.useEmulator('127.0.0.1',8088)}
 auth.onAuthStateChanged(async user=>{
 const generation=++authGeneration;if(stopWatch)stopWatch();syncing=false;reading=false;conflict=false;roleBlocked=false;storageBroken=false;serverVerified=false;activeOwner=user?user.uid:'local';db=load();cart=[];
 effectiveRole=user?(envelope.role||'BLOCKED'):'LOCAL';renderAll();
 if(storageBroken){setSync('error',lastCloudError);return}
 if(!user){setSync('local','Modo demo local. Iniciá sesión con tu cuenta individual para operar la despensa.');return}
 await retrySync();if(generation!==authGeneration)return;
 stopWatch=cloud.doc('stockproMembers/'+user.uid).onSnapshot(snap=>{if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;const member=snap.data();if(!member?.active||member.role!==effectiveRole){roleBlocked=true;effectiveRole='BLOCKED';db=emptyDB();cart=[];renderAll();setSync('error','Tu acceso cambió o está desactivado. Volvé a iniciar sesión. Los pendientes siguen conservados en esta cuenta.')}},cloudFailure);
 },cloudFailure);
 }catch(e){cloudFailure(e)}
};
const backupBeforeRoles=exportBackup;exportBackup=function(){if(activeOwner!=='local'&&effectiveRole!=='ADMIN')return toast('Solo el administrador puede exportar un backup completo.');backupBeforeRoles()};
const importBeforeRoles=importBackup;importBackup=async function(input){if(!allowed('restore'))return toast('Solo el administrador puede restaurar datos.');return importBeforeRoles(input)};
const migrationBeforeRoles=migrateV6;migrateV6=function(){if(!allowed('restore'))return toast('Solo el administrador puede migrar datos.');migrationBeforeRoles()};
function exportPendingCommands(){if(!envelope?.queue?.length)return toast('No hay operaciones pendientes.');downloadText(JSON.stringify({uid:activeOwner,revision:envelope.revision,commands:envelope.queue},null,2),'stockpro_pendientes_'+today()+'.json','application/json')}
useRemoteVersion=async function(){if(!conflict||!navigator.onLine||syncing||reading)return;if(!confirm('Se descargará el detalle de operaciones pendientes y luego se cargará Firebase. Revisá antes de volver a registrarlas.'))return;
 exportPendingCommands();try{localStorage.setItem(KEY+':recovery:'+activeOwner+':'+Date.now(),JSON.stringify(envelope));conflict=false;persistedRaw=localStorage.getItem(cacheKey());persist({...envelope,queue:[],pending:false});await refreshCloud()}catch(e){conflict=true;cloudFailure(e)}
};
let managedUsers=[];
async function loadUsers(){
 if(!roleHasModule('usuarios'))return;
 try{const result=await callRoles('stockproUsers',{action:'list'});managedUsers=result.users;document.getElementById('usersBody').innerHTML=result.users.map((u,i)=>'<tr><td>'+esc(u.name)+'</td><td>'+esc(u.email)+'</td><td>'+esc(ROLE_NAMES[u.role])+'</td><td>'+(u.active?'Activo':'Inactivo')+'</td><td><button class="btn btn-sm btn-outline-primary" onclick="editUser('+i+')">Editar</button></td></tr>').join('')}catch(e){toast(e.message)}
}
function editUser(index){const u=index==null?null:managedUsers[index];userUid.value=u?.uid||'';userName.value=u?.name||'';userEmail.value=u?.email||'';userEmail.disabled=!!u;userRole.value=u?.role||'CAJERO';userActive.checked=u?.active??true;modal('userModal').show()}
async function saveUser(){const button=document.getElementById('saveUserButton');button.disabled=true;
 try{await callRoles('stockproUsers',{action:userUid.value?'update':'create',uid:userUid.value||null,name:userName.value.trim(),email:userEmail.value.trim(),role:userRole.value,active:userActive.checked});modal('userModal').hide();await loadUsers();toast('Acceso actualizado. El usuario puede establecer su contraseña desde la pantalla de ingreso.')}
 catch(e){toast(e.message)}finally{button.disabled=false}
}
async function resetOwnPassword(){if(!auth)return;const email=loginEmail.value.trim();if(!email)return toast('Ingresá tu correo electrónico.');try{auth.languageCode='es';await auth.sendPasswordResetEmail(email);toast('Si la cuenta existe, Firebase enviará las instrucciones a ese correo.')}catch(e){toast('No se pudo enviar el correo. Revisá la configuración de Authentication.')}}
document.querySelector('[data-page="usuarios"]').addEventListener('click',loadUsers);
