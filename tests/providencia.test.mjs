import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateClosure} from '../dpo-build/providencia-domain.js';
import {closurePdf} from '../dpo-build/providencia.js';
const period={year:2026,month:10,half:1};
function fixture(){return {completeInventory:true,cacs:[{id:'c',name:'CAC',gerenciaId:'g',active:true}],remisiones:[{id:'r',cacId:'c',...period,receivedOn:'2026-10-20',expediente:'2026-001'}],lotes:[{id:'l',remisionId:'r',declared:12,revision:1}],lotVerifications:[{lotId:'l',lotRevision:1,controlVersion:1,registered:12,at:{seconds:1}}],remisionControls:[{id:'r',version:1}],documentos:[],observaciones:[]};}
test('todos los CAC deben tener remisión conciliada',()=>{const db=fixture();assert.equal(evaluateClosure(db,'g',period).eligible,true);db.cacs.push({id:'otro',name:'Otro CAC',gerenciaId:'g',active:true});assert.equal(evaluateClosure(db,'g',period).eligible,false);});
for(const [name,change] of Object.entries({incompleto:d=>d.completeInventory=false,pendiente:d=>d.lotVerifications=[],anulada:d=>d.remisiones[0].annulment={},otroPeriodo:d=>d.remisiones[0].half=2,obsoleta:d=>d.lotes[0].revision=2,eliminado:d=>d.lotes[0].deletion={},diferencia:d=>d.lotVerifications[0].registered=11,sinRecepcion:d=>d.remisiones[0].receivedOn=''}))test(name,()=>{const db=fixture();change(db);assert.equal(evaluateClosure(db,'g',period).eligible,false);});
test('PDF bloqueado si no se cumple conciliación',()=>assert.throws(()=>closurePdf({closure:{eligible:false}})));
test('control ausente impide certificar',()=>{const d=fixture();d.remisionControls=[];assert.equal(evaluateClosure(d,'g',period).eligible,false);});
test('PDF usa período, gerencia y expediente reales',async()=>{const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../dpo-build/providencia.js',import.meta.url),'utf8');const logo=source.match(/const logo = '([^']+)'/)[1];const pdf=closurePdf({closure:evaluateClosure(fixture(),'g',period),management:{name:'Gerencia Centro'},period,now:new Date('2026-11-13T12:00:00Z'),issuer:'Usuario de prueba',logo});assert.equal(pdf.getNumberOfPages(),1);const text=pdf.output();assert.ok(text.includes('2026-001'));assert.ok(text.includes('octubre/2026'));assert.ok(!text.includes('DATOS FICTICIOS'));});

test('lote cero conciliado no bloquea PDF',()=>{const d=fixture();d.lotes[0].declared=0;d.lotVerifications[0].registered=0;assert.equal(evaluateClosure(d,'g',period).eligible,true);});
test('lote cero sin conciliación sigue pendiente',()=>{const d=fixture();d.lotes[0].declared=0;d.lotVerifications=[];assert.equal(evaluateClosure(d,'g',period).eligible,false);});
