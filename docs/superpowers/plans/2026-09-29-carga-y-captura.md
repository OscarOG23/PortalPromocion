# Carga y captura: plan de corrección

Objetivo: reducir pasos innecesarios y esperas, y evitar que una respuesta tardía o un error de servidor provoque pérdida de captura.

Implementación sobre el portal existente, sin cambiar las reglas de los indicadores ni publicar cambios en producción durante la revisión.

- [x] Probar en navegador la unidad única, el guardado con ediciones posteriores y el envío del boleto de jornada médica.
- [x] Mostrar enlaces del portal sin esperar sondas; consultar estados después, conservando autenticación y compatibilidad con la API anterior.
- [x] Preseleccionar solo cuando hay una unidad autorizada; conservar el resumen y cierre de mes de Actividad Física.
- [x] Conservar como pendientes los cambios hechos durante un guardado y advertir al salir de Actividad Física.
- [x] Corregir en las fuentes de JS19-JORNADAS el boleto de alta médica y la selección única; regenerar las dos pantallas públicas.
- [x] Distinguir rechazo del servidor de pérdida de conexión en Jornadas; conservar los datos para corregirlos.
- [x] Ejecutar las pruebas del servidor y del navegador; documentar límites y siguientes mejoras.

Validación: datos ficticios, red simulada en Chrome/Edge, pruebas Node del servidor y pruebas del generador JS19. Las mediciones locales no equivalen a latencia de Apps Script ni prueban escrituras en las hojas reales.
