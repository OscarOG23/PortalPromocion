# La máscara — Fase 1: Portal solo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página en GitHub Pages donde cada una de las 22 coordinaciones entra una vez con usuario y contraseña, y ve la lista de capturadores que le tocan, cada uno con su enlace (pre-llenado o con boleto firmado) y su estado del mes.

**Architecture:** Un proyecto de Apps Script (`src/`, subido con `clasp`) que solo responde JSON por `doPost`: valida credenciales contra la hoja `USUARIOS`, emite boletos firmados con HMAC-SHA256 y arma la lista de destinos a partir de la hoja `DESTINOS`. La pantalla es HTML estático en `web/`, publicado en GitHub Pages por una GitHub Action; habla con el Apps Script por `fetch` con `Content-Type: text/plain` (sin preflight CORS). La lógica pura se prueba en Node con `tools/run-tests.js`.

**Tech Stack:** Google Apps Script (V8), Google Sheets, `clasp` 3.x, Node 24 (solo para pruebas), HTML/CSS/JS sin dependencias, GitHub Pages + GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-09-21-mascara-de-acceso-unico-design.md](../specs/2026-09-21-mascara-de-acceso-unico-design.md) — este plan cubre solo el paso 1 del §10 («Portal solo»). Los pasos 2–5 tocan otros repositorios y van en planes aparte.

---

## Decisiones que este plan fija (y que la spec dejaba abiertas)

1. **Contraseña deducible `usuario + '26'`, igual que Determinantes.** Decisión explícita del usuario (2026-09-21), tomada sabiendo que la página es pública en GitHub Pages: ya no existe la barrera de «no publicar la URL». Cualquiera que conozca el nombre de una coordinación y encuentre la página puede entrar como ella a todos sus capturadores. Esto se deja escrito en el código (`Usuarios.gs`) y en el README. Si algún día se endurece, se cambia `contrasenaDeUsuario`, se corre `crearCuentasDeCoordinaciones()` y se reparten las nuevas: nada más depende de eso.
2. **La sesión del portal ES un boleto, sin estado en el servidor.** Determinantes guarda el testigo en caché + propiedades; aquí basta la firma: `iniciarSesion` emite un boleto para el destino `portal` con vida de 30 días, y cada llamada lo verifica. Consecuencias:
   - «Salir» borra el boleto del teléfono; el servidor no guarda nada que borrar.
   - Para dejar fuera a una cuenta **sin esperar 30 días**: poner `activo = FALSE` en `USUARIOS` (se comprueba en cada llamada), o rotar el secreto (`generarSecretoDeBoletos(true)`), que corta a todas.
3. **Cada destino recibe su propio boleto de 8 horas**, marcado con su `destino_id`. El de 30 días nunca sale del portal: el de un destino viaja en la URL y queda en historiales. Un boleto de SIPS no abre Determinantes.
4. **Formato del boleto** (lo tendrán que verificar los hermanos en la Fase 2, así que es contrato):
   `base64url(JSON {c, u, d, v}) + '.' + base64url(HMAC-SHA256(cuerpo, secreto))`, sin relleno `=`.
   `c` = `coordinacion_id`, `u` = usuario, `d` = `destino_id` (o `portal`), `v` = vencimiento en milisegundos desde época.
   El secreto vive en `ScriptProperties` con la clave `SECRETO_BOLETOS`; en la Fase 2 se copia a cada hermano.
5. **Solo las 22 cuentas de coordinación.** No hay cuenta de administrador en el portal: la jurisdicción administra desde el editor de Apps Script y la hoja.
6. **Errores con `ok`, no `success`**: `{ ok: false, code, message }`, como dice la spec §7. Se agregan dos códigos que la spec no nombra porque son de transporte: `PETICION_INVALIDA` (cuerpo que no es JSON) y `ACCION_DESCONOCIDA`, además de `ERROR_INTERNO`.
7. **Sondas en la Fase 1: solo la maquinaria.** Existe el registro `SONDAS` (vacío) y la regla dura probada: sin sonda, con sonda caída o con respuesta ambigua, el estado es `NO_SE_SABE` (gris). Las sondas reales (nativa, hoja de respuestas) son el paso 5 de la spec.

## Estructura de archivos

```
PortalPromocion/
├── .gitignore
├── .clasp.json                    (NO se versiona: lleva el scriptId)
├── README.md                      qué es, cómo se despliega, riesgos aceptados
├── .github/workflows/pages.yml    publica web/ en GitHub Pages
├── tools/run-tests.js             corredor de pruebas en Node (shim de Utilities)
├── src/                           Apps Script (rootDir de clasp)
│   ├── appsscript.json
│   ├── TestRunner.gs              prueba / assertIgual / assertLanza / runAllTests   (copia)
│   ├── Tests.gs                   registrarPruebas(): ÚNICO punto de registro
│   ├── Claves.gs                  esVerdadero, sinAcentos                            (copia)
│   ├── Credenciales.gs            sal + huella SHA-256                               (copia)
│   ├── Usuarios.gs                usuario y contraseña derivados del nombre          (copia)
│   ├── Boleto.gs                  emitirBoleto / verificarBoleto (HMAC)              (nuevo, puro)
│   ├── Config.gs                  HOJAS, getConfig, secretoDeBoletos
│   ├── Auditoria.gs               registrarEvento
│   ├── Acceso.gs                  iniciarSesion, usuarioDeBoleto, bloqueo por intentos
│   ├── Destinos.gs                directorio, enlaces, estados y sondas             (nuevo, puro)
│   ├── Api.gs                     doGet, doPost, despachar, contextoDeBoleto
│   ├── Sheets.gs                  leerTabla / escribirFilas / leerCatalogo           (copia)
│   ├── Catalogos.generado.gs      22 coordinaciones + 69 unidades                    (copia literal)
│   └── Setup.gs                   hojas, universo, cuentas, secreto, verificaciones
└── web/                           GitHub Pages
    ├── index.html
    ├── estilos.css
    ├── config.js                  ENDPOINT del /exec
    └── app.js
```

Fuente de las copias: `C:\Users\oscda\PROYECTOS ISEM\DeterminantesConcentrado\src\`. En el texto se abrevia `DET/src/`.

---

### Task 0: Esqueleto y corredor de pruebas

**Goal:** Un repositorio con el corredor de pruebas de Node funcionando, capaz de simular `Utilities` (SHA-256, HMAC, base64 web-safe) igual que Apps Script.

**Files:**
- Create: `.gitignore`
- Create: `tools/run-tests.js`
- Create: `src/TestRunner.gs` (copia literal de `DET/src/TestRunner.gs`)
- Create: `src/Tests.gs`

**Acceptance Criteria:**
- [ ] `node tools/run-tests.js` imprime `1 pruebas, 0 fallas` y sale con código 0
- [ ] El shim de `Utilities` devuelve bytes **con signo** (como Apps Script) en `computeDigest`, `computeHmacSha256Signature` y `base64DecodeWebSafe`

**Verify:** `node tools/run-tests.js` → última línea `1 pruebas, 0 fallas`, `echo $?` → `0`

**Steps:**

- [ ] **Step 1: `.gitignore`**

```gitignore
# clasp: el scriptId y las credenciales no se versionan
.clasp.json
.clasprc.json

# Sistema
Thumbs.db
Desktop.ini
.DS_Store

# Temporales de Office
~$*
```

- [ ] **Step 2: Copiar el corredor de Apps Script**

```bash
cp "/c/Users/oscda/PROYECTOS ISEM/DeterminantesConcentrado/src/TestRunner.gs" src/TestRunner.gs
```

- [ ] **Step 3: `src/Tests.gs`**

```js
// registrarPruebas() es el único punto de registro de pruebas y existe SOLO
// en este archivo. Apps Script carga todos los .gs en un mismo espacio global:
// una segunda definición en otro archivo sobrescribiría a esta sin avisar.
function registrarPruebas() {
  prueba('el corredor corre', function () {
    assertIgual(1 + 1, 2);
  });

  // Las tareas siguientes agregan sus pruebas aquí, antes de esta línea.
}
```

- [ ] **Step 4: `tools/run-tests.js`**

```js
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

