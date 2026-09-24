import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut,setPersistence,browserSessionPersistence} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,collection,onSnapshot,getDocs,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp,query,where} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {firebaseConfig,functionsRegion} from './firebase-config.js?v=20260923-real';
const $=id=>document.getElementById(id);
const board=$('board'),emptyState=$('emptyState'),searchInput=$('searchInput'),fileInput=$('fileInput');
const editNoteTitle=$('editNoteTitle'),editNoteText=$('editNoteText'),editNoteColor=$('editNoteColor'),editNoteAttachment=$('editNoteAttachment'),editAttachmentInfo=$('editAttachmentInfo'),removeNoteAttachment=$('removeNoteAttachment');
const editNoteModalEl=$('editNoteModal'),commentNoteModalEl=$('commentNoteModal'),commentText=$('commentText'),commentNoteTitle=$('commentNoteTitle');
const imageLightbox=$('imageLightbox'),imageLightboxImg=$('imageLightboxImg'),imageLightboxTitle=$('imageLightboxTitle');
let activeEditNoteId=null,activeCommentNoteId=null,activeImageItem=null,editRevision=0;
let auth,db,user=null,profile=null,ownerUid=null,items=[],allItems=[],users=[],zCounter=10;
let stopProfile=()=>{},stopBoard=()=>{},stopUsers=()=>{},showTrash=false,viewGeneration=0,busy=false,menuHideTimer=0,currentWorkspaceView='board';
const urls=new Set(),imageCache=new Map();
const escapeHtml=(v='')=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const admin=()=>profile?.role==='admin'&&profile?.status==='authorized';
const status=t=>$('statusLine').textContent=t;
function friendlyError(e){
 const code=String(e?.code||'').replace('functions/','');
 if(code==='internal'||code==='not-found'||/internal\s*\[0\]/i.test(String(e?.message||'')))return 'El servicio de la pizarra no está disponible. La administración debe publicar las funciones de Firebase.';
 if(code==='permission-denied')return 'No tenés permiso para realizar esta acción.';
 if(code==='unauthenticated')return 'Tu sesión venció. Ingresá nuevamente.';
 return e?.message||String(e);
}
const error=e=>{const message=friendlyError(e);status('Error: '+message);$('authError').textContent=message;if(currentWorkspaceView!=='board'){const notice=document.createElement('div');notice.className='alert alert-danger mb-3';notice.setAttribute('role','alert');notice.textContent=message;$('adminPanel').prepend(notice);}};
async function run(fn){if(busy){status('Esperá a que termine la operación en curso.');return;}busy=true;try{await fn();status('Cambios guardados.');}catch(e){error(e);}finally{busy=false;}}
const itemRef=id=>doc(db,'boards',ownerUid,'items',id);
async function mutate(action,data={}){if(!user||profile?.status!=='authorized')throw Error('Tu cuenta no está autorizada.');const now=serverTimestamp(),ref=itemRef(data.id);if(action==='create'){const i=data.item;return setDoc(ref,{ownerUid,type:i.type,title:String(i.title||'').slice(0,200),text:String(i.text||'').slice(0,20000),color:i.color||'note-yellow',x:Number(i.x)||0,y:Number(i.y)||0,comments:[],file:null,attachment:null,state:'active',createdAt:now,updatedAt:now,revision:1});}if(action==='move')return updateDoc(ref,{x:data.x,y:data.y,updatedAt:now,revision:(allItems.find(i=>i.id===data.id)?.revision||0)+1});if(action==='edit')return updateDoc(ref,{title:String(data.title||'').slice(0,200),text:String(data.text||'').slice(0,20000),color:data.color,updatedAt:now,revision:(data.revision||0)+1});if(action==='comment'){const i=allItems.find(x=>x.id===data.id);return updateDoc(ref,{comments:[...(i?.comments||[]),{id:crypto.randomUUID(),text:String(data.text||'').slice(0,2000),createdAt:new Date().toISOString(),authorUid:user.uid}],updatedAt:now,revision:(i?.revision||0)+1});}if(action==='trash'||action==='restore')return updateDoc(ref,{state:action==='trash'?'deleted':'active',updatedAt:now,[action==='trash'?'deletedAt':'restoredAt']:now,[action==='trash'?'deletedBy':'restoredBy']:user.uid});if(action==='purge')return deleteDoc(ref);if(action==='removeAttachment'){const i=allItems.find(x=>x.id===data.id);if(i?.attachment?.localId)await localDelete(i.attachment.localId);return updateDoc(ref,{attachment:null,updatedAt:now});}if(action==='attachLocal')return updateDoc(ref,{[data.target]:data.meta,updatedAt:now});if(action==='setStatus'&&admin()){const target=users.find(x=>x.id===data.uid);if(!target||target.role==='admin')throw Error('No se puede modificar este perfil.');return setDoc(doc(db,'users',data.uid),{ownerUid:data.uid,email:target.email||'',role:'user',status:data.status,updatedAt:now},{merge:true});}throw Error('Acción no disponible.');}

