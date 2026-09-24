var MAX_INTENTOS = 5;
var MINUTOS_BLOQUEO = 15;
var MAX_LARGO_USUARIO = 64;

function _debeBloquear(intentos) {
  return intentos >= MAX_INTENTOS;
}

// Los celulares ponen mayúscula inicial y a veces un espacio al final.
function _buscarUsuario(filas, nombreUsuario) {
  var buscado = String(nombreUsuario || '').trim().toLowerCase();
  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i].usuario).trim().toLowerCase() === buscado) return filas[i];
  }
  return null;
}

// Lo que sale al navegador: nunca sal ni huella.
function _cuentaPublica(fila) {
  return { usuario: fila.usuario, nombre: fila.nombre, coordinacion_id: fila.coordinacion_id,
           rol: rolDeCuenta(fila), unidad_id: String(fila.unidad_id || '') };
}

// Devuelve siempre el mismo error, sin distinguir entre usuario inexistente,
// inactivo y contraseña equivocada: distinguirlos permitiría averiguar qué
// cuentas existen probando nombres.
function _resultadoAcceso(fila, contrasena) {
  var generico = { ok: false, code: 'CREDENCIALES_INVALIDAS',
                   message: 'Usuario o contraseña incorrectos.' };
  if (!fila) return generico;
  if (!esVerdadero(fila.activo)) return generico;
  if (!cuentaConRolValido(fila)) return generico;
  if (!verificarContrasena(contrasena, fila.sal, fila.huella)) return generico;
  return { ok: true, usuario: _cuentaPublica(fila) };
}

// Un boleto bien firmado no basta: la cuenta tiene que seguir activa y seguir
// siendo de la misma coordinación. Es la forma de dejar fuera a alguien sin
// esperar a que venza su boleto de 30 días.
// Ojo: USUARIOS se lee con la caché de leerCatalogo (30 min). Una baja surte
// efecto al vencer la caché, o de inmediato con invalidarCatalogo('USUARIOS')
// desde el editor.
function _cuentaDelBoleto(verificado, filas) {
  if (!verificado.ok) return verificado;
  var invalido = { ok: false, code: 'BOLETO_INVALIDO',
                   message: 'El acceso no es válido. Vuelva a entrar.' };
  var fila = _buscarUsuario(filas, verificado.usuario);
  if (!fila || !esVerdadero(fila.activo) || !cuentaConRolValido(fila)) return invalido;
  if (fila.coordinacion_id !== verificado.coordinacion_id) return invalido;
  return { ok: true, usuario: _cuentaPublica(fila) };
}

function _claveIntentos(usuario) {
  return 'intentos:' + String(usuario || '').trim().toLowerCase();
}

function iniciarSesion(nombreUsuario, contrasena) {
  // CacheService no acepta claves de más de 250 caracteres; ningún usuario
  // real pasa de 30.
  if (String(nombreUsuario || '').length > MAX_LARGO_USUARIO) return _resultadoAcceso(null, '');
  var cache = CacheService.getScriptCache();
  var claveIntentos = _claveIntentos(nombreUsuario);
  var intentos = parseInt(cache.get(claveIntentos) || '0', 10);

  if (_debeBloquear(intentos)) {
    return { ok: false, code: 'USUARIO_BLOQUEADO',
             message: 'Demasiados intentos. Espere ' + MINUTOS_BLOQUEO + ' minutos.' };
  }

  var r = _resultadoAcceso(_buscarUsuario(leerCatalogo(HOJAS.USUARIOS), nombreUsuario), contrasena);
  if (!r.ok) {
    cache.put(claveIntentos, String(intentos + 1), MINUTOS_BLOQUEO * 60);
    return r;
  }

  cache.remove(claveIntentos);
  var vence = Date.now() + VIDA_BOLETO_PORTAL_DIAS * 86400000;
  var boleto = emitirBoleto(r.usuario.usuario, r.usuario.coordinacion_id, DESTINO_PORTAL,
                            vence, secretoDeBoletos());
  registrarEvento(r.usuario.usuario, 'INGRESO', r.usuario.coordinacion_id);
  return { ok: true, boleto: boleto, usuario: r.usuario };
}

function usuarioDeBoleto(boleto) {
  var verificado = verificarBoleto(boleto, secretoDeBoletos(), DESTINO_PORTAL, Date.now());
  if (!verificado.ok) return verificado;
  return _cuentaDelBoleto(verificado, leerCatalogo(HOJAS.USUARIOS));
}
