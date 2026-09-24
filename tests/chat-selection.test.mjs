import {strict as assert} from 'node:assert';
import {selectPendingProcedure,optionsMessage} from '../src/chat-selection.js';
const options=[{title:'1.3.1 Créditos — Estado de Resolución'},{title:'1.3.2 Créditos — Forma de desembolso'}];
assert.equal(selectPendingProcedure('Estado de Resolución',options),options[0]);
assert.equal(selectPendingProcedure('opción 2',options),options[1]);
assert.equal(selectPendingProcedure('1',options),options[0]);
assert.equal(selectPendingProcedure('créditos',options),null);
assert.match(optionsMessage(options),/1\. 1\.3\.1 Créditos/);
console.log('5 pruebas de selección conversacional correctas.');
