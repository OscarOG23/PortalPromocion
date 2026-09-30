// --- Administración (2026-09-28) ---------------------------------------------
// Una cuenta con rol ADMIN (la de la jurisdicción) no tiene capturadores
// propios: ve el tablero de las coordinaciones y puede "ver como" cualquier
// coordinación o persona. Al ver como otra cuenta, los enlaces llevan el
// boleto DE ESA CUENTA, así que cada hermano la deja entrar igual que si ella
// hubiera iniciado sesión. Cada "ver como" queda en AUDITORIA.
//
// Su coordinacion_id es un centinela (JUR19): el boleto exige uno no vacío y
// ningún destino aplica a él.

var COORDINACION_ADMIN = 'JUR19';

function esAdmin(cuenta) {
  return !!cuenta && rolDeCuenta(cuenta) === ROLES.ADMIN;
}

function _cuentaDisponible(fila) {
  return esVerdadero(fila.activo) && cuentaConRolValido(fila) && !esAdmin(fila);
}

function _porNombre(a, b) {
  return String(a.nombre).localeCompare(String(b.nombre), 'es');
}

// Lo que el admin puede elegir en "ver como": coordinaciones y personas
// activas, por nombre. Nunca sal ni huella.
function opcionesVerComo(usuarios, unidades) {
  var coordinaciones = [], personas = [];
  (usuarios || []).filter(_cuentaDisponible).forEach(function (f) {
    var rol = rolDeCuenta(f);
    if (rol === ROLES.COORDINACION) {
      coordinaciones.push({ usuario: String(f.usuario), nombre: String(f.nombre) });
    } else {
      personas.push({ usuario: String(f.usuario), nombre: String(f.nombre), rol: rol,
                      unidad: nombreDeUnidadPorId(unidades, f.unidad_id) });
    }
  });
  return { coordinaciones: coordinaciones.sort(_porNombre), personas: personas.sort(_porNombre) };
}

// La fila de USUARIOS como la que el admin quiere ver. Solo un admin puede
// pedirlo, y solo hacia cuentas activas que no sean de admin.
function cuentaParaVerComo(usuarios, admin, usuarioObjetivo) {
  if (!esAdmin(admin)) {
    return { ok: false, code: 'NO_AUTORIZADO', message: 'Esta cuenta no puede ver como otra.' };
  }
  var fila = _buscarUsuario(usuarios || [], usuarioObjetivo);
  if (!fila || !_cuentaDisponible(fila)) {
    return { ok: false, code: 'CUENTA_NO_DISPONIBLE', message: 'Esa cuenta no existe o está dada de baja.' };
  }
  return { ok: true, fila: fila };
}

// filas = [{ usuario, nombre, destinos: [filas de DESTINOS], estados: {id: estado} }].
// Columnas = la unión de destinos, por `orden`. Un destino que no le aplica a
// una coordinación no aparece en su fila: no es "pendiente", no le toca.
function armarTablero(filas) {
  var columnas = [], vistas = {};
  filas.forEach(function (f) {
    f.destinos.forEach(function (d) {
      var id = String(d.destino_id).trim();
      if (vistas[id]) return;
      vistas[id] = true;
      columnas.push({ destino_id: id, nombre: d.nombre, orden: Number(d.orden) || 0 });
    });
  });
  columnas.sort(function (a, b) { return a.orden - b.orden; });
  return {
    columnas: columnas.map(function (c) { return { destino_id: c.destino_id, nombre: c.nombre }; }),
    filas: filas.map(function (f) {
      var estados = {}, reportados = 0;
      columnas.forEach(function (c) {
        if (!Object.prototype.hasOwnProperty.call(f.estados, c.destino_id)) return;
        estados[c.destino_id] = f.estados[c.destino_id];
        if (f.estados[c.destino_id] === ESTADOS.REPORTADO) reportados++;
      });
      return { usuario: f.usuario, nombre: f.nombre, estados: estados,
               reportados: reportados, total: Object.keys(estados).length };
    })
  };
}

// --- Acciones de la API (tocan hojas y red) ------------------------------------

function _adminDeBoleto(boleto) {
  var cuenta = usuarioDeBoleto(boleto);
  if (!cuenta.ok) return cuenta;
  if (!esAdmin(cuenta.usuario)) {
    return { ok: false, code: 'NO_AUTORIZADO', message: 'Esta cuenta no puede ver esto.' };
  }
  return cuenta;
}

