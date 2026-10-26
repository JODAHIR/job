import {assertRemisionEditable} from './spark-remision-guard.js';
import {lifecycleFence} from './spark-lifecycle.js';
import {validateResponsables,validateContact} from './gerencia-contacts.js';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const schemas = {
  gerencias: ['id','name','responsables'], cacs: ['id','name','gerenciaId','active','contacto'],
  remisiones: ['id','cacId','year','month','half','receivedOn','expediente','remittedOn','origin'],
  lotes: ['id','remisionId','code','declared'],
  documentos: ['id','loteId','type','number','state'],
  observaciones: ['id','documentId','description','date','owner','status'],
};
export function sparkRow(entity, row) {
  if (!schemas[entity] || !row || Object.keys(row).some(k => !schemas[entity].includes(k))) throw Error('Campos no admitidos.');
  const result = {};
  for (const k of schemas[entity]) {
    if(['expediente','remittedOn','origin','contacto'].includes(k) && row[k] === undefined)continue;
    const v = k === 'active' ? (row[k] ?? true) : row[k];
    if (v === undefined) throw Error(`Falta ${k}.`);
    result[k] = typeof v === 'string' ? v.trim() : v;
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(result.id)) throw Error('Identificador inválido.');
  for (const [k,v] of Object.entries(result)) if (typeof v === 'string' && (!v || v.length > (k === 'description' ? 2000 : 150))) throw Error(`Valor inválido: ${k}.`);
  if(entity==='gerencias')result.responsables=validateResponsables(result.responsables);
  if(entity==='cacs' && result.contacto!==undefined)result.contacto=validateContact(result.contacto);
  return result;
}
export function sparkKey(entity, r) {
  const parts = entity === 'gerencias' ? [r.name] : entity === 'cacs' ? [r.gerenciaId,r.name]
    : entity === 'remisiones' ? [r.cacId,r.year,r.month,r.half]
    : entity === 'lotes' ? [r.remisionId,r.code]
    : entity === 'documentos' ? [r.loteId,r.type,r.number] : [r.id];
  if (parts.some(v => /[\/|]/.test(String(v)))) throw Error('Los nombres, tipos y números no pueden contener / ni | en Spark.');
  return entity + '|' + parts.map(v => String(v).toLowerCase()).join('|');
}
export function sparkWriter(store, auth) {
  return async function save({gerenciaId, collection: entity, row, expectedRevision = 0, reason = 'Registro individual'}) {
    const explicitActive = Object.hasOwn(row,'active');
    row = sparkRow(entity, row);
    const g = gerenciaId;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(g)) throw Error('Gerencia inválida.');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw Error('Revisión inválida.');
    const path = entity === 'gerencias' ? `gerencias/${g}` : `gerencias/${g}/${entity}/${row.id}`;
    const remisionVersion=entity==='remisiones'&&expectedRevision>0?await assertRemisionEditable(store,g,row.id):null;
    return runTransaction(store, async tx => {
      const profile=(await tx.get(doc(store,'users',auth.currentUser.uid))).data();
      const ref = doc(store,path), snap = await tx.get(ref), before = snap.exists() ? snap.data() : null;
      if ((before?.revision || 0) !== expectedRevision) throw Error('El registro cambió. Actualice antes de guardar.');
      if(entity==='cacs' && before && !explicitActive)row.active=before.active??true;
      let after = {...before,...row, revision: expectedRevision + 1, updatedAt: serverTimestamp()};
      const key = entity==='lotes' && before?.typeId ? before.uniqueKey : sparkKey(entity,after), lock = doc(store,'sparkKeys',key);
      const reserved = await tx.get(lock);
      if (reserved.exists() && reserved.data().path !== path) throw Error('Ya existe ese registro.');
      after.uniqueKey = key;
      const identityRef = doc(store,'sparkIds',entity+'_'+row.id), identitySnap = await tx.get(identityRef);
      if (identitySnap.exists() && identitySnap.data().gerenciaId !== g) throw Error('Identificador utilizado en otra gerencia.');
      const parent = { cacs:'gerenciaId',remisiones:'cacId',lotes:'remisionId',documentos:'loteId',observaciones:'documentId' }[entity];
      if (before && parent && before[parent] !== after[parent]) throw Error('La relación histórica no puede cambiar.');
      if (entity === 'remisiones') {
        if(!before&&profile.role==='asistente')throw Error('El Asistente no puede crear remisiones.');
        if (before && ['year','month','half','receivedOn'].some(k => before[k] !== after[k])) throw Error('El período y la recepción son inmutables.');
        if (!before) {
          const cac=await tx.get(doc(store,`gerencias/${g}/cacs/${row.cacId}`));
          if(!cac.exists() || cac.data().active===false)throw Error('El CAC está deshabilitado.');
          const setting = await tx.get(doc(store,'settings','calendar'));
          if (!setting.exists()) throw Error('Debe aprobarse el calendario oficial antes de registrar remisiones.');
          const day = await tx.get(doc(store,'deadlineDays', `${setting.data().version}_${row.receivedOn}`));
          if (!day.exists()) throw Error('No hay un plazo aprobado para esta fecha de recepción.');
          after = {...after, ...day.data(), receivedOn: row.receivedOn};
        }
      }
      const fence=await lifecycleFence(tx,store,g,entity,after,before);
      if(remisionVersion!=null&&fence?.after.version!==remisionVersion+1)throw Error('La remisión cambió. Actualice antes de guardar.');
      let related = null;
      if (entity === 'observaciones') {
        const dref = doc(store,`gerencias/${g}/documentos/${row.documentId}`), ds = await tx.get(dref);
        if (!ds.exists()) throw Error('Documento inexistente.');
        if (!ds.data().firstObservationId) related = {ref:dref,before:ds.data(),after:{...ds.data(),firstObservationId:row.id,state:'Verificado con observación',revision:ds.data().revision+1,updatedAt:serverTimestamp()}};
      }
      if (entity === 'documentos' && !before) after.firstObservationId = '';
      if (entity === 'gerencias' && !before) after.scopeRevision = 0;
      const writeAudit = (c, previous, saved) => tx.set(doc(store,`gerencias/${g}/audit/${c}_${saved.id}_${saved.revision}`), {
        id:`${c}_${saved.id}_${saved.revision}`, actor:auth.currentUser.uid, ...(c==='lotes'?{role:profile.role}:{}), collection:c, recordId:saved.id,
        at:serverTimestamp(),before:previous,after:saved,reason:reason.trim(),
      });
      if(fence)tx.set(fence.ref,fence.after);
      tx.set(ref,after);
      tx.set(identityRef,{gerenciaId:g,entity,recordId:row.id});
      tx.set(lock,{path,gerenciaId:g,entity,recordId:row.id});
      if (before?.uniqueKey && before.uniqueKey !== key) tx.delete(doc(store,'sparkKeys',before.uniqueKey));
      writeAudit(entity,before,after);
      if (related) { tx.set(related.ref,related.after); writeAudit('documentos',related.before,related.after); }
      const view = value => {const {updatedAt,...record}=value;return record;};
      return {id:row.id,revision:after.revision,saved:view(after),related:related?view(related.after):null,control:fence?{...view(fence.after),id:fence.ref.id,gerenciaId:g}:null};
    });
  };
}
