import {auth,login,logout,watchAuth,isOwner,accessFor,searchProcedures,errorMessage,saveChatMessage,loadChatHistory,submitProposal} from './firebase.js';
import {selectPendingProcedure,optionsMessage} from './chat-selection.js';
const button=document.getElementById('cloud-login'),status=document.getElementById('cloud-status'),headerSession=document.getElementById('header-session'),loggedUser=document.getElementById('logged-user'),sideAdmin=document.getElementById('side-admin-link');
async function toggleSession(){try{if(auth.currentUser)await logout();else await login()}catch(e){status.textContent=errorMessage(e)}}
button.onclick=toggleSession;headerSession.onclick=toggleSession;
let authVersion=0,pendingOptions=[];
const adminLink=document.getElementById('admin-link');
window.firebaseSaveMessage=saveChatMessage;
window.firebaseLoadMessages=loadChatHistory;
window.firebaseSubmitProposal=submitProposal;
watchAuth(async user=>{
 const version=++authVersion;button.textContent=user?'Salir':'Ingresar con Google';headerSession.textContent=user?'Salir':'Ingresar con Google';loggedUser.hidden=!user;loggedUser.textContent=user?.email||'';adminLink.hidden=!isOwner(user);sideAdmin.hidden=!isOwner(user);
 status.textContent=user?'Verificando autorización…':'Ingresá con Google. El administrador debe autorizar tu correo para consultar.';
 try{const access=user?await accessFor(user):'denied';if(version!==authVersion)return;
 if(user){status.textContent=access==='denied'?'Tu correo no está autorizado. Solicitá acceso al administrador.':access==='admin'?'Cuenta administradora conectada.':'Acceso autorizado · '+user.email;if(access!=='denied'){window.startFreshChat?.();window.restoreChatHistory?.()}}
 }catch(e){if(version===authVersion)status.textContent=errorMessage(e)}
});
function procedureAnswer(p,question){return {text:p.title+'\n\nSoporte: '+(p.support||'No especificado')+'\n\n'+p.steps+(p.hours?'\n\nHorarios: '+p.hours:'')+'\n\nLas plantillas son textos para usar después de verificar el resultado de la gestión.',templates:(/incorrect|aclarac|falta/i.test(question)?[p.bad]:/correct|procesado/i.test(question)?[p.good]:[p.good&&'Caso correcto: '+p.good,p.bad&&'Caso incorrecto: '+p.bad]).filter(Boolean),source:p.title+' · Base de conocimientos de Firebase'}}
window.firebaseSuggestions=async question=>{const user=auth.currentUser;if(!user||question.trim().length<3||await accessFor(user)==='denied')return [];return searchProcedures(question)};
window.firebaseProcedureAnswer=async procedure=>{const user=auth.currentUser;if(!user)return {text:'Ingresá con Google para consultar. El administrador debe autorizar tu correo.'};try{if(await accessFor(user)==='denied')return {text:'Tu correo no está autorizado o su acceso fue revocado. Solicitá acceso al administrador.'};return procedureAnswer(procedure,'')}catch(error){return {text:errorMessage(error)}}};
window.firebaseAnswer=async question=>{const user=auth.currentUser,version=authVersion;if(!user)return {text:'Ingresá con Google para consultar. El administrador debe autorizar tu correo.'};try{if(await accessFor(user)==='denied')return {text:'Tu correo no está autorizado o su acceso fue revocado. Solicitá acceso al administrador.'};const selected=selectPendingProcedure(question,pendingOptions);if(selected){pendingOptions=[];return procedureAnswer(selected,question)}const matches=await searchProcedures(question);if(version!==authVersion)return {text:'La sesión cambió. Volvé a ingresar para consultar.'};if(!matches.length)return {text:'No encontré una respuesta disponible en la base de conocimiento. Podés registrar una propuesta para que el administrador la revise.',proposal:true,proposalTitle:question};if(matches.length>1){pendingOptions=matches;return {text:optionsMessage(matches),options:matches}}pendingOptions=[];return procedureAnswer(matches[0],question)}catch(e){return {text:errorMessage(e)}}};
