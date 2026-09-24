// Corre los archivos .gs de lógica pura dentro de un contexto de Node.
// Se listan también archivos que MENCIONAN SpreadsheetApp, CacheService o
// PropertiesService: mientras solo lo hagan dentro de funciones, cargarlos no
// los ejecuta. Lo que de verdad toca la plataforma se verifica en el editor.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const PUROS = [
  'TestRunner.gs',
  'Claves.gs',
  'Credenciales.gs',
  'Usuarios.gs',
  'Boleto.gs',
  'Config.gs',
  'Auditoria.gs',
  'Acceso.gs',
  'Destinos.gs',
  'Api.gs',
  'Catalogos.generado.gs',

  'Tests.gs'
];

// Apps Script entrega los bytes CON SIGNO (-128..127). Se replica, porque el
// código que convierte bytes a hexadecimal depende de eso.
function conSigno(buf) {
  return Array.from(buf).map(function (b) { return b > 127 ? b - 256 : b; });
}

// Acepta lo mismo que Apps Script: una cadena (se toma en UTF-8) o un arreglo
// de bytes con signo.
function aBuffer(valor) {
  if (Array.isArray(valor)) return Buffer.from(valor.map(function (b) { return b & 0xFF; }));
  return Buffer.from(String(valor), 'utf8');
}

const UTILITIES = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest: function (_alg, texto) {
    return conSigno(crypto.createHash('sha256').update(aBuffer(texto)).digest());
  },
  computeHmacSha256Signature: function (valor, clave) {
    return conSigno(crypto.createHmac('sha256', aBuffer(clave)).update(aBuffer(valor)).digest());
  },
  // Igual que Apps Script: alfabeto web-safe (- y _) CON relleno '='.
  base64EncodeWebSafe: function (valor) {
    return aBuffer(valor).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  },
  base64DecodeWebSafe: function (texto) {
    return conSigno(Buffer.from(String(texto).replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  },
  newBlob: function (bytes) {
    return { getDataAsString: function () { return aBuffer(bytes).toString('utf8'); } };
  },
  getUuid: function () { return crypto.randomUUID(); }
};

const contexto = vm.createContext({
  Logger: { log: console.log },
  console: console,
  Utilities: UTILITIES
});

// Compatibilidad hacia atrás del boleto: el verificador que hoy corre en los
// hermanos (copia de Actividad Física) se carga en un contexto APARTE y se
// expone como verificarBoletoViejo. La prueba que lo usa se salta si la
// copia no está en esta máquina (y en el editor de Apps Script).
const BOLETO_VIEJO = path.join(__dirname, '..', '..', 'ACTIVIDAD FISICA', 'src', 'Boleto.gs');
if (fs.existsSync(BOLETO_VIEJO)) {
  const viejo = vm.createContext({ Utilities: UTILITIES });
  vm.runInContext(fs.readFileSync(BOLETO_VIEJO, 'utf8'), viejo, { filename: 'Boleto.viejo.gs' });
  contexto.verificarBoletoViejo = viejo.verificarBoleto;
}

for (const archivo of PUROS) {
  const ruta = path.join(__dirname, '..', 'src', archivo);
  if (!fs.existsSync(ruta)) continue;      // aún no existe: se agrega en su tarea
  vm.runInContext(fs.readFileSync(ruta, 'utf8'), contexto, { filename: archivo });
}

process.exit(contexto.runAllTests() === 0 ? 0 : 1);
