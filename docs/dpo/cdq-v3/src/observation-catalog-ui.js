import {observationCatalog,observationKey} from './observation-catalog.js';
export function observationCatalogPanel({db,esc,cloud}){
 const entries=observationCatalog(db.observaciones,db.observationCatalog),manage=['technical','director'].includes(cloud?.profile?.role);
 return '<section class="panel"><h2>Catálogo de observaciones</h2><p>Incluye las descripciones ya cargadas. Las ediciones se aplican a nuevas observaciones; los textos registrados se conservan.</p>'+(manage?'<button id="observation-catalog-new" class="primary">+ Nueva descripción</button> <button id="observation-catalog-history" class="secondary">Historial</button>':'')+'<p id="observation-catalog-error" role="alert"></p><input id="observation-catalog-search" type="search" placeholder="Buscar descripción" aria-label="Buscar descripción"><div class="table-scroll"><table><thead><tr><th>Descripción estándar</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+entries.map((e,i)=>'<tr data-observation-catalog-row><td>'+esc(e.description)+'</td><td>'+(e.active?'Activa':'Inactiva')+'</td><td>'+(manage?'<button class="secondary" data-observation-edit="'+i+'">Editar</button> <button class="secondary" data-observation-toggle="'+i+'">'+(e.active?'Desactivar':'Activar')+'</button>':'Consulta')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
export function bindObservationCatalog({db,esc,cloud,load}){
 const entries=observationCatalog(db.observaciones,db.observationCatalog),modal=document.querySelector('#modal');
 document.querySelector('#observation-catalog-history')?.addEventListener('click',async()=>{
  try{const rows=await cloud.call('observationCatalogHistory',{});modal.innerHTML='<h2>Historial del catálogo</h2>'+rows.map(r=>'<article><p>Revisión '+r.revision+' · '+esc(db.users?.find(u=>u.id===r.actor)?.description||'Responsable registrado')+'</p><p>Antes: '+esc(r.before?.description||'Alta')+'</p><p>Después: '+esc(r.after.description)+' · '+(r.after.active?'Activa':'Inactiva')+'</p></article>').join('')+'<button id="observation-history-close">Cerrar</button>';modal.showModal();modal.querySelector('button').onclick=()=>modal.close();}catch(e){fail(e);}
 });
 const fail=e=>{document.querySelector('#observation-catalog-error').textContent=e.message;};
 const save=async(entry,description,active)=>{
  if(entries.some(e=>e!==entry&&observationKey(e.description)===observationKey(description)))throw Error('Esta descripción ya existe, incluso si está inactiva.');
  await cloud.call('saveObservationCatalog',{expectedRevision:db.observationCatalog?.revision||0,entry:{...entry,id:entry?.id||crypto.randomUUID(),description,active,sources:entry?.sources||[]}});
  await load();
 };
 const open=entry=>{
  modal.innerHTML='<form id="observation-description-form"><h2>'+(entry?'Editar descripción':'Nueva descripción')+'</h2><label>Descripción<textarea name="description" required maxlength="2000">'+esc(entry?.description||'')+'</textarea></label><p>Los documentos ya registrados conservarán el texto original.</p><p id="observation-description-error" role="alert"></p><button class="primary">Guardar</button> <button type="button" id="observation-description-close" class="secondary">Cancelar</button></form>';
  modal.showModal();modal.querySelector('#observation-description-close').onclick=()=>modal.close();
  modal.querySelector('form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await save(entry,e.target.elements.description.value,entry?.active??true);modal.close();}catch(error){modal.querySelector('#observation-description-error').textContent=error.message;}finally{if(e.submitter)e.submitter.disabled=false;}};
 };
 document.querySelector('#observation-catalog-new')?.addEventListener('click',()=>open(null));
 document.querySelectorAll('[data-observation-edit]').forEach(b=>b.onclick=()=>open(entries[+b.dataset.observationEdit]));
 document.querySelectorAll('[data-observation-toggle]').forEach(b=>b.onclick=async()=>{b.disabled=true;const entry=entries[+b.dataset.observationToggle];try{await save(entry,entry.description,!entry.active);}catch(e){fail(e);b.disabled=false;}});
 document.querySelector('#observation-catalog-search').oninput=e=>{const key=observationKey(e.target.value);document.querySelectorAll('[data-observation-catalog-row]').forEach(row=>row.hidden=!observationKey(row.cells[0].textContent).includes(key));};
}
