// El Apps Script de la máscara no sirve pantallas: solo responde JSON. La
// pantalla vive en GitHub Pages, porque en Android Chrome las páginas de
// script.google.com se resuelven contra la cuenta de Google con que está
// firmado el teléfono y fallan (defecto verificado en SSOP).
//
// La pantalla manda POST con Content-Type text/plain: con application/json el
// navegador exige un OPTIONS previo que Apps Script no contesta.

var ACCIONES_API = {
  iniciarSesion: function (p) { return iniciarSesion(p.usuario, p.contrasena); },
  contexto: function (p) { return contextoDeBoleto(p.boleto, p.omitirSondas === true); },
  contextoComo: function (p) { return contextoComo(p.boleto, p.usuario, p.omitirSondas === true); },
  estados: function (p) { return estadosDeBoleto(p.boleto, p.usuario); },
  tablero: function (p) { return tablero(p.boleto); },
  tableroFila: function (p) { return tableroFila(p.boleto, p.usuario); },
  seguimiento: function (p) { return seguimientoPreventivo(p); },
  atenderPreventivo: function (p) { return atenderPreventivo(p); }
};

function _json(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
                       .setMimeType(ContentService.MimeType.JSON);
}

// Sirve para comprobar a mano que el despliegue responde.
function doGet() {
  return _json({ ok: true, servicio: 'mascara' });
}

function doPost(e) {
  var peticion;
  try {
    peticion = JSON.parse(e.postData.contents);
  } catch (err) {
    return _json({ ok: false, code: 'PETICION_INVALIDA', message: 'La petición no es JSON.' });
  }
  return _json(despachar(peticion));
}

// hasOwnProperty y no `tabla[accion]` a secas: 'constructor' o 'toString'
// existen en todo objeto y se ejecutarían como si fueran acciones.
function despachar(peticion, acciones) {
  var tabla = acciones || ACCIONES_API;
  var accion = peticion && peticion.accion;
  if (typeof accion !== 'string' || !Object.prototype.hasOwnProperty.call(tabla, accion)) {
    return { ok: false, code: 'ACCION_DESCONOCIDA', message: 'Acción desconocida.' };
  }
  try {
    return tabla[accion](peticion);
  } catch (err) {
    // El mensaje real va al log de ejecución; la página es pública y ese
    // texto es interno, no se le muestra a quien captura.
    console.error(err);
    return { ok: false, code: 'ERROR_INTERNO', message: 'Ocurrió un error. Intente de nuevo.' };
  }
}

// Cada hermano recibe su propio boleto, de 8 horas y marcado con su
// destino_id. El de 30 días del portal nunca sale de aquí: el de un destino
// viaja en una URL y se queda en historiales.
function contextoDeBoleto(boleto, omitirSondas) {
  var cuenta = usuarioDeBoleto(boleto);
  if (!cuenta.ok) return cuenta;
  if (esAdmin(cuenta.usuario)) return contextoDeAdmin_(cuenta.usuario);
  return contextoDeCuenta_(cuenta.usuario, omitirSondas);
}

// El portal de una cuenta (coordinación o persona). `u` = _cuentaPublica.
// También lo usa "ver como" del admin: los boletos salen a nombre de `u`.
function contextoDeCuenta_(u, omitirSondas) {
  // En USUARIOS, `nombre` es el nombre de la coordinación (lo pone así
  // crearCuentasDeCoordinaciones()) o, en una cuenta de persona, el de ella.
  var coordinacion = { coordinacion_id: u.coordinacion_id, nombre: u.nombre, usuario: u.usuario };
  var anio = getConfig('anio_activo');
  var mes = getConfig('mes_activo');
  var secreto = secretoDeBoletos();
  var vence = Date.now() + VIDA_BOLETO_DESTINO_HORAS * 3600000;

  // Rol vacío (cuentas de antes de la fase 7) es coordinación.
  var rol = rolDeCuenta(u);
  var filas = destinosDeCuenta(leerCatalogo(HOJAS.DESTINOS),
                               { rol: rol, coordinacion_id: u.coordinacion_id });
  var nativos = omitirSondas ? {} : consultarSondasNativas_(filas, u, anio, mes, secreto);

  var destinos = filas.map(function (d) {
      var id = String(d.destino_id).trim();
      var boletoDestino = d.clase !== CLASES_DESTINO.FORMULARIO && !problemasDeDestino(d).length
        ? boletoParaDestino(u, id, vence, secreto) : '';
      return {
        destino_id: id,
        nombre: d.nombre,
        apartado: d.apartado || '',
        clase: d.clase,
        enlace: enlaceDeDestino(d, coordinacion, boletoDestino),
        estado: omitirSondas ? ESTADOS.NO_SE_SABE : String(d.sonda || '').trim().toUpperCase() === SONDA_NATIVA
          ? (nativos[id] || ESTADOS.NO_SE_SABE) : estadoDeDestino(d, coordinacion, anio, mes)
      };
    });

  var unidad = rol === ROLES.COORDINACION ? ''
    : nombreDeUnidadPorId(leerCatalogo(HOJAS.UNIDADES), u.unidad_id);
  return { ok: true, usuario: { nombre: u.nombre, coordinacion_id: u.coordinacion_id, rol: rol,
                                unidad: unidad },
           periodo: { anio: anio, mes: mes }, destinos: destinos, estadosPendientes: !!omitirSondas };
}

// La captura puede comenzar mientras las sondas resuelven en otra petición.
// Se vuelven a validar sesión y permisos; nunca se acepta una cuenta del cliente.
function estadosDeBoleto(boleto, usuarioObjetivo) {
  var cuenta = usuarioDeBoleto(boleto);
  if (!cuenta.ok) return cuenta;
  var u = cuenta.usuario;
  if (usuarioObjetivo) {
    if (!esAdmin(u)) return { ok: false, code: 'NO_AUTORIZADO', message: 'Esta cuenta no puede ver como otra.' };
    var r = cuentaParaVerComo(leerCatalogo(HOJAS.USUARIOS), u, usuarioObjetivo);
    if (!r.ok) return r;
    u = _cuentaPublica(r.fila);
  }
  var anio = getConfig('anio_activo'), mes = getConfig('mes_activo');
  var filas = destinosDeCuenta(leerCatalogo(HOJAS.DESTINOS), u);
  var progreso = {};
  var nativos = consultarSondasNativas_(filas, u, anio, mes, secretoDeBoletos(), progreso);
  var estados = {};
  var coordinacion = { coordinacion_id: u.coordinacion_id, nombre: u.nombre, usuario: u.usuario };
  filas.forEach(function (d) {
    var id = String(d.destino_id).trim();
    estados[id] = String(d.sonda || '').trim().toUpperCase() === SONDA_NATIVA
      ? (nativos[id] || ESTADOS.NO_SE_SABE) : estadoDeDestino(d, coordinacion, anio, mes);
  });
  return { ok: true, periodo: { anio: anio, mes: mes }, estados: estados, consultando: !!progreso.enCurso };
}
