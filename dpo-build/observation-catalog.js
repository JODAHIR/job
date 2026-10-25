export const observationText = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu,' ');
export const observationKey = value => observationText(value).toLocaleLowerCase('es');
export function observationCatalog(observations=[],stored={}) {
 const entries=Object.values(stored.entries||{}).map(e=>({...e}));
 const known=new Set(entries.flatMap(e=>[observationKey(e.description),...e.sources]));
 for(const o of observations){
  const description=observationText(o.description),key=observationKey(description);
  if(!key||known.has(key))continue;
  entries.push({id:'',description,active:true,sources:[key]});known.add(key);
 }
 return entries.sort((a,b)=>a.description.localeCompare(b.description,'es'));
}
export function catalogChange(current,entry,observations=[]) {
 const description=observationText(entry.description);
 if(!description||description.length>2000||typeof entry.active!=='boolean')throw Error('Descripción y estado inválidos.');
 const all=observationCatalog(observations,current);
 if(all.some(e=>e.id!==entry.id&&observationKey(e.description)===observationKey(description)))throw Error('Esta descripción ya existe en el catálogo.');
 const before=current.entries?.[entry.id];
 const sources=[...new Set([...(before?.sources||entry.sources||[]),observationKey(description)])];
 if(sources.length>100)throw Error('Esta descripción alcanzó el límite de variantes históricas.');
 return {id:entry.id,description,active:entry.active,sources};
}
