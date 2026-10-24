import { template, prepareBulk, applyBulkLocal } from "./bulk.js?v=cah-lotes-20261019";
import { makeReport, reportTypes } from "./reports.js?informes-20261024";
import { states } from "./domain.js?v=cah-lotes-20261019";
const settings = {
  type: "documentos",
  state: "",
  comparison: "quincena",
  horizon: 5,
};
const $ = (s) => document.querySelector(s);
const opts = (items, value, esc) =>
  items
    .map(
      ([id, label]) =>
        `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
export function phase3Panel(page, c) {
  const { db, esc, table, f, cloud, mode } = c;
  if (page === "reports") {
    const r = makeReport(db, f, {
      ...settings,
      source:
        mode === "demo"
          ? "Datos ficticios"
          : mode === "cloud"
            ? "Vista de datos autorizados · actualizar al exportar"
            : "Registros locales",
    });
    return `<section class="panel"><h2>Reportes y comparativos</h2><div class="report-controls"><label>Informe<select id="report-type">${opts(Object.entries(reportTypes), settings.type, esc)}</select></label><label>Estado documental<select id="report-state" ${!["documentos", "observados", "pendientes"].includes(settings.type) ? "disabled" : ""}>${opts([["", "Todos"], ...states.map((s) => [s, s])], settings.state, esc)}</select></label><label>Comparar<select id="report-comparison" ${settings.type !== "comparativo" ? "disabled" : ""}>${opts(
      ["quincena", "mes", "año"].map((s) => [s, s]),
      settings.comparison,
      esc,
    )}</select></label><label>Próximos días calendario<input id="report-horizon" type="number" min="0" max="30" value="${settings.horizon}" ${settings.type !== "plazos" ? "disabled" : ""}></label></div><p>${esc(r.note)}</p><div class="form-actions"><button data-export="xlsx" class="primary">Exportar Excel</button><button data-export="pdf" class="secondary">Exportar PDF</button></div><p id="phase3-error" role="alert"></p><p>${r.rows.length} filas · Se exporta el informe completo con estos filtros.</p>${table(
      r.headers,
      r.rows.slice(0, 100).map((row) => row.map(esc)),
    )}${r.rows.length > 100 ? "<p>Vista previa limitada a 100 filas.</p>" : ""}</section>`;
  }
  if (page === "bulk" && cloud?.spark) return `<section class="panel"><h2>Importación masiva</h2><p>La importación masiva aún no está habilitada en el espacio Firebase Spark. Puede registrar documentos individualmente. No se realizará una importación parcial.</p></section>`;
  if (page === "bulk") {
    const rem = db.remisiones.filter((r) => {
      const cac = db.cacs.find((c) => c.id === r.cacId);
      return (
        (!f.gerencia || cac.gerenciaId === f.gerencia) &&
        (!f.cac || cac.id === f.cac) &&
        r.year === +f.year &&
        r.month === +f.month &&
        (!f.half || r.half === +f.half)
      );
    });
    return `<section class="panel"><h2>Importación masiva de documentos</h2><p>Un archivo CSV UTF-8 crea un lote nuevo completo en una remisión existente. Máximo 100 documentos y 250 KB. Puede preparar el archivo en Excel y guardarlo como CSV separado por comas.</p><button id="bulk-template" class="secondary">Descargar plantilla CSV</button><form id="bulk-form" class="form-fields"><label>Remisión del ámbito seleccionado<select name="remisionId" required><option value="">Seleccionar…</option>${rem.map((r) => `<option value="${esc(r.id)}">${esc(db.cacs.find((c) => c.id === r.cacId).name)} · ${r.year}-${r.month} Q${r.half}</option>`).join("")}</select></label><label>Identificador del nuevo lote<input name="code" required maxlength="150"></label><label>Cantidad declarada<input name="declared" required type="number" min="0" step="1"></label><label>Archivo CSV<input name="file" type="file" accept=".csv,text/csv" required></label>${mode === "cloud" ? "" : '<label>Responsable<input name="actor" required maxlength="150"></label>'}<button class="primary">Validar archivo</button></form><pre id="phase3-error" role="alert"></pre><div id="bulk-preview"></div></section>`;
  }
  if (page === "audit") {
    const choices = db.gerencias.map((g) => ["g:" + g.id, g.name]);
    if (
      mode === "cloud" &&
      ["director", "technical"].includes(cloud.profile.role)
    )
      for (const k of ["profiles", "assignments", "calendars"])
        choices.push(["a:" + k, `Autorizaciones · ${k}`]);
    return `<section class="panel"><h2>${mode === "cloud" ? "Auditoría del servidor" : "Trazabilidad local"}</h2><p>${mode === "cloud" ? "Solo consulta. Cambios y autorizaciones registrados por el servidor. Seleccione una gerencia o categoría de autorización." : "Registro local informativo; no acredita identidad ni impide alteraciones del navegador."}</p><form id="audit-query" class="report-controls">${mode === "cloud" ? `<label>Ámbito<select name="scope">${opts(choices, f.gerencia ? "g:" + f.gerencia : choices[0]?.[0], esc)}</select></label>` : ""}<label>Desde (UTC)<input type="date" name="from" value="2000-01-01" required></label><label>Hasta (UTC)<input type="date" name="to" value="2100-12-31" required></label><button class="primary">Consultar</button></form><label>Buscar responsable, entidad, motivo o autorización en las filas cargadas<input id="audit-search" type="search"></label><p id="phase3-error" role="alert"></p><div id="audit-results"></div><button id="audit-more" hidden class="secondary">Cargar siguientes 50</button></section>`;
  }
}
export function bindPhase3(page, c) {
  const { db, f, mode, cloud, esc, table, render, load, repo } = c;
  if(page === "bulk" && cloud?.spark) return;
  const fail = (e) => {
    if ($("#phase3-error")) $("#phase3-error").textContent = e.message;
  };
  if (page === "reports") {
    for (const key of ["type", "state", "comparison", "horizon"])
      $("#report-" + key).onchange = (e) => {
        settings[key] =
          key === "horizon"
            ? Math.max(0, Math.min(30, Number(e.target.value) || 0))
            : e.target.value;
        if (
          key === "type" &&
          !["documentos", "observados", "pendientes"].includes(settings.type)
        )
          settings.state = "";
        render();
      };
    document.querySelectorAll("[data-export]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            const module = await import("./exporters.bundle.js?v=cah-lotes-20261019");
            const report =
              mode === "cloud"
                ? await cloud.call("report", {
                    filters: { ...f },
                    options: { ...settings },
                  })
                : makeReport(db, f, {
                    ...settings,
                    source:
                      mode === "demo" ? "Datos ficticios" : "Registros locales",
                  });
            if (!b.isConnected) return;
            if (b.dataset.export === "xlsx")
              module.download(
                await module.excelBytes(report),
                "control-documental.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              );
            else
              module.download(
                module.pdfBytes(report),
                "control-documental.pdf",
                "application/pdf",
              );
          } catch (e) {
            fail(e);
          } finally {
            b.disabled = false;
          }
        }),
    );
  }
  if (page === "bulk") {
    let preview = null,
      generation = 0;
    $("#bulk-template").onclick = () => {
      const url = URL.createObjectURL(
          new Blob(["\uFEFF" + template], { type: "text/csv;charset=utf-8" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-documentos.csv";
      a.click();
      URL.revokeObjectURL(url);
    };
    const invalidate = () => {
      generation++;
      preview = null;
      $("#bulk-preview").innerHTML = "";
    };
    $("#bulk-form").oninput = invalidate;
    $("#bulk-form").onsubmit = async (e) => {
      e.preventDefault();
      invalidate();
      $("#phase3-error").textContent = "";
      const b = e.submitter,
        version = generation;
      b.disabled = true;
      try {
        const values = new FormData(e.target),
          file = values.get("file");
        if (file.size > 250000) throw Error("El archivo supera 250 KB.");
        const input = {
          remisionId: values.get("remisionId"),
          code: values.get("code"),
          declared: Number(values.get("declared")),
          batchId: crypto.randomUUID(),
          csv: await file.text(),
        };
        const result = prepareBulk(db, input),
          r = db.remisiones.find((r) => r.id === input.remisionId),
          gerenciaId = db.cacs.find((c) => c.id === r.cacId).gerenciaId;
        const server =
          mode === "cloud"
            ? await cloud.call("importDocuments", { ...input, gerenciaId })
            : null;
        if (!b.isConnected || version !== generation) return;
        preview = {
          input,
          gerenciaId,
          hash: server?.confirmHash,
          actor: values.get("actor"),
        };
        $("#bulk-preview").innerHTML =
          `<h3>Archivo válido</h3><p>${result.summary.individual} documentos · ${result.summary.declared} declarados · Diferencia ${result.summary.difference} · ${result.summary.observations} observaciones.</p>${table(
            ["Tipo", "Número", "Estado"],
            result.docs.map((d) => [esc(d.type), esc(d.number), esc(d.state)]),
          )}<button id="bulk-confirm" class="primary">Confirmar registro completo</button>`;
        $("#bulk-confirm").onclick = async (e) => {
          e.target.disabled = true;
          try {
            if (!preview) throw Error("Valide nuevamente.");
            if (mode === "cloud")
              await cloud.call("importDocuments", {
                ...preview.input,
                gerenciaId: preview.gerenciaId,
                confirmHash: preview.hash,
              });
            else {
              const current = await repo.load();
              await repo.save(
                applyBulkLocal(current, preview.input, preview.actor),
              );
            }
            await load();
          } catch (err) {
            fail(err);
            e.target.disabled = false;
          }
        };
      } catch (err) {
        fail(err);
      } finally {
        b.disabled = false;
      }
    };
  }
  if (page === "audit") {
    const resultsNode = $("#audit-results");
    let rows = [],
      cursor = null,
      request = null,
      busy = false;
    const show = () => {
      const term = $("#audit-search").value.toLocaleLowerCase("es"),
        visible = rows.filter((a) =>
          JSON.stringify(a).toLocaleLowerCase("es").includes(term),
        );
      $("#audit-results").innerHTML =
        `<p>${visible.length} coincidencias en ${rows.length} filas cargadas.</p>` +
        table(
          ["Fecha (UTC)", "Responsable", "Entidad", "Detalle"],
          visible.map((a) => [
            esc(a.at),
            esc(a.actor),
            esc(a.collection),
            `<details><summary>${esc(a.recordId || a.id)}</summary><pre>${esc(JSON.stringify(a, null, 2))}</pre></details>`,
          ]),
        );
      $("#audit-more").hidden = !cursor;
    };
    const fetchPage = async (reset) => {
      if (busy) return;
      busy = true;
      try {
        if (reset) {
          rows = [];
          cursor = null;
        }
        if (mode === "cloud") {
          const result = await cloud.call("queryAudit", {
            ...request,
            ...(cursor ? { cursor } : {}),
          });
          if ($("#audit-results") !== resultsNode) return;
          rows.push(...result.rows);
          cursor = result.cursor;
        } else
          rows = db.audit
            .filter(
              (a) =>
                a.at.slice(0, 10) >= request.from &&
                a.at.slice(0, 10) <= request.to,
            )
            .sort((a, b) => b.at.localeCompare(a.at));
        show();
      } catch (e) {
        fail(e);
      } finally {
        busy = false;
      }
    };
    $("#audit-query").onsubmit = (e) => {
      e.preventDefault();
      if (busy) return;
      const v = Object.fromEntries(new FormData(e.target));
      if (v.from > v.to) {
        fail(Error("Rango de fechas inválido."));
        return;
      }
      const [kind, id] = (v.scope || "").split(":");
      request = {
        from: v.from,
        to: v.to,
        ...(kind === "g"
          ? { gerenciaId: id }
          : kind === "a"
            ? { kind: id }
            : {}),
      };
      fetchPage(true);
    };
    $("#audit-more").onclick = () => fetchPage(false);
    $("#audit-search").oninput = show;
    $("#audit-query").requestSubmit();
  }
}
