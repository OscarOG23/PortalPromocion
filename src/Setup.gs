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
    // unidad_id va AL FINAL: agregarla después no mueve ninguna columna.
    [HOJAS.USUARIOS, ['usuario', 'nombre', 'rol', 'coordinacion_id', 'sal', 'huella', 'activo',
                      'unidad_id']],
    [HOJAS.PERSONAL, ['nombre', 'rol', 'unidad', 'clues', 'activo']],
    // url_sonda va AL FINAL, por lo mismo que unidad_id.
    [HOJAS.DESTINOS, ['destino_id', 'nombre', 'apartado', 'clase', 'url', 'aplica_a',
                      'param_identidad', 'valor_identidad', 'sonda', 'orden', 'activo', 'url_sonda']],
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

// Para la hoja USUARIOS que ya existía antes de la fase 7: agrega la columna
// unidad_id al final. Correrla dos veces no hace nada la segunda.
function agregarColumnaUnidadAUsuarios() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.USUARIOS);
  if (!hoja) throw new Error('Falta la hoja USUARIOS. Ejecute setupDatabase() primero.');
  var ultima = hoja.getLastColumn();
  var encabezados = hoja.getRange(1, 1, 1, ultima).getValues()[0];
  if (encabezados.indexOf('unidad_id') !== -1) {
    Logger.log('USUARIOS ya tenía unidad_id; no se cambió nada');
    return;
  }
  hoja.getRange(1, ultima + 1).setValue('unidad_id').setFontWeight('bold');
  invalidarCatalogo(HOJAS.USUARIOS);
  Logger.log('USUARIOS — columna unidad_id agregada');
}

// Para la hoja DESTINOS que ya existía: agrega la columna url_sonda al final
// (vacía en todas las filas). Correrla dos veces no hace nada la segunda.
function agregarColumnaUrlSondaADestinos() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.DESTINOS);
  if (!hoja) throw new Error('Falta la hoja DESTINOS. Ejecute setupDatabase() primero.');
  var ultima = hoja.getLastColumn();
  var encabezados = hoja.getRange(1, 1, 1, ultima).getValues()[0];
  if (encabezados.indexOf('url_sonda') !== -1) {
    Logger.log('DESTINOS ya tenía url_sonda; no se cambió nada');
    return;
  }
  hoja.getRange(1, ultima + 1).setValue('url_sonda').setFontWeight('bold');
  invalidarCatalogo(HOJAS.DESTINOS);
  Logger.log('DESTINOS — columna url_sonda agregada');
}

// escribirFilas descarta en silencio las columnas que la hoja no tiene: sin
// url_sonda, un destino con la pantalla en GitHub Pages quedaría sin sonda.
function _exigirColumnaUrlSonda() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.DESTINOS);
  if (!hoja) throw new Error('Falta la hoja DESTINOS. Ejecute setupDatabase() primero.');
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  if (encabezados.indexOf('url_sonda') === -1) {
    throw new Error('La hoja DESTINOS no tiene la columna "url_sonda". ' +
                    'Ejecute agregarColumnaUrlSondaADestinos() primero.');
  }
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
  // y su activo no era un sí explícito, se conserva tal cual. Las cuentas de
  // persona (fase 7) no son de esta función: se copian intactas.
  var actuales = {}, dePersona = [];
  leerTabla(HOJAS.USUARIOS).forEach(function (f) {
    if (rolDeCuenta(f) !== ROLES.COORDINACION) { dePersona.push(f); return; }
    actuales[String(f.usuario || '').trim().toLowerCase()] = f;
  });
  var choquesConPersona = dePersona.filter(function (f) {
    return vistos[String(f.usuario || '').trim().toLowerCase()];
  }).map(function (f) { return f.usuario; });
  if (choquesConPersona.length) {
    throw new Error('Cuentas de persona con el usuario de una coordinación: ' +
                    choquesConPersona.join(', '));
  }

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
             huella: huellaContrasena(sal, contrasenaDeUsuario(usuario)), activo: activo,
             unidad_id: '' };
  });

  Object.keys(actuales).forEach(function (usuario) {
    if (!vistosAhora[usuario]) Logger.log('cuenta eliminada: ' + usuario);
  });

  reemplazarFilas(HOJAS.USUARIOS, filas.concat(dePersona));
  invalidarCatalogo(HOJAS.USUARIOS);
  if (dePersona.length) Logger.log('se conservaron ' + dePersona.length + ' cuentas de persona');

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

