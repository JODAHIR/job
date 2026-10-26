// Pure policy shared by UI and tests; Firestore rules remain authoritative.
export const ANNUL_LIMIT = 2;
export const isAnnulled = r => r?.annulment != null;
export function annulEligibility(profile, gerenciaId, remision, control) {
  if (!profile?.active || !['technical','director','gerente'].includes(profile.role)) return 'Sin permiso';
  if (profile.role === 'gerente' && profile.gerenciaId !== gerenciaId) return 'Gerencia no autorizada';
  if (isAnnulled(remision)) return 'Ya anulada';
  if (!control) return 'Requiere inicialización administrativa';
  return '';
}
export function treeCounts(db, remisionId) {
  const lots=db.lotes.filter(l=>l.remisionId===remisionId), lids=new Set(lots.map(l=>l.id));
  const docs=db.documentos.filter(d=>lids.has(d.loteId)), dids=new Set(docs.map(d=>d.id));
  return {lots:lots.length,documents:docs.length,observations:db.observaciones.filter(o=>dids.has(o.documentId)).length};
}
