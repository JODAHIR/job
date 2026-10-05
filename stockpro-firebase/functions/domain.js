function nextProductSku(products){const max=products.reduce((n,p)=>/^\d+$/.test(p.sku)?Math.max(n,Number(p.sku)):n,0);if(!Number.isSafeInteger(max+1))throw Error('Se agotó la numeración de SKU.');return String(max+1).padStart(6,'0')}
'use strict';
const {isDeepStrictEqual}=require('node:util');
const ROLES=['ADMIN','CAJERO','ENCARGADO','DUENO'];
const catalog=['saveProduct','deleteProduct','saveStockMove','saveSupplier','deleteSupplier','savePurchase'];
const till=['finishSale','saveClient','openCash','closeCash','addCashMove','saveCreditPayment'];
const onlyAdmin=['deleteClient','saveCredit','saveStamp','deleteStamp','restore'];
function fail(message,code='invalid-argument'){const e=Error(message);e.code=code;throw e}
const MODULE_DEFAULT_ROLES={dashboard:['ADMIN','ENCARGADO'],productos:['ADMIN','ENCARGADO'],ventas:['ADMIN','CAJERO'],clientes:['ADMIN','CAJERO'],proveedores:['ADMIN','ENCARGADO'],compras:['ADMIN','ENCARGADO'],creditos:['ADMIN','CAJERO'],facturacion:['ADMIN'],caja:['ADMIN','CAJERO'],movimientos:['ADMIN','ENCARGADO'],usuarios:['ADMIN','ENCARGADO']};
const CREDIT_LIMITS={NUEVO:300000,EXCELENTE:300000,BUENO:150000,MALO:0};
function lastBusinessDay(day){date(day);const [y,m]=day.split('-').map(Number),d=new Date(Date.UTC(y,m,0));while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
function defaultCreditDue(day){const due=lastBusinessDay(day);if(due>=day)return due;const d=new Date(day+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,1);return lastBusinessDay(d.toISOString().slice(0,10))}
const ACTION_MODULES={setCreditDueDate:'clientes',saveProduct:'productos',deleteProduct:'productos',saveStockMove:'movimientos',saveSupplier:'proveedores',deleteSupplier:'proveedores',savePurchase:'compras',finishSale:'ventas',saveClient:'clientes',deleteClient:'clientes',saveCredit:'creditos',saveCreditPayment:'creditos',saveStamp:'facturacion',deleteStamp:'facturacion',openCash:'caja',closeCash:'caja',addCashMove:'caja'};
function roleModule(role,id,grants={}){if(role==='DUENO')return ['dashboard','caja','usuarios'].includes(id);return role==='ADMIN'||(grants[id]||MODULE_DEFAULT_ROLES[id]||[]).includes(role)}
function authorize(role,action,grants){if(role==='DUENO')fail('Dueño tiene acceso de consulta; no puede registrar operaciones.','permission-denied');if(action==='setCreditDueDate'){if(role!=='ENCARGADO'||!roleModule(role,'clientes',grants))fail('Solo Encargado con acceso a Clientes puede modificar el vencimiento.','permission-denied');return;}if(!ROLES.includes(role))fail('Tu rol no permite esta operación.','permission-denied');if(grants!==undefined){const id=ACTION_MODULES[action];if(action==='restore'?role==='ADMIN':id&&roleModule(role,id,grants)&&(!['deleteClient','saveCredit'].includes(action)||role==='ADMIN'))return;}else if(role==='ADMIN'&&[...catalog,...till,...onlyAdmin].includes(action)||role==='CAJERO'&&till.includes(action)||role==='ENCARGADO'&&catalog.includes(action))return;fail('Tu rol no permite esta operación.','permission-denied')}
function manageAllowed(actor,target,role,uid,ownerUid){
 if(actor.role==='DUENO')fail('Dueño solo puede deshabilitar usuarios de sus despensas.','permission-denied');
 if(!actor.active||!['ADMIN','ENCARGADO'].includes(actor.role))fail('No podés gestionar usuarios.','permission-denied');
 if(!ROLES.includes(role))fail('Rol inválido.');
 if(actor.uid===uid)fail('No podés modificar tu propio acceso.','permission-denied');
 if(uid===ownerUid)fail('El superusuario inicial está protegido.','permission-denied');
 if(actor.role==='ENCARGADO'&&(['ADMIN','DUENO'].includes(role)||['ADMIN','DUENO'].includes(target?.role)))fail('Solo un administrador puede gestionar administradores.','permission-denied');
}
const clone=x=>JSON.parse(JSON.stringify(x));
const arrays=['products','clients','suppliers','sales','purchases','credits','stamps','moves'];
function empty(){return Object.assign(Object.fromEntries(arrays.map(k=>[k,[]])),{cash:{isOpen:false,openedAt:null,openingAmount:0,sessionId:null,moves:[],history:[]}})}
function num(v,min=0,max=1e12){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('Importe o cantidad fuera de rango.');return v}
function str(v,max=300,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('Texto inválido.');return v.trim()}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||(!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v))fail('Fecha inválida.');return v}
function find(list,id){const row=list.find(r=>r.id===id);if(!row)fail('Registro no encontrado.','not-found');return row}
function next(list){return Math.max(0,...list.map(r=>r.id))+1}
function tax(items){const t={base10:0,iva10:0,base5:0,iva5:0,exempt:0,total:0};for(const i of items){const v=i.qty*i.price;t.total+=v;if(i.vat===10){t.iva10+=v/11;t.base10+=v-v/11}else if(i.vat===5){t.iva5+=v/21;t.base5+=v-v/21}else t.exempt+=v}return t}
function expected(s,uid){const cash=s.cash,session=cash.sessionId;
 const sales=s.sales.filter(v=>session?v.cashSessionId===session&&(!v.operatorUid||v.operatorUid===uid):v.date===new Date().toLocaleDateString('en-CA',{timeZone:'America/Asuncion'}));
 const moves=cash.moves.filter(m=>session?m.cashSessionId===session:true);
 return cash.openingAmount+sales.filter(v=>v.pay==='Efectivo').reduce((n,v)=>n+v.total,0)+moves.reduce((n,m)=>n+(m.type==='INGRESO'?m.amount:-m.amount),0);
}
function project(s,actor){const d=clone(s);
 if(actor.role==='CAJERO'){d.products.forEach(p=>p.cost=0);d.suppliers=[];d.purchases=[];d.moves=[];d.sales=d.sales.filter(v=>v.operatorUid===actor.uid);}
 if(actor.role==='ENCARGADO'){d.clients=[];d.sales=[];d.credits=[];d.stamps=[];d.cash=empty().cash;}
 return d;
}
function clientInArrears(credits,clientId,day){return credits.some(c=>c.clientId===clientId&&Number(c.balance)>0&&c.dueDate<day)}
function apply(state,action,p,actor,ctx){
 authorize(actor.role,action,actor.moduleRoles);const s=clone(state),now=ctx.now||new Date().toISOString(),day=ctx.day||new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Asuncion'});let serial=0;
 const move=(product,type,qty,detail)=>s.moves.unshift({id:next(s.moves),date:day,datetime:now,productId:product.id,product:product.name,type,qty,detail,operatorUid:actor.uid});
 const cashMove=(amount,type,detail)=>s.cash.moves.unshift({id:next(s.cash.moves),date:day,datetime:now,amount,type,detail,cashSessionId:s.cash.sessionId,operatorUid:actor.uid});
 const requireCash=()=>{if(!s.cash.isOpen)fail('Abrí tu caja antes de operar.','failed-precondition')};
 switch(action){
 case 'saveProduct':{
 const q={sku:!p.id&&p.autoSku?nextProductSku(s.products):str(p.sku,100,true),name:str(p.name,300,true),category:str(p.category,100,true),cost:num(p.cost),price:num(p.price,0.01),min:num(p.min),avg:num(p.avg),vat:p.vat};if(![0,5,10].includes(q.vat))fail('IVA inválido.');
 if(s.products.some(x=>x.id!==p.id&&x.sku.toLowerCase()===q.sku.toLowerCase()))fail('SKU repetido.');
 if(p.id&&s.suppliers.some(v=>(v.productIds||[]).includes(p.id)&&v.category!==q.category))fail('Quitá la vinculación del proveedor antes de cambiar la categoría.');if(p.id)Object.assign(find(s.products,p.id),q);else{const product={id:next(s.products),...q,stock:num(p.stock)};s.products.push(product);if(product.stock)move(product,'ENTRADA',product.stock,'Stock inicial')}break;
 }
 case 'deleteProduct':if(s.suppliers.some(v=>(v.productIds||[]).includes(p.id)))fail('El producto está vinculado a un proveedor. Quitá primero esa vinculación.');if(s.sales.some(v=>v.items.some(i=>i.productId===p.id))||s.purchases.some(v=>v.productId===p.id))fail('El producto tiene operaciones vinculadas.');find(s.products,p.id);s.products=s.products.filter(x=>x.id!==p.id);break;
 case 'saveStockMove':{const product=find(s.products,p.id),qty=num(p.qty),type=p.type,detail=str(p.detail,500,true);if(!['ENTRADA','SALIDA','AJUSTE'].includes(type)||type!=='AJUSTE'&&qty<=0)fail('Ajuste inválido.');if(type==='SALIDA'&&qty>product.stock)fail('Stock insuficiente.');product.stock=type==='AJUSTE'?qty:product.stock+(type==='ENTRADA'?qty:-qty);move(product,type,type==='SALIDA'?-qty:qty,detail);break}
 case 'saveSupplier':{const category=str(p.category,100,true);if(!Array.isArray(p.productIds)||!p.productIds.length||p.productIds.length>200||new Set(p.productIds).size!==p.productIds.length)fail('Seleccioná entre 1 y 200 productos distintos.');for(const id of p.productIds)if(find(s.products,id).category!==category)fail('Los productos deben pertenecer a la categoría del proveedor.');const q={category,productIds:[...p.productIds],name:str(p.name,300,true),ruc:str(p.ruc,100),phone:str(p.phone,100),contact:str(p.contact,300)};if(p.id)Object.assign(find(s.suppliers,p.id),q);else s.suppliers.push({id:next(s.suppliers),...q});break}
 case 'deleteSupplier':if(s.purchases.some(v=>v.supplierId===p.id))fail('El proveedor tiene compras.');find(s.suppliers,p.id);s.suppliers=s.suppliers.filter(x=>x.id!==p.id);break;
 case 'savePurchase':{const supplier=find(s.suppliers,p.supplierId),product=find(s.products,p.productId),qty=num(p.qty,0.001),cost=num(p.cost,0.01);s.purchases.unshift({id:next(s.purchases),date:date(p.date),supplierId:supplier.id,supplier:supplier.name,productId:product.id,product:product.name,qty,cost,total:num(qty*cost),invoice:str(p.invoice,100),operatorUid:actor.uid});product.stock+=qty;product.cost=cost;move(product,'ENTRADA',qty,'Compra · '+supplier.name);break}
 case 'saveClient':{const old=p.id?find(s.clients,p.id):null;
 const q={name:str(p.name,300,true),doc:str(p.doc,100),phone:str(p.phone,100),address:str(p.address,500)};
 if(!old)Object.assign(q,{category:'NUEVO',limit:300000});
 else if(actor.role==='ENCARGADO'){
  const category=p.category===undefined?(old.category||''):p.category;
  if(category&&!Object.hasOwn(CREDIT_LIMITS,category))fail('Categoría de cliente inválida.');
  const limit=num(p.limit);if(category&&limit>CREDIT_LIMITS[category])fail('El monto supera el tope de la categoría.');
  q.limit=limit;if(category)q.category=category;else if(old.category)fail('No se puede quitar la categoría.');
 }else q.limit=old.limit;
 if(old)Object.assign(old,q);else s.clients.push({id:next(s.clients),...q});break}
 case 'setCreditDueDate':{const cr=find(s.credits,p.id);if(cr.balance<=0)fail('El crédito ya está cancelado.');date(p.dueDate);if(p.dueDate<cr.date)fail('El vencimiento no puede ser anterior al crédito.');cr.dueDate=p.dueDate;break}
 case 'deleteClient':if(s.sales.some(v=>v.clientId===p.id)||s.credits.some(v=>v.clientId===p.id))fail('El cliente tiene operaciones.');find(s.clients,p.id);s.clients=s.clients.filter(x=>x.id!==p.id);break;
 case 'openCash':if(s.cash.isOpen)fail('Tu caja ya está abierta.');Object.assign(s.cash,{isOpen:true,openedAt:now,openingAmount:num(p.amount),sessionId:actor.uid+":"+ctx.opid,operatorUid:actor.uid});break;
 case 'addCashMove':requireCash();if(!['INGRESO','EGRESO'].includes(p.type))fail('Tipo inválido.');cashMove(num(p.amount,0.01),p.type,str(p.detail,500,true));break;
 case 'closeCash':{requireCash();const total=expected(s,actor.uid),declared=num(p.declared);s.cash.history.unshift({id:next(s.cash.history),date:day,openedAt:s.cash.openedAt,closedAt:now,openingAmount:s.cash.openingAmount,expected:total,declared,difference:declared-total,cashSessionId:s.cash.sessionId,operatorUid:actor.uid});Object.assign(s.cash,{isOpen:false,openedAt:null,openingAmount:0});break}
 case 'finishSale':{
 requireCash();if(!Array.isArray(p.items)||!p.items.length||p.items.length>100)fail('Carrito inválido.');const used=new Set();
 const items=p.items.map(i=>{if(used.has(i.productId))fail('Producto repetido.');used.add(i.productId);const product=find(s.products,i.productId),qty=num(i.qty,1,1e6);if(!Number.isInteger(qty)||qty>product.stock)fail('Cantidad inválida o stock insuficiente.');if(i.price!==product.price||i.vat!==product.vat)fail('El precio o IVA cambió. Revisá la venta.','failed-precondition');return {productId:product.id,name:product.name,qty,price:product.price,vat:product.vat}});
 const taxes=tax(items),total=num(taxes.total,0.01),client=p.clientId?find(s.clients,p.clientId):null,pay=p.pay;
 if(!['Efectivo','Transferencia','Tarjeta de débito','Tarjeta de crédito','Crédito'].includes(pay))fail('Forma de pago inválida.');
 if(client&&clientInArrears(s.credits,client.id,day))fail('Cliente en mora. Registrá el cobro del saldo vencido antes de realizar una venta.','failed-precondition');
 if(pay==='Crédito'){if(!client)fail('Elegí un cliente.');if(actor.role!=='ENCARGADO')p={...p,dueDate:defaultCreditDue(day)};date(p.dueDate);if(p.dueDate<day)fail('Vencimiento inválido.');if(s.credits.filter(c=>c.clientId===client.id).reduce((n,c)=>n+c.balance,0)+total>client.limit)fail('La venta supera el límite de crédito autorizado.','permission-denied')}
 let invoice=null;
 if(p.invoice){const st=find(s.stamps,p.invoice.stampId);if(!st.enabled||day<st.validFrom||day>st.validTo||st.next>st.end)fail('Timbrado no disponible.');invoice={enabled:true,doc:str(p.invoice.doc,100,true),name:str(p.invoice.name,300,true),stampId:st.id,stamp:st.number,establishment:st.establishment,point:st.point,sequence:st.next,number:st.establishment+'-'+st.point+'-'+String(st.next).padStart(7,'0'),condition:pay==='Crédito'?'CRÉDITO':'CONTADO'};st.next++}
 const id=next(s.sales);s.sales.unshift({id,date:day,datetime:now,operatorUid:actor.uid,cashSessionId:s.cash.sessionId,clientId:client?.id||null,client:client?.name||'Consumidor final',pay,total,taxes,invoice,items});
 items.forEach(i=>{const product=find(s.products,i.productId);product.stock-=i.qty;move(product,'SALIDA',-i.qty,'Venta Nº '+id)});
 if(pay==='Crédito')s.credits.push({id:next(s.credits),clientId:client.id,client:client.name,date:day,dueDate:p.dueDate,amount:total,balance:total,note:'Generado por venta Nº '+id,payments:[],operatorUid:actor.uid});break;
 }
 case 'saveCredit':{const client=find(s.clients,p.clientId),old=p.id?find(s.credits,p.id):null,amount=num(p.amount,0.01);if((!old||!old.payments.length)&&s.credits.filter(c=>c.clientId===client.id&&c.id!==old?.id).reduce((n,c)=>n+c.balance,0)+amount>client.limit)fail('El crédito supera el límite autorizado.');date(p.date);if(old&&p.dueDate!==old.dueDate)fail('Solo Encargado puede modificar el vencimiento.','permission-denied');if(!old)p={...p,dueDate:defaultCreditDue(p.date)};date(p.dueDate);if(p.dueDate<p.date)fail('Vencimiento inválido.');const q={clientId:client.id,client:client.name,date:p.date,dueDate:p.dueDate,note:str(p.note,1000)};if(old){if(old.payments.length&&(old.clientId!==client.id||old.amount!==amount))fail('No se puede cambiar un crédito con pagos.');Object.assign(old,q);if(!old.payments.length)Object.assign(old,{amount,balance:amount})}else s.credits.push({id:next(s.credits),...q,amount,balance:amount,payments:[],operatorUid:actor.uid});break}
 case 'saveCreditPayment':{const cr=find(s.credits,p.id),amount=num(p.amount,0.01);if(amount>cr.balance)fail('Pago superior al saldo.');if(!['Efectivo','Transferencia','Tarjeta de débito','Tarjeta de crédito'].includes(p.method))fail('Medio de pago inválido.');if(p.method==='Efectivo')requireCash();const detail=str(p.detail,500);cr.payments.push({date:date(p.date),amount,method:p.method,detail,operatorUid:actor.uid});cr.balance-=amount;if(p.method==='Efectivo')cashMove(amount,'INGRESO','Pago de crédito #'+cr.id);break}
 case 'saveStamp':{const old=p.id?find(s.stamps,p.id):null,q={number:str(p.number,100,true),establishment:str(p.establishment,3,true),point:str(p.point,3,true),validFrom:date(p.validFrom),validTo:date(p.validTo),start:num(p.start,1,9999999),end:num(p.end,1,9999999),next:num(p.next,1,10000000),enabled:p.enabled,note:str(p.note,1000)};if(!/^\d{3}$/.test(q.establishment)||!/^\d{3}$/.test(q.point)||typeof q.enabled!=='boolean'||![q.start,q.end,q.next].every(Number.isInteger)||q.end<q.start||q.next<q.start||q.next>q.end+1||q.validTo<q.validFrom)fail('Timbrado inválido.');if(s.stamps.some(st=>st.id!==p.id&&st.number===q.number&&st.establishment===q.establishment&&st.point===q.point))fail('Timbrado repetido.');if(old&&s.sales.some(v=>v.invoice?.stampId===old.id)&&(q.next<old.next||['number','establishment','point','start','end'].some(k=>q[k]!==old[k])))fail('No se puede alterar la numeración utilizada.');if(old)Object.assign(old,q);else s.stamps.push({id:next(s.stamps),...q});break}
 case 'deleteStamp':if(s.sales.some(v=>v.invoice?.stampId===p.id))fail('Desactivá el timbrado: tiene facturas emitidas.');find(s.stamps,p.id);s.stamps=s.stamps.filter(x=>x.id!==p.id);break;
 case 'restore':{
 const d=p.data;if(!d||JSON.stringify(d).length>4e6)fail('Backup demasiado grande.');for(const k of arrays){if(!Array.isArray(d[k]))fail('Backup inválido.');const ids=new Set();for(const v of d[k]){num(v.id,0);if(ids.has(v.id))fail('ID duplicado.');ids.add(v.id)}}
 if(!d.cash||!Array.isArray(d.cash.moves)||!Array.isArray(d.cash.history))fail('Caja inválida.');
 for(const v of s.sales)if(!d.sales.some(x=>isDeepStrictEqual(x,v)))fail('El backup alteraría ventas existentes.');
 for(const st of s.stamps)if(!d.stamps.some(x=>x.id===st.id&&x.next>=st.next))fail('El backup retrocedería la numeración.');
 for(const v of d.products)for(const k of ['stock','cost','price','min','avg'])num(v[k]);
 for(const c of d.clients){str(c.name,300,true);num(c.limit);const old=s.clients.find(x=>x.id===c.id);if(old&&(c.limit!==old.limit||(c.category||'')!==(old.category||'')))fail('El backup no puede modificar las líneas de crédito existentes.');if(c.category&&(!Object.hasOwn(CREDIT_LIMITS,c.category)||c.limit>CREDIT_LIMITS[c.category]))fail('Categoría o límite inválido.')}
 for(const cr of d.credits){const old=s.credits.find(x=>x.id===cr.id);if(old&&cr.dueDate!==old.dueDate)fail('El backup no puede modificar vencimientos existentes.');}
 for(const c of d.credits){num(c.amount);num(c.balance);if(c.balance>c.amount||!Array.isArray(c.payments))fail('Crédito inválido.');for(const pay of c.payments){num(pay.amount);date(pay.date);str(pay.method,100)}}
 for(const v of d.sales){num(v.total);date(v.date);if(!Array.isArray(v.items)||v.items.length>100)fail('Venta inválida.');for(const item of v.items){num(item.qty,0.001);num(item.price);num(item.productId);if(![0,5,10].includes(item.vat))fail('IVA inválido.')}if(Math.abs(tax(v.items).total-v.total)>.01)fail('Total inconsistente.')}
 for(const v of d.purchases){num(v.qty);num(v.cost);num(v.total);date(v.date)}
 for(const m of d.moves){if(typeof m.qty!=='number'||!Number.isFinite(m.qty))fail('Movimiento inválido.')}
 for(const st of d.stamps){if(![st.start,st.end,st.next].every(Number.isInteger)||st.start<1||st.end<st.start||st.end>9999999||st.next<st.start||st.next>st.end+1)fail('Numeración inválida.');date(st.validFrom);date(st.validTo)}
 num(d.cash.openingAmount);if(typeof d.cash.isOpen!=='boolean')fail('Caja inválida.');for(const m of d.cash.moves)num(m.amount);for(const h of d.cash.history){num(h.declared);num(h.openingAmount)}
 for(const key of [...arrays,'cash'])s[key]=clone(d[key]);break;
 }
 default:fail('Operación desconocida.');
 }
 return s;
}
module.exports={clientInArrears,CREDIT_LIMITS,lastBusinessDay,defaultCreditDue,roleModule,MODULE_DEFAULT_ROLES,ACTION_MODULES,nextProductSku,ROLES,arrays,empty,project,apply,authorize,manageAllowed,expected,tax,clone,fail,str,num};