// Da una sal nueva a UNA cuenta sin tocar las demás. La contraseña vuelve a
// ser usuario + '26', igual para coordinaciones y personas (decisión del
// usuario, 2026-09-24: la cuenta solo sirve para capturar, y una contraseña
// difícil sería pretexto para no reportar).
function restablecerContrasena(nombreUsuario) {
  var filas = leerTabla(HOJAS.USUARIOS);
  var fila = _buscarUsuario(filas, nombreUsuario);
  if (!fila) {
    throw new Error('No existe el usuario "' + nombreUsuario + '". Usuarios: ' +
                    filas.map(function (f) { return f.usuario; }).join(', '));
  }
  var contrasena = contrasenaDeUsuario(fila.usuario);
  fila.sal = generarSal();
  fila.huella = huellaContrasena(fila.sal, contrasena);
  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);
  registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'RESTABLECER_CONTRASENA',
                  fila.usuario);
  Logger.log(fila.usuario + '  ' + contrasena + '   ' + fila.nombre);
}

// Crea las cuentas de persona que falten a partir de la hoja PERSONAL
// (nombre, rol, unidad, clues, activo). No toca ninguna cuenta existente ni
// las de coordinación. La contraseña es usuario + '26', como en las
// coordinaciones; el registro lista las cuentas creadas para repartirlas. Lo
// que no cruce con el catálogo se lista y no se crea.
// Pasa TODAS las cuentas de persona a la contraseña sencilla usuario + '26'.
// Para correr una vez desde el editor (las creadas antes del 2026-09-24
// tenían contraseña aleatoria). Lista usuario / contraseña / nombre.
function igualarContrasenasDePersonal() {
  var filas = leerTabla(HOJAS.USUARIOS);
  var cambiadas = [];
  filas.forEach(function (f) {
    if (rolDeCuenta(f) === ROLES.COORDINACION) return;
    var contrasena = contrasenaDeUsuario(f.usuario);
    f.sal = generarSal();
    f.huella = huellaContrasena(f.sal, contrasena);
    cambiadas.push(f.usuario + ' / ' + contrasena + ' / ' + f.nombre + ' (' + rolDeCuenta(f) + ')');
  });
  if (!cambiadas.length) { Logger.log('No hay cuentas de persona.'); return; }
  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);
  registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'IGUALAR_CONTRASENAS',
                  cambiadas.length + ' cuentas de persona');
  Logger.log('=== Cuentas de persona con contraseña usuario + 26 ===');
  cambiadas.forEach(function (c) { Logger.log(c); });
}

