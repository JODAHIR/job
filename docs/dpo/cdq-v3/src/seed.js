import { empty } from "./domain.js?v=cah-lotes-20261019";
export function demo() {
  const d = empty();
  d.gerencias = [
    { id: "g1", name: "Operaciones Metropolitanas" },
    { id: "g2", name: "Operaciones Regionales" },
    { id: "g3", name: "Servicios Especializados" },
  ];
  d.cacs = [
    { id: "c1", name: "CAC Centro", gerenciaId: "g1" },
    { id: "c2", name: "CAC Norte", gerenciaId: "g1" },
    { id: "c3", name: "CAC Córdoba", gerenciaId: "g2" },
    { id: "c4", name: "CAC Rosario", gerenciaId: "g2" },
    { id: "c5", name: "Dependencia Técnica", gerenciaId: "g3" },
  ];
  for (let i = 0; i < 6; i++) {
    const historical = i === 5;
    const r = {
      id: "r" + i,
      cacId: "c" + ((i % 5) + 1),
      year: 2026,
      month: historical ? 9 : 10,
      half: historical ? 2 : 1,
    };
    d.remisiones.push(r);
    const l = {
      id: "l" + i,
      remisionId: r.id,
      code: `LOT-${historical ? "09" : "10"}-${String(i + 1).padStart(3, "0")}`,
      declared: [8, 6, 5, 4, 0, 3][i],
    };
    d.lotes.push(l);
    for (let j = 0; j < [6, 6, 4, 5, 0, 3][i]; j++) {
      const doc = {
        id: `d${i}-${j}`,
        loteId: l.id,
        type: j % 2 ? "Informe" : "Acta",
        number: `2026-${i + 1}${String(j + 1).padStart(3, "0")}`,
        state:
          j === 0
            ? "Verificado con observación"
            : j % 3 === 0
              ? "Pendiente"
              : "Verificado",
      };
      d.documentos.push(doc);
      if (j === 0)
        d.observaciones.push({
          id: "o" + i,
          documentId: doc.id,
          description: "Falta completar la firma del responsable de origen.",
          date: historical ? "2026-09-28" : "2026-10-10",
          owner: "Responsable de demostración",
          status: i === 1 ? "Regularizada" : "Pendiente",
        });
    }
  }
  return d;
}
