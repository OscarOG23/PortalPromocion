# Decisión propuesta: seguimiento preventivo con las capturas existentes

Fecha: 30/09/2026. Estado inicial: análisis y propuesta. El usuario autorizó la implementación y publicación posteriormente el mismo día. Véase `publicacion-seguimiento-preventivo-2026-09-30.md` para la solución realizada y la validación de despliegue.

## Necesidad confirmada

El usuario prioriza **avance, metas y faltantes; después seguimiento de resultados**. La función nueva debe convertir las capturas y archivos recibidos en decisiones: dónde falta actividad, dónde falta reporte, qué evidencia debe revisarse y qué acción sigue. Generar los tres Excel sigue siendo una salida, pero no es el propósito completo del seguimiento.

**Recomendación:** desarrollar «Seguimiento preventivo» como módulo del proyecto existente **EVALUACION MENSUAL TRIMESTRAL Y ANUAL**, con acceso desde PortalPromocion. Jornadas, Determinantes y SSOP conservan sus capturas y responsabilidad sobre sus datos. El módulo de evaluación los consulta y relaciona; incorpora únicamente metas o gestión de pendientes que no existan en una fuente autorizada.

No hace falta otro proyecto desde cero para este alcance. Sí conviene una responsabilidad analítica propia, con un contrato de indicadores y un tablero que pueda crecer hacia resultados. Esa separación se obtiene como módulo del evaluador existente.

## Qué existe y qué falta

| Componente inspeccionado | Función actual | Reutilización |
|---|---|---|
| PortalPromocion | Acceso a los capturadores y permisos por coordinación/unidad | Entrada al seguimiento con el mismo acceso. No almacena datos clínicos en su página pública. |
| DeterminantesConcentrado | Programado/alcanzado por subtema y mes, tablero y evidencias | SUB039 para talleres de Adicciones; declaración manual de evidencia mientras se desarrolla lector de subtemas. |
| JS19-JORNADAS | Productividad por jornada/módulo, evidencias; nuevo complemento escolar mensual | CCT, turno, ciclo, matrícula, sesiones y públicos; contexto de una jornada cuando tenga vínculo explícito. |
| Fuentes preventivas preparadas | Nominal, Cubos y SINBA con cortes y trazabilidad | Cuestionarios observados, contraste por unidad y advertencias de calidad/cobertura. |
| EVALUACION MENSUAL TRIMESTRAL Y ANUAL | Metas oficiales por unidad, puente CLUES, mapeo de variables, cálculo mensual/trimestral/anual | Base recomendada para la nueva vista por programa, unidad y municipio. |
| EVALUACION PROMOTORES / SSOP | Metas por promotor, analítica y cotejo planeado/ejecutado/evidenciado | Seguimiento por recurso identificado y gestión de alertas; mantener su alcance por promotor. |

El evaluador conserva la meta de sesiones de Adicciones como `CONCENTRADO / PENDIENTE_ARCHIVO` en `tools/mapeo_promocion.py`. El nuevo dato SUB039 puede cubrir esa necesidad mediante un adaptador, una vez verificada la correspondencia de indicador, unidad, periodo y autoridad de la cifra. No requiere pedir de nuevo sesiones y asistentes.

El grafo del ecosistema, actualizado el 26/09, orientó la búsqueda de motores existentes. Se verificó la recomendación contra los archivos actuales; el grafo no contiene por sí solo la integración añadida el 30/09.

## Alternativas

| Alternativa | Ventaja | Costo o límite | Decisión |
|---|---|---|---|
| Ampliar Evaluación con Seguimiento preventivo | Aprovecha metas, periodos y equivalencias; permite una visión entre capturadores | Requiere conectores privados y diferenciar evaluación oficial de avance operativo | Recomendada |
| Añadir todo a Jornadas | Aprovecha el complemento escolar y exportaciones recién implementados | Jornadas asumiría evaluación de fuentes y programas que exceden una jornada | Mantener allí captura escolar y sus reportes; evaluación central en el módulo propuesto |
| Crear un proyecto independiente | Ciclo de publicación y operación propios | Duplica catálogo de metas, cruces, permisos y mantenimiento ya existentes | Justificado sólo con otro responsable/ámbito o necesidades que el evaluador no pueda atender |

El proyecto independiente tendría sentido si el seguimiento evoluciona a expedientes longitudinales, asignación de casos entre servicios o una operación distinta de evaluación. Esa necesidad aún no está confirmada; puede analizarse al iniciar la fase de resultados.

## Qué medirá la primera versión

### 1. Actividad y cumplimiento

