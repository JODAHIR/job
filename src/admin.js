import {renderLibrary,clearHistory,showHistory} from './admin-library.js';
import {CATEGORIES,categoryForTitle} from './procedure-view.js';
import {auth,login,logout,watchAuth,isOwner,listProcedures,saveProcedure,listUsers,setUserAccess,usageSummary,errorMessage} from './firebase.js';
const $=id=>document.getElementById(id);let selected='',items=[],expectedUpdatedAt=null;const fields=['category','title','questions','support','steps','hours','good','bad'];
function status(text){$('status').textContent=text}
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
  label.textContent=user.email+' · '+(user.active?'Autorizado':'Acceso revocado');
  button.type='button';button.textContent=user.active?'Revocar acceso':'Autorizar nuevamente';button.setAttribute('aria-label',button.textContent+' de '+user.email);
  button.onclick=async()=>{button.disabled=true;try{await setUserAccess(user.email,!user.active);await refreshUsers();$('users-status').textContent=user.active?'Acceso revocado. No podrá realizar nuevas consultas.':'Acceso autorizado.'}catch(e){$('users-status').textContent=errorMessage(e);button.disabled=false}};
  row.append(label,button);$('users-list').append(row);
 }
 if(!users.length)$('users-status').textContent='Todavía no hay personas autorizadas. La cuenta administradora conserva su acceso.';
}
async function refreshActivity(){
 const body=$('activity-list');body.replaceChildren();$('activity-status').textContent='Actualizando el registro interno…';
 try{const rows=await usageSummary(),format=new Intl.DateTimeFormat('es-PY',{dateStyle:'medium',timeStyle:'short'});for(const item of rows){const row=document.createElement('tr');for(const value of [item.email,item.count,format.format(item.lastActivity?.toDate?.()||new Date())]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell)}body.append(row)}$('activity-status').textContent=rows.length?`${rows.length} usuario(s) con actividad registrada.`:'Todavía no hay consultas registradas.'}catch(e){$('activity-status').textContent=e.code?errorMessage(e):e.message}
}
$('refresh-activity').onclick=refreshActivity;
$('authorize-form').onsubmit=async event=>{
 event.preventDefault();$('authorize').disabled=true;
 try{await setUserAccess($('user-email').value,true);$('authorize-form').reset();await refreshUsers();$('users-status').textContent='Correo autorizado. La persona puede ingresar con Google y consultar el chatbot.'}
 catch(e){$('users-status').textContent=e.code?errorMessage(e):e.message}
 finally{$('authorize').disabled=false}
};
