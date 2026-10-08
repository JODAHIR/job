import {renderLibrary,clearHistory,showHistory} from './admin-library.js';
import {CATEGORIES,categoryForTitle} from './procedure-view.js';
import {auth,login,logout,watchAuth,isOwner,listProcedures,saveProcedure,listUsers,setUserAccess,usageSummary,listPendingProposals,approveProposal,errorMessage} from './firebase.js';
const $=id=>document.getElementById(id);let selected='',items=[],expectedUpdatedAt=null;const fields=['category','title','questions','support','steps','hours','good','bad'];
function status(text){$('status').textContent=text}
for(const tab of document.querySelectorAll('#admin-tabs [data-bs-target]'))tab.addEventListener('click',()=>{for(const button of document.querySelectorAll('#admin-tabs [data-bs-target]')){const pane=document.querySelector(button.dataset.bsTarget);const active=button===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));pane?.classList.toggle('show',active);pane?.classList.toggle('active',active)}});
function reset(){selected='';expectedUpdatedAt=null;clearHistory();$('editor').reset();$('category').value='';$('published').checked=false;$('edit-title').textContent='Nuevo procedimiento'}
function edit(item){selected=item.id;expectedUpdatedAt=item.updatedAt;showHistory(item.id);renderLibrary(items,selected,edit);for(const key of fields)$(key).value=item[key]||'';$('published').checked=item.published;$('edit-title').textContent='Editar procedimiento';$('title').focus()}
async function refresh(){const user=auth.currentUser,result=await listProcedures();if(auth.currentUser?.uid!==user?.uid)return;items=result;renderLibrary(items,selected,edit)}
$('procedure-search').oninput=()=>renderLibrary(items,selected,edit);$('category-filter').onchange=()=>renderLibrary(items,selected,edit);
$('login').onclick=async()=>{try{status('Abriendo Google para iniciar sesión…');await login()}catch(e){status(e.code?errorMessage(e):e.message)}};$('logout').onclick=()=>logout();$('new').onclick=reset;
$('editor').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;const savingUser=auth.currentUser;try{const data=Object.fromEntries(fields.map(k=>[k,$(k).value.trim()]));data.published=$('published').checked;const savedId=await saveProcedure(selected,data,expectedUpdatedAt);if(auth.currentUser?.uid!==savingUser?.uid)return;await refresh();const saved=items.find(item=>item.id===savedId);if(saved)edit(saved);status('Procedimiento guardado. La modificación quedó registrada en el historial.')}catch(e){status(e.code?errorMessage(e):e.message)}finally{$('save').disabled=false}};
function addCategoryOptions(){for(const id of ['category','category-filter']){const select=$(id);for(const value of CATEGORIES){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)}}}
async function categorizeLoaded(){const missing=items.filter(item=>!item.category);if(!missing.length){$('categorize-status').textContent='Todos los procedimientos ya tienen categoría.';return}$('categorize').disabled=true;let completed=0;try{for(const item of missing){const data=Object.fromEntries(fields.map(key=>[key,key==='category'?categoryForTitle(item.title):(item[key]||'')]));data.published=item.published;await saveProcedure(item.id,data,item.updatedAt);completed++;$('categorize-status').textContent=`Categorizando… ${completed} de ${missing.length}`;}await refresh();$('categorize-status').textContent=`Se categorizaron ${completed} procedimientos.`}catch(e){$('categorize-status').textContent=`Se categorizaron ${completed} de ${missing.length}. ${e.code?errorMessage(e):e.message}`}finally{$('categorize').disabled=false}}
$('categorize').onclick=categorizeLoaded;addCategoryOptions();
watchAuth(async user=>{$('logout').hidden=!user;$('login').hidden=!!user;$('workspace').hidden=true;if(!user){items=[];$('users-list').replaceChildren();$('list').replaceChildren();reset();status('Ingresá con tu cuenta de administración.');return}if(!isOwner(user)){status('Esta cuenta no está autorizada para administrar los procedimientos.');return}status('Cargando procedimientos…');try{await refresh();if(auth.currentUser?.uid!==user.uid)return;$('workspace').hidden=false;try{await refreshUsers()}catch(e){$('users-status').textContent=errorMessage(e)};if(auth.currentUser?.uid!==user.uid)return;status('Conectado a Firebase. Podés editar conocimientos y administrar quién puede consultar el chatbot.')}catch(e){status(e.code?errorMessage(e):e.message)}});

