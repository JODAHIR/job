from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
page=root/'docs/stockpro/index.html'
s=page.read_text()
# Idempotently replace the embedded roles layer on subsequent builds.
if '<!-- STOCKPRO_ROLES_START -->' in s:
 s=re.sub(r'<!-- STOCKPRO_ROLES_START -->.*?<!-- STOCKPRO_ROLES_END -->','',s,flags=re.S)
else:
 s=s.replace("const KEY='stockpro-v7';","const KEY='stockpro-v8';")
 s=s.replace('renderAll();startCloud();','/* Initialization follows the role layer. */')
 s=s.replace('</nav><div class="side-bottom">','<button class="nav-link btn w-100" data-page="usuarios"><span aria-hidden="true">♙</span><span class="nav-label">Usuarios y roles</span></button></nav><div class="side-bottom">')
 s=s.replace('<span class="user-circle">D</span>','<span id="roleLabel" class="badge text-bg-secondary">Sin sesión</span>')
 s=s.replace('<button class="btn btn-primary" type="submit">Iniciar sesión</button>','<button class="btn btn-primary" type="submit">Iniciar sesión</button> <button class="btn btn-outline-primary" type="button" onclick="resetOwnPassword()">Establecer / recuperar contraseña</button>')
 s=s.replace('</main></div></div>', '''<section id="usuarios" class="page"><div class="d-flex justify-content-between align-items-center mobile-stack"><div><h2>Usuarios y roles</h2><p class="text-secondary">Cada persona accede con su propia cuenta.</p></div><button class="btn btn-primary" onclick="editUser(null)">＋ Nuevo usuario</button></div><div class="card p-3 mt-3"><div class="table-responsive"><table class="table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody id="usersBody"></tbody></table></div></div><p class="text-secondary mt-3">El encargado administra usuarios operativos. Solo un administrador gestiona otras cuentas de administrador.</p></section></main></div></div>
<div class="modal fade" id="userModal"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5>Acceso de usuario</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body"><input id="userUid" type="hidden"><label for="userName" class="form-label">Nombre</label><input id="userName" class="form-control mb-3" maxlength="200"><label for="userEmail" class="form-label">Correo</label><input id="userEmail" type="email" class="form-control mb-3" maxlength="254"><label for="userRole" class="form-label">Rol</label><select id="userRole" class="form-select mb-3"><option value="CAJERO">Cajero</option><option value="ENCARGADO">Encargado</option><option value="ADMIN">Administrador (superusuario)</option></select><label><input id="userActive" type="checkbox" checked> Acceso activo</label><p class="text-secondary mt-3">La persona establece su contraseña desde la pantalla de ingreso. Desactivar revoca el acceso a StockPro.</p></div><div class="modal-footer"><button id="saveUserButton" class="btn btn-primary" onclick="saveUser()">Guardar acceso</button></div></div></div></div>''')
 s=s.replace('<h5>Historial de cierres</h5>','<h5>Supervisión de turnos</h5><div id="cashOverview" class="mb-3"></div><h5>Historial de cierres</h5>')
 s=s.replace('<h5>Backup y recuperación</h5>','<h5>Backup y recuperación</h5><button class="btn btn-outline-secondary mb-3" onclick="exportPendingCommands()">Descargar mis operaciones pendientes</button>')
 s=s.replace('Tu información en Firebase, con una copia de contingencia en este navegador.','Despensa compartida, permisos por usuario y copia de contingencia.')
 s=s.replace('StockPro 7 · Firebase','StockPro 8 · Firebase')
bridge=(root/'docs/stockpro/roles-client.js').read_text()
s=s.replace('</body>', '<!-- STOCKPRO_ROLES_START --><script>\n'+bridge+'\nrenderAll();startCloud();\n</script><!-- STOCKPRO_ROLES_END -->\n</body>')
page.write_text(s)
print('StockPro 8 generado con roles integrados.')
