import {scope} from './domain.js?v=cah-lotes-20261019';
import {sortedTypes,catalogType,lotQuantity,lotTracking} from './lot-catalog.js?v=cah-lotes-20261019';
const $=s=>document.querySelector(s);
function labelDialog(modal,label){modal.setAttribute('aria-label',label);modal.addEventListener('close',()=>modal.removeAttribute('aria-label'),{once:true});}
export function catalogPanel({db,esc,table}){
 const types=sortedTypes(db.catalog);
 return `<section class="panel"><h2>Tipos documentales</h2><p>Los códigos son permanentes. Los cambios no modifican la configuración de remisiones iniciadas.</p><div class="form-actions"><button id="catalog-new" class="primary">Agregar tipo</button><button id="catalog-seed" class="secondary">Completar catálogo inicial CAH</button></div>${table(['Código','Descripción','Condición','Estado','Orden',''],types.map(t=>[esc(t.code),esc(t.description),t.required?'Obligatorio':'Opcional',t.enabled?'Habilitado':'Inhabilitado',t.order,`<button class="link" data-type-edit="${esc(t.id)}">Editar</button>`]))}<p id="catalog-status" role="status"></p><details><summary>Historial del catálogo · 50 modificaciones por página</summary><div id="catalog-history">${table(['Revisión','Tipo','Usuario / rol','Fecha','Motivo','Cambio'],(db.catalogAudit||[]).map(a=>[a.revision,esc(a.after.code),esc(a.actor)+' · '+esc(a.role),esc(a.at?.toDate?.().toLocaleString('es-PY')||''),esc(a.reason),esc(JSON.stringify(a.before))+' → '+esc(JSON.stringify(a.after))]))}</div><button id="catalog-more" class="secondary" ${(db.catalogAudit||[]).length<50?'disabled':''}>Cargar anteriores</button></details></section>`;
}
export function bindCatalog(ctx){
 const {db,cloud,esc,load}=ctx;
 $('#catalog-more').onclick=async e=>{e.target.disabled=true;try{const older=await cloud.call('catalogHistory',{beforeRevision:db.catalogAudit.at(-1).revision});db.catalogAudit.push(...older);$('#catalog-history').insertAdjacentHTML('beforeend',ctx.table(['Revisión','Tipo','Usuario / rol','Fecha','Motivo','Cambio'],older.map(a=>[a.revision,esc(a.after.code),esc(a.actor)+' · '+esc(a.role),esc(a.at?.toDate?.().toLocaleString('es-PY')||''),esc(a.reason),esc(JSON.stringify(a.before))+' → '+esc(JSON.stringify(a.after))])));e.target.disabled=older.length<50;}catch(err){$('#catalog-status').textContent=err.message;e.target.disabled=false;}};

 $('#catalog-seed').onclick=async e=>{e.target.disabled=true;try{await cloud.call('initializeCatalog',{});await load();}catch(err){$('#catalog-status').textContent=err.message;e.target.disabled=false;}};
 const edit=id=>{
  const t=db.catalog?.types[id]||{code:'',description:'',required:false,enabled:true,order:sortedTypes(db.catalog).length+1};
  const uses=db.lotes.filter(l=>l.typeId===id).length,legacy=db.lotes.filter(l=>!l.typeId).length;
  const modal=$('#modal');labelDialog(modal,'Administrar tipo documental');modal.innerHTML=`<form id="type-form" class="form-fields"><h2>${id?'Editar':'Agregar'} tipo documental</h2><label>Código<input name="code" required maxlength="40" pattern="[A-Za-z0-9_-]+" ${id?'readonly':''} value="${esc(t.code)}"></label><label>Descripción<input name="description" required maxlength="200" value="${esc(t.description)}"></label><label>Condición<select name="required"><option value="true" ${t.required?'selected':''}>Obligatorio</option><option value="false" ${!t.required?'selected':''}>Opcional</option></select></label><label>Estado<select name="enabled"><option value="true" ${t.enabled?'selected':''}>Habilitado</option><option value="false" ${!t.enabled?'selected':''}>Inhabilitado</option></select></label><label>Orden<input name="order" type="number" min="0" max="10000" required value="${t.order}"></label><label>Motivo<input name="reason" maxlength="2000" required></label>${uses||legacy?`<p>Este tipo tiene ${uses} lotes vinculados; además hay ${legacy} lotes históricos sin clasificación que podrían estar relacionados. Inhabilitarlo impedirá generar nuevos lotes, pero conservará el historial.</p><label><input type="checkbox" name="ack"> Entiendo el efecto de inhabilitar este tipo.</label>`:''}<p id="type-error" role="alert"></p><div class="form-actions"><button class="primary">Guardar tipo</button><button type="button" id="type-cancel">Cancelar</button></div></form>`;modal.showModal();$('#type-cancel').onclick=()=>modal.close();
  $('#type-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const d=Object.fromEntries(new FormData(e.target));const type=catalogType({id:id||d.code,code:d.code,description:d.description,required:d.required==='true',enabled:d.enabled==='true',order:Number(d.order)});if(!id&&db.catalog?.types[type.id])throw Error('Ese código ya existe.');if((uses||legacy)&&t.enabled&&!type.enabled&&!d.ack)throw Error('Confirme que conoce el efecto de la inhabilitación.');await cloud.call('saveCatalog',{type,expectedRevision:db.catalog?.revision||0,reason:d.reason});modal.close();await load();}catch(err){$('#type-error').textContent=err.message;b.disabled=false;}};
 };
 $('#catalog-new').onclick=()=>edit();document.querySelectorAll('[data-type-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.typeEdit));
}
export function showLotGenerator(ctx){
 const {db,cloud,esc,f,load}=ctx,modal=$('#modal');labelDialog(modal,'Generar lotes automáticamente');
 if(!db.catalog){modal.innerHTML='<h2>Catálogo pendiente</h2><p>El Director o Administrador debe inicializar los tipos documentales.</p><button id="lot-close">Cerrar</button>';modal.showModal();$('#lot-close').onclick=()=>modal.close();return;}
 const opts=(rows,val)=>rows.map(x=>`<option value="${esc(x.id)}" ${x.id===val?'selected':''}>${esc(x.name)}</option>`).join('');
 modal.innerHTML=`<form id="lot-generate-form"><h2>Generar lotes automáticamente</h2><details open><summary>1. Datos generales</summary><div class="form-fields"><label>Gerencia<select name="gerenciaId" required><option value="">Seleccionar…</option>${opts(db.gerencias,f.gerencia)}</select></label><label>CAC<select name="cacId"><option value="">Todos los CAC activos</option></select></label><label>Año<input name="year" type="number" min="2000" max="2100" required value="${f.year}"></label><label>Mes<input name="month" type="number" min="1" max="12" required value="${f.month||1}"></label><label>Quincena<select name="half"><option value="1" ${String(f.half)==='1'?'selected':''}>Primera</option><option value="2" ${String(f.half)==='2'?'selected':''}>Segunda</option></select></label></div><button type="button" id="lot-prepare" class="secondary">Preparar tipos y cantidades</button></details><details id="lot-types"><summary>2. Tipos documentales y cantidades por CAC</summary><div id="lot-matrix"></div></details><button class="primary" id="lot-save" disabled>Guardar y cerrar lotes</button><p id="lot-error" role="alert"></p><button type="button" id="lot-close">Cerrar</button></form>`;modal.showModal();
 const form=$('#lot-generate-form');let prepared=null,results=null;
 const invalidate=()=>{prepared=null;$('#lot-save').disabled=true;$('#lot-matrix').innerHTML='';};
 const cacs=()=>db.cacs.filter(c=>c.gerenciaId===form.elements.gerenciaId.value&&c.active!==false);
 const syncCac=()=>{form.elements.cacId.innerHTML='<option value="">Todos los CAC activos</option>'+opts(cacs(),f.cac);invalidate();};syncCac();
 form.elements.gerenciaId.onchange=syncCac;for(const k of ['cacId','year','month','half'])form.elements[k].onchange=invalidate;
 $('#lot-close').onclick=async()=>{modal.close();if(results)await load();};
 $('#lot-prepare').onclick=()=>{
  try{
   if(!form.elements.gerenciaId.value)throw Error('Seleccione una gerencia.');
   const year=Number(form.elements.year.value),month=Number(form.elements.month.value),half=Number(form.elements.half.value);
   if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw Error('Año o mes inválido.');
   prepared={gerenciaId:form.elements.gerenciaId.value,year,month,half,catalogRevision:db.catalog.revision};let index=0;
   $('#lot-matrix').innerHTML=cacs().filter(c=>!form.elements.cacId.value||c.id===form.elements.cacId.value).map(c=>{
    const r=db.remisiones.find(r=>r.cacId===c.id&&r.year===year&&r.month===month&&r.half===half&&!r.annulment);
    const req=db.lotRequirements?.find(x=>x.id===r?.id),version=db.catalogVersions?.find(x=>x.revision===req?.catalogVersion),types=sortedTypes(version||db.catalog);
    return `<details open><summary>${esc(c.name)} · ${r?'Remisión registrada':'Sin remisión registrada'}</summary>${!r?'<p>Este CAC no tiene remisión. Seleccione un CAC con remisión para guardar.</p>':''}<div class="lot-type-grid">${types.filter(t=>t.enabled).map(t=>{const n=index++,existing=db.lotes.find(l=>l.remisionId===r?.id&&l.typeId===t.id),disabled=!db.catalog.types[t.id]?.enabled;return `<div class="lot-type-row"><label><input type="checkbox" data-lot-choice data-cac="${esc(c.id)}" data-type="${esc(t.id)}" data-index="${n}" ${t.required?'checked':''} ${t.required||disabled?'disabled':''}> ${esc(t.code)} · ${esc(t.description)} · ${t.required?'Obligatorio':'Opcional'}</label><label>Cantidad · ${esc(c.name)} · ${esc(t.code)}<input data-quantity="${n}" type="number" min="0" max="1000000" step="1" ${existing||disabled?'disabled':''}></label><small>${existing?'Existente: '+esc(existing.code)+' · '+existing.declared+' declarados (no se sobrescribe)':disabled?'Tipo inhabilitado: no se pueden generar nuevos lotes':''}</small></div>`;}).join('')}</div></details>`;
   }).join('')||'<p>No hay CAC activos.</p>';
   $('#lot-types').open=true;$('#lot-save').disabled=false;$('#lot-error').textContent='';
  }catch(e){$('#lot-error').textContent=e.message;}
 };
 function itemsForSave(){
  return [...form.querySelectorAll('[data-lot-choice]:checked')].map(el=>{const r=db.remisiones.find(r=>r.cacId===el.dataset.cac&&r.year===prepared.year&&r.month===prepared.month&&r.half===prepared.half&&!r.annulment);const old=db.lotes.find(l=>l.remisionId===r?.id&&l.typeId===el.dataset.type);const disabled=!db.catalog.types[el.dataset.type]?.enabled;return {cacId:el.dataset.cac,typeId:el.dataset.type,declared:old?.declared??(!r||disabled?0:lotQuantity(form.querySelector(`[data-quantity="${el.dataset.index}"]`).value)),skipDisabled:disabled};});
 }
 let saving=false;
 form.onsubmit=async e=>{
  e.preventDefault();if(!prepared||saving)return;
  let disabledBefore=[];
  try{
   const all=itemsForSave();
   if(!all.length||all.length>200)throw Error('Seleccione entre 1 y 200 lotes por operación.');
   if(all.some(i=>i.skipDisabled))throw Error('Hay tipos inhabilitados en la selección. Prepare nuevamente los tipos.');
   const missing=all.filter(i=>!db.remisiones.some(r=>r.cacId===i.cacId&&r.year===prepared.year&&r.month===prepared.month&&r.half===prepared.half&&!r.annulment));
   if(missing.length)throw Error('Todos los CAC seleccionados deben tener una remisión registrada. Seleccione un CAC con remisión.');
   const items=all.map(({skipDisabled,...i})=>i);
   saving=true;disabledBefore=[...form.elements].map(el=>[el,el.disabled]);
   for(const [el] of disabledBefore)el.disabled=true;
   $('#lot-save').textContent='Guardando…';$('#lot-error').textContent='';
   const response=await cloud.call('generateLots',{...prepared,items});results=response.results;
   const failed=results.filter(r=>!['created','existing'].includes(r.status));
   if(failed.length||results.length!==items.length){
    const saved=results.filter(r=>['created','existing'].includes(r.status)).length;
    throw Error(`${saved} lotes registrados o existentes. No se completó el guardado: ${failed.map(r=>`${db.cacs.find(c=>c.id===r.cacId)?.name||r.cacId} · ${r.typeId}: ${r.message||r.status}`).join('; ')||'Respuesta incompleta'}. Puede reintentar; los existentes no se duplican.`);
   }
   Object.assign(f,{gerencia:prepared.gerenciaId,cac:form.elements.cacId.value,year:prepared.year,month:prepared.month,half:String(prepared.half)});
   modal.close();await load();
  }catch(err){$('#lot-error').textContent=err.message;}
  finally{
   saving=false;for(const [el,disabled] of disabledBefore)el.disabled=disabled;
   $('#lot-save').textContent='Guardar y cerrar lotes';
  }
 };

}
export function lotDashboard(ctx){const {db,f,esc,table}=ctx,rows=lotTracking(db,f),lots=scope(db,f).lots,totals=new Map();for(const l of lots){const key=l.typeCode||'Histórico sin clasificación',t=totals.get(key)||{lots:0,declared:0};t.lots++;t.declared+=l.declared;totals.set(key,t);}return `<section class="panel"><h2>Seguimiento de carga documental</h2><p>${lots.length} lotes · ${lots.filter(l=>l.typeRequired===true).length} obligatorios · ${lots.filter(l=>l.typeRequired===false).length} opcionales · ${rows.filter(r=>r.lots>0).length} CAC/períodos con lotes · ${rows.filter(r=>r.status==='Sin lotes').length} sin lotes · ${rows.filter(r=>r.status==='Sin remisión').length} sin remisión.</p>${table(['Tipo documental','Lotes','Declarados'],[...totals].map(([k,v])=>[esc(k),v.lots,v.declared]))}<p>Exigibles declarados: ${lots.reduce((n,l)=>n+l.declared,0)}. La exigibilidad total no está determinada en cargas incompletas o históricos sin clasificación. Exclusiones: sin descuento; procedimiento pendiente. Carga completa y revisión documental son indicadores distintos.</p>${table(['CAC','Período','Seguimiento','Lotes','Declarados','Individualizados','Revisados','Observados','Faltantes','Tipos pendientes'],rows.map(r=>[esc(db.cacs.find(c=>c.id===r.cacId)?.name),`${r.year}/${r.month} · ${r.half}ª`,r.status,r.lots,r.declared,r.received,r.reviewed,r.observed,r.missing,esc(r.pending)]))}</section>`;}
