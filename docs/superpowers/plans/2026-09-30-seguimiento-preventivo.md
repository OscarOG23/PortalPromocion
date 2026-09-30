# Seguimiento preventivo — implementación autorizada

El usuario autorizó construir y publicar el diseño de seguimiento el 30/09/2026. Se reutilizan las capturas de Determinantes y Jornadas y los agregados privados de nominal/Cubos/SINBA. La vista de evaluación se publica en PortalPromocion/web/seguimiento y reutiliza el servidor y los permisos actuales del Portal. No se publica ninguna base nominal ni secreto.

## Contrato

POST seguimiento con boleto, periodo YYYY-MM y unidad_id opcional (CLUES). Respuesta ok, periodo, usuario {nombre,rol}, unidades [{id,nombre,coordinacion_id}], indicadores [{id,unidad_id,unidad,programa,nombre,medida,valor,programado,meta,porcentaje,faltante,estado,fuente,corte,nota}], pendientes [{id,unidad_id,unidad,programa,causa,detalle,responsable,comentario,fecha_compromiso,estado_atencion,version}], fuentes [{fuente,corte,estado,detalle}]. La autorización resuelve cuenta y catálogo en cada petición; las unidades del cliente sólo reducen el ámbito. Los pendientes se recalculan y las anotaciones no modifican las cifras originales.

POST atenderPreventivo con boleto, periodo, unidad_id, pendiente_id, version, responsable, comentario, fecha_compromiso y estado_atencion ABIERTA/EN_PROCESO/ATENDIDA. Escritura con bloqueo y control de versión. Un pendiente desaparece sólo cuando se corrige la fuente; una anotación ATENDIDA no valida cifras.

## Tareas

- [x] Motor puro con pruebas de ausencia frente a cero, cortes, fuentes alternativas, metas compatibles, borradores y recurso desconocido.
- [x] API protegida, adaptadores de hojas privadas, metas oficiales y gestión de pendientes.
- [x] Vista adaptable y acceso desde Portal con filtros, indicadores, fuentes y pendientes.
- [x] Preparar/importar agregados privados y metas; configurar fuentes en servidores existentes.
- [x] Revisar especificación y código; verificar pruebas de permisos y navegador con datos ficticios.
- [ ] Publicar Apps Script y Pages y comprobar enlace real.
- [ ] Completar consentimiento OAuth del propietario y comprobar lectura real de todas las fuentes.

Las metas oficiales se importan del evaluador con su puente CLUES revisado. Cuestionarios nominales no se dividen entre metas de detecciones por sustancia. Sin padrón de escuelas asignadas no hay porcentaje de cobertura. Las fuentes no se suman entre sí ni se atribuyen a personal cuando falta identidad.
