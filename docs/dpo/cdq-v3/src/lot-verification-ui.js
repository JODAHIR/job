import {currentVerification,reconcilePresented} from './lot-verification.js?documentos-20261021';
export function lotVerificationLabel(db,lot) {
 const control=db.remisionControls?.find(c=>c.id===lot.remisionId),rem=db.remisiones.find(r=>r.id===lot.remisionId);
 return currentVerification(db.lotVerifications||[],lot,control,!!rem?.annulment)?.result||'Pendiente de revisión';
}
export async function showLotVerification({cloud,db,esc,load},lotId,adminEdit=false) {
 const lot=db.lotes.find(l=>l.id===lotId),rem=db.remisiones.find(r=>r.id===lot?.remisionId),g=db.cacs.find(c=>c.id===rem?.cacId)?.gerenciaId;
 const modal=document.querySelector('#modal');
 modal.innerHTML='<p role="status">Consultando documentos del lote…</p><button class="secondary verification-close" id="verify-close">Cerrar</button>';if(!modal.open)modal.showModal();
 const close=()=>modal.close();modal.querySelector('#verify-close').onclick=close;
 try {
 const history=await cloud.call('lotVerificationHistory',{gerenciaId:g,lotId});
 let review;
 try{review=await cloud.call('reviewLot',{gerenciaId:g,lotId});}
 catch(error){
  if(!modal.open)return;
  modal.innerHTML=`<h2>Historial · ${esc(lot.code)}</h2><p>${esc(error.message)}</p>${history.map(v=>`<article><strong>${esc(v.result)}</strong><p>${esc(v.at?.toDate?.().toLocaleString('es-PY')||'')} · ${esc(v.actor)} · ${esc(v.role)}</p><p>Declarados ${v.declared}; registrados/presentados ${v.registered}${v.countSource==='manual'?`; individualizados ${v.individualized}`:''}; faltantes ${v.missing}; excedentes ${v.excess}; observaciones ${v.openObservations}</p><p>${esc(v.comments)}</p><p>${esc(v.reviewerComments)}</p></article>`).join('')||'<p>Sin verificaciones anteriores.</p>'}<button class="secondary verification-close" id="verify-close">Cerrar</button>`;
  modal.querySelector('#verify-close').onclick=close;return;
 }
 if(!modal.open)return;
 const current=currentVerification(history,review.lot,{version:review.controlVersion});
 const administrator=cloud.profile?.role==='technical';
 if(current?.result==='Verificado'&&!(adminEdit&&administrator)){
  const comments=await cloud.call('verificationComments',{gerenciaId:g,lotId});if(!modal.open)return;
  modal.innerHTML=`<form id="verified-comment-form" class="verified-lot"><h2>Conciliación del lote</h2><div class="verified-lot-heading"><span>Lote seleccionado</span><strong>${esc(lot.code)}</strong></div><div class="verification-metrics"><div><strong>${current.declared}</strong><span>Declarados</span></div><div><strong>${current.registered}</strong><span>Presentados</span></div><div><strong>${current.missing+current.excess}</strong><span>Diferencias</span></div></div><p class="verified-success">✓ Conciliación sin diferencias · Verificado</p><div class="verification-note"><small>Comentario de verificación</small><p>${esc(current.comments)}</p></div><button class="verification-locked" type="button" disabled>✓ Lote conciliado y verificado</button><label>Agregar comentario<textarea name="comments" required maxlength="2000" rows="3"></textarea></label><p id="verification-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">Guardar comentario</button><button class="secondary verification-close" type="button" id="verify-close">Cerrar</button></div>${administrator?'<button type="button" class="secondary" id="admin-change-verification">Cambiar estado del lote · Administrador</button>':''}<details><summary>Historial (${history.length} verificaciones · ${comments.length} comentarios)</summary>${history.map(v=>`<article><strong>${esc(v.result)}</strong><p>${esc(v.actor)} · ${esc(v.at?.toDate?.().toLocaleString('es-PY')||'')}</p><p>${esc(v.comments)}</p></article>`).join('')}${comments.map(v=>`<article><strong>Comentario</strong><p>${esc(v.actor)} · ${esc(v.at?.toDate?.().toLocaleString('es-PY')||'')}</p><p>${esc(v.comments)}</p></article>`).join('')}</details></form>`;
  modal.querySelector('#verify-close').onclick=close;
  const form=modal.querySelector('form'),operations=new Map();let busy=false;
  const prevent=e=>{if(busy)e.preventDefault();};modal.addEventListener('cancel',prevent);modal.addEventListener('close',()=>modal.removeEventListener('cancel',prevent),{once:true});
  if(administrator)modal.querySelector('#admin-change-verification').onclick=()=>showLotVerification({cloud,db,esc,load},lotId,true);
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;const text=form.elements.comments.value.trim();if(!text)return;if(!operations.has(text))operations.set(text,crypto.randomUUID());busy=true;form.querySelectorAll('button,textarea').forEach(x=>x.disabled=true);
   try{await cloud.call('addVerificationComment',{gerenciaId:g,lotId,verificationId:current.id,comments:text,operationId:operations.get(text)});busy=false;modal.close();await showLotVerification({cloud,db,esc,load},lotId);}
   catch(error){busy=false;form.querySelector('#verification-error').textContent=error.message;form.querySelectorAll('button,textarea').forEach(x=>x.disabled=false);form.querySelector('.verification-locked').disabled=true;}
  };
  return;
 }
 if(!administrator){modal.innerHTML=`<h2>Revisión de ${esc(lot.code)}</h2><p>Solo el Administrador puede cambiar el estado del lote. Cuando esté verificado podrá agregar comentarios.</p><button class="secondary verification-close" id="verify-close">Cerrar</button>`;modal.querySelector('#verify-close').onclick=close;return;}
 let s=review.summary;
 const previous=history.find(v=>v.countSource==='manual');
 const initial=previous?.registered??s.registered;
 modal.innerHTML=`<form id="verification-form" class="form-fields"><h2>Conciliar y verificar lote · ${esc(lot.code)}</h2><p>Declarados: <strong>${s.declared}</strong> · Individualizados en el sistema: <strong>${s.registered}</strong></p><label>Documentos registrados / presentados para esta revisión<input name="registered" type="number" min="0" max="1000000" step="1" required value="${initial}"></label><p>Ingrese la cantidad comprobada. Este dato no crea documentos individualizados.${previous?' Se propone la cantidad de la última revisión manual.':''}</p><p id="verification-counts" aria-live="polite"></p><label>Comentarios de la revisión<textarea name="comments" maxlength="2000" rows="3"></textarea></label><label class="check-label" id="verification-confirm"><input type="checkbox" name="confirmed">Confirmo que revisé los documentos y que el lote está completo y sin inconvenientes.</label><p id="verification-eligibility"></p><p id="verification-error" role="alert"></p><button class="primary" type="submit">Guardar revisión</button><button class="secondary" type="submit" value="observations">Guardar comentarios sin verificar</button><button class="secondary verification-close" id="verify-close" type="button">Cerrar</button><details><summary>Historial de verificaciones (${history.length})</summary>${history.map(v=>`<article><strong>${esc(v.result)}</strong> · ${esc(v.at?.toDate?.().toLocaleString('es-PY')||'')}<p>Responsable: ${esc(v.actor)} · ${esc(v.role)} · Lote: ${esc(v.code)}</p><p>Declarados ${v.declared}; registrados/presentados ${v.registered}${v.countSource==='manual'?`; individualizados ${v.individualized}`:''}; faltantes ${v.missing}; excedentes ${v.excess}; observaciones ${v.openObservations}</p><p>${esc(v.comments)}</p>${v.reviewerComments&&v.reviewerComments!==v.comments?`<p>${esc(v.reviewerComments)}</p>`:''}</article>`).join('')||'<p>Sin verificaciones anteriores.</p>'}</details></form>`;
 const form=modal.querySelector('form');modal.querySelector('#verify-close').onclick=close;
 const quantity=form.elements.registered,confirmation=form.elements.confirmed;
 const refresh=()=>{
  confirmation.checked=false;
  try {
   if(quantity.value==='')throw Error('Ingrese la cantidad de documentos.');
   s=reconcilePresented(review.summary,quantity.valueAsNumber);
   form.querySelector('#verification-counts').textContent=`Faltantes: ${s.missing} · Excedentes: ${s.excess} · Observaciones o rechazos pendientes: ${s.openObservations}`;
   confirmation.disabled=!s.complete;
   form.elements.comments.required=!s.complete;
   form.querySelector('#verification-eligibility').textContent=s.complete?'Al confirmar se registrará: «Presentación sin inconvenientes, lote completo».':'Puede guardar la revisión, pero las diferencias u observaciones impiden marcar el lote como Verificado.';
   form.querySelector('#verification-error').textContent='';
  }catch(error){confirmation.disabled=true;form.querySelector('#verification-counts').textContent='';form.querySelector('#verification-error').textContent=error.message;}
 };
 quantity.addEventListener('input',refresh);refresh();
 const operations=new Map();
 let busy=false;const prevent=e=>{if(busy)e.preventDefault();};modal.addEventListener('cancel',prevent);modal.addEventListener('close',()=>modal.removeEventListener('cancel',prevent),{once:true});
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;const values=new FormData(form),confirmed=e.submitter?.value!=='observations'&&values.get('confirmed')==='on',comments=values.get('comments')||'';
 if(s.complete&&!confirmed&&e.submitter?.value!=='observations'){modal.querySelector('#verification-error').textContent='Confirme manualmente la revisión para marcar el lote como Verificado.';return;}
 const registered=quantity.valueAsNumber;
 try{reconcilePresented(review.summary,registered);}catch(error){form.querySelector('#verification-error').textContent=error.message;return;}
 const key=JSON.stringify([registered,confirmed,comments]);
 if(!operations.has(key))operations.set(key,crypto.randomUUID());
 const operationId=operations.get(key);
 busy=true;form.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=true);
 try{await cloud.call('verifyLot',{review,confirmed,comments,operationId,registered});busy=false;modal.close();await load();}
 catch(error){modal.querySelector('#verification-error').textContent=error.message;busy=false;form.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=false);confirmation.disabled=!s.complete;}
 };
 }catch(error){modal.querySelector('p').textContent=error.message;}
}

export function lotReconciliation(db,lot){
 const control=db.remisionControls?.find(c=>c.id===lot.remisionId),rem=db.remisiones.find(r=>r.id===lot.remisionId);
 const review=currentVerification(db.lotVerifications||[],lot,control,!!rem?.annulment);
 const individualized=db.documentos.filter(d=>d.loteId===lot.id).length;
 return {review,individualized,registered:review?.registered??individualized};
}
