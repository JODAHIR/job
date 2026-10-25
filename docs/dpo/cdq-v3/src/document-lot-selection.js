export function documentLots(lots,types,type){
 const entry=types.find(t=>t.code===type);
 return lots.filter(l=>l.typeCode===type || (entry&&l.typeId===entry.id));
}
export function selectedDocumentLot(lots,current=''){
 return lots.some(l=>l.id===current)?current:lots.length===1?lots[0].id:'';
}