const contexto = vm.createContext({
  Logger: { log: console.log },
  Utilities: {
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
  }
});

for (const archivo of PUROS) {
  const ruta = path.join(__dirname, '..', 'src', archivo);
  if (!fs.existsSync(ruta)) continue;      // aún no existe: se agrega en su tarea
  vm.runInContext(fs.readFileSync(ruta, 'utf8'), contexto, { filename: archivo });
}

process.exit(contexto.runAllTests() === 0 ? 0 : 1);
```

- [ ] **Step 5: Correr**

Run: `node tools/run-tests.js`
Expected: `  ok  el corredor corre` y `1 pruebas, 0 fallas`

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/run-tests.js src/TestRunner.gs src/Tests.gs
git commit -m "chore: esqueleto de la mascara y corredor de pruebas en Node"
```

---

### Task 1: Piezas copiadas de Determinantes (claves, credenciales, usuarios)

**Goal:** Traer las funciones puras de identidad de Determinantes, con pruebas que fijen su comportamiento en este proyecto.

**Files:**
- Create: `src/Claves.gs`
- Create: `src/Credenciales.gs` (copia literal de `DET/src/Credenciales.gs`)
- Create: `src/Usuarios.gs`
- Modify: `src/Tests.gs`

**Acceptance Criteria:**
- [ ] `huellaContrasena('a', 'bc')` coincide con el vector conocido de SHA-256 de `'abc'` (prueba que el shim y el paso a hexadecimal manejan bytes con signo)
- [ ] `usuarioDeCoordinacion('CEAPS SANTA MARÍA CHIMALHUACAN')` → `'ceapssantamariachimalhuacan'`
- [ ] `esVerdadero` solo acepta un sí explícito

**Verify:** `node tools/run-tests.js` → `8 pruebas, 0 fallas`

**Steps:**

- [ ] **Step 1: Escribir las pruebas que fallan** — en `src/Tests.gs`, insertar antes de la línea `// Las tareas siguientes agregan sus pruebas aquí, antes de esta línea.`:

```js
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
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node tools/run-tests.js`
Expected: `8 pruebas, 7 fallas` (con `esVerdadero is not defined`, etc.)

- [ ] **Step 3: `src/Claves.gs`** — `esVerdadero` sale de `DET/src/Claves.gs` y `sinAcentos` de `DET/src/Nombres.gs`; aquí viven juntas porque son los dos normalizadores que usa el portal:

```js
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
```

- [ ] **Step 4: `src/Credenciales.gs`** — copia literal:

```bash
cp "/c/Users/oscda/PROYECTOS ISEM/DeterminantesConcentrado/src/Credenciales.gs" src/Credenciales.gs
```

- [ ] **Step 5: `src/Usuarios.gs`** — la misma lógica que `DET/src/Usuarios.gs`, con el comentario de la contraseña reescrito para el contexto nuevo (página pública):

```js
// El usuario sale del nombre de la coordinación: 'CEAPS SANTA ROSA' da
// 'ceapssantarosa'. Se quitan acentos, espacios y signos porque este texto se
// teclea en un celular y se dicta por teléfono.
function usuarioDeCoordinacion(nombre) {
  return sinAcentos(String(nombre))
           .toLowerCase()
           .replace(/[^a-z0-9]/g, '');
}

// La contraseña es el usuario con '26' al final. Es DEDUCIBLE a propósito, por
// decisión explícita del usuario (2026-09-21), la misma que en Determinantes.
//
// Aquí pesa más que allá, y quedó dicho al decidir: la máscara se sirve desde
// GitHub Pages, que es público, así que ya no existe la barrera de "no
// publicar la URL". Quien sepa el nombre de una coordinación y encuentre la
// página entra como ella a TODOS sus capturadores.
//
// Para endurecerla basta cambiar esta función, correr
// crearCuentasDeCoordinaciones() y repartir las nuevas: nada más depende de
// cómo se forma la contraseña.
function contrasenaDeUsuario(usuario) {
  return usuario + '26';
}
```

- [ ] **Step 6: Correr y ver que pasan**

Run: `node tools/run-tests.js`
Expected: `8 pruebas, 0 fallas`

- [ ] **Step 7: Commit**

```bash
git add src/Claves.gs src/Credenciales.gs src/Usuarios.gs src/Tests.gs
git commit -m "feat: normalizadores, credenciales y usuarios copiados de Determinantes"
```

---

### Task 2: El boleto firmado

**Goal:** `emitirBoleto` y `verificarBoleto`: un boleto seguro para URL, firmado con HMAC-SHA256, que dice quién es, para qué destino y hasta cuándo.

**Files:**
- Create: `src/Boleto.gs`
- Modify: `src/Tests.gs`

**Acceptance Criteria:**
- [ ] Ida y vuelta conserva `coordinacion_id`, `usuario`, `destino` y `vence`, incluso con caracteres no ASCII
- [ ] El boleto solo contiene `[A-Za-z0-9_.-]` (va en una URL sin escapar)
- [ ] Otro secreto, cuerpo alterado, otro destino o basura → `BOLETO_INVALIDO`
- [ ] Vencido → `BOLETO_VENCIDO`; vencido **y** alterado → `BOLETO_INVALIDO` (la firma se revisa primero)
- [ ] Emitir sin secreto lanza `SIN_SECRETO`

**Verify:** `node tools/run-tests.js` → `17 pruebas, 0 fallas`

**Steps:**

- [ ] **Step 1: Escribir las pruebas que fallan** — en `src/Tests.gs`, antes de la línea marcador:

```js
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
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node tools/run-tests.js`
Expected: `17 pruebas, 9 fallas` (`emitirBoleto is not defined`)

- [ ] **Step 3: `src/Boleto.gs`**

```js
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
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `node tools/run-tests.js`
Expected: `17 pruebas, 0 fallas`

- [ ] **Step 5: Commit**

```bash
git add src/Boleto.gs src/Tests.gs
git commit -m "feat: boleto firmado con HMAC para la sesion y los destinos"
```

---

### Task 3: Acceso — configuración, bitácora, sesión y bloqueo

**Goal:** Iniciar sesión con usuario y contraseña (con bloqueo tras 5 intentos), recibir el boleto del portal y, en cada llamada, resolver la cuenta a partir de él.

**Files:**
- Create: `src/Config.gs`
- Create: `src/Auditoria.gs`
- Create: `src/Acceso.gs`
- Modify: `src/Tests.gs`

**Acceptance Criteria:**
- [ ] Usuario inexistente, inactivo o contraseña equivocada dan **exactamente** el mismo objeto de error
- [ ] La búsqueda del usuario ignora mayúsculas y espacios alrededor (teclado de celular)
- [ ] Un boleto válido de una cuenta dada de baja, o cuya coordinación cambió, es `BOLETO_INVALIDO`
- [ ] Una acción de bitácora inventada lanza `ACCION_INVALIDA` antes de tocar la hoja

**Verify:** `node tools/run-tests.js` → `28 pruebas, 0 fallas`

**Steps:**

- [ ] **Step 1: Escribir las pruebas que fallan** — en `src/Tests.gs`, antes de la línea marcador:

```js
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
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node tools/run-tests.js`
Expected: `28 pruebas, 11 fallas`

- [ ] **Step 3: `src/Config.gs`**

```js
var HOJAS = {
  CONFIG: 'CONFIG',
  COORDINACIONES: 'CAT_COORDINACIONES',
  UNIDADES: 'CAT_UNIDADES',
  USUARIOS: 'USUARIOS',
  DESTINOS: 'DESTINOS',
  AUDITORIA: 'AUDITORIA'
};

var PROPIEDAD_SECRETO = 'SECRETO_BOLETOS';

function getConfig(clave) {
  var filas = leerCatalogo(HOJAS.CONFIG);
  for (var i = 0; i < filas.length; i++) {
    if (filas[i].clave === clave) return filas[i].valor;
  }
  return null;
}

