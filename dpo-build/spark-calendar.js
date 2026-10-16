import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {validateCalendar,deadline,nextDate} from './shared/deadlines.js';
export function calendarDays(calendar) {
 validateCalendar(calendar);
 const days=[];
 for(let day=calendar.coverageStart;day<=calendar.coverageEnd;day=nextDate(day)) {
  if(days.length>=370) throw Error('Publique calendarios de hasta un año.');
  try {const d=deadline(day,calendar);delete d.receivedOn;days.push([`${calendar.version}_${day}`,d]);}
  catch(e) {if(e.message.includes('Falta cobertura')) break; throw e;}
 }
 if(!days.length) throw Error('El calendario no tiene cobertura suficiente.');
 return days;
}
export async function publishSparkCalendar(store,auth,{calendar,reason}) {
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(calendar?.version)||!reason?.trim())throw Error('Versión y motivo obligatorios.');
 const days=calendarDays(calendar);
 return runTransaction(store,async tx=>{
  const ref=doc(store,'calendars',calendar.version), old=await tx.get(ref);
  if(old.exists())throw Error('La versión del calendario ya existe.');
  const at=serverTimestamp(), after={...calendar,createdAt:at};
  tx.set(ref,after);
  tx.set(doc(store,'settings','calendar'),{version:calendar.version});
  for(const [id,d] of days)tx.set(doc(store,'deadlineDays',id),d);
  tx.set(doc(store,'administration/calendars/audit',calendar.version),{id:calendar.version,actor:auth.currentUser.uid,collection:'calendars',recordId:calendar.version,at,before:null,after,reason:reason.trim()});
  return {version:calendar.version,days:days.length};
 });
}
