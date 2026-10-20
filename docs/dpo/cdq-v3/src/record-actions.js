export function creationActions(collection,canCreate,spark) {
 if(!canCreate)return '';
 if(collection==='remisiones'&&spark)return '<details class="new-record-actions"><summary class="primary">+ Nuevo registro</summary><div><button data-new="remisiones" class="secondary">Registrar una remisión</button><button class="secondary" id="generate-remisiones">Generar remisiones de la gerencia</button></div></details>';
 // In Spark the existing new-lot handler already opens the automatic generator.
 return `<button class="primary" data-new="${collection}">+ Nuevo registro</button>`;
}
