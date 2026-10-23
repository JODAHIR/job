const KEY='cdq:filters:empty-start-v2';
const fields=['year','month','half','gerencia','cac','dateField','from','to','remission','reconciliation','verification','observation','deadline','documentType','lifecycle'];
export function initialFilters(){return {year:'',month:'',half:'',gerencia:'',cac:''};}
export function createFilterSession(storage){
 const clear=()=>{try{storage?.removeItem(KEY);}catch{}};
 return {clear,read(){try{const value=JSON.parse(storage?.getItem(KEY)||'null');if(!value||typeof value!=='object'||Array.isArray(value))return initialFilters();return {...initialFilters(),...Object.fromEntries(fields.filter(k=>typeof value[k]==='string'||typeof value[k]==='number').map(k=>[k,value[k]]))};}catch{return initialFilters();}},save(filters){try{storage?.setItem(KEY,JSON.stringify(filters));}catch{}}};
}