Cada indicador declara: definición, unidad de medida, fuente principal, ámbito, periodicidad, meta aplicable, vigencia y regla de acumulación. La pantalla distingue meta institucional de programación operativa y muestra de dónde procede cada una.

| Medida | Cálculo o lectura | Condición |
|---|---|---|
| Sesiones de Adicciones | Talleres SUB039 alcanzados | No convertir asistentes de Jornadas en sesiones. |
| Asistencias a Adicciones | Femenino + masculino de SUB039 | Asistencias acumuladas; no personas únicas. |
| Cumplimiento oficial de sesiones | Sesiones elegibles / meta oficial del mismo ámbito y periodo × 100 | Puente CLUES verificado y fuente elegible para cierre. Meta ausente o cero: no evaluable. |
| Cumplimiento de programación | Realizadas / programadas × 100 | Programación existente del mismo indicador y periodo; no equivale automáticamente a meta oficial. |
| Actividad escolar | Sesiones, temas y asistencias por CCT/turno/mes | Una sesión puede abordar varios temas; no sumar temas para reconstruir sesiones. |
| Cuestionarios | AUDIT, Fagerström y drogas del nominal | Positivos y negativos; una aplicación de drogas por registro, aunque haya varias sustancias. |
| Cobertura de planteles | CCT atendidas / CCT asignadas × 100 | Requiere padrón completo de escuelas asignadas y vigencia. Sin padrón, mostrar planteles atendidos, sin porcentaje. |
| Unidades con reporte | Unidades con reporte elegible / unidades obligadas a reportar × 100 | Universo y fecha límite definidos; no utilizar únicamente el listado de quienes enviaron. |

Para medir escuelas únicas en un ámbito amplio se usa CCT. Para revisar operación se mantiene CCT+turno. La matrícula se interpreta por plantel/turno/ciclo y no se suma otra vez por cada mes o visita. La certificación de una escuela requiere su etapa y evidencia de certificación; una intervención no la acredita.

### 2. Faltantes que llevan a una acción

Se distingue **falta de actividad**, **falta de reporte**, **falta de evidencia**, **meta no definida**, **fuente sin actualizar**, **identidad de recurso pendiente** y **diferencia entre fuentes**. El tablero no convierte todas esas situaciones en bajo desempeño.

La lista de pendientes muestra unidad/escuela/recurso cuando esté identificado, indicador, periodo, causa, responsable de resolver, referencia al registro original y estado. Un pendiente se calcula desde la fuente; su atención se registra una vez, con comentario breve y fecha. Resolverlo no modifica cifras del capturador: una corrección numérica se hace en la fuente original y después se recalcula.

Ejemplo de lectura: «Septiembre: 4,537 AUDIT observados; corte 28/09; Cubos disponible hasta agosto; desglose por recurso pendiente porque el nominal no trae prestador». La acción es completar/actualizar la fuente, no recapturar 4,537 aplicaciones ni asignarlas a profesionales sin identidad.

### 3. Calidad y comparabilidad

Cada cifra conserva fuente y corte. Se muestran registros elegibles para cierre junto a actividad en revisión, identificándolos por separado. Cero declarado, sin reporte, borrador, no aplicable y corte parcial tienen estados distintos.

Las actualizaciones sustituyen cortes anteriores de su ámbito/mes. Fuentes alternativas se contrastan, no se suman. Los conflictos del mismo corte y los ámbitos superpuestos se revisan antes de calcular.

## Compatibilidades que requieren cuidado

**Meta oficial de detección y cuestionarios tienen unidades diferentes.** El mapeo existente de la meta de consumo de sustancias reúne 40 variables del SIS y advierte que una persona puede figurar por sustancia. El nominal transformado cuenta tres tipos de cuestionario y agrupa las drogas en una aplicación. No se divide el número de cuestionarios entre una meta de tamizajes por sustancia. Ambos indicadores conservarán su definición y numerador propios.

**CLUES y ámbito deben concordar.** El evaluador tiene un puente entre CLUES de metas y CLUES SIS. Se reutiliza la equivalencia revisada con vigencia y se señalan unidades sin correspondencia. No se cruza automáticamente por nombre ni se asigna la producción de una sede a una unidad móvil sin una regla aprobada.

**SSOP y Determinantes pueden describir la misma actividad.** Para el indicador por unidad se elige una fuente principal. Los datos del promotor sirven como detalle o contraste cuando existe vínculo válido. Dos totales mensuales parecidos no prueban que sean actividades diferentes ni permiten eliminar eventos automáticamente. Hasta contar con vínculos, se conservan separados.

