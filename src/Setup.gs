// Funciones para correr A MANO desde el editor de Apps Script. Ninguna se
// llama desde la API.

// Función en vez de var: setupDatabase() es la única que la usa, y así
// Setup.gs no depende de en qué orden cargue Apps Script los archivos .gs.
function _esquema() {
  return [
    [HOJAS.CONFIG, ['clave', 'valor']],
    [HOJAS.COORDINACIONES, ['coordinacion_id', 'nombre', 'municipio_principal', 'activo', 'orden']],
    [HOJAS.UNIDADES, ['unidad_id', 'clues', 'nombre_unidad', 'municipio', 'coordinacion_id',
                      'responsable', 'activo']],
    [HOJAS.USUARIOS, ['usuario', 'nombre', 'rol', 'coordinacion_id', 'sal', 'huella', 'activo']],
    [HOJAS.DESTINOS, ['destino_id', 'nombre', 'apartado', 'clase', 'url', 'aplica_a',
                      'param_identidad', 'valor_identidad', 'sonda', 'orden', 'activo']],
    [HOJAS.AUDITORIA, ['timestamp', 'usuario', 'accion', 'detalle']]
  ];
}

var CONFIG_INICIAL = [
  ['jurisdiccion', 'JURISDICCIÓN SANITARIA XIX TEXCOCO'],
  ['anio_activo', 2026],
  ['mes_activo', 9]
];

function setupDatabase() {
  var ss = SpreadsheetApp.getActive();
  _esquema().forEach(function (par) {
    var nombre = par[0], encabezados = par[1];
    if (ss.getSheetByName(nombre)) {
      Logger.log(nombre + ' — ya existía');
      return;
    }
    var hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold');
    hoja.setFrozenRows(1);
    Logger.log(nombre + ' — creada');
  });

  if (!leerTabla(HOJAS.CONFIG).length) {
    escribirFilas(HOJAS.CONFIG, CONFIG_INICIAL.map(function (p) { return { clave: p[0], valor: p[1] }; }));
    invalidarCatalogo(HOJAS.CONFIG);
    Logger.log('CONFIG — cargada');
  }
}

function _parseCsv(texto) {
  var lineas = texto.trim().split('\n');
  var encabezados = lineas[0].split(',');
  return lineas.slice(1).map(function (linea) {
    var celdas = _dividirLinea(linea);
    var obj = {};
    encabezados.forEach(function (h, i) { obj[h.trim()] = (celdas[i] || '').trim(); });
    return obj;
  });
}

// Divide respetando comillas.
function _dividirLinea(linea) {
  var celdas = [], actual = '', dentro = false;
  for (var i = 0; i < linea.length; i++) {
    var c = linea.charAt(i);
    if (c === '"') { dentro = !dentro; continue; }
    if (c === ',' && !dentro) { celdas.push(actual); actual = ''; continue; }
    actual += c;
  }
  celdas.push(actual);
  return celdas;
}

// Catalogos.generado.gs es la fuente: para corregir una coordinación o una
// unidad se corrige DIRECTORIO.xlsx, se regenera y se vuelve a copiar.
function cargarUniverso() {
  reemplazarFilas(HOJAS.COORDINACIONES, _parseCsv(CSV_COORDINACIONES));
  reemplazarFilas(HOJAS.UNIDADES, _parseCsv(CSV_UNIDADES));
  invalidarCatalogo(HOJAS.COORDINACIONES);
  invalidarCatalogo(HOJAS.UNIDADES);
  Logger.log('universo cargado');
}

function verificarCatalogos() {
  var coords = leerTabla(HOJAS.COORDINACIONES);
  var unidades = leerTabla(HOJAS.UNIDADES);
  var ids = {};
  coords.forEach(function (c) { ids[c.coordinacion_id] = true; });
  Logger.log(coords.length + ' coordinaciones');
  Logger.log(unidades.length + ' unidades');
  Logger.log(unidades.filter(function (u) { return !ids[u.coordinacion_id]; }).length +
             ' unidades huérfanas');
}

