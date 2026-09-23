# Fase 6 — Capturador de Actividad Física — Diseño

**Fecha:** 2026-09-23 · **Aprobación:** del usuario en la sesión de diseño (2026-09-23).

**Objetivo:** Que el «Reporte de Actividad Física» (colateral `08 COLATERAL DE AF 2026.xlsx`
que se envía a Toluca) deje de llenarse a mano. Cada coordinación captura sus unidades
desde la máscara; la jurisdicción genera el Excel en el formato estricto, con fotos.
El formulario «Reporte de COLATERAL DE ACTIVIDAD FISICA» (dueño
`entornoslaboralestexcoco@gmail.com`) se **retira** cuando el primer mes funcione.

Decisiones del usuario:

- Cada coordinación captura sus propias unidades.
- El Excel de Toluca lista **solo las unidades que reportaron** ese mes (agosto: 7).
- Fotos **por unidad**, subidas por la coordinación.
- A Toluca va **un Excel jurisdiccional** (JURISDICCIÓN TEXCOCO).
- Enfoque A: hermano nuevo. Tras analizar el archivo, el Excel se arma editando el
  `.xlsx` original (§5), no exportando desde Google Sheets.

## 1. El formato (referencia: `Downloads/08 COLATERAL DE AF 2026.xlsx`)

Una hoja, `Actividad`, rango `A1:M17` en agosto:

- Filas 1–6: encabezado institucional (ISEM, Coordinación de Salud, Subdirección de
  Prevención y Control de Enfermedades, Departamento de Promoción de la Salud, Programa
  de Estilos de Vida y Entornos Saludables, REPORTE DE ACTIVIDAD FÍSICA) y dos logos.
- Fila 7: `A7 JURISDICCION:` · `B7 TEXCOCO` · `K7` fecha (primer día del mes, se ve `ago-26`).
- Filas 8–9: encabezados de columna, con H/M en la fila 9.
- Desde la fila 10, una fila por unidad; al final `TOTAL` con `=SUM(...)` por columna.
- Debajo, las fotos.

| Col | Campo (`CAPTURA_AF`) | Encabezado |
|---|---|---|
| A | `unidad` | Unidad de Salud |
| B | `ses_pob` | Núm. de sesiones de actividad física con la población en general |
| C, D | `asis_pob_h`, `asis_pob_m` | Asistentes a esas sesiones, H / M |
| E | `tall_pers` | Talleres de alimentación y actividad física al personal de salud |
| F, G | `asis_tall_h`, `asis_tall_m` | Asistentes a esos talleres, H / M |
| H | `pausa_pers` | Sesiones de pausa para la salud al personal de salud |
| I, J | `asis_pausa_h`, `asis_pausa_m` | Participantes en pausa para la salud, H / M |
| K | `bici` | Actividades que involucran el uso de la bicicleta |
| L, M | `asis_bici_h`, `asis_bici_m` | Participantes en esas actividades, H / M |

## 2. Proyecto

**Va aparte, no dentro de la máscara ni de Determinantes.** La máscara solo da acceso y
semáforo; guardar capturas, fotos y generar formatos no es su trabajo. Determinantes es
otro programa, ya en producción. Un hermano propio no mezcla datos, deployments ni
permisos, y a la máscara solo le cuesta una fila en `DESTINOS`. Su repo es **privado**:
maneja fotos de personas y la referencia del formato.

- Apps Script nuevo en la cuenta `comitepromociontex@gmail.com`, ligado a su propia hoja.
  Repo git propio en `PROYECTOS ISEM/ACTIVIDAD FISICA` (correo noreply en `user.email`).
- `Boleto.gs`: copia literal del de la máscara. `SECRETO_BOLETOS` = el mismo de los
  hermanos (`~/.config/mascara/SECRETO_BOLETOS`; se instala, no se rota).
- Solo se entra por la máscara: `doGet` sin boleto válido para `actividad_fisica`
  muestra «Entra desde el portal de Promoción».
- En la máscara: fila en `DESTINOS_CONOCIDOS` → `actividad_fisica`, nombre
  «Reporte de Actividad Física», apartado «Reporte mensual», clase
  `HERMANO_CON_CONTRASENA`, `aplica_a TODAS`, `sonda NATIVA`, orden 4. Se agrega con
  `sembrarDestinosConocidos()`. El código de producción de la máscara no cambia.

