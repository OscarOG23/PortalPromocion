// El Apps Script de la máscara no sirve pantallas: solo responde JSON. La
// pantalla vive en GitHub Pages, porque en Android Chrome las páginas de
// script.google.com se resuelven contra la cuenta de Google con que está
// firmado el teléfono y fallan (defecto verificado en SSOP).
//
// La pantalla manda POST con Content-Type text/plain: con application/json el
// navegador exige un OPTIONS previo que Apps Script no contesta.

var ACCIONES_API = {
  iniciarSesion: function (p) { return iniciarSesion(p.usuario, p.contrasena); },
  contexto: function (p) { return contextoDeBoleto(p.boleto); }
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
function contextoDeBoleto(boleto) {
  var cuenta = usuarioDeBoleto(boleto);
  if (!cuenta.ok) return cuenta;
  var u = cuenta.usuario;
  // En USUARIOS, `nombre` es el nombre de la coordinación: lo pone así
  // crearCuentasDeCoordinaciones().
  var coordinacion = { coordinacion_id: u.coordinacion_id, nombre: u.nombre, usuario: u.usuario };
  var anio = getConfig('anio_activo');
  var mes = getConfig('mes_activo');
  var secreto = secretoDeBoletos();
  var vence = Date.now() + VIDA_BOLETO_DESTINO_HORAS * 3600000;

  var destinos = destinosDeCoordinacion(leerCatalogo(HOJAS.DESTINOS), u.coordinacion_id)
    .map(function (d) {
      var id = String(d.destino_id).trim();
      var boletoDestino = d.clase !== CLASES_DESTINO.FORMULARIO && !problemasDeDestino(d).length
        ? emitirBoleto(u.usuario, u.coordinacion_id, id, vence, secreto, u.nombre) : '';
      return {
        destino_id: id,
        nombre: d.nombre,
        apartado: d.apartado || '',
        clase: d.clase,
        enlace: enlaceDeDestino(d, coordinacion, boletoDestino),
        estado: estadoDeDestino(d, coordinacion, anio, mes)
      };
    });

  return { ok: true, usuario: { nombre: u.nombre, coordinacion_id: u.coordinacion_id },
           periodo: { anio: anio, mes: mes }, destinos: destinos };
}
