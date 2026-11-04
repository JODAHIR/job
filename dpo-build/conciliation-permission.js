// Propuesta: la identidad proviene de la sesión; los contactos, de la gerencia.
export function canConciliate(profile, identity, management) {
  if (profile?.active !== true || !identity?.uid) return false;
  if (['technical', 'director'].includes(profile.role)) return true;
  if (identity.emailVerified !== true || !management?.id) return false;
  const email = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '';
  return !!email && Array.isArray(management.responsables) && management.responsables.some(
    contact => typeof contact?.correo === 'string' && contact.correo.trim().toLowerCase() === email
  );
}
