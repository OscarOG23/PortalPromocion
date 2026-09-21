// registrarPruebas() es el único punto de registro de pruebas y existe SOLO
// en este archivo. Apps Script carga todos los .gs en un mismo espacio global:
// una segunda definición en otro archivo sobrescribiría a esta sin avisar.
function registrarPruebas() {
  prueba('el corredor corre', function () {
    assertIgual(1 + 1, 2);
  });

  // --- Claves, credenciales y usuarios (copiados de Determinantes) --------

  prueba('esVerdadero acepta solo un sí explícito', function () {
    assertIgual([true, 'TRUE', 'true', ' Sí ', 'SI', 'VERDADERO', '1'].map(esVerdadero),
                [true, true, true, true, true, true, true]);
  });

  prueba('esVerdadero: vacío, nulo o cualquier otra cosa es falso', function () {
    assertIgual([false, '', null, undefined, 'FALSE', 'no', '0', 0].map(esVerdadero),
                [false, false, false, false, false, false, false, false]);
  });

  prueba('sinAcentos quita tildes y cambia ñ por n', function () {
    assertIgual(sinAcentos('SANTA MARÍA Ñuñoa'), 'SANTA MARIA Nunoa');
  });

  prueba('huellaContrasena coincide con SHA-256 conocido', function () {
    // SHA-256('abc'): vector de prueba del estándar FIPS 180-2.
    assertIgual(huellaContrasena('a', 'bc'),
                'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  prueba('verificarContrasena: correcta, equivocada y vacía', function () {
    var huella = huellaContrasena('sal1', 'chiautla26');
    assertIgual([verificarContrasena('chiautla26', 'sal1', huella),
                 verificarContrasena('chiautla27', 'sal1', huella),
                 verificarContrasena('chiautla26', 'sal2', huella),
                 verificarContrasena('', 'sal1', huella)],
                [true, false, false, false]);
  });

  prueba('usuarioDeCoordinacion quita acentos, espacios y signos', function () {
    assertIgual(usuarioDeCoordinacion('CEAPS SANTA MARÍA CHIMALHUACAN'),
                'ceapssantamariachimalhuacan');
  });

  prueba('contrasenaDeUsuario es el usuario más 26', function () {
    assertIgual(contrasenaDeUsuario('chiautla'), 'chiautla26');
  });

  // --- Boleto -------------------------------------------------------------

  var SECRETO = 'secreto-de-prueba';
  var AHORA = 1790000000000;
  var LUEGO = AHORA + 3600000;

  prueba('boleto: ida y vuelta, con caracteres no ASCII', function () {
    var b = emitirBoleto('ñandú', 'COOR07', 'sips', LUEGO, SECRETO);
    assertIgual(/^[A-Za-z0-9_.-]+$/.test(b), true, 'seguro para URL');
    assertIgual(verificarBoleto(b, SECRETO, 'sips', AHORA),
                { ok: true, coordinacion_id: 'COOR07', usuario: 'ñandú',
                  destino: 'sips', vence: LUEGO });
  });

  prueba('boleto: otro secreto no lo abre', function () {
    var b = emitirBoleto('chiautla', 'COOR01', 'portal', LUEGO, SECRETO);
    assertIgual(verificarBoleto(b, 'otro', 'portal', AHORA).code, 'BOLETO_INVALIDO');
  });

  prueba('boleto: cambiar la coordinación invalida la firma', function () {
    var b = emitirBoleto('chiautla', 'COOR01', 'portal', LUEGO, SECRETO);
    var falso = _b64(JSON.stringify({ c: 'COOR02', u: 'chiautla', d: 'portal', v: LUEGO }));
    assertIgual(verificarBoleto(falso + '.' + b.split('.')[1], SECRETO, 'portal', AHORA).code,
                'BOLETO_INVALIDO');
  });

  prueba('boleto: vencido', function () {
    var b = emitirBoleto('chiautla', 'COOR01', 'portal', AHORA, SECRETO);
    assertIgual(verificarBoleto(b, SECRETO, 'portal', AHORA).code, 'BOLETO_VENCIDO');
  });

  prueba('boleto: vencido y alterado es inválido, no vencido', function () {
    var b = emitirBoleto('chiautla', 'COOR01', 'portal', AHORA - 1, SECRETO);
    var falso = _b64(JSON.stringify({ c: 'COOR02', u: 'chiautla', d: 'portal', v: AHORA - 1 }));
    assertIgual(verificarBoleto(falso + '.' + b.split('.')[1], SECRETO, 'portal', AHORA).code,
                'BOLETO_INVALIDO');
  });

  prueba('boleto: el de un destino no abre otro', function () {
    var b = emitirBoleto('chiautla', 'COOR01', 'sips', LUEGO, SECRETO);
    assertIgual(verificarBoleto(b, SECRETO, 'determinantes', AHORA).code, 'BOLETO_INVALIDO');
  });

  prueba('boleto: basura es inválida y no lanza', function () {
    assertIgual(['', null, undefined, 'abc', 'a.b.c', '.', 'e30.xxx'].map(function (b) {
      return verificarBoleto(b, SECRETO, 'portal', AHORA).code;
    }), ['BOLETO_INVALIDO', 'BOLETO_INVALIDO', 'BOLETO_INVALIDO', 'BOLETO_INVALIDO',
         'BOLETO_INVALIDO', 'BOLETO_INVALIDO', 'BOLETO_INVALIDO']);
  });

  prueba('boleto: sin secreto no se emite', function () {
    assertLanza(function () { emitirBoleto('chiautla', 'COOR01', 'portal', LUEGO, ''); },
                'SIN_SECRETO');
  });

  prueba('boleto: sin secreto no se verifica', function () {
    var b = emitirBoleto('chiautla', 'COOR01', 'portal', LUEGO, SECRETO);
    assertIgual(verificarBoleto(b, '', 'portal', AHORA).code, 'BOLETO_INVALIDO');
  });

  // --- Acceso -------------------------------------------------------------

  var FILA_CHIAUTLA = { usuario: 'chiautla', nombre: 'CHIAUTLA', rol: 'COORDINACION',
                        coordinacion_id: 'COOR01', sal: 's1',
                        huella: huellaContrasena('s1', 'chiautla26'), activo: 'TRUE' };

  prueba('bloqueo: cuatro intentos no, cinco sí', function () {
    assertIgual([_debeBloquear(4), _debeBloquear(5)], [false, true]);
  });

  prueba('acceso: usuario inexistente da el error genérico', function () {
    assertIgual(_resultadoAcceso(null, 'x'),
                { ok: false, code: 'CREDENCIALES_INVALIDAS',
                  message: 'Usuario o contraseña incorrectos.' });
  });

  prueba('acceso: cuenta inactiva da el MISMO error que inexistente', function () {
    var inactiva = JSON.parse(JSON.stringify(FILA_CHIAUTLA));
    inactiva.activo = 'FALSE';
    assertIgual(_resultadoAcceso(inactiva, 'chiautla26'), _resultadoAcceso(null, 'x'));
  });

  prueba('acceso: contraseña equivocada da el MISMO error', function () {
    assertIgual(_resultadoAcceso(FILA_CHIAUTLA, 'chiautla27'), _resultadoAcceso(null, 'x'));
  });

  prueba('acceso: correcto devuelve la cuenta sin sal ni huella', function () {
    assertIgual(_resultadoAcceso(FILA_CHIAUTLA, 'chiautla26'),
                { ok: true, usuario: { usuario: 'chiautla', nombre: 'CHIAUTLA',
                                       coordinacion_id: 'COOR01' } });
  });

  prueba('buscar usuario ignora mayúsculas y espacios', function () {
    assertIgual(_buscarUsuario([FILA_CHIAUTLA], '  ChiAutla ').usuario, 'chiautla');
    assertIgual(_buscarUsuario([FILA_CHIAUTLA], 'otra'), null);
  });

  prueba('cuenta del boleto: vigente y activa', function () {
    assertIgual(_cuentaDelBoleto({ ok: true, usuario: 'chiautla', coordinacion_id: 'COOR01' },
                                 [FILA_CHIAUTLA]),
                { ok: true, usuario: { usuario: 'chiautla', nombre: 'CHIAUTLA',
                                       coordinacion_id: 'COOR01' } });
  });

  prueba('cuenta del boleto: dada de baja después de entrar', function () {
    var baja = JSON.parse(JSON.stringify(FILA_CHIAUTLA));
    baja.activo = '';
    assertIgual(_cuentaDelBoleto({ ok: true, usuario: 'chiautla', coordinacion_id: 'COOR01' },
                                 [baja]).code, 'BOLETO_INVALIDO');
  });

  prueba('cuenta del boleto: la coordinación de la cuenta cambió', function () {
    assertIgual(_cuentaDelBoleto({ ok: true, usuario: 'chiautla', coordinacion_id: 'COOR09' },
                                 [FILA_CHIAUTLA]).code, 'BOLETO_INVALIDO');
  });

  prueba('cuenta del boleto: un boleto vencido pasa tal cual', function () {
    var vencido = { ok: false, code: 'BOLETO_VENCIDO', message: 'Su acceso venció. Vuelva a entrar.' };
    assertIgual(_cuentaDelBoleto(vencido, [FILA_CHIAUTLA]), vencido);
  });

  prueba('bitácora: una acción inventada no se escribe', function () {
    assertLanza(function () { registrarEvento('chiautla', 'BORRAR_TODO', ''); }, 'ACCION_INVALIDA');
  });

  // Las tareas siguientes agregan sus pruebas aquí, antes de esta línea.
}