// El secreto no vive en la hoja: quien pueda leer la hoja no debe poder
// fabricar boletos. Se crea con generarSecretoDeBoletos() (Setup.gs).
function secretoDeBoletos() {
  var s = PropertiesService.getScriptProperties().getProperty(PROPIEDAD_SECRETO);
  if (!s) throw new Error('SIN_SECRETO: ejecute generarSecretoDeBoletos() en el editor.');
  return s;
}
```

- [ ] **Step 4: `src/Auditoria.gs`**

```js
var ACCIONES_AUDITABLES = ['INGRESO', 'RESTABLECER_CONTRASENA', 'ROTAR_SECRETO'];

// La acción se valida antes de tocar la hoja, para que sea comprobable sin
// SpreadsheetApp: una acción inventada nunca llega a escribirFilas.
//
// Si la hoja está ocupada se omite el asiento en vez de esperar: la bitácora
// no debe impedir que una coordinación entre.
function registrarEvento(usuario, accion, detalle) {
  if (ACCIONES_AUDITABLES.indexOf(accion) === -1) {
    throw new Error('ACCION_INVALIDA: "' + accion + '" no es una acción auditable.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return 0;
  try {
    return escribirFilas(HOJAS.AUDITORIA, [{ timestamp: new Date(), usuario: usuario,
                                              accion: accion, detalle: detalle || '' }]);
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 5: `src/Acceso.gs`**

```js
var MAX_INTENTOS = 5;
var MINUTOS_BLOQUEO = 15;

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

function _cuentaPublica(fila) {
  return { usuario: fila.usuario, nombre: fila.nombre, coordinacion_id: fila.coordinacion_id };
}

// Devuelve siempre el mismo error, sin distinguir entre usuario inexistente,
// inactivo y contraseña equivocada: distinguirlos permitiría averiguar qué
// cuentas existen probando nombres.
function _resultadoAcceso(fila, contrasena) {
  var generico = { ok: false, code: 'CREDENCIALES_INVALIDAS',
                   message: 'Usuario o contraseña incorrectos.' };
  if (!fila) return generico;
  if (!esVerdadero(fila.activo)) return generico;
  if (!verificarContrasena(contrasena, fila.sal, fila.huella)) return generico;
  return { ok: true, usuario: _cuentaPublica(fila) };
}

// Un boleto bien firmado no basta: la cuenta tiene que seguir activa y seguir
// siendo de la misma coordinación. Es la forma de dejar fuera a alguien sin
// esperar a que venza su boleto de 30 días.
function _cuentaDelBoleto(verificado, filas) {
  if (!verificado.ok) return verificado;
  var invalido = { ok: false, code: 'BOLETO_INVALIDO',
                   message: 'El acceso no es válido. Vuelva a entrar.' };
  var fila = _buscarUsuario(filas, verificado.usuario);
  if (!fila || !esVerdadero(fila.activo)) return invalido;
  if (fila.coordinacion_id !== verificado.coordinacion_id) return invalido;
  return { ok: true, usuario: _cuentaPublica(fila) };
}

function _claveIntentos(usuario) {
  return 'intentos:' + String(usuario || '').trim().toLowerCase();
}

function iniciarSesion(nombreUsuario, contrasena) {
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
```

- [ ] **Step 6: Correr y ver que pasan**

Run: `node tools/run-tests.js`
Expected: `28 pruebas, 0 fallas`

- [ ] **Step 7: Commit**

```bash
git add src/Config.gs src/Auditoria.gs src/Acceso.gs src/Tests.gs
git commit -m "feat: acceso con boleto de portal, bloqueo por intentos y bitacora"
```

---

### Task 4: Directorio de destinos, enlaces y estados

**Goal:** A partir de las filas de la hoja `DESTINOS`, decidir qué destinos ve una coordinación, armar el enlace de cada uno según su clase y decidir su estado — sin pintar nunca de verde por falta de datos.

**Files:**
- Create: `src/Destinos.gs`
- Modify: `src/Tests.gs`

Columnas de `DESTINOS` (las crea `setupDatabase` en la Task 6):

| Columna | Qué lleva |
|---|---|
| `destino_id` | Clave corta, sin espacios: `determinantes`, `sips`, `form_vacunacion`. Va dentro del boleto. |
| `nombre` | Lo que ve la coordinación |
| `apartado` | Agrupa en pantalla (p. ej. los 5 apartados del inventario de formularios) |
| `clase` | `HERMANO_CON_CONTRASENA`, `HERMANO_SIN_CONTRASENA` o `FORMULARIO` |
| `url` | `https://…/exec` del hermano, o el `…/viewform` del formulario **sin parámetros** |
| `aplica_a` | `TODAS`, o ids separados por coma: `COOR01,COOR07`. Vacío = ninguna |
| `param_identidad` | Formulario: `entry.<id>`. Hermano sin contraseña: nombre del parámetro (p. ej. `coordinacion`) |
| `valor_identidad` | Qué se manda en ese parámetro: `NOMBRE` (predeterminado), `ID` o `USUARIO` |
| `sonda` | `NINGUNA` en la Fase 1 |
| `orden` | Número |
| `activo` | `TRUE` / `FALSE` |

**Acceptance Criteria:**
- [ ] `aplica_a` vacío no aplica a nadie; `TODAS` aplica a todas sin importar mayúsculas
- [ ] El orden es numérico (`2` antes de `10`)
- [ ] Formulario → `…viewform?usp=pp_url&entry.N=<valor codificado>`
- [ ] Hermano con contraseña → solo `boleto=`; hermano sin contraseña → `boleto=` y su parámetro de identidad
- [ ] Una fila mal configurada da enlace `null`, no una excepción
- [ ] Solo `{ ok: true, reportado: true }` produce `REPORTADO`; sonda ausente, caída o ambigua → `NO_SE_SABE`

**Verify:** `node tools/run-tests.js` → `42 pruebas, 0 fallas`

**Steps:**

- [ ] **Step 1: Escribir las pruebas que fallan** — en `src/Tests.gs`, antes de la línea marcador:

```js
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
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node tools/run-tests.js`
Expected: `42 pruebas, 14 fallas`

- [ ] **Step 3: `src/Destinos.gs`**

```js
// El directorio de destinos es una HOJA, no código: agregar un capturador
// nuevo es agregar una fila en DESTINOS. Todo lo de aquí es puro y recibe las
// filas ya leídas.

var CLASES_DESTINO = {
  CON_CONTRASENA: 'HERMANO_CON_CONTRASENA',
  SIN_CONTRASENA: 'HERMANO_SIN_CONTRASENA',
  FORMULARIO: 'FORMULARIO'
};

var ESTADOS = { REPORTADO: 'REPORTADO', PENDIENTE: 'PENDIENTE', NO_SE_SABE: 'NO_SE_SABE' };

var VALORES_IDENTIDAD = ['', 'NOMBRE', 'ID', 'USUARIO'];

// Las sondas de avance se registran aquí por nombre (columna `sonda`). En la
// Fase 1 no hay ninguna: todo destino sale gris. Cada sonda recibe
// (destino, coordinacion, anio, mes) y devuelve { ok, reportado }.
var SONDAS = {};

// Vacío no aplica a nadie: una celda olvidada deja un destino fuera, nunca
// se lo muestra a las 22 coordinaciones por accidente.
function _aplicaA(destino, coordinacionId) {
  var lista = String(destino.aplica_a || '').trim();
  if (lista.toUpperCase() === 'TODAS') return true;
  return lista.split(',').map(function (s) { return s.trim(); })
              .indexOf(coordinacionId) !== -1;
}

function destinosDeCoordinacion(filas, coordinacionId) {
  return filas
    .filter(function (d) { return esVerdadero(d.activo) && _aplicaA(d, coordinacionId); })
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); });
}

// Lista de lo que está mal en una fila, en palabras. Vacía = fila utilizable.
// La usa verificarDestinos() para avisar a quien edita la hoja, y
// enlaceDeDestino para no armar un enlace roto.
function problemasDeDestino(d) {
  var p = [];
  var clase = d.clase;
  var param = String(d.param_identidad || '').trim();
  if (!String(d.destino_id || '').trim()) p.push('falta destino_id');
  var clases = [CLASES_DESTINO.CON_CONTRASENA, CLASES_DESTINO.SIN_CONTRASENA, CLASES_DESTINO.FORMULARIO];
  if (clases.indexOf(clase) === -1) p.push('clase desconocida: "' + clase + '"');
  if (String(d.url || '').indexOf('https://') !== 0) p.push('la url debe empezar con https://');
  if (clase === CLASES_DESTINO.FORMULARIO) {
    if (!param) p.push('un formulario necesita param_identidad (entry.<id>)');
    else if (!/^entry\.\d+$/.test(param)) p.push('param_identidad de formulario debe ser entry.<número>');
  }
  if (clase === CLASES_DESTINO.SIN_CONTRASENA && !param) {
    p.push('un hermano sin contraseña necesita param_identidad');
  }
  if (VALORES_IDENTIDAD.indexOf(String(d.valor_identidad || '').trim().toUpperCase()) === -1) {
    p.push('valor_identidad debe ser NOMBRE, ID o USUARIO');
  }
  return p;
}

function _valorDeIdentidad(destino, coordinacion) {
  var tipo = String(destino.valor_identidad || '').trim().toUpperCase();
  if (tipo === 'ID') return coordinacion.coordinacion_id;
  if (tipo === 'USUARIO') return coordinacion.usuario;
  return coordinacion.nombre;
}

function _conParametros(url, pares) {
  var q = pares.map(function (p) {
    return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]);
  }).join('&');
  return url + (url.indexOf('?') === -1 ? '?' : '&') + q;
}

// coordinacion = { coordinacion_id, nombre, usuario }. El boleto va vacío
// para los formularios: un Google Form no sabría qué hacer con él.
function enlaceDeDestino(destino, coordinacion, boleto) {
  if (problemasDeDestino(destino).length) return null;
  var url = String(destino.url).trim();
  var param = String(destino.param_identidad || '').trim();
  var valor = _valorDeIdentidad(destino, coordinacion);
  if (destino.clase === CLASES_DESTINO.FORMULARIO) {
    return _conParametros(url, [['usp', 'pp_url'], [param, valor]]);
  }
  if (destino.clase === CLASES_DESTINO.SIN_CONTRASENA) {
    return _conParametros(url, [['boleto', boleto], [param, valor]]);
  }
  return _conParametros(url, [['boleto', boleto]]);
}

// Regla dura: nada se pinta de verde por falta de datos. Solo un `true`
// literal cuenta como reportado; 'true', 1 o un campo ausente no.
function estadoDeSonda(respuesta) {
  if (!respuesta || respuesta.ok !== true) return ESTADOS.NO_SE_SABE;
  if (respuesta.reportado === true) return ESTADOS.REPORTADO;
  if (respuesta.reportado === false) return ESTADOS.PENDIENTE;
  return ESTADOS.NO_SE_SABE;
}

function consultarSonda(sonda) {
  try {
    return estadoDeSonda(sonda());
  } catch (e) {
    return ESTADOS.NO_SE_SABE;
  }
}

function estadoDeDestino(destino, coordinacion, anio, mes, sondas) {
  var registro = sondas || SONDAS;
  var nombre = String(destino.sonda || '').trim();
  if (!Object.prototype.hasOwnProperty.call(registro, nombre)) return ESTADOS.NO_SE_SABE;
  return consultarSonda(function () { return registro[nombre](destino, coordinacion, anio, mes); });
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `node tools/run-tests.js`
Expected: `42 pruebas, 0 fallas`

- [ ] **Step 5: Commit**

```bash
git add src/Destinos.gs src/Tests.gs
git commit -m "feat: directorio de destinos, enlaces pre-llenados y estado gris por defecto"
```

---

### Task 5: API — `doPost`, despacho y contexto

**Goal:** El punto de entrada HTTP: recibe `{ accion, ... }` como JSON en texto plano, despacha a `iniciarSesion` o `contexto`, y nunca deja escapar una excepción cruda.

**Files:**
- Create: `src/Api.gs`
- Modify: `src/Tests.gs`

**Acceptance Criteria:**
- [ ] Acción desconocida, nula o heredada de `Object.prototype` (`constructor`, `toString`, `__proto__`) → `ACCION_DESCONOCIDA`
- [ ] Una acción que lanza → `ERROR_INTERNO` con el mensaje, sin tumbar la respuesta
- [ ] `contexto` devuelve los destinos con `enlace` y `estado`, y un boleto propio de 8 h por hermano

**Verify:** `node tools/run-tests.js` → `47 pruebas, 0 fallas`

**Steps:**

- [ ] **Step 1: Escribir las pruebas que fallan** — en `src/Tests.gs`, antes de la línea marcador:

```js
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

  prueba('despachar: una acción que lanza da ERROR_INTERNO', function () {
    var tabla = { rota: function () { throw new Error('se cayó la hoja'); } };
    assertIgual(despachar({ accion: 'rota' }, tabla),
                { ok: false, code: 'ERROR_INTERNO', message: 'se cayó la hoja' });
  });
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node tools/run-tests.js`
Expected: `47 pruebas, 5 fallas`

- [ ] **Step 3: `src/Api.gs`**

```js
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
    return { ok: false, code: 'ERROR_INTERNO', message: err.message };
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
      var boletoDestino = d.clase === CLASES_DESTINO.FORMULARIO ? ''
        : emitirBoleto(u.usuario, u.coordinacion_id, String(d.destino_id).trim(), vence, secreto);
      return {
        destino_id: d.destino_id,
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
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `node tools/run-tests.js`
Expected: `47 pruebas, 0 fallas`

- [ ] **Step 5: Commit**

```bash
git add src/Api.gs src/Tests.gs
git commit -m "feat: API por doPost con despacho seguro y contexto de destinos"
```

---

### Task 6: Plataforma — hojas, catálogo, cuentas y secreto

**Goal:** Un proyecto de Apps Script ligado a su propia hoja, con las seis pestañas creadas, el catálogo de 22 coordinaciones y 69 unidades cargado, las 22 cuentas creadas y el secreto de boletos generado.

**Files:**
- Create: `src/appsscript.json`
- Create: `src/Sheets.gs` (copia literal de `DET/src/Sheets.gs`)
- Create: `src/Catalogos.generado.gs` (copia literal de `DET/src/Catalogos.generado.gs`)
- Create: `src/Setup.gs`
- Create (sin versionar): `.clasp.json`

**Acceptance Criteria:**
- [ ] `node tools/run-tests.js` sigue en `47 pruebas, 0 fallas` (nada de lo nuevo rompe la carga)
- [ ] En el editor: `setupDatabase()` crea `CONFIG`, `CAT_COORDINACIONES`, `CAT_UNIDADES`, `USUARIOS`, `DESTINOS`, `AUDITORIA`
- [ ] `verificarCatalogos()` registra `22 coordinaciones`, `69 unidades`, `0 unidades huérfanas`
- [ ] `crearCuentasDeCoordinaciones()` registra `22 cuentas creadas`
- [ ] `generarSecretoDeBoletos()` crea `SECRETO_BOLETOS`; correrla otra vez **no** lo cambia
- [ ] `runAllTests()` corrido en el editor da `47 pruebas, 0 fallas` (confirma que el `Utilities` real coincide con el shim)

**Verify:** los registros de ejecución del editor de Apps Script, uno por función, con los textos de arriba.

**Steps:**

- [ ] **Step 1: `src/appsscript.json`** — el web app corre como quien despliega y lo puede llamar cualquiera, porque las coordinaciones no tienen cuenta de Google institucional:

```json
{
  "timeZone": "America/Mexico_City",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

`userinfo.email` es para `Session.getEffectiveUser().getEmail()` en la bitácora de `Setup.gs`. `script.external_request` (UrlFetch) no hace falta hasta que existan sondas nativas en la Fase 5.

- [ ] **Step 2: Copias literales**

```bash
cp "/c/Users/oscda/PROYECTOS ISEM/DeterminantesConcentrado/src/Sheets.gs" src/Sheets.gs
cp "/c/Users/oscda/PROYECTOS ISEM/DeterminantesConcentrado/src/Catalogos.generado.gs" src/Catalogos.generado.gs
```

`Catalogos.generado.gs` trae también `CSV_INDICADORES_DET`, que aquí no se usa. Se deja así a propósito: el archivo es generado y no se edita a mano, y así se puede volver a copiar tal cual cuando cambie. Según la spec §8, el portal es el dueño del catálogo y Determinantes lo leerá de aquí en la Fase 2; hasta entonces las dos copias salen del mismo generador.

- [ ] **Step 3: `src/Setup.gs`**

```js
// Funciones para correr A MANO desde el editor de Apps Script. Ninguna se
// llama desde la API.

var ESQUEMA = [
  [HOJAS.CONFIG, ['clave', 'valor']],
  [HOJAS.COORDINACIONES, ['coordinacion_id', 'nombre', 'municipio_principal', 'activo', 'orden']],
  [HOJAS.UNIDADES, ['unidad_id', 'clues', 'nombre_unidad', 'municipio', 'coordinacion_id',
                    'responsable', 'activo']],
  [HOJAS.USUARIOS, ['usuario', 'nombre', 'rol', 'coordinacion_id', 'sal', 'huella', 'activo']],
  [HOJAS.DESTINOS, ['destino_id', 'nombre', 'apartado', 'clase', 'url', 'aplica_a',
                    'param_identidad', 'valor_identidad', 'sonda', 'orden', 'activo']],
  [HOJAS.AUDITORIA, ['timestamp', 'usuario', 'accion', 'detalle']]
];

var CONFIG_INICIAL = [
  ['jurisdiccion', 'JURISDICCIÓN SANITARIA XIX TEXCOCO'],
  ['anio_activo', 2026],
  ['mes_activo', 9]
];

function setupDatabase() {
  var ss = SpreadsheetApp.getActive();
  ESQUEMA.forEach(function (par) {
    var nombre = par[0], encabezados = par[1];
    if (ss.getSheetByName(nombre)) {
      Logger.log(nombre + ' — ya existía');
      return;
    }
    var hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold');
    hoja.setFrozenRows(1);
    Logger.log(nombre + ' — creada');
  });

  if (!leerTabla(HOJAS.CONFIG).length) {
    escribirFilas(HOJAS.CONFIG, CONFIG_INICIAL.map(function (p) { return { clave: p[0], valor: p[1] }; }));
    invalidarCatalogo(HOJAS.CONFIG);
    Logger.log('CONFIG — cargada');
  }
}

function _parseCsv(texto) {
  var lineas = texto.trim().split('\n');
  var encabezados = lineas[0].split(',');
  return lineas.slice(1).map(function (linea) {
    var celdas = _dividirLinea(linea);
    var obj = {};
    encabezados.forEach(function (h, i) { obj[h.trim()] = (celdas[i] || '').trim(); });
    return obj;
  });
}

// Divide respetando comillas.
function _dividirLinea(linea) {
  var celdas = [], actual = '', dentro = false;
  for (var i = 0; i < linea.length; i++) {
    var c = linea.charAt(i);
    if (c === '"') { dentro = !dentro; continue; }
    if (c === ',' && !dentro) { celdas.push(actual); actual = ''; continue; }
    actual += c;
  }
  celdas.push(actual);
  return celdas;
}

// Catalogos.generado.gs es la fuente: para corregir una coordinación o una
// unidad se corrige DIRECTORIO.xlsx, se regenera y se vuelve a copiar.
function cargarUniverso() {
  reemplazarFilas(HOJAS.COORDINACIONES, _parseCsv(CSV_COORDINACIONES));
  reemplazarFilas(HOJAS.UNIDADES, _parseCsv(CSV_UNIDADES));
  invalidarCatalogo(HOJAS.COORDINACIONES);
  invalidarCatalogo(HOJAS.UNIDADES);
  Logger.log('universo cargado');
}

function verificarCatalogos() {
  var coords = leerTabla(HOJAS.COORDINACIONES);
  var unidades = leerTabla(HOJAS.UNIDADES);
  var ids = {};
  coords.forEach(function (c) { ids[c.coordinacion_id] = true; });
  Logger.log(coords.length + ' coordinaciones');
  Logger.log(unidades.length + ' unidades');
  Logger.log(unidades.filter(function (u) { return !ids[u.coordinacion_id]; }).length +
             ' unidades huérfanas');
}

// Crea una cuenta por coordinación. CORRERLA DE NUEVO SUSTITUYE TODAS: como la
// contraseña se deriva del usuario (Usuarios.gs), no cambia entre corridas
// salvo que cambie el nombre de la coordinación.
function crearCuentasDeCoordinaciones() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.USUARIOS);
  if (!hoja) throw new Error('Falta la hoja USUARIOS. Ejecute setupDatabase() primero.');

  // escribirFilas mapea por encabezado y descarta en silencio lo que no
  // encuentra: con encabezados viejos, las cuentas quedarían sin huella.
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  ['usuario', 'nombre', 'sal', 'huella', 'rol', 'coordinacion_id', 'activo'].forEach(function (c) {
    if (encabezados.indexOf(c) === -1) {
      throw new Error('La hoja USUARIOS no tiene la columna "' + c + '".');
    }
  });

  var coords = leerTabla(HOJAS.COORDINACIONES).filter(function (c) { return esVerdadero(c.activo); });
  if (!coords.length) throw new Error('No hay coordinaciones cargadas. Ejecute cargarUniverso() primero.');

  // Dos coordinaciones con el mismo usuario dejarían a una sin acceso.
  var vistos = {}, choques = [];
  coords.forEach(function (c) {
    var usuario = usuarioDeCoordinacion(c.nombre);
    if (vistos[usuario]) choques.push(usuario + ' (' + vistos[usuario] + ' / ' + c.nombre + ')');
    vistos[usuario] = c.nombre;
  });
  if (choques.length) throw new Error('Coordinaciones con el mismo usuario: ' + choques.join(', '));

  var filas = coords.map(function (c) {
    var usuario = usuarioDeCoordinacion(c.nombre);
    var sal = generarSal();
    return { usuario: usuario, nombre: c.nombre, rol: 'COORDINACION',
             coordinacion_id: c.coordinacion_id, sal: sal,
             huella: huellaContrasena(sal, contrasenaDeUsuario(usuario)), activo: 'TRUE' };
  });

  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);

  Logger.log('=== La contraseña de cada quien es su usuario + "26" (chiautla / chiautla26) ===');
  filas.forEach(function (f) { Logger.log(f.usuario + '  ' + contrasenaDeUsuario(f.usuario) + '   ' + f.nombre); });
  Logger.log('=== ' + filas.length + ' cuentas creadas ===');
}

// Da una sal nueva a UNA cuenta sin tocar las demás. La contraseña sigue
// siendo usuario + '26'; esto sirve si la huella se corrompió.
function restablecerContrasena(nombreUsuario) {
  var filas = leerTabla(HOJAS.USUARIOS);
  var fila = _buscarUsuario(filas, nombreUsuario);
  if (!fila) {
    throw new Error('No existe el usuario "' + nombreUsuario + '". Usuarios: ' +
                    filas.map(function (f) { return f.usuario; }).join(', '));
  }
  fila.sal = generarSal();
  fila.huella = huellaContrasena(fila.sal, contrasenaDeUsuario(fila.usuario));
  reemplazarFilas(HOJAS.USUARIOS, filas);
  invalidarCatalogo(HOJAS.USUARIOS);
  registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'RESTABLECER_CONTRASENA',
                  fila.usuario);
  Logger.log(fila.usuario + '  ' + contrasenaDeUsuario(fila.usuario) + '   ' + fila.nombre);
}

// Sin argumento, solo crea el secreto si no existe. Con `true` lo reemplaza:
// eso invalida TODOS los boletos emitidos y obliga a las 22 a volver a
// entrar. En la Fase 2, cada hermano tendrá que recibir el secreto nuevo.
function generarSecretoDeBoletos(forzar) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROPIEDAD_SECRETO) && forzar !== true) {
    Logger.log('SECRETO_BOLETOS ya existe; no se cambió. Para rotarlo: generarSecretoDeBoletos(true)');
    return;
  }
  var secreto = generarSal() + generarSal();   // 64 caracteres hexadecimales
  props.setProperty(PROPIEDAD_SECRETO, secreto);
  if (forzar === true) {
    registrarEvento(Session.getEffectiveUser().getEmail() || 'editor', 'ROTAR_SECRETO', '');
  }
  Logger.log('SECRETO_BOLETOS ' + (forzar === true ? 'rotado' : 'creado'));
}

