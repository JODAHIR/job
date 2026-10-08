import {strict as assert} from 'node:assert';
import {relatedProcedures} from '../src/procedure-search.js';
const items=[
 {title:'Créditos — Estado de Resolución',questions:'cambio de estado',support:'WAR OPERACIONES',category:'Créditos',keywords:['creditos','resolucion']},
 {title:'Cobranza normal',questions:'pago efectivo',support:'AS400',category:'Cobranzas CAC',keywords:['cobranza','efectivo']}
];
assert.equal(relatedProcedures(items,['resolucion'],'estado de resolucion')[0].title,items[0].title);
assert.equal(relatedProcedures(items,['resolucion'],'resolucion')[0].title,items[0].title);
assert.equal(relatedProcedures(items,['efectiv'],'efectiv')[0].title,items[1].title);
assert.equal(relatedProcedures(items,['desconocido'],'desconocido').length,0);
console.log('4 pruebas de búsqueda relacionada correctas.');
