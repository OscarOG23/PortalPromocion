# Integración de reportes preventivos

Implementación local: 30 de septiembre de 2026. Pendiente publicar los backend y conectar las fuentes reales. Los formularios y Excel históricos se conservaron.

## Captura

**Adicciones — DeterminantesConcentrado.** Apartado propio de evidencias, selección múltiple de imágenes/PDF y vinculación de archivos existentes. Sesiones = talleres alcanzados de SUB039; asistencias = femenino + masculino. Clasificación manual con usuario y fecha separados del resultado OCR. Un archivo repetido en la misma unidad/mes se vincula; en otra unidad/mes se rechaza. La migración de columnas se ejecuta idempotentemente dentro del bloqueo al declarar evidencia. El procesamiento OCR relee la tabla antes de guardar para conservar declaraciones y cargas concurrentes.

**Escuelas — JS19-JORNADAS.** Botón «Trabajo preventivo en escuelas» dentro de Jornadas. Registro mensual por unidad + CCT + turno, planteles reutilizables y matrícula por ciclo escolar. Borrador y envío, sin límite de cinco planteles. Sesiones programadas/realizadas, cantidades por seis temas, alumnos/docentes/tutores y tamizaje. El total de asistencias se calcula. La intervención no crea una jornada integral ni escribe en PRODUCTIVIDAD, SAM o Determinantes. Una jornada real puede vincularse mediante su folio, conservando las fotos originales. Los registros enviados siguen siendo corregibles; se valida la versión para evitar sobreescribir cambios de otro dispositivo. No hay nueva cuenta ni un repositorio adicional.

Los campos vacíos conservan el significado pendiente. No se aplica una meta automática de 4 sesiones/mes: el mismo libro de referencia contiene 40/año/unidad. Las cantidades por tema pueden coincidir dentro de una misma sesión, por lo que no se suman para reconstruir sesiones realizadas. Matrícula y asistencias son medidas distintas.

## Productos disponibles en el código

Desde el complemento escolar, los botones descargan Excel de revisión de la unidad y periodo elegidos. La consulta sin unidad abarca las unidades autorizadas de la cuenta. Los totales municipales de una coordinación constituyen ese alcance parcial; no certifican un concentrado jurisdiccional completo:

| Producto | Hojas | Fuente |
|---|---|---|
| Adicciones | Anual por unidad con sesiones/asistencias; mensual por unidad; mensual por municipio | SUB039 de Determinantes, unido a Jornadas por CLUES |
| Detecciones | Cantidades de drogas, AUDIT y Fagerström por unidad; aplicaciones por recurso/instrumento y comparación SIS | Fuente nominal privada y fuente SIS configurables |
| Escolar | CCT, plantel, turno, ciclo, matrícula, sesiones, temas, públicos y tamizaje | INTERVENCIONES_ESCOLARES |

Los folios de papelería se retiraron por aclaración del usuario: ya no se entregan formatos numerados; el recurso imprime sus hojas y se recaba únicamente cuántos cuestionarios realizó. Los productos nuevos no piden folios ni calculan cantidades por diferencia entre números.

Los libros nuevos simplifican las tablas; no son copias visuales de las plantillas históricas. Se identifican como **REVISION**. No contienen nombres/CURP de pacientes ni listados nominales, y no arrastran cifras ni firmas históricas. Los faltantes son `PENDIENTE`, no cero. Adicciones en borrador no se certifica en el Excel; los datos escolares en borrador conservan su identificación pero sus cifras productivas se señalan pendientes. Detecciones informa aplicaciones observadas: todavía falta establecer la cobertura/completitud de la fuente real para certificar un mes completo o un reporte explícito en cero.

## Fuentes externas: adaptadores locales y configuración pendiente

Las propiedades se configuran en el Apps Script privado de JS19-JORNADAS, nunca en Pages:

| Propiedad | Uso |
|---|---|
| `ID_CARPETA_FUENTES_PREVENTIVAS` | Carpeta privada de agregados preparados desde los Excel recibidos; ruta preferente |
| `ID_DETERMINANTES` | ID de la hoja de cálculo ya utilizada por Determinantes |
| `ID_BASE_NOMINAL` | Conector alternativo de hoja normalizada; ya se recibió la base nominal XLSX |
| `HOJA_DETECCIONES_NOMINAL` | Hoja/vista de aplicaciones; por defecto `DETECCIONES_NORMALIZADAS` |
| `ID_SIS_NORMALIZADO` | Fuente opcional de comparación SIS, con mediciones equivalentes |
| `HOJA_SIS_NORMALIZADO` | Por defecto `SIS_NORMALIZADO` |

La vista nominal debe ofrecer `evento_id` (identidad de **una aplicación**, no de la persona), `unidad_id` (CLUES), `fecha` de aplicación, `instrumento` (`DROGAS`, `AUDIT`, `FAGERSTROM`) y `recurso_id`. No necesita folios ni datos identificativos del paciente. Se deduplican reimportaciones de una aplicación; si una misma identidad tiene valores diferentes, se detiene la salida para revisión. Los tres cuestionarios pueden aplicarse a una persona y contar cada aplicación por separado. Esta vista es un contrato del conector, no una nueva captura manual; se conserva como alternativa al adaptador XLSX ya implementado.

