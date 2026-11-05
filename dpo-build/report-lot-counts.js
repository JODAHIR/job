// Criterio aprobado: individualizados como faltantes, salvo Acuerdo de adhesión.
export function reportLotCounts(lot, individual, presented, type) {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const adhesion = normalize(type?.code || lot.typeCode) === 'adhe' ||
    normalize(type?.description) === 'acuerdo de adhesion';
  const missing = adhesion ? Math.max(0, lot.declared - presented) : individual;
  const correct = lot.declared - missing - (adhesion ? individual : 0);
  return {missing, correct};
}
