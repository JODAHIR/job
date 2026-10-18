import { scope, metrics } from "./domain.js?v=cah-anulaciones-20261018";
export const reportTypes = {
  documentos: "Documentos por estado",
  observados: "Documentos observados",
  pendientes: "Pendientes de verificación",
  diferencias: "Lotes con diferencias",
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
    headers = [
      "Gerencia",
      "CAC",
      "Período",
      "Lote",
      "Tipo",
      "Número",
      "Estado",
      "Observaciones",
    ];
    rows = s.docs
      .filter(
        (d) =>
          (!state || d.state === state) &&
          (type !== "observados" || d.state === "Verificado con observación") &&
          (type !== "pendientes" || d.state === "Pendiente"),
      )
      .map((d) => [
        ...ctx(ls.get(d.loteId)),
        d.type,
        d.number,
        d.state,
        (obs.get(d.id) || [])
          .map((o) => `${o.description} (${o.date}; ${o.owner}; ${o.status})`)
          .join("\n"),
        rs.get(ls.get(d.loteId).remisionId).annulment ? "Anulada" : "Vigente",
      ]);
  }
  if (["diferencias", "faltantes"].includes(type)) {
    headers = [
      "Gerencia",
      "CAC",
      "Período",
      "Lote",
      "Declarados",
      "Individualizados",
      "Diferencia",
      "Faltantes",
    ];
    rows = s.lots
      .map((l) => {
        const n = counts.get(l.id) || 0;
        return [
          ...ctx(l),
          l.declared,
          n,
          n - l.declared,
          Math.max(0, l.declared - n),
          rs.get(l.remisionId).annulment ? "Anulada" : "Vigente",
        ];
      })
      .filter((r) => (type === "faltantes" ? r[7] > 0 : r[6] !== 0));
    note =
      "Los faltantes son cantidades sin identidad documental; no se inventan números. Los sobrantes no compensan faltantes de otro lote. Las cantidades se calculan con todos los documentos de cada lote seleccionado.";
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
  if(type !== 'comparativo')headers.push('Estado administrativo');
  note += ' Ámbito administrativo: '+(f.lifecycle==='all'?'incluye anuladas':f.lifecycle==='annulled'?'solo anuladas (histórico)':'solo vigentes; anuladas excluidas')+'. La anulación conserva fechas y documentos; no equivale a regularización.';
  return {
    title: reportTypes[type],
    headers,
    rows,
    note,
    generatedAt: new Date().toISOString(),
    source,
    filters: { ...f, state, comparison, horizon },
    scopeLabel: `Año ${f.year}; mes ${f.month}; quincena ${f.half || "ambas"}; gerencia ${f.gerencia ? gs.get(f.gerencia)?.name || f.gerencia : "todas las autorizadas"}; CAC ${f.cac ? cs.get(f.cac)?.name || f.cac : "todos los autorizados"}; estado ${state || "todos"}; remisión ${f.remission || "todas"}; conciliación ${f.reconciliation || "todas"}; verificación ${f.verification || "todas"}; observación ${f.observation || "todas"}; plazo ${f.deadline || "todos"}; administrativo ${f.lifecycle || "vigentes"}`,
  };
}
