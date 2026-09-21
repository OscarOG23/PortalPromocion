# Fase 3 — Mensual Coordinación entra con el boleto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que «Mensual Coordinación» en la máscara abra el panel de Mensual ya identificado como la coordinación.

**Architecture:** El boleto gana el campo firmado `n` (nombre de la coordinación). Mensual copia `Boleto.gs`, resuelve la fila de `AUTH` por nombre normalizado y abre su sesión de caché de siempre; la pantalla canjea el boleto al arrancar.

**Tech Stack:** Apps Script V8, `clasp` 3.x, Node 24.

**Spec:** [2026-09-21-fase-3-mensual-coordinacion-design.md](../specs/2026-09-21-fase-3-mensual-coordinacion-design.md)

**Dónde:** máscara en `PortalPromocion`, rama `fase-3-mensual`. Mensual en el worktree `~/.config/superpowers/worktrees/MENSUAL-COORDINACION/fase-3-boleto`, rama `fase-3-boleto` (el checkout principal de Mensual no se toca).

---

### Task 1: El boleto lleva el nombre (máscara)

**Files:** `src/Boleto.gs`, `src/Api.gs`, `src/Tests.gs`

**Acceptance:** `node tools/run-tests.js` → `53 pruebas, 0 fallas`.

- `emitirBoleto(usuario, coordinacionId, destino, vence, secreto, nombre)`: si `nombre` viene, el cuerpo es `{c,u,d,v,n}`; si no, `{c,u,d,v}` como antes.
- `verificarBoleto`: si `datos.n` existe y no es cadena → `BOLETO_INVALIDO`; el resultado agrega `nombre: datos.n || ''` al final.
- La prueba `'boleto: ida y vuelta, con caracteres no ASCII'` espera ahora también `nombre: ''`.
- Prueba nueva `'boleto: lleva el nombre de la coordinación firmado'`: emitir con `'CEAPS SANTA MARÍA CHIMALHUACAN'` y verificar `nombre` igual.
- `Api.gs` → `contextoDeBoleto` pasa `u.nombre` como sexto argumento de `emitirBoleto`.
- Comentario de formato en `Boleto.gs`: `n = nombre de la coordinación (opcional; los verificadores viejos lo ignoran)`.

### Task 2: Mensual resuelve la coordinación del boleto (servidor)

**Files:** Create `Boleto.gs` (copia de la máscara tras Task 1), `Mascara.gs`, `tools/mascara/pruebas.js`; Modify `.claspignore`.

**Acceptance:** `node tools/mascara/pruebas.js` → todas pasan; `.claspignore` permite `Boleto.gs` y `Mascara.gs`.

`Mascara.gs`:

```js
// Entrada desde la máscara (PortalPromocion): la coordinación llega con un
// boleto firmado y entra sin elegir su nombre de la lista. La identidad sale
// SOLO del boleto verificado; el enlace con esta app es el nombre (campo `n`),
// comparado sin acentos contra la columna A de AUTH.
//
// Los auxiliares terminan en `_`: Apps Script no los expone a google.script.run,
// y en este despliegue ANYONE_ANONYMOUS toda función global es invocable.

var DESTINO_MENSUAL_ = 'mensual_coordinacion';
var MENSAJE_BOLETO_GENERICO_ = 'No se pudo entrar desde el portal. Elija su coordinación.';
var MENSAJES_BOLETO_ = {
  BOLETO_INVALIDO: 'El acceso desde el portal no es válido. Elija su coordinación.',
  BOLETO_VENCIDO: 'El acceso desde el portal venció. Vuelva a entrar desde el portal o elija su coordinación.',
  BOLETO_SIN_CUENTA: 'No se encontró su coordinación en este sistema. Elíjala de la lista.'
};

function secretoDeBoletos_() {
  var s = PropertiesService.getScriptProperties().getProperty('SECRETO_BOLETOS');
  if (!s) throw new Error('SIN_SECRETO: falta SECRETO_BOLETOS en las propiedades del script.');
  return s;
}

// Pura. Exactamente una fila de AUTH con ese nombre, y nunca la Jurisdicción:
// con dos no se adivina (las tres UNEME, por ejemplo) y el ADMIN entra con
// contraseña.
function coordDeBoleto_(verificado, filasAuth) {
  if (!verificado.ok) return verificado;
  var sinCuenta = { ok: false, code: 'BOLETO_SIN_CUENTA' };
  var buscado = _normCoord(verificado.nombre);
  if (!buscado) return sinCuenta;
  var hallados = filasAuth.filter(function (f) {
    return f[0] && _normCoord(f[0]) === buscado && getTipo(String(f[0])) !== 'ADMIN';
  });
  if (hallados.length !== 1) return sinCuenta;
  var coord = String(hallados[0][0]);
  return { ok: true, coord: coord, tipo: getTipo(coord) };
}

function mensajeDeBoleto_(code) {
  return MENSAJES_BOLETO_[code] || MENSAJE_BOLETO_GENERICO_;
}

// La llama la pantalla. Si el teléfono ya tiene sesión de esa misma
// coordinación se reusa; si es de otra (teléfono compartido), se cierra.
function entrarConBoleto(boleto, tokenAnterior) {
  try {
    var verificado = verificarBoleto(boleto, secretoDeBoletos_(), DESTINO_MENSUAL_, Date.now());
    var auth = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_AUTH);
    if (!auth) return { ok: false, msg: MENSAJE_BOLETO_GENERICO_ };
    var r = coordDeBoleto_(verificado, auth.getDataRange().getValues().slice(1));
    if (!r.ok) return { ok: false, code: r.code, msg: mensajeDeBoleto_(r.code) };

    var previa = tokenAnterior ? validarSesion(tokenAnterior) : null;
    if (previa && norm(previa.coord) === norm(r.coord)) {
      return { ok: true, token: tokenAnterior, coord: previa.coord, tipo: previa.tipo };
    }
    if (tokenAnterior) logout(tokenAnterior);

    var token = Utilities.getUuid();
    CacheService.getScriptCache().put(token, JSON.stringify({
      coord: r.coord, tipo: r.tipo, login: new Date().toISOString()
    }), SESSION_TTL);
    return { ok: true, token: token, coord: r.coord, tipo: r.tipo };
  } catch (err) {
    // El detalle va al registro de ejecución; la pantalla es pública.
    console.error(err);
    return { ok: false, msg: MENSAJE_BOLETO_GENERICO_ };
  }
}
```

