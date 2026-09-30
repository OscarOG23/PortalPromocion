// Evaluación preventiva: las fuentes se leen en el servidor y las anotaciones no cambian producción.
var COLUMNAS_ATENCION_PREVENTIVA = ['CLAVE','PERIODO','UNIDAD_ID','PENDIENTE_ID','RESPONSABLE','COMENTARIO','FECHA_COMPROMISO','ESTADO','VERSION','USUARIO','ACTUALIZADO'];
function errorSeguimiento_(code,message){var e=new Error(message);e.code=code;return e;}
function identidadSeguimiento_(p){
  if(!p || !/^20\d\d-(0[1-9]|1[0-2])$/.test(String(p.periodo)))throw errorSeguimiento_('PERIODO_INVALIDO','Seleccione un mes válido.');
  var r=cuentaActualSeguimiento_(p.boleto);if(!r.ok)throw errorSeguimiento_(r.code,r.message||'Vuelva a iniciar sesión.');
  var u=r.usuario;
  // Leer sin caché: una baja o cambio de unidad limita el ámbito inmediatamente.
  var catalogo=leerTabla(HOJAS.UNIDADES),universo=catalogo.filter(function(f){return esVerdadero(f.activo);}).map(function(f){return {id:String(f.clues).trim()};});
  var unidades=catalogo.filter(function(f){
    return esVerdadero(f.activo) && (esAdmin(u) || (String(f.coordinacion_id)===String(u.coordinacion_id) &&
      (rolDeCuenta(u)==='COORDINACION' || String(f.unidad_id)===String(u.unidad_id))));
  }).map(function(f){return {id:String(f.clues).trim(),nombre:String(f.nombre_unidad),coordinacion_id:String(f.coordinacion_id),portal_id:String(f.unidad_id)};});
  if(unidades.some(function(f){return !/^[A-Z]{5}\d{6}$/.test(f.id);}))throw errorSeguimiento_('CATALOGO_INVALIDO','Revisar las CLUES del catálogo.');
  if(p.unidad_id && !unidades.some(function(f){return f.id===p.unidad_id;}))throw errorSeguimiento_('NO_AUTORIZADO','La unidad no pertenece a su ámbito.');
  return {usuario:u,unidades:unidades,universo:universo,seleccion:unidades.filter(function(f){return !p.unidad_id||f.id===p.unidad_id;})};
}
function cuentaActualSeguimiento_(boleto){return _cuentaDelBoleto(verificarBoleto(boleto,secretoDeBoletos(),DESTINO_PORTAL,Date.now()),leerTabla(HOJAS.USUARIOS));}
function tablaSeguimiento_(id,nombre,requeridos,opcional){
  if(!id)throw errorSeguimiento_('FUENTE_PENDIENTE','Fuente sin configurar.');
  var hoja=SpreadsheetApp.openById(id).getSheetByName(nombre);
  if(!hoja){if(opcional)return [];throw errorSeguimiento_('FUENTE_PENDIENTE','Tabla de origen pendiente.');}
  var values=hoja.getDataRange().getValues(),headers=(values[0]||[]).map(String);
  if(requeridos.some(function(h){return headers.indexOf(h)<0;}))throw errorSeguimiento_('FUENTE_INCOMPATIBLE','Encabezados de origen incompatibles.');
  return values.slice(1).filter(function(row){return row.some(function(v){return v!=='';});}).map(function(row){var f={};headers.forEach(function(h,i){if(h)f[h]=row[i];});return f;});
}
function documentosSeguimiento_(){
  var id=PropertiesService.getScriptProperties().getProperty('ID_CARPETA_FUENTES_PREVENTIVAS');
  if(!id)throw errorSeguimiento_('FUENTE_PENDIENTE','Fuentes mensuales sin configurar.');
  var files=DriveApp.getFolderById(id).getFiles(),docs=[],metas=null,n=0,size=0;
  while(files.hasNext()){
    var f=files.next(),nombre=f.getName();
    if(!/^(NOMINAL|CUBOS|SINBA)_[A-Za-z0-9_-]+_20\d\d-\d\d-\d\d_[a-f0-9]{16}\.json$/.test(nombre)&&nombre!=='METAS_PREVENTIVAS_2026.json')continue;
    n++;size+=f.getSize();if(n>101||size>16*1024*1024||f.getSize()>5*1024*1024)throw errorSeguimiento_('FUENTE_GRANDE','Archivar cortes antiguos de las fuentes activas.');
    var doc=JSON.parse(f.getBlob().getDataAsString('UTF-8'));
    if(nombre==='METAS_PREVENTIVAS_2026.json'){if(metas)throw errorSeguimiento_('FUENTE_DUPLICADA','Hay dos catálogos de metas activos.');metas=doc;}else docs.push(doc);
  }
  if(metas && (metas.version!==1||!Array.isArray(metas.metas)||!Array.isArray(metas.puente)))throw errorSeguimiento_('FUENTE_INCOMPATIBLE','Catálogo de metas incompatible.');
  return {documentos:docs,metas:metas};
}
function canonicalizarSeguimiento_(clues,unidades,puente){
  var exacta=unidades.filter(function(u){return u.id===String(clues);});if(exacta.length)return exacta.length===1?exacta[0].id:null;
  var relacionadas=(puente||[]).filter(function(p){return p.clues_metas===String(clues)||p.clues_sis===String(clues);});
  var candidatas=unidades.filter(function(u){return relacionadas.some(function(p){return p.clues_metas===u.id||p.clues_sis===u.id;});});
  return candidatas.length===1?candidatas[0].id:null;
}
function mapearDocumentosSeguimiento_(documentos,universo,puente){
  return documentos.map(function(doc){var c=Object.assign({},doc);c.filas=doc.filas.map(function(f){var row=Object.assign({},f);row.unidad_id=canonicalizarSeguimiento_(f.unidad_id,universo,puente)||'SIN_PUENTE:'+f.unidad_id;return row;});return c;});
}
function datosSeguimiento_(identidad,periodo){
  var props=PropertiesService.getScriptProperties(),unidades=identidad.seleccion,universo=identidad.universo||identidad.unidades,disponibilidad=[],paquete=null,puente=[],metas=[],avances=[],fuentes={nominal:[],cubos:[],sinba:[],comparacion:[],fuentes:[]},det=[],ev=[],escolar=[];
  function canon(clues){var id=canonicalizarSeguimiento_(clues,universo,puente);return unidades.some(function(u){return u.id===id;})?id:null;}
  try{
    paquete=documentosSeguimiento_();puente=paquete.metas?paquete.metas.puente:[];
    metas=(paquete.metas?paquete.metas.metas:[]).filter(function(m){return m.periodo===periodo;}).map(function(m){var c=Object.assign({},m);c.unidad_id=canon(m.unidad_id);return c;}).filter(function(m){return m.unidad_id;});
    avances=(paquete.metas?paquete.metas.avances_oficiales||[]:[]).filter(function(m){return m.periodo===periodo;}).map(function(m){var c=Object.assign({},m);c.unidad_id=canon(m.unidad_id);return c;}).filter(function(m){return m.unidad_id;});
    // Elegir el corte del ámbito antes de filtrar filas: un corte nuevo puede retirar una unidad.
    var docs=mapearDocumentosSeguimiento_(paquete.documentos,universo,puente);
    fuentes=seleccionarFuentesPreventivas(docs,periodo,unidades.map(function(u){return u.id;}));
    ['NOMINAL','CUBOS','SINBA'].forEach(function(nombre){var files=fuentes.fuentes.filter(function(f){return f.fuente===nombre;});disponibilidad.push({fuente:nombre,corte:files.map(function(f){return f.corte;}).sort().pop()||null,estado:files.length?'REVISION':'SIN_DATOS_DEL_MES',detalle:nombre==='SINBA'?'Intervalo original; no distribuir el acumulado entre meses.':'Actividad observada; cobertura y cierre pendientes de validar.'});});
    disponibilidad.push({fuente:'METAS',corte:paquete.metas?paquete.metas.corte:null,estado:paquete.metas?'DISPONIBLE':'PENDIENTE',detalle:'Metas institucionales del evaluador, con equivalencias CLUES existentes.'});
  }catch(e){console.error('Fuentes preventivas: '+e.message);disponibilidad.push({fuente:'ARCHIVOS_MENSUALES',corte:null,estado:'PENDIENTE',detalle:'Las fuentes mensuales requieren revisión o configuración. Avise a la jurisdicción.'});}
  try{
    var id=props.getProperty('ID_DETERMINANTES'),cats=tablaSeguimiento_(id,'CAT_UNIDADES',['unidad_id','clues']);
    unidades.forEach(function(u){var matches=cats.filter(function(f){return canon(f.clues)===u.id;});if(matches.length===1)u.determinantes_id=String(matches[0].unidad_id);});
    det=tablaSeguimiento_(id,'CAPTURA_DETERMINANTES',['anio','mes','unidad_id','indicador_id','estatus']);
    ev=tablaSeguimiento_(id,'EVIDENCIAS',['anio','mes','unidad_id'],true);
    disponibilidad.push({fuente:'DETERMINANTES',corte:null,estado:'EN_LINEA',detalle:'Lectura de talleres SUB039 y evidencias declaradas de Adicciones.'});
  }catch(e){console.error('Determinantes: '+e.message);disponibilidad.push({fuente:'DETERMINANTES',corte:null,estado:'PENDIENTE',detalle:'No fue posible consultar la captura de origen.'});}
  try{escolar=tablaSeguimiento_(props.getProperty('ID_JORNADAS'),'INTERVENCIONES_ESCOLARES',['UNIDAD_ID','PERIODO','CCT','ESTATUS'],true).map(function(f){var c=Object.assign({},f);c.UNIDAD_ID=canon(f.UNIDAD_ID);return c;}).filter(function(f){return f.UNIDAD_ID;});disponibilidad.push({fuente:'ESCOLAR',corte:null,estado:'EN_LINEA',detalle:'Complemento escolar de Jornadas; intervención no acredita certificación.'});}
  catch(e){console.error('Escuelas: '+e.message);disponibilidad.push({fuente:'ESCOLAR',corte:null,estado:'PENDIENTE',detalle:'No fue posible consultar la captura escolar de origen.'});}
  return construirSeguimientoPreventivo({periodo:periodo,unidades:unidades,determinantes:det,evidencias:ev,escolar:escolar,metas:metas,avances_oficiales:avances,fuentes:fuentes,disponibilidad:disponibilidad});
}
function hojaAtencionPreventiva_(){
  var ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName('ATENCION_PREVENTIVA');
  if(!sh){sh=ss.insertSheet('ATENCION_PREVENTIVA');sh.getRange(1,1,1,COLUMNAS_ATENCION_PREVENTIVA.length).setValues([COLUMNAS_ATENCION_PREVENTIVA]);sh.setFrozenRows(1);}
  return sh;
}
function anotacionesPreventivas_(pendientes,periodo){
  var filas=leerTabla('ATENCION_PREVENTIVA');
  pendientes.forEach(function(p){var f=filas.filter(function(f){return f.PERIODO===periodo&&f.UNIDAD_ID===p.unidad_id&&f.PENDIENTE_ID===p.id;}).sort(function(a,b){return Number(b.VERSION)-Number(a.VERSION);})[0];
    p.responsable=f?f.RESPONSABLE:'';p.comentario=f?String(f.COMENTARIO).replace(/^'(?=[=+@-])/,''):'';p.fecha_compromiso=f?String(f.FECHA_COMPROMISO):'';p.estado_atencion=f?f.ESTADO:'ABIERTA';p.version=f?Number(f.VERSION):0;
  });return pendientes;
}
function seguimientoPreventivo(p){
  try{var id=identidadSeguimiento_(p),data=datosSeguimiento_(id,p.periodo);return {ok:true,periodo:p.periodo,usuario:{nombre:id.usuario.nombre,rol:rolDeCuenta(id.usuario)},unidades:id.unidades.map(function(u){return {id:u.id,nombre:u.nombre,coordinacion_id:u.coordinacion_id};}),indicadores:data.indicadores,pendientes:anotacionesPreventivas_(data.pendientes,p.periodo),fuentes:data.fuentes};}
  catch(e){return {ok:false,code:e.code||'ERROR_SEGUIMIENTO',message:e.code?e.message:'No fue posible consultar el seguimiento. Intente de nuevo.'};}
}
function validarAtencionPreventiva_(p){
  var r={};['responsable','comentario','fecha_compromiso','estado_atencion'].forEach(function(k){r[k]=String(p[k]||'').trim();});
  if(['ABIERTA','EN_PROCESO','ATENDIDA'].indexOf(r.estado_atencion)<0||r.responsable.length>120||r.comentario.length>1000)throw errorSeguimiento_('DATOS_INVALIDOS','Revise el estado y la extensión del texto.');
  if(r.fecha_compromiso && (!/^20\d\d-\d\d-\d\d$/.test(r.fecha_compromiso)||new Date(r.fecha_compromiso+'T12:00:00Z').toISOString().slice(0,10)!==r.fecha_compromiso))throw errorSeguimiento_('DATOS_INVALIDOS','Seleccione una fecha válida.');
  if(!Number.isInteger(p.version)||p.version<0)throw errorSeguimiento_('DATOS_INVALIDOS','Versión inválida. Actualice la pantalla.');
  ['responsable','comentario'].forEach(function(k){if(/^[=+@-]/.test(r[k]))r[k]="'"+r[k];});return r;
}
function comprobarVersionPreventiva_(fila,version){var actual=fila?Number(fila.VERSION):0;if(version!==actual)throw errorSeguimiento_('CONFLICTO','El pendiente cambió. Actualice la pantalla antes de guardar.');return actual+1;}
function atenderPreventivo(p){
  var lock;
  try{
    var id=identidadSeguimiento_(p),val=validarAtencionPreventiva_(p),data=datosSeguimiento_(id,p.periodo);
    if(!data.pendientes.some(function(f){return f.id===p.pendiente_id&&f.unidad_id===p.unidad_id;}))throw errorSeguimiento_('PENDIENTE_CAMBIO','El pendiente ya no corresponde a la fuente. Actualice la pantalla.');
    lock=LockService.getScriptLock();lock.waitLock(20000);var sh=hojaAtencionPreventiva_(),filas=leerTabla('ATENCION_PREVENTIVA'),clave=[p.periodo,p.unidad_id,p.pendiente_id].join('|'),index=-1;
    filas.forEach(function(f,i){if(f.CLAVE===clave&&(index<0||Number(f.VERSION)>Number(filas[index].VERSION)))index=i;});var version=comprobarVersionPreventiva_(index<0?null:filas[index],p.version);
    var f={CLAVE:clave,PERIODO:p.periodo,UNIDAD_ID:p.unidad_id,PENDIENTE_ID:p.pendiente_id,RESPONSABLE:val.responsable,COMENTARIO:val.comentario,FECHA_COMPROMISO:val.fecha_compromiso,ESTADO:val.estado_atencion,VERSION:version,USUARIO:id.usuario.usuario,ACTUALIZADO:new Date().toISOString()};
    // Cada versión se agrega: no se destruye el comentario ni el responsable anteriores.
    var range=sh.getRange(sh.getLastRow()+1,1,1,COLUMNAS_ATENCION_PREVENTIVA.length);range.setNumberFormat('@');range.setValues([COLUMNAS_ATENCION_PREVENTIVA.map(function(k){return f[k];})]);
    // La fila inmutable conserva actor, fecha y versión bajo este mismo bloqueo.
    return {ok:true,version:version};
  }catch(e){return {ok:false,code:e.code||'ERROR_ATENCION',message:e.code?e.message:'No fue posible guardar. Intente de nuevo.'};}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
// Sólo ejecución OAuth del propietario; no está en ACCIONES_API.
function configurarSeguimientoPreventivo(config){
  ['ID_DETERMINANTES','ID_JORNADAS','ID_CARPETA_FUENTES_PREVENTIVAS'].forEach(function(k){if(!config||!/^[-\w]{20,}$/.test(config[k]||''))throw Error('ID inválido: '+k);});
  PropertiesService.getScriptProperties().setProperties(config,false);hojaAtencionPreventiva_();return {ok:true};
}
function diagnosticarSeguimientoPreventivo(){
  var unidades=leerTabla(HOJAS.UNIDADES).filter(function(f){return esVerdadero(f.activo);}).map(function(f){return {id:String(f.clues),nombre:String(f.nombre_unidad)};});
  var periodo=String(getConfig('anio_activo'))+'-'+('0'+getConfig('mes_activo')).slice(-2);
  var data=datosSeguimiento_({unidades:unidades,universo:unidades,seleccion:unidades},periodo);
  var resumen={periodo:periodo,unidades:unidades.length,indicadores:data.indicadores.length,con_valor:data.indicadores.filter(function(f){return f.valor!==null;}).length,con_meta:data.indicadores.filter(function(f){return f.meta!==null;}).length,fuentes:data.fuentes};
  console.log(JSON.stringify(resumen));return resumen;
}
