/* Login is a presentation boundary. Firestore rules remain the authority. */
const loginFormNode=document.getElementById('loginForm');
document.getElementById('loginFormSlot').append(loginFormNode);
document.querySelector('.top-right').insertAdjacentHTML('beforeend','<span id="sessionEmail" class="session-email"></span><button class="btn btn-outline-secondary btn-sm" onclick="logoutCloud()">Salir</button>');
let loginBusy=false,loginOpenedFor=null,loginValidatedUid=null;
function loginMessage(message,error=false){const el=document.getElementById('loginStatus');el.textContent=message;el.dataset.error=String(error)}
function loginGate(){
 const user=auth?.currentUser;if(!user||roleBlocked)loginValidatedUid=null;if(user?.emailVerified&&serverVerified&&!roleBlocked)loginValidatedUid=user.uid;
 const ready=!!(user?.emailVerified&&(serverVerified||loginValidatedUid===user.uid)&&!roleBlocked&&ROLE_ACTIONS[effectiveRole]);
 document.body.classList.toggle('auth-locked',!ready);
 document.getElementById('appShell').inert=!ready;
 document.getElementById('loginScreen').hidden=ready;
 loginFormNode.hidden=!!user;
 document.getElementById('loginSessionActions').hidden=!user||ready;
 document.getElementById('sessionEmail').textContent=user?.email||'';
 if(!ready){document.body.classList.remove('sidebar-open');loginOpenedFor=null}
 if(user&&!ready){loginMessage(!user.emailVerified?'Verificá tu correo antes de ingresar. Cerrá sesión y usá Crear mi cuenta si necesitás otro enlace.':roleBlocked?'Tu cuenta no tiene acceso activo. Consultá con el administrador.':syncState==='error'||syncState==='offline'?syncDetail:'Verificando tu cuenta y los módulos habilitados…',roleBlocked||syncState==='error')}
 else if(!user&&!loginBusy&&syncState!=='error')loginMessage('Acceso exclusivo para usuarios autorizados.');
 if(ready&&loginOpenedFor!==user.uid){loginOpenedFor=user.uid;goPage(ROLE_PAGES[effectiveRole][0])}
}
const loginRoleUI=roleUI;roleUI=function(){loginRoleUI();loginGate();const page=document.querySelector('.page.active');document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page?.id));if(page)document.getElementById('pageCrumb').textContent=document.querySelector('[data-page="'+page.id+'"]').textContent.trim()};
const loginSetSync=setSync;setSync=function(state,detail){loginSetSync(state,detail);loginGate()};
const loginGoPage=goPage;goPage=function(page){if(document.body.classList.contains('auth-locked')||!ROLE_PAGES[effectiveRole]?.includes(page))return;loginGoPage(page)};
document.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button&&(document.body.classList.contains('auth-locked')||!ROLE_PAGES[effectiveRole]?.includes(button.dataset.page))){event.preventDefault();event.stopImmediatePropagation()}},true);
const loginAllowed=allowed;allowed=function(action){return !document.body.classList.contains('auth-locked')&&loginAllowed(action)};
function friendlyLoginError(e){return ['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-login-credentials'].includes(e.code)?'El correo o la contraseña no son correctos.':e.code==='auth/too-many-requests'?'Demasiados intentos. Esperá unos minutos antes de reintentar.':e.code==='auth/network-request-failed'?'No hay conexión. Revisá tu red y reintentá.':'No se pudo iniciar sesión. Revisá tu correo y la conexión.'}
loginCloud=async function(event){event.preventDefault();if(loginBusy)return;if(!auth)return loginMessage('No se pudo conectar. Recargá la página e intentá nuevamente.',true);if(!navigator.onLine)return loginMessage('Necesitás conexión para iniciar sesión.',true);loginBusy=true;const buttons=loginFormNode.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);loginMessage('Ingresando…');try{await auth.signInWithEmailAndPassword(loginEmail.value.trim(),loginPassword.value);loginPassword.value=''}catch(e){loginPassword.value='';loginMessage(friendlyLoginError(e),true)}finally{loginBusy=false;buttons.forEach(b=>b.disabled=false)}};
async function retryLoginAccess(){if(!auth?.currentUser)return;try{await auth.currentUser.reload();if(!auth.currentUser.emailVerified)return loginGate();await auth.currentUser.getIdToken(true);roleBlocked=false;await retrySync();loginGate()}catch(e){loginMessage('No se pudo verificar el acceso. Revisá la conexión e intentá nuevamente.',true)}}
loginGate();
