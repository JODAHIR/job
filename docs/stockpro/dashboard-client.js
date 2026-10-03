/* Daily charts use sale amounts, not number of transactions or units. */
function dailySalesBreakdown(data,date){
 const payments=new Map(),categories=new Map(),products=new Map(data.products.map(p=>[p.id,p]));
 const add=(map,key,value)=>{if(Number.isFinite(value)&&value>0)map.set(key,(map.get(key)||0)+value)};
 for(const sale of data.sales.filter(s=>s.date===date)){
  add(payments,sale.pay||'Sin especificar',Number(sale.total));
  for(const item of sale.items||[])add(categories,item.category||products.get(item.productId)?.category||'Sin categoría',Number(item.qty)*Number(item.price));
 }
 const rows=map=>[...map].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
 return {payments:rows(payments),categories:rows(categories)};
}
const dashboardColors=['#635bff','#10b981','#f59e0b','#ec4899','#0ea5e9','#8b5cf6','#f97316','#64748b'];
function renderDailyPie(id,rows){
 const el=document.getElementById(id),total=rows.reduce((n,r)=>n+r.value,0);
 if(!total){el.innerHTML='<div class="pie-empty">Sin ventas registradas para este día.</div>';return;}
 let angle=0;const stops=rows.map((r,i)=>{const start=angle;angle+=r.value/total*100;return `${dashboardColors[i%dashboardColors.length]} ${start}% ${angle}%`});
 el.innerHTML=`<div class="daily-pie" role="img" aria-label="${esc(rows.map(r=>r.label+': '+money(r.value)).join('; '))}" style="background:conic-gradient(${stops.join(',')})"></div><ul class="pie-legend">${rows.map((r,i)=>`<li><span class="pie-dot" style="background:${dashboardColors[i%dashboardColors.length]}"></span><span>${esc(r.label)}<small>${(r.value/total*100).toLocaleString('es-PY',{maximumFractionDigits:1})}%</small></span><strong>${money(r.value)}</strong></li>`).join('')}</ul>`;
}
let dashboardDay=today(),dashboardFollowToday=true;
const dashboardSection=document.getElementById('dashboard');
dashboardSection.innerHTML=`<style>
.daily-charts{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}.pie-content{display:flex;align-items:center;gap:24px;flex-wrap:wrap;min-width:0}.daily-pie{width:168px;height:168px;border-radius:50%;flex-shrink:0;margin:12px auto}.pie-legend{list-style:none;padding:0;margin:0;flex:1;min-width:180px}.pie-legend li{display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #eef0f5}.pie-legend li>span:nth-child(2){flex:1;overflow-wrap:anywhere}.pie-legend small{display:block;color:#64748b}.pie-legend strong{font-size:13px}.pie-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}.pie-empty{padding:45px 10px;color:#64748b;text-align:center;width:100%}.dashboard-date{max-width:175px}@media(max-width:850px){.daily-charts{grid-template-columns:1fr}}
</style><div class="d-flex justify-content-between align-items-center mobile-stack"><div><h2>Panel general</h2><div class="text-secondary">Ventas, cuentas e inventario actualizados automáticamente.</div></div><button class="btn btn-outline-primary" onclick="retrySync()">Sincronizar</button></div>
<div id="dashKpis" class="row g-3 mt-1"></div>
<div class="card p-3 chart-card"><div class="chart-head"><div><h5>El ritmo de tus ventas</h5><span class="text-secondary">Últimos 7 días · guaraníes</span></div><b id="weekTotal"></b></div><div class="chart-bars" id="chartBars" aria-label="Ventas de los últimos siete días"></div>
<div class="d-flex align-items-center gap-2 mt-4 flex-wrap"><label for="dashboardDate">Detalle del día</label><input id="dashboardDate" type="date" class="form-control dashboard-date" value="${dashboardDay}" onchange="if(this.value){dashboardDay=this.value;dashboardFollowToday=this.value===today();renderDashboard()}"><span class="text-secondary small">Distribución por importe vendido</span></div>
<div class="daily-charts"><div><h6>Medios de pago</h6><div id="paymentPie" class="pie-content"></div><small class="text-secondary">Crédito corresponde a ventas a cobrar; no a dinero recibido.</small></div><div><h6>Categorías de artículos</h6><div id="categoryPie" class="pie-content"></div><small class="text-secondary">Ventas históricas sin categoría guardada usan la categoría actual del producto.</small></div></div></div>
<div class="card p-3 mt-3"><h5>Predicción de faltantes</h5><div class="table-responsive"><table class="table"><thead><tr><th>Producto</th><th>Stock</th><th>Prom./día</th><th>Cobertura</th><th>Reposición sugerida</th></tr></thead><tbody id="forecastTable"></tbody></table></div></div>`;
renderDashboard=function(){
 const sales=db.sales.filter(s=>s.date===today());
 const kpis=effectiveRole==='ENCARGADO'?[[money(db.products.reduce((n,p)=>n+p.stock*p.cost,0)),'Stock valorizado']]:[[money(sales.reduce((n,s)=>n+s.total,0)),'Ventas de hoy'],[money(db.credits.reduce((n,c)=>n+c.balance,0)),'Cuentas por cobrar'],[money(db.credits.filter(c=>creditState(c)==='EN MORA').reduce((n,c)=>n+c.balance,0)),'Saldo en mora'],[money(db.products.reduce((n,p)=>n+p.stock*p.cost,0)),'Stock valorizado']];
 document.getElementById('dashKpis').innerHTML=kpis.map(([value,label])=>`<div class="col-6 col-xl-3"><div class="card p-3"><div class="text-secondary">${label}</div><div class="kpi">${value}</div></div></div>`).join('');
 const risks=db.products.map(p=>({...p,days:p.avg>0?p.stock/p.avg:999,suggest:Math.max(0,Math.ceil(p.avg*14-p.stock))})).filter(p=>p.days<=14).sort((a,b)=>a.days-b.days);
 document.getElementById('forecastTable').innerHTML=risks.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${p.stock}</td><td>${p.avg.toFixed(1)}</td><td><span class="badge text-bg-${p.days<=3?'danger':p.days<=7?'warning':'primary'}">${p.days.toFixed(1)} días</span></td><td>${p.suggest?'Reponer '+p.suggest:'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="text-secondary">Sin riesgo relevante.</td></tr>';
 document.querySelector('.chart-card').hidden=effectiveRole==='ENCARGADO';
 if(dashboardFollowToday){dashboardDay=today();document.getElementById('dashboardDate').value=dashboardDay;}
 if(effectiveRole!=='ENCARGADO'){renderChart();const data=dailySalesBreakdown(db,dashboardDay);renderDailyPie('paymentPie',data.payments);renderDailyPie('categoryPie',data.categories);}
};
// Aging changes at midnight even when no sale is inserted.
let dashboardLastDay=today();setInterval(()=>{if(today()!==dashboardLastDay){dashboardLastDay=today();renderDashboard()}},60000);
