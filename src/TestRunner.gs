var _pruebas = [];

function prueba(nombre, fn) {
  _pruebas.push({ nombre: nombre, fn: fn });
}

// Compara por JSON.stringify. Tres puntos ciegos a tener presentes al escribir
// pruebas: (1) el orden de las claves importa — {a:1,b:2} no iguala a
// {b:2,a:1}; (2) las propiedades con valor `undefined` desaparecen al
// serializar; (3) `NaN` serializa igual que `null`.
function assertIgual(obtenido, esperado, mensaje) {
  var a = JSON.stringify(obtenido);
  var b = JSON.stringify(esperado);
  if (a !== b) {
    throw new Error((mensaje ? mensaje + ': ' : '') + 'esperado ' + b + ', obtenido ' + a);
  }
}

// Normaliza el mensaje de cualquier valor lanzado. Si el código bajo prueba
// hace `throw 'ALGO'` o `throw { code: 'ALGO' }` (común en APIs de Apps
// Script) en vez de `throw new Error(...)`, `e.message` es `undefined` y no
// hay que dejar que eso reviente con un TypeError que oculta la prueba real.
// Si además es un objeto plano sin `.message`, `String(e)` solo da
// "[object Object]" y pierde el contenido útil para el diagnóstico: se
// usa JSON.stringify en su lugar, con try/catch por si el objeto tiene
// referencias circulares (ahí sí cae a String(e) como último recurso).
function _mensajeDeError(e) {
  // Se comprueba el tipo, no la veracidad: `new Error('')` tiene un mensaje
  // válido pero vacío, y con `if (e && e.message)` caería en la rama de objeto.
  // JSON.stringify sobre un Error devuelve "{}" porque message y stack no son
  // enumerables en V8, así que el log diría "{}" en vez de una cadena vacía.
  if (e && typeof e.message === 'string') {
    return e.message;
  }
  if (e && typeof e === 'object') {
    try {
      return JSON.stringify(e);
    } catch (errorDeSerializacion) {
      return String(e);
    }
  }
  return String(e);
}

// codigoEsperado se busca como SUBCADENA del mensaje del error, no como
// igualdad exacta — las pruebas de validaciones y permisos dependen de esto.
function assertLanza(fn, codigoEsperado) {
  try {
    fn();
  } catch (e) {
    var mensaje = _mensajeDeError(e);
    if (codigoEsperado && mensaje.indexOf(codigoEsperado) === -1) {
      throw new Error('esperaba error ' + codigoEsperado + ', obtenido ' + mensaje);
    }
    return;
  }
  throw new Error('esperaba que lanzara ' + (codigoEsperado || 'un error'));
}

// registrarPruebas() es el único punto de registro de pruebas y debe existir
// en un solo archivo (Tests.gs). No lo dupliques en otro archivo: Apps Script
// cargaría ambas definiciones de función en el mismo espacio de nombres
// global y una sobrescribiría silenciosamente a la otra.
function runAllTests() {
  _pruebas = [];
  registrarPruebas();
  var fallas = 0;
  _pruebas.forEach(function (p) {
    try {
      p.fn();
      Logger.log('  ok  ' + p.nombre);
    } catch (e) {
      fallas++;
      Logger.log('FALLA  ' + p.nombre + ' — ' + _mensajeDeError(e));
    }
  });
  Logger.log(_pruebas.length + ' pruebas, ' + fallas + ' fallas');
  return fallas;
}
