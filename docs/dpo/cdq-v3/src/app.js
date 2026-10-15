import {phase3Panel,bindPhase3} from './phase3-ui.js';
import { metrics, scope, mutate, states, integer } from "./domain.js";
import { LocalRepository } from "./repository.js";
import { demo } from "./seed.js";
import { cloudPanel, bindCloudPanel } from "./cloud-ui.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const pages = [
  ["dashboard", "◫", "Dashboard"],
  ["gerencias", "▦", "Gerencias"],
  ["cacs", "⌂", "CAC y dependencias"],
  ["remisiones", "⇄", "Remisiones"],
  ["lotes", "▤", "Lotes documentales"],
  ["documentos", "☑", "Documentos"],
  ["observaciones", "◎", "Observaciones"],
  ["history", "◷", "Períodos históricos"],
  ["reports", "▥", "Reportes y comparativos"],
  ["bulk", "⇧", "Importación CSV"],
  ["audit", "≡", "Auditoría"],
  ["deadlines", "◷", "Plazos y excepciones"],
  ["access", "⌘", "Usuarios y permisos"],
  ["migration", "⇧", "Migración local"],
];
let mode = sessionStorage.getItem("cdq:workspace")==="cloud" ? "cloud" : "demo",
  repo,
  db,
  page = "dashboard",
  query = "",
  f = { year: 2026, month: 10, half: "1", gerencia: "", cac: "" };
const find = (c, id) => db[c].find((x) => x.id === id),
  name = (c, id) => find(c, id)?.name || "—";
const period = (r) => `${months[r.month - 1]} ${r.year} · ${r.half}ª quincena`;
const badge = (text, tone = "") =>
  `<span class="badge ${tone}">${esc(text)}</span>`;
const options = (rows, value, label, selected) =>
  rows
    .map(
      (r) =>
        `<option value="${esc(value(r))}" ${String(value(r)) === String(selected) ? "selected" : ""}>${esc(label(r))}</option>`,
    )
    .join("");
const select = (key, label, rows, selected, all) =>
  `<label>${label}<select data-filter="${key}">${all ? `<option value="">${all}</option>` : ""}${options(
    rows,
    (r) => r.id,
    (r) => r.name,
    selected,
  )}</select></label>`;