// Revisa la hoja DESTINOS y dice qué filas no sirven y por qué. Correrla
// después de agregar o editar un destino.
function verificarDestinos() {
  var filas = leerTabla(HOJAS.DESTINOS);
  var ids = {};
  filas.forEach(function (d, i) {
    var p = problemasDeDestino(d);
    var id = String(d.destino_id || '').trim();
    if (id && ids[id]) p.push('destino_id repetido');
    ids[id] = true;
    Logger.log('fila ' + (i + 2) + ' ' + (id || '(sin id)') + ': ' + (p.length ? p.join('; ') : 'bien'));
  });
  invalidarCatalogo(HOJAS.DESTINOS);
  Logger.log(filas.length + ' destinos revisados');
}
```

- [ ] **Step 4: Confirmar que Node sigue verde**

Run: `node tools/run-tests.js`
Expected: `47 pruebas, 0 fallas`

- [ ] **Step 5: Crear el proyecto de Apps Script con su hoja**

```bash
clasp create --type sheets --title "Mascara de acceso - Promocion JS XIX" --rootDir src
```

Expected: crea una hoja de cálculo y un proyecto ligado, y escribe `.clasp.json` (ignorado por git). Si `clasp` pide login: `clasp login` con la cuenta institucional que desplegará. Si `clasp create` deja un `appsscript.json` propio en `src/`, restaurar el del Step 1 con `git checkout src/appsscript.json`.

- [ ] **Step 6: Subir**

```bash
clasp push --force
```

Expected: lista los 15 archivos de `src/` subidos.

Ojo con el orden de carga: `Setup.gs` usa `HOJAS` a nivel global (en `ESQUEMA`), así que `Config.gs` tiene que cargarse antes. `clasp` sube en orden alfabético y `Config` < `Setup`, igual que en Determinantes. Si el editor marca `HOJAS is not defined` al ejecutar cualquier función, ese es el motivo.

- [ ] **Step 7: Correr en el editor, en este orden** (`clasp open-script`, elegir la función, Ejecutar, revisar el registro):

1. `setupDatabase` → seis `— creada` y `CONFIG — cargada`
2. `cargarUniverso` → `universo cargado`
3. `verificarCatalogos` → `22 coordinaciones`, `69 unidades`, `0 unidades huérfanas`
4. `crearCuentasDeCoordinaciones` → `22 cuentas creadas`
5. `generarSecretoDeBoletos` → `SECRETO_BOLETOS creado`; ejecutarla de nuevo → `ya existe; no se cambió`
6. `runAllTests` → `47 pruebas, 0 fallas`

Si el 6 falla en pruebas de boleto o huella pero Node pasa, el shim de `tools/run-tests.js` no coincide con el `Utilities` real: corregir el shim, no las pruebas.

- [ ] **Step 8: Commit**

```bash
git add src/appsscript.json src/Sheets.gs src/Catalogos.generado.gs src/Setup.gs
git commit -m "feat: hojas, catalogo, cuentas y secreto de boletos del portal"
```

---

### Task 7: La pantalla (`web/`)

**Goal:** Una página estática que pide usuario y contraseña una vez, guarda el boleto en el teléfono y muestra los destinos agrupados por apartado, cada uno con su estado y su enlace.

**Files:**
- Create: `web/index.html`
- Create: `web/estilos.css`
- Create: `web/config.js`
- Create: `web/app.js`

**Acceptance Criteria:**
- [ ] Sin boleto guardado → pantalla de acceso; con boleto válido → lista directa, sin volver a escribir nada
- [ ] `BOLETO_INVALIDO` / `BOLETO_VENCIDO` → borra el boleto y vuelve al acceso con el mensaje
- [ ] Los textos que vienen de la hoja se ponen con `textContent`, nunca con `innerHTML`
- [ ] Estado: `REPORTADO` verde «Reportado», `PENDIENTE` ámbar «Pendiente», `NO_SE_SABE` gris «Sin dato»
- [ ] Enlace `null` → renglón visible pero sin enlace, con la leyenda «No disponible»
- [ ] Si la pestaña vuelve a primer plano después de más de 60 min, se recarga el contexto (los boletos de destino duran 8 h)
- [ ] Usable a 360 px de ancho, sin desplazamiento horizontal; objetivos táctiles de al menos 44 px

**Verify:** con `ENDPOINT` apuntando al `/exec` de la Task 8, abrir `web/index.html` con un servidor local (`npx --yes serve web -l 5173`, abrir `http://localhost:5173`), entrar como `chiautla` / `chiautla26`, recargar y ver que entra directo.

