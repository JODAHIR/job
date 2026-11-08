import {canConciliate} from './conciliation-permission.js';
export function canManageCustody(profile,identity,management,row){
 return !!row?.receivedOn&&!row.annulment&&canConciliate(profile,identity,management);
}
export function archiveMetadata(row,management,number){
 const month=Number(row?.month),year=Number(row?.year),name=management?.name?.trim().replace(/^Gerencia\s+/i,'');
 if(!name||!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2000||year>2100)throw Error('La remisión debe tener gerencia, mes y año válidos.');
 const n=String(number??'').trim();
 if(!/^[0-9]{1,9}$/.test(n)||Number(n)<1)throw Error('Ingrese un número de arquipel entero mayor que cero.');
 return {name:`GDSZ-${name}-${year}-${String(month).padStart(2,'0')}-${n}`,number:n,month,year};
}
export function custodyPayload(input){
 if(input.kind==='scan'){
  if(input.confirmed!==true)throw Error('Confirme que la remisión fue escaneada en su totalidad.');
  return {kind:'scan',confirmed:true};
 }
 if(input.kind!=='archive')throw Error('Operación inválida.');
 const name=typeof input.name==='string'?input.name.trim():'';
 const number=typeof input.number==='string'?input.number.trim():'';
 if(!name||name.length>150||!/^[0-9]{1,9}$/.test(number)||Number(number)<1)throw Error('Ingrese nombre y número de arquipel válidos.');
 if(!Number.isInteger(input.month)||input.month<1||input.month>12||!Number.isInteger(input.year)||input.year<2000||input.year>2100)throw Error('Mes o año inválido.');
 return {kind:'archive',name,number,month:input.month,year:input.year};
}
