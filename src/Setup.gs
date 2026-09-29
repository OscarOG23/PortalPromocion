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
                      'unidad_id', 'alias']],
    [HOJAS.PERSONAL, ['nombre', 'rol', 'unidad', 'clues', 'activo']],
    [HOJAS.FECHAS_NACIMIENTO, ['nombre', 'rol', 'fecha', 'curp']],
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

// Da una sal nueva a UNA cuenta sin tocar las demás. Una coordinación vuelve
// a usuario + '26'; una persona, a su fecha de nacimiento ddmmaaaa de la hoja
// FECHAS_NACIMIENTO (decisión del usuario, 2026-09-26: una contraseña que no
// se pueda olvidar quita el pretexto para no reportar).
function restablecerContrasena(nombreUsuario) {
  var filas = leerTabla(HOJAS.USUARIOS);
  var fila = _buscarUsuario(filas, nombreUsuario);
  if (!fila) {
    throw new Error('No existe el usuario "' + nombreUsuario + '". Usuarios: ' +
                    filas.map(function (f) { return f.usuario; }).join(', '));
  }
  var contrasena = contrasenaDeUsuario(fila.usuario);
  if (rolDeCuenta(fila) !== ROLES.COORDINACION) {
    // Una persona vuelve a su fecha de nacimiento, no a usuario + '26'.
    var plan = planDeContrasenasPorFecha(_leerFechasDeNacimiento(), [fila]);
    if (!plan.cambiar.length) {
      throw new Error(fila.nombre + ' no tiene fecha válida en la hoja ' +
                      HOJAS.FECHAS_NACIMIENTO + '. Agréguela y vuelva a correr.');
    }
    contrasena = plan.cambiar[0].contrasena;
  }
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
// Da de baja una cuenta (activo = FALSE en USUARIOS) y, si es de persona,
// también su fila en PERSONAL, para que crearCuentasDePersonal() no la
// vuelva a crear. Surte efecto al instante (invalida la caché).
function darDeBajaCuenta(nombreUsuario) {
  var filas = leerTabla(HOJAS.USUARIOS);
  var fila = _buscarUsuario(filas, nombreUsuario);
  if (!fila) throw new Error('No existe el usuario "' + nombreUsuario + '".');
  fila.activo = 'FALSE';
  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);
  var enPersonal = 0;
  if (rolDeCuenta(fila) !== ROLES.COORDINACION) {
    var clave = _claveDePersona(fila.nombre) + '|' + rolDeCuenta(fila);
    var personal = leerTabla(HOJAS.PERSONAL);
    personal.forEach(function (f) {
      if (_claveDePersona(sinTitulo(f.nombre)) + '|' + String(f.rol || '').trim().toUpperCase() === clave) {
        f.activo = 'FALSE'; enPersonal++;
      }
    });
    if (enPersonal) reemplazarFilas(HOJAS.PERSONAL, personal);
  }
  registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'BAJA_CUENTA', fila.usuario);
  return fila.usuario + ' dado de baja (' + enPersonal + ' filas en PERSONAL)';
}

// Pasaba las personas a usuario + '26'. Quedó bloqueada para no deshacer
// por error las contraseñas por fecha de nacimiento.
function igualarContrasenasDePersonal() {
  throw new Error('Obsoleta desde 2026-09-26: las personas usan su fecha de nacimiento. ' +
                  'Use asignarContrasenasPorFechaNacimiento().');
}

function _leerFechasDeNacimiento() {
  if (!SpreadsheetApp.getActive().getSheetByName(HOJAS.FECHAS_NACIMIENTO)) {
    throw new Error('Falta la hoja ' + HOJAS.FECHAS_NACIMIENTO +
                    '. Ejecute setupDatabase() y pegue nombre / rol / fecha (ddmmaaaa).');
  }
  return leerTabla(HOJAS.FECHAS_NACIMIENTO);
}

