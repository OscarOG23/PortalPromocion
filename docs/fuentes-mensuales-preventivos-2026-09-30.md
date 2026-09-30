# Fuentes mensuales de los informes preventivos

Implementación local, 30/09/2026. Complementa la captura de Adicciones y escuelas ya integrada. No crea otro proyecto ni solicita que el recurso vuelva a transcribir cantidades existentes.

## Qué alimenta cada producto

| Producto | Fuente y regla |
|---|---|
| Sesiones/asistencias de Adicciones | SUB039 de Determinantes. Una sesión = un taller con su lista. La base clínica no produce talleres. |
| Evidencias de Adicciones | Archivos del determinante, declaración manual del subtema mientras se desarrolla OCR. |
| AUDIT | `alcohol` en DETECCIÓN: positivo o negativo = una aplicación; N/A/vacío = ninguna. |
| Fagerström | `tabaco`, con la misma regla. |
| Cuestionario de drogas | Una aplicación por registro si hay resultado positivo/negativo en alguna de las ocho sustancias. Varias sustancias en la misma fila no multiplican aplicaciones. |
| Contraste de detecciones | Cubos por CLUES y mes, con variables específicas. Nunca se suma al nominal. |
| SINBA descargado | Detecciones generales por profesional, con su intervalo original. No se asigna ese total a los tres cuestionarios ni se reparte un acumulado por meses. |
| Violencia/delincuencia escolar | Complemento mensual de Jornadas por CCT/turno. No convierte automáticamente toda intervención en una jornada integral. |

La equivalencia de alcohol/AUDIT, tabaco/Fagerström y el bloque de sustancias/cuestionario de drogas fue **confirmada por el usuario**. Se cuentan registros de aplicaciones; no personas únicas ni folios de papelería. Las atenciones de SALUD MENTAL y los test de ENFERMERÍA no se añaden a DETECCIÓN.

## Resultado del piloto con los archivos proporcionados

| Fuente | Cobertura observada | Resultado |
|---|---|---|
| BASE NOMINAL 28-09-2026 | DETECCIÓN, 7,612 filas de 01–27/09, corte recibido 28/09, 65 CLUES de jurisdicción 19 TEXCOCO | AUDIT 4,537; Fagerström 4,537; drogas 4,201. Cifras observadas, mes parcial. |
| Cubos / SIS_15_TEXCOCO_2026 | Hoja Datos, cifras de enero–agosto | Variables específicas de alcohol y tabaco. No se localizó equivalente de cuestionarios de drogas. Septiembre pendiente. |
| Descarga SINBA ENERO A 31-08-2026 | 01/01–31/08, por profesional | 1,495 grupos de recurso/unidad; 80 filas sin profesional excluidas; 15 repeticiones adicionales dejaron el total del grupo pendiente. |

**El nominal de Detección tiene vacíos todos los campos del prestador.** Sus cantidades se conservan por unidad bajo «SIN IDENTIDAD DEL RECURSO EN LA FUENTE». No se atribuyen a un profesional, a su login o a quien captura. Para obtener las tres cantidades por recurso se necesita una versión nominal con identidad del prestador u otra fuente equivalente específica por recurso. SINBA general no permite recuperar ese desglose por instrumento.

No hubo filas nominales idénticas en el piloto. Cuando existan, se conserva el conteo de registros y se marca `REVISAR_FILAS_IDENTICAS`, porque la fuente no tiene una identidad inequívoca de aplicación para eliminar filas automáticamente. Una CURP de paciente nunca se utiliza como identidad de una aplicación.

Cubos tiene columnas de los doce meses, con ceros de relleno después de agosto. El adaptador no certifica esos meses en cero. Sólo incluye meses con actividad observada en el libro. Una CLUES sin las cuatro categorías sexo/resultado se marca `CATEGORIAS_INCOMPLETAS`: su total es parcial observado. El corte real de Cubos aún debe declararse al preparar el archivo; el piloto técnico utilizó 30/09 y **no acredita** esa fecha como cierre de la fuente.

## Preparación mensual

El adaptador [fuentes_preventivas.py](../tools/fuentes_preventivas.py) lee los Excel originales y produce JSON agregados. Requiere Python 3.11 o posterior con `openpyxl`, disponible en el runtime de esta sesión. No modifica los originales, no ejecuta fórmulas/macros ni exporta pacientes. Los prestadores reciben identificadores HMAC estables y sus nombres se conservan únicamente en el agregado privado para el reporte por recurso.

Ejemplos desde PortalPromocion; sustituir rutas y cortes por los recibidos:

```powershell
python tools/fuentes_preventivas.py nominal "RUTA/BASE NOMINAL 28-09-2026.xlsx" --ambito JS19 --corte 2026-09-28 --clave-recursos .worktrees/fuentes-privadas/clave-recursos.bin --salida .worktrees/fuentes-privadas/listos
python tools/fuentes_preventivas.py cubos "RUTA/SIS_15_TEXCOCO_2026.xlsx" --ambito JS19 --anio 2026 --corte AAAA-MM-DD --salida .worktrees/fuentes-privadas/listos
python tools/fuentes_preventivas.py sinba "RUTA/SIS SINBA.xlsx" --ambito JS19 --clave-recursos .worktrees/fuentes-privadas/clave-recursos.bin --salida .worktrees/fuentes-privadas/listos
```

