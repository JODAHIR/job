/* Five minutes of user inactivity, shared across tabs; never deletes the outbox. */
const SESSION_IDLE_MS=5*60*1000;
let idleUid=null,idleLast=0,idleTimer=null,idleExpiring=false,idleExpiredNotice=false,idleLastWrite=0;
const idleKey=uid=>KEY+':activity:'+uid;
function readIdleActivity(){try{const value=Number(localStorage.getItem(idleKey(idleUid)));return Number.isFinite(value)&&value>0&&value<=Date.now()?value:0}catch{return 0}}
function scheduleIdleCheck(){clearTimeout(idleTimer);if(idleUid&&!idleExpiring)idleTimer=setTimeout(checkIdleSession,Math.min(SESSION_IDLE_MS,Math.max(1,idleLast+SESSION_IDLE_MS-Date.now())));}
function idleSessionChanged(user){
 const next=user?.uid||null;if(next===idleUid)return;const old=idleUid;clearTimeout(idleTimer);idleUid=next;idleExpiring=false;
 if(!next){if(old)try{localStorage.removeItem(idleKey(old))}catch{};idleLast=0;return;}
 idleLast=readIdleActivity()||Date.now();idleLastWrite=0;if(!readIdleActivity())try{localStorage.setItem(idleKey(next),String(idleLast))}catch{}
 checkIdleSession();
}
function checkIdleSession(){if(!idleUid||idleExpiring)return;idleLast=Math.max(idleLast,readIdleActivity());if(Date.now()-idleLast>=SESSION_IDLE_MS){void expireIdleSession();return}scheduleIdleCheck();}
function trackSessionActivity(event){if(!event.isTrusted||!idleUid||idleExpiring||document.visibilityState==='hidden')return;const now=Date.now();idleLast=Math.max(idleLast,readIdleActivity());if(now-idleLast>=SESSION_IDLE_MS){void expireIdleSession();return;}idleLast=now;if(now-idleLastWrite>=1000){try{localStorage.setItem(idleKey(idleUid),String(now))}catch{}idleLastWrite=now;}scheduleIdleCheck();}
async function expireIdleSession(){
 if(idleExpiring||!idleUid)return;idleExpiring=true;idleExpiredNotice=true;clearTimeout(idleTimer);
 // Invalidate in-flight UI updates, stop subscriptions and lock before signOut resolves.
 ++authGeneration;syncing=false;reading=false;roleBlocked=true;serverVerified=false;loginValidatedUid=null;loginOpenedFor=null;
 if(typeof stopStoreSubscriptions==='function')stopStoreSubscriptions();
 if(stopWatch){stopWatch();stopWatch=null}if(stopModules){stopModules();stopModules=null}stopLiveUpdates();
 db=emptyDB();cart=[];effectiveRole='BLOCKED';document.body.classList.add('auth-locked');document.getElementById('appShell').inert=true;
 document.querySelectorAll('.modal.show').forEach(node=>{const instance=bootstrap.Modal.getInstance(node);if(instance)instance.hide();node.classList.remove('show');node.style.display='none'});
 document.querySelectorAll('.modal-backdrop').forEach(node=>node.remove());document.body.classList.remove('modal-open');document.body.style.overflow='';
 loginPassword.value='';renderAll();loginMessage('Tu sesión se cerró tras 5 minutos de inactividad. Volvé a ingresar. Los cambios guardados pendientes se conservan.');
 try{await auth.signOut();loginGate();}catch{loginMessage('La sesión quedó bloqueada por inactividad. Pulsá Salir y volvé a ingresar.',true);}
}
const sessionLoginGate=loginGate;loginGate=function(){sessionLoginGate();if(idleExpiredNotice&&!auth?.currentUser)loginMessage('Tu sesión se cerró tras 5 minutos de inactividad. Volvé a ingresar. Los cambios guardados pendientes se conservan.');};
const sessionLogin=loginCloud;loginCloud=async function(event){idleExpiredNotice=false;return sessionLogin(event);};
const sessionStartCloud=startCloud;startCloud=async function(){await sessionStartCloud();if(auth)auth.onAuthStateChanged(idleSessionChanged);};
for(const event of ['pointerdown','pointermove','keydown','scroll','touchstart'])document.addEventListener(event,trackSessionActivity,{capture:true,passive:true});
document.addEventListener('visibilitychange',checkIdleSession);window.addEventListener('focus',checkIdleSession);window.addEventListener('pageshow',checkIdleSession);
window.addEventListener('storage',event=>{if(idleUid&&event.key===idleKey(idleUid))checkIdleSession();});