// Para `clasp run`: reemplaza la hoja FECHAS_NACIMIENTO con `filas`
// ([{nombre, rol, fecha, curp}]) sin que los datos pasen por el repo público. La
// columna fecha queda como texto para conservar el 0 inicial.
function cargarFechasDeNacimiento(filas) {
  if (!filas || !filas.length) throw new Error('No llegaron filas.');
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.FECHAS_NACIMIENTO);
  if (!hoja) throw new Error('Falta la hoja ' + HOJAS.FECHAS_NACIMIENTO + '. Ejecute setupDatabase().');
  hoja.getRange(2, 3, Math.max(hoja.getMaxRows() - 1, filas.length), 1).setNumberFormat('@');
  reemplazarFilas(HOJAS.FECHAS_NACIMIENTO, filas.map(function (f) {
    return { nombre: f.nombre, rol: f.rol, fecha: String(f.fecha), curp: f.curp || '' };
  }));
  return filas.length + ' filas cargadas';
}

// Agrega `columna` al final de la hoja si no la tiene. Idempotente.
function _agregarColumnaAlFinal(nombreHoja, columna) {
  var hoja = SpreadsheetApp.getActive().getSheetByName(nombreHoja);
  if (!hoja) throw new Error('Falta la hoja ' + nombreHoja + '. Ejecute setupDatabase() primero.');
  var ultima = hoja.getLastColumn();
  if (hoja.getRange(1, 1, 1, ultima).getValues()[0].indexOf(columna) !== -1) {
    return nombreHoja + ' ya tenía ' + columna;
  }
  hoja.getRange(1, ultima + 1).setValue(columna).setFontWeight('bold');
  invalidarCatalogo(nombreHoja);
  return nombreHoja + ' — columna ' + columna + ' agregada';
}

// Para las hojas creadas antes del alias (2026-09-27).
function agregarColumnasDeAlias() {
  return [_agregarColumnaAlFinal(HOJAS.USUARIOS, 'alias'),
          _agregarColumnaAlFinal(HOJAS.FECHAS_NACIMIENTO, 'curp')];
}

// Da a cada persona de FECHAS_NACIMIENTO su alias de CURP (gago99) en la
// columna alias de USUARIOS. Quien ya tenía alias lo conserva. Su usuario de
// siempre sigue sirviendo. Devuelve la lista para repartir.
function asignarAliasDePersonal() {
  var filas = leerTabla(HOJAS.USUARIOS);
  if (filas.length && !('alias' in filas[0])) throw new Error('Ejecute agregarColumnasDeAlias() primero.');
  var plan = planDeAlias(_leerFechasDeNacimiento(), filas);
  var porUsuario = {};
  plan.asignar.forEach(function (a) { porUsuario[a.usuario] = a.alias; });
  filas.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(porUsuario, f.usuario)) f.alias = porUsuario[f.usuario];
  });
  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);
  plan.problemas.forEach(function (p) { Logger.log('SIN ALIAS  fila ' + p.fila + '  ' + p.nombre + ': ' + p.motivo); });
  return { asignados: plan.asignar.map(function (a) { return a.alias + ' / ' + a.usuario + ' / ' + a.nombre; }),
           problemas: plan.problemas.map(function (p) { return p.nombre + ': ' + p.motivo; }) };
}

