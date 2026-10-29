export function bindRemisionComments({db,cloud,esc}){
 document.querySelectorAll('[data-remision-comment]').forEach(button=>button.onclick=async()=>{
  const row=db.remisiones.find(r=>r.id===button.dataset.remisionComment),gerenciaId=db.cacs.find(c=>c.id===row.cacId)?.gerenciaId;
  const modal=document.querySelector('#modal');let operationId=crypto.randomUUID(),busy=false;
  modal.innerHTML=`<form><h2>Comentario general de la remisión</h2><p>${esc(row.expediente||row.id)}</p><label>Comentario<textarea name="description" required maxlength="2000"></textarea></label><p role="status" hidden></p><div class="form-actions"><button type="button" class="secondary">Cerrar</button><button class="primary" disabled>Guardar comentario</button></div><h3>Comentarios anteriores</h3><div data-comment-history>Cargando…</div></form>`;
  const close=modal.querySelector('[type=button]'),save=modal.querySelector('.primary'),input=modal.querySelector('textarea'),status=modal.querySelector('[role=status]');
  const update=()=>{save.disabled=busy||!input.value.trim();};input.oninput=update;
  close.onclick=()=>modal.close();modal.showModal();
  const history=modal.querySelector('[data-comment-history]');
  const refresh=async()=>{try{
   const rows=await cloud.call('remisionComments',{gerenciaId,remisionId:row.id});
   const groups=new Map(),options={timeZone:'America/Asuncion'};
   rows.sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));
   for(const c of rows){const date=c.at?.seconds?new Date(c.at.seconds*1000):null,key=date?date.toLocaleDateString('es-PY',options):'Fecha pendiente';if(!groups.has(key))groups.set(key,[]);groups.get(key).push({c,date});}
   history.innerHTML=groups.size?[...groups].map(([date,items])=>`<details><summary>${esc(date)} · ${items.length} ${items.length===1?'comentario':'comentarios'}</summary>${items.map(({c,date})=>`<article><p style="white-space:pre-wrap">${esc(c.description)}</p><small>${esc(c.owner)} · ${esc(date?date.toLocaleTimeString('es-PY',options):'Hora pendiente')}</small></article>`).join('')}</details>`).join(''):'Sin comentarios registrados.';
  }catch(e){history.textContent=e.message;}};
  await refresh();
  modal.querySelector('form').onsubmit=async e=>{
   e.preventDefault();if(busy||!input.value.trim())return;
   const description=input.value;busy=true;update();close.disabled=true;input.disabled=true;status.hidden=true;
   try{await cloud.call('addRemisionComment',{gerenciaId,remisionId:row.id,operationId,description});input.value='';operationId=crypto.randomUUID();await refresh();}
   catch(error){status.textContent=error.message;status.hidden=false;}
   finally{busy=false;close.disabled=false;input.disabled=false;update();}
  };
 });
}