function contextoDeAdmin_(u) {
  return { ok: true,
           usuario: { nombre: u.nombre, coordinacion_id: u.coordinacion_id, rol: ROLES.ADMIN, unidad: '' },
           periodo: { anio: getConfig('anio_activo'), mes: getConfig('mes_activo') },
           destinos: [],
           admin: opcionesVerComo(leerCatalogo(HOJAS.USUARIOS), leerCatalogo(HOJAS.UNIDADES)) };
}

function contextoComo(boleto, usuarioObjetivo, omitirSondas) {
  var admin = _adminDeBoleto(boleto);
  if (!admin.ok) return admin;
  var r = cuentaParaVerComo(leerCatalogo(HOJAS.USUARIOS), admin.usuario, usuarioObjetivo);
  if (!r.ok) return r;
  registrarEvento(admin.usuario.usuario, 'VER_COMO', r.fila.usuario);
  var ctx = contextoDeCuenta_(_cuentaPublica(r.fila), omitirSondas);
  ctx.verComo = { usuario: r.fila.usuario, admin: admin.usuario.nombre };
  return ctx;
}

// El tablero se arma en dos tiempos (2026-09-28): consultar las sondas de las
// 22 coordinaciones en una sola ejecución pasó de los 6 minutos de Apps
// Script. `tablero` devuelve al instante las columnas y las coordinaciones;
// la página pide después cada fila con `tableroFila`, varias a la vez.

function _coordinacionesDelTablero_() {
  return leerCatalogo(HOJAS.USUARIOS).filter(function (f) {
    return _cuentaDisponible(f) && rolDeCuenta(f) === ROLES.COORDINACION;
  }).map(_cuentaPublica).sort(_porNombre);
}

// Sin sonda (p. ej. Programar jornada, una pantalla de registro) no hay
// "reportado/pendiente" que mostrar: no entra al tablero ni a su conteo.
function _destinosDeCoordinacion_(destinos, u) {
  return destinosDeCuenta(destinos, { rol: u.rol, coordinacion_id: u.coordinacion_id })
    .filter(function (d) { return String(d.sonda || '').trim().toUpperCase() !== 'NINGUNA'; });
}

function tablero(boleto) {
  var admin = _adminDeBoleto(boleto);
  if (!admin.ok) return admin;
  var destinos = leerCatalogo(HOJAS.DESTINOS);
  var t = armarTablero(_coordinacionesDelTablero_().map(function (u) {
    return { usuario: u.usuario, nombre: u.nombre, destinos: _destinosDeCoordinacion_(destinos, u), estados: {} };
  }));
  t.ok = true;
  t.periodo = { anio: getConfig('anio_activo'), mes: getConfig('mes_activo') };
  return t;
}

// Una fila del tablero: los estados de UNA coordinación (con sus sondas).
function tableroFila(boleto, usuario) {
  var admin = _adminDeBoleto(boleto);
  if (!admin.ok) return admin;
  var u = _coordinacionesDelTablero_().filter(function (c) {
    return c.usuario === String(usuario || '').trim().toLowerCase();
  })[0];
  if (!u) return { ok: false, code: 'CUENTA_NO_DISPONIBLE', message: 'Esa coordinación no existe o está dada de baja.' };
  var anio = getConfig('anio_activo');
  var mes = getConfig('mes_activo');
  var destinos = _destinosDeCoordinacion_(leerCatalogo(HOJAS.DESTINOS), u);
  var progreso = {};
  var nativos = consultarSondasNativas_(destinos, u, anio, mes, secretoDeBoletos(), progreso);
  var coordinacion = { coordinacion_id: u.coordinacion_id, nombre: u.nombre, usuario: u.usuario };
  var estados = {};
  destinos.forEach(function (d) {
    var id = String(d.destino_id).trim();
    estados[id] = String(d.sonda || '').trim().toUpperCase() === SONDA_NATIVA
      ? (nativos[id] || ESTADOS.NO_SE_SABE) : estadoDeDestino(d, coordinacion, anio, mes);
  });
  var fila = armarTablero([{ usuario: u.usuario, nombre: u.nombre, destinos: destinos, estados: estados }]).filas[0];
  fila.ok = true;
  fila.consultando = !!progreso.enCurso;
  return fila;
}