## 3. Captura (pantalla del hermano, pensada para teléfono)

- Selector de mes (por defecto: mes anterior; desde el día 25, el mes en curso, igual que SIPS).
- Lista de las unidades **activas** de la coordinación del boleto (`CAT_UNIDADES`,
  cargado de `SIPS/unidades_2026.json`). Cada una muestra «Capturada» o «+ Capturar».
- Al abrir una unidad: los 12 números de la tabla §1 y de 1 a 3 fotos.
- Validación dura: enteros ≥ 0, obligatorios (vacío = 0 no se asume: se pide).
- Alertas que **no bloquean**: actividad > 0 con asistentes H+M = 0; asistentes > 0
  con actividad = 0; una unidad guardada toda en ceros.
- Guardar hace upsert con clave `anio + mes + unidad_id`. Se puede borrar la unidad
  del mes (borra la fila y manda sus fotos a la papelera de Drive).
- Fotos: el navegador las reduce a JPEG de lado mayor 1280 px y calidad 0.75 antes de
  subirlas; se rechaza lo que no sea imagen. Más de 3 por unidad no se permite.
- **«Terminar el mes»**: la coordinación cierra el mes (con unidades capturadas o con
  ninguna = «sin actividad»). Cerrado, la captura de ese mes queda de solo lectura.
  Reabrir es solo de la jurisdicción (menú de la hoja, §5).

## 4. Datos (hoja del hermano)

- `CAPTURA_AF`: `id` (UUID), `anio`, `mes`, `coordinacion_id`, `coordinacion`,
  `unidad_id`, `unidad`, los 12 campos de §1, `usuario`, `actualizado`.
- `FOTOS_AF`: `foto_id`, `anio`, `mes`, `unidad_id`, `drive_id`, `usuario`, `fecha`.
  Carpeta: `Actividad Física/<AAAA-MM>/<Coordinación>/<Unidad>/`.
- `CIERRES_AF`: `anio`, `mes`, `coordinacion_id`, `estado` (`CERRADO`/`ABIERTO`),
  `usuario`, `fecha`.
- `CAT_UNIDADES`, `AUDITORIA`. La plantilla del formato es un `.xlsx` en Drive (§5).
- Nunca se usa el número de fila como identificador.

## 5. El Excel jurisdiccional

### Lo que dice el análisis del archivo de referencia

- Un libro de 23 partes: una hoja (`sheet1.xml`), un dibujo (`drawing1.xml`), 8 imágenes,
  `styles.xml`, `sharedStrings.xml`, `calcChain.xml`, `printerSettings1.bin`.
- Tipografías mezcladas: **Helvetica Neue** (encabezado, títulos de columna, TOTAL),
  Calibri (fila 7), Arial 10 (datos). Bordes `medium` en la tabla, `thin` en TOTAL.
- 14 rangos combinados (A1:M1…A6:M6 y los de las filas 8–9); altos fijos (fila 8 = 114.75).
- `K7` con formato `mmm-yy`. Página horizontal, ajustada a una hoja (`fitToPage`).
- Imágenes: 2 logos con `oneCellAnchor` (A1 y L2) y 6 fotos con `twoCellAnchor` en un
  collage libre (filas 18–65), **sin agrupar por unidad**. Pesa 3.1 MB por las fotos.

Consecuencia: pasar por Google Sheets cambiaría Helvetica Neue y otros detalles. **El Excel
se arma editando el `.xlsx` original, no convirtiéndolo.**

### Cómo se arma

La plantilla es el `.xlsx` de referencia **sin las 6 fotos** (solo logos), guardado en Drive
(`Actividad Física/Plantilla/COLATERAL_AF_PLANTILLA.xlsx`). En Apps Script:

1. `Utilities.unzip` de la plantilla.
2. `sheet1.xml`: `K7` = serial de fecha del primer día del mes; una fila `<row>` por unidad
   desde la 10, clonando los estilos (`s=`) de la fila 10 de la plantilla; nombres de unidad
   como cadenas en línea (`t="inlineStr"`); la fila TOTAL se recorre al final con
   `<f>SUM(B10:Bn)</f>` … `M`; se ajustan `dimension` y alturas.