Usar la misma clave privada todos los meses y para nominal/SINBA. Se crea una vez si no existe. Respaldarla en almacenamiento privado; no subirla a la carpeta de agregados ni al repositorio. Los agregados también son privados: contienen información laboral por recurso, aunque no pacientes. `.worktrees/` está excluido de Git; no colocar salidas reales en `web/` o `docs/`.

La descarga SINBA obtiene inicio/fin de sus propias filas de metadatos. Nominal/Cubos exigen declarar el corte de la fuente; no toman la fecha del reloj como corte. Un archivo sin columnas compatibles, códigos de resultado desconocidos, cifras inválidas o sin datos útiles detiene la preparación. Una variable de Cubos duplicada por CLUES también se detiene para revisar orígenes y subtotales.

Cada archivo preparado incorpora fuente, ámbito, corte y huella SHA-256 del original. Repetirlo con la misma clave y argumentos conserva el mismo JSON. Las repeticiones de un recurso dentro de SINBA no se suman: el total del grupo se deja pendiente para revisión, conservando los grupos no afectados.

## Conexión privada con Jornadas

1. Crear o elegir una carpeta de Drive privada para los JSON de `listos`, accesible al propietario del Apps Script. Subir únicamente los agregados, no la clave ni la base nominal.
2. Configurar `ID_CARPETA_FUENTES_PREVENTIVAS` en las propiedades del backend existente de JS19-JORNADAS. El navegador no recibe la carpeta ni puede elegir una fuente ajena. `ID_DETERMINANTES` sigue siendo necesario para sesiones/asistencias.
3. Publicar `FuentesPreventivas.gs` y `ReportesPreventivos.gs` junto a los cambios escolares existentes. Con la carpeta configurada, el Excel usa esos cortes; se conserva el conector anterior de hojas normalizadas como alternativa cuando no hay carpeta.
4. Validar un mes por CLUES con los responsables antes de cerrar cifras. La importación no certifica cobertura completa automáticamente.

Para cada fuente/ámbito y mes solicitado se utiliza el corte más reciente que **contenga ese mes**. Un archivo de octubre sin septiembre conserva el último corte de septiembre; uno acumulado que vuelva a incluir septiembre puede sustituirlo. El reemplazo corresponde a la cobertura completa del ámbito declarado, no a una carga incremental. Un archivo parcial por algunas unidades debe usar un ámbito distinto y no solaparse con el otro. No se añaden cortes viejos al nuevo ni se suman Nominal + Cubos + SINBA.

Dos archivos diferentes del mismo corte/ámbito o ámbitos que duplican una medición detienen la exportación; revisar y retirar de la carpeta activa el corte sustituido. Se admite una copia idéntica sin duplicar cifras. La carpeta activa admite hasta 100 agregados/15 MB, cada archivo hasta 5 MB; archivar cortes antiguos fuera de ella al alcanzar ese límite.

El Excel de revisión incluye `POR_UNIDAD`, `POR_RECURSO`, `CONTRASTE_CUBOS`, `DETALLE_CUBOS`, `SINBA_GENERALES` y `FUENTES`. Conserva cortes y estados; pendiente no se convierte en cero. Las fechas exactas Desde/Hasta de SINBA se conservan, además de su intervalo de meses. Los metadatos de fuentes ajenas a las unidades autorizadas no se exportan. Comparaciones de cortes parciales/diferentes se señalan no comparables. Las coincidencias/diferencias observadas tampoco certifican un mes cerrado.

## Verificación y límite actual

Pruebas ficticias de resultados negativos, varias sustancias, eliminados, paciente repetido, recurso ausente, códigos desconocidos, categorías y variables duplicadas de Cubos, subtotales y recursos repetidos de SINBA, y protección de CURP en la salida. Pruebas del backend de sustitución de cortes, reintentos, conflictos, autorización por unidad y exportación desde la carpeta configurada. Piloto local de los tres archivos reales, sin publicar sus agregados.

Resultado: **10 pruebas Python y 253 pruebas de Jornadas pasaron**, incluidas las 11 nuevas de conexión y cortes. Una revisión independiente confirmó las correcciones de conflictos sin dependencia del orden de archivos, ámbitos solapados, alcance de metadatos y fechas exactas. Las reimportaciones del piloto conservaron los mismos archivos agregados sin duplicación. El código y los agregados del piloto quedaron preparados localmente. Falta configurar la carpeta privada, desplegar los cambios y verificar la exportación nativa en Apps Script. No se subieron archivos reales a Drive, no se modificaron hojas de producción ni se publicó Pages.
