# Integración de reportes preventivos

**Objetivo:** reutilizar Determinantes para Adicciones, añadir el concentrado escolar a Jornadas y preparar las salidas mensuales con procedencia verificable.

**Arquitectura:** las cifras conservan su fuente. El portal sirve las pantallas generadas; la captura y los permisos permanecen en sus dos backend existentes. Las intervenciones escolares son un complemento mensual que no escribe en PRODUCTIVIDAD ni crea jornadas integrales. La base nominal y SINBA se consultan como fuentes externas configurables, sin sumar mediciones superpuestas ni publicar expedientes.

**Tecnología:** Apps Script, HTML/JavaScript, pruebas Node con datos ficticios. Cambios preparados en `.worktrees/integracion` y trasladados únicamente a archivos revisados de los repositorios de origen; conservar sus cambios locales.

- [x] Evidencias: probar clasificación declarada SUB039, reutilización solo dentro de unidad/periodo, independencia del OCR y de cifras; implementar API, migración idempotente y apartado visible.
- [x] Escuela: probar validación, borradores, clave unidad+periodo+CCT+turno, actualización sin duplicación, matrícula por ciclo, cantidades por tema y ausencia distinta de cero. Implementar hoja lateral, API con boleto obligatorio y pantalla repetible sin límite de cinco.
- [x] Salidas de revisión y contrato de fuentes (conexión real pendiente): probar sesiones/asistencias de SUB039, agrupación municipal, conteo de aplicaciones nominales por instrumento/recurso y conciliación sin suma. Preparar tablas XLSX mediante exportación nativa de Sheets; mostrar pendientes cuando no hay fuente completa. El usuario aclaró que los folios ya no se utilizan: retirarlos y reportar solo cantidades. Los conectores reales y la exportación nativa aún requieren configuración y piloto.
- [x] Verificar pruebas nuevas y regresiones, generar Pages desde JS19 y documentar configuración/despliegue pendiente. No cambiar Forms históricos ni publicar automáticamente.

## Datos de los formatos que cambian el diseño

Adicciones: anual por unidad con pareja sesiones/asistencias y mensual por municipio. Detecciones: drogas, AUDIT y Fagerström; no equivalen a Detecciones generales de SINBA. Escolar: sesiones programadas, realizadas, seis cantidades por tema, tres públicos y tamizaje. No aplicar automáticamente 4/mes/escuela porque el mismo libro contiene metas 40/año/unidad. La matrícula no se suma entre visitas ni periodos.

SINBA localizado: acumulado 01/01–31/08/2026, agrupado por profesional, incluye totales jerárquicos y una columna genérica Detecciones. No repartir por meses, sumar filas de subtotal con recursos ni atribuir a cuestionarios específicos. Ya se recibió y adaptó la base nominal, con equivalencia confirmada. Ante discrepancias se conservan cifras separadas y en revisión, sin suma ni prioridad automática.

## Resultado de verificación local

## Continuación: archivos mensuales recibidos

- [x] Adaptador local de BASE NOMINAL / hoja DETECCIÓN: fecha real, positivos y negativos, exclusión de eliminados, sin pacientes en la salida. Recurso con identificador estable HMAC. No deducir instrumentos sin equivalencia confirmada.
- [x] Adaptador de Cubos / hoja Datos: CLUES, claveVariable, columnas Enero–Diciembre. Excluir Resumen, no distribuir el anual ni inventar un recurso. Alcohol y tabaco con las cuatro variables de sexo/resultado; drogas pendientes porque no hay variable equivalente en el libro revisado.
- [x] Lectura del backend desde una carpeta privada de archivos agregados. Selección del corte más reciente por fuente/ámbito/mes; reimportación idempotente, reemplazo del mismo mes, conflictos y solapamientos rechazados. Archivos parciales siguen en revisión.
- [x] Pruebas con archivos ficticios y piloto local con las fuentes recibidas. Documentar cobertura y conexión pendiente; no subir la base nominal a Pages.

Hallazgo: nominal 28/09 contiene DETECCIÓN de 01–27/09 para jurisdicción 19 TEXCOCO. Cubos localizado SIS_15_TEXCOCO_2026 tiene cifras de enero–agosto y carece de recurso; por ahora no permite conciliar septiembre. Equivalencia AUDIT/Fagerström/cuestionario de drogas confirmada. Los 7,612 registros carecen de identidad del prestador; se preservan cantidades por unidad y queda pendiente el recurso. También se adaptó SINBA general sin repartir el acumulado ni sumar recursos repetidos.

Determinantes: 131 pruebas de lógica, 4 nuevas de Adicciones, prueba de captura automática y dos escenarios de navegador previos. Jornadas: 253 pruebas, incluyendo el concentrado escolar y corrección de CCT. Portal: 107 pruebas de lógica y 30 de runtime/navegador/concurrencia. Validación visual adicional de los dos apartados en escritorio y móvil. Conectores, exportación nativa con datos reales y publicación siguen pendientes.
