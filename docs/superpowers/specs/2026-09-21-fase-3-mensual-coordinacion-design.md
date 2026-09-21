# Fase 3 — Mensual Coordinación entra con el boleto — Diseño

**Fecha:** 2026-09-21
**Proyectos:** `PortalPromocion` (la máscara) y `MENSUAL COORDINACION` (repo `isem-mensual-coordinacion`)
**Aprobación:** el usuario aprobó de antemano continuar todas las fases (2026-09-21).

**Objetivo:** Que una coordinación que toca «Mensual Coordinación» en la máscara
entre directo a su panel, sin elegir su nombre de la lista.

---

## 1. Lo que se encontró

- Mensual **ya no pide contraseña** a las coordinaciones: eligen su nombre de
  una lista (`getListaCoordinaciones` + `loginCoordinacion`). Solo la
  Jurisdicción (ADMIN) usa contraseña. La fase quita un paso, no una
  contraseña.
- Mensual identifica por **nombre** (hoja `AUTH`, columna A), no por
  `COOR01…COOR22`. Comparando con `_normCoord` (sin acentos, mayúsculas):
  **21 de 22 coinciden**. `COOR22 UNEME` no: en Mensual son tres cuentas
  (`UNEME CCSMA CHIMALHUACÁN`, `UNEME CISAME`, `UNEME SORID`).
- Sesión de Mensual: UUID en `CacheService`, 12 h, se renueva con cada
  llamada. El cliente la guarda en `localStorage.fi_token`. No hay almacén que
  crezca (a diferencia de Determinantes).
- En su despliegue `ANYONE_ANONYMOUS` **toda función global es invocable desde
  el navegador**, y `.claspignore` es una lista blanca de archivos.

## 2. Decisión: el boleto lleva el nombre de la coordinación

Se agrega el campo `n` (nombre de la coordinación, tal como está en el
catálogo de la máscara) al cuerpo firmado del boleto. `verificarBoleto`
devuelve `nombre`.

- Evita que cada hermano guarde su propia tabla `COOR→nombre`: eso es duplicar
  el catálogo, lo que la spec original prohíbe.
- **Compatible hacia atrás:** un verificador viejo ignora el campo. La copia de
  `Boleto.gs` en Determinantes sigue funcionando sin tocarse; se resincroniza
  la próxima vez que se despliegue Determinantes.
- La firma cubre `n`: no se puede cambiar el nombre sin invalidar el boleto.

## 3. Cambios

### Máscara (`PortalPromocion`)
- `Boleto.gs`: `emitirBoleto(usuario, coordinacionId, destino, vence, secreto, nombre)`
  (sexto parámetro opcional → `n`); `verificarBoleto` agrega `nombre: datos.n || ''`
  al resultado. Pruebas: ida y vuelta con nombre acentuado; boleto sin `n`
  sigue verificando con `nombre: ''`.
- `Api.gs` (`contextoDeBoleto`): pasa `u.nombre` como sexto argumento.
- Hoja `DESTINOS`: fila `mensual_coordinacion`, clase `HERMANO_CON_CONTRASENA`
  (solo recibe `?boleto=`), URL `/exec` de producción de Mensual.

### Mensual (`MENSUAL COORDINACION`)
- `Boleto.gs`: copia literal de la versión nueva. Se agrega a la lista blanca
  de `.claspignore`.
- `Mascara.gs` (nuevo, en la lista blanca):
  - `DESTINO_MENSUAL_ = 'mensual_coordinacion'`.
  - `coordDeBoleto_(verificado, filasAuth)` — pura. Entre las filas de `AUTH`
    (`[coord, hash, fecha, alias]`), la **única** con
    `_normCoord(coord) === _normCoord(verificado.nombre)` y `getTipo(coord) !== 'ADMIN'`.
    Cero o varias → `{ ok:false, code:'BOLETO_SIN_CUENTA' }`.
  - `entrarConBoleto(boleto, tokenAnterior)` — pública (la llama la pantalla).
    Verifica con `destino = 'mensual_coordinacion'`; resuelve la coordinación;
    si `validarSesion(tokenAnterior)` ya es de esa coordinación, la reusa; si
    no, crea la sesión igual que `loginCoordinacion`. Devuelve la forma de
    Mensual: `{ ok, token, coord, tipo }` o `{ ok:false, msg }`.
  - Los auxiliares terminan en `_`: Apps Script no los expone a
    `google.script.run`.
- `Index.html`, arranque: antes de mirar `fi_token`, `google.script.url.getLocation`;
  si hay `boleto` → `google.script.history.replace(null, {}, '')`, mensaje
  «Entrando desde el portal…», `entrarConBoleto(boleto, fi_token)`. Éxito →
  guarda el token, `sesion = {coord, tipo}` y `mostrarPanel()`. Falla → pantalla
  de lista de siempre con el motivo. Sin boleto → igual que hoy.
- Pruebas en Node: `tools/mascara/pruebas.js` (fuera de la lista blanca, no se
  sube) carga `Boleto.gs` y `Mascara.gs` con el shim de `Utilities` de la
  máscara y un `_normCoord`/`getTipo` extraídos de `Code.gs`.

### Mensajes (quien captura)
| Código | Mensaje |
|---|---|
| `BOLETO_INVALIDO` | «El acceso desde el portal no es válido. Elija su coordinación.» |
| `BOLETO_VENCIDO` | «El acceso desde el portal venció. Vuelva a entrar desde el portal o elija su coordinación.» |
| `BOLETO_SIN_CUENTA` | «No se encontró su coordinación en este sistema. Elíjala de la lista.» |
| cualquier otro | «No se pudo entrar desde el portal. Elija su coordinación.» |

## 4. Secreto

El valor actual de `SECRETO_BOLETOS` no se guardó en ningún lado legible. Se
rota una vez más con instaladores temporales en los tres proyectos (máscara,
Determinantes, Mensual) y **esta vez se guarda en**
`~/.config/mascara/SECRETO_BOLETOS` (fuera de todo repo) para instalarlo en los
hermanos de la Fase 4 sin volver a rotar. Rotar obliga a las coordinaciones a
entrar otra vez a la máscara una vez.

## 5. Despliegue y reversa

- Máscara: `clasp update-deployment` a versión nueva (reversa: `-V 1`).
- Mensual: `clasp update-deployment AKfycbziZ5yNV…` a versión nueva (reversa: `-V 14`).
- Todo cambio se anota en la bitácora de cambios drásticos.

## 6. Verificación

Automática (Chromium): máscara → Mensual entra al panel con la coordinación;
URL limpia; recarga sigue dentro; boleto alterado → lista con mensaje.
A mano: UNEME cae en la lista; la Jurisdicción entra con contraseña como hoy.

## 7. Fuera de alcance

Resolver UNEME (necesita decidir si la máscara tendrá tres cuentas UNEME), sondas.
