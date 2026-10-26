export function creationActions(collection,canCreate,spark,profile) {
 if(!canCreate)return '';
 if(collection==='remisiones'&&spark)return `<div class="remision-actions"><button data-new="remisiones" class="primary">+ Nuevo registro</button>${profile?.active&&profile.role==='technical'?'<button class="secondary" id="generate-remisiones">Generar remisiones por gerencia</button>':''}</div>`;
 // In Spark the existing new-lot handler already opens the automatic generator.
 return `<button class="primary" data-new="${collection}">+ Nuevo registro</button>`;
}
