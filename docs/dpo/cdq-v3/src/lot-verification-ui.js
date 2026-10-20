import {currentVerification} from './lot-verification.js?v=cah-verificacion-20261020';
export function lotVerificationLabel(db,lot) {
 const control=db.remisionControls?.find(c=>c.id===lot.remisionId),rem=db.remisiones.find(r=>r.id===lot.remisionId);
 return currentVerification(db.lotVerifications||[],lot,control,!!rem?.annulment)?.result||'Pendiente de revisión';
}
export async function showLotVerification({cloud,db,esc,load},lotId) {
 const lot=db.lotes.find(l=>l.id===lotId),rem=db.remisiones.find(r=>r.id===lot?.remisionId),g=db.cacs.find(c=>c.id===rem?.cacId)?.gerenciaId;
 const modal=document.querySelector('#modal');
 modal.innerHTML='<p role="status">Consultando documentos del lote…</p><button id="verify-close">Cerrar</button>';if(!modal.open)modal.showModal();
 const close=()=>modal.close();modal.querySelector('#verify-close').onclick=close;
 try {
 const history=await cloud.call('lotVerificationHistory',{gerenciaId:g,lotId});
 let review;
 try{review=await cloud.call('reviewLot',{gerenciaId:g,lotId});}
 catch(error){
  if(!modal.open)return;
  modal.innerHTML=`<h2>Historial · ${esc(lot.code)}</h2><p>${esc(error.message)}</p>${history.map(v=>`<article><strong>${esc(v.result)}</strong><p>${esc(v.at?.toDate?.().toLocaleString('es-PY')||'')} · ${esc(v.actor)} · ${esc(v.role)}</p><p>Declarados ${v.declared}; registrados ${v.registered}; faltantes ${v.missing}; excedentes ${v.excess}; observaciones ${v.openObservations}</p><p>${esc(v.comments)}</p><p>${esc(v.reviewerComments)}</p></article>`).join('')||'<p>Sin verificaciones anteriores.</p>'}<button id="verify-close">Cerrar</button>`;
  modal.querySelector('#verify-close').onclick=close;return;
 }
 if(!modal.open)return;
 const s=review.summary,operationId=crypto.randomUUID();
 modal.innerHTML=`<form id="verification-form" class="form-fields"><h2>Conciliar y verificar lote · ${esc(lot.code)}</h2><p>Declarados: <strong>${s.declared}</strong> · Registrados: <strong>${s.registered}</strong> · Faltantes: <strong>${s.missing}</strong> · Excedentes: <strong>${s.excess}</strong> · Observaciones sin regularizar: <strong>${s.openObservations}</strong></p><p>La comparación corresponde a documentos registrados en el sistema. La igualdad de cantidades requiere confirmar la revisión documental.</p><label>Comentarios de la revisión<textarea name="comments" maxlength="2000" rows="3" ${s.complete?'':'required'}></textarea></label>${s.complete?'<label class="check-label"><input type="checkbox" name="confirmed">Confirmo que revisé los documentos y que el lote está completo y sin inconvenientes.</label><p>Al confirmar se registrará: «Presentación sin inconvenientes, lote completo».</p>':'<p>Este lote no puede marcarse como Verificado. Puede guardar la revisión y sus observaciones.</p>'}<p id="verification-error" role="alert"></p><button class="primary" type="submit">Guardar revisión</button>${s.complete?'<button class="secondary" type="submit" value="observations">Guardar comentarios sin verificar</button>':''}<button id="verify-close" type="button">Cerrar</button><details><summary>Historial de verificaciones (${history.length})</summary>${history.map(v=>`<article><strong>${esc(v.result)}</strong> · ${esc(v.at?.toDate?.().toLocaleString('es-PY')||'')}<p>Responsable: ${esc(v.actor)} · ${esc(v.role)} · Lote: ${esc(v.code)}</p><p>Declarados ${v.declared}; registrados ${v.registered}; faltantes ${v.missing}; excedentes ${v.excess}; observaciones ${v.openObservations}</p><p>${esc(v.comments)}</p>${v.reviewerComments&&v.reviewerComments!==v.comments?`<p>${esc(v.reviewerComments)}</p>`:''}</article>`).join('')||'<p>Sin verificaciones anteriores.</p>'}</details></form>`;
 const form=modal.querySelector('form');modal.querySelector('#verify-close').onclick=close;
 let busy=false;const prevent=e=>{if(busy)e.preventDefault();};modal.addEventListener('cancel',prevent);modal.addEventListener('close',()=>modal.removeEventListener('cancel',prevent),{once:true});
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;const values=new FormData(form),confirmed=e.submitter?.value!=='observations'&&values.get('confirmed')==='on',comments=values.get('comments')||'';
 if(s.complete&&!confirmed&&e.submitter?.value!=='observations'){modal.querySelector('#verification-error').textContent='Confirme manualmente la revisión para marcar el lote como Verificado.';return;}
 busy=true;form.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=true);
 try{await cloud.call('verifyLot',{review,confirmed,comments,operationId});busy=false;modal.close();await load();}
 catch(error){modal.querySelector('#verification-error').textContent=error.message;busy=false;form.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=false);}
 };
 }catch(error){modal.querySelector('p').textContent=error.message;}
}
