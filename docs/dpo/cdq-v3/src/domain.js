export const empty = () => ({
  version: 1,
  gerencias: [],
  cacs: [],
  remisiones: [],
  lotes: [],
  documentos: [],
  observaciones: [],
  audit: [],
});
export const states = ["Pendiente", "Verificado", "Verificado con observación"];
export function integer(n, label) {
  if (
    !Number.isSafeInteger(Number(n)) ||
    String(n).trim() === "" ||
    Number(n) < 0
  )
    throw Error(`${label}: ingrese un entero no negativo.`);
  return Number(n);
}
export function matches(period, f) {
  return (
    (!f.year || period.year === +f.year) &&
    (!f.month || period.month === +f.month) &&
    (!f.half || period.half === +f.half)
  );
}
export function scope(db, f) {
  const cacs = db.cacs.filter(
    (c) =>
      (!f.gerencia || c.gerenciaId === f.gerencia) &&
      (!f.cac || c.id === f.cac),
  );
  const ids = new Set(cacs.map((c) => c.id));
  const rem = db.remisiones.filter((r) => ids.has(r.cacId) && matches(r, f));
  const rids = new Set(rem.map((r) => r.id));
  const lots = db.lotes.filter((l) => rids.has(l.remisionId));
  const lids = new Set(lots.map((l) => l.id));
  return {
    cacs,
    rem,
    lots,
    docs: db.documentos.filter((d) => lids.has(d.loteId)),
  };
}
export function metrics(db, f) {
  const s = scope(db, f);
  let missing = 0,
    differences = 0;
  const counts = new Map();
  for (const d of s.docs) counts.set(d.loteId, (counts.get(d.loteId) || 0) + 1);
  for (const l of s.lots) {
    const n = counts.get(l.id) || 0;
    missing += Math.max(0, l.declared - n);
    if (n !== l.declared) differences++;
  }
  const reviewed = s.docs.filter((d) => d.state !== "Pendiente").length;
  const expected = s.cacs.length * (f.half ? 1 : 2);
  return {
    ...s,
    gerencias: new Set(s.cacs.map((c) => c.gerenciaId)).size,
    registered: s.rem.length,
    pendingRem: Math.max(0, expected - s.rem.length),
    declared: s.lots.reduce((n, l) => n + l.declared, 0),
    individual: s.docs.length,
    reviewed,
    pending: s.docs.length - reviewed,
    observed: s.docs.filter((d) => d.state === "Verificado con observación")
      .length,
    missing,
    differences,
    progress: s.docs.length ? (reviewed / s.docs.length) * 100 : null,
  };
}
export function validate(db) {
  if (
    db.version !== 1 ||
    ![
      "gerencias",
      "cacs",
      "remisiones",
      "lotes",
      "documentos",
      "observaciones",
      "audit",
    ].every((k) => Array.isArray(db[k]))
  )
    throw Error("Formato de datos incompatible.");
  const requireRef = (rows, id, label) => {
    if (!rows.some((x) => x.id === id))
      throw Error(`Referencia inválida: ${label}.`);
  };
  const unique = (rows, key, label) => {
    const a = rows.map(key);
    if (new Set(a).size !== a.length) throw Error(`Ya existe ${label}.`);
  };
  for (const key of [
    "gerencias",
    "cacs",
    "remisiones",
    "lotes",
    "documentos",
    "observaciones",
  ])
    unique(db[key], (x) => x.id, "un identificador");
  unique(db.gerencias, (x) => x.name.toLowerCase(), "esa gerencia");
  unique(
    db.cacs,
    (x) => x.gerenciaId + "|" + x.name.toLowerCase(),
    "ese CAC en la gerencia",
  );
  for (const g of [...db.gerencias, ...db.cacs])
    if (!g.name.trim()) throw Error("El nombre es obligatorio.");
  for (const c of db.cacs) requireRef(db.gerencias, c.gerenciaId, "gerencia");
  for (const r of db.remisiones) {
    requireRef(db.cacs, r.cacId, "CAC");
    if (
      !Number.isInteger(r.year) ||
      r.year < 2000 ||
      r.year > 2100 ||
      !Number.isInteger(r.month) ||
      r.month < 1 ||
      r.month > 12 ||
      ![1, 2].includes(r.half)
    )
      throw Error("Período inválido.");
  }
  unique(
    db.remisiones,
    (r) => `${r.cacId}|${r.year}|${r.month}|${r.half}`,
    "una remisión para ese CAC y quincena",
  );
  for (const l of db.lotes) {
    requireRef(db.remisiones, l.remisionId, "remisión");
    if (typeof l.declared !== "number")
      throw Error("Cantidad declarada inválida.");
    integer(l.declared, "Cantidad declarada");
    if (!l.code.trim())
      throw Error("El identificador del lote es obligatorio.");
  }
  unique(
    db.lotes,
    (l) => l.remisionId + "|" + l.code.toLowerCase(),
    "ese lote en la remisión",
  );
  for (const d of db.documentos) {
    requireRef(db.lotes, d.loteId, "lote");
    if (!d.type.trim() || !d.number.trim() || !states.includes(d.state))
      throw Error("Documento o estado inválido.");
    if (
      d.state === "Verificado con observación" &&
      !db.observaciones.some((o) => o.documentId === d.id)
    )
      throw Error("Registre una observación antes de usar ese estado.");
    if (
      db.observaciones.some((o) => o.documentId === d.id) &&
      d.state !== "Verificado con observación"
    )
      throw Error(
        "El documento conserva sus observaciones y debe identificarse como observado.",
      );
  }
  unique(
    db.documentos,
    (d) => `${d.loteId}|${d.type.toLowerCase()}|${d.number.toLowerCase()}`,
    "ese documento en el lote",
  );
  for (const o of db.observaciones) {
    requireRef(db.documentos, o.documentId, "documento");
    if (
      !o.description.trim() ||
      !o.owner.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(o.date) ||
      Number.isNaN(Date.parse(o.date)) ||
      (!Number.isNaN(Date.parse(o.date)) &&
        new Date(o.date).toISOString().slice(0, 10) !== o.date) ||
      !["Pendiente", "Regularizada"].includes(o.status)
    )
      throw Error(
        "Complete descripción, fecha, responsable y estado de la observación.",
      );
  }
  return db;
}
export function mutate(db, collection, row, actor) {
  if (!actor.trim()) throw Error("Indique el responsable del registro.");
  const next = structuredClone(db);
  const before = next[collection].find((x) => x.id === row.id) || null;
  if (
    collection === "observaciones" &&
    before &&
    before.documentId !== row.documentId
  )
    throw Error("No puede reasignar una observación a otro documento.");
  const i = next[collection].findIndex((x) => x.id === row.id);
  if (i < 0) next[collection].push(row);
  else next[collection][i] = row;
  let relatedChange = null;
  if (collection === "observaciones") {
    const document = next.documentos.find((d) => d.id === row.documentId);
    if (!document) throw Error("Referencia inválida: documento.");
    if (document.state !== "Verificado con observación") {
      relatedChange = {
        collection: "documentos",
        recordId: document.id,
        before: structuredClone(document),
      };
      document.state = "Verificado con observación";
      relatedChange.after = structuredClone(document);
    }
  }
  validate(next);
  next.audit.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor,
    collection,
    recordId: row.id,
    before,
    after: structuredClone(row),
    relatedChange,
  });
  return next;
}