// Crea una cuenta por coordinación. CORRERLA DE NUEVO NO reactiva una baja:
// si una cuenta ya existía, conserva su `activo` tal como estaba (una fila
// nueva sí nace activa). Como la contraseña se deriva del usuario
// (Usuarios.gs), no cambia entre corridas salvo que cambie el nombre de la
// coordinación.
function crearCuentasDeCoordinaciones() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.USUARIOS);
  if (!hoja) throw new Error('Falta la hoja USUARIOS. Ejecute setupDatabase() primero.');

  // escribirFilas mapea por encabezado y descarta en silencio lo que no
  // encuentra: con encabezados viejos, las cuentas quedarían sin huella.
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  ['usuario', 'nombre', 'sal', 'huella', 'rol', 'coordinacion_id', 'activo'].forEach(function (c) {
    if (encabezados.indexOf(c) === -1) {
      throw new Error('La hoja USUARIOS no tiene la columna "' + c + '".');
    }
  });

  var coords = leerTabla(HOJAS.COORDINACIONES).filter(function (c) { return esVerdadero(c.activo); });
  if (!coords.length) throw new Error('No hay coordinaciones cargadas. Ejecute cargarUniverso() primero.');

  // Dos coordinaciones con el mismo usuario dejarían a una sin acceso.
  var vistos = {}, choques = [];
  coords.forEach(function (c) {
    var usuario = usuarioDeCoordinacion(c.nombre);
    if (vistos[usuario]) choques.push(usuario + ' (' + vistos[usuario] + ' / ' + c.nombre + ')');
    vistos[usuario] = c.nombre;
  });
  if (choques.length) throw new Error('Coordinaciones con el mismo usuario: ' + choques.join(', '));

  // Cuentas actuales por usuario, para no resucitar una baja: si ya existía
  // y su activo no era un sí explícito, se conserva tal cual.
  var actuales = {};
  leerTabla(HOJAS.USUARIOS).forEach(function (f) {
    actuales[String(f.usuario || '').trim().toLowerCase()] = f;
  });

  var vistosAhora = {};
  var filas = coords.map(function (c) {
    var usuario = usuarioDeCoordinacion(c.nombre);
    vistosAhora[usuario] = true;
    var previa = actuales[usuario];
    var sal = generarSal();
    var activo = previa ? previa.activo : 'TRUE';
    if (previa) {
      if (!esVerdadero(activo)) Logger.log('se conserva la baja de ' + usuario);
    } else {
      Logger.log('cuenta nueva: ' + usuario);
    }
    return { usuario: usuario, nombre: c.nombre, rol: 'COORDINACION',
             coordinacion_id: c.coordinacion_id, sal: sal,
             huella: huellaContrasena(sal, contrasenaDeUsuario(usuario)), activo: activo };
  });

  Object.keys(actuales).forEach(function (usuario) {
    if (!vistosAhora[usuario]) Logger.log('cuenta eliminada: ' + usuario);
  });

  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);

  Logger.log('=== La contraseña de cada quien es su usuario + "26" (chiautla / chiautla26) ===');
  filas.forEach(function (f) { Logger.log(f.usuario + '  ' + contrasenaDeUsuario(f.usuario) + '   ' + f.nombre); });
  Logger.log('=== ' + filas.length + ' cuentas creadas ===');
}

// Para correr desde el botón Ejecutar: una baja en USUARIOS surte efecto al
// instante en vez de esperar a que venza la caché de 30 minutos.
function invalidarCacheDeUsuarios() {
  invalidarCatalogo(HOJAS.USUARIOS);
  Logger.log('caché de USUARIOS invalidada');
}

// Da una sal nueva a UNA cuenta sin tocar las demás. La contraseña sigue
// siendo usuario + '26'; esto sirve si la huella se corrompió.
function restablecerContrasena(nombreUsuario) {
  var filas = leerTabla(HOJAS.USUARIOS);
  var fila = _buscarUsuario(filas, nombreUsuario);
  if (!fila) {
    throw new Error('No existe el usuario "' + nombreUsuario + '". Usuarios: ' +
                    filas.map(function (f) { return f.usuario; }).join(', '));
  }
  fila.sal = generarSal();
  fila.huella = huellaContrasena(fila.sal, contrasenaDeUsuario(fila.usuario));
  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);
  registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'RESTABLECER_CONTRASENA',
                  fila.usuario);
  Logger.log(fila.usuario + '  ' + contrasenaDeUsuario(fila.usuario) + '   ' + fila.nombre);
}

// Sin argumento, solo crea el secreto si no existe. Con `true` lo reemplaza:
// eso invalida TODOS los boletos emitidos y obliga a las 22 a volver a
// entrar. En la Fase 2, cada hermano tendrá que recibir el secreto nuevo.
function generarSecretoDeBoletos(forzar) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROPIEDAD_SECRETO) && forzar !== true) {
    Logger.log('SECRETO_BOLETOS ya existe; no se cambió. Para rotarlo: generarSecretoDeBoletos(true)');
    return;
  }
  var secreto = generarSal() + generarSal();   // 64 caracteres hexadecimales
  props.setProperty(PROPIEDAD_SECRETO, secreto);
  if (forzar === true) {
    registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'ROTAR_SECRETO', '');
  }
  Logger.log('SECRETO_BOLETOS ' + (forzar === true ? 'rotado' : 'creado'));
}

