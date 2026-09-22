import {auth,login,logout,watchAuth,isOwner,listProcedures,saveProcedure,listUsers,setUserAccess,errorMessage} from './firebase.js';
const $=id=>document.getElementById(id);let selected='',items=[];const fields=['title','questions','support','steps','hours','good','bad'];
function status(text){$('status').textContent=text}
function reset(){selected='';$('editor').reset();$('published').checked=false;$('edit-title').textContent='Nuevo procedimiento'}
function edit(item){selected=item.id;for(const key of fields)$(key).value=item[key]||'';$('published').checked=item.published;$('edit-title').textContent='Editar procedimiento';$('title').focus()}
async function refresh(){items=await listProcedures();$('list').replaceChildren();for(const item of items){const b=document.createElement('button');b.type='button';b.textContent=item.title+' · '+(item.published?'Publicado':'Borrador');b.onclick=()=>edit(item);$('list').append(b)}if(!items.length)$('list').textContent='Todavía no hay procedimientos.'}
$('login').onclick=async()=>{try{status('Abriendo Google para iniciar sesión…');await login()}catch(e){status(errorMessage(e))}};$('logout').onclick=()=>logout();$('new').onclick=reset;
$('editor').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{const data=Object.fromEntries(fields.map(k=>[k,$(k).value.trim()]));data.published=$('published').checked;await saveProcedure(selected,data);reset();await refresh();status('Procedimiento guardado en Firebase.')}catch(e){status(errorMessage(e))}finally{$('save').disabled=false}};
watchAuth(async user=>{$('logout').hidden=!user;$('login').hidden=!!user;$('workspace').hidden=true;if(!user){$('users-list').replaceChildren();$('list').replaceChildren();reset();status('Ingresá con tu cuenta de administración.');return}if(!isOwner(user)){status('Esta cuenta no está autorizada para administrar los procedimientos.');return}status('Cargando procedimientos…');try{await refresh();if(auth.currentUser?.uid!==user.uid)return;$('workspace').hidden=false;await refreshUsers();if(auth.currentUser?.uid!==user.uid)return;status('Conectado a Firebase. Podés editar conocimientos y administrar quién puede consultar el chatbot.')}catch(e){status(errorMessage(e))}});

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
$('authorize-form').onsubmit=async event=>{
 event.preventDefault();$('authorize').disabled=true;
 try{await setUserAccess($('user-email').value,true);$('authorize-form').reset();await refreshUsers();$('users-status').textContent='Correo autorizado. La persona puede ingresar con Google y consultar el chatbot.'}
 catch(e){$('users-status').textContent=e.code?errorMessage(e):e.message}
 finally{$('authorize').disabled=false}
};
