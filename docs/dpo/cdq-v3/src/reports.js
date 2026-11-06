import {reportLotCounts} from './report-lot-counts.js';
import {managementSummary} from './management-summary.js?faltantes-20261105';
import {currentVerification} from './lot-verification.js?informes-20261024';
import {sortedTypes,lotTracking} from './lot-catalog.js?v=cah-lotes-20261019';
import { scope, metrics } from "./domain.js?v=cah-lotes-20261019";
export const reportTypes = {
  gerencias: "Resumen por gerencia",
  lotes: "Lotes por tipo documental",
  seguimiento: "Seguimiento de carga por CAC",
  documentos: "Documentos por estado",
  observados: "Documentos observados",
  pendientes: "Pendientes de verificación",
  diferencias: "Verificación de lotes",
  faltantes: "Faltantes por lote",
  plazos: "Plazos próximos y vencidos",
  comparativo: "Comparativo de períodos",
};
export function todayPY(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function makeReport(
  db,
  f,
  {
    type = "documentos",
    state = "",
    comparison = "quincena",
    today = todayPY(),
    horizon = 5,
    source = "Local",
  } = {},
) {
  if (!Object.hasOwn(reportTypes, type)) throw Error("Reporte inválido.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
    !Number.isInteger(horizon) ||
    horizon < 0 ||
    horizon > 30
  )
    throw Error("Fecha o ventana de plazo inválida.");
  const s = scope(db, f),
    map = (c) => new Map(db[c].map((x) => [x.id, x])),
    gs = map("gerencias"),
    cs = map("cacs"),
    rs = map("remisiones"),
    ls = map("lotes"),
    counts = new Map(),
    obs = new Map();
  for (const d of db.documentos) counts.set(d.loteId, (counts.get(d.loteId) || 0) + 1);
  for (const o of db.observaciones) {
    const a = obs.get(o.documentId) || [];
    a.push(o);
    obs.set(o.documentId, a);
  }
  const ctx = (l) => {
    const r = rs.get(l.remisionId),
      c = cs.get(r.cacId);
    return [
      gs.get(c.gerenciaId).name,
      c.name,
      `${r.year}-${String(r.month).padStart(2, "0")} Q${r.half}`,
      l.code,
    ];
  };
  let headers = [],
    rows = [],
    note = "";
  if (["documentos", "observados", "pendientes"].includes(type)) {
    headers = ["Gerencia", "CAC", "Tipo de documento", "Número", "Estado", "Observaciones"];
    rows = s.docs
      .filter(
        (d) =>
          (!state || d.state === state) &&
          (type !== "observados" || d.state === "Verificado con observación") &&
          (type !== "pendientes" || d.state === "Pendiente"),
      )
      .map((d) => [
        ...ctx(ls.get(d.loteId)).slice(0, 2),
        sortedTypes(db.catalog).find(t => t.id === ls.get(d.loteId)?.typeId || t.code === d.type || t.code === ls.get(d.loteId)?.typeCode)?.description || d.type || "Sin clasificación",
        d.number,
        d.state,
        (obs.get(d.id) || [])
          .map((o) => o.description)
          .join("\n"),
      ]);
  }
  if (["diferencias", "faltantes"].includes(type)) {
    headers = ["Gerencia", "CAC", "Tipo de documento", "Declarados",
      "Individualizados", "Presentados / conciliados", "Saldo de conciliación", "Faltantes", "Verificados correctamente"];
    rows = [...s.lots].sort((a,b) => String(a.code || "").localeCompare(String(b.code || ""), "es", {numeric:true})).map(l => {
      const rem = rs.get(l.remisionId);
      const review = currentVerification(db.lotVerifications || [], l,
        db.remisionControls?.find(c => c.id === l.remisionId), !!rem.annulment, db);
      const individual = counts.get(l.id) || 0;
      const presented = review?.registered ?? individual;
      const documentType = sortedTypes(db.catalog).find(t => t.id === l.typeId || t.code === l.typeCode);
      const totals = reportLotCounts(l, individual, presented, documentType);
      const status = rem.annulment ? "Anulado" : review?.result ||
        (db.lotVerifications?.some(v => v.lotId === l.id) ? "Requiere nueva revisión" : "Sin conciliación registrada");
      return [...ctx(l).slice(0, 2), documentType?.description || l.typeCode || "Sin clasificación",
        l.declared, individual, presented, presented - l.declared,
        totals.missing, totals.correct, status];
    }).filter(r => type === "faltantes" ? r[7] > 0 : true);
    note = "Faltantes = documentos individualizados, excepto Acuerdo de adhesión, que conserva el cálculo por conciliación. Verificados correctamente = declarados menos faltantes; en adhesión se conserva el descuento adicional de individualizados. El informe de faltantes incluye únicamente lotes con faltantes mayores a cero.";
  }

  if (type === "plazos") {
    headers = [
      "Gerencia",
      "CAC",
      "Período",
      "Recepción",
      "Vencimiento",
      "Días restantes",
      "Situación",
      "Versión calendario",
    ];
    rows = s.rem
      .map((r) => {
        const c = cs.get(r.cacId),
          days = r.dueOn
            ? Math.round((Date.parse(r.dueOn) - Date.parse(today)) / 86400000)
            : null;
        return [
          gs.get(c.gerenciaId).name,
          c.name,
          `${r.year}-${String(r.month).padStart(2, "0")} Q${r.half}`,
          r.receivedOn || "Sin recepción",
          r.dueOn || "Sin plazo calculado",
          days ?? "",
          days === null
            ? "Sin plazo"
            : days < 0
              ? "Vencido"
              : days === 0
                ? "Vence hoy"
                : `Próximo (${horizon} días)`,
          r.calendarVersion || "—",
          r.annulment ? "Anulada" : "Vigente",
        ];
      })
      .filter((r) => r[5] === "" || r[5] <= horizon);
    note = `Fecha de corte: ${today} (Paraguay). Ventana: ${horizon} días calendario. El vencimiento proviene del cálculo de días hábiles del servidor. La verificación documental no suspende el plazo. Las remisiones anuladas solo aparecen si se incluyen mediante el filtro administrativo. Los filtros avanzados delimitan las remisiones seleccionadas.`;
  }
  if (type === "comparativo") {
    if (!["quincena", "mes", "año"].includes(comparison))
      throw Error("Comparación inválida.");
    let current = { ...f },
      previous = { ...f };
    if (comparison === "quincena") {
      if (!f.half) {
        current.half = 2;
        previous.half = 1;
      } else if (+f.half === 2) previous.half = 1;
      else {
        previous.half = 2;
        previous.month = +f.month - 1;
        if (!previous.month) {
          previous.month = 12;
          previous.year = +f.year - 1;
        }
      }
    } else if (comparison === "mes") {
      current.half = "";
      previous.half = "";
      previous.month = +f.month - 1;
      if (!previous.month) {
        previous.month = 12;
        previous.year = +f.year - 1;
      }
    } else {
      current.month = "";
      current.half = "";
      previous.month = "";
      previous.half = "";
      previous.year = +f.year - 1;
    }
    headers = [
      "Período comparado",
      "Declarados",
      "Individualizados",
      "Revisados",
      "Pendientes",
      "Observados",
      "Faltantes",
      "Lotes con diferencias",
      "Avance %",
    ];
    rows = [previous, current].map((p) => {
      const m = metrics(db, p);
      return [
        `${p.year}${p.month ? "-" + String(p.month).padStart(2, "0") : ""}${p.half ? " Q" + p.half : ""}`,
        m.declared,
        m.individual,
        m.reviewed,
        m.pending,
        m.observed,
        m.missing,
        m.differences,
        m.progress === null
          ? "Sin documentos para verificar"
          : Number(m.progress.toFixed(2)),
      ];
    });
    note =
      "Mismo ámbito de gerencia y CAC. Mes: meses completos; año: años completos; quincena: seleccionada contra anterior (ambas: Q2 contra Q1). Los filtros avanzados se aplican a ambos períodos. Porcentajes sobre documentos individualizados.";
  }
  if (['lotes','gerencias'].includes(type)) {
    const types = sortedTypes(db.catalog);
    const ordered = [...s.lots].sort((a,b)=> {
      const ca=ctx(a), cb=ctx(b);
      return ca[0].localeCompare(cb[0],'es') || ca[1].localeCompare(cb[1],'es',{numeric:true}) || String(a.code).localeCompare(String(b.code),'es',{numeric:true});
    });
    headers = type==='lotes'
      ? ['Gerencia','CAC','Período','Lote','Tipo','Remitidos','Observados','Verificado','Total','Estado']
      : ['Gerencia','CAC','Tipo de documento','Remitidos'];
    const groups = new Map();
    for(const l of ordered) {
      const context=ctx(l), key=JSON.stringify(context.slice(0,2));
      if(!groups.has(key))groups.set(key,[]);
      const description=types.find(t=>t.id===l.typeId||t.code===l.typeCode)?.description || l.typeCode || 'Sin clasificación';
      if(type==='gerencias') {
        const group=groups.get(key), existing=group.find(row=>row[2]===description);
        if(existing)existing[3]+=l.declared;
        else group.push([...context.slice(0,2),description,l.declared]);
      } else {
        const rem=rs.get(l.remisionId);
        const review=currentVerification(db.lotVerifications||[],l,db.remisionControls?.find(c=>c.id===l.remisionId),!!rem.annulment,db);
        const individual=counts.get(l.id)||0;
        const verified=review?.registered ?? 'Sin conciliación';
        const status=rem.annulment?'Anulado':review?.result || 'Sin conciliación registrada';
        groups.get(key).push([...context,description,l.declared,individual,verified,review?verified+individual:'Sin conciliación',status]);
      }
    }
    for(const group of groups.values()) {
      if(type==='gerencias')group.sort((a,b)=>a[2].localeCompare(b[2],'es'));
      rows.push(...group);
      const sum=i=>group.reduce((n,r)=>n+(typeof r[i]==='number'?r[i]:0),0);
      if(type==='lotes') {
        const complete=group.every(r=>typeof r[7]==='number');
        rows.push([group[0][0],group[0][1],'','SUBTOTAL CAC','',sum(5),sum(6),complete?sum(7):'Sin conciliación completa',complete?sum(8):'Sin conciliación completa','']);
      } else rows.push([group[0][0],group[0][1],'SUBTOTAL CAC',sum(3)]);
    }
    if(type==='gerencias') {
      const descriptions=[...new Set(ordered.map(l=>types.find(t=>t.id===l.typeId||t.code===l.typeCode)?.description || l.typeCode || 'Sin clasificación'))];
      headers=['Gerencia','CAC',...descriptions,'Total remitidos','Estado del lote'];
      rows=[...groups.entries()].map(([key,group])=>{
        const states=new Map();
        for(const lot of ordered.filter(l=>JSON.stringify(ctx(l).slice(0,2))===key)) {
          const rem=rs.get(lot.remisionId);
          const review=currentVerification(db.lotVerifications||[],lot,db.remisionControls?.find(c=>c.id===lot.remisionId),!!rem?.annulment,db);
          const state=rem?.annulment?'Anulado':review?.result || 'Sin conciliación registrada';
          states.set(state,(states.get(state)||0)+1);
        }
        const amounts=descriptions.map(d=>group.filter(r=>r[2]===d).reduce((n,r)=>n+Number(r[3]||0),0));
        return [...JSON.parse(key),...amounts,amounts.reduce((a,b)=>a+b,0),[...states].map(([state,n])=>`${state}: ${n}`).join(' · ')];
      });
    }
    note=type==='lotes'?'Verificado corresponde a la conciliación vigente. Total = Verificado + Observados. Los subtotales de Verificado y Total requieren conciliación vigente de todos los lotes del CAC.':'Cantidad remitida acumulada por gerencia, CAC y tipo documental.';
  }
  if(type==='seguimiento'){
    headers=['Gerencia','CAC','Período','Seguimiento','Lotes','Declarados','Individualizados','Revisados','Observados','Faltantes','Tipos pendientes'];
    rows=lotTracking(db,f).map(r=>[gs.get(r.gerenciaId)?.name,cs.get(r.cacId)?.name,`${r.year}-${r.month} Q${r.half}`,r.status,r.lots,r.declared,r.received,r.reviewed,r.observed,r.missing,r.pending,r.status==='Anulada'?'Anulada':'Vigente']);
    note='Carga completa no significa verificada. Exclusiones sin descuento: procedimiento pendiente.';
  }
  if(!['comparativo','gerencias','lotes','documentos','observados','pendientes'].includes(type))headers.push(['diferencias','faltantes'].includes(type)?'Estado del lote':'Estado administrativo');
  if (!['gerencias','lotes'].includes(type) && headers.includes('CAC') && headers.includes('Tipo de documento')) {
    const cac = headers.indexOf('CAC'), kind = headers.indexOf('Tipo de documento');
    rows.sort((a,b) => String(a[cac]).localeCompare(String(b[cac]), 'es', {numeric:true}) || String(a[kind]).localeCompare(String(b[kind]), 'es', {numeric:true}));
  }
  note += ' Ámbito administrativo: '+(f.lifecycle==='all'?'incluye anuladas':f.lifecycle==='annulled'?'solo anuladas (histórico)':'solo vigentes; anuladas excluidas')+'. La anulación conserva fechas y documentos; no equivale a regularización.';
  return {
    title: type==='gerencias' ? reportTypes[type]+' - '+(f.gerencia ? gs.get(f.gerencia)?.name || 'Gerencia seleccionada' : 'Todas las gerencias') : reportTypes[type],
    pdfIntroduction: type==='gerencias' ? (()=>{
      const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const period=f.from||f.to ? `al período desde ${f.from||'el inicio'} hasta ${f.to||'la fecha seleccionada'}` : f.year&&f.month ? `a ${Number(f.half)===1?'la primera quincena':Number(f.half)===2?'la segunda quincena':'ambas quincenas'} del mes de ${months[Number(f.month)-1]} de ${f.year}` : 'a los períodos seleccionados';
      const management=f.gerencia ? gs.get(f.gerencia)?.name || 'Gerencia seleccionada' : 'las gerencias autorizadas seleccionadas';
      return [`Se informa sobre la verificación de las documentaciones correspondientes ${period}, remitidas por ${management}.`,
        'Las mismas corresponden a operaciones de Alta cliente | Desembolso | Cobranza, reflejadas en el sistema de cartera de préstamos de los distintos CAC que componen la gerencia.',
        'El detalle siguiente presenta las cantidades remitidas y el estado de verificación de los lotes. La constancia de ausencia de documentos faltantes, cumplimiento del Manual de Procedimientos de Rendición de Documentos que respaldan las Operaciones de Desembolsos de Préstamos (Resolución del Consejo Directivo N.º 26, Acta N.º 34, de fecha 23/10/2025) y finalización del proceso requiere validación del responsable.'];
    })() : [],
    headers,
    rows,
    note,
    generatedAt: new Date().toISOString(),
    source,
    filters: { ...f, state, comparison, horizon },
    scopeLabel: `Año ${f.year || "todos"}; mes ${f.month || "todos"}; quincena ${f.half || "ambas"}; gerencia ${f.gerencia ? gs.get(f.gerencia)?.name || f.gerencia : "todas las autorizadas"}; CAC ${f.cac ? cs.get(f.cac)?.name || f.cac : "todos los autorizados"}; estado ${state || "todos"}; tipo ${f.documentType || "todos"}; remisión ${f.remission || "todas"}; conciliación ${f.reconciliation || "todas"}; verificación ${f.verification || "todas"}; observación ${f.observation || "todas"}; plazo ${f.deadline || "todos"}; administrativo ${f.lifecycle || "vigentes"}`,
  };
}

