import {documentLots,selectedDocumentLot} from './document-lot-selection.js';
import {observationCatalog,observationKey} from './observation-catalog.js';
import {observationCatalogPanel,bindObservationCatalog} from './observation-catalog-ui.js';
import {initialFilters,createFilterSession} from './filter-session.js?v=filtros-vacios-20261023';
import {connectionState,orderLots} from './presentation-status.js?v=cah-filtros-20261020';
import {showLotVerification,lotVerificationLabel,lotReconciliation} from './lot-verification-ui.js?formulario-20261023';
import {creationActions} from './record-actions.js?v=cah-ajustes-20261020';
import {dashboardFilters,intelligencePanel,bindIntelligence,groupModuleFilters} from './intelligence-ui.js?dashboard-color-20261025';
import {catalogPanel,bindCatalog,showLotGenerator,lotDashboard} from './lot-ui.js?v=cah-guardado-directo-20261019';
import {sortedTypes} from './lot-catalog.js?v=cah-lotes-20261019';
import {annulPanel,bindAnnulPanel} from './remision-annul-ui.js?v=cah-filtros-20261020';
import {pages,resolveRoute,routeFor} from './navigation.js?catalogo-observaciones-20261024';
import {navigationMarkup,bindNavigation,breadcrumb} from './navigation-ui.js?catalogo-observaciones-20261024';
import {installTables} from './tables.js?v=filas20-20261023';
import {validateResponsables,validateContact,assignedUsers,userDescription} from './gerencia-contacts.js?v=cah-lotes-20261019';
import { visibleModule, manageRecord, manageCacStatus } from './permissions.js?catalogo-observaciones-20261024';
import {phase3Panel,bindPhase3} from './phase3-ui.js?documental-20261024';
import { metrics, scope, deadlineStatus, mutate, states, integer } from "./domain.js?filtros-vacios-20261023";
import { LocalRepository } from "./repository.js?v=cah-lotes-20261019";
import { demo } from "./seed.js?v=cah-lotes-20261019";
import { cloudPanel, bindCloudPanel } from "./cloud-ui.js?v=cah-ajustes-20261020";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
let filterStorage;try{filterStorage=sessionStorage;}catch{}
const filterSession=createFilterSession(filterStorage);
let mode = "cloud",
  repo,
  db,
  page = "dashboard",
  query = "",
  f = filterSession.read();
const find = (c, id) => db[c].find((x) => x.id === id),
  name = (c, id) => find(c, id)?.name || "—";
const period = (r) => `${months[r.month - 1]} ${r.year} · ${r.half}ª quincena`;
const badge = (text, tone = "") =>
  `<span class="badge ${tone}">${esc(text)}</span>`;
const options = (rows, value, label, selected) =>
  rows
    .map(
      (r) =>
        `<option value="${esc(value(r))}" ${String(value(r)) === String(selected) ? "selected" : ""}>${esc(label(r))}</option>`,
    )
    .join("");
const select = (key, label, rows, selected, all) =>
  `<label>${label}<select data-filter="${key}">${all ? `<option value="">${all}</option>` : ""}${options(
    rows,
    (r) => r.id,
    (r) => r.name,
    selected,
  )}</select></label>`;
