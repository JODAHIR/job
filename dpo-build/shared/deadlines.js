import { requireThat, text } from "./policy.js";
export function dateOnly(value) {
  requireThat(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Fecha inválida.",
  );
  return value;
}
export function nextDate(value) {
  const d = new Date(dateOnly(value) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function paraguayToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (t) => parts.find((p) => p.type === t).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validateCalendar(c) {
  requireThat(
    c && c.approved === true,
    "Se necesita un calendario aprobado.",
    "failed-precondition",
  );
  text(c.version, "Versión", 80);
  dateOnly(c.coverageStart);
  dateOnly(c.coverageEnd);
  requireThat(c.coverageStart <= c.coverageEnd, "Cobertura inválida.");
  requireThat(
    Array.isArray(c.holidays) && c.holidays.length <= 400,
    "Lista de feriados inválida.",
  );
  requireThat(
    Array.isArray(c.sources) && c.sources.length > 0 && c.sources.length <= 30,
    "Se requieren fuentes oficiales.",
  );
  for (const source of c.sources)
    requireThat(
      typeof source === "string" &&
        source.length <= 1000 &&
        /^https:\/\/([a-z0-9-]+\.)*(gov\.py|congreso\.gov\.py)\//i.test(source),
      "Use enlaces oficiales de Paraguay.",
    );
  for (const d of c.holidays) {
    dateOnly(d);
    requireThat(
      d >= c.coverageStart && d <= c.coverageEnd,
      "Feriado fuera de cobertura.",
    );
  }
  requireThat(
    new Set(c.holidays).size === c.holidays.length,
    "Feriados duplicados.",
  );
  return c;
}
export function deadline(receivedOn, calendar) {
  dateOnly(receivedOn);
  validateCalendar(calendar);
  let day = receivedOn,
    count = 0;
  const holidays = new Set(calendar.holidays);
  requireThat(
    day >= calendar.coverageStart,
    "Calendario sin cobertura para esta recepción.",
    "failed-precondition",
  );
  while (count < 10) {
    day = nextDate(day);
    requireThat(
      day <= calendar.coverageEnd,
      "Falta cobertura de feriados para completar el plazo.",
      "failed-precondition",
    );
    const weekday = new Date(day + "T00:00:00Z").getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(day)) count++;
  }
  return {
    receivedOn,
    originalDueOn: day,
    dueOn: day,
    calendarVersion: calendar.version,
    businessDays: 10,
    timeZone: "America/Asuncion",
  };
}