// Revisa la hoja DESTINOS y dice qué filas no sirven y por qué. Correrla
// después de agregar o editar un destino.
function verificarDestinos() {
  var filas = leerTabla(HOJAS.DESTINOS);
  var ids = {};
  filas.forEach(function (d, i) {
    var p = problemasDeDestino(d);
    var id = String(d.destino_id || '').trim();
    if (id && ids[id]) p.push('destino_id repetido');
    ids[id] = true;
    Logger.log('fila ' + (i + 2) + ' ' + (id || '(sin id)') + ': ' + (p.length ? p.join('; ') : 'bien'));
  });
  invalidarCatalogo(HOJAS.DESTINOS);
  Logger.log(filas.length + ' destinos revisados');
}

// Los capturadores que ya saben recibir a la máscara. Correr desde el botón
// Ejecutar: agrega solo las filas que falten (compara por destino_id) y no
// toca las que ya existan, aunque se hayan editado a mano en la hoja.
var DESTINOS_CONOCIDOS = [
  { destino_id: 'determinantes', nombre: 'Talleres por Determinantes', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://script.google.com/macros/s/AKfycbzpwr_wfBevrI-UkrUSvrFOXwXKu2qqGCL_OQWa5uZ3DGivT7CSM3h7SEDsRLH8_sOP/exec',
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 1, activo: 'TRUE' },
  { destino_id: 'mensual_coordinacion', nombre: 'Reporte Mensual de Coordinación', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://script.google.com/macros/s/AKfycbziZ5yNV_uqGtnkXIprgvT4FyijVI6DojPQ39HQ4VBkIW7jcVwQ2qod-AT1HHUxu6AYog/exec',
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 2, activo: 'TRUE' },
  // SIPS no tiene acceso: cualquiera elige cualquier coordinación. El nombre
  // solo la deja preseleccionada; por eso va en claro y no se verifica boleto.
  { destino_id: 'sips', nombre: 'SIPS — Fechas a Conmemorar', apartado: 'Reporte mensual',
    clase: 'HERMANO_SIN_CONTRASENA',
    url: 'https://script.google.com/macros/s/AKfycbxiwICPr2ZpBUtKgFudTdLhzctrGnuQmSRZlIuSYd-t-oSJTQU74fi7yjsV4fMlkyqL/exec',
    aplica_a: 'TODAS', param_identidad: 'coordinacion', valor_identidad: 'NOMBRE', sonda: 'NATIVA', orden: 3, activo: 'TRUE' },
  { destino_id: 'actividad_fisica', nombre: 'Reporte de Actividad Física', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://script.google.com/macros/s/AKfycby-mX_9mqg4rBXYb9uPj9bJHuVao8D2JCByOpqkup9Q2_lvMOpnLT7GTvKgekSEAs6I/exec',
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 4, activo: 'TRUE' }
];

function sembrarDestinosConocidos() {
  var existentes = {};
  leerTabla(HOJAS.DESTINOS).forEach(function (d) { existentes[String(d.destino_id).trim()] = true; });
  var faltan = DESTINOS_CONOCIDOS.filter(function (d) { return !existentes[d.destino_id]; });
  if (faltan.length) escribirFilas(HOJAS.DESTINOS, faltan);
  Logger.log(faltan.length ? 'agregados: ' + faltan.map(function (d) { return d.destino_id; }).join(', ')
                           : 'no faltaba ninguno');
  verificarDestinos();
}

// Correr desde el botón Ejecutar cuando un capturador empiece a contestar
// sondas: copia la columna `sonda` de DESTINOS_CONOCIDOS a las filas que ya
// existen en DESTINOS, sin tocar ninguna otra columna.
function activarSondasConocidas() {
  var esperada = {};
  DESTINOS_CONOCIDOS.forEach(function (d) { esperada[d.destino_id] = d.sonda; });
  var filas = leerTabla(HOJAS.DESTINOS);
  var cambiadas = [];
  filas.forEach(function (d) {
    var id = String(d.destino_id).trim();
    if (esperada[id] && String(d.sonda).trim() !== esperada[id]) {
      d.sonda = esperada[id];
      cambiadas.push(id + ' -> ' + esperada[id]);
    }
  });
  if (cambiadas.length) reemplazarFilas(HOJAS.DESTINOS, filas);
  invalidarCatalogo(HOJAS.DESTINOS);
  Logger.log(cambiadas.length ? 'sondas: ' + cambiadas.join(', ') : 'no había nada que cambiar');
  verificarDestinos();
}