**Steps:**

- [ ] **Step 1: `web/config.js`** — se llena en la Task 8:

```js
// URL /exec del despliegue del Apps Script de la máscara (Task 8).
var ENDPOINT = '';
```

- [ ] **Step 2: `web/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Los enlaces llevan boletos: que no se filtren en el Referer. -->
  <meta name="referrer" content="no-referrer">
  <title>Promoción de la Salud</title>
  <link rel="stylesheet" href="estilos.css">
</head>
<body>
  <main>
    <section id="acceso" hidden>
      <h1>Promoción de la Salud</h1>
      <p class="sub">Jurisdicción Sanitaria XIX Texcoco</p>
      <form id="form-acceso" novalidate>
        <label for="usuario">Usuario</label>
        <input id="usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>
        <label for="contrasena">Contraseña</label>
        <input id="contrasena" type="password" autocomplete="current-password" required>
        <button id="btn-entrar" type="submit">Entrar</button>
      </form>
      <p id="error-acceso" role="alert"></p>
    </section>

    <section id="portal" hidden>
      <header>
        <div>
          <div id="identidad"></div>
          <div id="periodo" class="sub"></div>
        </div>
        <button id="btn-salir" type="button">Salir</button>
      </header>
      <div id="apartados"></div>
      <p id="sin-destinos" hidden>Todavía no hay capturadores asignados a su coordinación.</p>
    </section>

    <p id="cargando" role="status">Cargando…</p>
  </main>
  <script src="config.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: `web/estilos.css`** — misma paleta que Determinantes (guinda institucional `#9F2241`):

