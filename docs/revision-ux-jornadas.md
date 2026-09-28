# Revisión de captura de jornadas · 27 de septiembre de 2026

Se aplicó la identidad visual de SIPS (guinda, papel cálido, acentos oro, títulos serif y tarjetas) exclusivamente al reporte y la programación de jornadas. Se usan fuentes del sistema para mantener la carga independiente de servicios externos.

## Cambios
- Reporte: cuatro pasos existentes, explicación del alcance, controles de modo con estado accesible, botón de fotos operable por teclado, contador de fotos y selección desde galería, observaciones explícitamente opcionales.
- Programación: tres grupos semánticos (sede y fecha, servicios, responsable), casillas con área táctil amplia, ayuda para población y módulos, estado que explica qué falta, validación de población positiva y bloqueo de doble envío.
- Presentación: texto auxiliar de 14 px, entradas de 16 px, foco visible, diseño claro estable, sin desplazamiento horizontal en las dimensiones comprobadas.

## Fuente y regeneración
Los archivos web son generados. Los cambios originales están en el proyecto hermano `JORNADA SALUD/JS19-JORNADAS`: `apps_script/capturador.html`, `apps_script/altaMedica.html`, `apps_script/estilos.html` y ambos scripts `publicar_pages*.py`. El CSS está limitado a `body.jornada-ui` para conservar el resto del portal y el panel administrativo.

Desde ese proyecto, ejecutar `python scripts/publicar_pages.py` y `python scripts/publicar_pages_medica.py`. Ambos regeneran las carpetas correspondientes de este portal y renuevan la versión de los recursos.

## Comprobación
- Portal: 103 pruebas, cero fallas.
- Jornadas: 230 pruebas, cero fallas ni omisiones; incluye pruebas de navegador.
- Comprobación adicional en Chrome con servicios simulados: formulario completo habilita envío, cero bloquea, edición durante envío no habilita un segundo envío y confirmación recibe foco.
- Revisión responsive en Chrome a 360, 390, 768 y 1366 px; pasos 2–4 revisados a 390 px, sin desbordamiento horizontal.
- Las capturas visuales usan catálogos ficticios. No se enviaron registros reales ni se publicó esta versión.

La revisión mejora legibilidad y claridad, pero la facilidad de uso final debe contrastarse con capturistas en una jornada real.
