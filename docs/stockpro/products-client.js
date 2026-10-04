/* CSV adds products through the existing authorized, durable save pipeline. */
let productImportExplicitSku=false,productCsvRows=[],productCsvBusy=false;
const productOpenBeforeCsv=openProduct;
openProduct=function(id=null){productImportExplicitSku=false;productOpenBeforeCsv(id);pSku.readOnly=!id;if(!id)pSku.value=StockDomain.nextProductSku(db.products);};
const productCaptureBeforeCsv=captureCommand;
captureCommand=function(action,args){const payload=productCaptureBeforeCsv(action,args);if(action==='saveProduct'&&!payload.id)payload.autoSku=!productImportExplicitSku;return payload;};
const productSaveBeforeCsv=saveProduct;
saveProduct=function(){if(!Number(productId.value)&&!productImportExplicitSku)pSku.value=StockDomain.nextProductSku(db.products);const beforeCount=db.products.length,beforeQueue=envelope.queue?.length||0;const result=productSaveBeforeCsv();const node=document.getElementById('productModal');if((db.products.length>beforeCount||(envelope.queue?.length||0)>beforeQueue)&&node.classList.contains('show'))node.addEventListener('shown.bs.modal',()=>modal('productModal').hide(),{once:true});return result;};
function parseProductsCsv(text){
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0],delimiter=first.includes(';')?';':',';
 const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
 if(c==='"'){if(value||closed)throw Error('Comillas inválidas en el CSV.');quoted=true;}
 else if(c===delimiter){row.push(value);value='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';closed=false;}
 else{if(closed&&c.trim())throw Error('Contenido fuera de comillas.');if(!closed)value+=c;}
 }
 if(quoted)throw Error('Hay una celda con comillas sin cerrar.');row.push(value);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