```css
:root {
  --guinda: #9F2241;
  --borde: #d8d8d8;
  --texto: #1a1a1a;
  --suave: #666;
  --fondo: #fff;
  --verde-fondo: #e3f5e6; --verde: #1e6b2e;
  --ambar-fondo: #fff4d6; --ambar: #8a6600;
  --gris-fondo: #eee;     --gris: #555;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--texto); background: var(--fondo); }
main { max-width: 40rem; margin: 0 auto; padding: 1rem 1rem 3rem; }
h1 { color: var(--guinda); margin: 1.5rem 0 .25rem; font-size: 1.5rem; }
.sub { color: var(--suave); margin: 0 0 1rem; font-size: .9rem; }

#form-acceso label { display: block; margin: .75rem 0 .25rem; font-weight: 600; }
#form-acceso input { width: 100%; min-height: 44px; font-size: 1rem; padding: 0 .6rem;
                     border: 1px solid var(--borde); border-radius: 4px; }
button { min-height: 44px; font-size: 1rem; border-radius: 4px; cursor: pointer; }
#btn-entrar { width: 100%; margin-top: 1.25rem; background: var(--guinda); color: #fff; border: none; }
#btn-entrar:disabled { opacity: .6; }
#error-acceso { color: var(--guinda); min-height: 1.5em; }

header { display: flex; justify-content: space-between; align-items: center; gap: 1rem;
         padding: .75rem 0; border-bottom: 2px solid var(--guinda); }
#identidad { font-weight: 700; overflow-wrap: anywhere; }
#periodo { margin: 0; }
#btn-salir { background: none; border: 1px solid var(--borde); padding: 0 1rem; flex-shrink: 0; }

.apartado h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em;
               color: var(--suave); margin: 1.5rem 0 .5rem; }
.destinos { list-style: none; margin: 0; padding: 0; }
.destino a, .destino .sin-enlace { display: flex; align-items: center; justify-content: space-between;
                                   gap: .75rem; min-height: 56px; padding: .6rem .8rem;
                                   border: 1px solid var(--borde); border-radius: 6px;
                                   margin-bottom: .5rem; color: inherit; text-decoration: none; }
.destino a:active { background: #f7f7f7; }
.destino .nombre { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.destino .sin-enlace { color: var(--suave); }
.estado { flex-shrink: 0; font-size: .8rem; font-weight: 600; padding: .2rem .5rem; border-radius: 4px; }
.estado-REPORTADO { background: var(--verde-fondo); color: var(--verde); }
.estado-PENDIENTE { background: var(--ambar-fondo); color: var(--ambar); }
.estado-NO_SE_SABE { background: var(--gris-fondo); color: var(--gris); }
```

