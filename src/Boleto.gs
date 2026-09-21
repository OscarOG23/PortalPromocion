// El boleto dice QUIÉN es y PARA QUÉ destino, hasta CUÁNDO. Nunca qué puede
// hacer: cada destino vuelve a resolver los permisos contra su propia regla.
//
// Formato (es contrato con los capturadores hermanos, que lo verificarán con
// el mismo secreto):
//
//   base64url(JSON {c, u, d, v}) + '.' + base64url(HMAC-SHA256(cuerpo, secreto))
//
//   c = coordinacion_id   u = usuario   d = destino_id ('portal' para la sesión)
//   v = vencimiento, en milisegundos desde época
//
// Sin relleno '=': el boleto viaja en una URL y '=' ahí es ambiguo.

var DESTINO_PORTAL = 'portal';
var VIDA_BOLETO_PORTAL_DIAS = 30;
var VIDA_BOLETO_DESTINO_HORAS = 8;

function _b64(texto) {
  return Utilities.base64EncodeWebSafe(texto, Utilities.Charset.UTF_8).replace(/=+$/, '');
}

function _desdeB64(texto) {
  var s = String(texto);
  var relleno = (4 - s.length % 4) % 4;
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(s + '==='.slice(0, relleno)))
                  .getDataAsString();
}

function _firma(cuerpo, secreto) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(cuerpo, secreto))
                  .replace(/=+$/, '');
}

// Comparación de tiempo constante: con `===` la respuesta tarda más cuanto
// más caracteres coinciden, y eso permite adivinar una firma por partes.
function _mismaCadena(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var diferencia = 0;
  for (var i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

function emitirBoleto(usuario, coordinacionId, destino, vence, secreto) {
  if (!secreto) throw new Error('SIN_SECRETO: falta SECRETO_BOLETOS en las propiedades del script.');
  var cuerpo = _b64(JSON.stringify({ c: coordinacionId, u: usuario, d: destino, v: vence }));
  return cuerpo + '.' + _firma(cuerpo, secreto);
}

// La firma se comprueba ANTES que el vencimiento: a un boleto alterado no se
// le cree nada, ni siquiera que está vencido.
function verificarBoleto(boleto, secreto, destino, ahora) {
  var invalido = { ok: false, code: 'BOLETO_INVALIDO',
                   message: 'El acceso no es válido. Vuelva a entrar.' };
  if (!secreto) return invalido;
  var partes = String(boleto || '').split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return invalido;
  if (!_mismaCadena(_firma(partes[0], secreto), partes[1])) return invalido;

  var datos;
  try { datos = JSON.parse(_desdeB64(partes[0])); } catch (e) { return invalido; }
  if (!datos || !datos.c || !datos.u || datos.d !== destino) return invalido;

  if (!(Number(datos.v) > Number(ahora))) {
    return { ok: false, code: 'BOLETO_VENCIDO', message: 'Su acceso venció. Vuelva a entrar.' };
  }
  return { ok: true, coordinacion_id: datos.c, usuario: datos.u, destino: datos.d, vence: datos.v };
}
