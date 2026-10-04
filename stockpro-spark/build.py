from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
p=root/'docs/stockpro/index.html';s=p.read_text()
s=re.sub(r'<!-- STOCKPRO_ROLES_START -->.*?<!-- STOCKPRO_ROLES_END -->','',s,flags=re.S)
s=re.sub(r'\s*<!-- STOCKPRO_SPARK_START -->.*?<!-- STOCKPRO_SPARK_END -->\s*','\n',s,flags=re.S)
s=re.sub(r'<!-- STOCKPRO_LOGIN_START -->.*?<!-- STOCKPRO_LOGIN_END -->','',s,flags=re.S)
s=s.replace('<body>', '<body class="auth-locked">')
s=s.replace('<div class="container-fluid"><div class="row">', '<div id="appShell" class="container-fluid" inert><div class="row">',1)
s=s.replace('<body class="auth-locked">','<body class="auth-locked"><!-- STOCKPRO_LOGIN_START -->'+(root/'docs/stockpro/login-screen.html').read_text()+'<!-- STOCKPRO_LOGIN_END -->')
s=s.replace("const KEY='stockpro-v8';","const KEY='stockpro-v8-spark';")
s=s.replace('StockPro 8 · Firebase','StockPro 8 · Plan gratuito')
if 'registerOwnAccount()' not in s:
 s=s.replace('Establecer / recuperar contraseña</button>', 'Recuperar contraseña</button> <button class="btn btn-outline-primary" type="button" onclick="registerOwnAccount()">Crear mi cuenta</button>')
 s=s.replace('id="logoutButton"','id="logoutButton"')
 s=s.replace('<h5>Backup y recuperación</h5>', '<div class="alert alert-info">Acceso por correo y contraseña. Si es tu primer ingreso, creá tu cuenta y verificá el enlace que recibirás por correo. Tu correo debe estar autorizado por un administrador o encargado.</div><h5>Backup y recuperación</h5>')
 s=s.replace('La persona establece su contraseña desde la pantalla de ingreso.', 'La persona crea su cuenta y verifica su correo desde la pantalla de ingreso.')
s=s.replace("setInterval(()=>{if(auth?.currentUser&&!conflict&&navigator.onLine)retrySync()},30000);", '')
s=s.replace('else saleMsg.innerHTML=\'<div class="alert alert-success">Venta guardada. \'+(activeOwner===\'local\'?\'Modo local.\':\'Consultá el indicador de sincronización.\')+\'</div>\';', "else saleMsg.innerHTML='';")
s=s.replace("'<div class=\"alert alert-success\">Venta y numeración confirmadas por Firebase.</div>'", "''")
# Keep the status node for existing synchronization code, hide the shared banner.
s=s.replace('<div class="sync-note">', '<div class="sync-note" hidden style="display:none">')
bridge=(root/'docs/stockpro/roles-client.js').read_text()
# Shared domain operations run locally; Firestore Security Rules enforce authority.
domain=(root/'stockpro-firebase/functions/domain.js').read_text().replace("const {isDeepStrictEqual}=require('node:util');", "const isDeepStrictEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);")
domain=domain.replace('function next(list){return Math.max(0,...list.map(r=>r.id))+1}', 'let sparkSequence=0;function next(list){return Math.max(Date.now()*100+(++sparkSequence%100),Math.max(0,...list.map(r=>r.id))+1)}')
spark=(root/'docs/stockpro/spark-client.js').read_text()
s=s.replace('</body>', '<!-- STOCKPRO_SPARK_START --><script>\nconst StockDomain=(()=>{const module={exports:{}};\n'+domain+'\nreturn module.exports;})();\n'+bridge+'\n'+spark+'\n'+(root/'docs/stockpro/modules-client.js').read_text()+'\n'+(root/'docs/stockpro/dashboard-client.js').read_text()+'\n'+(root/'docs/stockpro/live-client.js').read_text()+'\n'+(root/'docs/stockpro/pos-client.js').read_text()+'\n'+(root/'docs/stockpro/movements-client.js').read_text()+'\n'+(root/'docs/stockpro/products-client.js').read_text()+'\n'+(root/'docs/stockpro/data-help-client.js').read_text()+'\n'+(root/'docs/stockpro/suppliers-client.js').read_text()+'\n'+(root/'docs/stockpro/login-client.js').read_text()+'\nrenderAll();startCloud();\n</script><!-- STOCKPRO_SPARK_END -->\n</body>')
p.write_text(s)
