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
                  destino: 'sips', vence: LUEGO, nombre: '' });
  });

  prueba('boleto: lleva el nombre de la coordinación firmado', function () {
    var b = emitirBoleto('ceapssantamariachimalhuacan', 'COOR14', 'mensual_coordinacion', LUEGO,
                          SECRETO, 'CEAPS SANTA MARÍA CHIMALHUACAN');
    assertIgual(verificarBoleto(b, SECRETO, 'mensual_coordinacion', AHORA).nombre,
                'CEAPS SANTA MARÍA CHIMALHUACAN');

    var falso = _b64(JSON.stringify({ c: 'COOR14', u: 'x', d: 'mensual_coordinacion', v: LUEGO,
                                       n: 5 }));
    assertIgual(verificarBoleto(falso + '.' + _firma(falso, SECRETO), SECRETO,
                                 'mensual_coordinacion', AHORA).code, 'BOLETO_INVALIDO');
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

  prueba('boleto: ida y vuelta con los tres largos de relleno', function () {
    var usuarios = ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef'];
    var obtenidos = usuarios.map(function (u) {
      var b = emitirBoleto(u, 'COOR01', 'portal', LUEGO, SECRETO);
      return verificarBoleto(b, SECRETO, 'portal', AHORA).usuario;
    });
    assertIgual(obtenidos, usuarios);
  });

  prueba('boleto: una firma con un carácter cambiado es inválida', function () {
    var b = emitirBoleto('chiautla', 'COOR01', 'portal', LUEGO, SECRETO);
    var partes = b.split('.');
    var firma = partes[1];
    var ultimo = firma.charAt(firma.length - 1);
    var otro = ultimo === 'A' ? 'B' : 'A';
    var firmaAlterada = firma.slice(0, -1) + otro;
    assertIgual(verificarBoleto(partes[0] + '.' + firmaAlterada, SECRETO, 'portal', AHORA).code,
                'BOLETO_INVALIDO');
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

  // --- Destinos -----------------------------------------------------------

  var FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform';
  var COORD_14 = { coordinacion_id: 'COOR14', nombre: 'CEAPS SANTA MARÍA CHIMALHUACAN',
                   usuario: 'ceapssantamariachimalhuacan' };

  function destino(campos) {
    var base = { destino_id: 'd1', nombre: 'D1', apartado: 'A', clase: 'FORMULARIO', url: FORM,
                 aplica_a: 'TODAS', param_identidad: 'entry.123', valor_identidad: '',
                 sonda: 'NINGUNA', orden: 1, activo: 'TRUE' };
    Object.keys(campos || {}).forEach(function (k) { base[k] = campos[k]; });
    return base;
  }

  prueba('aplica_a: TODAS, lista y vacío', function () {
    assertIgual([_aplicaA(destino({ aplica_a: 'todas' }), 'COOR05'),
                 _aplicaA(destino({ aplica_a: 'COOR01, COOR05' }), 'COOR05'),
                 _aplicaA(destino({ aplica_a: 'COOR01' }), 'COOR05'),
                 _aplicaA(destino({ aplica_a: '' }), 'COOR05')],
                [true, true, false, false]);
  });

  prueba('destinos: orden vacío va primero y no rompe el orden', function () {
    var filas = [destino({ destino_id: 'tres', orden: 3 }),
                 destino({ destino_id: 'vacio', orden: '' }),
                 destino({ destino_id: 'uno', orden: 1 })];
    assertIgual(destinosDeCoordinacion(filas, 'COOR05').map(function (d) { return d.destino_id; }),
                ['vacio', 'uno', 'tres']);
  });

  prueba('destinos de una coordinación: filtra y ordena numérico', function () {
    var filas = [destino({ destino_id: 'diez', orden: 10 }),
                 destino({ destino_id: 'inactivo', orden: 1, activo: 'FALSE' }),
                 destino({ destino_id: 'ajeno', orden: 1, aplica_a: 'COOR01' }),
                 destino({ destino_id: 'dos', orden: '2' })];
    assertIgual(destinosDeCoordinacion(filas, 'COOR05').map(function (d) { return d.destino_id; }),
                ['dos', 'diez']);
  });

  prueba('problemas: una fila correcta de cada clase no tiene', function () {
    assertIgual([
      problemasDeDestino(destino()),
      problemasDeDestino(destino({ clase: 'HERMANO_CON_CONTRASENA', param_identidad: '',
                                   url: 'https://script.google.com/macros/s/X/exec' })),
      problemasDeDestino(destino({ clase: 'HERMANO_SIN_CONTRASENA', param_identidad: 'coordinacion',
                                   url: 'https://script.google.com/macros/s/Y/exec' }))
    ], [[], [], []]);
  });

  prueba('problemas: detecta cada error de configuración', function () {
    assertIgual([
      problemasDeDestino(destino({ destino_id: '' })).length,
      problemasDeDestino(destino({ clase: 'PAGINA' })).length,
      problemasDeDestino(destino({ url: 'http://inseguro.com' })).length,
      problemasDeDestino(destino({ param_identidad: '' })).length,
      problemasDeDestino(destino({ param_identidad: 'coordinacion' })).length,
      problemasDeDestino(destino({ valor_identidad: 'CORREO' })).length,
      problemasDeDestino(destino({ clase: 'HERMANO_SIN_CONTRASENA', param_identidad: '' })).length
    ], [1, 1, 1, 1, 1, 1, 1]);
  });

  prueba('problemas: destino_id portal está reservado', function () {
    assertIgual(problemasDeDestino(destino({ destino_id: ' Portal ' })).length, 1);
    assertIgual(enlaceDeDestino(destino({ destino_id: 'portal', clase: 'HERMANO_CON_CONTRASENA',
                                          param_identidad: '',
                                          url: 'https://script.google.com/macros/s/X/exec' }),
                                COORD_14, 'AAA.BBB'),
                null);
  });

  prueba('problemas: una url con # se rechaza', function () {
    assertIgual(problemasDeDestino(destino({ url: FORM + '#x' })).length, 1);
  });

  prueba('enlace de formulario: pre-llenado con el nombre, codificado', function () {
    assertIgual(enlaceDeDestino(destino(), COORD_14, ''),
                FORM + '?usp=pp_url&entry.123=CEAPS%20SANTA%20MAR%C3%8DA%20CHIMALHUACAN');
  });

  prueba('enlace de formulario: pre-llenado con el id', function () {
    assertIgual(enlaceDeDestino(destino({ valor_identidad: 'ID' }), COORD_14, ''),
                FORM + '?usp=pp_url&entry.123=COOR14');
  });

  prueba('enlace de hermano con contraseña: solo el boleto, respeta ? existente', function () {
    var d = destino({ clase: 'HERMANO_CON_CONTRASENA', param_identidad: '',
                      url: 'https://script.google.com/macros/s/X/exec?v=2' });
    assertIgual(enlaceDeDestino(d, COORD_14, 'AAA.BBB'),
                'https://script.google.com/macros/s/X/exec?v=2&boleto=AAA.BBB');
  });

  prueba('enlace de hermano sin contraseña: boleto y coordinación', function () {
    var d = destino({ clase: 'HERMANO_SIN_CONTRASENA', param_identidad: 'coordinacion',
                      valor_identidad: 'ID', url: 'https://script.google.com/macros/s/Y/exec' });
    assertIgual(enlaceDeDestino(d, COORD_14, 'AAA.BBB'),
                'https://script.google.com/macros/s/Y/exec?boleto=AAA.BBB&coordinacion=COOR14');
  });

  prueba('enlace de fila mal configurada es null', function () {
    assertIgual(enlaceDeDestino(destino({ param_identidad: '' }), COORD_14, ''), null);
  });

  prueba('estado: verde solo con un sí explícito de la sonda', function () {
    assertIgual(estadoDeSonda({ ok: true, reportado: true }), 'REPORTADO');
  });

  prueba('estado: un no explícito es pendiente', function () {
    assertIgual(estadoDeSonda({ ok: true, reportado: false }), 'PENDIENTE');
  });

  prueba('estado: nada se pinta de verde por falta de datos', function () {
    assertIgual([null, undefined, {}, { ok: false, reportado: true }, { ok: true },
                 { ok: true, reportado: 'true' }, { ok: true, reportado: 1 }].map(estadoDeSonda),
                ['NO_SE_SABE', 'NO_SE_SABE', 'NO_SE_SABE', 'NO_SE_SABE', 'NO_SE_SABE',
                 'NO_SE_SABE', 'NO_SE_SABE']);
  });

  prueba('estado: una sonda que revienta da gris', function () {
    assertIgual(consultarSonda(function () { throw new Error('hoja borrada'); }), 'NO_SE_SABE');
  });

  prueba('estado de destino: sin sonda registrada es gris', function () {
    var sondas = { SIEMPRE_SI: function () { return { ok: true, reportado: true }; } };
    assertIgual([estadoDeDestino(destino({ sonda: 'NINGUNA' }), COORD_14, 2026, 9, sondas),
                 estadoDeDestino(destino({ sonda: 'INVENTADA' }), COORD_14, 2026, 9, sondas),
                 estadoDeDestino(destino({ sonda: 'SIEMPRE_SI' }), COORD_14, 2026, 9, sondas)],
                ['NO_SE_SABE', 'NO_SE_SABE', 'REPORTADO']);
  });

  // --- API ----------------------------------------------------------------

  prueba('despachar: acción desconocida', function () {
    assertIgual(despachar({ accion: 'borrarTodo' }, {}).code, 'ACCION_DESCONOCIDA');
  });

  prueba('despachar: nombres heredados de Object no son acciones', function () {
    var tabla = { eco: function (p) { return p; } };
    assertIgual(['constructor', 'toString', '__proto__', 'hasOwnProperty'].map(function (a) {
      return despachar({ accion: a }, tabla).code;
    }), ['ACCION_DESCONOCIDA', 'ACCION_DESCONOCIDA', 'ACCION_DESCONOCIDA', 'ACCION_DESCONOCIDA']);
  });

  prueba('despachar: petición nula', function () {
    assertIgual([despachar(null, {}).code, despachar(undefined, {}).code],
                ['ACCION_DESCONOCIDA', 'ACCION_DESCONOCIDA']);
  });

  prueba('despachar: llama a la acción con la petición', function () {
    var tabla = { eco: function (p) { return { ok: true, dato: p.dato }; } };
    assertIgual(despachar({ accion: 'eco', dato: 7 }, tabla), { ok: true, dato: 7 });
  });

  prueba('despachar: una acción que lanza da ERROR_INTERNO sin filtrar el mensaje', function () {
    var tabla = { rota: function () { throw new Error('se cayó la hoja'); } };
    assertIgual(despachar({ accion: 'rota' }, tabla),
                { ok: false, code: 'ERROR_INTERNO', message: 'Ocurrió un error. Intente de nuevo.' });
  });

  // Las tareas siguientes agregan sus pruebas aquí, antes de esta línea.
}
