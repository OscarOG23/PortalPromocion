# La máscara: acceso único a los capturadores de Promoción — Diseño

**Fecha:** 2026-09-21
**Proyecto:** `PROYECTOS ISEM/PortalPromocion`
**Objetivo:** Que una coordinación entre **una sola vez**, con **una sola
contraseña**, y desde ahí llegue a cualquiera de los capturadores ya
identificada — sin volver a escribir quién es.

---

## 1. Por qué es un proyecto aparte

Se separó de `DeterminantesConcentrado` el 2026-09-21, por decisión explícita
del usuario. La razón no es de comodidad: son dos ejes distintos.

- **Determinantes** es un capturador: recibe números, valida y emite el formato
  oficial en PDF.
- **La máscara** es una puerta: no captura nada. Identifica y reparte.

Mezclarlos obligaría a que cada capturador nuevo tocara el código de
Determinantes. Separados, la máscara crece por fuera y ningún capturador
depende de otro.

## 2. El problema real, medido

Hoy la coordinación tiene que recordar credenciales distintas por sistema:

| Proyecto | Qué es | Cómo se identifica hoy |
|---|---|---|
| **DeterminantesConcentrado** | Apps Script web app (`/exec`) | usuario de coordinación + contraseña `usuario+26` |
| **MENSUAL COORDINACION** | Apps Script web app | `login(usuario, password)` propio, con cambio de contraseña |
| **SIPS** (Fechas a Conmemorar) | Apps Script web app; ya reemplazó al Google Form | sin contraseña: elige unidad y coordinación en la interfaz |
| **SSOP** (promotores) | Apps Script + capturador en GitHub Pages | el promotor elige su nombre de una lista |
| **ENTORNOS PROYECTO** | Capturador web app desplegado | elección en la interfaz |
| **JORNADA SALUD / VISOR-JORNADAS** | Existen; estado por verificar | por verificar |
| **Formularios de Google restantes** | Del inventario de 14 del sitio | una **pregunta** de coordinación |

Dos contraseñas distintas que memorizar, y en el resto, escribir la
coordinación otra vez cada mes.

**Un Google Form no tiene contraseña que quitarle.** Tiene una pregunta. Lo
único posible —y suficiente— es abrirlo **pre-llenado**.

## 3. Arquitectura

**Página en GitHub Pages + Apps Script que solo responde datos.**

No es preferencia de estilo. Viene de un defecto verificado en SSOP: en Android
Chrome, el dominio `script.google.com` se enruta por la cuenta de Google con la
que el teléfono está firmado, y el despliegue se resuelve contra la cuenta
equivocada. Determinantes hoy sirve su pantalla desde `/exec` y por eso hereda
ese riesgo. La máscara, siendo la **única puerta**, sería la primera en
sufrirlo: se sirve desde Pages.

El Apps Script queda reducido a una API: valida credenciales, emite boletos,
entrega el catálogo, responde qué falta.

## 4. Unidades y sus límites

Cada una hace una cosa y se puede probar sola.

| Unidad | Qué hace | De qué depende |
|---|---|---|
| **Padrón** | Las 22 cuentas de coordinación, su huella y su sal | Hoja `USUARIOS` del portal |
| **Sesión** | Emite y verifica el boleto; vence a 30 días; bloquea tras 5 intentos | Padrón |
| **Catálogo** | Las 22 coordinaciones y las 69 unidades. **Fuente única de verdad** | Hoja + caché |
| **Directorio de destinos** | Qué capturadores existen, de qué clase es cada uno, a qué coordinaciones aplica y cómo se le pasa la identidad | Hoja `DESTINOS` |
| **Sondas de avance** | Contesta "¿esta coordinación ya reportó este mes?" por destino | Directorio |
| **Pantalla** | Acceso y lista de destinos con su estado | La API |

El **Directorio de destinos es una hoja, no código**. Agregar un capturador
nuevo es agregar una fila. Ese es el punto de todo el diseño: la máscara no se
reprograma cada vez que nace un sistema.

## 5. Cómo viaja la identidad

El portal emite un **boleto firmado** (coordinación, vencimiento, firma HMAC con
un secreto compartido en `ScriptProperties`). Viaja en la URL al abrir el
destino. Tres clases de destino, tres tratos:

| Clase | Proyectos | Trato |
|---|---|---|
| **Hermano con contraseña propia** | Determinantes, Mensual Coordinación | Verifica el boleto y entra. **Se le retira su pantalla de acceso.** |
| **Hermano sin contraseña** | SIPS, SSOP, Entornos | Llega con la coordinación **ya elegida**; no hay login que quitar |
| **Formulario de Google** | Los que queden | Enlace **pre-llenado** (`entry.<id>=<coordinación>`) |