const PRODUCT_CSV_COLUMNS=['sku','descripcion','categoria','costo','precio','iva','stock','stock_minimo','promedio_diario'];
function validateProductsCsv(text,existing){
 const table=parseProductsCsv(text);if(table.length<2)throw Error('El CSV debe incluir encabezados y productos.');if(table.length>201)throw Error('Importá como máximo 200 productos por archivo.');
 const header=table.shift().map(v=>v.trim().toLowerCase());if(header.length!==PRODUCT_CSV_COLUMNS.length||new Set(header).size!==header.length||PRODUCT_CSV_COLUMNS.some(k=>!header.includes(k)))throw Error('Las columnas deben ser: '+PRODUCT_CSV_COLUMNS.join(', '));
 const seen=new Set(existing.map(p=>p.sku.toLowerCase()));const errors=[],valid=[];
 table.forEach((cells,index)=>{try{if(cells.length!==header.length)throw Error('cantidad de columnas incorrecta');const r=Object.fromEntries(header.map((k,i)=>[k,cells[i].trim()]));if(!r.descripcion||r.descripcion.length>300||!r.categoria||r.categoria.length>100||r.sku.length>100)throw Error('descripción, categoría o SKU inválidos');
 const number=(key,required=false)=>{if(!r[key]){if(required)throw Error(key+' obligatorio');return 0;}if(!/^\d+(?:\.\d+)?$/.test(r[key]))throw Error(key+': usá números sin separador de miles y punto decimal');const n=Number(r[key]);if(!Number.isFinite(n))throw Error(key+' inválido');return n;};
 const p={sku:r.sku,name:r.descripcion,category:r.categoria,cost:number('costo'),price:number('precio',true),vat:r.iva.toLowerCase()==='exento'?0:number('iva',true),stock:number('stock'),min:number('stock_minimo'),avg:number('promedio_diario')};
 if(p.price<=0||![0,5,10].includes(p.vat))throw Error('precio debe ser mayor que cero; IVA debe ser 0, 5 o 10');if(p.sku){if(seen.has(p.sku.toLowerCase()))throw Error('SKU repetido: '+p.sku);seen.add(p.sku.toLowerCase());}valid.push({...p,row:index+2,status:'Pendiente'});
 }catch(e){errors.push('Fila '+(index+2)+': '+e.message);}});
 // Reserve explicit numeric codes before assigning automatic codes to blank cells.
 const reserved=[...existing,...valid.filter(p=>p.sku)];for(const p of valid){if(!p.sku){p.sku=StockDomain.nextProductSku(reserved);reserved.push(p);}}
 if(errors.length)throw Error(errors.slice(0,15).join('\n'));return valid;
}
function downloadProductTemplate(){downloadText('\uFEFF'+PRODUCT_CSV_COLUMNS.join(';')+'\r\n;Arroz 1 kg;Almacén;6500;8500;10;20;5;1\r\n;Leche 1 L;Lácteos;5000;6500;5;12;3;0.5\r\n','plantilla_productos_stockpro.csv','text/csv;charset=utf-8');}
document.getElementById('productos').insertAdjacentHTML('beforeend',`<div class="card p-4 mt-3" id="productCsvCard"><h5>Importar productos desde CSV</h5><p>Agrega productos nuevos; no reemplaza productos existentes. Dejá SKU vacío para asignarlo automáticamente. Máximo 200 filas por archivo.</p><p class="text-secondary">Columnas: sku, descripcion, categoria, costo, precio, iva, stock, stock_minimo, promedio_diario. Usá punto decimal, sin separadores de miles. IVA: 0 (exento), 5 o 10.</p><div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-primary" onclick="downloadProductTemplate()">Descargar plantilla CSV</button><input id="productCsvFile" type="file" accept=".csv,text/csv" class="form-control" style="max-width:320px" aria-label="Archivo CSV de productos" onchange="previewProductCsv(this)"><button id="productCsvImport" class="btn btn-primary" onclick="importProductCsv()" disabled>Importar productos validados</button></div><p id="productCsvStatus" role="status" class="mt-3" style="white-space:pre-line"></p><div id="productCsvPreview" class="table-responsive"></div></div>`);
function renderProductCsv(){document.getElementById('productCsvPreview').innerHTML=productCsvRows.length?'<table class="table"><thead><tr><th>Fila</th><th>SKU</th><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th></tr></thead><tbody>'+productCsvRows.map(p=>`<tr><td>${p.row}</td><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${esc(p.status)}</td></tr>`).join('')+'</tbody></table>':'';document.getElementById('productCsvImport').disabled=productCsvBusy||!productCsvRows.some(p=>p.status==='Pendiente');}
async function previewProductCsv(input){productCsvRows=[];renderProductCsv();const status=document.getElementById('productCsvStatus');try{if(!allowed('saveProduct'))throw Error('Tu rol no permite importar productos.');const file=input.files[0];if(!file)return;if(file.size>2*1024*1024)throw Error('El archivo debe ser menor que 2 MB.');productCsvRows=validateProductsCsv(await file.text(),db.products);status.textContent=productCsvRows.length+' productos validados. Revisá la vista previa antes de importar.';}catch(e){status.textContent=e.message;}renderProductCsv();}
async function importProductCsv(){
 if(productCsvBusy)return;const status=document.getElementById('productCsvStatus');
 if(!allowed('saveProduct')||!canMutate())return;
 if(!navigator.onLine||envelope.pending||syncing||reading){status.textContent='Conectate y sincronizá los pendientes antes de importar.';return;}
 productCsvBusy=true;document.getElementById('productCsvFile').disabled=true;renderProductCsv();
 try{
  await refreshCloud();if(syncState!=='connected')throw Error('No se pudo verificar la versión actual de los productos.');
  for(const p of productCsvRows.filter(p=>p.status==='Pendiente')){
   if(db.products.some(x=>x.sku.toLowerCase()===p.sku.toLowerCase()))throw Error('Fila '+p.row+': el SKU '+p.sku+' ya existe. Revisá y volvé a cargar el archivo con las filas restantes.');
   if(!allowed('saveProduct')||!canMutate())throw Error('Se detuvo la importación: revisá los permisos o la sincronización.');
   productId.value='';productImportExplicitSku=true;
   for(const [id,key] of Object.entries({pSku:'sku',pName:'name',pCategory:'category',pCost:'cost',pPrice:'price',pVat:'vat',pStock:'stock',pMin:'min',pAvg:'avg'}))document.getElementById(id).value=p[key];
   const before=envelope.queue?.length||0;saveProduct();if((envelope.queue?.length||0)<=before)throw Error('No se pudo guardar la fila '+p.row+'.');
   p.status='Guardado local / pendiente';renderProductCsv();await flushCloud();
   while(syncing)await new Promise(resolve=>setTimeout(resolve,100));
   if(envelope.pending||syncState!=='connected')throw Error('Importación detenida. La fila '+p.row+' está conservada en pendientes. Sincronizá y luego continuá solo con las filas restantes.');
   p.status='Importado';status.textContent=productCsvRows.filter(p=>p.status==='Importado').length+' de '+productCsvRows.length+' productos importados.';renderProductCsv();
  }
 }catch(e){status.textContent=e.message;}finally{productImportExplicitSku=false;productCsvBusy=false;document.getElementById('productCsvFile').disabled=false;renderProductCsv();}
}
