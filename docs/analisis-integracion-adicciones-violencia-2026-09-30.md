# Integración y simplificación de Adicciones y trabajo en escuelas

Fecha: 30 de septiembre de 2026.

Estado: análisis histórico actualizado con una implementación local. Consultar [el alcance implementado y sus pendientes](integracion-reportes-preventivos-2026-09-30.md). No se modificaron Forms, respuestas, catálogos institucionales ni despliegues de producción.

## Recomendación

Integrar estos reportes en los sistemas existentes, sin crear otro repositorio, otro acceso ni otro padrón de usuarios. El informe de Adicciones debe aprovechar la captura de Determinantes. Tras contrastar la sugerencia del usuario con el capturador de Jornadas, el reporte escolar encaja mejor como modalidad **Intervención escolar / Jornada educativa en escuela** dentro de Jornadas, conservando su relación con los talleres de Determinantes.

El portal mantiene su función de acceso y consulta de avance. Adicciones y sus escaneos permanecen en Determinantes; Jornadas conserva el contexto de las intervenciones escolares y requiere una extensión para sus datos específicos. La integración necesita desarrollar las relaciones entre esos registros: agregar un enlace por sí solo no elimina la recaptura. Esta revisión sustituye la ubicación inicialmente propuesta del complemento escolar dentro de Determinantes.

## Fuentes y alcance de la revisión

Se leyeron las preguntas de ambos formularios en el editor de Google Forms, sin enviar respuestas ni cambiar sus preguntas:

- [Reporte Actividades Mensuales Adicciones](https://docs.google.com/forms/d/1HiPjRBkI6TbAoXYt2bcQQk-G71POOUnYTAyFmtAO1V8/edit).
- [Concentrado de Violencia y la Delincuencia](https://docs.google.com/forms/d/1_9YswxWR9h-4dOfBbGzsudxPIMpPXIrrf4P7me2WLk8/edit). Su enlace de captura es el proporcionado originalmente por el usuario.

Se contrastaron con `DeterminantesConcentrado/src/{Config,Setup,Captura,Medidas,Evidencias,Code,Secciones}.gs`, `Catalogos.generado.gs`, `.project/STATE.md`, el modelo jurisdiccional de simplificación de talleres y `PortalPromocion/src/{Setup,Destinos}.gs`. El grafo existente del conjunto de proyectos se utilizó para localizar relaciones; el código vigente prevalece sobre los planes históricos y el grafo.

También se revisaron `web/jornadas/{index.html,app.js}`, `docs/revision-ux-jornadas.md` y las fuentes de `JORNADA SALUD/JS19-JORNADAS`. Jornadas ya registra sede, fecha, unidad, actividades y fotos, e incluye prevención de violencia y orientación de Adicciones entre sus indicadores. No se encontraron campos específicos de CCT, matrícula o desglose de alumnos/docentes/tutores en la pantalla actual; la modalidad escolar necesita añadirlos.

No se auditaron cifras ni archivos de respuestas reales. La conclusión se refiere a qué información se solicita y qué permite el modelo actual; no certifica que todas las unidades ya hayan capturado esos datos.

## 1. Qué pide realmente cada formulario

### Adicciones

Tiene cuatro secciones y cuatro preguntas explícitas, además del correo recogido por Google:

1. Selección de unidad; la pregunta aparece sin título.
2. SESIONES.
3. ASISTENTES.
4. Evidencias: listas de asistencia y fotografías.

No se observó una pregunta de año o mes reportado. La fecha de envío no sustituye al periodo de actividad: un reporte atrasado puede enviarse al mes siguiente.

### Violencia y la Delincuencia

Tiene 19 secciones y 123 preguntas explícitas en su definición. No significa que una persona conteste las 123: existen rutas según el número de escuelas. La estructura duplica 15 veces ocho preguntas para las rutas de una, dos, tres, cuatro o cinco escuelas:

| Campo de cada escuela | Información solicitada |
|---|---|
| CENTRO DE SALUD | Unidad que realizó el trabajo |
| NOMBRE DE LA ESCUELAS TRABAJADA (Con Clave) | Plantel y clave |
| MATRICULA DE ALUMNOS | Población inscrita, no asistentes |
| NO. DE SESIONES REALIZADAS | Sesiones en ese plantel |
| TEMAS IMPARTIDOS | Adicciones, Violencia, Habilidades para la vida, Bullyng, Bebés virtuales u Otros |
| QUIEN SE DIO (ALUMNOS) | Campo cuyo significado se propone aclarar como asistentes alumnos |
| QUIEN SE DIO (DOCENTES) | Campo cuyo significado se propone aclarar como asistentes docentes |
| QUIEN SE DIO (PADRES) | Campo cuyo significado se propone aclarar como asistentes madres, padres o tutores |

También pregunta coordinación/CEAPS y número de escuelas, y solicita archivos al final. No se observó una pregunta de periodo reportado.

El título es más estrecho que el contenido: este instrumento también recoge Adicciones y Habilidades para la vida. Conviene presentarlo en el portal como **Trabajo preventivo en escuelas**, conservando el nombre oficial en el producto que lo requiera.

En la rama de una escuela, CENTRO DE SALUD aparece como un selector con una única «Opción 1»; en las otras ramas aparece como texto libre. Es una inconsistencia de captura que desaparece al utilizar el catálogo común de unidades.

## 2. Qué puede reutilizarse y qué falta

| Dato | Situación actual | Decisión propuesta |
|---|---|---|
| Usuario y coordinación | Conocidos por la sesión | Automáticos, validados en el servidor |
| Unidad | Catálogo y permisos existentes | Seleccionar una vez; preseleccionar cuando corresponda |
| Año y mes | Existen en Determinantes | Contexto visible del reporte, independiente de la fecha de envío |
| Sesiones/talleres de Adicciones | SUB039 / D5.02, `talleres_alcanzados` | Reutilizar; el usuario confirmó que cada sesión es un taller con su lista |
| Asistencias de Adicciones | Femenino + masculino en SUB039 | Total calculado; no pedir otro total |
| Evidencias | Archivo identificado por unidad y periodo | Vincular el archivo existente; subir solo material faltante |
| Escuela y clave | No existen en la captura mensual de Determinantes | Registro de plantel reutilizable |
| Matrícula | No existe | Guardar por plantel y ciclo escolar; actualizar cuando cambie |
| Sesiones por escuela | No existen | Captura complementaria mensual |
| Asistencias por alumnos/docentes/tutores | No existen | Complemento escolar con etiquetas numéricas claras |
| Temas por escuela | Solo hay subtemas agregados por unidad | Selección escolar mediante el catálogo homologado |

La evidencia actual está ligada a unidad y mes; no tiene una vinculación escolar explícita. `subtema_detectado` es un resultado del validador y no demuestra por sí solo qué escuela fue atendida. Hay que añadir una relación entre el archivo existente y el reporte/plantel, sin cargar otra copia.

## 3. Reglas para no perder precisión al reducir preguntas

- **Adicciones utiliza sesión como taller documentado.** El usuario confirmó el 30 de septiembre de 2026: «Cada taller con su lista». Por tanto, SESIONES de ese primer formulario se obtiene de `talleres_alcanzados` en SUB039. Esto no establece que cualquier reunión o cualquier contador de sesiones escolar tenga la misma definición: el modelo jurisdiccional permite varios talleres en una reunión. Mantener la definición visible en cada producto.
- **Asistencias no equivalen a personas únicas.** La suma mensual F + M cuenta participaciones registradas. No permite saber cuántas personas distintas acudieron a varias sesiones. Los productos deben utilizar una etiqueta coherente con esa medida; no prometer beneficiarios únicos.
- **Matrícula no equivale a asistencia.** Conservar ambas medidas. No sumar la matrícula cada mes ni por cada tema.
- **El total de la unidad no puede repartirse entre escuelas por deducción.** Tampoco se puede reconstruir el desglose alumnos/docentes/tutores a partir de F y M. Es información nueva que sí debe capturarse.
- **Una casilla de temas no indica cuántos talleres hubo de cada tema.** Cinco sesiones con Adicciones y Violencia seleccionados no permiten asignar cinco talleres a cada subtema. No generar productividad multiplicando las sesiones por los temas marcados.
- **La consulta escolar y la consulta por programa son distintas vistas del mismo trabajo.** Sus cifras no se suman nuevamente a Determinantes ni entre sí para calcular productividad total.
- **Falta de reporte y reporte en cero son estados distintos.** La ausencia de filas de Adicciones no debe interpretarse automáticamente como cero: antes se comprueba el envío de la unidad y periodo.

## 4. Captura mejorada propuesta

### A. Vista de Adicciones

Seleccionar unidad y mes en el contexto común. Mostrar los talleres de SUB039, su total de asistencias calculado, estado de envío y evidencias vinculadas. La cifra se corrige en su captura de origen, con el control de estados y auditoría existente.

No añadir otra pantalla para volver a escribir talleres, total de asistentes o correo. Con la equivalencia confirmada por el usuario, el reporte de Adicciones no requiere preguntas numéricas adicionales.

**Ajuste solicitado por el usuario el 30 de septiembre de 2026: espacio propio para subir los talleres de Adicciones mientras se desarrolla el OCR por subtema.** El reporte incluirá el apartado **Evidencias de Adicciones**, con el mismo mecanismo de carga de imágenes y PDF del capturador de talleres. Permitirá seleccionar varios archivos y mostrará las evidencias de la unidad y mes elegidos. Esta funcionalidad ya está implementada localmente en Determinantes; falta publicar el backend.

La clasificación se declara al cargar desde ese apartado: **Adicciones — SUB039 / D5.02**. No se añade otra pregunta de subtema por archivo ni se vuelven a solicitar las cifras de talleres o asistentes. El servidor valida la clasificación permitida y conserva la identidad del usuario que la declaró.

La clasificación declarada, su origen manual y su fecha se almacenan separados de `subtema_detectado`, `confianza` y el resultado del OCR. El OCR actual reconoce el formato impreso; su código deja vacío `subtema_detectado`. No presentar ese reconocimiento del formato como validación del contenido de Adicciones. La interfaz identifica la clasificación como declarada, pendiente de comprobación del subtema.

Se conserva un único registro de archivo en EVIDENCIAS y una única copia en Drive. Los archivos cargados desde Adicciones también forman parte de la evidencia general del mismo reporte; aparecer en ambas vistas no genera dos talleres ni dos registros de productividad. Si ya existe el archivo en esa unidad y periodo, el apartado permite vincularlo con Adicciones, sin volver a subirlo. Un duplicado en otra unidad o mes no se reclasifica ni se reutiliza automáticamente.

Se agrega material que realmente falte, por ejemplo una fotografía complementaria. Una fotografía de la actividad no sustituye al Registro de Asistentes. Un PDF puede contener varias listas; la cantidad de archivos no demuestra por sí sola cuántos talleres tiene respaldo ni que su contenido coincida con el subtema. Mostrar las cargas y su estado de revisión, sin prometer esa comprobación antes del lector por subtema.

Cuando el lector por subtema esté disponible, podrá procesar estas mismas evidencias sin exigir que se vuelvan a cargar. Si detecta otro contenido o no puede leerlo, muestra el desacuerdo para revisión; no altera automáticamente las cifras ni sustituye la clasificación declarada.

### B. Trabajo preventivo en escuelas

**Ubicación revisada a petición del usuario:** modalidad escolar dentro de Jornadas. Reutilizar sede, fecha, unidad responsable, actividades y evidencia fotográfica. Mostrar únicamente los servicios realmente realizados y los campos escolares necesarios; la pantalla general de jornadas no reemplaza directamente al formulario escolar.

Distinguir el hecho reportado de su agrupación mensual. Una visita con talleres puede registrarse como intervención escolar. Una jornada de salud efectivamente realizada en una escuela puede clasificarse como jornada escolar. El antiguo formulario concentra varias sesiones y varias escuelas del mes: no convertir todo ese concentrado en una sola jornada ni contabilizar cada sesión automáticamente como una jornada integral en los productos oficiales.

Los reportes escolares conservan las actividades de cada plantel y su fecha o periodo real. El concentrado mensual se obtiene agrupando esos registros. La matrícula sigue siendo información del plantel/ciclo escolar, y el volumen de talleres se relaciona con Determinantes sin otra suma de productividad. Las listas escaneadas y la fotografía de una intervención conservan sus funciones distintas; se enlazan los archivos existentes cuando corresponda.

Reemplazar las 15 copias del bloque por un listado con **Agregar escuela**. La cantidad de escuelas se obtiene del listado, sin pregunta previa y sin el límite artificial de cinco.

La unidad y periodo se conservan mientras se agregan escuelas. Si una coordinación reporta varias unidades, cada registro conserva su unidad responsable; cambiar de unidad es una selección del catálogo, nunca escribir su nombre.

Para un plantel nuevo se registra clave y nombre una vez. Se propone usar CCT como identificador del plantel y contemplar turno cuando sea necesario distinguir la intervención. La matrícula corresponde al ciclo escolar y solo se solicita al alta, cuando falta o cuando debe actualizarse. No inventar un catálogo de escuelas a partir de nombres aproximados.

Cada mes, por plantel, solo se captura o confirma:

1. Sesiones realizadas.
2. Temas impartidos, seleccionados en un catálogo.
3. Asistencias de alumnos, docentes y madres/padres/tutores. Total automático.
4. Evidencias: elegir existentes o añadir las que faltan.

Mostrar campos solo para los grupos atendidos, sin convertir un dato pendiente en cero automáticamente. Guardar borrador, continuar después y recuperar los planteles ya conocidos. La revisión final muestra las escuelas, sesiones y asistencias para detectar omisiones antes del envío.

Esta primera integración conserva el concentrado mensual de Determinantes como fuente de talleres. El complemento escolar aporta la distribución que antes faltaba y no modifica automáticamente sus totales. Para que una futura captura escolar alimente esos totales se requerirán cantidades por subtema y F/M con una fuente única, descrita en la transición siguiente.

## 5. Homologación de temas

| Tema del formulario escolar | Subtema existente |
|---|---|
| Adicciones | SUB039 / D5.02 |
| Violencia | SUB040 / D5.03; usar un subtema específico cuando corresponda |
| Habilidades para la vida | SUB038 / D5.01 |
| Bullyng | SUB046 / D5.09; etiqueta visible propuesta: Bullying |
| Bebés virtuales | Estrategia, no subtema automático; clasificar según el contenido realmente impartido |
| Otros | Especificar el contenido y seleccionar la clasificación correspondiente |

No añadir «Bebés virtuales» como determinante ni forzar todos esos trabajos a Embarazo: el nombre de una estrategia no demuestra el contenido impartido. Las etiquetas oficiales y los identificadores se mantienen en la fuente institucional.

## 6. Alternativas evaluadas

| Alternativa | Ventaja | Costo o limitación |
|---|---|---|
| **Adicciones en Determinantes e intervención escolar en Jornadas — recomendada tras la revisión** | Reutiliza la captura de talleres y el contexto de sede/fecha/actividades de Jornadas | Requiere campos escolares y relaciones entre registros; no equivaler automáticamente sesión y jornada |
| Proyecto nuevo de Adicciones y Violencia | Permite evolucionar con independencia | Otro despliegue y mantenimiento; debe construir una integración para evitar recaptura |
| Conservar Forms con enlaces prellenados | Cambio inicial pequeño | Prellenar identidad no elimina los totales repetidos, los bloques escolares ni la doble carga de archivos |

No hay evidencia de que los requisitos actuales justifiquen un proyecto nuevo. Si más adelante se requieren expedientes clínicos, tamizajes individuales o seguimientos con permisos diferentes, habría que evaluar ese alcance por separado; los formularios analizados no lo solicitan.

## 7. Transición y comprobaciones necesarias

1. SESIONES de Adicciones ya quedó definido por el usuario como cada taller con su lista. Al especificar el complemento escolar, aclarar la definición de sus sesiones y confirmar que «QUIEN SE DIO» pide cantidades de asistentes, no nombres de personas.
2. Añadir la vista de Adicciones a partir de la captura vigente y la modalidad de intervención escolar en Jornadas. Conservar unidad, plantel y fecha/periodo real, con un concentrado mensual derivado. Aplicar permisos y las reglas de edición correspondientes en el servidor. Los archivos de `web/jornadas` son generados: cualquier implementación debe realizarse en las fuentes de JS19-JORNADAS y regenerar la pantalla.
3. Incorporar **Evidencias de Adicciones** con clasificación declarada independiente del OCR; relacionar los archivos mediante sus identificadores y permisos existentes. Un reintento o reenvío actualiza el mismo registro; no crea otra escuela ni otra copia del archivo. Verificar que un archivo existente en la misma unidad y periodo se vincule, que un archivo de otra unidad o periodo no se reutilice automáticamente y que las cargas no cambien los totales del concentrado.
4. Probar con datos ficticios una escuela, más de cinco escuelas, varias unidades, dos turnos, corrección de matrícula y continuación de borrador. Comprobar que consultar ambos reportes no cambia talleres ni asistencias de Determinantes.
5. Comparar un periodo piloto con sus productos anteriores antes de sustituir la captura en Forms. Preservar respuestas históricas. No enviar automáticamente nuevos Forms ni migrar históricos por inferencia.
6. Si se decide que el detalle escolar alimente Determinantes, separar explícitamente **aporte escolar derivado** y **resto de actividad mensual manual** por subtema. Nunca añadir el aporte escolar a un total mensual que ya lo incluye. Para periodos existentes, exigir conciliación del responsable; para nuevos periodos, calcular el total desde fuentes disjuntas. No cambiar globalmente la captura a taller por taller.

La eficiencia se obtiene al eliminar recaptura de identidad, cifras ya disponibles y archivos, y al conservar datos de planteles entre periodos. Los datos escolares que el concentrado actual no contiene son preguntas necesarias, aunque compartan palabras como «sesiones» o «asistentes» con otros reportes.