let cloud=null, stopProfile=null, stopAuth=null, epoch=0;
const cloudMode=()=>mode==='cloud';
const cloudContext=()=>({cloud,db,f,esc,table,badge,find,load,localRepository:LocalRepository});
const phase3Context=()=>({db,f,mode,cloud,esc,table,render,load,repo});
const canManage=(c)=>!cloudMode()||manageRecord(cloud?.profile,c);
function gerenciaFor(c,row){if(c==='gerencias')return row.id;if(c==='cacs')return row.gerenciaId;if(c==='remisiones')return find('cacs',row.cacId).gerenciaId;if(c==='lotes')return gerenciaFor('remisiones',find('remisiones',row.remisionId));if(c==='documentos')return gerenciaFor('lotes',find('lotes',row.loteId));return gerenciaFor('documentos',find('documentos',row.documentId));}
function loginView(error=''){  hidePrivateShell();
  if(cloud?.authOnly){authenticationView(error);return;}
  $('#app').innerHTML=`<main class="content login-page"><section class="panel"><h1>CONTROL DOCUMENTO</h1><p>Para acceder al sistema debes ser funcionario de la Dirección de Operaciones</p><form id="login-form" class="form-fields"><label>Correo<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
<button class="primary">Ingresar</button></form>
<p id="login-error" role="alert">${esc(error)}</p>
<div class="form-actions">
  <button id="google-login" class="primary" type="button">Ingresar con Google</button>
  ${!cloud?.auth.currentUser ? '<button id="google-signup" class="primary" type="button">Crear cuenta con Google</button>' : ''}
  ${cloud?.auth.currentUser ? '<button id="logout">Cerrar sesión</button>' : ''}
</div>
<p></p></section></main>`;
  $('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const values=new FormData(e.target);try{await cloud.login(values.get('email'),values.get('password'))}catch(error){$('#login-error').textContent=error.message;b.disabled=false}};
  const googleAccess=async()=>{
    const buttons=[$('#google-login'),$('#google-signup')].filter(Boolean);
    buttons.forEach(button=>button.disabled=true);
    try{await cloud.google()}catch(error){
      const messages={'auth/popup-closed-by-user':'Se cerró la ventana de Google. Puedes intentarlo nuevamente.','auth/popup-blocked':'Permite la ventana emergente para continuar con Google.','auth/network-request-failed':'No se pudo conectar. Revisa tu conexión e inténtalo nuevamente.'};
      if($('#login-error'))$('#login-error').textContent=messages[error.code]||error.message;
    }finally{buttons.forEach(button=>button.disabled=false);}
  };
  $('#google-login').onclick=googleAccess;
  if($('#google-signup'))$('#google-signup').onclick=googleAccess;
  if($('#logout'))$('#logout').onclick=()=>cloud.logout();
  if(cloud?.spark && cloud.auth.currentUser){const button=document.createElement('button');button.textContent='Solicitar acceso';button.className='primary';button.onclick=async()=>{button.disabled=true;try{await cloud.requestAccess();$('#login-error').textContent='Solicitud registrada. El administrador debe asignar su perfil.';}catch(e){$('#login-error').textContent=e.message;button.disabled=false}};$('.login-page .panel').append(button);}
  if(!cloud){$('#google-login').disabled=true;if($('#google-signup'))$('#google-signup').disabled=true;$('#login-form button').disabled=true;}
}
function authenticationView(error=''){
  hidePrivateShell();
  const user=cloud.auth.currentUser;
  $('#app').innerHTML=`<main class="content login-page"><section class="panel"><h1>Control Documental</h1><p>Acceso con Google · controldoc-385bd</p>${user?`<h2>Sesión iniciada</h2><p>${esc(user.email)}</p><p>${user.emailVerified?'Correo verificado.':'Correo pendiente de verificación.'}</p><p>La autenticación está conectada. La aprobación de accesos, los permisos administrativos y el guardado documental en Spark todavía no están habilitados.</p><button id="auth-logout" class="secondary">Cerrar sesión</button>`:'<p>Identifícate con tu cuenta de Google. Iniciar sesión no concede permisos de acceso a documentos.</p><button id="auth-google" class="primary">Ingresar con Google</button>'}<p id="auth-error" role="alert">${esc(error)}</p></section></main>`;
  if($('#auth-google'))$('#auth-google').onclick=async e=>{e.target.disabled=true;try{await cloud.google()}catch(err){const messages={'auth/operation-not-allowed':'El proveedor Google aún debe habilitarse en Firebase Authentication.','auth/unauthorized-domain':'Debe autorizarse jodahir.github.io en Firebase Authentication.','auth/configuration-not-found':'Firebase Authentication aún no está configurado en este proyecto.','auth/popup-blocked':'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo otra vez.','auth/popup-closed-by-user':'Se cerró el inicio de sesión antes de completarlo.'};authenticationView(messages[err.code]||err.message)}};
  if($('#auth-logout'))$('#auth-logout').onclick=async()=>{try{await cloud.logout()}catch(err){authenticationView(err.message)}};
}
let updateNoticeTimer;
function updateNotice(message, error = false) {
  clearTimeout(updateNoticeTimer);
  document.getElementById('update-notice')?.remove();
  const notice=document.createElement('div');
  notice.id='update-notice';notice.setAttribute('role',error?'alert':'status');
  notice.textContent=message;
  notice.style.cssText='position:fixed;bottom:24px;right:24px;z-index:1000;padding:12px 20px;border-radius:8px;background:'+(error?'#8c3232':'#087f83')+';color:white;box-shadow:0 4px 18px #0002;max-width:calc(100vw - 48px)';
  document.body.append(notice);
  updateNoticeTimer=setTimeout(()=>notice.remove(),error?8000:3500);
}
// The reload placeholder contains no account, permissions or document data.
function syncShell(){return `<aside class="sync-sidebar" aria-hidden="true"><strong>CAH</strong><p>Dirección de Operaciones</p></aside><main class="sync-shell"><header><strong>CONTROL DOCUMENTO — CAH</strong><span role="status">Sincronizando…</span></header><div class="content" aria-hidden="true"><div class="sync-placeholder sync-title"></div><div class="sync-placeholder sync-filters"></div><div class="sync-cards">${'<div class="sync-placeholder"></div>'.repeat(4)}</div></div></main>`;}
let connectionFailed=false;
function updateConnectionChip(){const chip=document.querySelector('.local-chip');if(!chip)return;const state=connectionState(mode,navigator.onLine,connectionFailed);chip.className='local-chip connection-'+state.tone;chip.textContent='◉ '+state.label;chip.setAttribute('role','status');}
window.addEventListener('offline',updateConnectionChip);
window.addEventListener('online',updateConnectionChip);
function showSyncStatus(){if($('#sync-status'))return;const status=document.createElement('div');status.id='sync-status';status.setAttribute('role','status');status.textContent='Sincronizando…';document.body.append(status);}
async function load() {
  const token=++epoch;
  if(cloudMode()){
    const refreshing=!!(db && cloud?.auth.currentUser && $('#refresh-cloud'));
    if(!refreshing){$('#modal').close();$('#app').innerHTML=syncShell();db=null;}
    else {$('#app').setAttribute('aria-busy','true');$('#refresh-cloud').disabled=true;showSyncStatus();}

    try{
      if(!cloud){const module=await import('./firebase-client.bundle.js?registro-integrado-20261024');cloud=await module.connectFirebase();let initial=true;stopAuth=cloud.watchAuth(()=>{if(initial){initial=false;return}if(cloudMode()||!cloud.auth.currentUser){mode='cloud';epoch++;db=null;page="dashboard";functionId="list";window.history.replaceState(null,"",routeFor(page));$('#modal').close();load()}});}
      if(cloud.authOnly){authenticationView();return}
      if(!cloud.auth.currentUser){loginView();return}
      const result=await cloud.load({includeAdministration:false,onCached:cached=>{
        if(refreshing||token!==epoch||!cloudMode()||!cloud.auth.currentUser)return;
        db=cached;render();$('#app').inert=true;showSyncStatus();const status=$('#sync-status');if(status)status.textContent='Mostrando datos recientes · Sincronizando…';
      }});if(token!==epoch||!cloudMode())return;db=result;connectionFailed=false;
      if(stopProfile)stopProfile();const signature=JSON.stringify(cloud.profile);stopProfile=cloud.watchProfile(cloud.auth.currentUser.uid,p=>{if(cloudMode()&&JSON.stringify(p)!==signature){epoch++;db=null;$('#modal').close();load()}});
      if(!visibleModule(cloud.profile,page))page='dashboard';
      $('#app').inert=false;$('#sync-status')?.remove();$('#app').removeAttribute('aria-busy');render();if(refreshing)updateNotice('Actualización realizada');return;
    }catch(error){if(token===epoch){if(['unavailable','deadline-exceeded'].includes(error.code?.replace('firestore/','')))connectionFailed=true;updateConnectionChip();
      $('#app').inert=false;$('#sync-status')?.remove();$('#app').removeAttribute('aria-busy');
      if(refreshing && cloud?.auth.currentUser && ['unavailable','deadline-exceeded'].includes(error.code?.replace('firestore/',''))){
        if($('#refresh-cloud'))$('#refresh-cloud').disabled=false;
        updateNotice('No se pudo actualizar. Inténtalo de nuevo.',true);
      }else{db=null;loginView(error.message)}
    }return}
  }
  if(!cloud?.auth.currentUser||cloud.profile?.role!=='technical'||!cloud.profile?.active){mode='cloud';return load();}
  if(stopProfile){stopProfile();stopProfile=null;}
  repo = new LocalRepository(mode);
  db = await repo.load();
  if (mode === "demo" && !localStorage.getItem(repo.key)) {
    db = demo();
    await repo.save(db);
  }
  render();
}
function filters() {
  if(page==='dashboard'&&intelligenceLevel!=='legacy')return dashboardFilters(db,f);
  return `<section class="filters">${select(
    "year",
    "Año",
    Array.from(
      new Set([
        2026,
        new Date().getFullYear(),
        +f.year,
        ...db.remisiones.map((r) => r.year),
      ]),
    )
      .filter(Boolean)
      .sort((a, b) => b - a)
      .map((n) => ({ id: n, name: n })),
    f.year,
    "Todos los años",
  )}${select(
    "month",
    "Mes",
    months.map((n, i) => ({ id: i + 1, name: n })),
    f.month,
    "Todos los meses",
  )}${select(
    "half",
    "Quincena",
    [
      { id: 1, name: "Primera quincena" },
      { id: 2, name: "Segunda quincena" },
    ],
    f.half,
    "Ambas quincenas",
  )}${select("gerencia", "Gerencia", db.gerencias, f.gerencia, "Todas las gerencias")}${select(
    "cac",
    "CAC / dependencia",
    db.cacs.filter((c) => !f.gerencia || c.gerenciaId === f.gerencia),
    f.cac,
    "Todos los CAC",
  )}${[['remission','Estado de remisión',['Registrada','Pendiente']],['reconciliation','Conciliación',['Conciliado','Con diferencias']],['verification','Verificación',states],['observation','Observación',['Pendiente','En proceso','Regularizada']],['deadline','Situación del plazo',['En plazo','Próximo','Vencido','Sin plazo']]].map(([key,label,values])=>select(key,label,values.map(id=>({id,name:id})),f[key],'Todos')).join('')}${db.catalog?select("documentType","Tipo documental",sortedTypes(db.catalog).map(t=>({id:t.id,name:t.code+" · "+t.description})),f.documentType,"Todos los tipos"):""}<label>Estado administrativo<select data-filter="lifecycle"><option value="" ${!f.lifecycle?'selected':''}>Vigentes</option><option value="annulled" ${f.lifecycle==='annulled'?'selected':''}>Anuladas (histórico)</option><option value="all" ${f.lifecycle==='all'?'selected':''}>Todas (incluye anuladas)</option></select></label><button id="clear-filters" class="secondary">Limpiar filtros</button></section>`;
}
function table(headers, rows) {
  return `<div class="table-scroll"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty">No hay registros para esta selección.</td></tr>`}</tbody></table></div>`;
}
function recordAnnulled(c,id){let row=find(c,id);if(c==='observaciones'){row=find('documentos',row.documentId);c='documentos';}if(c==='documentos'){row=find('lotes',row.loteId);c='lotes';}if(c==='lotes'){row=find('remisiones',row.remisionId);c='remisiones';}return c==='remisiones'&&!!row?.annulment;}
const edit = (c, id) =>
  (canManage(c)&&!recordAnnulled(c,id)?`<button class="link" data-edit="${c}" data-id="${esc(id)}">Editar ↗</button>`:'')+contextLink(c,id);
const childEntity={gerencias:'cacs',cacs:'remisiones',remisiones:'lotes',lotes:'documentos',documentos:'observaciones'};
let contextFilter=null;
function contextLink(entity,id){const child=childEntity[entity];return child&&(!cloudMode()||visibleModule(cloud.profile,child))?` <button class="link" data-related="${entity}" data-id="${esc(id)}">Ver ${esc(pages.find(p=>p[0]===child)[2])} →</button>`:'';}
function openRelated(entity,id){
 const row=find(entity,id);if(!row)return;
 const child=childEntity[entity];if(cloudMode()&&!visibleModule(cloud.profile,child))return;
 const gerenciaId=gerenciaFor(entity,row);f.gerencia=gerenciaId;
 if(entity==='gerencias')f.cac='';
 else if(entity==='cacs')f.cac=id;
 else {let rem=entity==='remisiones'?row:find('remisiones',entity==='lotes'?row.remisionId:find('lotes',row.loteId).remisionId);f={...f,year:rem.year,month:rem.month,half:String(rem.half),cac:rem.cacId};}
 for(const key of ['remission','reconciliation','verification','observation','deadline'])f[key]='';
 contextFilter={entity,id,child};navigate(routeFor(child));
}
function lotRows(lots) {
  const counts=new Map();for(const d of db.documentos)counts.set(d.loteId,(counts.get(d.loteId)||0)+1);
  return orderLots(lots,db).map((l) => {
    const r = find("remisiones", l.remisionId),
      n = lotReconciliation(db,l).registered,
      diff = n - l.declared;
    return [
      `<strong>${esc(l.code)}</strong>`,
      esc(name("cacs", r.cacId)),
      esc(period(r)),
      l.declared,
      `${n}<small> · ${counts.get(l.id)||0} doc individuales</small>`,
      badge(
        diff === 0 ? "Conciliado" : `${diff > 0 ? "+" : ""}${diff} documentos`,
        diff === 0 ? "ok" : "warn",
      ),
      edit("lotes", l.id)+(cloud?.spark?`<p>${esc(lotVerificationLabel(db,l))}</p><button class="link" data-verify-lot="${esc(l.id)}">Conciliar y verificar lote</button>`:""),
    ];
  });
}
function groupedLots(lots) {
  if (!lots.length) return '<p>No hay lotes para esta selección.</p>';
  const remisiones = new Map(db.remisiones.map(r => [r.id, r]));
  const cacs = new Map(db.cacs.map(c => [c.id, c]));
  const levels = [
    l => {const c=cacs.get(remisiones.get(l.remisionId)?.cacId);return [c?.gerenciaId || '', name('gerencias',c?.gerenciaId) || 'Sin gerencia'];},
    l => {const r=remisiones.get(l.remisionId);return [String(r?.year || ''), String(r?.year || 'Sin año')];},
    l => {const r=remisiones.get(l.remisionId);return [String(r?.month).padStart(2,'0')+'-'+r?.half, period(r || {})];},
    l => {const r=remisiones.get(l.remisionId);return [r?.cacId || '', name('cacs',r?.cacId) || 'Sin CAC'];}
  ];
  function renderGroups(items, depth) {
    if(depth===levels.length) return table(["Lote", "CAC / dependencia", "Período", "Declarados", "Individualizados", "Conciliación", ""],lotRows(items));
    const groups=new Map();
    for(const lot of items){const [key,label]=levels[depth](lot);if(!groups.has(key))groups.set(key,{label,items:[]});groups.get(key).items.push(lot);}
    return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'es',{numeric:true})).map(([,g])=>`<details class="lot-group"><summary>${esc(g.label)} <small>${g.items.length} ${g.items.length===1?'lote':'lotes'} · ${g.items.reduce((sum,l)=>sum+l.declared,0)} declarados</small></summary><div class="lot-group-content">${renderGroups(g.items,depth+1)}</div></details>`).join('');
  }
  return renderGroups(lots,0);
}
let intelligenceLevel="executive";
function dashboard() {
 if(cloud?.profile?.role==='asistente')return intelligencePanel(db,f,'operational','asistente');
 return intelligenceLevel==='legacy'
 ? '<button id="intel-modern" class="secondary">Volver a Inteligencia Documental</button><p>Vista histórica: métricas del modelo de individualización completa.</p>'+legacyDashboard()
 : intelligencePanel(db,f,intelligenceLevel)+'<button id="intel-legacy" class="secondary">Consultar indicadores del modelo histórico</button>'; }
function legacyDashboard() {
  const m = metrics(db, f);
  const cards = [
    ["Gerencias involucradas", m.gerencias, "Ámbito seleccionado"],
    ["CAC involucrados", m.cacs.length, "Dependencias del ámbito"],
    ["Remisiones registradas", m.registered, `${m.pendingRem} pendientes`],
    ["Documentos declarados", m.declared, "Según los lotes recibidos"],
    ["Individualizados", m.individual, "Con registro individual"],
    ["Total revisado", m.reviewed, "Incluye los observados"],
    ["Pendientes de verificación", m.pending, "Individualizados sin revisar"],
    ["Documentos observados", m.observed, "Incluye regularizados"],
    ["Documentos faltantes", m.missing, "Declarados sin individualizar"],
    ["Lotes con diferencias", m.differences, "Requieren conciliación"],
    ["Verificados correctamente",m.verified,"Sin observaciones"],
    ["Remisiones esperadas",m.expected,"Base del período: CAC activos e históricos"],
    ["Remisiones pendientes",m.pendingRem,"Sin registro"],
    ["Lotes registrados",m.lots.length,"En la selección"],
    ["Lotes conciliados",m.reconciled,"Cantidades coincidentes"],
    ["Observaciones abiertas",m.open,"Pendientes"],
    ["Observaciones en proceso",m.inProgress,"En regularización"],
    ["Observaciones regularizadas",m.regularized,"Conservan su trazabilidad"],
    ["Remisiones próximas a vencer",m.dueSoon,"Hoy y próximos 5 días calendario"],
    ["Remisiones vencidas",m.overdue,"Según vencimiento registrado"],
  ];
  return `<div class="section-line"><div><h2>Resumen del período</h2><p>Una visión integral de la recepción y revisión documental.</p></div>${cloudMode()?"":badge("Actualizado con datos locales", "neutral")}</div><div class="stats">${cards.map(([label, n, sub], i) => `<article class="stat ${i === 3 ? "featured" : ""}"><button class="link" data-indicator="${i}">Ver detalle →</button><span>${label}</span><strong>${n}</strong><small>${sub}</small></article>`).join("")}</div><div class="progress-card"><div><span class="eyebrow">AVANCE DOCUMENTAL</span><h2>${m.progress === null ? "Sin documentos para verificar" : `${m.progress.toFixed(1)} % revisado`}</h2><p>${m.reviewed} de ${m.individual} documentos individualizados · Los faltantes se informan por separado.</p></div><div class="progress-track"><div style="width:${m.progress ?? 0}%"></div></div></div><section class="panel"><div class="section-line"><div><h2>Control de lotes</h2><p>Cantidad declarada frente a documentos individualizados · Las anuladas solo se incluyen al seleccionarlas en el filtro administrativo</p></div>${!cloudMode() || visibleModule(cloud.profile,"lotes") ? '<button data-nav="lotes" class="secondary">Ver lotes →</button>' : ""}</div>${groupedLots(m.lots)}</section>${cloud?.spark?lotDashboard(cloudContext()):''}`;
}
function showIntelligenceRecord(entity,id){
 const record=db[entity]?.find(r=>r.id===id);if(!record)return;
 const modal=$('#modal');
 const labels={code:'Lote',number:'Número',type:'Tipo documental',declared:'Cantidad declarada',expediente:'Expediente',receivedOn:'Recepción',remittedOn:'Remisión',dueOn:'Vencimiento de control',calendarVersion:'Calendario',year:'Año',month:'Mes',half:'Quincena',state:'Verificación',description:'Descripción',date:'Fecha',owner:'Responsable',status:'Regularización',regularizedOn:'Fecha de regularización'};
 const children={remisiones:['lotes','remisionId'],lotes:['documentos','loteId'],documentos:['observaciones','documentId']}[entity];
 const rows=children?db[children[0]].filter(r=>r[children[1]]===id):[];
 modal.innerHTML=`<div class="intel-dialog"><h2>${esc(pages.find(p=>p[0]===entity)?.[2]||entity)}</h2>${table(['Campo','Valor'],Object.entries(labels).filter(([key])=>record[key]!==undefined).map(([key,label])=>[label,esc(record[key])]))}${children?`<h3>Registros vinculados</h3>${table(['Registro','Detalle'],rows.map(r=>[esc(r.code||r.number||r.description||r.id),`<button class="link" data-intel-child="${children[0]}" data-id="${esc(r.id)}">Consultar →</button>`]))}`:''}<button id="intel-record-close" class="secondary">Cerrar</button></div>`;
 if(!modal.open)modal.showModal();
 modal.querySelector('#intel-record-close').onclick=()=>modal.close();
 modal.querySelectorAll('[data-intel-child]').forEach(b=>b.onclick=()=>showIntelligenceRecord(b.dataset.intelChild,b.dataset.id));
}

function collectionView() {
  const s = scope(db, f);
  if(contextFilter?.child===page){const {entity,id}=contextFilter;
   if(entity==='remisiones')s.lots=s.lots.filter(l=>l.remisionId===id);
   if(entity==='lotes')s.docs=s.docs.filter(d=>d.loteId===id);
   if(entity==='documentos')s.docs=s.docs.filter(d=>d.id===id);
  }
  let rows = [],
    headers = [],
    collection = page;
  if (page === "gerencias") {
    headers = ["Gerencia", "Responsable 1", "Responsable 2", "CAC asociados", ""];
    rows = db.gerencias
      .filter((g) => !f.gerencia || g.id === f.gerencia)
      .map((g) => [
        esc(g.name),
        ...[0,1].map(i=>{const c=g.responsables?.[i];return c?`${esc(c.nombre)} · ${esc(c.cargo)}<br>${esc(c.correo)}<br>Interno: ${esc(c.interno)} · Celular: ${esc(c.celular)}`:'Pendiente de completar';}),
        db.cacs.filter((c) => c.gerenciaId === g.id).length,
        edit(page, g.id),
      ]);
  }
  if (page === "cacs") {
    headers = ["CAC / dependencia", "Gerencia", "Contacto", "Estado", ""];
    rows = s.cacs.map((c) => [
      esc(c.name),
      esc(name("gerencias", c.gerenciaId)),
      c.contacto ? [c.contacto.nombre,c.contacto.cargo,c.contacto.correo,`Interno: ${c.contacto.interno}`,`Celular: ${c.contacto.celular}`].map(esc).join("<br>") : "Pendiente de completar",
      c.active === false ? "Inactivo" : "Activo",
      edit(page, c.id) + (cloudMode() && manageCacStatus(cloud.profile) ? `<button class="link" data-cac-status="${esc(c.id)}">${c.active === false ? "Activar" : "Deshabilitar"}</button>` : ""),
    ]);
  }
  if (page === "remisiones") {
    headers = ["CAC / dependencia", "Período", "Expediente", "Fecha de remisión", "Recepción", "Vencimiento", "Lotes", "Registro", ""];
    rows = s.rem.map((r) => [
      esc(name("cacs", r.cacId)),
      esc(period(r)),
      esc(r.expediente ?? "—"), esc(r.remittedOn ?? "—"), esc(r.receivedOn ?? "—"), esc(r.dueOn ?? "—"),
      db.lotes.filter((l) => l.remisionId === r.id).length,
      badge(r.annulment ? "Anulada" : "Registrada", r.annulment ? "warn" : "ok"),
      edit(page, r.id),
    ]);
    for (const pending of s.pendingRows)
        { const c=find("cacs",pending.cacId),half=pending.half;
          rows.push([
            esc(c.name),
            esc(period({ year: +f.year, month: +f.month, half })),
            "—", "—", "—", "—",
            0,
            badge("Pendiente", "warn"),
            canManage("remisiones") && c.active !== false ? `<button class="link" data-register-remision="${esc(c.id)}" data-half="${half}">Registrar remisión ↗</button>` : "—",
          ]); }
  }
  if (page === "lotes") {
    headers = [
      "Lote",
      "CAC / dependencia",
      "Período",
      "Declarados",
      "Registrados / Individualizados",
      "Conciliación",
      "",
    ];
    rows = lotRows(s.lots);
  }
  if (page === "documentos") {
    headers=['Documento','Tipo','Lote','Verificación','Cantidad verificada','Observaciones','Fecha de observación','Regularización','Responsable','Acciones'];
    rows=s.docs.map(d=>{
      const observations=db.observaciones.filter(o=>o.documentId===d.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),last=observations[0];
      const add=canManage('observaciones')&&!recordAnnulled('documentos',d.id)?` <button class="secondary" data-add-document-observation="${esc(d.id)}">Agregar observación</button>`:'';
      return [esc(d.number),esc(d.type),esc(find('lotes',d.loteId).code),badge(d.state,d.state==='Verificado'?'ok':'warn'),d.state==='Pendiente'?'—':'1 documento revisado',observations.length,esc(last?.date||'—'),esc(last?.status||'Sin observaciones'),esc(last?.owner||'—'),edit(page,d.id)+add];
    });
    for(const lot of s.lots){
      const {review}=lotReconciliation(db,lot);if(!review||f.verification&&review.result!==f.verification)continue;
      const person=db.users?.find(u=>u.id===review.actor)||(cloud?.profile?.id===review.actor?cloud.profile:null);
      rows.push(['Verificación total del lote',esc(lot.typeCode||sortedTypes(db.catalog).find(t=>t.id===lot.typeId)?.code||'Lote'),esc(lot.code),badge(review.result,review.result==='Verificado'?'ok':'warn'),review.result==='Verificado'?`${review.registered} documentos`:'Revisión con diferencias',review.openObservations,'—','No aplica',esc(person?.description||'Responsable de revisión'),`<button class="link" data-verify-lot="${esc(lot.id)}">Consultar revisión e historial</button>`]);
    }
    rows.sort((a,b)=>a[2].localeCompare(b[2],'es',{numeric:true})||a[1].localeCompare(b[1],'es')||a[3].localeCompare(b[3],'es'));
  }
  if (page === "observaciones") {
    headers = [
      "Documento",
      "Descripción",
      "Fecha",
      "Responsable",
      "Regularización",
      "",
    ];
    const ids = new Set(s.docs.map((d) => d.id));
    rows = db.observaciones
      .filter((o) => ids.has(o.documentId) && (!f.observation || o.status===f.observation))
      .map((o) => [
        esc(find("documentos", o.documentId).number),
        esc(o.description),
        esc(o.date),
        esc(o.owner),
        badge(o.status, o.status === "Regularizada" ? "ok" : "warn"),
        edit(page, o.id),
      ]);
  }
  const filtered = rows.filter((r) =>
    r.join(" ").toLowerCase().includes(esc(query.toLowerCase())),
  );
  let tableMarkup=table(headers,filtered);
  if(page==='documentos'){
    const groups=new Map();for(const row of filtered){const key=JSON.stringify([row[2],row[1]]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    tableMarkup=[...groups.values()].map(group=>{
      const individual=group.filter(row=>row[0]!=='Verificación total del lote'),review=group.find(row=>row[0]==='Verificación total del lote');
      const states=new Map();for(const row of individual)states.set(row[3],(states.get(row[3])||0)+1);
      const summary=[...states].map(([state,count])=>`${state} · ${count}`).join(' · ');
      const lot=db.lotes.find(l=>esc(l.code)===group[0][2]);
      const type=sortedTypes(db.catalog).find(t=>t.id===lot?.typeId||esc(t.code)===group[0][1]);
      const title=esc(type?.description||'Descripción del tipo documental no disponible');
      return `<details class="document-group"><summary><strong>${title}</strong> · ${individual.length} ${individual.length===1?'documento individualizado':'documentos individualizados'}${review?` · Cantidad verificada del lote: ${review[4]}`:''}${summary?` <span class="document-group-states">${summary}</span>`:''}${review?` <span class="document-group-states">Estado del lote: ${review[3]}</span>`:''}</summary>${table(headers,group)}<p class="footnote">La verificación total y los documentos individualizados no se suman.</p></details>`;
    }).join('')||'<p>Sin documentos para esta selección.</p>';
  }
  return `<section class="panel">${contextFilter?.child===page?'<p>Mostrando registros vinculados. <button id="clear-context" class="link">Ver todos los registros del período</button></p>':""}<div class="section-line"><div><h2>${pages.find((p) => p[0] === page)[2]}</h2><p>${page === "gerencias" || page === "cacs" ? "Catálogo institucional · independiente del período" : "Registros del período y ámbito seleccionados"}</p></div>${creationActions(collection,canManage(collection),cloud?.spark)}</div><input class="search" id="search" placeholder="Buscar en esta tabla…" value="${esc(query)}" aria-label="Buscar en la tabla">${tableMarkup}<p class="footnote">${filtered.length} resultados · ${cloudMode()?"":"Cambios guardados únicamente en este navegador."}</p></section>${page==='remisiones'&&cloudMode()?annulPanel({...cloudContext(),render}):''}`;
}
function history() {
  const keys = [
    ...new Set(db.remisiones.map((r) => `${r.year}-${r.month}-${r.half}`)),
  ].sort((a, b) => {
    const x = a.split("-").map(Number),
      y = b.split("-").map(Number);
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  });
  return `<section class="panel"><h2>Períodos registrados</h2><p>Consulta todos los períodos guardados, respetando los filtros de gerencia y CAC. Use Estado administrativo para incluir anuladas; sus documentos se conservan.</p>${table(
    ["Período", "Remisiones", "Declarados", "Individualizados", "Avance", ""],
    keys.map((k) => {
      const [year, month, half] = k.split("-").map(Number),
        m = metrics(db, { ...f, year, month, half });
      return [
        esc(period({ year, month, half })),
        m.registered,
        m.declared,
        m.individual,
        m.progress === null
          ? "Sin documentos para verificar"
          : m.progress.toFixed(1) + " %",
        `<button class="link" data-period="${k}">Consultar →</button>`,
      ];
    }),
  )}</section>`;
}
function audit() {
  return `<section class="panel"><h2>${cloudMode()?"Auditoría del servidor":"Trazabilidad local"}</h2><p>${cloudMode()?"Identidad autenticada y cambios registrados por transacciones del servidor.":"Registro informativo de cambios. No es una auditoría segura ni acredita identidad."}</p>${table(
    ["Fecha y hora", "Responsable", "Entidad", "Cambio"],
    [...db.audit]
      .reverse()
      .map((a) => [
        esc(new Date(a.at).toLocaleString("es-AR")),
        esc(a.actor),
        esc(a.collection),
        `<details><summary>${a.before ? "Modificación" : "Alta"} · ${esc(a.recordId)}</summary><pre>${esc(JSON.stringify({ antes: a.before, despues: a.after, cambioVinculado: a.relatedChange ?? null, motivo: a.reason ?? null, autorizacion: a.authorization ?? null }, null, 2))}</pre></details>`,
      ]),
  )}</section>`;
}
let functionId='list',routeReady=false,formBaseline='[]';
const formSnapshot=()=>JSON.stringify([...document.querySelectorAll('.content form input,.content form textarea,.content form select')].map(el=>[el.name,el.type==='file'?[...el.files].map(f=>f.name):el.type==='checkbox'?el.checked:el.value]));
const navigationContext=()=>({mode,profile:cloud?.profile,spark:!!cloud?.spark});
function navigate(hash,fromHistory=false){
 const modal=$('#modal');
 const dirty=formSnapshot()!==formBaseline;
 if(modal.open||dirty){if(!confirm('Hay un formulario abierto o cambios sin guardar. ¿Desea salir de esta pantalla?')){window.history.replaceState(null,'',routeFor(page,functionId));return;}modal.close();}
 const route=resolveRoute(hash,navigationContext());
 page=route.page;functionId=route.functionId;query='';
 if(!fromHistory)window.history.pushState(null,'',routeFor(page,functionId));
 else if(route.error)window.history.replaceState(null,'',routeFor(page,functionId));
 render();
 if(route.error){updateNotice(route.error,true);return;}
 activateNavigationFunction(route.fn);
}
function activateNavigationFunction(fn){
 if(cloudMode()&&db&&!db.administrationLoaded&&['access','gerencias','cacs','catalog'].includes(page)){pendingNavigationFunction={fn,page,functionId};return;}
 if(fn?.noSpark&&cloud?.spark){updateNotice('Esta función aún no está disponible en Spark.',true);return;}
 if(fn?.action==='new')form(page);
 else if(fn?.action==='generate')generateRemisiones();
 else if(fn?.report){const select=$('#report-type');if(select){select.value=fn.report;select.dispatchEvent(new Event('change'));}}
 else if(fn?.target){const target=$(fn.target);if(target){for(let node=target;node;node=node.parentElement){if(node.tagName==='DETAILS')node.open=true;}target.scrollIntoView({block:'start',behavior:'auto'});if(fn.click)target.click();else{target.setAttribute('tabindex','-1');target.focus();}}}
}
window.addEventListener('hashchange',()=>{if(db)navigate(location.hash,true)});

function hidePrivateShell(){
  filterSession.clear();f=initialFilters();
  $('#app').inert=false;
  $('#sync-status')?.remove();db=null;document.body.classList.remove('nav-open');$('#modal').close();
  const note=document.querySelector('.publication-note');if(note)note.hidden=true;
}
let administrationPending=null,pendingNavigationFunction=null;
function render() {
  if(!cloud?.auth.currentUser||!cloud.profile?.active){loginView();return;}
  const note=document.querySelector('.publication-note');if(note)note.hidden=false;

  if(!routeReady){const route=resolveRoute(location.hash,navigationContext());page=route.page;functionId=route.functionId;routeReady=true;window.history.replaceState(null,'',routeFor(page,functionId));if(route.error)setTimeout(()=>updateNotice(route.error,true),0);else if(route.fn&&!route.fn.click)setTimeout(()=>activateNavigationFunction(route.fn),0);}

  if(resolveRoute(routeFor(page,functionId),navigationContext()).error){page="dashboard";functionId="list";window.history.replaceState(null,"",routeFor(page));}
  if(cloudMode()&&db&&!db.administrationLoaded&&['access','gerencias','cacs','catalog'].includes(page)){
    if(!administrationPending){
      const target=db,token=epoch;showSyncStatus();
      administrationPending=cloud.loadAdministration(target).then(()=>{administrationPending=null;if(token===epoch){$('#sync-status')?.remove();render();}}).catch(error=>{administrationPending=null;if(token===epoch){$('#sync-status')?.remove();updateNotice(error.message,true);}});
    }
    return;
  }
  if(pendingNavigationFunction){const pending=pendingNavigationFunction;pendingNavigationFunction=null;if(pending.page===page&&pending.functionId===functionId)setTimeout(()=>activateNavigationFunction(pending.fn),0);}
  filterSession.save(f);
  const current = pages.find((p) => p[0] === page);
  $("#app").innerHTML =
    `${navigationMarkup(page,functionId,navigationContext())}<main><header><button id="nav-mobile" aria-label="Abrir menú" aria-controls="institution-nav" aria-expanded="false">☰</button><div class="header-heading"><strong>CONTROL DOCUMENTO — CAH</strong><div class="breadcrumb"><button class="link" data-route="#/dashboard">Inicio</button>${page!=="dashboard"?` / ${esc(breadcrumb(page,functionId))}`:""}</div></div><div class="header-account">${cloudMode()?`<div class="session-bar header-session"><span>${esc(cloud.auth.currentUser.email)} · ${esc(({technical:"Administrador",director:"Director",gerente:"Gerente",asistente:"Asistente"})[cloud.profile.role]||cloud.profile.role)}</span><button id="refresh-cloud" class="secondary">Actualizar</button><button id="logout" class="secondary">Cerrar sesión</button></div>`:""}<div class="local-chip">${cloudMode()?(cloud.emulator?"◉ Emulador":"◉ Conectado") : "◉ Almacenamiento local"}</div></div></header><div class="content"><div class="title-row"><div>${page==='dashboard'?'':'<span class="eyebrow">SISTEMA DE CONTROL DOCUMENTAL</span>'}<h1>${current[2]}</h1>${page==='dashboard'?'':'<p>Seguimiento quincenal · Dirección de Operaciones</p>'}</div>${cloud?.profile?.role==="technical"?`<label class="mode-label">Espacio de trabajo<select id="mode"><option value="demo" ${mode === "demo" ? "selected" : ""}>Demostración</option><option value="local" ${mode === "local" ? "selected" : ""}>Mis registros locales</option><option value="cloud" ${cloudMode()?"selected":""}>Firebase institucional</option></select></label>`:(cloudMode()?"":'<button id="open-institutional" class="secondary">Acceder al sistema</button>')}</div>${mode==="local"?`<div class="session-bar"><button id="export-local" class="secondary">Descargar respaldo para migración</button></div>`:""}${cloudMode()?"":`<div class="notice">${mode==="demo"?"<strong>Datos ficticios.</strong> Espacio de demostración separado.":"<strong>Mis registros locales.</strong> Guardados en este navegador."} Sin sincronización multiusuario.</div>`}${!["audit","access","migration","catalog","observationCatalog"].includes(page) ? filters() : ""}${page === "observationCatalog" ? observationCatalogPanel(cloudContext()) : page === "catalog" ? catalogPanel(cloudContext()) : page === "dashboard" ? dashboard() : page === "history" ? history() : ["audit","reports","bulk"].includes(page) ? phase3Panel(page,phase3Context()) : ["access","deadlines","migration"].includes(page)?cloudPanel(page,cloudContext()):collectionView()}<footer>Dirección de Operaciones </footer></div></main>`;
  bind();
  updateConnectionChip();
  installTables();
}
function bind() {
  if($('#intel-legacy'))$('#intel-legacy').onclick=()=>{intelligenceLevel='legacy';render();};
  if($('#intel-modern'))$('#intel-modern').onclick=()=>{intelligenceLevel='executive';render();};
  if(page==='dashboard')bindIntelligence({db,f,render,setLevel:value=>intelligenceLevel=value,openRecord:showIntelligenceRecord,cloud,mode});
  document.querySelectorAll('[data-verify-lot]').forEach(b=>b.onclick=()=>showLotVerification(cloudContext(),b.dataset.verifyLot));
  if(page==='catalog')bindCatalog(cloudContext());
  if($('#generate-lots'))$('#generate-lots').onclick=()=>showLotGenerator(cloudContext());
  if(page==='remisiones'&&cloudMode())bindAnnulPanel({...cloudContext(),render});
  bindNavigation(hash=>{contextFilter=null;navigate(hash)});
  formBaseline=formSnapshot();
  if($('#clear-context'))$('#clear-context').onclick=()=>{contextFilter=null;render()};
  document.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>openRelated(b.dataset.related,b.dataset.id));
  if($("#open-institutional"))$("#open-institutional").onclick=()=>{mode="cloud";sessionStorage.setItem("cdq:workspace",mode);page="dashboard";load().catch(fatal)};
  if($('#clear-filters'))$('#clear-filters').onclick=()=>{contextFilter=null;f=initialFilters();if(cloudMode()&&cloud.profile.role==='gerente')f.gerencia=cloud.profile.gerenciaId;query='';render();};
  document.querySelectorAll('[data-indicator]').forEach(b=>b.onclick=()=>indicatorDetail(+b.dataset.indicator));

  if(page==="observationCatalog")bindObservationCatalog(cloudContext());
  if(["audit","reports","bulk"].includes(page))bindPhase3(page,phase3Context());
  if($('#export-local'))$('#export-local').onclick=()=>{const blob=new Blob([JSON.stringify({source:'local-user',snapshot:db},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='control-documental-local.json';a.click();URL.revokeObjectURL(url)};
  if(cloudMode()){
    $('#logout').onclick=()=>cloud.logout();
    $('#refresh-cloud').onclick=()=>load();
    bindCloudPanel(page,cloudContext());
  }
  if($("#generate-remisiones"))$("#generate-remisiones").onclick=generateRemisiones;
  document.querySelectorAll("[data-register-remision]").forEach(el => el.onclick=()=>form("remisiones",null,{cacId:el.dataset.registerRemision,year:+f.year,month:+f.month,half:+el.dataset.half}));
  document.querySelectorAll("[data-cac-status]").forEach(el => el.onclick=()=>toggleCac(el.dataset.cacStatus));
  document.querySelectorAll("[data-nav]").forEach(
    (b) =>
      (b.onclick = () => {
        navigate(routeFor(b.dataset.nav));
      }),
  );
  groupModuleFilters();
  document.querySelectorAll("[data-filter]").forEach(
    (el) =>
      (el.onchange = () => {
        f[el.dataset.filter] = el.value;
        if (el.dataset.filter === "gerencia") f.cac = "";
        render();
      }),
  );
  if($("#mode")) $("#mode").onchange = async (e) => {
    mode = e.target.value;
    sessionStorage.setItem("cdq:workspace",mode);
    page="dashboard"; functionId="list";window.history.replaceState(null,"",routeFor(page));f.gerencia=""; f.cac="";
    query = "";
    try {
      await load();
    } catch (e) {
      fatal(e);
    }
  };
  document
    .querySelectorAll("[data-new]")
    .forEach((b) => (b.onclick = () => form(b.dataset.new)));
  document.querySelectorAll('[data-add-document-observation]').forEach(b=>b.onclick=()=>form('observaciones',null,{documentId:b.dataset.addDocumentObservation}));
  document
    .querySelectorAll("[data-edit]")
    .forEach((b) => (b.onclick = () => form(b.dataset.edit, b.dataset.id)));
  document.querySelectorAll("[data-period]").forEach(
    (b) =>
      (b.onclick = () => {
        const [year, month, half] = b.dataset.period.split("-");
        f = { ...f, year, month, half };
        navigate(routeFor("dashboard"));
      }),
  );
  if ($("#search"))
    $("#search").oninput = (e) => {
      const start = e.target.selectionStart;
      query = e.target.value;
      render();
      $("#search").focus();
      $("#search").setSelectionRange(start, start);
    };
}
async function toggleCac(id) {
 const c=find('cacs',id);
 const reason=prompt('Motivo del cambio de estado del CAC:');
 if(!reason?.trim())return;
 try {await cloud.call('setCacActive',{gerenciaId:c.gerenciaId,id,active:c.active===false,expectedRevision:c.revision,reason});await load();}
 catch(e){alert(e.message);}
}
function generateRemisiones() {
 if(!f.gerencia || !f.year || !f.month || !f.half){updateNotice('Seleccione gerencia, año, mes y quincena antes de generar.',true);return;}
 const cacs=db.cacs.filter(c=>c.gerenciaId===f.gerencia && c.active!==false);
 const gerenciaId=f.gerencia,year=+f.year,month=+f.month,half=+f.half;
 $('#modal').innerHTML=`<form id="generate-form"><h2>Generar remisiones de ${esc(name('gerencias',gerenciaId))}</h2><p>${esc(period({year,month,half}))} · ${cacs.length} CAC activos. Se omiten remisiones existentes. Los siguientes datos se aplican a cada remisión nueva de esta gerencia, independientemente del filtro de CAC.</p><div class="form-fields"><label>Número de expediente<input name="expediente" required maxlength="150"></label><label>Fecha de remisión<input name="remittedOn" type="date" required></label><label>Fecha de recepción<input name="receivedOn" type="date" required></label></div><p>Se registra cada CAC por separado. Si hay un error, se informa el resultado y puede reintentar sin duplicar los registros guardados.</p><p id="generation-result" role="status"></p><div class="form-actions"><button type="button" id="generation-close">Cerrar</button><button class="primary">Generar pendientes</button></div></form>`;
 $('#generation-close').onclick=()=>$('#modal').close();
 $('#generate-form').onsubmit=async e=>{
  e.preventDefault();e.submitter.disabled=true;$('#generation-close').disabled=true;
  try {
   const result=await cloud.call('generateRemisiones',{...Object.fromEntries(new FormData(e.target)),gerenciaId,year,month,half});
   for(const row of result.created){const i=db.remisiones.findIndex(r=>r.id===row.id);if(i<0)db.remisiones.push(row);else db.remisiones[i]=row;}
   for(const c of result.controls||[]){db.remisionControls??=[];const i=db.remisionControls.findIndex(x=>x.id===c.id);if(i<0)db.remisionControls.push(c);else db.remisionControls[i]=c;}
   render();
   $('#generation-result').textContent=`Registradas: ${result.created.length}. Existentes: ${result.skipped.length}. Errores: ${result.failed.length}. `+result.failed.map(x=>x.name+': '+x.error).join(' | ');
   if(!result.failed.length)updateNotice('Actualización realizada');
  }catch(error){$('#generation-result').textContent=error.message;}
  finally{e.submitter.disabled=false;$('#generation-close').disabled=false;}
 };
 $('#modal').showModal();
}
function form(c, id, defaults = {}) {
  if(!canManage(c)||id&&recordAnnulled(c,id))return;
  if(c==='lotes'&&!id&&cloud?.spark){showLotGenerator(cloudContext());return;}
  if(!id){
    defaults={year:+f.year,month:+f.month,half:f.half?+f.half:'',gerenciaId:f.gerencia||'',cacId:f.cac||'',...defaults};
    if(c==='documentos'&&!defaults.loteId){
      const candidates=metrics(db,f).lots.filter(l=>!recordAnnulled('lotes',l.id));
      if(candidates.length===1)defaults.loteId=candidates[0].id;
    }
  }
  const row = id ? find(c, id) : defaults,
    field = (key, label, type = "text", value = row[key] ?? "") =>
      `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" required ${type === "number" ? 'min="0" step="1"' : ""} maxlength="${key === "description" ? 2000 : 150}"></label>`,
    pick = (key, label, rows, labeler, selected = row[key] ?? "") =>
      `<label>${label}<select name="${key}" required><option value="">Seleccionar…</option>${options(rows, (r) => r.id, labeler, selected)}</select></label>`;
  let registrationDraft=null;
  let fields = "";
  if (c === "gerencias" || c === "cacs") fields += field("name", "Nombre");
  if(c === "gerencias"){
    fields+='<p>Dos contactos responsables de la gerencia. Registrar estos datos no crea cuentas ni concede permisos de acceso.</p>';
    for(let i=0;i<2;i++){
      fields+=`<fieldset><legend>Responsable ${i+1}</legend>`;
      for(const [key,label,type] of [['nombre','Nombre','text'],['cargo','Cargo','text'],['correo','Correo','email'],['interno','Interno','tel'],['celular','Celular','tel']])
        fields+=field(`contact_${i}_${key}`,label,type,row.responsables?.[i]?.[key]??'');
      fields+='</fieldset>';
    }
  }
  if (c === "cacs") {
    fields += pick("gerenciaId", "Gerencia", db.gerencias, (r) => r.name);
    fields += '<p id="cac-assigned-users" role="status"></p><fieldset><legend>Contacto del CAC</legend>';
    for(const [key,label,type] of [['nombre','Nombre','text'],['cargo','Cargo','text'],['correo','Correo','email'],['interno','Interno','tel'],['celular','Celular','tel']])
      fields+=field(`cac_${key}`,label,type,row.contacto?.[key]??'');
    fields+='</fieldset>';
  }
  if (c === "remisiones")
    fields +=
      pick(
        "cacId",
        "CAC / dependencia",
        db.cacs.filter(c => c.active !== false || c.id === row.cacId),
        (r) => r.name,
        row.cacId || f.cac,
      ) +
      field("year", "Año", "number", row.year ?? f.year) +
      pick(
        "month",
        "Mes",
        months.map((name, i) => ({ id: i + 1, name })),
        (r) => r.name,
        row.month ?? f.month,
      ) +
      pick(
        "half",
        "Quincena",
        [
          { id: 1, name: "Primera" },
          { id: 2, name: "Segunda" },
        ],
        (r) => r.name,
        row.half ?? f.half,
      );
  if(c==="remisiones")fields+=field("expediente","Número de expediente")+field("remittedOn","Fecha de remisión","date");
  if(c==="remisiones"&&cloudMode())fields+=field("receivedOn","Fecha de recepción (Paraguay)","date");
  if (c === "lotes")
    fields +=
      pick(
        "remisionId",
        "Remisión · CAC y período",
        db.remisiones.filter(r=>!r.annulment),
        (r) => `${name("cacs", r.cacId)} · ${period(r)}`,
      ) +
      field("code", "Identificador del lote") +
      field("declared", "Cantidad declarada", "number");
  if (c === "documentos")
    fields +=
      (cloud?.spark&&db.catalog?pick("type", "Tipo de documento",sortedTypes(db.catalog).filter(t=>t.enabled||t.code===row.type).map(t=>({id:t.code,name:t.code+' · '+t.description})).concat(row.type&&!sortedTypes(db.catalog).some(t=>t.code===row.type)?[{id:row.type,name:row.type+' · Histórico'}]:[]),t=>t.name):field("type", "Tipo de documento")) +
      pick("loteId", "Lote · CAC y período", db.lotes.filter(l=>!recordAnnulled('lotes',l.id)&&(id||l.id===row.loteId||metrics(db,f).lots.some(x=>x.id===l.id))), (l) => {
        const r = find("remisiones", l.remisionId);
        return `${l.code} · ${name("cacs", r.cacId)} · ${period(r)}`;
      }) +
      field("number", "Número de documento") +
      pick(
        "state",
        "Estado de verificación",
        states.map((s) => ({ id: s, name: s })),
        (r) => r.name,
        "Pendiente",
      ) +
      (cloud?.spark&&!id?'<fieldset><legend>Observación del documento</legend><label>Descripción del catálogo<select name="inlineDescription"><option value="">Sin observación</option>'+observationCatalog(db.observaciones,db.observationCatalog).filter(t=>t.active).map(t=>'<option value="'+esc(t.description)+'">'+esc(t.description)+'</option>').join('')+'</select></label><label>Fecha<input name="inlineDate" type="date" value="'+new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion'}).format(new Date())+'"></label><label>Responsable<input name="inlineOwner" readonly value="'+esc(cloud.profile?.description?.trim()||'')+'" placeholder="Complete la descripción en Usuarios y permisos"></label><label>Regularización<select name="inlineStatus"><option>Pendiente</option><option>En proceso</option><option>Regularizada</option></select></label></fieldset>':'');
  if (c === "observaciones")
    fields +=
      pick(
        "documentId",
        "Documento",
        db.documentos.filter(d=>!recordAnnulled('documentos',d.id)),
        (d) => `${d.type} ${d.number} · ${find("lotes", d.loteId).code}`,
      ) +
      (cloudMode()?'<label>Descripción del catálogo<select name="description" required><option value="">Seleccione una descripción</option>'+observationCatalog(db.observaciones,db.observationCatalog).filter(t=>t.active).map(t=>'<option value="'+esc(t.description)+'" '+(t.description===row.description?'selected':'')+'>'+esc(t.description)+'</option>').join('')+(id&&!observationCatalog(db.observaciones,db.observationCatalog).some(t=>t.active&&t.description===row.description)?'<option selected value="'+esc(row.description)+'">'+esc(row.description)+' · Texto histórico</option>':'')+'</select></label>':field("description", "Descripción")) +
      field(
        "date",
        "Fecha",
        "date",
        row.date ??
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
      ) +
      field("owner", "Responsable de la observación", "text", row.owner ?? (db.users?.find(u=>u.id===cloud?.auth?.currentUser?.uid)?.description?.trim() || cloud?.profile?.description?.trim() || "")) +
      pick(
        "status",
        "Regularización",
        [{ id: "Pendiente" }, { id: "En proceso" }, { id: "Regularizada" }],
        (r) => r.id,
        row.status ?? "Pendiente",
      );
  $("#modal").innerHTML =
    `<form id="record-form"><div class="section-line"><h2>${id ? "Editar" : "Nuevo"} registro</h2><button type="button" id="close" aria-label="Cerrar">✕</button></div><p>${pages.find((p) => p[0] === c)[2]} · ${cloudMode()?"Firebase institucional":mode === "demo" ? "Demostración" : "Mis registros locales"}</p><div class="form-fields">${fields}${cloudMode()?"<p>Responsable: identidad de la sesión autenticada.</p>":field("actor", "Responsable de este registro")}</div><p id="form-error" role="alert"></p><div class="form-actions"><button type="button" id="cancel" class="secondary">Cancelar</button><button class="primary" type="submit">Guardar registro</button></div></form>`;
  if(c==='lotes'&&row.typeId){$('#record-form').elements.code.readOnly=true;$('#record-form').elements.remisionId.disabled=true;}
  if(c==='documentos'){
    const form=$('#record-form'),lotSelect=form.elements.loteId,typeSelect=form.elements.type;
    const available=db.lotes.filter(l=>!recordAnnulled('lotes',l.id)&&(id?l.id===row.loteId:metrics(db,f).lots.some(x=>x.id===l.id)||l.id===row.loteId));
    const syncLot=()=>{
      const candidates=documentLots(available,sortedTypes(db.catalog),typeSelect.value);
      const selected=selectedDocumentLot(candidates,lotSelect.value);
      lotSelect.innerHTML='<option value="">'+(candidates.length?'Seleccione el lote compatible':'No hay lotes compatibles con los filtros')+'</option>'+candidates.map(l=>{const r=find('remisiones',l.remisionId);return '<option value="'+esc(l.id)+'">'+esc(l.code+' · '+name('cacs',r.cacId)+' · '+period(r))+'</option>';}).join('');
      lotSelect.value=selected;
    };
    const initial=find('lotes',lotSelect.value);
    if(initial?.typeCode)typeSelect.value=initial.typeCode;
    if(initial?.typeId){const t=sortedTypes(db.catalog).find(t=>t.id===initial.typeId);if(t)typeSelect.value=t.code;}
    if(id){lotSelect.disabled=true;typeSelect.disabled=true;}else{typeSelect.addEventListener('change',syncLot);syncLot();}
  }
  $("#close").onclick = $("#cancel").onclick = () => $("#modal").close();
  if(c==='cacs'){
    const select=$('#record-form').elements.gerenciaId;
    const refreshAssigned=()=>{
      const users=assignedUsers(db.users,select.value);
      $('#cac-assigned-users').textContent=!select.value?'Seleccione una gerencia para consultar sus encargados.':users.length?'Encargados de la gerencia: '+users.map(userDescription).join(' · '):'Sin usuarios encargados asignados a esta gerencia.';
    };
    select.onchange=refreshAssigned;refreshAssigned();
  }
  $("#record-form").onsubmit = async (e) => {
    e.preventDefault();
    const submit = e.submitter;
    submit.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(e.target));
      const actor = cloudMode()?cloud.auth.currentUser.uid:data.actor.trim();
      delete data.actor;
      if(c==='lotes'&&row.typeId)data.remisionId=row.remisionId;
      if(c==='documentos'&&id){data.loteId=row.loteId;data.type=row.type;}
      for (const k in data) data[k] = data[k].trim();
      if(c==='observaciones'&&db.observaciones.some(o=>o.id!==id&&o.documentId===data.documentId&&observationKey(o.description)===observationKey(data.description)))throw Error('Este documento ya tiene esa observación.');
      if(c==='cacs'){
        data.contacto=validateContact(Object.fromEntries(['nombre','cargo','correo','interno','celular'].map(k=>{const key='cac_'+k,value=data[key];delete data[key];return [k,value];})));
      }
      if(c==='gerencias'){
        const contactos=[0,1].map(i=>Object.fromEntries(['nombre','cargo','correo','interno','celular'].map(k=>{const key=`contact_${i}_${k}`,value=data[key];delete data[key];return [k,value];})));
        data.responsables=validateResponsables(contactos);
      }
      if (c === "remisiones")
        for (const k of ["year", "month", "half"]) data[k] = Number(data[k]);
      if (c === "lotes")
        data.declared = integer(data.declared, "Cantidad declarada");
      if(cloudMode()&&cloud.spark&&c==='documentos'&&!id){
        if(!registrationDraft){
          const {inlineDescription,inlineDate,inlineOwner,inlineStatus,...documentData}=data;
          if(inlineDescription&&!cloud.profile?.description?.trim())throw Error('El usuario no tiene descripción registrada. Complétela en Usuarios y permisos.');
          registrationDraft={gerenciaId:gerenciaFor(c,documentData),row:{...documentData,id:crypto.randomUUID(),state:'Pendiente'},observation:inlineDescription?{id:crypto.randomUUID(),description:inlineDescription,date:inlineDate,status:inlineStatus}:null};
        }
        await cloud.call('registerDocument',registrationDraft);
        $('#modal').close();await load();return;
      }
      if(cloudMode()){
        const cloudRow={...data,id:id||crypto.randomUUID()};
        if(c==='remisiones'&&!id)cloudRow.origin='manual';
        const result=c==='gerencias'&&!id
          ? await cloud.call('createGerencia',{...cloudRow,reason:'Alta de catálogo'})
          : await cloud.call('saveRecord',{gerenciaId:gerenciaFor(c,cloudRow),collection:c,row:cloudRow,expectedRevision:row.revision??0});
        $('#modal').close();
        if(cloud.spark && result.saved){
          const upsert=(entity,record)=>{const index=db[entity].findIndex(r=>r.id===record.id);if(index<0)db[entity].push(record);else db[entity][index]=record;};
          if(result.control){db.remisionControls??=[];upsert('remisionControls',result.control);}
          upsert(c,result.saved);if(result.related)upsert('documentos',result.related);
          render();updateNotice('Actualización realizada');
        }else await load();
        return;
      }
      const next = mutate(
        db,
        c,
        { ...row, ...data, id: id || crypto.randomUUID() },
        actor,
      );
      await repo.save(next);
      db = next;
      $("#modal").close();
      render();
    } catch (err) {
      $("#form-error").textContent = err.message;
      if(registrationDraft)$("#record-form").querySelectorAll("input,select,textarea").forEach(el=>el.disabled=true);
      submit.disabled = false;
    }
  };
  $("#modal").showModal();
}
function fatal(e) {
  $("#app").innerHTML =
    `<main class="content"><h1>No se pudo abrir el espacio local</h1><p>${esc(e.message)}</p><p>No se modificaron los datos almacenados. Recargue para volver a intentar.</p></main>`;
}
window.addEventListener("storage", (e) => {
  if (!cloudMode() && repo && e.key === repo.key) {
    $("#modal").close();
    load().catch(fatal);
  }
});
load().catch(fatal);

