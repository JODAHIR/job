export function creationActions(collection,canCreate,spark,profile) {
 if(!canCreate)return '';
 if(collection==='remisiones'&&spark)return `<div class="remision-actions"><button data-new="remisiones" class="primary">+ Nuevo registro</button>${profile?.active&&profile.role==='technical'?'<button class="secondary" id="generate-remisiones">Generar remisiones por gerencia</button>':''}</div>`;
 // Keep the existing generator and permission checks for GDZS registration.
 if(collection==='lotes'&&spark)return '<button class="primary" data-new="lotes">+ Nuevo registro por GDZS</button>';
 return `<button class="primary" data-new="${collection}">+ Nuevo registro</button>`;
}