// Pone a cada persona de la hoja FECHAS_NACIMIENTO (nombre, rol, fecha
// ddmmaaaa) su fecha como contraseña. No toca coordinaciones ni a quien no
// esté en la hoja. Se puede correr las veces que haga falta. Formatee la
// columna fecha como TEXTO antes de pegar, o Sheets quita el 0 inicial (se
// tolera, pero así se ve igual que lo que se reparte).
function asignarContrasenasPorFechaNacimiento() {
  var filas = leerTabla(HOJAS.USUARIOS);
  var plan = planDeContrasenasPorFecha(_leerFechasDeNacimiento(), filas);
  plan.problemas.forEach(function (p) {
    Logger.log('NO SE CAMBIÓ  fila ' + p.fila + '  ' + p.nombre + ': ' + p.motivo);
  });
  var resumen = { cambiadas: plan.cambiar.map(function (c) { return c.usuario + ' / ' + c.nombre; }),
                  problemas: plan.problemas.map(function (p) { return p.nombre + ': ' + p.motivo; }) };
  if (!plan.cambiar.length) { Logger.log('=== Nada que cambiar ==='); return resumen; }
  var porUsuario = {};
  plan.cambiar.forEach(function (c) { porUsuario[c.usuario] = c.contrasena; });
  filas.forEach(function (f) {
    if (!Object.prototype.hasOwnProperty.call(porUsuario, f.usuario)) return;
    f.sal = generarSal();
    f.huella = huellaContrasena(f.sal, porUsuario[f.usuario]);
  });
  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);
  registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'RESTABLECER_CONTRASENA',
                  'fecha de nacimiento: ' + plan.cambiar.length + ' cuentas de persona');
  Logger.log('=== Usuario / contraseña / nombre (rol) ===');
  plan.cambiar.forEach(function (c) {
    Logger.log(c.usuario + ' / ' + c.contrasena + ' / ' + c.nombre + ' (' + c.rol + ')');
  });
  Logger.log('=== ' + plan.cambiar.length + ' cambiadas, ' + plan.problemas.length + ' con problema ===');
  return resumen;
}

