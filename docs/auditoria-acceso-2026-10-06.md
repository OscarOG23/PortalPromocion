# Acceso al portal · 6 de octubre de 2026

El ingreso mostrado por el usuario devolvía HTML de Google con «No cuentas con el permiso necesario para acceder al documento solicitado». El cliente clasificaba cualquier fallo de lectura JSON como falta de conexión.

La base existe, no está en la papelera y pertenece a la misma cuenta que ejecuta la aplicación. Desde el editor se verificaron 22 coordinaciones, 69 unidades y ninguna unidad huérfana. La cuenta reportada está activa, tiene rol ADMIN y su credencial coincide; no fue necesario cambiarla.

Se sustituyó la dependencia de `SpreadsheetApp.getActive()` por la apertura explícita de la base por ID en la lectura de tablas y la hoja de atención preventiva. Google documenta que los métodos que requieren el documento activo del contenedor no están disponibles al ejecutar una aplicación web: https://developers.google.com/apps-script/guides/bound.

Se actualizó la implementación existente y se renovó su publicación desde la cuenta propietaria. La verificación inicial todavía falló; el diagnóstico temporal confirmó que el ingreso llegaba a generar la sesión. Al finalizar, se verificaron respuestas JSON correctas para el ingreso y su contexto, y se abrió el panel ADMIN desde el navegador real. No se atribuye un mecanismo más específico al rechazo transitorio de Google.

La versión final es **17**, conserva la URL existente, los permisos y el contenido de la base. Solo difieren los archivos de producción `Sheets` y `SeguimientoApi`; el manifiesto permanece semánticamente igual. Se retiró el código temporal de diagnóstico.

Validación: prueba de regresión falló antes del cambio y pasó después; 107 pruebas de lógica y 52 pruebas de acceso, concurrencia y seguimiento, sin fallos. Inicio de sesión y contexto final verificados por HTTP y panel de administración visible en el navegador. Evidencia y respaldo en `DeterminantesConcentrado/outputs/acceso-portal-2026-10-06/`.