async function refreshUsers(){
 const users=await listUsers();$('users-list').replaceChildren();
 for(const user of users){
  const row=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');
  label.textContent=(user.description?user.description+' · ':'')+user.email+' · '+(user.active?'Autorizado':'Acceso revocado');
  button.type='button';button.textContent=user.active?'Revocar acceso':'Autorizar nuevamente';button.setAttribute('aria-label',button.textContent+' de '+user.email);
  button.onclick=async()=>{button.disabled=true;try{await setUserAccess(user.email,!user.active,user.description);await refreshUsers();$('users-status').textContent=user.active?'Acceso revocado. No podrá realizar nuevas consultas.':'Acceso autorizado.'}catch(e){$('users-status').textContent=errorMessage(e);button.disabled=false}};
  row.append(label,button);$('users-list').append(row);
 }
 if(!users.length)$('users-status').textContent='Todavía no hay personas autorizadas. La cuenta administradora conserva su acceso.';
}
async function refreshActivity(){
 const body=$('activity-list');body.replaceChildren();$('activity-status').textContent='Actualizando el registro interno…';
 try{const rows=await usageSummary(),format=new Intl.DateTimeFormat('es-PY',{dateStyle:'medium',timeStyle:'short'});for(const item of rows){const row=document.createElement('tr');for(const value of [item.email,item.count,format.format(item.lastActivity?.toDate?.()||new Date())]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell)}body.append(row)}$('activity-status').textContent=rows.length?`${rows.length} usuario(s) con actividad registrada.`:'Todavía no hay consultas registradas.'}catch(e){$('activity-status').textContent=e.code?errorMessage(e):e.message}
}
$('refresh-activity').onclick=refreshActivity;
async function refreshProposals(){
 const list=$('proposals-list');list.replaceChildren();
 const proposals=await listPendingProposals();
 $('proposals-status').textContent=proposals.length?`${proposals.length} propuesta(s) pendiente(s).`:'No hay propuestas pendientes.';
 const groups=new Map();for(const proposal of proposals){const author=proposal.submittedEmail||'Usuario sin correo';if(!groups.has(author))groups.set(author,[]);groups.get(author).push(proposal)}
 for(const [author,authorProposals] of groups){
  const group=document.createElement('section');group.className='proposal-group';
  const groupTitle=document.createElement('h3');groupTitle.textContent=author;
  const groupCount=document.createElement('span');groupCount.className='proposal-count';groupCount.textContent=`${authorProposals.length} pendiente(s)`;
  const groupHeader=document.createElement('header');groupHeader.className='proposal-group-header';groupHeader.append(groupTitle,groupCount);group.append(groupHeader);
  for(const proposal of authorProposals){
  const item=document.createElement('article');item.className='proposal-admin';
  const header=document.createElement('div');header.className='proposal-header';
  const title=document.createElement('h4');title.textContent=proposal.title||'Propuesta sin título';
  const review=document.createElement('button');review.type='button';review.className='btn btn-outline-primary btn-sm';review.textContent='Revisar y modificar';review.setAttribute('aria-expanded','false');
  const form=document.createElement('form');form.className='proposal-review';form.hidden=true;
  form.innerHTML='<p class="proposal-author">Enviada por '+(proposal.submittedEmail||'usuario')+'</p><label>Título<input name="title" required maxlength="200"></label><label>Pasos operativos<textarea name="steps" required maxlength="10000"></textarea></label><label>Sistema o soporte<input name="support" maxlength="500"></label><label>Horarios<input name="hours" maxlength="500"></label><label>Plantilla correcta<textarea name="good" maxlength="3000"></textarea></label><label>Plantilla incorrecta<textarea name="bad" maxlength="3000"></textarea></label><div class="proposal-actions"><button class="btn btn-primary" type="submit">Guardar y publicar</button><button class="btn btn-outline-secondary" type="button" data-close>Cancelar</button></div>';
  for(const key of ['title','steps','support','hours','good','bad'])form.elements[key].value=proposal[key]||'';
  review.onclick=()=>{const opening=form.hidden;form.hidden=!opening;review.textContent=opening?'Ocultar revisión':'Revisar y modificar';review.setAttribute('aria-expanded',String(opening));if(opening)form.elements.title.focus()};
  form.querySelector('[data-close]').onclick=()=>review.click();
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await approveProposal({...proposal,...Object.fromEntries(new FormData(form))});await refreshProposals();await refresh();status('Propuesta actualizada y publicada.')}catch(e){button.disabled=false;status(e.message||errorMessage(e))}};
  header.append(title,review);item.append(header,form);group.append(item);
 }
 list.append(group);
 }
}
$('refresh-proposals').onclick=()=>refreshProposals().catch(e=>{$('proposals-status').textContent=errorMessage(e)});
$('proposals-tab').addEventListener('shown.bs.tab',()=>refreshProposals().catch(e=>{$('proposals-status').textContent=errorMessage(e)}));
$('authorize-form').onsubmit=async event=>{
 event.preventDefault();$('authorize').disabled=true;
 try{await setUserAccess($('user-email').value,true,$('user-name').value);$('authorize-form').reset();await refreshUsers();$('users-status').textContent='Correo autorizado. La persona puede ingresar con Google y consultar el chatbot.'}
 catch(e){$('users-status').textContent=e.code?errorMessage(e):e.message}
 finally{$('authorize').disabled=false}
};
