export function assignedUsers(users,gerenciaId) {
 return (users||[]).filter(u=>u.active && ((u.role==='gerente' && u.gerenciaId===gerenciaId)||((u.role==='asistente'||u.secondaryRole==='asistente')&&(u.gerencias||[]).includes(gerenciaId))));
}
export function userDescription(u) {return u.description?.trim() || u.email || 'Usuario sin descripción';}
export function validateContact(contact) {
 const fields=['nombre','cargo','correo','interno','celular'];

  if(!contact||typeof contact!=='object'||Object.keys(contact).length!==5||Object.keys(contact).some(k=>!fields.includes(k)))throw Error('Datos del responsable inválidos.');
  const row={};
  for(const k of fields){if(typeof contact[k]!=='string')throw Error(`Complete ${k} de cada responsable.`);row[k]=contact[k].trim();}
  if(!row.nombre||row.nombre.length>150||!row.cargo||row.cargo.length>150)throw Error('Nombre y cargo son obligatorios (máximo 150 caracteres).');
  if(row.correo.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(row.correo))throw Error('Correo del responsable inválido.');
  row.correo=row.correo.toLowerCase();
  if(!/^[0-9 +().-]{1,20}$/.test(row.interno)||!/[0-9]/.test(row.interno))throw Error('Interno inválido (máximo 20 caracteres).');
  if(!/^[0-9 +().-]{6,30}$/.test(row.celular)||!/[0-9]/.test(row.celular))throw Error('Celular inválido (6 a 30 caracteres).');
  return row;
}
export function validateResponsables(value) {
 if(!Array.isArray(value)||value.length!==2)throw Error("La gerencia debe tener exactamente dos responsables.");
 const rows=value.map(validateContact);
 if(rows[0].correo===rows[1].correo)throw Error('Los dos responsables deben tener correos distintos.');
 return rows;
}
