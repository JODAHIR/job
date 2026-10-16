export class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
export function requireThat(ok, message, code = "invalid-argument") {
  if (!ok) throw new DomainError(code, message);
}
export function id(value) {
  requireThat(
    typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value),
    "Identificador inválido.",
  );
  return value;
}
export function text(value, label, max = 2000) {
  requireThat(
    typeof value === "string" && value.trim().length > 0 && value.length <= max,
    `${label} es obligatorio (máximo ${max} caracteres).`,
  );
  return value.trim();
}
export function principal(auth, profile) {
  requireThat(auth?.uid, "Inicie sesión.", "unauthenticated");
  requireThat(
    auth.token?.email_verified === true,
    "Verifique su correo electrónico.",
    "permission-denied",
  );
  requireThat(
    profile?.active === true &&
      ["director", "gerente", "asistente", "technical"].includes(profile.role),
    "Cuenta sin autorización activa.",
    "permission-denied",
  );
  return { ...profile, uid: auth.uid };
}
export const canRead = (p, g) =>
  p.active === true &&
  (p.role === "director" ||
    (p.role === "gerente" && p.gerenciaId === g) ||
    (p.role === "asistente" && p.gerencias?.includes(g)));
export function allow(p, action, g) {
  let ok = false;
  if (action === "read") ok = canRead(p, g);
  if (action === "write") ok = p.role === "asistente" && canRead(p, g);
  if (
    ["assign", "exception", "calendar", "catalog", "migrate"].includes(action)
  )
    ok = p.role === "director";
  if (action === "provision") ok = p.role === "technical";
  requireThat(ok, "No tiene permiso para esta operación.", "permission-denied");
}
export function revision(before, expected) {
  requireThat(
    Number.isSafeInteger(expected) && expected >= 0,
    "Revisión requerida.",
  );
  requireThat(
    (before?.revision ?? 0) === expected,
    "El registro cambió. Actualice antes de guardar.",
    "aborted",
  );
}
export function fields(input, allowed) {
  requireThat(
    input && typeof input === "object" && !Array.isArray(input),
    "Registro inválido.",
  );
  requireThat(
    Object.keys(input).every((k) => allowed.includes(k)),
    "El registro contiene campos no permitidos.",
  );
}