**Mes cerrado necesita confirmación de cobertura.** El evaluador existente estima si el último mes del cubo es parcial comparando volumen contra meses anteriores. Esa señal puede orientar una alerta, pero no certifica cierre: un mes con menor actividad también puede estar completo. El nuevo seguimiento debe conservar corte/cobertura explícitos y revisión de cierre, evitando cambiar retroactivamente porcentajes oficiales con una suposición de volumen.

## Arquitectura propuesta

1. **Fuentes:** los capturadores actuales guardan y corrigen sus datos. Los Excel mensuales se preparan una vez con el adaptador existente.
2. **Conectores:** lectura privada por ID de origen configurado en servidor. Cada fuente conserva su alcance, periodo, versión y estado. Se reutilizan los agregados existentes; no se copian bases nominales a la web.
3. **Evaluación:** módulo en el evaluador existente que une metas, CLUES y mediciones compatibles, calcula avance y clasifica faltantes. Las reglas oficiales permanecen identificadas y separadas de propuestas operativas.
4. **Seguimiento:** registros pequeños de atención de pendientes, vinculados a claves de origen; sin volver a pedir productividad o subir la misma evidencia.
5. **Consulta:** sección «Seguimiento preventivo» desde el portal. Filtros de periodo, programa, coordinación, unidad y escuela; recurso cuando exista identidad. Permisos aplicados en el servidor y exportación consistente con la vista.

El visor actual de Evaluación lleva datos embebidos y su `doGet()` sirve HTML sin aplicar el alcance de los boletos. Para este módulo se requiere una consulta autenticada que devuelva solamente las unidades autorizadas. El patrón de publicación actual no se reutiliza para nombres de recursos, pendientes privados o evidencia.

Pantalla inicial propuesta: avance contra meta; estado del reporte y del corte; lista de pendientes priorizada. Desde una fila se abre el capturador original en su unidad/periodo, o se registra la atención del pendiente. No se añade otra forma para capturar sesiones, asistentes o cuestionarios.

## Fase posterior: resultados

Al contar con avance confiable, definir resultados y fuentes antes de agregar campos. Posibles mediciones: continuidad de intervención por escuela, acuerdos cumplidos, canalización y seguimiento efectivamente documentados. Las evaluaciones antes/después necesitan instrumentos y cohortes comparables; la cantidad de talleres por sí sola no demuestra reducción del consumo o de la violencia.

Se reutilizarán fuentes de seguimiento existentes si contienen las relaciones necesarias. Sólo se añadirá información que falte y no pueda derivarse: por ejemplo, una acción de seguimiento con fecha, responsable, vínculo y estado. No se inferirá atención posterior de una detección por coincidencias de totales.

## Criterios para aceptar la primera versión

- Un mismo registro se captura una vez y puede alimentar informe y seguimiento.
- La meta conserva autoridad, unidad de medida, periodicidad y vigencia.
- Falta de fuente/corte parcial no se interpreta como cero o incumplimiento.
- El tablero usa la misma cifra que su exportación y permite consultar procedencia.
- No se suman cifras de SSOP, Determinantes, Jornadas y Cubos que describan la misma actividad.
- El usuario sólo ve sus unidades; el agregado jurisdiccional requiere alcance autorizado para todas ellas.
- La atención de un pendiente queda registrada sin alterar la fuente ni eliminar su historial.
- Casos ficticios prueban meta ausente/cero, borrador, corte parcial, actualización, CLUES sin puente, solapamiento y usuarios de otras unidades.

## Decisión pendiente para construcción

Revisar este alcance y confirmar el módulo dentro de **EVALUACION MENSUAL TRIMESTRAL Y ANUAL**. El análisis no cambia los capturadores implementados ni sus despliegues. Tras la revisión se puede preparar el plan técnico con adaptadores, contrato de indicadores, lectura autenticada y primera vista de pendientes.

## Evidencia local consultada

- `EVALUACION MENSUAL TRIMESTRAL Y ANUAL/README.md`, `tools/evaluar.py`, `tools/comun.py`, `tools/mapeo_promocion.py`, `catalogos/catalogo_metas.csv`, `catalogos/mapeo_meta_sis.csv`, `despliegue/Code.gs`.
- `EVALUACION PROMOTORES/ssop/README.md`, `core/metas.gs`, `analitica/analitica.gs`, `fase2/cotejo.gs` y documentos de requerimientos.
- `DeterminantesConcentrado/src/Dashboard.gs`.
- `JORNADA SALUD/JS19-JORNADAS/docs/MODELO_DATOS.md`, `docs/ARQUITECTURA.md`, `apps_script/Escolar.gs`.
- [Fuentes preventivas ya preparadas](fuentes-mensuales-preventivos-2026-09-30.md).