// Para `clasp run`: agrega a PERSONAL las filas ([{nombre, rol, unidad,
// clues, activo}]) cuya persona+rol no esté ya. Luego: crearCuentasDePersonal().
function agregarAPersonal(filas) {
  var ya = {};
  leerTabla(HOJAS.PERSONAL).forEach(function (f) {
    ya[_claveDePersona(f.nombre) + '|' + String(f.rol || '').trim().toUpperCase()] = true;
  });
  var nuevas = (filas || []).filter(function (f) {
    var k = _claveDePersona(f.nombre) + '|' + String(f.rol || '').trim().toUpperCase();
    if (ya[k]) return false;
    ya[k] = true;
    return true;
  }).map(function (f) {
    return { nombre: f.nombre, rol: f.rol, unidad: f.unidad, clues: f.clues || '', activo: f.activo || 'TRUE' };
  });
  escribirFilas(HOJAS.PERSONAL, nuevas);
  return nuevas.length + ' filas agregadas a PERSONAL';
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
  var resumen = { creadas: plan.crear.map(function (c) { return c.usuario + ' / ' + c.nombre + ' / ' + c.unidad; }),
                  problemas: plan.problemas.map(function (p) { return p.nombre + ': ' + p.motivo; }) };
  if (!plan.crear.length) {
    Logger.log('=== No hay cuentas nuevas que crear (' + plan.problemas.length + ' problemas) ===');
    return resumen;
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
  return resumen;
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
  // La pantalla vive en GitHub Pages (web/actividad-fisica/): la de script.google.com
  // falla en Android Chrome con varias cuentas. La sonda sigue en el /exec.
  { destino_id: 'actividad_fisica', nombre: 'Reporte de Actividad Física', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://oscarog23.github.io/PortalPromocion/actividad-fisica/',
    url_sonda: 'https://script.google.com/macros/s/AKfycby-mX_9mqg4rBXYb9uPj9bJHuVao8D2JCByOpqkup9Q2_lvMOpnLT7GTvKgekSEAs6I/exec',
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 4, activo: 'TRUE' },
  // Solo para cuentas de persona: nutriólogos y psicólogos. La pantalla vive
  // en GitHub Pages (web/atencion/); la sonda sigue en el /exec de Apps Script.
  { destino_id: 'atencion', nombre: 'Informe mensual de Atención', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://oscarog23.github.io/PortalPromocion/atencion/',
    url_sonda: 'https://script.google.com/macros/s/AKfycbz0nx2wMg9Xqm0dhOsv621qXu6F_2fP9hDqMFkrIiFK8T_DAaM4Kgvr6xXxo5Hj1Q6mWA/exec',
    aplica_a: 'ROL:NUTRICION,ROL:PSICOLOGIA', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 5, activo: 'TRUE' },
  // Solo promotores: SSOP (pantalla en GitHub Pages, sonda en su /exec).
  { destino_id: 'ssop', nombre: 'SSOP — Productividad del promotor', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://oscarog23.github.io/ssop-capturador/',
    url_sonda: 'https://script.google.com/macros/s/AKfycbygXHFeDDQ2MWTwYoxN2xDd-RitXKUk6--xm3oltO4ZU-MtUVTbnkeEc9qHYgN3Y_8/exec',
    aplica_a: 'ROL:PROMOTOR', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 6, activo: 'TRUE' },
  // Jornadas extramuros de las coordinaciones: JS19 (pantalla en Pages, sonda en su /exec).
  { destino_id: 'jornadas', nombre: 'Reportar jornada', apartado: 'Jornadas',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://oscarog23.github.io/PortalPromocion/jornadas/',
    url_sonda: 'https://script.google.com/macros/s/AKfycbx5DZwA7PCK_xdZT-Aei83rezQKQTpv57AdRcNQ-cgAjnxgBTgofo6WWJj0YV3Bm8sk/exec',
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 7, activo: 'TRUE' },
  // Alta abierta de jornada médica: mismo backend de JS19, pantalla propia en
  // Pages (no lleva boleto ni coordinación). No es «reportado/pendiente»,
  // es una pantalla de registro: sin sonda.
  { destino_id: 'jornada_medica', nombre: 'Programar jornada (solo alta, opcional)', apartado: 'Jornadas',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://oscarog23.github.io/PortalPromocion/jornada-medica/',
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NINGUNA', orden: 8, activo: 'TRUE' }
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

// Para `clasp run`: cambia el nombre que ve la gente en un destino que ya
// existe en DESTINOS (actualizarDestinosConocidos solo copia direcciones).
function renombrarDestino(destinoId, nombre) {
  var filas = leerTabla(HOJAS.DESTINOS);
  var fila = filas.filter(function (f) { return f.destino_id === destinoId; })[0];
  if (!fila) throw new Error('No existe el destino "' + destinoId + '".');
  if (!String(nombre || '').trim()) throw new Error('Falta el nombre.');
  var antes = fila.nombre;
  fila.nombre = String(nombre).trim();
  reemplazarFilas(HOJAS.DESTINOS, filas);
  invalidarCatalogo(HOJAS.DESTINOS);
  return destinoId + ': "' + antes + '" → "' + fila.nombre + '"';
}

// Para `clasp run`: crea la cuenta de administración (tablero y "ver como"),
// o le cambia la contraseña si ya existe. La contraseña llega como parámetro
// y nunca se escribe en el repo (es público). No toca ninguna otra cuenta.
function crearCuentaAdmin(usuario, contrasena, nombre) {
  usuario = String(usuario || '').trim().toLowerCase();
  if (!/^[a-z0-9]{4,30}$/.test(usuario)) throw new Error('Usuario inválido: solo letras y números.');
  if (String(contrasena || '').length < 6) throw new Error('La contraseña necesita al menos 6 caracteres.');
  var filas = leerTabla(HOJAS.USUARIOS);
  var fila = _buscarUsuario(filas, usuario);
  if (fila && !esAdmin(fila)) throw new Error('"' + usuario + '" ya es una cuenta que no es de admin.');
  var sal = generarSal();
  if (fila) {
    fila.sal = sal;
    fila.huella = huellaContrasena(sal, contrasena);
    fila.activo = 'TRUE';
    reemplazarFilas(HOJAS.USUARIOS, filas);
  } else {
    escribirFilas(HOJAS.USUARIOS, [{ usuario: usuario, nombre: nombre || 'JURISDICCIÓN SANITARIA XIX TEXCOCO',
      rol: ROLES.ADMIN, coordinacion_id: COORDINACION_ADMIN, sal: sal,
      huella: huellaContrasena(sal, contrasena), activo: 'TRUE', unidad_id: '', alias: '' }]);
  }
  invalidarCatalogo(HOJAS.USUARIOS);
  registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'RESTABLECER_CONTRASENA',
                  'admin ' + usuario + (fila ? ' (contraseña cambiada)' : ' (creada)'));
  return usuario + (fila ? ': contraseña cambiada' : ': cuenta de admin creada');
}
