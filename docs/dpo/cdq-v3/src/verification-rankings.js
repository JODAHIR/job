export function verificationRankings(db,model){
 const users=new Map((db.users||[]).map(u=>[u.id,u.description?.trim()])),people=new Map();
 for(const row of model.lotEvidence){
  if(!row.finished||!row.reviewId||!row.reviewer||row.invalid)continue;
  if(!people.has(row.reviewer))people.set(row.reviewer,{id:row.reviewer,name:users.get(row.reviewer)||'Responsable sin descripción',reviewed:0,lots:0,pendingObservations:0});
  const p=people.get(row.reviewer);p.reviewed+=row.controlled;p.lots++;p.pendingObservations+=row.pending;
 }
 const responsible=[...people.values()].sort((a,b)=>b.reviewed-a.reviewed||b.lots-a.lots||a.name.localeCompare(b.name,'es'));
 const cacs=model.rankings.filter(r=>r.declared>0).map(r=>{
  const remIds=new Set(model.remissions.filter(x=>x.cacId===r.id).map(x=>x.id));
  const lots=model.lotEvidence.filter(l=>remIds.has(l.remisionId)&&!l.invalid);
  const reviewed=lots.filter(l=>l.finished),declaredReviewed=reviewed.reduce((s,l)=>s+l.declared,0);
  const presented=reviewed.reduce((s,l)=>s+l.controlled,0);
  return {...r,presented,declaredReviewed,coverage:declaredReviewed/r.declared*100,rate:declaredReviewed===r.declared?100*presented/r.declared:null};
 }).sort((a,b)=>(b.rate??-1)-(a.rate??-1)||b.presented-a.presented||a.name.localeCompare(b.name,'es'));
 return {responsible,cacs};
}
