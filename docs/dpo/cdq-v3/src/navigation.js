import {visibleModule,manageRecord} from './permissions.js?v=cah-lotes-20261019';
const list={id:'list',label:'Consultar',action:'view'};
const records=(id,label)=>({id,label,functions:[list,{id:'new',label:'Registrar',action:'new',write:id}]});
export const groups=[
 {id:'administracion',label:'ADMINISTRACIÓN',modules:[records('gerencias','Gerencia'),records('cacs','CAC'),{id:'catalog',label:'Tipos documentales',functions:[]},
 {id:'access',label:'Usuarios y permisos',functions:[list,{id:'requests',label:'Solicitudes de acceso',target:'#access-requests',admin:true,sparkOnly:true},{id:'assign',label:'Asignar responsables',target:'#assignment-form'},{id:'profiles',label:'Administrar perfiles',target:'#profile-form',admin:true}]},
 {id:'deadlines',label:'Plazos y excepciones',functions:[{id:'list',label:'Consultar vencimientos',target:'#deadline-list'},{id:'calendar',label:'Calendario registrado',target:'#calendar-view'},{id:'approve',label:'Aprobar calendario',target:'#calendar-form'},{id:'exception',label:'Autorizar excepción',target:'#exception-form',noSpark:true}]},
 {id:'bulk',label:'Importar CSV',functions:[{id:'list',label:'Importar y validar CSV',action:'view'},{id:'template',label:'Descargar plantilla',target:'#bulk-template',click:true,noSpark:true},{id:'migration',label:'Migración local',page:'migration',admin:true,cloudOnly:true}]},
 {id:'audit',label:'Auditoría',functions:[]} ]},
 {id:'operativo',label:'OPERATIVO',modules:[{...records('remisiones','Remisiones'),functions:[list,{id:'new',label:'Registrar',action:'new',write:'remisiones'},{id:'generate',label:'Generar por gerencia',action:'generate',write:'remisiones',sparkOnly:true}]},records('lotes','Lotes documentales'),records('documentos','Documentos'),records('observaciones','Observaciones')]},
 {id:'informes',label:'INFORMES',modules:[{id:'history',label:'Períodos históricos',functions:[]},{id:'reports',label:'Reportes y comparativos',functions:[{id:'list',label:'Reportes documentales',report:'documentos'},{id:'differences',label:'Diferencias y faltantes',report:'diferencias'},{id:'deadlines',label:'Plazos',report:'plazos'},{id:'comparison',label:'Comparativos',report:'comparativo'}]}]}
];
export const modules=groups.flatMap(g=>g.modules.map(m=>({...m,group:g.id,groupLabel:g.label})));
export const pages=[['dashboard','◫','Dashboard'],...modules.map(m=>[m.id,'▤',m.label]),['migration','⇧','Migración local']];
export const allowed=(page,ctx)=>ctx.mode==='cloud'?visibleModule(ctx.profile,page):!['access','deadlines','migration','catalog'].includes(page);
export function functionsFor(module,ctx){return module.functions.filter(fn=>(!fn.admin||ctx.profile?.role==='technical')&&(!fn.write||ctx.mode!=='cloud'||manageRecord(ctx.profile,fn.write))&&(!fn.cloudOnly||ctx.mode==='cloud')&&(!fn.sparkOnly||ctx.spark)&&(!fn.page||allowed(fn.page,ctx)));}
export function resolveRoute(hash,ctx){
 const parts=hash.replace(/^#\/?/,'').split('/');
 if((!parts[0]||parts[0]==='dashboard')&&parts.length===1)return {page:'dashboard',functionId:'list'};
 const m=modules.find(m=>m.group===parts[0]&&m.id===parts[1]);
 if(!m||!allowed(m.id,ctx))return {page:'dashboard',functionId:'list',error:'Pantalla inexistente o no autorizada.'};
 const id=parts[2]||'list',fn=functionsFor(m,ctx).find(f=>f.id===id);
 if((m.functions.length&&!fn)||(!m.functions.length&&id!=='list')||parts.length>3)return {page:'dashboard',functionId:'list',error:'Función inexistente o no autorizada.'};
 return {page:fn?.page||m.id,module:m.id,functionId:id,fn};
}
export function routeFor(page,id='list'){const m=modules.find(m=>m.id===(page==='migration'?'bulk':page));return m?`#/${m.group}/${m.id}/${page==='migration'?'migration':id}`:'#/dashboard';}
