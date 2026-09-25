// El usuario sale del nombre de la coordinación: 'CEAPS SANTA ROSA' da
// 'ceapssantarosa'. Se quitan acentos, espacios y signos porque este texto se
// teclea en un celular y se dicta por teléfono.
function usuarioDeCoordinacion(nombre) {
  return sinAcentos(String(nombre))
           .toLowerCase()
           .replace(/[^a-z0-9]/g, '');
}

// La contraseña es el usuario con '26' al final. Es DEDUCIBLE a propósito, por
// decisión explícita del usuario (2026-09-21), la misma que en Determinantes.
//
// Aquí pesa más que allá, y quedó dicho al decidir: la máscara se sirve desde
// GitHub Pages, que es público, así que ya no existe la barrera de "no
// publicar la URL". Quien sepa el nombre de una coordinación y encuentre la
// página entra como ella a TODOS sus capturadores.
//
// Para endurecerla basta cambiar esta función, correr
// crearCuentasDeCoordinaciones() y repartir las nuevas: nada más depende de
// cómo se forma la contraseña.
function contrasenaDeUsuario(usuario) {
  return usuario + '26';
}

// --- Cuentas de persona (fase 7) -------------------------------------------
// Nutriólogos, psicólogos y (después) promotores tienen cuenta propia. Aquí
// hay datos de salud mental: su contraseña NO es deducible, es aleatoria.

var ROLES_DE_PERSONA = ['NUTRICION', 'PSICOLOGIA', 'PROMOTOR'];

// Una CLUES son 5 letras y 6 dígitos (MCSSA001904). En los padrones a veces
// se teclea una O por un 0 en la parte numérica: MCIMBO99999 es MCIMB099999.
function normalizarClues(s) {
  var c = String(s || '').toUpperCase().replace(/\s+/g, '');
  return c.slice(0, 5) + c.slice(5).replace(/O/g, '0');
}

// Títulos que los padrones ponen antes del nombre. 'LIC' y 'PSIC' sin punto
// solo cuentan si les sigue un espacio: 'LICONA' es un apellido.
var _TITULO = /^\s*(L\.\s*N\.|LIC\.|LIC\s|PSIC\.|PSIC\s|MTR[OA]\.|DRA?\.)\s*/i;

function sinTitulo(nombre) {
  var s = String(nombre || '');
  while (_TITULO.test(s)) s = s.replace(_TITULO, '');
  return s.replace(/\s+/g, ' ').trim();
}

// Clave para reconocer a una persona aunque el padrón cambie títulos,
// acentos o espacios.
function _claveDePersona(nombre) {
  return sinAcentos(sinTitulo(nombre)).toUpperCase();
}

var _PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y'];

// Inicial del primer nombre + primer apellido + inicial del segundo, sin
// acentos y en minúsculas: 'ANA PÉREZ LÓPEZ' da 'aperezl'. Se suponen
// apellidos las DOS ÚLTIMAS palabras; las partículas (de, la…) se pegan a la
// palabra que sigue: 'JUAN DE LA PEÑA SOTO' da 'jdelapenas'.
// `existentes` (opcional): usuarios ya tomados; si choca, se agrega 2, 3…
function usuarioDePersona(nombre, existentes) {
  var palabras = sinAcentos(sinTitulo(nombre)).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
                   .split(' ').filter(function (p) { return p; });
  var grupos = [], pendiente = '';
  palabras.forEach(function (p) {
    if (_PARTICULAS.indexOf(p) !== -1) { pendiente += p; return; }
    grupos.push(pendiente + p);
    pendiente = '';
  });
  if (pendiente) {
    if (grupos.length) grupos[grupos.length - 1] += pendiente; else grupos.push(pendiente);
  }
  var base;
  if (grupos.length >= 3) {
    base = grupos[0].charAt(0) + grupos[grupos.length - 2] + grupos[grupos.length - 1].charAt(0);
  } else if (grupos.length === 2) {
    base = grupos[0].charAt(0) + grupos[1];
  } else {
    base = grupos[0] || '';
  }
  var tomados = {};
  (existentes || []).forEach(function (u) { tomados[String(u).trim().toLowerCase()] = true; });
  var usuario = base, n = 1;
  while (tomados[usuario]) usuario = base + (++n);
  return usuario;
}

// Prefijos que se quitan de AMBOS lados solo si el nombre exacto no cruzó.
// COL. (colonia) también: 'SANTA ROSA' no debe caer en 'CEAPS SANTA ROSA'
// habiendo una 'COL.SANTA ROSA'.
var _PREFIJOS_UNIDAD = ['CENTRO DE SALUD URBANO', 'CENTRO DE SALUD', 'CEAPS', 'CSU', 'CS',
                        'UNIDAD', 'COLONIA', 'COL'];

