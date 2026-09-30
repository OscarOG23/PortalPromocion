// Cortes agregados preparados por tools/fuentes_preventivas.py. Carpeta privada del backend.
// No reciben archivos ni identificadores de fuentes desde el navegador.
function fechaFuentePreventiva_(valor) {
  if (!/^20\d\d-\d\d-\d\d$/.test(String(valor))) return false;
  var d=new Date(valor+'T12:00:00Z');return !isNaN(d.getTime()) && d.toISOString().slice(0,10)===valor;
}

function seleccionarFuentesPreventivas(documentos, periodo, unidades) {
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(periodo)) throw new Error('Periodo inválido.');
  var candidatos={}, finales={}, cortesVistos={}, propietarios={}, salida={nominal:[],cubos:[],sinba:[],comparacion:[],fuentes:[]};
  var campos=['periodo','unidad_id','recurso_id','recurso_nombre','instrumento','total','estado','categorias','medicion'];
  (documentos||[]).forEach(function(doc) {
    if (!doc || doc.version!==1 || ['NOMINAL','CUBOS','SINBA'].indexOf(doc.fuente)<0 ||
        !/^[A-Za-z0-9_-]{1,60}$/.test(doc.ambito) || !fechaFuentePreventiva_(doc.corte) ||
        !/^[a-f0-9]{64}$/.test(doc.sha256) || !Array.isArray(doc.filas)) throw new Error('Formato de fuente incompatible.');
    var relevantes=doc.filas.filter(function(f) {
      if (doc.fuente==='SINBA') {
        var rango=String(f.periodo).split('/');
        return rango.length===2 && rango[0]<=periodo && rango[1]>=periodo;
      }
      return f.periodo===periodo;
    });
    if (!relevantes.length) return;
    var key=doc.fuente+'|'+doc.ambito, claveCorte=key+'|'+doc.corte;
    var firma=doc.sha256+'|'+JSON.stringify(doc.filas);
    if (cortesVistos[claveCorte] && cortesVistos[claveCorte]!==firma) throw new Error('Dos archivos diferentes del mismo corte; revisar la carpeta privada.');
    cortesVistos[claveCorte]=firma;
    var ant=candidatos[key];
    if (!ant || doc.corte>ant.corte) candidatos[key]=doc;
    else if (doc.corte===ant.corte && (doc.sha256!==ant.sha256 || JSON.stringify(doc.filas)!==JSON.stringify(ant.filas))) throw new Error('Dos archivos diferentes del mismo corte; revisar la carpeta privada.');
  });
  Object.keys(candidatos).forEach(function(k) {
    var doc=candidatos[k], duplicados={}, aporta=false;
    doc.filas.forEach(function(f) {
      if (unidades.indexOf(f.unidad_id)<0) return;
      var rango=String(f.periodo).split('/');
      if (doc.fuente==='SINBA' ? !(rango.length===2 && rango[0]<=periodo && rango[1]>=periodo) : f.periodo!==periodo) return;
      if (Object.keys(f).some(function(c) { return campos.indexOf(c)<0; })) throw new Error('Campo no permitido en la fuente agregada.');
      if (typeof f.total!=='number' || !isFinite(f.total) || f.total<0 || Math.floor(f.total)!==f.total) {
        if (!(doc.fuente==='SINBA' && f.total===null)) throw new Error('Cifra inválida en la fuente agregada.');
      }
      if (doc.fuente==='SINBA') {
        if (!fechaFuentePreventiva_(doc.inicio||rango[0]+'-01') || !fechaFuentePreventiva_(doc.fin||doc.corte) ||
            f.medicion!=='DETECCIONES_GENERALES' || !f.recurso_id || f.instrumento) throw new Error('Medición SINBA incompatible.');
      } else if (['AUDIT','FAGERSTROM','DROGAS'].indexOf(f.instrumento)<0 || (doc.fuente==='NOMINAL'?!f.recurso_id:!!f.recurso_id)) throw new Error('Instrumento o nivel de fuente incompatible.');
      var identidad=[doc.fuente,f.periodo,f.unidad_id,f.recurso_id||'',f.instrumento||f.medicion].join('|');
      if (duplicados[identidad]) throw new Error('Fila duplicada dentro del corte.');
      duplicados[identidad]=true;
      var cobertura=doc.fuente+'|'+f.unidad_id+'|'+periodo;
      if (propietarios[cobertura] && propietarios[cobertura]!==doc.ambito) throw new Error('Ámbitos solapados para la misma unidad y mes.');
      propietarios[cobertura]=doc.ambito;
      if (finales[identidad]) throw new Error('Ámbitos solapados para la misma unidad y medición.');
      finales[identidad]=true;
      var r={};Object.keys(f).forEach(function(c) { r[c]=f[c]; });
      r.corte=doc.corte;r.ambito=doc.ambito;r.estado_fuente=f.estado||'OBSERVADO';
      if (doc.fuente==='SINBA') { r.inicio=doc.inicio||null;r.fin=doc.fin||null; }
      var ultimo=new Date(Number(periodo.slice(0,4)),Number(periodo.slice(5,7)),0).getDate();
      r.estado=doc.fuente==='CUBOS' && f.estado==='CATEGORIAS_INCOMPLETAS'?'CATEGORIAS_INCOMPLETAS':
        doc.auditoria && doc.auditoria.filas_identicas>0?'REVISAR_FILAS_IDENTICAS':
        doc.corte.slice(0,7)===periodo && Number(doc.corte.slice(8))<ultimo?'CORTE_PARCIAL':'REVISION';
      if(doc.auditoria && doc.auditoria.corte_confirmado===false){r.corte=null;r.estado='CORTE_DESCONOCIDO';}
      salida[doc.fuente==='NOMINAL'?'nominal':doc.fuente==='CUBOS'?'cubos':'sinba'].push(r);
      aporta=true;
    });
    if (aporta) salida.fuentes.push({fuente:doc.fuente,ambito:doc.ambito,corte:doc.auditoria&&doc.auditoria.corte_confirmado===false?null:doc.corte,sha256:doc.sha256});
  });
  unidades.forEach(function(u) {
    ['AUDIT','FAGERSTROM','DROGAS'].forEach(function(instrumento) {
      var nn=salida.nominal.filter(function(f) { return f.unidad_id===u && f.instrumento===instrumento; });
      var cc=salida.cubos.filter(function(f) { return f.unidad_id===u && f.instrumento===instrumento; });
      var nominal=nn.length?nn.reduce(function(t,f) { return t+f.total; },0):null;
      var cubo=cc.length?cc[0].total:null, estado='PENDIENTE';
      if (nominal!==null && cubo!==null) {
        if (nn.some(function(f) { return f.corte!==cc[0].corte || f.estado==='CORTE_PARCIAL'; }) || cc[0].estado==='CORTE_PARCIAL') estado='CORTES_NO_COMPARABLES';
        else if (cc[0].estado==='CATEGORIAS_INCOMPLETAS' || nn.some(function(f) { return f.estado==='REVISAR_FILAS_IDENTICAS'; })) estado='REVISAR_FUENTE';
        else estado=nominal===cubo?'COINCIDENCIA_OBSERVADA':'DIFERENCIA_OBSERVADA';
      }
      salida.comparacion.push({periodo:periodo,unidad_id:u,instrumento:instrumento,nominal:nominal,cubos:cubo,estado:estado});
    });
  });
  return salida;
}