const localDb=()=>new Promise((ok,no)=>{const r=indexedDB.open('mi-pizarra-adjuntos',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
async function localPut(id,blob){const d=await localDb();return new Promise((ok,no)=>{const t=d.transaction('files','readwrite');t.objectStore('files').put(blob,`${user.uid}:${id}`);t.oncomplete=ok;t.onerror=()=>no(t.error);});}
async function localGet(id){const d=await localDb();return new Promise((ok,no)=>{const r=d.transaction('files').objectStore('files').get(`${user.uid}:${id}`);r.onsuccess=()=>r.result?ok(r.result):no(Error('El adjunto está guardado en otro dispositivo o navegador.'));r.onerror=()=>no(r.error);});}
async function localDelete(id){const d=await localDb();return new Promise((ok,no)=>{const t=d.transaction('files','readwrite');t.objectStore('files').delete(`${user.uid}:${id}`);t.oncomplete=ok;t.onerror=()=>no(t.error);});}
function setWorkspaceView(view='board'){
 const panelMode=view!=='board',panel=$('adminPanel');
 currentWorkspaceView=view;
 clearTimeout(menuHideTimer);
 $('appShell').classList.toggle('panel-mode',panelMode);
 $('appShell').classList.remove('board-menu-hidden');
 panel.classList.toggle('panel-view',panelMode);
 panel.hidden=!panelMode;
 $('ownBoardBtn').classList.toggle('view-active',view==='board');
 $('adminBtn').classList.toggle('view-active',view==='admin');
 $('trashBtn').classList.toggle('view-active',view==='trash');
 if(!panelMode)scheduleMenuHide();
}
function showBoardMenu(){if(currentWorkspaceView!=='board')return;clearTimeout(menuHideTimer);$('appShell').classList.remove('board-menu-hidden');scheduleMenuHide();}
function scheduleMenuHide(){clearTimeout(menuHideTimer);if(currentWorkspaceView!=='board'||!user||$('gate').hidden===false)return;menuHideTimer=setTimeout(()=>$('appShell').classList.add('board-menu-hidden'),2800);}
function clearView(){viewGeneration++;stopBoard();stopBoard=()=>{};items=[];allItems=[];board.querySelectorAll('.board-item').forEach(e=>e.remove());closeImageLightbox();document.querySelectorAll('.modal.show').forEach(e=>bootstrap.Modal.getInstance(e)?.hide());urls.forEach(u=>URL.revokeObjectURL(u));urls.clear();imageCache.clear();$('adminPanel').replaceChildren();setWorkspaceView('board');syncEmptyState();}
function syncEmptyState(){emptyState.style.display=items.length?'none':'grid';}
function filter(){const q=searchInput.value.trim().toLowerCase();board.querySelectorAll('.board-item').forEach(el=>{const item=items.find(i=>i.id===el.dataset.id);el.classList.toggle('hidden-by-search',!!q&&!`${item?.title} ${item?.text} ${(item?.comments||[]).map(c=>c.text).join(' ')} ${item?.attachment?.name||''}`.toLowerCase().includes(q));});}
function redraw(){const opened=new Set([...board.querySelectorAll('.note-comments.open')].map(e=>e.closest('.board-item').dataset.id));board.querySelectorAll('.board-item').forEach(e=>e.remove());items=allItems.filter(i=>i.state==='active');items.forEach(i=>{renderItem(i);const el=board.querySelector(`[data-id="${CSS.escape(i.id)}"]`);el.style.left=`${Math.min(i.x,Math.max(0,board.clientWidth-el.offsetWidth))}px`;el.style.top=`${Math.min(i.y,Math.max(0,board.clientHeight-80))}px`;if(opened.has(i.id)){el.querySelector('.note-comments')?.classList.add('open');el.querySelector('.note-comments-toggle')?.setAttribute('aria-expanded','true');}});filter();syncEmptyState();if(showTrash)renderTrash();}
function selectBoard(uid){clearView();ownerUid=uid;showTrash=false;status('Cargando pizarra…');const generation=viewGeneration;stopBoard=onSnapshot(query(collection(db,'boards',uid,'items'),where('ownerUid','==',uid)),snap=>{if(generation!==viewGeneration)return;allItems=snap.docs.map(s=>{const d=s.data();return {...d,id:s.id,size:d.file?.size||0,comments:(d.comments||[]).map(c=>({...c,dateLabel:c.legacyDateLabel||new Date(c.createdAt).toLocaleString('es')}))};});redraw();status(`${uid===user.uid?'Mi pizarra':'Pizarra de '+(users.find(u=>u.id===uid)?.email||uid)} · ${items.length} elementos`);},e=>{clearView();error(e);});}
function button(label,fn,danger=false){const b=document.createElement('button');b.className='btn btn-sm '+(danger?'btn-outline-danger':'btn-outline-light');b.textContent=label;b.onclick=()=>run(fn);return b;}
function row(label){const r=document.createElement('div');r.className='admin-row';const t=document.createElement('div');t.className='label';t.textContent=label;r.append(t);return r;}
function renderUsers(){const panel=$('adminPanel');showTrash=false;setWorkspaceView('admin');panel.replaceChildren();const h=document.createElement('h2');h.className='h4 mb-4';h.textContent='Administración de usuarios y pizarras';panel.append(h);for(const u of users){const r=row(`${u.email||u.id} · ${u.status} · ${u.role}`);r.append(button('Ver pizarra',async()=>selectBoard(u.id)));if(u.role!=='admin'){r.append(button('Autorizar',()=>mutate('setStatus',{uid:u.id,status:'authorized'})),button('Bloquear',()=>mutate('setStatus',{uid:u.id,status:'blocked'}),true));}panel.append(r);}}
function renderTrash(){const panel=$('adminPanel');showTrash=true;setWorkspaceView('trash');panel.replaceChildren();const h=document.createElement('h2');h.className='h4 mb-4';h.textContent='Papelera de esta pizarra';panel.append(h);const deleted=allItems.filter(i=>i.state!=='active');for(const i of deleted){const r=row(`${i.title} · ${i.state} · ${i.deletedAt?.toDate?.().toLocaleString('es')||''} · Eliminado por: ${i.deletedBy||'—'}`);if(admin()){if(i.state==='deleted')r.append(button('Restaurar',()=>mutate('restore',{id:i.id})));r.append(button(i.state==='purging'?'Reintentar eliminación':'Eliminar definitivamente',async()=>{if(confirm('Esta eliminación es irreversible e incluye todos los archivos de este elemento. ¿Continuar?'))await mutate('purge',{id:i.id});},true));}panel.append(r);}if(!deleted.length){const p=document.createElement('p');p.className='text-white-50';p.textContent='La papelera está vacía.';panel.append(p);}if(admin())panel.append(button('Adjuntos retirados / cargas pendientes',showUploads));else{const p=document.createElement('p');p.textContent='El administrador puede restaurar los elementos.';panel.append(p);}}
async function showUploads(){const selected=ownerUid,generation=viewGeneration,panel=$('adminPanel');const listing=[];for(const i of allItems){const docs=await getDocs(collection(db,'boards',selected,'items',i.id,'uploads'));for(const s of docs.docs){const u=s.data();if(u.state!=='active')listing.push({i,u});}}if(generation!==viewGeneration)return;panel.replaceChildren();for(const {i,u} of listing){const r=row(`${i.title} · ${u.name} · ${formatBytes(u.size)} · ${u.state}`);if(u.state==='trash'&&i.state==='active')r.append(button('Restaurar archivo',async()=>{await mutate('restoreUpload',{id:i.id,fileId:u.id});await showUploads();}));r.append(button('Eliminar archivo definitivamente',async()=>{if(confirm('¿Eliminar este archivo definitivamente?')){await mutate('purgeUpload',{id:i.id,fileId:u.id});await showUploads();}},true));panel.append(r);}if(!listing.length)panel.textContent='No hay adjuntos retirados ni cargas pendientes.';panel.append(button('Volver a papelera',async()=>renderTrash()));}
async function fileBlob(file){if(!file?.localId)throw Error('Este adjunto no está disponible en este dispositivo.');return localGet(file.localId);}
async function download(file){const generation=viewGeneration,blob=await fileBlob(file);if(generation!==viewGeneration)return;const url=URL.createObjectURL(blob),a=document.createElement('a');urls.add(url);a.href=url;a.download=file.name||'archivo';document.body.append(a);a.click();a.remove();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},30000);}
async function loadImage(item,el){const generation=viewGeneration,key=item.file?.localId;try{let url=imageCache.get(key);if(!url){const blob=await fileBlob(item.file);if(generation!==viewGeneration)return;url=URL.createObjectURL(blob);urls.add(url);imageCache.set(key,url);}if(!el.isConnected)return;item.dataUrl=url;el.querySelector('img').src=url;}catch(e){if(generation===viewGeneration){el.querySelector('img').alt='Disponible solo en el dispositivo donde se guardó';}}}
async function uploadTo(itemId,file){if(ownerUid!==user.uid)throw Error('Los adjuntos locales solo se agregan a tu propia pizarra.');if(file.size>25*1024*1024)throw Error('Máximo 25 MB por archivo.');const localId=crypto.randomUUID();status(`Guardando ${file.name} en este dispositivo…`);await localPut(localId,file);const item=allItems.find(i=>i.id===itemId),meta={localId,name:file.name,type:file.type||'application/octet-stream',size:file.size,storage:'indexeddb'};await mutate('attachLocal',{id:itemId,target:item?.type==='note'?'attachment':'file',meta});}
function newItem(type,title,text='',color='note-yellow'){return {type,title,text,color,x:Math.max(8,Math.random()*Math.max(8,board.clientWidth-340)),y:Math.max(8,Math.random()*Math.max(8,board.clientHeight-280))};}
  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    const units = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function getFileIcon(name='') {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'bi-file-earmark-pdf';
    if (['doc','docx'].includes(ext)) return 'bi-file-earmark-word';
    if (['xls','xlsx','csv'].includes(ext)) return 'bi-file-earmark-excel';
    if (['ppt','pptx'].includes(ext)) return 'bi-file-earmark-ppt';
    if (ext === 'txt') return 'bi-file-earmark-text';
    return 'bi-file-earmark';
  }

  function getTypeClass(item) {
    if (item.type === 'note') return '';
    if (item.type === 'image') return 'type-image';
    const ext = (item.title || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'type-pdf';
    if (['doc','docx'].includes(ext)) return 'type-word';
    if (['xls','xlsx','csv'].includes(ext)) return 'type-excel';
    if (['ppt','pptx'].includes(ext)) return 'type-powerpoint';
    if (['txt','rtf','md'].includes(ext)) return 'type-text';
    return 'type-generic';
  }


  function openImageLightbox(item) {
    if (!item || item.type !== 'image' || !item.dataUrl) return;
    activeImageItem = item;
    imageLightboxImg.src = item.dataUrl;
    imageLightboxImg.alt = item.title || 'Imagen';
    imageLightboxTitle.textContent = item.title || 'Vista previa';
    imageLightbox.classList.add('show');
    imageLightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeImageLightbox() {
    imageLightbox.classList.remove('show');
    imageLightbox.setAttribute('aria-hidden', 'true');
    imageLightboxImg.src = '';
    activeImageItem = null;
    document.body.style.overflow = 'hidden';
  }

  function renderItem(item) {
    const el = document.createElement('article');
    el.className = `board-item ${item.color || ''} ${getTypeClass(item)}`.trim();
    el.dataset.id = item.id;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.zIndex = ++zCounter;
    el.style.setProperty('--tilt', `${item.tilt || 0}deg`);

    let body = '';
    if (item.type === 'note') {
      item.comments = Array.isArray(item.comments) ? item.comments : [];

      const attachmentHtml = item.attachment ? `
        <div class="note-attachment">
          <div class="note-attachment-icon"><i class="bi bi-paperclip"></i></div>
          <div class="note-attachment-info">
            <div class="note-attachment-name" title="${escapeHtml(item.attachment.name || 'Archivo adjunto')}">${escapeHtml(item.attachment.name || 'Archivo adjunto')}</div>
            <div class="note-attachment-meta">${formatBytes(item.attachment.size || 0)}</div>
          </div>
          <button type="button" class="btn btn-outline-secondary btn-sm download-note-attachment" title="Descargar archivo adjunto" aria-label="Descargar archivo adjunto">
            <i class="bi bi-download"></i>
          </button>
        </div>` : '';

      const commentsHtml = item.comments.length
        ? item.comments.map(c => `
          <div class="note-comment">
            <div class="note-comment-text">${escapeHtml(c.text || '')}</div>
            <div class="note-comment-date">${escapeHtml(c.dateLabel || '')}</div>
          </div>`).join('')
        : `<div class="note-comment-empty">Sin comentarios todavía.</div>`;

      body = `
        <div class="item-body"><div class="note-body">${escapeHtml(item.text || '')}</div></div>
        ${attachmentHtml}
        <div class="note-comments">
          <div class="note-comments-header">
            <button type="button"
                    class="note-comments-toggle"
                    aria-expanded="false"
                    aria-controls="comments-${item.id}">
              <span class="note-comments-toggle-main">
                <i class="bi bi-chat-left-text"></i>
                <span>Comentarios</span>
                <span class="comment-badge">${item.comments.length}</span>
              </span>
              <i class="bi bi-chevron-down note-comments-chevron"></i>
            </button>
          </div>

          <div id="comments-${item.id}" class="note-comments-panel">
            <div class="note-comments-list">${commentsHtml}</div>
          </div>
        </div>`;
    } else if (item.type === 'image') {
      body = `<div class="item-body">
        <img class="media-preview" src="${item.dataUrl || ''}" alt="${escapeHtml(item.title)}">
        <div class="meta mt-2">${formatBytes(item.size)}</div>
      </div>`;
    } else {
      body = `<div class="item-body">
        <div class="file-card">
          <div class="file-icon"><i class="bi ${getFileIcon(item.title)}"></i></div>
          <div class="min-w-0 flex-grow-1">
            <div class="file-name-standard" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
            <div class="meta">${formatBytes(item.size)}</div>
          </div>
          <a href="#" download="${escapeHtml(item.title)}" class="btn btn-sm btn-outline-secondary" title="Abrir o descargar"><i class="bi bi-box-arrow-up-right"></i></a>
        </div>
      </div>`;
    }

    el.innerHTML = `
      <span class="pin" aria-hidden="true"></span>
      <div class="item-header">
        <i class="bi bi-grip-vertical text-secondary"></i>
        <div class="item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="item-actions">
          ${item.type === 'note' ? `
            <button type="button" class="btn btn-sm btn-link text-primary p-0 note-action-btn edit-note-item" title="Editar nota" aria-label="Editar nota">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button type="button" class="btn btn-sm btn-link text-secondary p-0 note-action-btn comment-note-item" title="Agregar comentario" aria-label="Agregar comentario">
              <i class="bi bi-chat-dots"></i>
            </button>
          ` : ''}
          <button class="btn btn-sm btn-link text-danger p-0 delete-item" aria-label="Eliminar"><i class="bi bi-trash3"></i></button>
        </div>
      </div>
      ${body}
    `;

    board.appendChild(el);
    makeDraggable(el);

    const imagePreview = el.querySelector('.media-preview');
    if (imagePreview && item.type === 'image') {
      imagePreview.setAttribute('title', 'Clic para ampliar');
      imagePreview.addEventListener('click', (e) => {
        e.stopPropagation();
        openImageLightbox(item);
      });
    }


    el.querySelector('.edit-note-item')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      activeEditNoteId = item.id;
      editNoteTitle.value = item.title || '';
      editNoteText.value = item.text || '';
      editNoteColor.value = item.color || 'note-yellow';
      editNoteAttachment.value = '';
      removeNoteAttachment.checked = false;

      editAttachmentInfo.textContent = item.attachment
        ? `Adjunto actual: ${item.attachment.name} (${formatBytes(item.attachment.size || 0)})`
        : 'Esta nota no tiene archivo adjunto.';

      bootstrap.Modal.getOrCreateInstance(editNoteModalEl).show();
    });

    el.querySelector('.comment-note-item')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      activeCommentNoteId = item.id;
      commentText.value = '';
      commentNoteTitle.textContent = `Nota: ${item.title || 'Nota'}`;

      bootstrap.Modal.getOrCreateInstance(commentNoteModalEl).show();
    });


    const commentsToggle = el.querySelector('.note-comments-toggle');
    if (commentsToggle) {
      commentsToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const commentsBox = commentsToggle.closest('.note-comments');
        const isOpen = commentsBox.classList.toggle('open');
        commentsToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    el.querySelector('.delete-item').addEventListener('click', () => run(() => mutate('trash', {id:item.id})));
    el.querySelector('.download-note-attachment')?.addEventListener('click', () => run(() => download(item.attachment)));
    el.querySelector('a[download]')?.addEventListener('click', e => {e.preventDefault();run(() => download(item.file));});
    if (item.type === 'image' && item.file) loadImage(item, el);
  }

  function makeDraggable(el) {
    const handle = el.querySelector('.item-header');
    let startX = 0, startY = 0, baseX = 0, baseY = 0, dragging = false;

    const onMove = (e) => {
      if (!dragging) return;
      const point = e.touches?.[0] || e;
      const boardRect = board.getBoundingClientRect();
      const maxX = Math.max(0, board.clientWidth - el.offsetWidth);
      const maxY = Math.max(0, board.clientHeight - el.offsetHeight);
      const x = Math.max(0, Math.min(maxX, baseX + point.clientX - startX));
      const y = Math.max(0, Math.min(maxY, baseY + point.clientY - startY));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      const item = items.find(x => x.id === el.dataset.id);
      if (item) {
        item.x = parseFloat(el.style.left) || 0;
        item.y = parseFloat(el.style.top) || 0;
        item.tilt = 0;
        el.style.setProperty('--tilt', '0deg');
        run(() => mutate('move', {id:item.id,x:item.x,y:item.y}));
      }
    };

    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, a')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      baseX = parseFloat(el.style.left) || 0;
      baseY = parseFloat(el.style.top) || 0;
      el.style.zIndex = ++zCounter;
      el.classList.add('dragging');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp, { once: true });
      document.addEventListener('pointercancel', onUp, { once: true });
      e.preventDefault();
    });
  }

