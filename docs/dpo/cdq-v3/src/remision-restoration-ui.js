export function bindRestoration({db,cloud,esc,load}) {
 if(!cloud?.spark||!cloud.profile?.active||cloud.profile.role!=='technical')return;
 const first=document.querySelector('[data-remision-restore-select]'),panel=first?.closest('section.panel');
 if(!panel)return;
 const bar=document.createElement('div');bar.className='collection-toolbar';
 bar.innerHTML='<label><input type="checkbox" data-restore-page> Seleccionar anuladas de esta página</label><button class="secondary" data-restore-bulk disabled>Restaurar seleccionadas (0)</button>';
 panel.prepend(bar);
 const boxes=()=>[...panel.querySelectorAll('[data-remision-restore-select]')];
 const button=bar.querySelector('button'),all=bar.querySelector('input');
 const update=()=>{const n=boxes().filter(b=>b.checked).length;button.textContent=`Restaurar seleccionadas (${n})`;button.disabled=!n;all.checked=n>0&&n===boxes().length;all.indeterminate=n>0&&!all.checked;};
 boxes().forEach(b=>b.onchange=update);all.onchange=()=>{boxes().forEach(b=>b.checked=all.checked);update();};
 button.onclick=()=>{
  const ids=new Set(boxes().filter(b=>b.checked).map(b=>b.dataset.remisionRestoreSelect));
  const rows=db.remisiones.filter(r=>ids.has(r.id)&&r.annulment),modal=document.querySelector('#modal');
  modal.innerHTML=`<form><h2>Restaurar ${rows.length} remisiones</h2><p>Se recuperarán los registros originales y sus vínculos. La anulación y la restauración quedarán en el historial.</p><ul>${rows.map(r=>`<li>${esc(db.cacs.find(c=>c.id===r.cacId)?.name||r.cacId)} · ${esc(r.expediente||r.id)}</li>`).join('')}</ul><label>Motivo de restauración<textarea name="reason" required maxlength="2000"></textarea></label><p role="status"></p><div class="form-actions"><button type="button" class="secondary">Cancelar</button><button class="primary">Confirmar restauración</button></div></form>`;
  const close=modal.querySelector('[type=button]');close.onclick=()=>modal.close();modal.showModal();
  modal.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const reason=new FormData(e.target).get('reason');if(!reason.trim())return;
   e.submitter.disabled=true;close.disabled=true;let completed=0;const failures=[];
   for(const r of rows){try{await cloud.call('restoreRemision',{gerenciaId:db.cacs.find(c=>c.id===r.cacId)?.gerenciaId,id:r.id,expectedRevision:r.revision,reason});completed++;}catch(error){failures.push(`${r.expediente||r.id}: ${error.message}`);}}
   modal.querySelector('[role=status]').textContent=`Restauradas: ${completed}. Errores: ${failures.length}. ${failures.join(' · ')} Las restauradas están disponibles en Vigentes.`;
   close.disabled=false;close.textContent='Cerrar y actualizar';close.onclick=async()=>{modal.close();await load();};
  };
 };
}
