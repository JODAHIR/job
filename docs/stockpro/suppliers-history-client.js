/* Supplier purchase history and date-based reminders; no extra cloud polling. */
function supplierPurchases(data,id,from='',to=''){
 return data.purchases.filter(p=>p.supplierId===id&&(!from||p.date>=from)&&(!to||p.date<=to)).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
}
function supplierVisitState(date,day){
 if(!date)return {label:'Sin programar',tone:'secondary',alert:false};
 const days=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(day+'T12:00:00Z'))/86400000);
 if(days<0)return {label:'Visita pendiente',tone:'danger',alert:true};
 if(days===0)return {label:'Visita hoy',tone:'warning',alert:true};
 return {label:days===1?'Mañana':'En '+days+' días',tone:days<=7?'info':'secondary',alert:days<=7};
}
function supplierDisplayDate(date){return date?date.split('-').reverse().join('/'):'—';}
// UI bindings
let supplierHistoryId=null;
document.getElementById('sContact').insertAdjacentHTML('afterend','<label for="supplierNextVisit" class="form-label mt-3">Próxima visita</label><input id="supplierNextVisit" type="date" class="form-control"><p class="small text-secondary mt-2">Aviso en Proveedores durante los 7 días anteriores y el día de la visita. Después quedará pendiente hasta cambiar o quitar la fecha.</p>');
document.getElementById('supplierModal').classList.remove('fade');
const supplierFieldsBeforeVisit=supplierLinkFields;supplierLinkFields=function(){return {...supplierFieldsBeforeVisit(),nextVisit:document.getElementById('supplierNextVisit').value};};
const supplierOpenBeforeVisit=openSupplier;openSupplier=function(id=null){supplierOpenBeforeVisit(id);document.getElementById('supplierNextVisit').value=db.suppliers.find(s=>s.id===id)?.nextVisit||'';};
document.getElementById('suppliersTable').closest('.card').insertAdjacentHTML('beforebegin','<div id="supplierVisitAlerts" class="card p-3 mt-3" hidden><h5>Agenda de visitas</h5><div id="supplierVisitList" class="d-flex flex-column gap-2" role="status"></div></div>');
document.body.insertAdjacentHTML('beforeend','<div class="modal" id="supplierHistoryModal" tabindex="-1" aria-labelledby="supplierHistoryTitle" aria-hidden="true"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 id="supplierHistoryTitle" class="modal-title">Histórico de compras</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body"><div class="d-flex gap-3 flex-wrap align-items-end mb-3"><label>Desde<input id="supplierHistoryFrom" type="date" class="form-control" onchange="renderSupplierHistory()"></label><label>Hasta<input id="supplierHistoryTo" type="date" class="form-control" onchange="renderSupplierHistory()"></label><button class="btn btn-outline-secondary" onclick="document.getElementById(\'supplierHistoryFrom\').value=\'\';document.getElementById(\'supplierHistoryTo\').value=\'\';renderSupplierHistory()">Ver todo</button></div><p id="supplierHistorySummary" class="fw-semibold" role="status"></p><div class="table-responsive"><table class="table"><thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th>Total</th><th>Factura / referencia</th><th>Revisión</th></tr></thead><tbody id="supplierHistoryTable"></tbody></table></div></div></div></div></div>');
document.getElementById('supplierHistoryModal').addEventListener('hidden.bs.modal',()=>{supplierHistoryId=null;document.getElementById('supplierHistoryTable').innerHTML='';});
function showSupplierHistory(id){if(!roleHasModule('proveedores')||!accessProfile(effectiveRole).purchases)return;const supplier=db.suppliers.find(s=>s.id===id);if(!supplier)return;supplierHistoryId=id;document.getElementById('supplierHistoryFrom').value='';document.getElementById('supplierHistoryTo').value='';renderSupplierHistory();modal('supplierHistoryModal').show();}
function renderSupplierHistory(){
 if(supplierHistoryId===null)return;
 const supplier=db.suppliers.find(s=>s.id===supplierHistoryId),body=document.getElementById('supplierHistoryTable'),summary=document.getElementById('supplierHistorySummary');
 if(!supplier||!accessProfile(effectiveRole).purchases){body.innerHTML='';summary.textContent='Sin datos disponibles.';return;}
 document.getElementById('supplierHistoryTitle').textContent='Histórico de compras · '+supplier.name;
 const from=document.getElementById('supplierHistoryFrom').value,to=document.getElementById('supplierHistoryTo').value;
 if(from&&to&&from>to){summary.textContent='La fecha Desde no puede ser posterior a Hasta.';body.innerHTML='';return;}
 const rows=supplierPurchases(db,supplierHistoryId,from,to);summary.textContent=rows.length+' recepción(es) · Total comprado: '+money(rows.reduce((n,p)=>n+p.total,0));
 body.innerHTML=rows.map(p=>`<tr><td>${esc(supplierDisplayDate(p.date))}</td><td>${esc(p.product)}</td><td>${p.qty}</td><td>${money(p.cost)}</td><td><b>${money(p.total)}</b></td><td>${esc(p.invoice||'—')}</td><td><button class="btn btn-sm btn-outline-primary" onclick="modal('supplierHistoryModal').hide();showPurchaseReview(${p.id})">${p.verified?'Verificada':'Pendiente'} · Ver</button></td></tr>`).join('')||'<tr><td colspan="7" class="text-secondary">Sin compras en el período seleccionado.</td></tr>';
}
function renderSupplierVisits(){
 const upcoming=db.suppliers.filter(s=>s.nextVisit&&supplierVisitState(s.nextVisit,today()).alert).sort((a,b)=>a.nextVisit.localeCompare(b.nextVisit));
 document.getElementById('supplierVisitAlerts').hidden=!upcoming.length;
 document.getElementById('supplierVisitList').innerHTML=upcoming.map(s=>{const status=supplierVisitState(s.nextVisit,today());return `<div class="d-flex align-items-center flex-wrap gap-2"><span class="badge text-bg-${status.tone}">${esc(status.label)}</span><b>${esc(s.name)}</b><span>${esc(supplierDisplayDate(s.nextVisit))}</span><button class="btn btn-sm btn-outline-primary" onclick="openSupplier(${s.id})">Reprogramar</button></div>`;}).join('');
}
document.getElementById('suppliersTable').closest('table').querySelector('thead').innerHTML='<tr><th>Proveedor</th><th>RUC</th><th>Teléfono / contacto</th><th>Categoría</th><th>Productos vinculados</th><th>Total comprado</th><th>Próxima visita</th><th>Acciones</th></tr>';
renderSuppliers=function(){
 document.getElementById('suppliersTable').innerHTML=db.suppliers.map(s=>{const products=(s.productIds||[]).map(id=>db.products.find(p=>p.id===id)),visit=supplierVisitState(s.nextVisit,today());return `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.ruc)}</td><td>${esc(s.phone)}<br>${esc(s.contact)}</td><td>${esc(s.category||'Pendiente de asignar')}</td><td>${products.length?products.map(p=>p?esc(p.sku+' · '+p.name):'Producto no disponible').join('<br>'):'<span class="text-secondary">Editá para vincular productos</span>'}</td><td>${money(supplierPurchases(db,s.id).reduce((n,p)=>n+p.total,0))}</td><td>${esc(supplierDisplayDate(s.nextVisit))}<br><span class="badge text-bg-${visit.tone}">${esc(visit.label)}</span></td><td><div class="d-flex flex-wrap gap-1"><button class="btn btn-sm btn-outline-secondary" onclick="showSupplierHistory(${s.id})">Histórico</button><button class="btn btn-sm btn-outline-primary" onclick="openSupplier(${s.id})">Editar</button><button class="btn btn-sm btn-outline-danger" onclick="deleteSupplier(${s.id})">Eliminar</button></div></td></tr>`;}).join('')||'<tr><td colspan="8" class="text-secondary">Sin proveedores.</td></tr>';
 renderSupplierVisits();renderSupplierHistory();
};
let supplierVisitDay=today();function refreshSupplierDay(){if(today()!==supplierVisitDay){supplierVisitDay=today();renderSuppliers();}}
setInterval(refreshSupplierDay,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSupplierDay()});