$('editNoteModal').addEventListener('show.bs.modal',()=>{editRevision=items.find(i=>i.id===activeEditNoteId)?.revision;});
$('uploadBtn').onclick=()=>fileInput.click();
fileInput.onchange=()=>{const files=[...fileInput.files];fileInput.value='';run(async()=>{for(const file of files){const id=crypto.randomUUID();await mutate('create',{id,item:newItem(file.type.startsWith('image/')?'image':'file',file.name)});await uploadTo(id,file);}});};
$('saveNoteBtn').onclick=()=>run(async()=>{const text=$('noteText').value.trim();if(!text)throw Error('Escribí el contenido de la nota.');const id=crypto.randomUUID();await mutate('create',{id,item:newItem('note',$('noteTitle').value.trim()||'Nota',text,$('noteColor').value)});bootstrap.Modal.getInstance($('noteModal'))?.hide();const file=$('noteAttachment').files[0];$('noteText').value='';$('noteTitle').value='';$('noteAttachment').value='';if(file)await uploadTo(id,file);});
$('updateNoteBtn').onclick=()=>run(async()=>{const id=activeEditNoteId;await mutate('edit',{id,title:editNoteTitle.value,text:editNoteText.value,color:editNoteColor.value,revision:editRevision});bootstrap.Modal.getInstance(editNoteModalEl)?.hide();if(removeNoteAttachment.checked)await mutate('removeAttachment',{id});else if(editNoteAttachment.files[0])await uploadTo(id,editNoteAttachment.files[0]);});
$('saveCommentBtn').onclick=()=>run(async()=>{await mutate('comment',{id:activeCommentNoteId,text:commentText.value});bootstrap.Modal.getInstance(commentNoteModalEl)?.hide();commentText.value='';});
searchInput.oninput=filter;
$('clearBoardBtn').onclick=()=>run(async()=>{if(confirm('¿Enviar todos los elementos activos a la papelera?'))for(const item of [...items])await mutate('trash',{id:item.id});});
window.addEventListener('resize',redraw);
$('imageLightboxClose').onclick=closeImageLightbox;
imageLightbox.onclick=e=>{if(e.target===imageLightbox)closeImageLightbox();};
$('imageLightboxDownload').onclick=()=>run(()=>download(activeImageItem.file));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeImageLightbox();});
$('ownBoardBtn').onclick=()=>{if(!busy&&user)selectBoard(user.uid);};
$('adminBtn').onclick=()=>{if(admin())renderUsers();};
$('trashBtn').onclick=renderTrash;
$('menuPeekBtn').onclick=showBoardMenu;
$('accountBar').addEventListener('pointerenter',()=>clearTimeout(menuHideTimer));
$('accountBar').addEventListener('pointerleave',scheduleMenuHide);
$('accountBar').addEventListener('focusin',()=>clearTimeout(menuHideTimer));
$('accountBar').addEventListener('focusout',scheduleMenuHide);
document.addEventListener('pointermove',e=>{if(e.clientY<=12&&currentWorkspaceView==='board')showBoardMenu();});
for(const name of ['logoutBtn','gateLogout'])$(name).onclick=()=>run(()=>signOut(auth));
$('loginForm').onsubmit=e=>{e.preventDefault();run(()=>signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value));};
$('registerBtn').onclick=()=>run(async()=>{if(!$('loginForm').reportValidity())return;await createUserWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);});
$('resetBtn').onclick=()=>run(async()=>{if(!$('email').reportValidity())return;await sendPasswordResetEmail(auth,$('email').value.trim());$('authError').textContent='Si la cuenta existe, recibirás instrucciones por correo.';});

