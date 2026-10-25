import {intelligenceDashboard,intelligenceFilters,civilDate} from './intelligence.js?dashboard-20261025';
export const indicatorDefinitions=[
 ['declared','Documentos declarados','Suma de cantidades declaradas de los lotes válidos seleccionados.','lotes'],
 ['observed','Documentos observados','Documentos únicos con estado observado o al menos una observación; incluye regularizados.','documentos'],
 ['observations','Observaciones registradas','Número de observaciones de los documentos de las remisiones seleccionadas.','observaciones'],
 ['remissions','Remisiones recibidas','Remisiones vigentes con fecha de recepción válida en el ámbito y período seleccionados.','remisiones'],
 ['lots','Lotes documentales','Cantidad de lotes de las remisiones seleccionadas.','lotes'],
 ['pendingControls','Remisiones pendientes de control','Remisiones con control por excepción abierto; excluye controles históricos sin evidencia.','remisiones'],
 ['closedLots','Controles finalizados','Lotes con revisión vigente guardada, fecha y responsable; pueden conservar observaciones pendientes.','lotes'],
 ['pendingObserved','Documentos por regularizar','Documentos observados con alguna observación no regularizada o sin evidencia de regularización.','documentos'],
 ['regularized','Documentos regularizados','Documentos observados cuyas observaciones están todas regularizadas. Conservan el historial.','documentos'],
 ['progress','Avance del control','100 × documentos revisados (hasta el total declarado de cada lote) / declarados. Una revisión con observaciones también acredita revisión.','lotes'],
];
export function indicatorValue(model,key) {
 if(key==='remissions')return model.remissions.filter(r=>civilDate(r.receivedOn)).length;
 if(key==='pendingControls')return model.durations.some(r=>r.state==='unknown')?null:model.durations.filter(r=>r.state==='pending').length;
 return model[key];
}
export function intelligenceReport(db,filters,section='summary',source='Datos autorizados') {
 const m=intelligenceDashboard(db,intelligenceFilters(filters)),name=(c,id)=>db[c]?.find(r=>r.id===id)?.name||id;
 let headers,rows;
 if(section==='rankings'){headers=['Gerencia','CAC','Declarados','Observados','Documentos pendientes','Históricos sin cierre'];rows=m.rankings.map(r=>[name('gerencias',r.gerenciaId),r.name,r.declared,r.observed,r.pendingDocuments,r.legacy]);}
 else if(section==='evolution'){headers=['Período','Remisiones','Declarados','Observaciones','Documentos regularizados','Cobertura'];rows=m.evolution.map(r=>[r.label,r.remissions,r.declared,r.observations,r.regularized,r.registered?'Registros disponibles':'Sin remisiones registradas']);}
 else if(section==='observations'){headers=['Documento','Descripción','Fecha','Responsable','Estado','Regularización'];rows=m.observationRows.map(o=>[m.documentRows.find(d=>d.id===o.documentId)?.number||o.documentId,o.description,o.date,o.owner,o.status,o.regularizedOn||'Sin fecha documentada']);}
 else if(section==='deadlines'){headers=['Remisión','CAC','Estado control','Días hábiles','Cierre','Cumplimiento'];rows=m.durations.map(r=>[r.id,name('cacs',m.remissions.find(x=>x.id===r.id)?.cacId),r.state==='unknown'?'Sin evidencia de cierre':r.state==='closed'?'Finalizado':'Pendiente',r.elapsed??'No evaluable',r.closedOn||'Sin fecha documentada',r.onTime===null?'No evaluable':r.onTime?'En plazo':'Fuera de plazo']);}
 else {headers=['Indicador','Valor','Fórmula / disponibilidad'];rows=indicatorDefinitions.map(([key,label,formula])=>[label,indicatorValue(m,key)??'No evaluable',formula]);rows.push(['IGD','No activado',m.igd.state]);}
 return {title:'CAH · Inteligencia Documental',source,scopeLabel:Object.entries(intelligenceFilters(filters)).filter(([,v])=>v!=='').map(([k,v])=>`${({year:'Año',month:'Mes',half:'Quincena',gerencia:'Gerencia',cac:'CAC',from:'Desde',to:'Hasta',dateField:'Fecha de',control:'Control',observation:'Observación',remission:'Remisión'})[k]}: ${k==='gerencia'?name('gerencias',v):k==='cac'?name('cacs',v):v}`).join(' · '),generatedAt:new Date().toISOString(),note:`${section==='evolution'?'Serie contextual de seis quincenas hasta el período seleccionado. ':''}${m.comparisonNote} ${m.legacyLots} lotes sin evidencia de cierre. IGD desactivado.`,headers,rows};
}
