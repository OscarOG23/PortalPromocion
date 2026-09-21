# Fase 5 — Sondas de avance — Diseño

**Fecha:** 2026-09-21 · **Aprobación:** previa y general del usuario (2026-09-21).

**Objetivo:** Que la máscara pinte cada destino como **Reportado** (verde) o
**Pendiente** (ámbar) según lo que el capturador sepa, en vez del gris «Sin
dato». Esta fase hace la primera sonda, **Determinantes**, y deja el protocolo
listo para los demás.

Regla dura de la spec original, sin cambios: **nada se pinta de verde por
falta de datos.** Toda falla (red, secreto, respuesta rara, sin unidades) es gris.

## 1. Protocolo de sonda nativa (contrato entre la máscara y los hermanos)

La máscara pregunta con un GET al `/exec` del hermano:

```
<url>?sonda=<boleto>&anio=<AAAA>&mes=<1-12>
```

- `boleto`: el mismo formato de siempre, emitido para el destino
  **`sonda:<destino_id>`** (p. ej. `sonda:determinantes`), con vida de **5 minutos**,
  `u = 'mascara'`, `c` = `coordinacion_id`, `n` = nombre. Un boleto de sonda no
  abre sesión (su destino no es el del hermano) y uno de sesión no sirve de
  sonda.
- Respuesta JSON (`ContentService`):
  `{ ok: true, reportado: true|false, unidades: N, reportadas: K }` o
  `{ ok: false, code }`. La máscara solo usa `ok` y `reportado`.
- El hermano responde **solo** sobre la coordinación del boleto verificado.

## 2. Máscara

- `appsscript.json`: vuelve el alcance `script.external_request` (UrlFetch).
  **Requiere que el dueño autorice una vez** en el editor.
- Columna `sonda` de `DESTINOS`: valor nuevo **`NATIVA`** = «este hermano
  implementa el protocolo». `problemasDeDestino` acepta `NINGUNA`, vacío o `NATIVA`,
  y rechaza `NATIVA` en un `FORMULARIO`.
- Puras (con pruebas): `urlDeSonda(destino, boleto, anio, mes)` y
  `interpretarRespuestaSonda(codigoHttp, texto)` → `{ ok, reportado }` o `null`
  (todo lo que no sea HTTP 200 con JSON `ok:true` y `reportado` booleano).
- `consultarSondasNativas_(destinos, coordinacion, anio, mes, secreto)`: para las
  filas `NATIVA`, arma las peticiones y las lanza **juntas** con
  `UrlFetchApp.fetchAll` (`muteHttpExceptions`), las interpreta con
  `estadoDeSonda`, y guarda en caché **10 minutos** cada respuesta definitiva
  (`sonda:<destino>:<coord>:<anio>-<mes>`). Cualquier excepción → todos gris.
- `contextoDeBoleto`: los `NATIVA` toman su estado del mapa anterior; los demás
  siguen con `estadoDeDestino`.
- La fila `determinantes` de `DESTINOS` pasa a `sonda = NATIVA`
  (`sembrarDestinosConocidos` no toca filas existentes: se cambia con una
  función `activarSondasConocidas` para el botón Ejecutar, que copia la columna `sonda` de `DESTINOS_CONOCIDOS`).

## 3. Determinantes

- `Boleto.gs` se resincroniza con la versión con `n` (copia literal).
- `doGet(e)`: si trae `e.parameter.sonda` responde JSON con
  `responderSonda_(e.parameter)`; si no, la pantalla de siempre.
- Pura `avanceDeCoordinacion(unidades, filasCaptura, coordinacionId, anio, mes)`:
  - unidades activas de esa coordinación; ninguna → `{ ok:false, code:'SIN_UNIDADES' }`;
  - una unidad cuenta como reportada si tiene filas de ese periodo y **todas**
    están en `ENVIADO`, `VALIDADO` o `CERRADO`. `BORRADOR` y `OBSERVADO`
    (devuelta para corregir) son pendientes;
  - `reportado` = todas las unidades reportadas.
- `responderSonda_`: verifica el boleto con destino `sonda:determinantes`,
  valida `anio` (entero 2000–2100) y `mes` (1–12), lee `CAT_UNIDADES` y
  `CAPTURA_DETERMINANTES` una vez, responde. Excepción → `{ ok:false, code:'ERROR_INTERNO' }`.
  Termina en `_`: no queda expuesta a `google.script.run`.

## 4. Despliegue y reversa

Máscara @2 → nueva (autorización del alcance nuevo por el dueño); Determinantes
@14 → nueva. Reversas anotadas en la bitácora. El orden importa: primero
Determinantes (responde a sondas aunque nadie pregunte), luego la máscara.

## 5. Verificación

Pruebas puras en los dos repos. En vivo: con una coordinación de prueba, la
máscara muestra Determinantes en ámbar (septiembre sin enviar) o verde; una
sonda con boleto alterado responde `ok:false`; con Determinantes caído, gris.

## 6. Siguiente

Mensual Coordinación con el mismo protocolo (por nombre: `Capturas` columna C
y mes canónico). SIPS no tiene cómo contestar por coordinación sin leer su hoja
de reportes: se evalúa después.
