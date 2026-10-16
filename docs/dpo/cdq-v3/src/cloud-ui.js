const roles = {
  director: "Director de Operaciones",
  gerente: "Gerente Departamental",
  asistente: "Asistente operativo",
  technical: "Administrador técnico",
};
const input = (name, label, type = "text", value = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${value}" required></label>`;
export function cloudPanel(page, ctx) {
  const { db, cloud, esc, table, badge } = ctx;
  const technical = cloud.profile.role === "technical";
  const director = cloud.profile.role === "director" || technical;
  if (page === "access") {
    const users = db.users ?? [];
    const rows = users.map((u) => [
      esc(u.id),
      esc((roles[u.role] ?? u.role) + (u.secondaryRole ? " + " + roles[u.secondaryRole] : "")),
      u.active ? "Activo" : "Inactivo",
      esc(u.gerenciaId ?? (u.gerencias ?? []).join(", ")),
      String(u.revision ?? 0),
    ]);
    const choose = `<label>Usuario<select name="uid" required>${users
      .filter((u) => u.role === "asistente" && u.active)
      .map((u) => `<option value="${esc(u.id)}">${esc(u.id)}</option>`)
      .join("")}</select></label>`;
    return `<section class="panel"><h2>Usuarios y permisos</h2><p>Las asignaciones se verifican nuevamente en cada operación del servidor.</p>${table(["UID", "Rol", "Estado", "Gerencias", "Revisión"], rows)}${cloud.spark && technical ? `<h2>Solicitudes de acceso</h2>${table(["UID", "Correo"], (db.accessRequests ?? []).map(r => [esc(r.id), esc(r.email)]))}` : ""}${
      director
        ? `<form id="assignment-form" class="form-fields"><h2>Asignar o retirar gerencias a un asistente</h2>${choose}<fieldset><legend>Asignación completa que reemplazará la actual</legend>${db.gerencias.map((g) => `<label class="check-label"><input type="checkbox" name="gerencias" value="${esc(g.id)}">${esc(g.name)}</label>`).join("")}</fieldset>${input("reason", "Motivo")}<button class="primary">Guardar asignación completa</button></form>` : ""}${technical ? `<form id="profile-form" class="form-fields"><h2>Provisionar perfil</h2><p>El UID debe corresponder a una cuenta creada en Firebase Authentication. El administrador tiene acceso operativo global. El segundo rol es opcional y no reduce sus permisos. No puede modificar su propio perfil.</p>${input("uid", "UID de Firebase Authentication")}<label>Rol<select name="role">${Object.entries(
            roles,
          )
            .map(([id, label]) => `<option value="${id}">${label}</option>`)
            .join(
              "",
            )}</select></label><label>Segundo rol (solo administrador)<select name="secondaryRole"><option value="">Ninguno</option><option value="director">Director de Operaciones</option><option value="asistente">Asistente operativo</option><option value="gerente">Gerente Departamental</option></select></label><label>Estado<select name="active"><option value="true">Activo</option><option value="false">Inactivo</option></select></label><label>ID de gerencia (solo Gerente)<input name="gerenciaId"></label>${input("expectedRevision", "Revisión actual (0 para nueva cuenta)", "number", "0")}${input("reason", "Motivo")}<button class="primary">Guardar perfil</button></form>` : ""
    }<p id="cloud-message" role="status"></p></section>`;
  }
  if (page === "deadlines") {
    const allowedCacs = db.cacs.filter(
      (c) =>
        (!ctx.f.gerencia || c.gerenciaId === ctx.f.gerencia) &&
        (!ctx.f.cac || c.id === ctx.f.cac),
    );
    const rows = db.remisiones
      .filter(
        (r) =>
          allowedCacs.some((c) => c.id === r.cacId) &&
          r.year === +ctx.f.year &&
          r.month === +ctx.f.month &&
          (!ctx.f.half || r.half === +ctx.f.half),
      )
      .map((r) => [
        esc(r.id),
        esc(ctx.find("cacs", r.cacId)?.name),
        esc(r.receivedOn ?? "Sin recepción"),
        esc(r.originalDueOn ?? "Sin calcular"),
        esc(r.dueOn ?? "Sin calcular"),
        esc(r.calendarVersion ?? "—"),
        badge(
          r.exception ? "Excepción autorizada" : "Plazo general",
          r.exception ? "warn" : "neutral",
        ),
      ]);
    return `<section class="panel"><h2>Plazo general · diez días hábiles</h2><p>Desde el día siguiente a la recepción, con calendario oficial aprobado. Las verificaciones y observaciones no reinician ni suspenden el plazo. Fecha civil de Paraguay; vencimiento al finalizar el día indicado.</p>${table(["Remisión", "CAC", "Recepción", "Vencimiento original", "Vencimiento vigente", "Calendario", "Autorización"], rows)}${director ? `<form id="exception-form" class="form-fields"><h2>Autorizar excepción</h2><label>Remisión<select name="remisionId" required>${db.remisiones.map((r) => `<option value="${esc(r.id)}">${esc(r.id)} · ${esc(ctx.find("cacs", r.cacId)?.name)}</option>`).join("")}</select></label>${input("dueOn", "Nuevo vencimiento autorizado", "date")}${input("authorization", "Referencia de resolución/autorización")}${input("reason", "Motivo")}<button class="primary">Autorizar y registrar auditoría</button></form><form id="calendar-form" class="form-fields"><h2>Aprobar calendario oficial</h2><p>Versión activa: ${esc(db.calendarVersion ?? "ninguna")}. Cargue JSON con version, coverageStart, coverageEnd, holidays, sources y approved: true. Cada versión es inmutable; no cambia plazos ya calculados.</p><label>Calendario revisado<textarea name="calendar" rows="9" required></textarea></label>${input("reason", "Motivo y referencia de revisión")}<button class="primary">Aprobar nueva versión</button></form>` : ""}<p id="cloud-message" role="status"></p></section>`;
  }
  if (page === "migration" && cloud.spark) return `<section class="panel"><h2>Migración local</h2><p>La migración al espacio Spark aún no está habilitada. Conserve su respaldo local; no se importarán registros parcialmente.</p></section>`;
  if (page === "migration")
    return `<section class="panel"><h2>Migrar registros locales de Fase 1</h2><p>Solo el espacio “Mis registros locales” de este navegador. La demostración queda excluida. Se conservan IDs, relaciones y bitácora original como antecedente no autenticado. No se borra el origen ni se sobrescribe un destino con datos.</p><button id="inspect-local" class="secondary">Leer registros locales</button><label>O cargar respaldo exportado del espacio local<input id="migration-file" type="file" accept="application/json,.json"></label><div id="migration-fields"></div><p id="cloud-message" role="status"></p></section>`;
  return "";
}
export function bindCloudPanel(page, ctx) {
  const { cloud, db, esc, load, localRepository } = ctx;
  const $ = (s) => document.querySelector(s);
  const report = (error) => {
    if ($("#cloud-message"))
      $("#cloud-message").textContent = error.message ?? String(error);
  };
  const handler = (selector, fn) => {
    if ($(selector))
      $(selector).onsubmit = async (e) => {
        e.preventDefault();
        e.submitter.disabled = true;
        try {
          await fn(new FormData(e.target));
          await load();
        } catch (err) {
          report(err);
          e.submitter.disabled = false;
        }
      };
  };
  const gFor = (r) => db.cacs.find((c) => c.id === r.cacId).gerenciaId;
  if ($("#assignment-form")) {
    const form = $("#assignment-form"),
      select = form.querySelector("select");
    const refresh = () => {
      const u = db.users.find((u) => u.id === select.value);
      form
        .querySelectorAll("[name=gerencias]")
        .forEach(
          (el) => (el.checked = (u?.gerencias ?? []).includes(el.value)),
        );
    };
    select.onchange = refresh;
    refresh();
  }
  handler("#assignment-form", async (data) => {
    const u = db.users.find((u) => u.id === data.get("uid"));
    await cloud.call("assignAssistant", {
      uid: u.id,
      gerencias: data.getAll("gerencias"),
      reason: data.get("reason"),
      expectedRevision: u.revision,
    });
  });
  handler("#profile-form", async (data) => {
    const payload = Object.fromEntries(data);
    payload.active = payload.active === "true";
    payload.expectedRevision = Number(payload.expectedRevision);
    await cloud.call("provisionUser", payload);
  });
  handler("#exception-form", async (data) => {
    const r = db.remisiones.find((r) => r.id === data.get("remisionId"));
    await cloud.call("authorizeException", {
      ...Object.fromEntries(data),
      gerenciaId: gFor(r),
      expectedRevision: r.revision,
    });
  });
  handler("#calendar-form", async (data) => {
    await cloud.call("publishCalendar", {
      calendar: JSON.parse(data.get("calendar")),
      reason: data.get("reason"),
    });
  });
  const inspect = async (snapshot) => {
    try {
      if (!snapshot.gerencias.length)
        throw Error("No hay registros locales del usuario en este origen.");
      $("#migration-fields").innerHTML =
        `<form id="migration-form" class="form-fields"><label>Gerencia local<select name="gerenciaId">${snapshot.gerencias.map((g) => `<option value="${esc(g.id)}">${esc(g.name)} · ${esc(g.id)}</option>`).join("")}</select></label><p>Si la gerencia no existe en Firebase, créela aquí con el mismo ID antes de previsualizar.</p><button id="create-destination" type="button" class="secondary">Crear gerencia de destino</button><label>Recepciones reales: JSON de ID de remisión a fecha YYYY-MM-DD<textarea name="receiptDates" rows="8" required>${esc(JSON.stringify(Object.fromEntries(snapshot.remisiones.map((r) => [r.id, r.receivedOn ?? "COMPLETAR"])), null, 2))}</textarea></label>${input("reason", "Motivo de migración")}<button class="primary">Previsualizar importación</button></form><div id="migration-preview"></div>`;
      $("#create-destination").onclick = async () => {
        const g = snapshot.gerencias.find(
          (g) => g.id === $("#migration-form").elements.gerenciaId.value,
        );
        try {
          await cloud.call("createGerencia", {
            id: g.id,
            name: g.name,
            reason: "Preparación de migración local",
          });
          report("Gerencia creada; puede previsualizar.");
        } catch (error) {
          report(error);
        }
      };
      $("#migration-form").onsubmit = async (e) => {
        e.preventDefault();
        e.submitter.disabled = true;
        try {
          const data = new FormData(e.target);
          const payload = {
            gerenciaId: data.get("gerenciaId"),
            snapshot,
            receiptDates: JSON.parse(data.get("receiptDates")),
            reason: data.get("reason"),
          };
          const preview = await cloud.call("importLocal", payload);
          $("#migration-preview").innerHTML =
            `<h2>Revisión previa</h2><pre>${esc(JSON.stringify(preview, null, 2))}</pre><button id="confirm-import" class="primary">Confirmar importación de ${preview.count} registros</button>`;
          $("#confirm-import").onclick = async (e) => {
            e.target.disabled = true;
            try {
              await cloud.call("importLocal", {
                ...payload,
                confirmHash: preview.hash,
              });
              await load();
            } catch (error) {
              report(error);
              e.target.disabled = false;
            }
          };
        } catch (error) {
          report(error);
        } finally {
          e.submitter.disabled = false;
        }
      };
    } catch (error) {
      report(error);
    }
  };
  if ($("#inspect-local"))
    $("#inspect-local").onclick = async () => {
      try {
        await inspect(await new localRepository("local").load());
      } catch (error) {
        report(error);
      }
    };
  if ($("#migration-file"))
    $("#migration-file").onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 650000)
          throw Error(
            "El respaldo supera 650 KB; requiere migración supervisada.",
          );
        const parsed = JSON.parse(await file.text());
        if (parsed.source !== "local-user" || !parsed.snapshot)
          throw Error("Use un respaldo exportado desde Mis registros locales.");
        await inspect(parsed.snapshot);
      } catch (error) {
        report(error);
      }
    };
}
