import assert from 'node:assert/strict';
import {reportContext,reportButton} from '../docs/dpo/cdq-v3/src/remision-report-ui.js';
import {closureFilename} from '../dpo-build/providencia.js';
const db={gerencias:[{id:'norte',name:'Gerencia Norte',responsables:[{correo:'norte@example.test'}]},{id:'chaco',name:'Gerencia Chaco',responsables:[{correo:'chaco@example.test'}]}],cacs:[{id:'n',gerenciaId:'norte'},{id:'c',gerenciaId:'chaco'}]};
const north={id:'rn',cacId:'n',receivedOn:'2026-10-22'},chaco={id:'rc',cacId:'c',receivedOn:'2026-10-22'};
const cloud={spark:true,profile:{active:true,role:'asistente'},auth:{currentUser:{uid:'u',emailVerified:true,email:'norte@example.test'}}};
assert.deepEqual(reportContext(db,cloud,[north]),{remisionId:'rn',gerenciaId:'norte'});
assert.equal(reportContext(db,cloud,[chaco]),null);
assert.equal(reportContext(db,{...cloud,spark:false},[north]),null);
assert.equal(reportContext(db,cloud,[{...north,annulment:{}}]),null);
assert.equal(reportContext(db,cloud,[{...north,receivedOn:''}]),null);
assert.equal(reportContext(db,{...cloud,profile:{active:false,role:'technical'}},[chaco]),null);
for(const role of ['technical','director'])assert.equal(reportContext(db,{...cloud,profile:{active:true,role}},[chaco]).gerenciaId,'chaco');
assert.equal(reportButton(db,cloud,[chaco],s=>s),'');
assert.match(reportButton(db,cloud,[north],s=>s),/>Informe<\/button>/);
for(const name of ['Norte','Chaco','Centro Sur'])for(const half of [1,2]){
 assert.equal(closureFilename({management:{name:`Gerencia ${name}`},period:{half,month:10,year:2026}}),`Verificación_doc_GDSZ_${name.replaceAll(' ','_')}_${half===1?'Primera':'Segunda'}_quincena_10-2026.pdf`);
}
console.log('OK: responsable por zona, Director/Administrador, anulación, recepción y nombres por gerencia/quincena.');
