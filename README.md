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

Si la pantalla del capturador no vive en `script.google.com` (p. ej. está en GitHub Pages), la sonda
`NATIVA` necesita la columna `url_sonda` con el `/exec` del Apps Script: el botón abre `url` y la
sonda pregunta a `url_sonda`. En una hoja anterior, agregar la columna con `agregarColumnaUrlSondaADestinos()`.
Para llevar a la hoja las direcciones de `DESTINOS_CONOCIDOS` (solo `url` y `url_sonda`): `actualizarDestinosConocidos()`.

## Pantalla de Atención (`web/atencion/`)

La pantalla del capturador de Atención (repo privado `ATENCION`) se sirve desde aquí, en
`https://oscarog23.github.io/PortalPromocion/atencion/`, por el mismo defecto de Android Chrome con
`script.google.com`. Es la de `ATENCION/src/Index.html` con dos cambios: lee el boleto con
`URLSearchParams` y lo borra de la barra de direcciones, y en vez de `google.script.run` manda POST
`{accion, args}` (text/plain) al `/exec` de Atención, cuya URL está en `web/atencion/config.js`.
La sesión de la pestaña se guarda en `sessionStorage` con el prefijo `atencion:`.
Aquí no hay datos ni secretos: todo lo valida el Apps Script de Atención. Al cambiar un archivo,
subir el `?v=` de `web/atencion/index.html`.

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
  (surte efecto al vencer la caché de 30 min, o al instante con `invalidarCacheDeUsuarios()` en el editor).
  Para cortar a todas: `generarSecretoDeBoletos(true)` (ver «Funciones de emergencia» abajo).
- **El bloqueo por intentos se puede usar para molestar.** Con la contraseña deducible, forzarla no le sirve a nadie;
  lo que sí se puede es teclear 5 contraseñas malas con el usuario de otra coordinación y dejarla fuera 15 minutos.

## Funciones de emergencia (correr a mano en el editor)

El botón Ejecutar del editor de Apps Script llama a la función seleccionada **sin argumentos**. Para las que
sí los llevan, se escribe una función temporal que la envuelve, se corre esa, y se borra:

- **Dar de baja una cuenta al instante**, sin esperar a que venza la caché de 30 min:
  `invalidarCacheDeUsuarios()` (esta sí se corre directo, no lleva argumentos).
- **Cortar el acceso a TODAS las cuentas** (rota el secreto de boletos; en la Fase 2 hay que avisar a los
  hermanos, que también lo necesitan):
  ```js
  function tmp() { generarSecretoDeBoletos(true); }
  ```
  Correr `tmp`, revisar el registro y borrar la función.
- **Restablecer la contraseña de una cuenta** (por si su huella se corrompió; la contraseña sigue siendo
  usuario + `26`):
  ```js
  function tmp() { restablecerContrasena('usuario'); }
  ```
  Correr `tmp`, revisar el registro y borrar la función.

## Secreto de boletos

Vive en las propiedades del script (`SECRETO_BOLETOS`), nunca en la hoja ni en el repo. En la Fase 2 cada
capturador hermano recibirá una copia para verificar los boletos.

## Instalación desde cero

1. `clasp create --type sheets --rootDir src` — crea la hoja y el proyecto de Apps Script ligados.
2. `clasp create` sobrescribe `src/appsscript.json`: restaurarlo con `git checkout -- src/appsscript.json`.
3. En `.clasp.json`, agregar `"filePushOrder": ["src/Config.gs", "src/Boleto.gs"]` (ambos los usan otros
   archivos que cargan después por orden alfabético).
4. `clasp push --force`.
5. En el editor de Apps Script, correr en este orden: `setupDatabase`, `cargarUniverso`,
   `verificarCatalogos`, `crearCuentasDeCoordinaciones`, `generarSecretoDeBoletos`, `runAllTests`.
   La primera vez que se corre algo, Apps Script pide autorizar permisos: hay que aceptarlos ahí mismo. Si
   se saltan, `/exec` contesta una página HTML de autorización en vez de JSON, y el cliente dice
   «No se pudo conectar» sin más pista.
6. `clasp create-deployment` y poner la URL que da (termina en `/exec`) en `web/config.js`.
7. En GitHub, Settings → Pages → Source: **GitHub Actions** (la publica `.github/workflows/pages.yml`).
