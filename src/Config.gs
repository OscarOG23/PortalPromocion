var HOJAS = {
  CONFIG: 'CONFIG',
  COORDINACIONES: 'CAT_COORDINACIONES',
  UNIDADES: 'CAT_UNIDADES',
  USUARIOS: 'USUARIOS',
  DESTINOS: 'DESTINOS',
  AUDITORIA: 'AUDITORIA'
};

var PROPIEDAD_SECRETO = 'SECRETO_BOLETOS';

function getConfig(clave) {
  var filas = leerCatalogo(HOJAS.CONFIG);
  for (var i = 0; i < filas.length; i++) {
    if (filas[i].clave === clave) return filas[i].valor;
  }
  return null;
}

// El secreto no vive en la hoja: quien pueda leer la hoja no debe poder
// fabricar boletos. Se crea con generarSecretoDeBoletos() (Setup.gs).
function secretoDeBoletos() {
  var s = PropertiesService.getScriptProperties().getProperty(PROPIEDAD_SECRETO);
  if (!s) throw new Error('SIN_SECRETO: ejecute generarSecretoDeBoletos() en el editor.');
  return s;
}
