const KEY='cdq:filters:current-page';
export function initialFilters(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=type=>Number(parts.find(p=>p.type===type).value);
 return {year:value('year'),month:value('month'),half:value('day')<=15?'1':'2',gerencia:'',cac:''};
}
export function createFilterSession(storage){
 const clear=()=>{try{storage?.removeItem(KEY);}catch{}};
 clear(); // A new page load always discards the previous selection, not the data cache.
 return {clear,save(filters){try{storage?.setItem(KEY,JSON.stringify(filters));}catch{}}};
}
