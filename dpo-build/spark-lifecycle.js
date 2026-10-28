import {assertRemisionEditable} from './spark-remision-guard.js';
import {doc,collection,getDocsFromServer,getDocFromServer,setDoc,query,limit,runTransaction,serverTimestamp} from 'firebase/firestore';
import {ANNUL_LIMIT,annulEligibility,treeCounts} from './remision-lifecycle.js';
const path=(g,r)=>`gerencias/${g}/remisionControls/${r}`;
const id=v=>{if(typeof v!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(v))throw Error('Identificador inválido.');return v;};
export async function lifecycleFence(tx,store,g,entity,row,before) {
  if(!['remisiones','lotes','documentos','observaciones'].includes(entity))return null;
  if(before?.deletion)throw Error('El registro está eliminado.');
  let r=row, c=entity;
  for(const [child,parent,key] of [['observaciones','documentos','documentId'],['documentos','lotes','loteId'],['lotes','remisiones','remisionId']]) {
    if(c===child){const snap=await tx.get(doc(store,`gerencias/${g}/${parent}/${r[key]}`));if(!snap.exists())throw Error('Antecesor inexistente.');r=snap.data();if(r.deletion)throw Error('El registro vinculado está eliminado.');c=parent;}
  }
  if(r.annulment || before?.annulment)throw Error('La remisión está anulada; sus registros son de solo consulta.');
  const ref=doc(store,path(g,r.id)),snap=await tx.get(ref);
  if(!snap.exists() && !(entity==='remisiones'&&!before))throw Error('Un administrador debe inicializar el control histórico de esta remisión.');
  const old=snap.exists()?snap.data():{version:0,lots:0,documents:0,observations:0};
  const field={lotes:'lots',documentos:'documents',observaciones:'observations'}[entity];
  return {ref,after:{version:old.version+1,lots:old.lots+(field==='lots'&&!before?1:0),documents:old.documents+(field==='documents'&&!before?1:0),observations:old.observations+(field==='observations'&&!before?1:0),collection:entity,recordId:row.id,revision:(before?.revision||0)+1,updatedAt:serverTimestamp()}};
}
async function inventory(store,g) {
  const data={};
  for(const c of ['remisiones','lotes','documentos','observaciones']){
    const s=await getDocsFromServer(query(collection(store,`gerencias/${g}/${c}`),limit(3001)));
    if(s.size>3000)throw Error('Más de 3000 registros: inventario bloqueado; no se usará un inventario parcial.');
    data[c]=s.docs.map(d=>d.data());
  }
  for(const [child,parent,key] of [['lotes','remisiones','remisionId'],['documentos','lotes','loteId'],['observaciones','documentos','documentId']]){
    const ids=new Set(data[parent].map(r=>r.id));
    if(data[child].some(r=>!ids.has(r[key])))throw Error('Hay relaciones documentales inconsistentes; se bloqueó el inventario.');
  }
  return data;
}
export async function initializeControl(store,auth,{gerenciaId:g,remisionId:r,reason}) {
  id(g);id(r);if(!reason?.trim())throw Error('Motivo obligatorio.');
  const data=await inventory(store,g);
  const counts=treeCounts(data,r);
  return runTransaction(store,async tx=>{
    const ref=doc(store,path(g,r)),old=await tx.get(ref),rem=await tx.get(doc(store,`gerencias/${g}/remisiones/${r}`));
    if(old.exists())throw Error('El control ya existe; actualice la vista.');
    if(!rem.exists()||rem.data().annulment)throw Error('Remisión inexistente o anulada.');
    const after={...counts,version:1,collection:'initialization',recordId:r,revision:rem.data().revision,updatedAt:serverTimestamp()};
    tx.set(ref,after);
    tx.set(doc(store,`gerencias/${g}/lifecycleAudit/init_${r}`),{actor:auth.currentUser.uid,at:serverTimestamp(),reason:reason.trim(),remisionId:r,control:after});
    return after;
  });
}
export async function previewAnnulments(store,auth,{gerenciaId:g,ids}) {
  id(g);if(!Array.isArray(ids)||!ids.length||ids.length>ANNUL_LIMIT||new Set(ids).size!==ids.length)throw Error(`Seleccione entre 1 y ${ANNUL_LIMIT} remisiones de una gerencia.`);
  const profile=(await getDocFromServer(doc(store,'users',auth.currentUser.uid))).data();
  const rows=[];
  for(const r of ids){id(r);const [rs,cs]=await Promise.all([getDocFromServer(doc(store,`gerencias/${g}/remisiones/${r}`)),getDocFromServer(doc(store,path(g,r)))]);
    const remision=rs.data(),control=cs.data();rows.push({id:r,remision,control,omitted:!remision?'Remisión inexistente':annulEligibility(profile,g,remision,control)});
  }
  const data=await inventory(store,g);
  for(const row of rows){
    if(row.omitted)continue;
    const current=(await getDocFromServer(doc(store,path(g,row.id)))).data();
    const counts=treeCounts(data,row.id);
    if(current?.version!==row.control.version || ['lots','documents','observations'].some(k=>counts[k]!==current[k]))throw Error('El inventario cambió o no coincide con los controles. Actualice antes de confirmar.');
    const lots=data.lotes.filter(l=>l.remisionId===row.id),lids=new Set(lots.map(l=>l.id));
    const documents=data.documentos.filter(d=>lids.has(d.loteId)),dids=new Set(documents.map(d=>d.id));
    row.dependencies={lots:lots.map(l=>({id:l.id,code:l.code})),documents:documents.map(d=>({id:d.id,number:d.number})),observations:data.observaciones.filter(o=>dids.has(o.documentId)).map(o=>({id:o.id,documentId:o.documentId}))};
  }
  const operationId=crypto.randomUUID(),versions=Object.fromEntries(rows.filter(r=>!r.omitted).map(r=>[r.id,{revision:r.remision.revision,controlVersion:r.control.version}]));
  if(Object.keys(versions).length)await setDoc(doc(store,`gerencias/${g}/annulPreviews/${operationId}`),{id:operationId,actor:auth.currentUser.uid,at:serverTimestamp(),versions});
  return {gerenciaId:g,actor:auth.currentUser.uid,createdAt:Date.now(),operationId,rows};
}
export async function annulRemisiones(store,auth,{preview,reason,confirmed}) {
  if(confirmed!==true||!reason?.trim()||reason.trim().length>2000)throw Error('Confirmación explícita y motivo obligatorio (máximo 2000 caracteres).');
  if(!preview||preview.actor!==auth.currentUser.uid||Date.now()-preview.createdAt>300000)throw Error('La revisión venció; vuelva a verificar la selección.');
  const {gerenciaId:g,rows,operationId}=preview;id(g);id(operationId);
  const completed=await getDocFromServer(doc(store,`gerencias/${g}/annulOperations/${operationId}`));
  if(completed.exists()){if(completed.data().actor!==auth.currentUser.uid)throw Error('Operación ajena.');return completed.data();}
  for(const row of rows.filter(r=>!r.omitted))await assertRemisionEditable(store,g,row.id);
  if(!rows?.length||rows.length>ANNUL_LIMIT)throw Error('Selección inválida.');
  return runTransaction(store,async tx=>{
    const opref=doc(store,`gerencias/${g}/annulOperations/${operationId}`),existing=await tx.get(opref);
    if(existing.exists()){if(existing.data().actor!==auth.currentUser.uid)throw Error('Operación ajena.');return existing.data();}
    const ps=await tx.get(doc(store,'users',auth.currentUser.uid)),profile=ps.data(),ready=[],omitted=[];
    for(const row of rows){
      id(row.id);const rr=doc(store,`gerencias/${g}/remisiones/${row.id}`),cr=doc(store,path(g,row.id));
      const rs=await tx.get(rr),cs=await tx.get(cr),before=rs.data(),control=cs.data();
      if(row.omitted){omitted.push({id:row.id,reason:row.omitted});continue;}
      if(!before || before.revision!==row.remision.revision || control?.version!==row.control?.version)throw Error('Las dependencias cambiaron. No se anuló ninguna remisión; revise nuevamente.');
      const denial=annulEligibility(profile,g,before,control);if(denial)throw Error(denial);
      ready.push({rr,cr,before,control});
    }
    if(!ready.length)throw Error('No hay remisiones elegibles.');
    const result={id:operationId,actor:auth.currentUser.uid,role:profile.role,at:serverTimestamp(),reason:reason.trim(),status:'completed',ids:ready.map(x=>x.before.id),omitted};
    for(const {rr,cr,before,control} of ready){
      const annulment={operationId,actor:auth.currentUser.uid,role:profile.role,at:serverTimestamp(),reason:reason.trim(),lots:control.lots,documents:control.documents,observations:control.observations};
      const after={...before,annulment,revision:before.revision+1,updatedAt:serverTimestamp()};
      tx.set(rr,after);tx.set(cr,{...control,version:control.version+1,collection:'annulment',recordId:before.id,revision:after.revision,updatedAt:serverTimestamp()});
      const aid=`remisiones_${before.id}_${after.revision}`;
      tx.set(doc(store,`gerencias/${g}/audit/${aid}`),{id:aid,actor:auth.currentUser.uid,collection:'remisiones',recordId:before.id,at:serverTimestamp(),before,after,reason:reason.trim()});
    }
    tx.set(opref,result);return {...result,at:null};
  });
}