3. Se quita `calcChain.xml` (y su relación y tipo de contenido) y se marca
   `fullCalcOnLoad="1"` en `workbook.xml`, para que Excel recalcule al abrir.
4. Fotos: cada una entra como `xl/media/fotoN.jpeg` con su relación en
   `drawing1.xml.rels` y un `twoCellAnchor` en `drawing1.xml`, en rejilla debajo del TOTAL
   (2 filas de separación), en el orden de la tabla. El nombre de la unidad va en la celda
   de arriba de su grupo, con el estilo de los datos. Se agrega `jpeg` a `[Content_Types].xml`.
5. `Utilities.zip` → `.xlsx` en `Actividad Física/Colaterales/`
   `08 COLATERAL DE AF <AAAA> - <MES>.xlsx` (reemplaza el del mismo mes) y muestra el enlace.

Todo lo que no se toca (estilos, tema, combinados, anchos, logos, impresión) queda
byte por byte igual. Las funciones que editan XML son puras (texto → texto) y se prueban
en Node con el archivo de referencia.

Peso: con fotos de 1280 px al 75 % (~150–250 KB cada una), 15 unidades × 3 fotos ≈ 9 MB.
El menú avisa si el archivo pasa de 10 MB.

### Menú de la hoja

Solo lo ve quien abre la hoja (la cuenta del comité): «Actividad Física → Generar colateral
del mes…» (pide año y mes, avisa qué coordinaciones no han cerrado, se puede seguir) y
«Reabrir mes de una coordinación…».

**Tarea 1 del plan = prueba de fidelidad:** con los datos de agosto (§1) y 6 fotos, generar el
Excel en Node con las mismas funciones puras y compararlo con la referencia: valores,
fórmulas, combinados, anchos, fuentes y que abra en Excel **sin el aviso de reparación**.

## 6. Sonda (semáforo de la máscara)

Contrato de la fase 5 sin cambios: `GET <exec>?sonda=<boleto sonda:actividad_fisica>&anio&mes`
→ `{ ok:true, reportado, unidades, reportadas }` o `{ ok:false, code }`.

- `reportado` = la coordinación tiene `CERRADO` ese mes en `CIERRES_AF`.
- `unidades` = unidades activas de la coordinación; `reportadas` = con captura.
- Sin unidades activas → `{ ok:false, code:'SIN_UNIDADES' }` (gris). Excepción → `ERROR_INTERNO`.

## 7. Errores

- Boleto inválido o vencido → pantalla «Entra desde el portal de Promoción».
- Falla de Drive al subir una foto → los números quedan guardados; la foto se marca
  «no se subió, reintentar».
- Periodo cerrado → el servidor rechaza la escritura aunque la pantalla la permita.
- Errores internos → mensaje genérico en pantalla, detalle en `AUDITORIA`.

## 8. Pruebas

Puras en Node (`node tools/run-tests.js`, mismo corredor que los otros repos):
validar captura y alertas, clave de captura, orden de filas del Excel, edición de
`sheet1.xml` (filas, TOTAL, `K7`), edición de `drawing1.xml` y sus relaciones, retiro de
`calcChain`, nombre del archivo, avance para la sonda, mes por defecto. La prueba de
fidelidad (§5) corre sobre el `.xlsx` de referencia, que vive en el repo privado del hermano.

En vivo: una coordinación de prueba entra desde la máscara, captura una unidad con una
foto, termina el mes y la máscara la pinta en verde; luego se genera el Excel de agosto.

## 9. Despliegue y reversa

1. Hermano: `clasp create`, push, secreto instalado, deployment nuevo → URL `/exec`.
2. Máscara: fila en `DESTINOS_CONOCIDOS` (commit) y `sembrarDestinosConocidos()` en el editor.
   Producción de la máscara no cambia.
3. Reversa: `activo = FALSE` en la fila de `DESTINOS`. Todo se anota en la bitácora
   de cambios drásticos.
4. El formulario se cierra a mano cuando el primer mes salga bien.

## Fuera de alcance

Tablero, flujo de validación jurisdiccional (más allá de reabrir), PDF, captura por el
formulario, históricos anteriores a la puesta en marcha.
