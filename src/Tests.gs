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
                  destino: 'sips', vence: LUEGO, nombre: '', rol: '', unidad_id: '' });
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
                                       coordinacion_id: 'COOR01', rol: 'COORDINACION',
                                       unidad_id: '' } });
  });

  prueba('buscar usuario ignora mayúsculas y espacios', function () {
    assertIgual(_buscarUsuario([FILA_CHIAUTLA], '  ChiAutla ').usuario, 'chiautla');
    assertIgual(_buscarUsuario([FILA_CHIAUTLA], 'otra'), null);
  });

  prueba('cuenta del boleto: vigente y activa', function () {
    assertIgual(_cuentaDelBoleto({ ok: true, usuario: 'chiautla', coordinacion_id: 'COOR01' },
                                 [FILA_CHIAUTLA]),
                { ok: true, usuario: { usuario: 'chiautla', nombre: 'CHIAUTLA',
                                       coordinacion_id: 'COOR01', rol: 'COORDINACION',
                                       unidad_id: '' } });
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

  // --- Sondas nativas -----------------------------------------------------

  prueba('sonda nativa: la columna acepta NATIVA en hermanos, no en formularios', function () {
    var hermano = destino({ clase: 'HERMANO_CON_CONTRASENA', param_identidad: '', sonda: 'NATIVA',
                            url: 'https://script.google.com/macros/s/X/exec' });
    assertIgual([problemasDeDestino(hermano).length,
                 problemasDeDestino(destino({ sonda: 'NATIVA' })).length,
                 problemasDeDestino(destino({ sonda: 'INVENTADA' })).length,
                 problemasDeDestino(destino({ sonda: '' })).length],
                [0, 1, 1, 0]);
  });

  prueba('sonda nativa: la url lleva boleto y periodo', function () {
    var d = destino({ clase: 'HERMANO_CON_CONTRASENA', url: 'https://script.google.com/macros/s/X/exec' });
    assertIgual(urlDeSonda(d, 'AAA.BBB', 2026, 9),
                'https://script.google.com/macros/s/X/exec?sonda=AAA.BBB&anio=2026&mes=9');
  });

  prueba('sonda nativa: solo un 200 con JSON claro cuenta', function () {
    assertIgual([interpretarRespuestaSonda(200, '{"ok":true,"reportado":true,"unidades":2}'),
                 interpretarRespuestaSonda(200, '{"ok":true,"reportado":false}'),
                 interpretarRespuestaSonda(200, '{"ok":false,"code":"BOLETO_INVALIDO"}'),
                 interpretarRespuestaSonda(200, '{"ok":true,"reportado":"true"}'),
                 interpretarRespuestaSonda(200, '<html>login</html>'),
                 interpretarRespuestaSonda(500, '{"ok":true,"reportado":true}')],
                [{ ok: true, reportado: true }, { ok: true, reportado: false },
                 null, null, null, null]);
  });

  // --- url_sonda: pantalla fuera de Apps Script, sonda en el /exec ----------

  var EXEC_X = 'https://script.google.com/macros/s/X/exec';
  var PAGES_X = 'https://ejemplo.github.io/Portal/x/';

  prueba('url_sonda: la sonda usa url_sonda si la hay; si no, url', function () {
    var con = destino({ clase: 'HERMANO_CON_CONTRASENA', url: PAGES_X, url_sonda: EXEC_X });
    var vacia = destino({ clase: 'HERMANO_CON_CONTRASENA', url: EXEC_X, url_sonda: '  ' });
    var sin = destino({ clase: 'HERMANO_CON_CONTRASENA', url: EXEC_X });
    assertIgual([urlDeSonda(con, 'AAA.BBB', 2026, 9), urlDeSonda(vacia, 'AAA.BBB', 2026, 9),
                 urlDeSonda(sin, 'AAA.BBB', 2026, 9)],
                [EXEC_X + '?sonda=AAA.BBB&anio=2026&mes=9', EXEC_X + '?sonda=AAA.BBB&anio=2026&mes=9',
                 EXEC_X + '?sonda=AAA.BBB&anio=2026&mes=9']);
  });

  prueba('url_sonda: el botón sigue abriendo url', function () {
    var d = destino({ clase: 'HERMANO_CON_CONTRASENA', param_identidad: '', url: PAGES_X, url_sonda: EXEC_X,
                      sonda: 'NATIVA' });
    assertIgual(enlaceDeDestino(d, COORD_14, 'AAA.BBB'), PAGES_X + '?boleto=AAA.BBB');
  });

  prueba('url_sonda: NATIVA fuera de script.google.com la exige', function () {
    var base = { clase: 'HERMANO_CON_CONTRASENA', param_identidad: '', sonda: 'NATIVA' };
    function con(campos) { return destino(Object.assign({}, base, campos)); }
    assertIgual([problemasDeDestino(con({ url: PAGES_X })),
                 problemasDeDestino(con({ url: PAGES_X, url_sonda: EXEC_X })),
                 problemasDeDestino(con({ url: EXEC_X })),
                 problemasDeDestino(con({ url: PAGES_X, sonda: 'NINGUNA' })),
                 problemasDeDestino(con({ url: PAGES_X, url_sonda: 'http://x.com/exec' })),
                 problemasDeDestino(con({ url: PAGES_X, url_sonda: EXEC_X + '#a' }))],
                [['sonda NATIVA sin url_sonda'], [], [], [],
                 ['la url_sonda debe empezar con https://'], ['la url_sonda no debe llevar #']]);
  });

  prueba('url_sonda: la columna va al final de DESTINOS', function () {
    var destinos = _esquema().filter(function (par) { return par[0] === HOJAS.DESTINOS; })[0][1];
    assertIgual(destinos.slice(-2), ['activo', 'url_sonda']);
  });

  prueba('destinos conocidos: todos sirven; atención abre Pages y sondea el /exec', function () {
    DESTINOS_CONOCIDOS.forEach(function (d) { assertIgual(problemasDeDestino(d), [], d.destino_id); });
    var a = DESTINOS_CONOCIDOS.filter(function (d) { return d.destino_id === 'atencion'; })[0];
    assertIgual(a.url, 'https://oscarog23.github.io/PortalPromocion/atencion/');
    assertIgual(esUrlDeAppsScript(a.url_sonda), true);
    assertIgual(urlDeSonda(a, 'B', 2026, 9).indexOf(a.url_sonda + '?sonda=B'), 0);
  });

  prueba('destinos conocidos: copiar url y url_sonda solo a las filas listadas, una vez', function () {
    var filas = [
      { destino_id: 'atencion', nombre: 'Editado a mano', url: EXEC_X, url_sonda: '', sonda: 'NATIVA', orden: 9 },
      { destino_id: 'otro', nombre: 'Otro', url: EXEC_X, url_sonda: '' },
      { destino_id: ' sips ', url: 'https://viejo.example/exec' }
    ];
    var conocidos = [{ destino_id: 'atencion', url: PAGES_X, url_sonda: EXEC_X, nombre: 'N', orden: 5 },
                     { destino_id: 'sips', url: EXEC_X }];
    assertIgual(copiarUrlsConocidas(filas, conocidos),
                ['atencion.url -> ' + PAGES_X, 'atencion.url_sonda -> ' + EXEC_X, 'sips.url -> ' + EXEC_X]);
    assertIgual(filas, [
      { destino_id: 'atencion', nombre: 'Editado a mano', url: PAGES_X, url_sonda: EXEC_X, sonda: 'NATIVA', orden: 9 },
      { destino_id: 'otro', nombre: 'Otro', url: EXEC_X, url_sonda: '' },
      { destino_id: ' sips ', url: EXEC_X }
    ]);
    assertIgual(copiarUrlsConocidas(filas, conocidos), []);
  });

  // --- Perfiles (fase 7) --------------------------------------------------

  function idsDe(lista) { return lista.map(function (d) { return d.destino_id; }); }

  var FILAS_PERFIL = [
    destino({ destino_id: 'todas', orden: 4, aplica_a: 'TODAS' }),
    destino({ destino_id: 'lista', orden: 3, aplica_a: 'COOR01, COOR05' }),
    destino({ destino_id: 'nut', orden: 2, aplica_a: 'ROL:NUTRICION' }),
    destino({ destino_id: 'ambos', orden: 1, aplica_a: 'ROL:NUTRICION, ROL:PSICOLOGIA' }),
    destino({ destino_id: 'apagado', orden: 0, aplica_a: 'ROL:NUTRICION', activo: 'FALSE' }),
    destino({ destino_id: 'vacio', orden: 0, aplica_a: '' })
  ];

  prueba('rolDeCuenta: vacío es coordinación, se normaliza', function () {
    assertIgual([rolDeCuenta({}), rolDeCuenta({ rol: '' }), rolDeCuenta({ rol: ' nutricion ' }),
                 rolDeCuenta(null), rolDeCuenta({ rol: 'PSICOLOGIA' })],
                ['COORDINACION', 'COORDINACION', 'NUTRICION', 'COORDINACION', 'PSICOLOGIA']);
  });

  prueba('perfiles: la coordinación ve TODAS y su lista, nunca ROL:*', function () {
    assertIgual(idsDe(destinosDeCuenta(FILAS_PERFIL, { rol: 'COORDINACION', coordinacion_id: 'COOR05' })),
                ['lista', 'todas']);
    assertIgual(idsDe(destinosDeCuenta(FILAS_PERFIL, { rol: 'COORDINACION', coordinacion_id: 'COOR09' })),
                ['todas']);
  });

  prueba('perfiles: rol vacío es coordinación', function () {
    assertIgual(idsDe(destinosDeCuenta(FILAS_PERFIL, { rol: '', coordinacion_id: 'COOR05' })),
                ['lista', 'todas']);
  });

  prueba('perfiles: la persona ve solo ROL:<su rol>, nunca TODAS ni COORxx', function () {
    assertIgual(idsDe(destinosDeCuenta(FILAS_PERFIL, { rol: 'NUTRICION', coordinacion_id: 'COOR05' })),
                ['ambos', 'nut']);
  });

  prueba('perfiles: lista mezclada de roles vale para cada uno', function () {
    assertIgual(idsDe(destinosDeCuenta(FILAS_PERFIL, { rol: 'psicologia', coordinacion_id: 'COOR01' })),
                ['ambos']);
    assertIgual(idsDe(destinosDeCuenta(FILAS_PERFIL, { rol: 'PROMOTOR', coordinacion_id: 'COOR01' })),
                []);
  });

  prueba('perfiles: aplica_a vacío no aplica a nadie', function () {
    ['COORDINACION', 'NUTRICION', 'PSICOLOGIA', 'PROMOTOR'].forEach(function (rol) {
      assertIgual(idsDe(destinosDeCuenta([destino({ aplica_a: '' })],
                                         { rol: rol, coordinacion_id: 'COOR05' })), [], rol);
    });
  });

  prueba('perfiles: el alias de coordinación sigue igual', function () {
    assertIgual(idsDe(destinosDeCoordinacion(FILAS_PERFIL, 'COOR05')), ['lista', 'todas']);
  });

  prueba('advertencias: rol desconocido avisa pero no bloquea la fila', function () {
    var d = destino({ aplica_a: 'ROL:NUTRICION, ROL:XYZ' });
    assertIgual(problemasDeDestino(d), []);
    assertIgual(advertenciasDeDestino(d), ['rol desconocido en aplica_a: "ROL:XYZ"']);
    assertIgual(advertenciasDeDestino(destino({ aplica_a: 'ROL:NUTRICION,ROL:PSICOLOGIA' })), []);
    assertIgual(advertenciasDeDestino(destino({ aplica_a: 'ROL:COORDINACION' })),
                ['rol desconocido en aplica_a: "ROL:COORDINACION"']);
  });

  prueba('advertencias: la coordinación de una lista con rol desconocido conserva su enlace', function () {
    var d = destino({ clase: 'HERMANO_CON_CONTRASENA', param_identidad: '',
                      url: 'https://script.google.com/macros/s/X/exec', aplica_a: 'COOR05, ROL:XYZ' });
    assertIgual(idsDe(destinosDeCuenta([d], { rol: 'COORDINACION', coordinacion_id: 'COOR05' })), ['d1']);
    assertIgual(enlaceDeDestino(d, COORD_14, 'AAA.BBB'),
                'https://script.google.com/macros/s/X/exec?boleto=AAA.BBB');
  });

  prueba('aplica_a: ROL: se lee sin espacios, acentos ni mayúsculas', function () {
    var d = destino({ aplica_a: ' rol: Nutrición , ROL : PSICOLOGÍA' });
    assertIgual([idsDe(destinosDeCuenta([d], { rol: 'NUTRICION', coordinacion_id: 'COOR05' })),
                 idsDe(destinosDeCuenta([d], { rol: 'PSICOLOGIA', coordinacion_id: 'COOR05' }))],
                [['d1'], ['d1']]);
    assertIgual(advertenciasDeDestino(destino({ aplica_a: 'ROL: Nutrición' })), []);
  });

  prueba('aplica_a: TODAS vale solo como celda entera', function () {
    var enLista = destino({ aplica_a: 'TODAS, ROL:XYZ' });
    assertIgual([_aplicaA(destino({ aplica_a: ' todas ' }), 'COOR05'),
                 _aplicaA(destino({ aplica_a: 'TODAS, COOR01' }), 'COOR05'),
                 _aplicaA(destino({ aplica_a: 'COOR05, TODAS' }), 'COOR05'),
                 _aplicaA(enLista, 'COOR05')],
                [true, false, true, false]);
    assertIgual(problemasDeDestino(enLista), []);
    assertIgual(advertenciasDeDestino(enLista),
                ['TODAS dentro de una lista no cuenta: debe ir sola en la celda',
                 'rol desconocido en aplica_a: "ROL:XYZ"']);
  });

  prueba('cuenta: rol vacío con unidad no entra', function () {
    var sinRol = JSON.parse(JSON.stringify(FILA_CHIAUTLA));
    sinRol.rol = '';
    var conUnidad = JSON.parse(JSON.stringify(sinRol));
    conUnidad.unidad_id = 'U065';
    var inventado = JSON.parse(JSON.stringify(FILA_CHIAUTLA));
    inventado.rol = 'DENTAL';
    assertIgual([_resultadoAcceso(sinRol, 'chiautla26').ok,
                 _resultadoAcceso(conUnidad, 'chiautla26'),
                 _resultadoAcceso(inventado, 'chiautla26')],
                [true, _resultadoAcceso(null, 'x'), _resultadoAcceso(null, 'x')]);
    var boleto = { ok: true, usuario: 'chiautla', coordinacion_id: 'COOR01' };
    assertIgual([_cuentaDelBoleto(boleto, [sinRol]).ok,
                 _cuentaDelBoleto(boleto, [conUnidad]).code,
                 _cuentaDelBoleto(boleto, [inventado]).code],
                [true, 'BOLETO_INVALIDO', 'BOLETO_INVALIDO']);
  });

  // --- Boleto con rol y unidad (fase 7) -----------------------------------

  prueba('boleto sin extra: byte a byte el mismo que antes de la fase 7', function () {
    // Emitido con el código de la fase 6; si cambia, los boletos de las
    // coordinaciones cambiaron de forma.
    var fijo = 'eyJjIjoiQ09PUjAxIiwidSI6ImNoaWF1dGxhIiwiZCI6InNpcHMiLCJ2IjoxNzkwMDAzNjAwMDAwLCJu' +
               'IjoiQ0hJQVVUTEEifQ.32-Jip3MPdP13ZsBMWI1cDVyQRVhM7u75aJsZwvPgy4';
    assertIgual(emitirBoleto('chiautla', 'COOR01', 'sips', LUEGO, SECRETO, 'CHIAUTLA'), fijo);
    assertIgual(emitirBoleto('chiautla', 'COOR01', 'sips', LUEGO, SECRETO, 'CHIAUTLA', {}), fijo);
    assertIgual(emitirBoleto('chiautla', 'COOR01', 'sips', LUEGO, SECRETO, 'CHIAUTLA',
                             { r: '', x: '' }), fijo);
  });

  prueba('boleto: lleva rol y unidad firmados, después de las claves de siempre', function () {
    var b = emitirBoleto('rquintanarz', 'COOR05', 'atencion', LUEGO, SECRETO, 'ROSA QUINTANAR ZUBIETA',
                         { r: 'NUTRICION', x: 'U0123' });
    assertIgual(JSON.parse(_desdeB64(b.split('.')[0])),
                { c: 'COOR05', u: 'rquintanarz', d: 'atencion', v: LUEGO, n: 'ROSA QUINTANAR ZUBIETA',
                  r: 'NUTRICION', x: 'U0123' });
    assertIgual(verificarBoleto(b, SECRETO, 'atencion', AHORA),
                { ok: true, coordinacion_id: 'COOR05', usuario: 'rquintanarz', destino: 'atencion',
                  vence: LUEGO, nombre: 'ROSA QUINTANAR ZUBIETA', rol: 'NUTRICION',
                  unidad_id: 'U0123' });
  });

  prueba('boleto: sin rol ni unidad los devuelve vacíos', function () {
    var v = verificarBoleto(emitirBoleto('chiautla', 'COOR01', 'sips', LUEGO, SECRETO),
                            SECRETO, 'sips', AHORA);
    assertIgual([v.rol, v.unidad_id], ['', '']);
  });

  prueba('boleto: rol o unidad que no son texto lo invalidan', function () {
    function firmado(datos) {
      var cuerpo = _b64(JSON.stringify(datos));
      return cuerpo + '.' + _firma(cuerpo, SECRETO);
    }
    assertIgual([
      verificarBoleto(firmado({ c: 'COOR01', u: 'x', d: 'sips', v: LUEGO, r: 5 }), SECRETO, 'sips', AHORA).code,
      verificarBoleto(firmado({ c: 'COOR01', u: 'x', d: 'sips', v: LUEGO, x: ['U1'] }), SECRETO, 'sips', AHORA).code,
      verificarBoleto(firmado({ c: 'COOR01', u: 'x', d: 'sips', v: LUEGO, r: null }), SECRETO, 'sips', AHORA).code
    ], ['BOLETO_INVALIDO', 'BOLETO_INVALIDO', 'BOLETO_INVALIDO']);
  });

  prueba('boleto: un verificador viejo (Actividad Física) acepta rol y unidad', function () {
    // verificarBoletoViejo lo inyecta tools/run-tests.js desde la copia de
    // ACTIVIDAD FISICA/src/Boleto.gs; en el editor no existe y se salta.
    if (typeof verificarBoletoViejo !== 'function') return;
    var b = emitirBoleto('rquintanarz', 'COOR05', 'atencion', LUEGO, SECRETO, 'ROSA QUINTANAR ZUBIETA',
                         { r: 'PSICOLOGIA', x: 'U0123' });
    var v = verificarBoletoViejo(b, SECRETO, 'atencion', AHORA);
    assertIgual([v.ok, v.coordinacion_id, v.usuario, v.nombre],
                [true, 'COOR05', 'rquintanarz', 'ROSA QUINTANAR ZUBIETA']);
  });

  // --- Cuentas de persona (fase 7) ----------------------------------------
  // Nombres de persona FICTICIOS: el repositorio es público y no debe llevar
  // el padrón. Las unidades y sus CLUES sí son del catálogo público.

  prueba('cuenta pública: lleva rol y unidad, nunca sal ni huella', function () {
    var persona = { usuario: 'aperezl', nombre: 'ANA PÉREZ LÓPEZ', rol: 'NUTRICION',
                    coordinacion_id: 'COOR20', unidad_id: 'U065', sal: 's', huella: 'h',
                    activo: 'TRUE' };
    assertIgual(_cuentaPublica(persona),
                { usuario: 'aperezl', nombre: 'ANA PÉREZ LÓPEZ', coordinacion_id: 'COOR20',
                  rol: 'NUTRICION', unidad_id: 'U065' });
    assertIgual(_cuentaPublica({ usuario: 'x', nombre: 'X', coordinacion_id: 'COOR01', rol: '' }).rol,
                'COORDINACION');
  });

  prueba('normalizarClues: mayúsculas, sin espacios, O por 0 en la parte numérica', function () {
    assertIgual(['MCIMBO99999', ' mcimb 099999 ', 'MCSSA001904', 'mcssaoo19o4', '', null]
                  .map(normalizarClues),
                ['MCIMB099999', 'MCIMB099999', 'MCSSA001904', 'MCSSA001904', '', '']);
  });

  prueba('sinTitulo quita los títulos con o sin punto', function () {
    assertIgual(['L.N. ANA PÉREZ LÓPEZ', 'l.n.ANA PÉREZ', 'LIC. ANA PÉREZ', 'Lic ANA PÉREZ',
                 'PSIC. JUAN DE LA PEÑA SOTO', 'PSIC JUAN PEÑA', 'MTRO. JUAN PEÑA',
                 'Mtra. ANA PÉREZ', 'DR. JUAN PEÑA', 'DRA.  ANA   PÉREZ', 'LICONA RUIZ ANA',
                 'LIC. PSIC. ANA PÉREZ'
                ].map(sinTitulo),
                ['ANA PÉREZ LÓPEZ', 'ANA PÉREZ', 'ANA PÉREZ', 'ANA PÉREZ',
                 'JUAN DE LA PEÑA SOTO', 'JUAN PEÑA', 'JUAN PEÑA',
                 'ANA PÉREZ', 'JUAN PEÑA', 'ANA PÉREZ', 'LICONA RUIZ ANA', 'ANA PÉREZ']);
  });

  prueba('usuarioDePersona: inicial, primer apellido e inicial del segundo', function () {
    assertIgual([usuarioDePersona('L.N. ANA PÉREZ LÓPEZ'),
                 usuarioDePersona('PSIC. JUAN DE LA PEÑA SOTO'),
                 usuarioDePersona('LUISA MARÍA IBÁÑEZ QUINTANAR'),
                 usuarioDePersona('MARÍA DE LOS ÁNGELES QUINTANAR DEL OLMO'),
                 usuarioDePersona('ANA PÉREZ')],
                ['aperezl', 'jdelapenas', 'libanezq', 'mquintanard', 'aperez']);
  });

  prueba('usuarioDePersona: si choca lleva 2, 3…', function () {
    assertIgual([usuarioDePersona('ANA PÉREZ LÓPEZ', ['APEREZL']),
                 usuarioDePersona('ANA PÉREZ LÓPEZ', ['aperezl', 'aperezl2']),
                 usuarioDePersona('ANA PÉREZ LÓPEZ', ['otro'])],
                ['aperezl2', 'aperezl3', 'aperezl']);
  });

  var UNIDADES_PRUEBA = [
    { unidad_id: 'U900', clues: 'MCIMB099999', nombre_unidad: 'SAN FICTICIO', coordinacion_id: 'COOR09', activo: 'TRUE' },
    { unidad_id: 'U065', clues: 'MCSSA018226', nombre_unidad: 'CEAPS ACUITLAPILCO', coordinacion_id: 'COOR20', activo: 'TRUE' },
    { unidad_id: 'U901', clues: 'MCSSA000001', nombre_unidad: 'LA GEMELA', coordinacion_id: 'COOR01', activo: 'TRUE' },
    { unidad_id: 'U902', clues: 'MCSSA000002', nombre_unidad: 'C.S. LA GEMELA', coordinacion_id: 'COOR02', activo: 'TRUE' },
    { unidad_id: 'U903', clues: 'MCSSA000003', nombre_unidad: 'CERRADA', coordinacion_id: 'COOR03', activo: 'FALSE' }
  ];

  function idUnidad(fila, unidades) {
    var u = unidadDePersona(fila, unidades || UNIDADES_PRUEBA);
    return u ? u.unidad_id : null;
  }

  prueba('unidadDePersona: primero por CLUES normalizada', function () {
    assertIgual([idUnidad({ unidad: 'OTRO NOMBRE', clues: 'MCIMBO99999' }),
                 idUnidad({ unidad: '', clues: 'mcssa018226' })],
                ['U900', 'U065']);
  });

  prueba('unidadDePersona: nombre exacto gana; si no, sin prefijos en ambos lados', function () {
    assertIgual([idUnidad({ unidad: 'CEAPS Acuitlapilco', clues: '' }),
                 idUnidad({ unidad: 'C.E.A.P.S. ACUITLAPILCO', clues: 'NOEXISTE' }),
                 idUnidad({ unidad: 'Centro de Salud San Ficticio', clues: '' }),
                 idUnidad({ unidad: 'C.S.U. SAN FICTICIO', clues: '' }),
                 idUnidad({ unidad: 'LA GEMELA', clues: '' }),
                 idUnidad({ unidad: 'c.s. la gemela', clues: '' })],
                ['U065', 'U065', 'U900', 'U900', 'U901', 'U902']);
  });

  prueba('unidadDePersona: ambigua, inactiva o inexistente no cruza', function () {
    assertIgual([idUnidad({ unidad: 'CENTRO DE SALUD LA GEMELA', clues: '' }),
                 idUnidad({ unidad: 'CERRADA', clues: '' }),
                 idUnidad({ unidad: 'NINGUNA', clues: '' }),
                 idUnidad({ unidad: '', clues: '' })],
                [null, null, null, null]);
  });

  // El catálogo real (Catalogos.generado.gs), con los casos que confunden.
  var UNIDADES_REALES = CSV_UNIDADES.split('\n').slice(1).map(function (linea) {
    var c = linea.split(',');
    return { unidad_id: c[0], clues: c[1], nombre_unidad: c[2], coordinacion_id: c[4], activo: c[6] };
  });

  prueba('unidadDePersona: catálogo real, sin cruzar por subcadena', function () {
    assertIgual([idUnidad({ unidad: 'CEAPS CHIAUTLA', clues: '' }, UNIDADES_REALES),
                 idUnidad({ unidad: 'Ceaps Santa Elena', clues: '' }, UNIDADES_REALES),
                 idUnidad({ unidad: 'CEAPS SANTA MARIA CHIMALHUACAN', clues: '' }, UNIDADES_REALES),
                 idUnidad({ unidad: 'San Andres Chiautla', clues: '' }, UNIDADES_REALES),
                 idUnidad({ unidad: 'COL. SANTA ROSA', clues: '' }, UNIDADES_REALES),
                 idUnidad({ unidad: 'SANTA ROSA', clues: '' }, UNIDADES_REALES)],
                ['U012', 'U063', 'U053', 'U001', 'U023', null]);
  });

  // azar determinista: devuelve 0, 1, 2… módulo n.
  function azarEnSerie() {
    var i = 0;
    return function (n) { return (i++) % n; };
  }

  prueba('contrasenaAleatoria: 10 caracteres del alfabeto sin ambiguos', function () {
    assertIgual(contrasenaAleatoria(azarEnSerie()), 'abcdefghjk');
    assertIgual(contrasenaAleatoria(function (n) { return n - 1; }), '9999999999');
    for (var i = 0; i < 50; i++) {
      var c = contrasenaAleatoria();
      assertIgual(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/.test(c), true, c);
    }
  });

  prueba('azar seguro: sin sesgo, siempre dentro del rango', function () {
    var azar = _azarSeguro();
    var vistos = {};
    for (var i = 0; i < 2000; i++) {
      var n = azar(31);
      if (n < 0 || n >= 31 || n !== Math.floor(n)) throw new Error('fuera de rango: ' + n);
      vistos[n] = true;
    }
    assertIgual(Object.keys(vistos).length, 31);
  });

  prueba('plan de personal: crea solo lo que falta, con unidad y coordinación', function () {
    var personal = [
      { nombre: 'L.N. ANA PÉREZ LÓPEZ', rol: 'nutricion', unidad: 'CEAPS ACUITLAPILCO', clues: '', activo: 'TRUE' },
      { nombre: 'PSIC. JUAN DE LA PEÑA SOTO', rol: 'PSICOLOGIA', unidad: '', clues: 'MCIMBO99999', activo: 'TRUE' },
      { nombre: 'LIC. ANA PEREZ LOPEZ', rol: 'PSICOLOGIA', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' },
      { nombre: 'DRA. YA TIENE CUENTA', rol: 'NUTRICION', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' },
      { nombre: 'BAJA DE PRUEBA', rol: 'NUTRICION', unidad: 'SAN FICTICIO', clues: '', activo: 'FALSE' }
    ];
    var existentes = [
      { usuario: 'chiautla', nombre: 'CHIAUTLA', rol: 'COORDINACION', coordinacion_id: 'COOR01' },
      { usuario: 'ytienec', nombre: 'YA TIENE CUENTA', rol: 'NUTRICION', coordinacion_id: 'COOR09' }
    ];
    var plan = planDeCuentasDePersonal(personal, existentes, UNIDADES_PRUEBA, azarEnSerie());
    assertIgual(plan.problemas, []);
    assertIgual(plan.crear.map(function (c) {
      return [c.usuario, c.nombre, c.rol, c.coordinacion_id, c.unidad_id, c.unidad, c.contrasena];
    }), [
      ['aperezl', 'ANA PÉREZ LÓPEZ', 'NUTRICION', 'COOR20', 'U065', 'CEAPS ACUITLAPILCO', 'abcdefghjk'],
      ['jdelapenas', 'JUAN DE LA PEÑA SOTO', 'PSICOLOGIA', 'COOR09', 'U900', 'SAN FICTICIO', 'mnpqrstuvw'],
      // misma persona con otro rol: otra cuenta, usuario con sufijo
      ['aperezl2', 'ANA PEREZ LOPEZ', 'PSICOLOGIA', 'COOR09', 'U900', 'SAN FICTICIO', 'xyz2345678']
    ]);
  });

  prueba('plan de personal: rol inválido, unidad sin cruzar y repetidos se reportan', function () {
    var personal = [
      { nombre: 'ANA PÉREZ LÓPEZ', rol: 'COORDINACION', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' },
      { nombre: 'ANA PÉREZ LÓPEZ', rol: 'DENTAL', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' },
      { nombre: 'JUAN PEÑA SOTO', rol: 'NUTRICION', unidad: 'CENTRO DE SALUD LA GEMELA', clues: '', activo: 'TRUE' },
      { nombre: 'LUIS GIL RUIZ', rol: 'PROMOTOR', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' },
      { nombre: 'L.N. LUIS GIL RUIZ', rol: 'promotor', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' },
      { nombre: '', rol: 'NUTRICION', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' },
      { nombre: '— · —', rol: 'NUTRICION', unidad: 'SAN FICTICIO', clues: '', activo: 'TRUE' }
    ];
    var plan = planDeCuentasDePersonal(personal, [], UNIDADES_PRUEBA, azarEnSerie());
    assertIgual(plan.crear.map(function (c) { return c.usuario; }), ['lgilr']);
    // fila = renglón de la hoja PERSONAL (el 1 es el encabezado)
    assertIgual(plan.problemas.map(function (p) { return p.fila; }), [2, 3, 4, 6, 7, 8]);
    assertIgual(plan.problemas[5].motivo, 'nombre sin letras');
  });

  // --- La máscara con cuentas de persona (fase 7) --------------------------

  var CUENTA_COORD = { usuario: 'chiautla', nombre: 'CHIAUTLA', coordinacion_id: 'COOR01',
                       rol: 'COORDINACION', unidad_id: '' };
  var CUENTA_PERSONA = { usuario: 'aperezl', nombre: 'ANA PÉREZ LÓPEZ', coordinacion_id: 'COOR20',
                         rol: 'NUTRICION', unidad_id: 'U065' };

  prueba('boleto de destino: el de una coordinación no cambió ni un byte', function () {
    assertIgual(boletoParaDestino(CUENTA_COORD, 'sips', LUEGO, SECRETO),
                'eyJjIjoiQ09PUjAxIiwidSI6ImNoaWF1dGxhIiwiZCI6InNpcHMiLCJ2IjoxNzkwMDAzNjAwMDAwLCJu' +
                'IjoiQ0hJQVVUTEEifQ.32-Jip3MPdP13ZsBMWI1cDVyQRVhM7u75aJsZwvPgy4');
    // Sin rol (cuenta de antes de la fase 7) es lo mismo.
    assertIgual(boletoParaDestino({ usuario: 'chiautla', nombre: 'CHIAUTLA', coordinacion_id: 'COOR01' },
                                  'sips', LUEGO, SECRETO),
                boletoParaDestino(CUENTA_COORD, 'sips', LUEGO, SECRETO));
  });

  prueba('boleto de destino: el de una persona lleva su usuario, nombre, rol y unidad', function () {
    var v = verificarBoleto(boletoParaDestino(CUENTA_PERSONA, 'atencion', LUEGO, SECRETO),
                            SECRETO, 'atencion', AHORA);
    assertIgual(v, { ok: true, coordinacion_id: 'COOR20', usuario: 'aperezl', destino: 'atencion',
                     vence: LUEGO, nombre: 'ANA PÉREZ LÓPEZ', rol: 'NUTRICION', unidad_id: 'U065' });
  });

  prueba('datos del boleto: sonda de coordinación es "mascara", de persona es ella', function () {
    assertIgual(datosDeBoletoDeSonda(CUENTA_COORD),
                { usuario: 'mascara', nombre: 'CHIAUTLA', extra: null });
    assertIgual(datosDeBoletoDeSonda(CUENTA_PERSONA),
                { usuario: 'aperezl', nombre: 'ANA PÉREZ LÓPEZ',
                  extra: { r: 'NUTRICION', x: 'U065' } });
    assertIgual(datosDeBoletoParaDestino(CUENTA_COORD),
                { usuario: 'chiautla', nombre: 'CHIAUTLA', extra: null });
  });

  prueba('boleto de sonda: coordinación igual que antes, persona con sus datos', function () {
    assertIgual(boletoDeSonda(CUENTA_COORD, 'sips', LUEGO, SECRETO),
                emitirBoleto('mascara', 'COOR01', 'sonda:sips', LUEGO, SECRETO, 'CHIAUTLA'));
    var v = verificarBoleto(boletoDeSonda(CUENTA_PERSONA, 'atencion', LUEGO, SECRETO),
                            SECRETO, 'sonda:atencion', AHORA);
    assertIgual([v.usuario, v.rol, v.unidad_id], ['aperezl', 'NUTRICION', 'U065']);
  });

  prueba('clave de sonda: coordinación sin cambio, persona con su usuario', function () {
    assertIgual([claveDeSonda('sips', CUENTA_COORD, 2026, 9),
                 claveDeSonda('atencion', CUENTA_PERSONA, 2026, 9)],
                ['sonda:sips:COOR01:2026-9', 'sonda:atencion:COOR20:aperezl:2026-9']);
  });

  prueba('nombre de la unidad por id: persona sí, coordinación vacío', function () {
    var unidades = [{ unidad_id: 'U065', nombre_unidad: 'CEAPS ACUITLAPILCO' }];
    assertIgual([nombreDeUnidadPorId(unidades, 'U065'), nombreDeUnidadPorId(unidades, ''),
                 nombreDeUnidadPorId(unidades, 'U999')],
                ['CEAPS ACUITLAPILCO', '', '']);
  });

  // Las tareas siguientes agregan sus pruebas aquí, antes de esta línea.
}