function crearCuentasDePersonal() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.USUARIOS);
  if (!hoja) throw new Error('Falta la hoja USUARIOS. Ejecute setupDatabase() primero.');
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  ['usuario', 'nombre', 'rol', 'coordinacion_id', 'sal', 'huella', 'activo', 'unidad_id']
    .forEach(function (c) {
      if (encabezados.indexOf(c) === -1) {
        throw new Error('La hoja USUARIOS no tiene la columna "' + c +
                        '". Ejecute agregarColumnaUnidadAUsuarios() primero.');
      }
    });
  if (!SpreadsheetApp.getActive().getSheetByName(HOJAS.PERSONAL)) {
    throw new Error('Falta la hoja PERSONAL. Ejecute setupDatabase() y pegue el personal.');
  }

  var unidades = leerTabla(HOJAS.UNIDADES);
  if (!unidades.length) throw new Error('No hay unidades cargadas. Ejecute cargarUniverso() primero.');
  var plan = planDeCuentasDePersonal(leerTabla(HOJAS.PERSONAL), leerTabla(HOJAS.USUARIOS), unidades);

  plan.problemas.forEach(function (p) {
    Logger.log('NO SE CREÓ  fila ' + p.fila + '  ' + p.nombre + ': ' + p.motivo);
  });
  if (!plan.crear.length) {
    Logger.log('=== No hay cuentas nuevas que crear (' + plan.problemas.length + ' problemas) ===');
    return;
  }

  escribirFilas(HOJAS.USUARIOS, plan.crear.map(function (c) {
    var sal = generarSal();
    return { usuario: c.usuario, nombre: c.nombre, rol: c.rol, coordinacion_id: c.coordinacion_id,
             sal: sal, huella: huellaContrasena(sal, c.contrasena), activo: 'TRUE',
             unidad_id: c.unidad_id };
  }));
  invalidarCatalogo(HOJAS.USUARIOS);

  Logger.log('=== Cuentas nuevas: usuario / contraseña / nombre / unidad ===');
  plan.crear.forEach(function (c) {
    Logger.log(c.usuario + ' / ' + c.contrasena + ' / ' + c.nombre + ' / ' + c.unidad +
               ' (' + c.rol + ')');
  });
  Logger.log('=== ' + plan.crear.length + ' cuentas creadas, ' + plan.problemas.length +
             ' filas con problema ===');
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
    advertenciasDeDestino(d).forEach(function (a) { Logger.log('    aviso: ' + a); });
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
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 4, activo: 'TRUE' },
  // Solo para cuentas de persona: nutriólogos y psicólogos. La pantalla vive
  // en GitHub Pages (web/atencion/); la sonda sigue en el /exec de Apps Script.
  { destino_id: 'atencion', nombre: 'Informe mensual de Atención', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://oscarog23.github.io/PortalPromocion/atencion/',
    url_sonda: 'https://script.google.com/macros/s/AKfycbz0nx2wMg9Xqm0dhOsv621qXu6F_2fP9hDqMFkrIiFK8T_DAaM4Kgvr6xXxo5Hj1Q6mWA/exec',
    aplica_a: 'ROL:NUTRICION,ROL:PSICOLOGIA', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 5, activo: 'TRUE' }
];

function sembrarDestinosConocidos() {
  _exigirColumnaUrlSonda();
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

// Puro: copia `url` y `url_sonda` de `conocidos` a las filas con el mismo
// destino_id, sin tocar ninguna otra columna ni ninguna otra fila. Cambia
// `filas` en su lugar y devuelve la lista de cambios, en palabras.
function copiarUrlsConocidas(filas, conocidos) {
  var esperado = {};
  conocidos.forEach(function (d) { esperado[d.destino_id] = d; });
  var cambios = [];
  filas.forEach(function (f) {
    var id = String(f.destino_id).trim();
    if (!Object.prototype.hasOwnProperty.call(esperado, id)) return;
    ['url', 'url_sonda'].forEach(function (col) {
      var nuevo = String(esperado[id][col] || '');
      if (String(f[col] === undefined || f[col] === null ? '' : f[col]).trim() !== nuevo) {
        f[col] = nuevo;
        cambios.push(id + '.' + col + ' -> ' + (nuevo || '(vacía)'));
      }
    });
  });
  return cambios;
}

// Correr desde el botón Ejecutar cuando cambie la dirección de un capturador
// (p. ej. Atención pasó a GitHub Pages): copia `url` y `url_sonda` de
// DESTINOS_CONOCIDOS a las filas que ya existen en DESTINOS. Correrla dos
// veces no cambia nada la segunda.
function actualizarDestinosConocidos() {
  _exigirColumnaUrlSonda();
  var filas = leerTabla(HOJAS.DESTINOS);
  var cambios = copiarUrlsConocidas(filas, DESTINOS_CONOCIDOS);
  if (cambios.length) reemplazarFilas(HOJAS.DESTINOS, filas);
  invalidarCatalogo(HOJAS.DESTINOS);
  Logger.log(cambios.length ? 'cambios: ' + cambios.join(', ') : 'no había nada que cambiar');
  verificarDestinos();
}