function leerFuentesPreventivas_(periodo, unidades) {
  var id=prop_('ID_CARPETA_FUENTES_PREVENTIVAS','');
  if (!id) throw errorConCodigo_('FUENTE_PENDIENTE','Falta configurar la carpeta privada de fuentes mensuales.');
  var it=DriveApp.getFolderById(id).getFiles(), documentos=[], archivos=0, bytes=0;
  while(it.hasNext()) {
    var f=it.next();
    if (!/^(NOMINAL|CUBOS|SINBA)_[A-Za-z0-9_-]+_20\d\d-\d\d-\d\d_[a-f0-9]{16}\.json$/.test(f.getName())) continue;
    archivos++;bytes+=f.getSize();
    if (archivos>100 || bytes>15*1024*1024 || f.getSize()>5*1024*1024) throw errorConCodigo_('FUENTE_GRANDE','Archivar cortes antiguos fuera de la carpeta activa.');
    try { documentos.push(JSON.parse(f.getBlob().getDataAsString('UTF-8'))); }
    catch(e) { throw errorConCodigo_('FUENTE_INCOMPATIBLE','Un corte agregado no es JSON válido.'); }
  }
  try { return seleccionarFuentesPreventivas(documentos,periodo,unidades.map(function(u) { return u.id; })); }
  catch(e) { throw errorConCodigo_('FUENTE_INCOMPATIBLE',e.message); }
}