La vista SIS espera `periodo` (`AAAA-MM`), `unidad_id` (CLUES), `recurso_id`, `instrumento` y `total`. Debe contener filas de detalle con claves únicas, excluyendo subtotales jerárquicos. Nominal y SIS se comparan para la misma unidad, recurso, instrumento y periodo. Si difieren, se muestran ambas cifras y `DIFERENCIA`; no se suman ni se decide una prioridad todavía no indicada por el usuario. El conector alternativo no modifica los archivos recibidos. El nuevo adaptador XLSX los lee localmente y produce cortes agregados privados.

El archivo SINBA encontrado en el portal abarca **01/01/2026–31/08/2026**, está agrupado por profesional y tiene la columna genérica Detecciones. Sus subtotales y filas de recurso no se deben sumar juntos. Ese total no permite identificar drogas/AUDIT/Fagerström ni distribuir aplicaciones mensuales. No es entrada compatible directa del reporte mensual de estos cuestionarios. Se necesita el detalle específico o confirmar que SIS se usará únicamente para contraste global, en una salida distinta.

Sin propiedades o columnas compatibles, el servidor responde `FUENTE_PENDIENTE` / `FUENTE_INCOMPATIBLE`; no emite un libro con cifras inventadas.

Se incorporaron adaptadores para la base nominal recibida, los Cubos localizados y la descarga SINBA. La equivalencia de instrumentos fue confirmada por el usuario. El nominal permite contar por unidad pero carece de identidad del prestador; SINBA conserva su intervalo y deja pendientes los recursos repetidos. Ver el [piloto, las reglas de sustitución y la conexión mensual](fuentes-mensuales-preventivos-2026-09-30.md).

## Publicación

1. Revisar y subir las fuentes modificadas de DeterminantesConcentrado y JS19-JORNADAS a sus Apps Script. Actualizar sus despliegues existentes, conservando sus URL. Los nuevos endpoints escolares exigen boleto vigente; las cuentas personales conservan su restricción de unidad.
2. Configurar `ID_DETERMINANTES` y conectar la fuente nominal real. La equivalencia nominal ya fue confirmada. Conectar la carpeta de agregados y revisar cobertura/cortes antes de certificar cifras; las fuentes se comparan sin suma. La hoja lateral escolar se crea al primer guardado válido; no requiere modificar las 29 columnas de SAM.
3. Publicar Pages únicamente después del backend. La pantalla del portal se regeneró con `scripts/publicar_pages.py`; sus archivos se mantienen generados.
4. Contrastar un mes piloto por unidad, municipio, escuela e instrumento antes de sustituir Forms. No se migraron respuestas ni se registraron actividades reales.

No se ejecutaron `clasp push`, actualizaciones de despliegue, `git push`, migraciones sobre hojas reales ni importaciones sobre fuentes de producción en esta sesión; sí se realizó un piloto local privado con los Excel proporcionados. Los Excel se generan en Sheets temporales y se devuelven como descarga autenticada; el temporal se envía a la papelera incluso si falla la exportación. La exportación nativa y los conectores todavía requieren la comprobación piloto en Apps Script; las pruebas locales no sustituyen esa verificación.

## Verificación

Resultado: 10 pruebas del adaptador de fuentes mensuales; 131 pruebas de lógica en Determinantes y 4 pruebas nuevas de Adicciones; 253 pruebas en Jornadas; 107 de lógica y 30 de runtime/navegador/concurrencia en el portal, todas sin fallas. Además pasaron los escenarios previos de captura e historial en navegador, guardando sus imágenes dentro del workspace.

Pruebas con datos ficticios de clasificación manual, OCR concurrente, archivo repetido, pertenencia a unidad, token personal, borrador, reintento, edición concurrente, seis escuelas, matrícula reutilizable, periodos, cruce de identificadores internos con CLUES, deduplicación nominal y comparación sin suma. Pruebas de navegador y revisión visual de escritorio y teléfonos, incluyendo 320 px; se corrigieron botones y nombres de archivo comprimidos.

Corredores: `node tools/run-tests.js` y `node --test tools/adicciones.test.cjs` en Determinantes; `node --test tests/` en JS19 (Python debe estar en PATH para las pruebas de generación de Pages); pruebas del portal y `node tools/validar-preventivos-ui.cjs`. Este último usa Playwright instalado en el repositorio de Determinantes y guarda vistas ficticias en `.worktrees/integracion/qa`.

La revisión automática rechazó inicialmente una copia masiva fuera del workspace. Se comprobó que los archivos afectados estaban sin cambios locales, se respaldaron los originales y se aplicaron parches compatibles con `git apply --check`. El bloqueo quedó resuelto. Los cambios previos en CLAUDE.md/DIRECTORIO.xlsx y los archivos no versionados del usuario se conservaron.