let cloud=null, stopProfile=null, stopAuth=null, epoch=0;
const cloudMode=()=>mode==='cloud';
const cloudContext=()=>({cloud,db,f,esc,table,badge,find,load,localRepository:LocalRepository});
const phase3Context=()=>({db,f,mode,cloud,esc,table,render,load,repo});
const canManage=(c)=>!cloudMode()||(c==='gerencias'?cloud?.profile?.role==='director':cloud?.profile?.role==='asistente');
function gerenciaFor(c,row){if(c==='gerencias')return row.id;if(c==='cacs')return row.gerenciaId;if(c==='remisiones')return find('cacs',row.cacId).gerenciaId;if(c==='lotes')return gerenciaFor('remisiones',find('remisiones',row.remisionId));if(c==='documentos')return gerenciaFor('lotes',find('lotes',row.loteId));return gerenciaFor('documentos',find('documentos',row.documentId));}
function loginView(error=''){
  if(cloud?.authOnly){authenticationView(error);return;}
  $('#app').innerHTML=`<main class="content login-page"><section class="panel"><h1>Control Documental</h1><p>Acceso institucional · Firebase Authentication</p><form id="login-form" class="form-fields"><label>Correo<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Ingresar</button></form><p id="login-error" role="alert">${esc(error)}</p><div class="form-actions"><button id="google-login" class="secondary">Ingresar con Google</button><button id="return-local">Volver a demostración</button>${cloud?.auth.currentUser?'<button id="logout">Cerrar sesión</button>':''}</div><p>La cuenta necesita correo verificado y un perfil operativo asignado. No hay registro público con permisos automáticos.</p></section></main>`;
  $('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const values=new FormData(e.target);try{await cloud.login(values.get('email'),values.get('password'))}catch(error){$('#login-error').textContent=error.message;b.disabled=false}};
  $('#google-login').onclick=async()=>{try{await cloud.google()}catch(error){$('#login-error').textContent=error.message}};
  $('#return-local').onclick=()=>{mode='demo';sessionStorage.setItem('cdq:workspace','demo');page='dashboard';load().catch(fatal)};
  if($('#logout'))$('#logout').onclick=()=>cloud.logout();
  if(!cloud){$('#google-login').disabled=true;$('#login-form button').disabled=true;}
}
function authenticationView(error=''){
  const user=cloud.auth.currentUser;
  $('#app').innerHTML=`<main class="content login-page"><section class="panel"><h1>Control Documental</h1><p>Acceso con Google · controldoc-385bd</p>${user?`<h2>Sesión iniciada</h2><p>${esc(user.email)}</p><p>${user.emailVerified?'Correo verificado.':'Correo pendiente de verificación.'}</p><p>La autenticación está conectada. La aprobación de accesos, los permisos administrativos y el guardado documental en Spark todavía no están habilitados.</p><button id="auth-logout" class="secondary">Cerrar sesión</button>`:'<p>Identifícate con tu cuenta de Google. Iniciar sesión no concede permisos de acceso a documentos.</p><button id="auth-google" class="primary">Ingresar con Google</button>'}<p id="auth-error" role="alert">${esc(error)}</p><button id="auth-demo" class="secondary">Volver a demostración</button></section></main>`;
  if($('#auth-google'))$('#auth-google').onclick=async e=>{e.target.disabled=true;try{await cloud.google()}catch(err){const messages={'auth/operation-not-allowed':'El proveedor Google aún debe habilitarse en Firebase Authentication.','auth/unauthorized-domain':'Debe autorizarse jodahir.github.io en Firebase Authentication.','auth/configuration-not-found':'Firebase Authentication aún no está configurado en este proyecto.','auth/popup-blocked':'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo otra vez.','auth/popup-closed-by-user':'Se cerró el inicio de sesión antes de completarlo.'};authenticationView(messages[err.code]||err.message)}};
  if($('#auth-logout'))$('#auth-logout').onclick=async()=>{try{await cloud.logout()}catch(err){authenticationView(err.message)}};
  $('#auth-demo').onclick=()=>{mode='demo';sessionStorage.setItem('cdq:workspace','demo');page='dashboard';load().catch(fatal)};
}
async function load() {
  const token=++epoch;
  if(cloudMode()){
    $('#modal').close();$('#app').innerHTML='<main class="content"><p>Conectando con Firebase…</p></main>';db=null;
    try{
      if(!cloud){const module=await import('./firebase-client.bundle.js');cloud=await module.connectFirebase();let initial=true;stopAuth=cloud.watchAuth(()=>{if(initial){initial=false;return}if(cloudMode()){epoch++;db=null;$('#modal').close();load()}});}
      if(cloud.authOnly){authenticationView();return}
      if(!cloud.auth.currentUser){loginView();return}
      const result=await cloud.load();if(token!==epoch||!cloudMode())return;db=result;
      if(stopProfile)stopProfile();const signature=JSON.stringify(cloud.profile);stopProfile=cloud.watchProfile(cloud.auth.currentUser.uid,p=>{if(cloudMode()&&JSON.stringify(p)!==signature){epoch++;db=null;$('#modal').close();load()}});
      if(cloud.profile.role==='technical'&&page!=='audit')page='access';
      render();return;
    }catch(error){if(token===epoch){loginView(error.message)}return}
  }
  if(stopProfile){stopProfile();stopProfile=null;}
  repo = new LocalRepository(mode);
  db = await repo.load();
  if (mode === "demo" && !localStorage.getItem(repo.key)) {
    db = demo();
    await repo.save(db);
  }
  render();
}
function filters() {
  return `<section class="filters">${select(
    "year",
    "Año",
    Array.from(
      new Set([
        2026,
        new Date().getFullYear(),
        +f.year,
        ...db.remisiones.map((r) => r.year),
      ]),
    )
      .sort((a, b) => b - a)
      .map((n) => ({ id: n, name: n })),
    f.year,
  )}${select(
    "month",
    "Mes",
    months.map((n, i) => ({ id: i + 1, name: n })),
    f.month,
  )}${select(
    "half",
    "Quincena",
    [
      { id: 1, name: "Primera quincena" },
      { id: 2, name: "Segunda quincena" },
    ],
    f.half,
    "Ambas quincenas",
  )}${select("gerencia", "Gerencia", db.gerencias, f.gerencia, "Todas las gerencias")}${select(
    "cac",
    "CAC / dependencia",
    db.cacs.filter((c) => !f.gerencia || c.gerenciaId === f.gerencia),
    f.cac,
    "Todos los CAC",
  )}</section>`;
}
function table(headers, rows) {
  return `<div class="table-scroll"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty">No hay registros para esta selección.</td></tr>`}</tbody></table></div>`;
}
const edit = (c, id) =>
  (cloudMode() && cloud?.profile?.role!=="asistente") ? "—" : `<button class="link" data-edit="${c}" data-id="${esc(id)}">Editar ↗</button>`;
function lotRows(lots) {
  const counts=new Map();for(const d of db.documentos)counts.set(d.loteId,(counts.get(d.loteId)||0)+1);
  return lots.map((l) => {
    const r = find("remisiones", l.remisionId),
      n = counts.get(l.id)||0,
      diff = n - l.declared;
    return [
      `<strong>${esc(l.code)}</strong>`,
      esc(name("cacs", r.cacId)),
      esc(period(r)),
      l.declared,
      n,
      badge(
        diff === 0 ? "Conciliado" : `${diff > 0 ? "+" : ""}${diff} documentos`,
        diff === 0 ? "ok" : "warn",
      ),
      edit("lotes", l.id),
    ];
  });
}
function dashboard() {
  const m = metrics(db, f);
  const cards = [
    ["Gerencias involucradas", m.gerencias, "Ámbito seleccionado"],
    ["CAC involucrados", m.cacs.length, "Dependencias del ámbito"],
    ["Remisiones registradas", m.registered, `${m.pendingRem} pendientes`],
    ["Documentos declarados", m.declared, "Según los lotes recibidos"],
    ["Individualizados", m.individual, "Con registro individual"],
    ["Documentos verificados", m.reviewed, "Incluye los observados"],
    ["Pendientes de verificación", m.pending, "Individualizados sin revisar"],
    ["Documentos observados", m.observed, "Incluye regularizados"],
    ["Documentos faltantes", m.missing, "Declarados sin individualizar"],
    ["Lotes con diferencias", m.differences, "Requieren conciliación"],
  ];
  return `<div class="section-line"><div><h2>Resumen del período</h2><p>Una visión integral de la recepción y revisión documental.</p></div>${badge(cloudMode()?"Datos consultados en Firestore":"Actualizado con datos locales", "neutral")}</div><div class="stats">${cards.map(([label, n, sub], i) => `<article class="stat ${i === 3 ? "featured" : ""}"><span>${label}</span><strong>${n}</strong><small>${sub}</small></article>`).join("")}</div><div class="progress-card"><div><span class="eyebrow">AVANCE DOCUMENTAL</span><h2>${m.progress === null ? "Sin documentos para verificar" : `${m.progress.toFixed(1)} % revisado`}</h2><p>${m.reviewed} de ${m.individual} documentos individualizados · Los faltantes se informan por separado.</p></div><div class="progress-track"><div style="width:${m.progress ?? 0}%"></div></div></div><section class="panel"><div class="section-line"><div><h2>Control de lotes</h2><p>Cantidad declarada frente a documentos individualizados</p></div><button data-nav="lotes" class="secondary">Ver lotes →</button></div>${table(["Lote", "CAC / dependencia", "Período", "Declarados", "Individualizados", "Conciliación", ""], lotRows(m.lots))}</section>`;
}
function collectionView() {
  const s = scope(db, f);
  let rows = [],
    headers = [],
    collection = page;
  if (page === "gerencias") {
    headers = ["Gerencia", "CAC asociados", ""];
    rows = db.gerencias
      .filter((g) => !f.gerencia || g.id === f.gerencia)
      .map((g) => [
        esc(g.name),
        db.cacs.filter((c) => c.gerenciaId === g.id).length,
        edit(page, g.id),
      ]);
  }
  if (page === "cacs") {
    headers = ["CAC / dependencia", "Gerencia", ""];
    rows = s.cacs.map((c) => [
      esc(c.name),
      esc(name("gerencias", c.gerenciaId)),
      edit(page, c.id),
    ]);
  }
  if (page === "remisiones") {
    headers = ["CAC / dependencia", "Período", "Lotes", "Registro", ""];
    rows = s.rem.map((r) => [
      esc(name("cacs", r.cacId)),
      esc(period(r)),
      db.lotes.filter((l) => l.remisionId === r.id).length,
      badge("Registrada", "ok"),
      edit(page, r.id),
    ]);
    for (const c of s.cacs)
      for (const half of f.half ? [+f.half] : [1, 2])
        if (!s.rem.some((r) => r.cacId === c.id && r.half === half))
          rows.push([
            esc(c.name),
            esc(period({ year: +f.year, month: +f.month, half })),
            0,
            badge("Pendiente", "warn"),
            "—",
          ]);
  }
  if (page === "lotes") {
    headers = [
      "Lote",
      "CAC / dependencia",
      "Período",
      "Declarados",
      "Individualizados",
      "Conciliación",
      "",
    ];
    rows = lotRows(s.lots);
  }
  if (page === "documentos") {
    headers = [
      "Documento",
      "Tipo",
      "Lote",
      "Verificación",
      "Observaciones",
      "",
    ];
    rows = s.docs.map((d) => [
      esc(d.number),
      esc(d.type),
      esc(find("lotes", d.loteId).code),
      badge(
        d.state,
        d.state === "Verificado"
          ? "ok"
          : d.state === "Pendiente"
            ? "neutral"
            : "warn",
      ),
      db.observaciones.filter((o) => o.documentId === d.id).length,
      edit(page, d.id),
    ]);
  }
  if (page === "observaciones") {
    headers = [
      "Documento",
      "Descripción",
      "Fecha",
      "Responsable",
      "Regularización",
      "",
    ];
    const ids = new Set(s.docs.map((d) => d.id));
    rows = db.observaciones
      .filter((o) => ids.has(o.documentId))
      .map((o) => [
        esc(find("documentos", o.documentId).number),
        esc(o.description),
        esc(o.date),
        esc(o.owner),
        badge(o.status, o.status === "Regularizada" ? "ok" : "warn"),
        edit(page, o.id),
      ]);
  }
  const filtered = rows.filter((r) =>
    r.join(" ").toLowerCase().includes(esc(query.toLowerCase())),
  );
  return `<section class="panel"><div class="section-line"><div><h2>${pages.find((p) => p[0] === page)[2]}</h2><p>${page === "gerencias" || page === "cacs" ? "Catálogo institucional · independiente del período" : "Registros del período y ámbito seleccionados"}</p></div>${canManage(collection)?`<button class="primary" data-new="${collection}">+ Nuevo registro</button>`:""}</div><input class="search" id="search" placeholder="Buscar en esta tabla…" value="${esc(query)}" aria-label="Buscar en la tabla">${table(headers, filtered)}<p class="footnote">${filtered.length} resultados · ${cloudMode()?"Persistencia en Firestore · permisos validados en servidor":"Cambios guardados únicamente en este navegador."}</p></section>`;
}
function history() {
  const keys = [
    ...new Set(db.remisiones.map((r) => `${r.year}-${r.month}-${r.half}`)),
  ].sort((a, b) => {
    const x = a.split("-").map(Number),
      y = b.split("-").map(Number);
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  });
  return `<section class="panel"><h2>Períodos registrados</h2><p>Consulta todos los períodos guardados, respetando los filtros de gerencia y CAC.</p>${table(
    ["Período", "Remisiones", "Declarados", "Individualizados", "Avance", ""],
    keys.map((k) => {
      const [year, month, half] = k.split("-").map(Number),
        m = metrics(db, { ...f, year, month, half });
      return [
        esc(period({ year, month, half })),
        m.registered,
        m.declared,
        m.individual,
        m.progress === null
          ? "Sin documentos para verificar"
          : m.progress.toFixed(1) + " %",
        `<button class="link" data-period="${k}">Consultar →</button>`,
      ];
    }),
  )}</section>`;
}
function audit() {
  return `<section class="panel"><h2>${cloudMode()?"Auditoría del servidor":"Trazabilidad local"}</h2><p>${cloudMode()?"Identidad autenticada y cambios registrados por transacciones del servidor.":"Registro informativo de cambios. No es una auditoría segura ni acredita identidad."}</p>${table(
    ["Fecha y hora", "Responsable", "Entidad", "Cambio"],
    [...db.audit]
      .reverse()
      .map((a) => [
        esc(new Date(a.at).toLocaleString("es-AR")),
        esc(a.actor),
        esc(a.collection),
        `<details><summary>${a.before ? "Modificación" : "Alta"} · ${esc(a.recordId)}</summary><pre>${esc(JSON.stringify({ antes: a.before, despues: a.after, cambioVinculado: a.relatedChange ?? null, motivo: a.reason ?? null, autorizacion: a.authorization ?? null }, null, 2))}</pre></details>`,
      ]),
  )}</section>`;
}
function render() {
  const current = pages.find((p) => p[0] === page);
  $("#app").innerHTML =
    `<aside><div class="brand"><span class="brand-icon">D<span>O</span></span><div>Dirección de<br><strong>Operaciones</strong></div></div><div class="nav-label">CONTROL DOCUMENTAL</div><nav>${pages.filter(([id])=>cloudMode() ? (cloud?.profile?.role==="technical"?["access","audit"].includes(id):((id!=="bulk"||cloud?.profile?.role==="asistente")&&(!["access","migration"].includes(id)||cloud?.profile?.role==="director"))) : !["access","migration","deadlines"].includes(id)).map(([id, icon, label]) => `<button class="${page === id ? "active" : ""}" data-nav="${id}"><span>${icon}</span>${label}</button>`).join("")}</nav><div class="sidebar-bottom"><span class="status-dot"></span> Fase 3 · ${cloudMode()?"Firebase":"Local"}<br><small>Gestión documental quincenal</small></div></aside><main><header><div class="breadcrumb">Dirección de Operaciones <span>/</span> Control documental</div><div class="local-chip">${cloudMode()?"◉ Firebase" : "◉ Almacenamiento local"}</div></header><div class="content"><div class="title-row"><div><span class="eyebrow">SISTEMA DE CONTROL DOCUMENTAL</span><h1>${current[2]}</h1><p>Seguimiento quincenal · Dirección de Operaciones</p></div><label class="mode-label">Espacio de trabajo<select id="mode"><option value="demo" ${mode === "demo" ? "selected" : ""}>Demostración</option><option value="local" ${mode === "local" ? "selected" : ""}>Mis registros locales</option><option value="cloud" ${cloudMode()?"selected":""}>Firebase institucional</option></select></label></div>${cloudMode()?`<div class="session-bar"><span>${esc(cloud.auth.currentUser.email)} · ${esc(cloud.profile.role)} · ${cloud.emulator?"Emuladores locales":"Conectado"}</span><button id="refresh-cloud" class="secondary">Actualizar</button><button id="logout" class="secondary">Cerrar sesión</button></div>`:""}${mode==="local"?`<div class="session-bar"><button id="export-local" class="secondary">Descargar respaldo para migración</button></div>`:""}<div class="notice">${cloudMode()?"<strong>Espacio Firebase.</strong> Se muestran únicamente las gerencias autorizadas.":mode === "demo" ? "<strong>Datos ficticios.</strong> Estás trabajando en un espacio de demostración separado." : "<strong>Mis registros locales.</strong> Datos ingresados por el usuario, separados de la demostración."} ${cloudMode()?"":"Sin sincronización multiusuario ni seguridad de producción."}</div>${!["audit","access","migration"].includes(page) ? filters() : ""}${page === "dashboard" ? dashboard() : page === "history" ? history() : ["audit","reports","bulk"].includes(page) ? phase3Panel(page,phase3Context()) : ["access","deadlines","migration"].includes(page)?cloudPanel(page,cloudContext()):collectionView()}<footer>Dirección de Operaciones <span>Control Documental Quincenal · v3.0</span></footer></div></main>`;
  bind();
}
function bind() {
  if(["audit","reports","bulk"].includes(page))bindPhase3(page,phase3Context());
  if($('#export-local'))$('#export-local').onclick=()=>{const blob=new Blob([JSON.stringify({source:'local-user',snapshot:db},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='control-documental-local.json';a.click();URL.revokeObjectURL(url)};
  if(cloudMode()){
    $('#logout').onclick=()=>cloud.logout();
    $('#refresh-cloud').onclick=()=>load();
    bindCloudPanel(page,cloudContext());
  }
  document.querySelectorAll("[data-nav]").forEach(
    (b) =>
      (b.onclick = () => {
        page = b.dataset.nav;
        query = "";
        render();
      }),
  );
  document.querySelectorAll("[data-filter]").forEach(
    (el) =>
      (el.onchange = () => {
        f[el.dataset.filter] = el.value;
        if (el.dataset.filter === "gerencia") f.cac = "";
        render();
      }),
  );
  $("#mode").onchange = async (e) => {
    mode = e.target.value;
    sessionStorage.setItem("cdq:workspace",mode);
    page="dashboard"; f.gerencia=""; f.cac="";
    query = "";
    try {
      await load();
    } catch (e) {
      fatal(e);
    }
  };
  document
    .querySelectorAll("[data-new]")
    .forEach((b) => (b.onclick = () => form(b.dataset.new)));
  document
    .querySelectorAll("[data-edit]")
    .forEach((b) => (b.onclick = () => form(b.dataset.edit, b.dataset.id)));
  document.querySelectorAll("[data-period]").forEach(
    (b) =>
      (b.onclick = () => {
        const [year, month, half] = b.dataset.period.split("-");
        f = { ...f, year, month, half };
        page = "dashboard";
        render();
      }),
  );
  if ($("#search"))
    $("#search").oninput = (e) => {
      const start = e.target.selectionStart;
      query = e.target.value;
      render();
      $("#search").focus();
      $("#search").setSelectionRange(start, start);
    };
}
function form(c, id) {
  if(cloudMode()&&!(cloud?.profile?.role==="asistente"||(c==="gerencias"&&!id&&cloud?.profile?.role==="director")))return;
  const row = id ? find(c, id) : {},
    field = (key, label, type = "text", value = row[key] ?? "") =>
      `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" required ${type === "number" ? 'min="0" step="1"' : ""} maxlength="${key === "description" ? 2000 : 150}"></label>`,
    pick = (key, label, rows, labeler, selected = row[key] ?? "") =>
      `<label>${label}<select name="${key}" required><option value="">Seleccionar…</option>${options(rows, (r) => r.id, labeler, selected)}</select></label>`;
  let fields = "";
  if (c === "gerencias" || c === "cacs") fields += field("name", "Nombre");
  if (c === "cacs")
    fields += pick("gerenciaId", "Gerencia", db.gerencias, (r) => r.name);
  if (c === "remisiones")
    fields +=
      pick(
        "cacId",
        "CAC / dependencia",
        db.cacs,
        (r) => r.name,
        row.cacId || f.cac,
      ) +
      field("year", "Año", "number", row.year ?? f.year) +
      pick(
        "month",
        "Mes",
        months.map((name, i) => ({ id: i + 1, name })),
        (r) => r.name,
        row.month ?? f.month,
      ) +
      pick(
        "half",
        "Quincena",
        [
          { id: 1, name: "Primera" },
          { id: 2, name: "Segunda" },
        ],
        (r) => r.name,
        row.half ?? f.half,
      );
  if(c==="remisiones"&&cloudMode())fields+=field("receivedOn","Fecha de recepción (Paraguay)","date");
  if (c === "lotes")
    fields +=
      pick(
        "remisionId",
        "Remisión · CAC y período",
        db.remisiones,
        (r) => `${name("cacs", r.cacId)} · ${period(r)}`,
      ) +
      field("code", "Identificador del lote") +
      field("declared", "Cantidad declarada", "number");
  if (c === "documentos")
    fields +=
      pick("loteId", "Lote · CAC y período", db.lotes, (l) => {
        const r = find("remisiones", l.remisionId);
        return `${l.code} · ${name("cacs", r.cacId)} · ${period(r)}`;
      }) +
      field("type", "Tipo de documento") +
      field("number", "Número de documento") +
      pick(
        "state",
        "Estado de verificación",
        states.map((s) => ({ id: s, name: s })),
        (r) => r.name,
        row.state ?? "Pendiente",
      ) +
      '<p class="footnote">Para verificar con observación, registre primero el documento y luego agregue una observación. El estado se actualizará automáticamente.</p>';
  if (c === "observaciones")
    fields +=
      pick(
        "documentId",
        "Documento",
        db.documentos,
        (d) => `${d.type} ${d.number} · ${find("lotes", d.loteId).code}`,
      ) +
      field("description", "Descripción") +
      field(
        "date",
        "Fecha",
        "date",
        row.date ??
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
      ) +
      field("owner", "Responsable de la observación") +
      pick(
        "status",
        "Regularización",
        [{ id: "Pendiente" }, { id: "Regularizada" }],
        (r) => r.id,
        row.status ?? "Pendiente",
      );
  $("#modal").innerHTML =
    `<form id="record-form"><div class="section-line"><h2>${id ? "Editar" : "Nuevo"} registro</h2><button type="button" id="close" aria-label="Cerrar">✕</button></div><p>${pages.find((p) => p[0] === c)[2]} · ${cloudMode()?"Firebase institucional":mode === "demo" ? "Demostración" : "Mis registros locales"}</p><div class="form-fields">${fields}${cloudMode()?"<p>Responsable: identidad de la sesión autenticada.</p>":field("actor", "Responsable de este registro")}</div><p id="form-error" role="alert"></p><div class="form-actions"><button type="button" id="cancel" class="secondary">Cancelar</button><button class="primary" type="submit">Guardar registro</button></div></form>`;
  $("#close").onclick = $("#cancel").onclick = () => $("#modal").close();
  $("#record-form").onsubmit = async (e) => {
    e.preventDefault();
    const submit = e.submitter;
    submit.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(e.target));
      const actor = cloudMode()?cloud.auth.currentUser.uid:data.actor.trim();
      delete data.actor;
      for (const k in data) data[k] = data[k].trim();
      if (c === "remisiones")
        for (const k of ["year", "month", "half"]) data[k] = Number(data[k]);
      if (c === "lotes")
        data.declared = integer(data.declared, "Cantidad declarada");
      if(cloudMode()){
        const cloudRow={...data,id:id||crypto.randomUUID()};
        if(c==='gerencias'&&!id)await cloud.call('createGerencia',{...cloudRow,reason:'Alta de catálogo por Director'});
        else await cloud.call('saveRecord',{gerenciaId:gerenciaFor(c,cloudRow),collection:c,row:cloudRow,expectedRevision:row.revision??0});
        $('#modal').close();await load();return;
      }
      const next = mutate(
        db,
        c,
        { ...row, ...data, id: id || crypto.randomUUID() },
        actor,
      );
      await repo.save(next);
      db = next;
      $("#modal").close();
      render();
    } catch (err) {
      $("#form-error").textContent = err.message;
      submit.disabled = false;
    }
  };
  $("#modal").showModal();
}
function fatal(e) {
  $("#app").innerHTML =
    `<main class="content"><h1>No se pudo abrir el espacio local</h1><p>${esc(e.message)}</p><p>No se modificaron los datos almacenados. Recargue para volver a intentar.</p></main>`;
}
window.addEventListener("storage", (e) => {
  if (!cloudMode() && repo && e.key === repo.key) {
    $("#modal").close();
    load().catch(fatal);
  }
});
load().catch(fatal);
