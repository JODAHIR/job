import {auth,login,logout,watchAuth,isOwner,accessFor,searchProcedures,errorMessage} from './firebase.js';
const button=document.getElementById('cloud-login'),status=document.getElementById('cloud-status');
button.onclick=async()=>{try{if(auth.currentUser)await logout();else await login()}catch(e){status.textContent=errorMessage(e)}};
let authVersion=0,previousUid=null;
const adminLink=document.getElementById('admin-link');
watchAuth(async user=>{
 if(previousUid!==user?.uid){const chat=document.getElementById('chat');while(chat.children.length>1)chat.lastElementChild.remove()}previousUid=user?.uid;
 const version=++authVersion;button.textContent=user?'Salir':'Ingresar con Google';adminLink.hidden=!isOwner(user);
 status.textContent=user?'Verificando autorización…':'Ingresá con Google. El administrador debe autorizar tu correo para consultar.';
 try{const access=user?await accessFor(user):'denied';if(version!==authVersion)return;
 if(user)status.textContent=access==='denied'?'Tu correo no está autorizado. Solicitá acceso al administrador.':access==='admin'?'Cuenta administradora conectada.':'Acceso autorizado · '+user.email;
 }catch(e){if(version===authVersion)status.textContent=errorMessage(e)}
});
window.firebaseAnswer=async question=>{const user=auth.currentUser,version=authVersion;if(!user)return {text:'Ingresá con Google para consultar. El administrador debe autorizar tu correo.'};try{if(await accessFor(user)==='denied')return {text:'Tu correo no está autorizado o su acceso fue revocado. Solicitá acceso al administrador.'};const matches=await searchProcedures(question);if(version!==authVersion)return {text:'La sesión cambió. Volvé a ingresar para consultar.'};if(!matches.length)return {text:'No encontré un procedimiento publicado que coincida con la consulta. Consultá al responsable de la base de conocimientos.'};if(matches.length>1)return {text:'Encontré varios procedimientos. Especificá el tema de tu consulta:\n\n'+matches.map(x=>'• '+x.title).join('\n')};const p=matches[0];return {text:p.title+'\n\nSoporte: '+(p.support||'No especificado')+'\n\n'+p.steps+(p.hours?'\n\nHorarios: '+p.hours:'')+'\n\nLas plantillas son textos para usar después de verificar el resultado de la gestión.',templates:(/incorrect|aclarac|falta/i.test(question)?[p.bad]:/correct|procesado/i.test(question)?[p.good]:[p.good&&'Caso correcto: '+p.good,p.bad&&'Caso incorrecto: '+p.bad]).filter(Boolean),source:p.title+' · Base de conocimientos de Firebase'};}catch(e){return {text:errorMessage(e)}}};
