/* Five-column sales list; printing stays available inside the invoice cell. */
function saleDateTime(sale){
 const raw=sale.datetime||sale.date||'';
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const [y,m,d]=raw.split('-');return `${d}/${m}/${y} · Sin hora registrada`;}
 const date=new Date(raw);if(Number.isNaN(date.getTime()))return raw||'—';
 return date.toLocaleString('es-PY',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
}
const recentSalesHead=document.getElementById('salesTable').closest('table').querySelector('thead');
recentSalesHead.innerHTML='<tr><th>Fecha y hora</th><th>Cliente</th><th>Método de pago</th><th>Factura</th><th>Total</th></tr>';
renderSales=function(){
 document.getElementById('salesTable').innerHTML=db.sales.filter(s=>s.date===today()).slice(0,20).map(s=>`<tr><td>${esc(saleDateTime(s))}</td><td>${esc(s.client)}</td><td>${esc(s.pay)}</td><td>${s.invoice?esc(s.invoice.number):'<span class="text-secondary">Sin factura</span>'}${s.invoice&&!isSaleConfirmed(s)?'<br><span class="badge text-bg-warning">Pendiente / sin confirmar</span>':''}<br><button class="btn btn-sm btn-outline-secondary mt-1" onclick="printSale(${Number(s.id)})">Imprimir</button></td><td><b>${money(s.total)}</b></td></tr>`).join('')||'<tr><td colspan="5" class="text-secondary">Sin ventas registradas hoy.</td></tr>';
};

let recentSalesDay=today();
function refreshDailyViews(){const day=today();if(day!==recentSalesDay){recentSalesDay=day;renderSales();renderClients();renderDashboard();}}
setInterval(refreshDailyViews,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDailyViews()});