- [ ] **Step 4: `web/app.js`**

```js
var CLAVE_BOLETO = 'mascara_boleto';
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
             'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var ETIQUETAS_ESTADO = { REPORTADO: 'Reportado', PENDIENTE: 'Pendiente', NO_SE_SABE: 'Sin dato' };
var MINUTOS_REFRESCO = 60;
var ultimaCarga = 0;

function el(id) { return document.getElementById(id); }

function leerBoleto() {
  try { return localStorage.getItem(CLAVE_BOLETO); } catch (e) { return null; }
}
function guardarBoleto(b) {
  try {
    if (b) localStorage.setItem(CLAVE_BOLETO, b); else localStorage.removeItem(CLAVE_BOLETO);
  } catch (e) {}
}

// Content-Type text/plain A PROPÓSITO: con application/json el navegador manda
// antes un OPTIONS que Apps Script no contesta (no existe doOptions), y la
// llamada muere. doPost recibe el cuerpo igual en e.postData.contents.
function llamar(accion, datos) {
  var cuerpo = Object.assign({ accion: accion }, datos || {});
  var control = new AbortController();
  var reloj = setTimeout(function () { control.abort(); }, 20000);
  return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                           body: JSON.stringify(cuerpo), signal: control.signal })
    .then(function (r) { return r.json(); })
    .catch(function () {
      return { ok: false, code: 'SIN_CONEXION', message: 'No se pudo conectar. Revise su internet e intente de nuevo.' };
    })
    .finally(function () { clearTimeout(reloj); });
}

function mostrar(seccion) {
  ['acceso', 'portal', 'cargando'].forEach(function (id) { el(id).hidden = id !== seccion; });
}

function mostrarAcceso(mensaje) {
  el('error-acceso').textContent = mensaje || '';
  mostrar('acceso');
  el('usuario').focus();
}

function pintarPortal(ctx) {
  el('identidad').textContent = ctx.usuario.nombre;
  var mes = parseInt(ctx.periodo.mes, 10);
  el('periodo').textContent = mes >= 1 && mes <= 12 ? 'Periodo: ' + MESES[mes - 1] + ' ' + ctx.periodo.anio : '';

  var contenedor = el('apartados');
  contenedor.replaceChildren();
  var grupos = {};
  var orden = [];
  ctx.destinos.forEach(function (d) {
    var clave = d.apartado || 'Capturadores';
    if (!grupos[clave]) { grupos[clave] = []; orden.push(clave); }
    grupos[clave].push(d);
  });

  orden.forEach(function (clave) {
    var seccion = document.createElement('section');
    seccion.className = 'apartado';
    var titulo = document.createElement('h2');
    titulo.textContent = clave;
    var lista = document.createElement('ul');
    lista.className = 'destinos';
    grupos[clave].forEach(function (d) { lista.appendChild(renglon(d)); });
    seccion.appendChild(titulo);
    seccion.appendChild(lista);
    contenedor.appendChild(seccion);
  });

  el('sin-destinos').hidden = ctx.destinos.length > 0;
  mostrar('portal');
}

function renglon(d) {
  var li = document.createElement('li');
  li.className = 'destino';
  var caja;
  if (d.enlace) {
    caja = document.createElement('a');
    caja.href = d.enlace;
    caja.target = '_blank';
    caja.rel = 'noopener noreferrer';
  } else {
    caja = document.createElement('div');
    caja.className = 'sin-enlace';
  }
  var nombre = document.createElement('span');
  nombre.className = 'nombre';
  nombre.textContent = d.enlace ? d.nombre : d.nombre + ' — No disponible';
  var estado = document.createElement('span');
  var codigo = ETIQUETAS_ESTADO[d.estado] ? d.estado : 'NO_SE_SABE';
  estado.className = 'estado estado-' + codigo;
  estado.textContent = ETIQUETAS_ESTADO[codigo];
  caja.appendChild(nombre);
  caja.appendChild(estado);
  li.appendChild(caja);
  return li;
}

function cargarContexto() {
  var boleto = leerBoleto();
  if (!boleto) { mostrarAcceso(''); return; }
  llamar('contexto', { boleto: boleto }).then(function (r) {
    if (r.ok) { ultimaCarga = Date.now(); pintarPortal(r); return; }
    if (r.code === 'BOLETO_INVALIDO' || r.code === 'BOLETO_VENCIDO') {
      guardarBoleto(null);
      mostrarAcceso(r.message);
      return;
    }
    // Sin conexión o error del servidor: el boleto sigue siendo bueno, no se borra.
    mostrarAcceso(r.message || 'Algo salió mal. Intente de nuevo.');
  });
}

el('form-acceso').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var boton = el('btn-entrar');
  boton.disabled = true;
  el('error-acceso').textContent = '';
  llamar('iniciarSesion', { usuario: el('usuario').value, contrasena: el('contrasena').value })
    .then(function (r) {
      boton.disabled = false;
      if (!r.ok) { el('error-acceso').textContent = r.message; return; }
      guardarBoleto(r.boleto);
      el('contrasena').value = '';
      mostrar('cargando');
      cargarContexto();
    });
});

el('btn-salir').addEventListener('click', function () {
  guardarBoleto(null);
  mostrarAcceso('');
});

// Los boletos de cada destino duran 8 horas. Si la página se quedó abierta en
// el teléfono, al volver a ella se piden enlaces nuevos.
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && leerBoleto() &&
      Date.now() - ultimaCarga > MINUTOS_REFRESCO * 60000) {
    cargarContexto();
  }
});

cargarContexto();
```

- [ ] **Step 5: Revisar a 360 px**

Con el servidor local del paso Verify, abrir las herramientas de desarrollo en modo dispositivo a 360 × 740: el acceso y la lista no deben tener barra de desplazamiento horizontal. (La verificación de punta a punta con datos reales se hace en la Task 8, cuando ya hay `ENDPOINT`.)

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: pantalla de acceso y lista de destinos para GitHub Pages"
```

---

### Task 8: Despliegue, Pages y verificación de punta a punta

**Goal:** El Apps Script desplegado como aplicación web, la página publicada en GitHub Pages y una coordinación de prueba que entra y abre un formulario pre-llenado y un hermano.

**Files:**
- Create: `.github/workflows/pages.yml`
- Create: `README.md`
- Modify: `web/config.js` (el `ENDPOINT`)

**Acceptance Criteria:**
- [ ] `curl -sL <exec>` → `{"ok":true,"servicio":"mascara"}`
- [ ] `curl -sL -H 'Content-Type: text/plain' -d '{"accion":"iniciarSesion","usuario":"chiautla","contrasena":"x"}' <exec>` → `CREDENCIALES_INVALIDAS`
- [ ] La página publicada abre en un Android con Chrome **firmado** con una cuenta de Google (el caso que rompía SSOP)
- [ ] Entrar como una coordinación de prueba muestra sus destinos; al recargar entra sin pedir nada
- [ ] El formulario de prueba abre con la coordinación ya elegida; Determinantes abre (todavía con su propia pantalla de acceso: aceptar el boleto es la Fase 2)
- [ ] `verificarDestinos()` dice `bien` en cada fila

**Verify:** los criterios de arriba, uno por uno, anotando el resultado en el mensaje del commit final.

**Steps:**

- [ ] **Step 1: Desplegar el web app**

```bash
clasp push --force
clasp create-deployment --description "mascara v1"
```

Expected: imprime un `deploymentId`. La URL es `https://script.google.com/macros/s/<deploymentId>/exec`. La primera vez, abrir esa URL en el navegador con la cuenta que despliega para autorizar los permisos. (Con `clasp` 2.x el comando es `clasp deploy`.)

