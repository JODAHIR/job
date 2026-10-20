// Pure analytical layer. Missing evidence never becomes a favourable/negative score.
export const INTELLIGENCE_POLICY = Object.freeze({nearBusinessDays:2,oldObservationBusinessDays:10,volumeVariation:0.30,volumeMinimum:20,minimumPeriods:3});
export function civilDate(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const time=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?value:null;
}
export function asuncionDate(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
export const percentage=(numerator,denominator)=>denominator>0?100*numerator/denominator:null;
export function businessElapsed(start,end,calendar) {
 if(!civilDate(start)||!civilDate(end)||end<start||!calendar?.approved||!civilDate(calendar.coverageStart)||!civilDate(calendar.coverageEnd)||start<calendar.coverageStart||end>calendar.coverageEnd||!Array.isArray(calendar.holidays)||calendar.holidays.some(d=>!civilDate(d)))return null;
 if(Date.parse(end)-Date.parse(start)>3660*86400000)return null;
 const holidays=new Set(calendar.holidays);let days=0;
 for(let time=Date.parse(start+'T00:00:00Z')+86400000;time<=Date.parse(end+'T00:00:00Z');time+=86400000){const day=new Date(time);if(![0,6].includes(day.getUTCDay())&&!holidays.has(day.toISOString().slice(0,10)))days++;}
 return days;
}
const index=rows=>new Map((rows||[]).map(r=>[r.id,r]));
const group=(rows,key)=>{const result=new Map();for(const row of rows||[]){const id=key(row);if(!result.has(id))result.set(id,[]);result.get(id).push(row);}return result;};
const sum=(rows,key)=>rows.reduce((s,r)=>s+r[key],0);
export function lotEvidence(lot,documents,observations,control) {
 const unique=index(documents),ids=new Set(unique.keys());
 const linked=observations.filter(o=>ids.has(o.documentId));
 const observedIds=new Set([...unique.values()].filter(d=>d.state==='Verificado con observación').map(d=>d.id));
 for(const o of linked)observedIds.add(o.documentId);
 const byDocument=group(linked,o=>o.documentId);
 const regularized=[...observedIds].filter(id=>byDocument.has(id)&&byDocument.get(id).every(o=>o.status==='Regularizada')).length;
 const invalid=!Number.isSafeInteger(lot.declared)||lot.declared<0||observedIds.size>lot.declared||unique.size!==documents.length;
 const exception=control?.model==='exception-v1';
 const finished=exception&&control.state==='closed'&&civilDate(control.closedOn)&&control.closedDeclared===lot.declared&&!invalid;
 return {id:lot.id,remisionId:lot.remisionId,declared:invalid?null:lot.declared,observed:observedIds.size,observations:linked.length,regularized,pending:observedIds.size-regularized,controlled:finished?lot.declared:0,conforming:finished?lot.declared-observedIds.size:null,finished:!!finished,exception,invalid,closedOn:finished?control.closedOn:null,documentIds:[...ids],observationIds:linked.map(o=>o.id)};
}
export function deliveryEvidence(obligation,remission,calendar,today) {
 if(!obligation||obligation.applicable!==true)return {color:'gray',state:obligation?.applicable===false?'No corresponde':'Sin obligación documentada'};
 const due=civilDate(obligation.dueOn),received=civilDate(remission?.receivedOn);
 if(!due||!civilDate(today))return {color:'gray',state:'No evaluable'};
 if(received)return {color:received<=due?'green':'red',state:received<=due?'Recibida en plazo':'Recibida fuera de plazo'};
 if(today>due)return {color:'red',state:'Entrega vencida'};
 const remaining=businessElapsed(today,due,calendar);
 if(remaining===null)return {color:'gray',state:'Calendario insuficiente'};
 return {color:remaining<=INTELLIGENCE_POLICY.nearBusinessDays?'yellow':'gray',state:remaining<=INTELLIGENCE_POLICY.nearBusinessDays?'Próxima a vencer':'Pendiente en plazo',remaining};
}
export function executiveMetrics(db,filters={},today=asuncionDate()) {
 if(!civilDate(today))throw Error('Fecha de evaluación inválida.');
 for(const key of ['cacs','remisiones','lotes','documentos','observaciones','lotChecks']) {
  const rows=db[key]||[];
  if(rows.some(r=>!r.id)||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Identificadores duplicados o ausentes: '+key);
 }
 if((filters.from&&!civilDate(filters.from))||(filters.to&&!civilDate(filters.to))||(filters.from&&filters.to&&filters.from>filters.to))throw Error('Rango de fechas inválido.');
 const cacs=(db.cacs||[]).filter(c=>(!filters.gerencia||c.gerenciaId===filters.gerencia)&&(!filters.cac||c.id===filters.cac));
 const cacIds=new Set(cacs.map(c=>c.id)),documents=group(db.documentos,d=>d.loteId),observations=group(db.observaciones,o=>o.documentId),controls=index(db.lotChecks),calendars=new Map((db.calendars||[]).map(c=>[c.version,c]));
 if(db.calendar)calendars.set(db.calendar.version,db.calendar);
 const allLots=group(db.lotes,l=>l.remisionId);
 const period=r=>(!filters.year||r.year===+filters.year)&&(!filters.month||r.month===+filters.month)&&(!filters.half||r.half===+filters.half);
 let rem=(db.remisiones||[]).filter(r=>cacIds.has(r.cacId)&&!r.annulment&&period(r));
 const evidence=new Map();
 for(const r of rem)for(const l of allLots.get(r.id)||[]){const ds=documents.get(l.id)||[];evidence.set(l.id,lotEvidence(l,ds,ds.flatMap(d=>observations.get(d.id)||[]),controls.get(l.id)));}
 const controlState=r=>{const lots=allLots.get(r.id)||[];return lots.length&&lots.every(l=>evidence.get(l.id).finished)?'closed':lots.some(l=>evidence.get(l.id).exception)?'pending':'unknown';};
 if(filters.control)rem=rem.filter(r=>controlState(r)===filters.control);
 const eventDate=r=>{
  if(filters.dateField==='closedOn'){const lots=allLots.get(r.id)||[];return controlState(r)==='closed'?lots.map(l=>evidence.get(l.id).closedOn).sort().at(-1):null;}
  return civilDate(r.receivedOn);
 };
 if(filters.from||filters.to)rem=rem.filter(r=>{const date=eventDate(r);return date&&(!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to);});
 if(filters.observation)rem=rem.filter(r=>(allLots.get(r.id)||[]).some(l=>(documents.get(l.id)||[]).some(d=>(observations.get(d.id)||[]).some(o=>o.status===filters.observation))));
 if(filters.remission==='Pendiente')rem=[];
 const lots=rem.flatMap(r=>allLots.get(r.id)||[]),rows=lots.map(l=>evidence.get(l.id));
 const docs=lots.flatMap(l=>documents.get(l.id)||[]),obs=docs.flatMap(d=>observations.get(d.id)||[]);
 const valid=rows.filter(r=>!r.invalid),declared=sum(valid,'declared'),controlled=sum(valid,'controlled'),conforming=sum(valid.filter(r=>r.finished),'conforming');
 const alerts=[],durations=[];
 for(const r of rem){
  const calendar=calendars.get(r.calendarVersion),state=controlState(r);
  // Closing date is independent of the chosen date-filter axis.
  const closedOn=state==='closed'?(allLots.get(r.id)||[]).map(l=>evidence.get(l.id).closedOn).sort().at(-1):null;
  const elapsed=businessElapsed(r.receivedOn,closedOn||today,calendar);
  const remaining=businessElapsed(today,r.dueOn,calendar);
  if(state!=='closed'&&civilDate(r.dueOn)&&r.dueOn<today)alerts.push({kind:'control-overdue',recordId:r.id,cacId:r.cacId,label:'Plazo de control vencido',evaluable:state!=='unknown'});
  else if(state!=='closed'&&remaining!==null&&remaining<=2)alerts.push({kind:'control-near',recordId:r.id,cacId:r.cacId,label:'Plazo de control próximo',evaluable:state!=='unknown'});
  durations.push({id:r.id,state,elapsed,closedOn,onTime:closedOn&&civilDate(r.dueOn)?closedOn<=r.dueOn:null});
 }
 const remissionByLot=new Map(lots.map(l=>[l.id,rem.find(r=>r.id===l.remisionId)])),docById=index(docs);
 const ages=obs.map(o=>{const r=remissionByLot.get(docById.get(o.documentId)?.loteId),calendar=calendars.get(r?.calendarVersion);return {id:o.id,status:o.status,age:businessElapsed(o.date,o.status==='Regularizada'?o.regularizedOn:today,calendar),regularizedOn:civilDate(o.regularizedOn)};});
 for(const a of ages)if(a.status!=='Regularizada'&&a.age>=10)alerts.push({kind:'observation-old',recordId:a.id,label:'Observación pendiente de 10 o más días hábiles',evaluable:true});
 const categories=new Map();for(const o of obs){const key=o.categoryId||'Sin clasificar';categories.set(key,(categories.get(key)||0)+1);}let cumulative=0;
 const pareto=[...categories].sort((a,b)=>b[1]-a[1]).map(([category,count])=>({category,count,cumulative:percentage(cumulative+=count,obs.length)}));
 const selectedRemIds=new Set(rem.map(r=>r.id));
 const obligations=(db.deliveryObligations||[]).filter(o=>cacIds.has(o.cacId)&&period(o)).filter(o=>{
  const r=(db.remisiones||[]).find(r=>!r.annulment&&r.cacId===o.cacId&&r.year===o.year&&r.month===o.month&&r.half===o.half);
  if(filters.remission==='Pendiente')return !r&&!filters.control&&!filters.from&&!filters.to&&!filters.observation;
  if(filters.control||filters.from||filters.to||filters.observation||filters.remission==='Registrada')return r&&selectedRemIds.has(r.id);
  return true;
 });
 const heatmap=obligations.map(o=>{const r=(db.remisiones||[]).find(r=>!r.annulment&&r.cacId===o.cacId&&r.year===o.year&&r.month===o.month&&r.half===o.half);return {...o,...deliveryEvidence(o,r,calendars.get(o.calendarVersion),today)};});
 const rankings=cacs.map(c=>{const ids=new Set(rem.filter(r=>r.cacId===c.id).map(r=>r.id)),rs=rows.filter(l=>ids.has(l.remisionId)),ok=rs.filter(l=>!l.invalid),finished=ok.filter(l=>l.finished),base=sum(finished,'declared');return {id:c.id,name:c.name,gerenciaId:c.gerenciaId,declared:sum(ok,'declared'),observed:sum(ok,'observed'),controlled:sum(ok,'controlled'),observationRate:percentage(sum(finished,'observed'),base),rateDenominator:base,pendingControls:ok.filter(l=>l.exception&&!l.finished).length,legacy:ok.filter(l=>!l.exception).length};}).sort((a,b)=>b.declared-a.declared);
 return {today,filters,remissions:rem,lotEvidence:rows,declared,controlled,conforming:valid.some(r=>r.finished)?conforming:null,observed:sum(valid,'observed'),observations:obs.length,regularized:sum(valid,'regularized'),pendingObserved:sum(valid,'pending'),progress:rows.some(r=>r.invalid)||valid.some(r=>!r.exception)?null:percentage(controlled,declared),legacyLots:valid.filter(r=>!r.exception).length,invalidLots:rows.filter(r=>r.invalid).map(r=>r.id),closedLots:valid.filter(r=>r.finished).length,lots:lots.length,ages,durations,alerts,rankings,pareto,heatmap,igd:{value:null,state:'Metodología pendiente de aprobación'},records:{documents:docs.map(d=>d.id),observations:obs.map(o=>o.id)},observationRows:obs,documentRows:docs};
}
export function comparableVariation(current,previous,{sameModel=false,complete=false}={}) {
 if(!sameModel||!complete||!Number.isFinite(current)||!Number.isFinite(previous)||previous<=0)return null;
 return 100*(current-previous)/previous;
}

// Keep all charts/reports on the same explicitly supported filter contract.
export function intelligenceFilters(input={}) {
 const keys=['year','month','half','gerencia','cac','from','to','dateField','control','observation','remission'];
 return Object.fromEntries(keys.filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));
}
export function intelligenceDashboard(db,input={},today=asuncionDate()) {
 const filters=intelligenceFilters(input),current=executiveMetrics(db,filters,today);
 const year=Number(filters.year)||Number(today.slice(0,4));
 const month=Number(filters.month)||Number(today.slice(5,7));
 const half=Number(filters.half);
 const ordinal=(year*12+month-1)*2+(half===2?1:0);
 const previousOrdinal=ordinal-(half?1:2);
 const previousYear=Math.floor(previousOrdinal/24),previousMonth=Math.floor((previousOrdinal%24)/2)+1;
 const previousFilters={...filters,year:previousYear,month:previousMonth,half:half?previousOrdinal%2+1:''};
 const previous=executiveMetrics(db,previousFilters,today);
 // Receipt records alone do not establish complete reporting periods. Until an
 // approved closing snapshot exists, comparison is descriptive, never an IGD.
 const evolution=[];
 for(let offset=5;offset>=0;offset--) {
  const value=ordinal-offset;
  const y=Math.floor(value/24),m=Math.floor((value%24)/2)+1,h=value%2+1;
  const metrics=executiveMetrics(db,{...filters,year:y,month:m,half:h},today);
  evolution.push({label:`${y}-${String(m).padStart(2,'0')} · Q${h}`,year:y,month:m,half:h,
   selected:y===year&&m===month&&(!half||h===half),
   remissions:metrics.remissions.length,declared:metrics.declared,observations:metrics.observations,
   regularized:metrics.regularized,registered:metrics.remissions.length>0});
 }
 const byGerencia=new Map();
 for(const c of current.rankings){
  if(!byGerencia.has(c.gerenciaId))byGerencia.set(c.gerenciaId,{id:c.gerenciaId,name:db.gerencias?.find(g=>g.id===c.gerenciaId)?.name||'Gerencia',declared:0,observed:0,controlled:0,pendingControls:0});
  const g=byGerencia.get(c.gerenciaId);for(const key of ['declared','observed','controlled','pendingControls'])g[key]+=c[key];
 }
 const regularizationAges=current.ages.filter(a=>a.status==='Regularizada'&&a.age!==null);
 return {...current,evolution,gerencias:[...byGerencia.values()],previous,previousFilters,variation:null,
  regularizationDays:regularizationAges.length?regularizationAges.reduce((s,a)=>s+a.age,0)/regularizationAges.length:null,
  regularizationSample:regularizationAges.length,comparisonNote:'Comparación descriptiva de registros disponibles. Variación porcentual no evaluable sin cierre y cobertura comparable de ambos períodos.'};
}
