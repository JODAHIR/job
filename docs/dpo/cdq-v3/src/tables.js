// Enhance existing tables without changing row actions or export datasets.
export function installTables(root=document){
 for(const table of root.querySelectorAll('table:not([data-paged])')){
  table.dataset.paged='true';
  const body=table.tBodies[0],rows=[...body.rows];
  if(!rows.length||rows[0].querySelector('.empty'))continue;
  let page=0,size=20,column=-1,direction=1;
  const controls=document.createElement('div');controls.className='table-controls';
  const prev=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span'),select=document.createElement('select');
  prev.textContent='Anterior';next.textContent='Siguiente';select.setAttribute('aria-label','Filas por página');
  for(const n of [20,25,50])select.add(new Option(`${n} filas`,n));
  controls.append(prev,label,next,select);table.parentElement.after(controls);
  function draw(){rows.forEach((r,i)=>{r.hidden=i<page*size||i>=(page+1)*size;body.append(r)});label.textContent=` ${page*size+1}–${Math.min((page+1)*size,rows.length)} de ${rows.length} `;prev.disabled=page===0;next.disabled=(page+1)*size>=rows.length;}
  prev.onclick=()=>{page--;draw()};next.onclick=()=>{page++;draw()};select.onchange=()=>{size=+select.value;page=0;draw()};
  [...table.tHead.rows[0].cells].forEach((th,i)=>{if(!th.textContent.trim())return;const button=document.createElement('button');button.className='link';button.textContent=th.textContent+' ↕';th.replaceChildren(button);button.onclick=()=>{direction=column===i?-direction:1;column=i;rows.sort((a,b)=>a.cells[i].textContent.trim().localeCompare(b.cells[i].textContent.trim(),'es',{numeric:true,sensitivity:'base'})*direction);for(const h of table.tHead.rows[0].cells)h.removeAttribute('aria-sort');th.setAttribute('aria-sort',direction===1?'ascending':'descending');page=0;draw()};});draw();
 }
}
if(typeof document!=='undefined')new MutationObserver(()=>installTables()).observe(document.documentElement,{childList:true,subtree:true});
