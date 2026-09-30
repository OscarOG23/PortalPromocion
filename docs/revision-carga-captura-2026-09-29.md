# Revisión de carga y captura — 29 de septiembre de 2026

## Resultado y alcance

Se revisaron el portal, Atención, Actividad Física, Captura de Jornadas y Alta de Jornada Médica. Se corrigieron fallos reproducidos con datos ficticios en Chrome. Las pantallas generadas se corrigieron en las fuentes de `JORNADA SALUD/JS19-JORNADAS` y se regeneraron en este repositorio.

Los cambios están locales, sin publicar ni realizar escrituras de prueba en las hojas reales. No se ha medido la latencia del despliegue de Apps Script ni se ha validado de extremo a extremo cada capturador externo enlazado. Pasar las pruebas no constituye una garantía de ausencia total de errores.

## Correcciones realizadas

| Área | Antes | Ahora |
|---|---|---|
| Portal | La respuesta de contexto esperaba las sondas de avance de otros sistemas. | La pantalla solicita enlaces primero y avances después. Una sonda lenta no retrasa la apertura del capturador. |
| Portal | Dos peticiones simultáneas podían consultar el mismo contexto. | Se comparte la petición en curso. Las respuestas de una generación anterior se descartan. |
| Portal | Una respuesta JSON ilegible podía dejar errores de interfaz. | Se valida la respuesta; el error de conexión no borra el boleto. |
| Atención | La unidad ya provenía del perfil. | Se conserva ese comportamiento; no se pide elegirla de nuevo. |
| Actividad Física | Aun con una sola unidad, se mostraba una lista para elegirla. | Se abre esa unidad si el mes está abierto. Volver muestra el resumen y permite terminar el mes. Con varias unidades o mes cerrado se conserva la lista. |
| Jornadas | Una unidad única seguía dejando vacío el selector. | Se elige en nueva jornada y en ficha técnica. Una unidad anterior que ya no aparece en el catálogo no se reutiliza. |
| Jornada Médica | Una unidad única seguía sin seleccionarse. | Queda elegida, se muestran municipio y coordinación y se conserva después de «Otra». |
| Jornada Médica | El puente trataba el objeto de alta como un arreglo y omitía el boleto al registrar. | El boleto se adjunta en la capa donde los argumentos sí son un arreglo. El servidor recibe la identidad para validar la unidad. |
| Atención y Actividad Física | Editar mientras se guardaba podía terminar marcado como guardado. | Se compara la versión enviada con lo que quedó en pantalla; los cambios posteriores siguen pendientes. Atención no continúa al envío definitivo de una versión anterior. |
| Actividad Física y Jornadas | Recargar podía descartar captura en memoria sin aviso. | Se solicita confirmación del navegador cuando hay captura pendiente; el aviso depende del soporte del navegador. |
| Jornadas | Un rechazo del servidor se anunciaba como «Sin señal» y borraba el formulario tras encolarlo. | Los errores con código de servidor conservan el formulario y muestran el motivo. Los errores de red, incluido AbortError, mantienen la cola offline. |
| Jornadas | Con almacenamiento lleno podía decir que la captura estaba guardada en el teléfono. | Se verifica el resultado de persistencia; si falla, se conserva el formulario y se pide no cerrar la página. |
| Jornadas | Se pedían preferencias separadas aunque ya venían en el arranque. | Se elimina esa petición: arranque normal de 3 a 2 solicitudes. Se conservan preferencias locales más recientes al usar el catálogo offline. |

Se actualizaron las versiones de los archivos JavaScript para que el navegador solicite los nuevos archivos tras publicar.

## Rendimiento: qué se comprobó

- Prueba de servidor: el contexto rápido hace **cero consultas a sondas** antes de devolver enlaces.
- Prueba de navegador: los enlaces se pueden usar mientras la respuesta de estados permanece pendiente.
- Prueba de navegador: Jornadas hace **dos peticiones de arranque en lugar de tres**, sin cola pendiente.
- Se mantuvieron los boletos firmados, el filtro de destinos por cuenta y la validación de permisos de «ver como».
- El tamaño estático revisado no justifica empezar por una reescritura: el JavaScript más grande ronda 100 kB y cada logo ronda 43 kB. La dependencia de llamadas al servidor es una prioridad más directa. Esto es análisis del código y los tamaños, no una medición de tiempos reales.

## Siguientes mejoras, en orden

