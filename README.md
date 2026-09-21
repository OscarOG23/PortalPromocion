# La máscara — acceso único a los capturadores de Promoción

Una coordinación entra una vez, con una contraseña, y desde aquí llega a cada
capturador ya identificada. Diseño: `docs/superpowers/specs/2026-09-21-mascara-de-acceso-unico-design.md`.

## Partes

- `src/` — Apps Script que solo responde JSON (`doPost`). Se sube con `clasp push`
  (`.clasp.json` no se versiona; `filePushOrder` pone `Config.gs` primero).
- `web/` — la pantalla, publicada en GitHub Pages por `.github/workflows/pages.yml`.
  `web/config.js` lleva la URL `/exec` del despliegue.
- La hoja ligada al Apps Script: `USUARIOS`, `DESTINOS`, `CONFIG`, catálogos y `AUDITORIA`.

## Agregar un capturador

Una fila en `DESTINOS` y luego `verificarDestinos()` en el editor. No se toca código.

## Publicar una versión nueva del Apps Script

`clasp push --force` y `clasp update-deployment <deploymentId>`: la URL `/exec` no cambia.

## Probar la API a mano

Apps Script contesta el POST con una redirección 302 que hay que seguir con **GET**
(`curl -L` con `-d` se queda colgado). En dos pasos:

```bash
L=$(curl -s -o /dev/null -w '%{redirect_url}' -H 'Content-Type: text/plain' \
      -d '{"accion":"iniciarSesion","usuario":"chiautla","contrasena":"x"}' "$EXEC")
curl -s "$L"
```

## Pruebas

`node tools/run-tests.js` (lógica pura). Lo que toca Sheets se verifica en el editor con `runAllTests()` y las funciones de `Setup.gs`.

## Riesgos aceptados, dichos de frente

- **La contraseña es deducible** (`usuario` + `26`) por decisión explícita, y esta página es **pública**.
  Quien sepa el nombre de una coordinación puede entrar como ella a todos sus capturadores.
  Para endurecerla: cambiar `contrasenaDeUsuario` en `src/Usuarios.gs` y correr `crearCuentasDeCoordinaciones()`.
- **La sesión dura 30 días y vive en el teléfono.** Para cortar una cuenta: `activo = FALSE` en `USUARIOS`
  (surte efecto al vencer la caché de 30 min, o al instante con `invalidarCatalogo('USUARIOS')` en el editor).
  Para cortar a todas: `generarSecretoDeBoletos(true)`.
- **El bloqueo por intentos se puede usar para molestar.** Con la contraseña deducible, forzarla no le sirve a nadie;
  lo que sí se puede es teclear 5 contraseñas malas con el usuario de otra coordinación y dejarla fuera 15 minutos.

## Secreto de boletos

Vive en las propiedades del script (`SECRETO_BOLETOS`), nunca en la hoja ni en el repo. En la Fase 2 cada
capturador hermano recibirá una copia para verificar los boletos.
