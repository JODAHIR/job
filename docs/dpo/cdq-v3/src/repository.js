import { empty, validate } from "./domain.js";
// Contrato reemplazable por un repositorio Firebase en fase 2.
export class LocalRepository {
  constructor(mode) {
    this.key = `cdq:v1:${mode}`;
  }
  async load() {
    const raw = localStorage.getItem(this.key);
    if (!raw) return empty();
    try {
      return validate(JSON.parse(raw));
    } catch {
      throw Error(
        "Los datos locales no pudieron validarse. No se sobrescribieron. Revise el almacenamiento del navegador.",
      );
    }
  }
  async save(data) {
    validate(data);
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      throw Error("No se pudo guardar: almacenamiento lleno o no disponible.");
    }
  }
}
