// Un solo criterio de verdad para toda la aplicación. Google Sheets entrega
// la MISMA columna de dos formas distintas según cómo se llenó: una celda con
// casilla de verificación llega como booleano nativo, y una cargada desde CSV
// llega como el texto 'TRUE'. Comparar contra un literal rompe en cuanto
// alguien convierte la columna en casillas, y rompe en silencio.
//
// Todo lo que no sea un sí explícito cuenta como falso. Esa dirección importa:
// una celda vacía o corrupta debe quitarle el acceso a un usuario y dejar un
// destino fuera, nunca al revés.
function esVerdadero(valor) {
  if (valor === true) return true;
  if (valor === null || valor === undefined) return false;
  var s = String(valor).trim().toUpperCase();
  return s === 'TRUE' || s === 'VERDADERO' || s === 'SI' || s === 'SÍ' || s === '1';
}

// Sin acentos ni caracteres especiales: el texto se teclea en un celular y se
// dicta por teléfono.
function sinAcentos(texto) {
  var de = 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç';
  var a  = 'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc';
  var s = String(texto);
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var p = de.indexOf(s.charAt(i));
    out += p === -1 ? s.charAt(i) : a.charAt(p);
  }
  return out;
}