- [ ] **Step 2: Comprobar la API con curl**

```bash
EXEC='https://script.google.com/macros/s/<deploymentId>/exec'
curl -sL "$EXEC"
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
     -d '{"accion":"iniciarSesion","usuario":"chiautla","contrasena":"x"}' "$EXEC"
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
     -d '{"accion":"iniciarSesion","usuario":"chiautla","contrasena":"chiautla26"}' "$EXEC"
```

Expected: `{"ok":true,"servicio":"mascara"}`, luego `"code":"CREDENCIALES_INVALIDAS"`, luego `"ok":true,"boleto":"…"`. (`-L` es obligatorio: Apps Script responde con una redirección 302.)

- [ ] **Step 3: Poner el `ENDPOINT` en `web/config.js`**

```js
// URL /exec del despliegue del Apps Script de la máscara (Task 8).
var ENDPOINT = 'https://script.google.com/macros/s/<deploymentId>/exec';
```

Para nuevas versiones del Apps Script usar `clasp update-deployment <deploymentId>` (clasp 2.x: `clasp deploy -i <deploymentId>`), así la URL no cambia y `config.js` no se toca.

- [ ] **Step 4: Llenar `DESTINOS` con dos filas de prueba** (a mano, en la hoja):

| destino_id | nombre | apartado | clase | url | aplica_a | param_identidad | valor_identidad | sonda | orden | activo |
|---|---|---|---|---|---|---|---|---|---|---|
| `determinantes` | Talleres por Determinantes | Reporte mensual | `HERMANO_CON_CONTRASENA` | la URL `/exec` de Determinantes | `TODAS` | | | `NINGUNA` | 1 | `TRUE` |
| `form_prueba` | (un formulario vivo del inventario) | Formularios | `FORMULARIO` | su `…/viewform` sin parámetros | `TODAS` | `entry.<id>` de su pregunta de coordinación | `NOMBRE` | `NINGUNA` | 2 | `TRUE` |

Para sacar el `entry.<id>`: en el formulario, ⋮ → «Obtener enlace rellenado previamente», elegir una coordinación, «Obtener enlace» y leer el `entry.NNN=` del enlace. Si las opciones del formulario no se escriben igual que en `CAT_COORDINACIONES`, Google abre la pregunta **vacía**, sin error: en ese caso probar `valor_identidad = ID` o anotar la diferencia como pendiente (spec §11).

Luego correr `verificarDestinos()` en el editor → `bien` en ambas filas.

- [ ] **Step 5: `.github/workflows/pages.yml`**

```yaml
name: Publicar la pantalla en GitHub Pages

on:
  push:
    branches: [main]
    paths: ['web/**', '.github/workflows/pages.yml']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  publicar:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.despliegue.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web
      - id: despliegue
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: `README.md`**

````markdown
# La máscara — acceso único a los capturadores de Promoción

Una coordinación entra una vez, con una contraseña, y desde aquí llega a cada
capturador ya identificada. Diseño: `docs/superpowers/specs/2026-09-21-mascara-de-acceso-unico-design.md`.

## Partes

- `src/` — Apps Script que solo responde JSON (`doPost`). Se sube con `clasp push`.
- `web/` — la pantalla, publicada en GitHub Pages por `.github/workflows/pages.yml`.
- La hoja ligada al Apps Script: `USUARIOS`, `DESTINOS`, `CONFIG`, catálogos y `AUDITORIA`.

## Agregar un capturador

Una fila en `DESTINOS` y luego `verificarDestinos()` en el editor. No se toca código.

## Pruebas

`node tools/run-tests.js` (lógica pura). Lo que toca Sheets se verifica en el editor con `runAllTests()` y las funciones de `Setup.gs`.

## Riesgos aceptados, dichos de frente

- **La contraseña es deducible** (`usuario` + `26`) por decisión explícita, y esta página es **pública**.
  Quien sepa el nombre de una coordinación puede entrar como ella a todos sus capturadores.
  Para endurecerla: cambiar `contrasenaDeUsuario` en `src/Usuarios.gs` y correr `crearCuentasDeCoordinaciones()`.
- **La sesión dura 30 días y vive en el teléfono.** Para cortar una cuenta ya: `activo = FALSE` en `USUARIOS`.
  Para cortar a todas: `generarSecretoDeBoletos(true)`.

## Secreto de boletos

Vive en las propiedades del script (`SECRETO_BOLETOS`), nunca en la hoja ni en el repo. En la Fase 2 cada
capturador hermano recibirá una copia para verificar los boletos.
````

- [ ] **Step 7: Commit local**

```bash
git add .github/workflows/pages.yml README.md web/config.js
git commit -m "chore: despliegue del web app y publicacion en GitHub Pages"
```

- [ ] **Step 8: Crear el repositorio público y activar Pages — PEDIR CONFIRMACIÓN AL USUARIO ANTES**

Esto publica el código y las specs. Confirmar con el usuario, y luego:

```bash
gh repo create PortalPromocion --public --source . --remote origin
git branch -m master main
git push -u origin main
gh api -X POST repos/{owner}/PortalPromocion/pages -f build_type=workflow
gh workflow run pages.yml
gh run watch
```

Expected: la corrida termina en verde y `gh api repos/{owner}/PortalPromocion/pages --jq .html_url` da la URL de la página.

- [ ] **Step 9: Verificación de punta a punta, en un teléfono Android con Chrome firmado**

1. Abrir la URL de Pages → pantalla de acceso.
2. Entrar como la coordinación de prueba acordada → aparecen `Talleres por Determinantes` y el formulario de prueba, los dos con «Sin dato» en gris.
3. Cerrar Chrome, volver a abrir la URL → entra directo a la lista.
4. Tocar el formulario → abre con la coordinación ya elegida.
5. Tocar Determinantes → abre (con su propia pantalla de acceso; se quita en la Fase 2).
6. «Salir» → vuelve al acceso; recargar → sigue en el acceso.
7. En la hoja, `activo = FALSE` para esa cuenta, esperar 30 min o correr `invalidarCatalogo('USUARIOS')` en el editor, recargar la página → vuelve al acceso con «El acceso no es válido». Regresar `activo = TRUE`.
8. Cinco contraseñas equivocadas seguidas → la sexta dice «Demasiados intentos».

Si algún paso falla, **no** se marca la tarea como hecha: se abre la causa con superpowers-extended-cc:systematic-debugging.

---

## Fuera de este plan (siguientes planes, en el orden de la spec §10)

- **Fase 2 — Determinantes acepta el boleto:** copiar `Boleto.gs` y el secreto; `doGet(e)` con `e.parameter.boleto` → verificar con `destino = 'determinantes'` → resolver la cuenta **contra su propia hoja `USUARIOS`** por `coordinacion_id`; retirar su pantalla de acceso; mover su pantalla a Pages (mismo defecto de Android). Resolver cómo entra su administrador (el portal no tiene cuenta de administrador). Que lea el catálogo desde la hoja del portal.
- **Fase 3 — Mensual Coordinación**, igual. Antes: reconciliar su `CATALOGO_COORDINACIONES` con las 22 (spec §11).
- **Fase 4 — SIPS, SSOP, Entornos** leen `boleto` y su parámetro de coordinación.
- **Fase 5 — Sondas:** registrar funciones en `SONDAS` (`Destinos.gs`), una por destino.
- **Pendientes de la spec §11:** estado de JORNADA SALUD y VISOR-JORNADAS; qué queda vivo del inventario de 14 formularios; los `entry.<id>` de cada uno.