| Prioridad | Mejora | Criterio de aceptación |
|---|---|---|
| Alta | Borrador recuperable durante la captura, por cuenta + formulario + unidad + periodo. | Tras cerrar accidentalmente o reiniciar el teléfono se ofrece restaurar la versión pendiente correcta. Nunca se restaura en otra cuenta o mes. |
| Alta | Fortalecer la cola offline de Jornadas. | Solo un envío por elemento; no eliminar una edición nueva al confirmar una anterior; separar por cuenta y mostrar el motivo de un rechazo pendiente. Probar dos pestañas y reconexión repetida. |
| Alta | Pruebas reales de extremo a extremo con cuentas de prueba. | Entrar → abrir destino → capturar → guardar → recargar → verificar hoja → cerrar periodo. Incluir cada perfil y cada capturador externo del directorio. |
| Alta | Medir carga inicial y guardado con red lenta y servidor frío. | Registrar tiempo hasta enlaces utilizables, formulario utilizable, confirmación y errores; comparar varias ejecuciones y percentiles, no una sola carga. |
| Media | Unificar entrada y datos iniciales de los capturadores que hoy requieren llamadas consecutivas. | Una respuesta autenticada devuelve sesión y catálogo autorizado; no se aumenta el alcance del usuario. |
| Media | Reintento de lecturas y mensajes de progreso. | Reintentar consultas de forma limitada; no repetir automáticamente escrituras sin una clave que evite duplicados. |
| Media | Recordar última unidad cuando hay varias. | Guardar por cuenta, comprobar que siga autorizada y mostrar unidad y periodo claramente antes de enviar. La preselección única ya está hecha. |
| Media | Recorrido de teclado y primer error visible. | Enter/Siguiente recorre campos sin enviar accidentalmente; errores enfocan el campo correcto; el teclado numérico se mantiene en teléfonos. |
| Media | Atajo explícito para secciones sin actividad. | El usuario confirma «Sin actividad» y ve qué cifras cambian. No convertir automáticamente todos los vacíos en cero. |
| Media | Pruebas automáticas antes de publicar Pages. | Bloquear publicación si fallan pruebas de API o navegador. El arnés nuevo ya está disponible para integrarlo al flujo de publicación. |
| Baja | Compartir logos entre páginas y revisar caché de archivos estáticos. | Menos descargas al recorrer capturadores; comparar con medición antes de optimizar. |

## Verificación reproducible

En PortalPromocion:

```powershell
node tools/run-tests.js
node --test tools/runtime-tests.js tools/concurrency-tests.js tools/browser-tests.js
```

En JS19-JORNADAS:

```powershell
node --test tests/*.test.mjs
```

El arnés nuevo abre Chrome/Edge en modo headless, usa perfiles temporales, datos ficticios y `fetch` simulado; no se conecta a las API reales. Puede configurarse `CHROME_PATH`. Las pruebas incluyen unidad única/múltiple/vacía, mes cerrado, doble petición, logout durante petición, errores de servidor, timeout, almacenamiento lleno y ediciones durante guardado.

Resultado: **107 pruebas del portal + 30 pruebas de API, navegador y concurrencia + 230 de JS19-JORNADAS**, sin fallos ni saltos en esta máquina. La prueba de manejo de excepciones del portal imprime deliberadamente «se cayó la hoja» y pasa; no representa una falla de la hoja real.

## Publicación

Apps Script del portal actualizado a la versión 10 y Jornadas a la versión 16, conservando sus direcciones públicas. Fuentes de Jornadas publicadas en el commit 3285650. Las pantallas acompañan este cambio mediante el flujo de GitHub Pages.

Queda por validar con cuentas de prueba en tres dispositivos físicos y medir tiempos de carga autenticada. Las pruebas automatizadas usan datos ficticios; no prueban la latencia real de Google ni modifican datos operativos.

## Orden recomendado para el siguiente ciclo

1. Medición: tiempo hasta enlaces y formulario utilizables, confirmación de guardado y tasa de errores. Comparar p50 y p95 por capturador y dispositivo, sin registrar boletos ni datos de pacientes.
2. Combinar autenticación y datos iniciales donde sean consecutivos. Objetivo: quitar un viaje completo al servidor por apertura, conservando permisos.
3. Borradores recuperables y escrituras con identificador único. Objetivo: recuperar captura interrumpida sin registros duplicados al reintentar.
4. Cola offline con pruebas de reconexión y dos pestañas. Objetivo: que una confirmación antigua nunca borre una edición reciente.
5. Integrar las pruebas al flujo de publicación. Objetivo: impedir que una regresión conocida llegue a producción.

Las prioridades se basan en el código y las pruebas, no en una comparación de latencias de producción antes/después. Los ajustes de imágenes y estilos quedan después de resolver las esperas del servidor.