async function importLegacy(){
 if(ownerUid!==user.uid)throw Error('La importación se hace únicamente a tu propia pizarra.');
 let raw=localStorage.getItem('pizarra-digital-v1');
 if(!raw){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';raw=await new Promise(resolve=>{input.onchange=async()=>resolve(input.files[0]?await input.files[0].text():null);input.oncancel=()=>resolve(null);input.click();});}
 if(!raw)return;
 const data=JSON.parse(raw);if(!Array.isArray(data))throw Error('El respaldo debe contener un arreglo de elementos de c2.html.');
 if(!confirm(`¿Importar ${data.length} elementos a ${user.email}? Los datos locales se conservarán.`))return;
 const selected=ownerUid;let count=0;
 for(const old of data){
  if(ownerUid!==selected||user?.uid!==selected)throw Error('La sesión cambió.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(old)));
  const id='legacy-'+[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  // Validate and decode before creating the document. Never silently drop unsupported local blobs.
  const localFile=old.type==='note'?old.attachment:(old.dataUrl?old:null);
  if((old.fileId||old.blobId||old.attachment?.fileId)&&!localFile?.dataUrl)throw Error('Este respaldo usa IndexedDB. Exportá los archivos originales antes de importarlo.');
  if(old.type!=='note'&&!localFile)throw Error('Faltan los datos del archivo: '+old.title);
  let file=null;
  if(localFile){if(typeof localFile.dataUrl!=='string'||!localFile.dataUrl.startsWith('data:'))throw Error('Adjunto sin data URL válido: '+old.title);const blob=await (await fetch(localFile.dataUrl)).blob();file=new File([blob],localFile.name||old.title||'archivo',{type:blob.type});if(file.size>25*1024*1024)throw Error('Archivo mayor a 25 MB: '+file.name);}
  await mutate('create',{id,item:{type:old.type,title:old.title||'Nota',text:old.text||'',color:old.color||'note-yellow',x:Math.max(0,Number(old.x)||0),y:Math.max(0,Number(old.y)||0),comments:old.comments||[],legacyCreatedAt:old.createdAt||'',legacyUpdatedAt:old.updatedAt||''}});
  const saved=(await getDoc(doc(db,'boards',selected,'items',id))).data();
  if(file&&!saved.attachment&&!saved.file&&saved.state==='active')await uploadTo(id,file);
  count++;status(`Importados ${count}/${data.length}`);
 }
 alert(`Importación completada: ${count} elementos. Se conservó el original local.`);
}
$('importBtn').onclick=()=>run(importLegacy);

async function init(){
 if(firebaseConfig.projectId!=='pizarradig-10acf'||['apiKey','authDomain','storageBucket','appId','messagingSenderId'].some(k=>!firebaseConfig[k])){
  $('gateMessage').textContent='Falta completar firebase-config.js con la configuración real de pizarradig-10acf. La persona administradora debe completar la configuración de Firebase.';return;
 }
 const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
 await setPersistence(auth,browserSessionPersistence);
 onAuthStateChanged(auth,async current=>{
  stopProfile();stopUsers();clearView();user=current;profile=null;users=[];$('adminBtn').hidden=true;$('gate').hidden=false;$('loginForm').hidden=!!current;$('gateLogout').hidden=!current;$('password').value='';$('authError').textContent='';$('accountLabel').textContent='';
  if(!current){$('gateMessage').textContent='Ingresá o creá una cuenta. El administrador debe autorizar las cuentas nuevas.';return;}
  $('gateMessage').textContent='Verificando autorización…';
  try{
   // Existing users are verified directly in Firestore. A missing Functions
   // deployment must never lock an already authorized account out of its board.
   const profileRef=doc(db,'users',current.uid),existing=await getDoc(profileRef);
   if(user?.uid!==current.uid)return;
   if(!existing.exists())await setDoc(profileRef,{ownerUid:current.uid,email:current.email||'',role:'user',status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
   if(user?.uid!==current.uid)return;
   stopProfile=onSnapshot(profileRef,snap=>{
    const previous=profile;profile=snap.data();$('accountLabel').textContent=`${current.email} · ${profile?.status||'pending'}`;
    const allowed=profile?.status==='authorized';$('gate').hidden=allowed;$('adminBtn').hidden=!admin();
    if(!allowed){stopUsers();clearView();$('gateMessage').textContent=profile?.status==='blocked'?'Tu acceso fue bloqueado. Contactá al administrador.':'Tu cuenta está pendiente de autorización.';return;}
    if(!previous||previous.status!=='authorized'||previous.role!==profile.role){stopUsers();selectBoard(current.uid);if(admin())stopUsers=onSnapshot(collection(db,'users'),s=>{users=s.docs.map(x=>({...x.data(),id:x.id}));if(!$('adminPanel').hidden&&!showTrash)renderUsers();},error);}
   },e=>{clearView();$('gate').hidden=false;error(e);});
  }catch(e){error(e);$('gateMessage').textContent=friendlyError(e);}
 });
}
init().catch(error);