// Sin acentos, mayúsculas, sin puntos ('C.E.A.P.S.' queda 'CEAPS'), otros
// signos por espacio, espacios colapsados.
function _nombreDeUnidad(s) {
  return sinAcentos(String(s || '')).toUpperCase().replace(/\./g, ' . ')
           .replace(/(^|\s)((?:[A-Z]\s\.\s)+)/g, function (m, ini, siglas) {
             return ini + siglas.replace(/[\s.]/g, '') + ' ';
           })
           .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function _sinPrefijos(nombre) {
  var s = nombre, cambio = true;
  while (cambio) {
    cambio = false;
    for (var i = 0; i < _PREFIJOS_UNIDAD.length; i++) {
      var p = _PREFIJOS_UNIDAD[i];
      if (s.indexOf(p + ' ') === 0) { s = s.slice(p.length + 1); cambio = true; break; }
    }
  }
  return s;
}

// fila = { unidad, clues } de PERSONAL. Cruza por CLUES normalizada; si no,
// por nombre EXACTO (normalizado); si no, por nombre exacto sin prefijos.
// Nunca por subcadena. Ambigua o sin cruce: null (la cuenta no se crea).
function unidadDePersona(fila, unidades) {
  var activas = (unidades || []).filter(function (u) { return esVerdadero(u.activo); });
  var clues = normalizarClues(fila && fila.clues);
  if (clues) {
    var porClues = activas.filter(function (u) { return normalizarClues(u.clues) === clues; });
    if (porClues.length === 1) return porClues[0];
  }
  var nombre = _nombreDeUnidad(fila && fila.unidad);
  if (!nombre) return null;
  var exactas = activas.filter(function (u) { return _nombreDeUnidad(u.nombre_unidad) === nombre; });
  if (exactas.length) return exactas.length === 1 ? exactas[0] : null;
  var corto = _sinPrefijos(nombre);
  var sinPref = activas.filter(function (u) {
    return _sinPrefijos(_nombreDeUnidad(u.nombre_unidad)) === corto;
  });
  return sinPref.length === 1 ? sinPref[0] : null;
}

var _ALFABETO_CONTRASENA = 'abcdefghjkmnpqrstuvwxyz23456789';
var LARGO_CONTRASENA = 10;

// Los 14 bytes de verdad aleatorios de un UUID v4 (Utilities.getUuid usa un
// generador seguro; Math.random no lo es). Se saltan el 6 y el 8, que llevan
// los bits fijos de versión y variante.
function _bytesDeUuid() {
  var hex = Utilities.getUuid().replace(/-/g, '');
  var bytes = [];
  for (var i = 0; i < 16; i++) {
    if (i === 6 || i === 8) continue;
    bytes.push(parseInt(hex.substr(i * 2, 2), 16));
  }
  return bytes;
}

// azar(n) en [0, n) sin sesgo: se descartan los bytes >= el mayor múltiplo de
// n que cabe en 256 (248 para el alfabeto de 31).
function _azarSeguro() {
  var bytes = [];
  return function (n) {
    var limite = Math.floor(256 / n) * n;
    for (;;) {
      if (!bytes.length) bytes = _bytesDeUuid();
      var b = bytes.shift();
      if (b < limite) return b % n;
    }
  };
}

// azar(n) devuelve un entero en [0, n); se inyecta en las pruebas.
function contrasenaAleatoria(azar) {
  var f = azar || _azarSeguro();
  var s = '';
  for (var i = 0; i < LARGO_CONTRASENA; i++) {
    s += _ALFABETO_CONTRASENA.charAt(f(_ALFABETO_CONTRASENA.length));
  }
  return s;
}

// Decide, sin tocar hojas, qué cuentas de persona crear. Una persona ya
// tiene cuenta si existe una con su nombre (sin título ni acentos) y su rol.
// Devuelve { crear: [{usuario, nombre, rol, coordinacion_id, unidad_id,
// unidad, contrasena}], problemas: [{fila, nombre, motivo}] } donde `fila` es
// el renglón de la hoja PERSONAL (el 1 es el encabezado).
function planDeCuentasDePersonal(filasPersonal, usuariosExistentes, unidades, azar) {
  var yaTiene = {}, tomados = [];
  (usuariosExistentes || []).forEach(function (u) {
    tomados.push(String(u.usuario || ''));
    yaTiene[_claveDePersona(u.nombre) + '|' + rolDeCuenta(u)] = true;
  });
  var crear = [], problemas = [];
  (filasPersonal || []).forEach(function (f, i) {
    var renglon = i + 2;
    if (!esVerdadero(f.activo)) return;
    var nombre = sinTitulo(f.nombre);
    var rol = String(f.rol || '').trim().toUpperCase();
    function problema(motivo) { problemas.push({ fila: renglon, nombre: nombre, motivo: motivo }); }
    if (!nombre) return problema('falta el nombre');
    if (ROLES_DE_PERSONA.indexOf(rol) === -1) return problema('rol inválido: "' + f.rol + '"');
    var clave = _claveDePersona(nombre) + '|' + rol;
    if (yaTiene[clave]) {
      // Ya tenía cuenta antes de esta corrida: no es problema. Repetida en la
      // misma hoja, sí.
      if (yaTiene[clave] === 'plan') problema('persona repetida en PERSONAL');
      return;
    }
    if (!usuarioDePersona(nombre)) return problema('nombre sin letras');
    var unidad = unidadDePersona(f, unidades);
    if (!unidad) return problema('la unidad no cruza con el catálogo: "' + (f.unidad || '') +
                                 '" / CLUES "' + (f.clues || '') + '"');
    var usuario = usuarioDePersona(nombre, tomados);
    tomados.push(usuario);
    yaTiene[clave] = 'plan';
    crear.push({ usuario: usuario, nombre: nombre, rol: rol, coordinacion_id: unidad.coordinacion_id,
                 unidad_id: unidad.unidad_id, unidad: unidad.nombre_unidad,
                 contrasena: contrasenaDeUsuario(usuario) });
  });
  return { crear: crear, problemas: problemas };
}
