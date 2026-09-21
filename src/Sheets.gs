function _hoja(nombre) {
  return SpreadsheetApp.getActive().getSheetByName(nombre);
}

function leerTabla(nombre) {
  var hoja = _hoja(nombre);
  if (!hoja) return [];
  var datos = hoja.getDataRange().getValues();   // una sola lectura
  if (datos.length < 2) return [];
  var encabezados = datos[0];
  var filas = [];
  for (var i = 1; i < datos.length; i++) {
    var obj = {};
    for (var j = 0; j < encabezados.length; j++) {
      if (encabezados[j] !== '') obj[encabezados[j]] = datos[i][j];
    }
    filas.push(obj);
  }
  return filas;
}

function escribirFilas(nombre, objetos) {
  if (!objetos.length) return 0;
  var hoja = _hoja(nombre);
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var matriz = objetos.map(function (o) {
    return encabezados.map(function (h) {
      return o[h] === undefined || o[h] === null ? '' : o[h];
    });
  });
  hoja.getRange(hoja.getLastRow() + 1, 1, matriz.length, encabezados.length)
      .setValues(matriz);                        // una sola escritura
  return matriz.length;
}

function reemplazarFilas(nombre, objetos) {
  var hoja = _hoja(nombre);
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila > 1) {
    hoja.getRange(2, 1, ultimaFila - 1, hoja.getLastColumn()).clearContent();
  }
  return escribirFilas(nombre, objetos);
}

function leerCatalogo(nombre) {
  var cache = CacheService.getScriptCache();
  var crudo = cache.get('cat:' + nombre);
  if (crudo) return JSON.parse(crudo);
  var filas = leerTabla(nombre);
  cache.put('cat:' + nombre, JSON.stringify(filas), 1800);   // 30 minutos
  return filas;
}

function invalidarCatalogo(nombre) {
  CacheService.getScriptCache().remove('cat:' + nombre);
}

function verificarCapaDeHojas() {
  var hoja = SpreadsheetApp.getActive().insertSheet('_TMP_VERIF');
  hoja.getRange(1, 1, 1, 2).setValues([['clave', 'valor']]);

  escribirFilas('_TMP_VERIF', [{ clave: 'a', valor: 1 }, { clave: 'b', valor: 2 }]);
  Logger.log(leerTabla('_TMP_VERIF').length === 2 ? 'leerTabla ok' : 'leerTabla FALLA');
  Logger.log(hoja.getLastRow() === 3 ? 'escribirFilas ok' : 'escribirFilas FALLA');

  leerCatalogo('_TMP_VERIF');
  escribirFilas('_TMP_VERIF', [{ clave: 'c', valor: 3 }]);
  Logger.log(leerCatalogo('_TMP_VERIF').length === 2 ? 'caché ok' : 'caché FALLA');

  SpreadsheetApp.getActive().deleteSheet(hoja);
}
