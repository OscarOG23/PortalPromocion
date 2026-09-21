// El directorio de destinos es una HOJA, no código: agregar un capturador
// nuevo es agregar una fila en DESTINOS. Todo lo de aquí es puro y recibe las
// filas ya leídas.

var CLASES_DESTINO = {
  CON_CONTRASENA: 'HERMANO_CON_CONTRASENA',
  SIN_CONTRASENA: 'HERMANO_SIN_CONTRASENA',
  FORMULARIO: 'FORMULARIO'
};

var ESTADOS = { REPORTADO: 'REPORTADO', PENDIENTE: 'PENDIENTE', NO_SE_SABE: 'NO_SE_SABE' };

var VALORES_IDENTIDAD = ['', 'NOMBRE', 'ID', 'USUARIO'];

// Las sondas de avance se registran aquí por nombre (columna `sonda`). En la
// Fase 1 no hay ninguna: todo destino sale gris. Cada sonda recibe
// (destino, coordinacion, anio, mes) y devuelve { ok, reportado }.
var SONDAS = {};

// Vacío no aplica a nadie: una celda olvidada deja un destino fuera, nunca
// se lo muestra a las 22 coordinaciones por accidente.
function _aplicaA(destino, coordinacionId) {
  var lista = String(destino.aplica_a || '').trim();
  if (lista.toUpperCase() === 'TODAS') return true;
  return lista.split(',').map(function (s) { return s.trim(); })
              .indexOf(coordinacionId) !== -1;
}

function destinosDeCoordinacion(filas, coordinacionId) {
  return filas
    .filter(function (d) { return esVerdadero(d.activo) && _aplicaA(d, coordinacionId); })
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); });
}

// Lista de lo que está mal en una fila, en palabras. Vacía = fila utilizable.
// La usa verificarDestinos() para avisar a quien edita la hoja, y
// enlaceDeDestino para no armar un enlace roto.
function problemasDeDestino(d) {
  var p = [];
  var clase = d.clase;
  var param = String(d.param_identidad || '').trim();
  if (!String(d.destino_id || '').trim()) p.push('falta destino_id');
  var clases = [CLASES_DESTINO.CON_CONTRASENA, CLASES_DESTINO.SIN_CONTRASENA, CLASES_DESTINO.FORMULARIO];
  if (clases.indexOf(clase) === -1) p.push('clase desconocida: "' + clase + '"');
  if (String(d.url || '').indexOf('https://') !== 0) p.push('la url debe empezar con https://');
  if (clase === CLASES_DESTINO.FORMULARIO) {
    if (!param) p.push('un formulario necesita param_identidad (entry.<id>)');
    else if (!/^entry\.\d+$/.test(param)) p.push('param_identidad de formulario debe ser entry.<número>');
  }
  if (clase === CLASES_DESTINO.SIN_CONTRASENA && !param) {
    p.push('un hermano sin contraseña necesita param_identidad');
  }
  if (VALORES_IDENTIDAD.indexOf(String(d.valor_identidad || '').trim().toUpperCase()) === -1) {
    p.push('valor_identidad debe ser NOMBRE, ID o USUARIO');
  }
  return p;
}

function _valorDeIdentidad(destino, coordinacion) {
  var tipo = String(destino.valor_identidad || '').trim().toUpperCase();
  if (tipo === 'ID') return coordinacion.coordinacion_id;
  if (tipo === 'USUARIO') return coordinacion.usuario;
  return coordinacion.nombre;
}

function _conParametros(url, pares) {
  var q = pares.map(function (p) {
    return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]);
  }).join('&');
  return url + (url.indexOf('?') === -1 ? '?' : '&') + q;
}

// coordinacion = { coordinacion_id, nombre, usuario }. El boleto va vacío
// para los formularios: un Google Form no sabría qué hacer con él.
function enlaceDeDestino(destino, coordinacion, boleto) {
  if (problemasDeDestino(destino).length) return null;
  var url = String(destino.url).trim();
  var param = String(destino.param_identidad || '').trim();
  var valor = _valorDeIdentidad(destino, coordinacion);
  if (destino.clase === CLASES_DESTINO.FORMULARIO) {
    return _conParametros(url, [['usp', 'pp_url'], [param, valor]]);
  }
  if (destino.clase === CLASES_DESTINO.SIN_CONTRASENA) {
    return _conParametros(url, [['boleto', boleto], [param, valor]]);
  }
  return _conParametros(url, [['boleto', boleto]]);
}

// Regla dura: nada se pinta de verde por falta de datos. Solo un `true`
// literal cuenta como reportado; 'true', 1 o un campo ausente no.
function estadoDeSonda(respuesta) {
  if (!respuesta || respuesta.ok !== true) return ESTADOS.NO_SE_SABE;
  if (respuesta.reportado === true) return ESTADOS.REPORTADO;
  if (respuesta.reportado === false) return ESTADOS.PENDIENTE;
  return ESTADOS.NO_SE_SABE;
}

function consultarSonda(sonda) {
  try {
    return estadoDeSonda(sonda());
  } catch (e) {
    return ESTADOS.NO_SE_SABE;
  }
}

function estadoDeDestino(destino, coordinacion, anio, mes, sondas) {
  var registro = sondas || SONDAS;
  var nombre = String(destino.sonda || '').trim();
  if (!Object.prototype.hasOwnProperty.call(registro, nombre)) return ESTADOS.NO_SE_SABE;
  return consultarSonda(function () { return registro[nombre](destino, coordinacion, anio, mes); });
}
