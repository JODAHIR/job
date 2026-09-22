export const labels={title:'Título',questions:'Preguntas y palabras clave',support:'Sistema o soporte',steps:'Pasos operativos',hours:'Horarios',good:'Plantilla correcta',bad:'Plantilla incorrecta',published:'Estado'};
export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterProcedures(items,query){const tokens=normalizeSearch(query).trim().split(/\s+/).filter(Boolean);return items.filter(item=>{const text=normalizeSearch([item.title,item.questions,item.support].join(' '));return tokens.every(token=>text.includes(token))})}
export function changedFields(before,after){return Object.entries(labels).filter(([key])=>(before?.[key]??'')!==(after?.[key]??'')).map(([key,label])=>({key,label,before:before?.[key],after:after?.[key]}))}
export const displayValue=(key,value)=>key==='published'?(value===true?'Publicado':value===false?'Borrador':'Sin registro'):value||'Sin contenido';
