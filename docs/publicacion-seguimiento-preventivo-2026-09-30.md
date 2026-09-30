# Seguimiento preventivo — publicación 30/09/2026

Implementación autorizada por el usuario: «Hazlo subelo implementalo».

La evaluación se sirve en `web/seguimiento/` dentro de PortalPromocion. El servidor del Portal verifica su boleto y vuelve a leer cuenta y unidades vigentes. Consume las metas y el puente existentes de EVALUACION MENSUAL TRIMESTRAL Y ANUAL; los capturadores mantienen sus datos originales. Esta forma de publicación reutiliza el acceso y evita duplicar servidores o recapturas.

## Datos y operación

- Determinantes: talleres SUB039 y evidencia declarada de Adicciones. Lectura en vivo por CLUES; envío habilita avance enviado, no certifica cierre.
- Jornadas: INTERVENCIONES_ESCOLARES; sesiones, CCT distintas y asistencias. Una intervención no acredita certificación.
- Nominal: aplicaciones AUDIT, Fagerström y drogas; sin atribución a un prestador cuando éste falta.
- Cubos: contraste por unidad sin sumarlo a nominal. El archivo preparado el 30/09 tiene actividad hasta agosto; esa fecha de preparación no acredita un corte oficial ni cobertura completa de septiembre.
- SINBA: detecciones generales por recurso con el intervalo original, sin repartirlas entre meses ni convertirlas a cuestionarios.
- Metas: 1,416 denominadores mensuales de sesiones y detecciones, provenientes del evaluador. El avance oficial por sustancia se importa de evaluacion_mensual.csv y permanece en revisión hasta confirmar corte y cobertura. El puente CLUES existente se resuelve contra todo el catálogo activo antes de limitar el ámbito de consulta.

Los cuatro JSON de agregados y metas viven en una carpeta privada de Drive, fuera de GitHub. No se publicaron bases nominales, CURP de pacientes ni la clave local de seudonimización de recursos. Los archivos institucionales originales no se sobrescribieron.

La atención de pendientes conserva versiones inmutables con actor y fecha en ATENCION_PREVENTIVA. Se vuelve a comprobar el pendiente en la fuente y la versión antes de guardar. Marcar una atención como ATENDIDA no modifica producción ni elimina el pendiente calculado.

## Mantenimiento mensual

Preparar las fuentes con `tools/fuentes_preventivas.py` (véase fuentes-mensuales-preventivos-2026-09-30.md), reutilizando la clave privada de recursos. Subir sólo los agregados JSON a la carpeta configurada con `tools/publicar-preventivos.cjs private-upload`. Los cortes nuevos sustituyen el mismo ámbito/mes; no se acumulan importaciones alternativas.

Regenerar los denominadores con `tools/preparar_metas_preventivas.py` cuando cambie la programación oficial, preservando la equivalencia de CLUES del evaluador. El catálogo activo se llama METAS_PREVENTIVAS_2026.json; su reemplazo debe conservar un solo archivo vigente.

## Verificación y estado externo

Pruebas de lógica, permisos, cortes y atención; Chrome para filtros, móvil, errores, concurrencia y conservación de comentarios. Revisión independiente: se corrigieron puente ambiguo, reemplazo de cortes, historial y señales SINBA.

Adicciones: versión 23, tabla de evidencia instalada. Jornadas: versión 18. Portal: propiedades de fuentes configuradas y salud pública HTTP 200. La función de diagnóstico del propietario queda fuera de la API pública.

Google solicita consentimiento del propietario para los nuevos ámbitos de acceso del servidor: hojas de cálculo y lectura de Drive. La validación de lectura real de todas las fuentes depende de ese consentimiento; no se declara cierre de producción ni funcionamiento integral hasta completarlo.
