var HOJAS = {
  CONFIG: 'CONFIG',
  COORDINACIONES: 'CAT_COORDINACIONES',
  UNIDADES: 'CAT_UNIDADES',
  USUARIOS: 'USUARIOS',
  DESTINOS: 'DESTINOS',
  PERSONAL: 'PERSONAL',
  AUDITORIA: 'AUDITORIA'
};

var PROPIEDAD_SECRETO = 'SECRETO_BOLETOS';

// Perfil de la cuenta (columna `rol` de USUARIOS). Las coordinaciones son
// cuentas compartidas; los demás perfiles son cuentas de persona.
var ROLES = {
  COORDINACION: 'COORDINACION',
  NUTRICION: 'NUTRICION',
  PSICOLOGIA: 'PSICOLOGIA',
  PROMOTOR: 'PROMOTOR'
};

// Rol vacío = coordinación: las cuentas creadas antes de la fase 7 no lo
// distinguían y todas eran de coordinación.
function rolDeCuenta(fila) {
  var rol = String((fila && fila.rol) || '').trim().toUpperCase();
  return rol || ROLES.COORDINACION;
}

// Una cuenta sirve solo con un rol conocido. Rol vacío vale como coordinación
// únicamente si tampoco tiene unidad: con unidad_id es una persona a la que
// se le borró el rol, y no debe entrar viendo lo de su coordinación.
function cuentaConRolValido(fila) {
  if (!fila) return false;
  if (!String(fila.rol || '').trim()) return !String(fila.unidad_id || '').trim();
  return Object.prototype.hasOwnProperty.call(ROLES, rolDeCuenta(fila));
}

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
