import { validate, integer, states } from "./domain.js";
export const columns = [
  "tipo",
  "numero",
  "estado",
  "observacion",
  "fecha",
  "responsable",
  "regularizacion",
];
export const template = columns.join(",") + "\r\nActa,001,Pendiente,,,,\r\n";
export function parseCSV(source) {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > 250000
  )
    throw Error("Archivo mayor de 250 KB o inválido.");
  source = source.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw Error("Comillas CSV inválidas.");
      quoted = true;
      continue;
    }
    if (c === "," || c === "\r" || c === "\n") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && source[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
      }
      continue;
    }
    if (closed) throw Error("Contenido después del cierre de comillas.");
    cell += c;
  }
  if (quoted) throw Error("Comillas CSV sin cerrar.");
  if (cell || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }
  while (rows.length && rows.at(-1).every((c) => !c.trim())) rows.pop();
  if (
    !rows.length ||
    JSON.stringify(rows.shift().map((c) => c.trim())) !==
      JSON.stringify(columns)
  )
    throw Error("Encabezados incorrectos. Descargue la plantilla CSV.");
  if (!rows.length || rows.length > 100)
    throw Error("El archivo debe contener entre 1 y 100 documentos.");
  return rows.map((r, i) => {
    if (r.length !== columns.length)
      throw Error(`Fila ${i + 2}: se esperan ${columns.length} columnas.`);
    return Object.fromEntries(columns.map((c, j) => [c, r[j].trim()]));
  });
}
export function prepareBulk(db, input) {
  const { remisionId, code, batchId } = input;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(batchId ?? ""))
    throw Error("Identificador de importación inválido.");
  if (typeof code !== "string" || !code.trim() || code.length > 150)
    throw Error("Identificador de lote requerido (máximo 150).");
  const declared = integer(input.declared, "Cantidad declarada");
  if (!db.remisiones.some((r) => r.id === remisionId))
    throw Error("Remisión inexistente o no autorizada.");
  const rows = parseCSV(input.csv),
    errors = [],
    seen = new Set(),
    docs = [],
    observations = [];
  rows.forEach((r, i) => {
    const error = (m) => errors.push(`Fila ${i + 2}: ${m}`),
      key = JSON.stringify([r.tipo.toLowerCase(), r.numero.toLowerCase()]);
    if (!r.tipo || !r.numero || r.tipo.length > 150 || r.numero.length > 150)
      error("tipo y número obligatorios, máximo 150 caracteres.");
    if (seen.has(key)) error("documento duplicado en el archivo.");
    seen.add(key);
    if (!states.includes(r.estado)) error("estado de verificación inválido.");
    if (r.estado === "Verificado con observación" && !r.observacion)
      error("falta la observación.");
    if (r.observacion && r.estado !== "Verificado con observación")
      error("la observación requiere estado Verificado con observación.");
    if (!r.observacion && (r.fecha || r.responsable || r.regularizacion))
      error("hay campos de observación sin descripción.");
    const d = {
      id: `${batchId}_d${i}`,
      loteId: batchId,
      type: r.tipo,
      number: r.numero,
      state: r.estado,
    };
    docs.push(d);
    if (r.observacion) {
      if (r.observacion.length > 2000 || r.responsable.length > 150)
        error("observación o responsable demasiado largo.");
      if (
        !r.responsable ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha) ||
        Number.isNaN(Date.parse(r.fecha)) ||
        (!Number.isNaN(Date.parse(r.fecha)) &&
          new Date(r.fecha).toISOString().slice(0, 10) !== r.fecha) ||
        !["Pendiente", "En proceso", "Regularizada"].includes(r.regularizacion)
      )
        error("complete fecha válida, responsable y regularización.");
      observations.push({
        id: `${batchId}_o${i}`,
        documentId: d.id,
        description: r.observacion,
        date: r.fecha,
        owner: r.responsable,
        status: r.regularizacion,
      });
    }
  });
  if (errors.length) throw Error(errors.join("\n"));
  const lot = { id: batchId, remisionId, code: code.trim(), declared },
    next = structuredClone(db);
  next.lotes.push(lot);
  next.documentos.push(...docs);
  next.observaciones.push(...observations);
  validate(next);
  return {
    next,
    lot,
    docs,
    observations,
    summary: {
      declared,
      individual: docs.length,
      observations: observations.length,
      difference: docs.length - declared,
      missing: Math.max(0, declared - docs.length),
    },
  };
}
export function applyBulkLocal(db, input, actor) {
  if (!actor?.trim()) throw Error("Indique el responsable.");
  const result = prepareBulk(db, input);
  result.next.audit.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor,
    collection: "bulkImport",
    recordId: result.lot.id,
    before: null,
    after: {
      lot: result.lot,
      documentos: result.docs,
      observaciones: result.observations,
    },
    reason: "Importación CSV confirmada",
  });
  return result.next;
}