El boleto **autoriza, no informa**: el hermano vuelve a resolver los permisos
contra su propia regla. Un boleto válido dice *quién es*, nunca *qué puede*.
Esto conserva la regla que ya rige en Determinantes — toda validación en el
servidor, nunca en lo que mande la pantalla.

## 6. Qué falta este mes

El portal marca cada destino como **reportado**, **pendiente** o **no se sabe**.
La señal sale de tres lados, según lo que el destino sepa contestar:

1. **Nativa** — el hermano expone una función que contesta sí o no
   (coordinación, año, mes). Determinantes puede hoy; a los demás hay que
   agregárselo.
2. **Hoja de respuestas** — el portal lee la hoja del formulario y busca una
   fila con esa coordinación y ese mes. Frágil por construcción: si alguien
   cambia la pregunta, la sonda deja de ver.
3. **Sin señal** — se muestra **en gris**, como *no se sabe*.

Regla dura: **nada se pinta de verde por falta de datos.** Un pendiente
escondido es peor que un hueco visible. Cuando una sonda falla, el estado es
gris, nunca reportado.

## 7. Errores

Se devuelven como objeto, con código, igual que en Determinantes:
`{ ok: false, code: 'CREDENCIALES_INVALIDAS', message: '...' }`.

Códigos: `CREDENCIALES_INVALIDAS`, `USUARIO_BLOQUEADO`, `BOLETO_INVALIDO`,
`BOLETO_VENCIDO`, `DESTINO_DESCONOCIDO`, `SONDA_SIN_RESPUESTA`.

Como en Determinantes, el acceso fallido no distingue entre usuario inexistente,
inactivo y contraseña equivocada: distinguirlos permite averiguar qué cuentas
existen probando nombres.

## 8. Qué se copia de DeterminantesConcentrado

Piezas que no dependen del dominio de Determinantes:

| Archivo | Qué aporta |
|---|---|
| `src/Auth.gs` | Sesión de 30 días con token en caché + propiedades, bloqueo por intentos, poda de sesiones vencidas |
| `src/Credenciales.gs` | Sal + huella SHA-256, y la advertencia de cuándo deja de bastar |
| `src/Usuarios.gs` | Usuario y contraseña derivados del nombre de la coordinación |
| `src/Sheets.gs` | Lectura por lote y caché de catálogos |
| `src/Auditoria.gs` | Bitácora |
| `src/Claves.gs` | `esVerdadero` y los normalizadores |
| `src/Catalogos.generado.gs`, `datos/`, `DIRECTORIO.xlsx` | Las 22 coordinaciones y 69 unidades |
| `src/Index.html` (sección `acceso`), `src/Styles.html` | La pantalla de entrada |
| `tools/run-tests.js` | El corredor de pruebas local |
| Plan del 2026-09-09 | El inventario de los 14 formularios en 5 apartados |

**Se queda en Determinantes:** `Captura.gs`, `Secciones.gs`, `Medidas.gs`,
`Validaciones.gs`, `Formato.gs`, `Pdf.gs`, `Plantilla*.gs`, `Evidencias.gs`,
`Dashboard.gs`, `Periodos.gs`.

**El catálogo no se duplica.** Copiarlo y dejar las dos copias vivas garantiza
que en seis meses no coincidan. El portal queda como dueño y Determinantes lo
lee de ahí.

## 9. Pruebas

Las partes puras se prueban sin Apps Script, con `tools/run-tests.js` como en
Determinantes: firma y verificación del boleto, vencimiento, bloqueo por
intentos, derivación de usuario y contraseña, armado del enlace pre-llenado, y
la decisión de estado de cada sonda — incluyendo que una sonda caída dé gris y
nunca verde.

Lo que toca la plataforma (Sheets, Drive, despliegue) se verifica a mano, con
una coordinación y un periodo de prueba acordados.

## 10. Orden de construcción

1. **Portal solo** — padrón, catálogo, sesión, directorio de destinos, pantalla,
   enlaces pre-llenados. Ningún capturador se toca. Al terminar, ya sirve.
2. **Determinantes acepta el boleto** y pierde su pantalla de acceso.
3. **Mensual Coordinación** igual. Es el que más duele hoy.
4. **SIPS, SSOP, Entornos** — llegan con la coordinación elegida.
5. **Las sondas de avance**, una por destino, en el orden en que se pueda.

Determinantes no se modifica hasta que el paso 1 funcione en producción.

## 11. Verificar antes de construir

- El estado real de **JORNADA SALUD** y **VISOR-JORNADAS**: si son capturadores
  desplegados, de qué clase son.
- Qué queda vivo del inventario de 14 formularios, tras SIPS y Mensual.
- Los `entry.<id>` de cada Google Form que siga en pie: sin ellos no hay enlace
  pre-llenado.
- Si el catálogo de coordinaciones de **MENSUAL COORDINACION**
  (`CATALOGO_COORDINACIONES`) coincide con las 22 de Determinantes, o si hay que
  reconciliarlos antes de unificar.
