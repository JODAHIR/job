import {collection,doc,getDocsFromServer,getDocFromServer,limit,query} from 'firebase/firestore';
import {remisionState} from './remision-management.js';
export async function assertRemisionEditable(store,g,id){
 const base=`gerencias/${g}`,ref=doc(store,base,'remisionControls',id),before=await getDocFromServer(ref);
 const rem=await getDocFromServer(doc(store,base,'remisiones',id));if(!rem.exists())return;
 const db={remisionControls:[{...before.data(),id}]};
 for(const c of ['lotes','documentos','observaciones','lotVerifications']){const snap=await getDocsFromServer(query(collection(store,base,c),limit(3001)));if(snap.size>3000)throw Error('Inventario incompleto. No se puede modificar la remisión.');db[c]=snap.docs.map(d=>d.data());}
 const after=await getDocFromServer(ref);if(before.data()?.version!==after.data()?.version)throw Error('Los lotes cambiaron. Actualice antes de continuar.');
 if(['Conciliada','Anulada'].includes(remisionState(db,rem.data())))throw Error('La remisión conciliada o anulada es de solo consulta.');
 return after.data()?.version;
}
