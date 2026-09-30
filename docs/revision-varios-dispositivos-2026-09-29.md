# Entrada simultánea desde varios dispositivos

El usuario reporta que el sistema se traba al iniciar sesión, cargar el portal y abrir un capturador. La revisión se concentra en las esperas y el trabajo que repite cada dispositivo. Es continuación de la revisión de carga y captura.

## Evidencia

- El portal verifica boletos firmados. No mantiene un único token activo por usuario ni revoca los anteriores al entrar de nuevo.
- Atención y Actividad Física crean un UUID por sesión y lo guardan con una clave distinta. Se ejecutaron sus funciones reales `entrar` y `sesion_` con servicios simulados: los tres dispositivos conservan tokens distintos y válidos.
- La bitácora del portal podía esperar hasta 5000 ms por el candado de otra ejecución al ingresar. La propia bitácora ya era de mejor esfuerzo: si no obtenía el candado, omitía el evento.
- Las sondas reutilizaban respuestas terminadas, pero no reconocían una consulta aún en curso. Al intercalar dos ejecuciones contra una caché compartida se reproducía una segunda consulta remota para la misma cuenta, destino y periodo.
- Los fallos remotos no tenían una pausa compartida: cada nuevo intento podía volver a llamar al servidor que acababa de fallar.

Estos hallazgos prueban posibilidades de espera y trabajo duplicado en el código; no identifican por sí solos la causa exacta de cada atasco observado en producción. `clasp logs --simplified` no pudo leer registros: falta configurar el GCP project ID. No se lanzó una prueba de carga contra usuarios reales.

## Cambios

1. **Ingreso:** la espera por el candado de bitácora se limita a 100 ms. No limita el tiempo total de login ni de una escritura ya iniciada. Si la bitácora está ocupada se omite ese evento, como ya contemplaba el diseño. Las acciones administrativas conservan los 5000 ms.
2. **Sondas compartidas:** antes de consultar se reserva cada clave de cuenta/destino/periodo en caché. La reserva se verifica bajo un candado breve. El candado se libera antes de cualquier llamada remota, por lo que no se mantiene bloqueado el resto de coordinaciones durante la red.
3. **Otros dispositivos:** reciben `consultando: true` y recuperan el resultado mediante consultas de lectura con pausas de 5, 10, 20, 30, 30 y 30 segundos como máximo. Los enlaces siguen disponibles. Al cerrar sesión o cambiar de contexto se cancelan los reintentos de ese contexto.
4. **Recuperación:** una reserva se limpia al terminar; si la ejecución se interrumpe, caduca en 360 segundos. Cada propietario limpia únicamente su propia reserva. Las respuestas fallidas se conservan como «Sin dato» durante 30 segundos para no lanzar una ráfaga inmediata; nunca se convierten en «Reportado».
5. **Tablero administrativo:** utiliza el mismo mecanismo para recuperar el avance de cada fila sin repetir la consulta remota que ya está haciendo otro dispositivo.
6. **Carga inicial:** se mantienen los cambios de la revisión anterior que separan enlaces de avances. Ambos conjuntos deben publicarse para obtener la mejora completa.

El bloqueo mutuo y su tiempo máximo de espera siguen el contrato de [LockService](https://developers.google.com/apps-script/reference/lock/lock). Las reservas son una optimización, no una garantía transaccional: Google puede retirar entradas de [CacheService](https://developers.google.com/apps-script/reference/cache/cache) antes de su vencimiento. La disponibilidad y los permisos siguen validándose en cada petición.

## Pruebas

```powershell
node tools/run-tests.js
node --test tools/runtime-tests.js tools/browser-tests.js tools/concurrency-tests.js
```

El arnés de concurrencia intercala ejecuciones independientes que comparten caché y candado simulados; comprueba:

- Tres dispositivos reutilizan una consulta de avance y luego recuperan su resultado.
- Otra coordinación puede consultar mientras la primera está en red.
- Un fallo remoto no provoca repetición inmediata y permite recuperarse tras la pausa.
- Un candado ocupado devuelve una respuesta pendiente sin iniciar más llamadas.
- La espera de bitácora de ingreso es corta y las administrativas no cambian.
- Los boletos del portal y las sesiones de Atención y Actividad Física siguen vigentes al entrar otros dispositivos.
- La reserva de una ejecución interrumpida caduca.

Las pruebas de navegador verifican además la recuperación del avance compartido, cancelación al salir, número máximo de reintentos y disponibilidad de enlaces durante la espera.

Resultado de esta revisión: 107 pruebas de lógica del portal y 30 de API, navegador y concurrencia aprobadas, sin fallos ni saltos en esta máquina. Los cambios pasaron también una revisión independiente de código.

## Qué falta para confirmarlo en uso real

Apps Script del portal publicado en la versión 10; las pantallas se publican con este cambio en Pages, conservando sus direcciones. Probar con tres dispositivos usando una cuenta de prueba: login, portal, apertura de Atención/Actividad Física y actualización de avances. Registrar tiempos y errores reales, además de identificar cualquier otro capturador que aún presente el atasco. No se cambió la lógica de guardado de los capturadores en esta revisión.
