var HOJAS = {
  CONFIG: 'CONFIG',
  COORDINACIONES: 'CAT_COORDINACIONES',
  UNIDADES: 'CAT_UNIDADES',
  USUARIOS: 'USUARIOS',
  DESTINOS: 'DESTINOS',
  PERSONAL: 'PERSONAL',
  FECHAS_NACIMIENTO: 'FECHAS_NACIMIENTO',
  AUDITORIA: 'AUDITORIA'
};

var PROPIEDAD_SECRETO = 'SECRETO_BOLETOS';

// Perfil de la cuenta (columna `rol` de USUARIOS). Las coordinaciones son
// cuentas compartidas; los demás perfiles son cuentas de persona.
var ROLES = {
  COORDINACION: 'COORDINACION',
  NUTRICION: 'NUTRICION',
  PSICOLOGIA: 'PSICOLOGIA',
  PROMOTOR: 'PROMOTOR',
  // La jurisdicción: tablero y "ver como" (Admin.gs). Sin capturadores propios.
  ADMIN: 'ADMIN'
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

// Mismo criterio que Determinantes (Periodos.gs): desde el día `diaApertura`
// (22 por omisión) ya cuenta el mes en curso; antes, el anterior. CONFIG
// (anio_activo / mes_activo) puede adelantar el mes, nunca atrasarlo.
var DIA_APERTURA_POR_OMISION = 22;

function periodoVigente(fecha, diaApertura, anioConfig, mesConfig) {
  var dia = parseInt(diaApertura, 10);
  if (!(dia >= 1 && dia <= 28)) dia = DIA_APERTURA_POR_OMISION;
  var anio = fecha.getFullYear();
  var mes = fecha.getMonth() + 1;
  if (fecha.getDate() < dia) {
    mes -= 1;
    if (mes === 0) { mes = 12; anio -= 1; }
  }
  var a = parseInt(anioConfig, 10), m = parseInt(mesConfig, 10);
  if (a > 0 && m >= 1 && m <= 12 && a * 100 + m > anio * 100 + mes) {
    anio = a; mes = m;
  }
  return { anio: anio, mes: mes };
}

function periodoActual() {
  return periodoVigente(new Date(), getConfig('dia_apertura'),
                        getConfig('anio_activo'), getConfig('mes_activo'));
}

// El secreto no vive en la hoja: quien pueda leer la hoja no debe poder
// fabricar boletos. Se crea con generarSecretoDeBoletos() (Setup.gs).
function secretoDeBoletos() {
  var s = PropertiesService.getScriptProperties().getProperty(PROPIEDAD_SECRETO);
  if (!s) throw new Error('SIN_SECRETO: ejecute generarSecretoDeBoletos() en el editor.');
  return s;
}