function showDetail(title,headers,rows){
 $('#modal').innerHTML=`<h2>${esc(title)}</h2>${table(headers,rows)}<button id="detail-close" class="secondary">Cerrar</button>`;
 $('#detail-close').onclick=()=>$('#modal').close();
 $('#modal').querySelectorAll('[data-sheet]').forEach(b=>b.onclick=()=>dependencySheet(b.dataset.sheet,b.dataset.id));
 installTables($('#modal'));if(!$('#modal').open)$('#modal').showModal();
}
function dependencySheet(kind,id){
 const selection={...f,gerencia:kind==='gerencias'?id:find('cacs',id).gerenciaId,cac:kind==='cacs'?id:''};
 const m=metrics(db,selection);
 const rows=m.cacs.map(c=>{const x=metrics(db,{...selection,cac:c.id});return [esc(c.name),x.registered+'/'+x.expected,x.individual,x.progress===null?'Sin documentos para verificar':x.progress.toFixed(1)+' %',x.rem.map(r=>esc(r.receivedOn||'Sin recepción')).join('<br>')||'Sin recepción',x.rem.map(r=>esc(r.dueOn||'Sin plazo')).join('<br>')||'Sin plazo',`<button class="link" data-sheet="cacs" data-id="${esc(c.id)}">Ver ficha</button>`]});
 showDetail(name(kind,id),['Dependencia','Recepción general (registradas/esperadas)','Individualizados','Avance','Recepción','Vencimiento',''],rows);
 const detail=document.createElement('div');detail.innerHTML=`<h3>Remisiones del período</h3>${table(['CAC','Período','Expediente','Recepción','Vencimiento'],m.rem.map(r=>[esc(name('cacs',r.cacId)),esc(period(r)),esc(r.expediente||'—'),esc(r.receivedOn||'—'),esc(r.dueOn||'—')]))}`;$('#detail-close').before(detail);installTables($('#modal'));
}
function indicatorDetail(index){
 const m=metrics(db,f),docRows=ds=>ds.map(d=>[esc(d.type),esc(d.number),esc(d.state),esc(name('lotes',d.loteId)||find('lotes',d.loteId).code)]);
 if(index===0||index===1){const kind=index===0?'gerencias':'cacs',ids=new Set(m.cacs.map(c=>index===0?c.gerenciaId:c.id));return showDetail('Doc consolidadas',['Nombre','Detalle'],db[kind].filter(x=>ids.has(x.id)).map(x=>[esc(x.name),`<button class="link" data-sheet="${kind}" data-id="${esc(x.id)}">Abrir ficha</button>`]));}
 if([2,11,12,18,19].includes(index)){const rows=index===11?m.expectedRows:index===12?m.pendingRows:m.rem.filter(r=>index===18?deadlineStatus(r)==='Próximo':index===19?deadlineStatus(r)==='Vencido':true);return showDetail('Detalle de remisiones',['CAC','Período','Expediente','Recepción','Vencimiento'],rows.map(item=>{const r=item.existing||item;return [esc(name('cacs',r.cacId)),esc(period(r)),esc(r.expediente||'—'),esc(r.receivedOn||'Sin recepción'),esc(r.dueOn||'Sin plazo')]}));}
 if([3,8,9,13,14].includes(index)){const lots=m.lots.filter(l=>index===8?l.declared>(m.counts.get(l.id)||0):index===9?l.declared!==(m.counts.get(l.id)||0):index===14?l.declared===(m.counts.get(l.id)||0):true);return showDetail('Detalle de lotes',['Lote','CAC','Período','Declarados','Individualizados','Conciliación'],lotRows(lots).map(r=>r.slice(0,6)));}
 if([15,16,17].includes(index)){const status=['Pendiente','En proceso','Regularizada'][index-15];return showDetail('Observaciones '+status,['Documento','Descripción','Fecha','Responsable','Estado'],m.observations.filter(o=>o.status===status).map(o=>[esc(find('documentos',o.documentId).number),esc(o.description),esc(o.date),esc(o.owner),esc(o.status)]));}
 const docs=m.docs.filter(d=>index===5?d.state!=='Pendiente':index===6?d.state==='Pendiente':index===7?d.state==='Verificado con observación':index===10?d.state==='Verificado':true);
 showDetail('Detalle de documentos',['Tipo','Número','Estado','Lote'],docRows(docs));
}
