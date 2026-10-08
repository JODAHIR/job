// Shared normalization for preauthorizing an email before its first Google login.
export const OWNER_EMAIL='javier.odahir@gmail.com';
export const normalizeEmail=email=>email.trim().toLowerCase();
export function validateEmail(value){
 const email=normalizeEmail(value);
 if(email.length>254||! /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email))throw new Error('Ingresá un correo válido.');
 if(email===OWNER_EMAIL)throw new Error('La cuenta administradora ya tiene acceso permanente.');
 return email;
}
