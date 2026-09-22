import {strict as assert} from 'node:assert';
import {normalizeEmail,validateEmail} from '../src/access.js';
assert.equal(normalizeEmail(' Persona@Example.com '),'persona@example.com');
assert.equal(validateEmail('Persona+equipo@Example.com'),'persona+equipo@example.com');
for(const email of ['sin-correo','a/b@example.com','a b@example.com','javier.odahir@gmail.com','JAVIER.ODAHIR@GMAIL.COM','a'.repeat(250)+'@example.com'])assert.throws(()=>validateEmail(email));
console.log('Normalización y validación: 8 comprobaciones correctas.');
