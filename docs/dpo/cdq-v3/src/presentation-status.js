export function connectionState(mode,online=true,failed=false){
 if(mode!=='cloud')return {tone:'local',label:'Almacenamiento local'};
 return !online||failed?{tone:'offline',label:'Sin conexión'}:{tone:'connected',label:'Conectado'};
}
export function orderLots(lots,db){
 const rem=new Map(db.remisiones.map(r=>[r.id,r])),cacs=new Map(db.cacs.map(c=>[c.id,c])),gs=new Map(db.gerencias.map(g=>[g.id,g.name]));
 const cmp=(a,b)=>String(a||'').localeCompare(String(b||''),'es',{numeric:true,sensitivity:'base'});
 return [...lots].sort((a,b)=>{const x=rem.get(a.remisionId)||{},y=rem.get(b.remisionId)||{},c=cacs.get(x.cacId)||{},d=cacs.get(y.cacId)||{};return (x.year||0)-(y.year||0)||(x.month||0)-(y.month||0)||(x.half||0)-(y.half||0)||cmp(gs.get(c.gerenciaId),gs.get(d.gerenciaId))||cmp(c.name,d.name)||cmp(a.code,b.code)||cmp(a.id,b.id);});
}
export function deadlineProgress(start,due,today){
 const parse=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return NaN;const t=Date.parse(v+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v?t:NaN;};
 const s=parse(start),d=parse(due),t=parse(today);
 if(!Number.isFinite(d)||!Number.isFinite(t))return null;
 const days=Math.round((d-t)/86400000),duration=(d-s)/86400000;
 return {days,remaining:Number.isFinite(s)&&duration>0?Math.max(0,Math.min(100,100*days/duration)):null,tone:days<0?'offline':days<=2?'local':'connected'};
}
