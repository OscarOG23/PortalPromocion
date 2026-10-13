# Accesos y orientación para personal

Objetivo: permitir que coordinaciones conozcan los registros individuales y que Nutrición y Psicología reconozcan su captura existente.

Alcance autorizado: enlaces al final de Coordinaciones; nombres por disciplina en el portal; guía pública sin datos personales; orientación dentro de Atención. Los accesos autenticados siguen viniendo del servidor. No se emiten boletos de personas para coordinaciones ni se cambia el conteo de entregas.

Supuesto pendiente de aclaración: los enlaces de coordinación son informativos, sin consulta de entregas individuales. La guía explica cómo entrar desde la cuenta personal. Si se requiere consulta, será una ampliación con permisos por coordinación.

- [x] Probar enlaces de guía al final, aislamiento del resumen y nombres por perfil en navegador.
- [x] Crear guía de Nutrición, Psicología y Promotores, con enlaces compartibles por sección.
- [x] Integrar orientación en portal y Atención, conservando formularios, sesiones y reglas.
- [x] Verificar captura, borrador, validación, envío y bloqueo de informes enviados para ambas disciplinas con datos ficticios; ejecutar pruebas del backend Atención.
- [x] Revisar pantalla móvil y escritorio, ejecutar regresiones y documentar límites.

Archivos: web/app.js, web/index.html, web/estilos.css; web/guia-personal/index.html; web/atencion/app.js, index.html y estilos.css; tools/browser-tests.js. Conservar modificaciones previas en src/SeguimientoApi.gs y src/Sheets.gs.

No se cambian las fuentes de capturadores generados ni se usan datos clínicos reales para verificar. Las pruebas locales no equivalen a una prueba autenticada de producción.

## Resultado y verificación

- 107 pruebas de lógica del portal, 35 de navegador/API/concurrencia y 56 de Atención: sin fallos. Las excepciones impresas por los corredores son casos deliberados de manejo de errores.
- Las cinco pruebas nuevas reprodujeron primero la ausencia de guías/títulos y después pasaron. Cubren ubicación al final, ausencia de boletos en guías, conteo de pendientes, campos por perfil, borrador, validación sin evidencia, descuadre de Psicología, envío y consulta posterior.
- Revisión independiente de código sin hallazgos en este alcance.
- Inspección con Chrome a 375 px y 1100 px: sin desbordamiento horizontal. Pasos desplegables en Atención y enlaces de guía separados para facilitar lectura. El estado del informe permanece junto a la cabecera.
- Comprobación de la API pública de Atención: entrar con boleto ficticio devuelve BOLETO_INVALIDO; informeDelMes con sesión ficticia devuelve SIN_SESION. No hubo escrituras reales ni carga de evidencias reales. Las pruebas de captura del navegador simulan respuestas del servidor; no certifican el acceso de cada cuenta productiva ni permisos de Drive.
- Solo se publican pantallas y documentación. No se cambian Apps Script, asignaciones de destinos ni permisos. La interfaz nativa antigua de Atención conserva su contenido; la guía se integra en la pantalla pública usada por el portal.
