// Permisos del espacio Spark. Firestore aplica las mismas restricciones.
export const admin = p => p?.active === true && p.role === 'technical';
export const visibleModule = (p, page) => {
 if (!p?.active) return false;
 if (admin(p)) return true;
 const modules = {
 gerente: ['dashboard','lotes','remisiones','documentos','observaciones','history'],
 director: ['observationCatalog','catalog','dashboard','documentos','observaciones','history','reports','lotes','remisiones','access','cacs','deadlines'],
 asistente: ['dashboard','remisiones','lotes','documentos','observaciones','history'],
 };
 return (modules[p.role] ?? []).includes(page);
};
export const manageRecord = (p, entity) => admin(p) || (p?.active && ['director','gerente'].includes(p.role) && ['lotes','remisiones'].includes(entity)) || (p?.active && p.role === 'asistente' && ['remisiones','lotes','documentos','observaciones'].includes(entity));
export const manageCacStatus = p => admin(p) || (p?.active && p.role === 'director');