Pruebas (`tools/mascara/pruebas.js`, en Node, sin subir): carga `Boleto.gs`, las funciones `_normCoord` y `getTipo` recortadas del texto de `Code.gs`, y `Mascara.gs`, con el shim de `Utilities` de la máscara. Casos: CHIAUTLA; nombre con y sin acento contra `CEAPS SANTA MARÍA CHIMALHUACAN`; `UNEME` → `BOLETO_SIN_CUENTA`; la Jurisdicción → `BOLETO_SIN_CUENTA`; fila duplicada → `BOLETO_SIN_CUENTA`; boleto no verificado pasa tal cual; boleto sin nombre (`''`) → `BOLETO_SIN_CUENTA`; `mensajeDeBoleto_` por código y genérico; ida y vuelta de un boleto con nombre y destino `mensual_coordinacion`.

### Task 3: La pantalla de Mensual canjea el boleto

**Files:** `Index.html` (arranque y sección LOGIN).

Sustituir en el arranque:

```js
    cargarCoordinaciones();
    const stored = localStorage.getItem('fi_token');
    if (stored) { token = stored; mostrarScreen('panel'); cargarPanelInicial(true); }
    else mostrarScreen('login');
```

por:

```js
    cargarCoordinaciones();
    // Si llega desde la máscara, el boleto manda sobre la sesión guardada.
    try {
      google.script.url.getLocation(function (ubicacion) {
        const boleto = ubicacion && ubicacion.parameter && ubicacion.parameter.boleto;
        if (boleto) entrarDesdePortal(boleto); else entrarConSesionGuardada();
      });
    } catch (e) { entrarConSesionGuardada(); }
```

y agregar en la sección LOGIN:

```js
  function entrarConSesionGuardada() {
    const stored = localStorage.getItem('fi_token');
    if (stored) { token = stored; mostrarScreen('panel'); cargarPanelInicial(true); }
    else mostrarScreen('login');
  }

  // El boleto se quita de la URL antes de usarlo. Mientras se canjea, el
  // botón queda ocupado: una respuesta tardía no debe pisar una entrada manual.
  function entrarDesdePortal(boleto) {
    const anterior = localStorage.getItem('fi_token');
    google.script.history.replace(null, {}, '');
    mostrarScreen('login');
    const btn = document.getElementById('btn-login');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Entrando desde el portal...';
    const listo = () => { btn.disabled = false; btn.innerHTML = 'Entrar'; };
    const generico = 'No se pudo entrar desde el portal. Elija su coordinación.';
    google.script.run
      .withSuccessHandler(r => {
        listo();
        if (token) return;
        if (r && r.ok) {
          token = r.token; sesion = { coord: r.coord, tipo: r.tipo };
          localStorage.setItem('fi_token', token);
          mostrarPanel();
        } else {
          localStorage.removeItem('fi_token');
          mostrarErrorLogin((r && r.msg) || generico);
        }
      })
      .withFailureHandler(() => { listo(); if (token) return; mostrarErrorLogin(generico); })
      .entrarConBoleto(boleto, anterior);
  }
```

### Task 4: Secreto, despliegue y verificación

1. Generar un secreto nuevo y guardarlo en `~/.config/mascara/SECRETO_BOLETOS` (fuera de repos).
2. Instaladores temporales `ZZ_Temporal.gs` (sin versionar) en máscara, Determinantes y Mensual (en Mensual además en la lista blanca, y se retira después). El de la máscara también agrega la fila `mensual_coordinacion` a `DESTINOS` si no existe.
3. El usuario ejecuta `instalarSecreto` en los tres editores.
4. Borrar instaladores, `clasp push`, `create-version`, `update-deployment` en máscara (@1→nueva) y Mensual (@14→nueva). Anotar reversas.
5. Prueba automática en Chromium: máscara → Mensual entra al panel; URL limpia; recarga; boleto alterado.
6. Integrar ramas y retirar el worktree.
