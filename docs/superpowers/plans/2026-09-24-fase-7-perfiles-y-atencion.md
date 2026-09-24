# Fase 7 — Perfiles en la máscara y capturador de Atención — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuentas por persona con perfil en la máscara y un capturador hermano «Atención»
(Nutrición + Psicología) que reemplaza los dos formularios actuales.

**Architecture:** Parte A cambia la máscara (PortalPromocion, rama `fase-7-perfiles`):
perfiles en `USUARIOS`, `aplica_a` por rol, boleto con `r`/`x`, sondas por persona.
Parte B es un repo nuevo `C:\Users\oscda\PROYECTOS ISEM\ATENCION` (privado
`OscarOG23/isem-atencion`) que copia el patrón probado de `ACTIVIDAD FISICA`
(lógica pura probada en Node con `vm`, capa de servicios delgada, sesión por boleto,
sonda nativa, menú de la hoja).

**Tech Stack:** Apps Script V8, clasp 3.3, Node 24 (`vm`), GitHub Pages (máscara).

**Spec:** `docs/superpowers/specs/2026-09-24-fase-7-perfiles-y-atencion-design.md`.

**Referencias de código que se imitan:**
- Máscara: `src/Usuarios.gs`, `src/Acceso.gs`, `src/Api.gs` (`contextoDeBoleto`),
  `src/Destinos.gs` (`_aplicaA`, `destinosDeCoordinacion`, `consultarSondasNativas_`),
  `src/Boleto.gs`, `src/Tests.gs` + `tools/run-tests.js`, `web/app.js`.
- Hermano modelo: `C:\Users\oscda\PROYECTOS ISEM\ACTIVIDAD FISICA\src\*` (Api.gs:
  `responder_`, `sesion_`, `conCandado_`, `periodoParaEscribir_`; Datos.gs; Setup.gs;
  Sonda.gs; Index.html; tools/run-tests.js).

**Datos reales:** las hojas de respuestas de nutrición y psicología y los padrones viven fuera
de este repo (público). Sus IDs están en la memoria privada del proyecto y en
`~/.config/mascara/`; nunca se copian aquí ni en pruebas.

---

## Parte A — Máscara con perfiles (repo PortalPromocion, rama `fase-7-perfiles`)

### Task A1: Roles y `aplica_a` por perfil

**Goal:** Un destino se muestra a coordinaciones (`TODAS` o lista de `COORxx`) o a perfiles (`ROL:NUTRICION`…), nunca cruzado.

**Files:** Modify `src/Destinos.gs`, `src/Config.gs` (constante `ROLES`), `src/Tests.gs`, callers de `destinosDeCoordinacion`.

**Acceptance Criteria:**
- [ ] `ROLES = { COORDINACION, NUTRICION, PSICOLOGIA, PROMOTOR }`; rol vacío en USUARIOS = COORDINACION (compatibilidad).
- [ ] `destinosDeCuenta(filas, cuenta)` con `cuenta = {rol, coordinacion_id}` reemplaza a `destinosDeCoordinacion` (se deja un alias que llama a la nueva con rol COORDINACION).
- [ ] Coordinación: ve `TODAS` y listas que incluyan su `COORxx`; no ve `ROL:*`.
- [ ] Persona: ve solo los destinos cuyo `aplica_a` incluya `ROL:<su rol>`; no ve `TODAS` ni `COORxx`.
- [ ] Mezcla válida: `ROL:NUTRICION,ROL:PSICOLOGIA`; `problemasDeDestino` avisa de roles desconocidos.

**Verify:** `node tools/run-tests.js` → 0 fallas.

**Steps:** pruebas primero (las 5 reglas + rol vacío + rol desconocido), luego código, commit `feat: destinos por perfil en la mascara`.

### Task A2: Boleto con rol y unidad

**Goal:** `emitirBoleto(usuario, coord, destino, vence, secreto, nombre, extra)` con `extra = {r, x}` opcional; `verificarBoleto` los devuelve como `rol`, `unidad_id`.

**Files:** Modify `src/Boleto.gs`, `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] Sin `extra` el boleto es byte a byte el mismo que hoy (prueba con un boleto fijo).
- [ ] `r`/`x` deben ser string si vienen; otro tipo → `BOLETO_INVALIDO`.
- [ ] `verificarBoleto` devuelve `rol: datos.r || ''`, `unidad_id: datos.x || ''`.
- [ ] Un verificador viejo (copia actual de Boleto.gs de Actividad Física) acepta un boleto con `r`/`x` (prueba cargando ambas versiones o documentándolo con un caso).

**Steps:** pruebas, código, commit `feat: el boleto lleva rol y unidad`.

### Task A3: Cuentas de persona

**Goal:** Crear cuentas de nutriólogos y psicólogos desde una hoja `PERSONAL`.

**Files:** Modify `src/Usuarios.gs`, `src/Setup.gs`, `src/Config.gs` (HOJAS.PERSONAL), `src/Acceso.gs` (`_cuentaPublica` con `rol`, `unidad_id`), `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] `USUARIOS` gana columna `unidad_id` (esquema de `setupDatabase` + función `agregarColumnaUnidadAUsuarios()` idempotente para la hoja existente).
- [ ] Hoja `PERSONAL`: `nombre, rol, unidad, clues, activo`.
- [ ] Puras: `normalizarClues(s)` (mayúsculas, sin espacios, `O`→`0` después de las 4 primeras letras: `MCIMBO99999`→`MCIMB099999`); `sinTitulo(nombre)` quita `L.N.`, `LIC.`, `PSIC.`, `PSIC `, `MTRO.`, `DR.`; `usuarioDePersona(nombre)` = inicial del primer nombre + primer apellido + inicial del segundo apellido, sin acentos, minúsculas (`ANA PÉREZ LÓPEZ` → `aperezl`), con sufijo `2`,`3` si choca; `unidadDePersona(fila, unidades)` cruza por CLUES normalizada y si no por nombre sin acentos (tolerando prefijos `CEAPS`, `C.E.A.P.S.`, `C.S.`, `CENTRO DE SALUD`); `contrasenaAleatoria(azar)` 8 caracteres de `abcdefghjkmnpqrstuvwxyz23456789` con `azar` inyectable.
- [ ] `crearCuentasDePersonal()` (editor): crea solo las que faltan, rol validado, `coordinacion_id` = la de la unidad; registra en el log `usuario / contraseña / nombre / unidad` **una sola vez**; lo que no cruce se lista y no se crea; nunca toca cuentas de coordinación.
- [ ] `_cuentaDelBoleto` sigue exigiendo misma `coordinacion_id`.

**Steps:** pruebas de las puras con nombres **ficticios** (el repo es público; nunca nombres de los padrones) y nombres de unidades del catálogo (incluye una CLUES con O por 0 y `Ceaps Santa Elena` vs `CEAPS SANTA ELENA`), código, commit `feat: cuentas de persona para nutricion y psicologia`.

### Task A4: Contexto, sondas y pantalla por persona

**Goal:** Una persona entra, ve sus destinos, sus boletos llevan `r`/`x`, y las sondas preguntan por ella.

**Files:** Modify `src/Api.gs` (`contextoDeBoleto`), `src/Destinos.gs` (`consultarSondasNativas_`), `web/app.js`, `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] Boletos de destino para persona: `usuario` = su usuario, `nombre` = su nombre, `extra = {r: rol, x: unidad_id}`.
- [ ] Sonda para persona: boleto `u` = usuario de la persona (no `'mascara'`), `extra` igual; clave de caché `sonda:<id>:<coord>:<usuario>:<anio>-<mes>` para personas (coordinaciones sin cambio).
- [ ] La respuesta de `contextoDeBoleto` incluye `usuario.rol` y `usuario.unidad` (nombre de la unidad para personas).
- [ ] `web/app.js`: la cabecera dice «Coordinación» + nombre para coordinaciones, y nombre de la persona + «Nutrición · <unidad>» / «Psicología · <unidad>» para personas. Sin destinos → mensaje «Aún no hay formularios para su perfil».
- [ ] Pruebas puras de la clave de caché y de los parámetros del boleto (extraer helpers puros).

**Steps:** pruebas, código, commit `feat: la mascara atiende cuentas de persona`.

### Task A5: Despliegue de la máscara

**Acceptance Criteria:**
- [ ] Merge a `main`, push (Pages publica `web/`), `clasp push --force`, versión nueva, `clasp update-deployment AKfycbxB7IM… -V <n>` (anotar en bitácora; reversa `-V 3`).
- [ ] El usuario corre en el editor: `agregarColumnaUnidadAUsuarios`, pega `PERSONAL` (lo preparo desde los padrones + nombres de las hojas de respuestas), `crearCuentasDePersonal`, `invalidarCatalogo('USUARIOS')`.
- [ ] Una coordinación sigue viendo exactamente lo mismo (Determinantes, Mensual, SIPS, Actividad Física).

---

## Parte B — Capturador de Atención (repo nuevo `PROYECTOS ISEM/ATENCION`)

### Task B0: Esqueleto

Igual que Task 0 de Actividad Física: `git init -b main`, correo noreply, `.gitignore`,
`.claspignore` (lista blanca), `src/appsscript.json` (mismos alcances), copiar
`TestRunner.gs`, `tools/run-tests.js` (PUROS nuevos), `Boleto.gs` **ya con A2**,
`Catalogos.generado.gs`. Commit `chore: esqueleto del capturador de Atencion`.

### Task B1: Modelo y reglas puras

**Files:** Create `src/Modelo.gs` (campos y temas), `src/Periodo.gs` (copia de AF + `periodoPermitido`), `src/Reglas.gs`, `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] `CAMPOS_NUT = ['consultas', 'orientaciones', 'box_lunch']`.
- [ ] `CAMPOS_PSI_CONSULTA = ['consultas_total', 'consultas_menores18', 'consultas_60mas', 'consultas_lgbtiq']`; regla dura: cada subgrupo ≤ total.
- [ ] `TEMAS_PSI` (id, nombre): ansiedad, depresion, demencias, epilepsia, infantil (Psicopatología infantil y de la adolescencia), estres_postraumatico, suicidio, violencia (Prevención de violencia), adicciones, otro (requiere texto si sesiones > 0).
- [ ] Población: `hombres, mujeres, edad_13_17, edad_18_21, edad_22_59, edad_60mas`; regla dura: H+M = suma de edades = suma de asistentes de temas.
- [ ] Material: `murales, folletos, carteles, tema_material` (texto ≤ 200).
- [ ] `validarInforme(rol, informe)` → `{ok, errores[]}` (enteros 0–100000, obligatorios, reglas duras, textos saneados).
- [ ] `alertasDeInforme(rol, informe, anterior)` no bloqueantes: idéntico al mes anterior (todos los números iguales y > 0); asistentes = 22 × sesiones en todas las filas con sesiones > 0 (≥ 2 filas); psicología: sesiones > 0 y consultas_total = 0.
- [ ] `metasDeInforme(rol, informe)` → `[{meta:71, cantidad}, {meta:18, …}]` para nutrición; `85, 86, 90` para psicología.

### Task B2: Importación del histórico (puro)

**Files:** Create `src/Importar.gs`, `src/Tests.gs`, `tools/fixtures/` (CSV de muestra recortados de las hojas reales, **sin correos**).

**Acceptance Criteria:**
- [ ] `mesDeMarca(fecha)`: día ≤ 10 → mes anterior; día ≥ 25 → mismo mes; 11–24 → `null` (ambiguo).
- [ ] `filaNutricionAInforme(fila, cuentas)`: nombre = la única celda no vacía de las 9 columnas de nombre; cuenta por nombre sin título/acentos; mes por `mesDeMarca`.
- [ ] `filaPsicologiaAInforme(fila, encabezados, cuentas)`: mes de «Pregunta sin título»; año de la marca temporal (enero con mes DICIEMBRE → año anterior); mapea el bloque «NO./ASIST» por **posición** según el orden de temas del formulario (documentar el mapeo en el código con la lista de encabezados reales); H/M, edades, material.
- [ ] `deduplicar(informes)`: misma persona+mes → el más reciente gana; los exactos se cuentan como descartados.
- [ ] Devuelve `{informes, ambiguos, sinCuenta, descartados}`.

### Task B3: Servidor

**Files:** `src/Datos.gs`, `src/Setup.gs`, `src/Api.gs`, `src/Sonda.gs`, `src/Menu.gs`, `src/Web.gs` (modelo: Actividad Física).

**Acceptance Criteria:**
- [ ] `entrar(boleto)`: destino `atencion`; exige `rol` ∈ {NUTRICION, PSICOLOGIA} y `unidad_id` en el boleto; sesión 6 h con `{u, n, rol, unidad_id, c}`.
- [ ] `informeDelMes(token, anio, mes)` → informe (o vacío), estado (BORRADOR/ENVIADO), evidencias `{id, nombre, tipo}`, informe del mes anterior (para alertas en pantalla).
- [ ] `guardarInforme(token, anio, mes, datos)` upsert por `anio+mes+usuario` (rechaza si ENVIADO o periodo futuro), devuelve alertas.
- [ ] `subirEvidencia(token, anio, mes, nombre, tipo, base64)`: PDF o JPEG/PNG, ≤ 8 MB decodificado, máx. 10 por informe; archivo en Drive privado `Atención/<Disciplina>/<AAAA-MM>/<usuario>/`; creación fuera del candado (igual que AF). `borrarEvidencia`.
- [ ] `enviarInforme(token, anio, mes)`: valida completo (reglas duras + al menos 1 evidencia) → ENVIADO.
- [ ] Sonda `sonda:atencion`: `reportado` = informe ENVIADO de **ese usuario**; `unidades`=1, `reportadas`=0/1.
- [ ] Menú: «Reabrir informe…», «Concentrado de metas del mes…» (hoja `CONCENTRADO_METAS` unidad × mes × meta × cantidad y `.xlsx` en Drive), «Importar histórico…» (lee las dos hojas de respuestas por ID guardado en propiedades, escribe informes con `origen=FORMULARIO`, reporta ambiguos/sin cuenta en una hoja `IMPORTACION`).
- [ ] Todo lo global sin `_` valida sesión o `soloDueno_`; errores inesperados a AUDITORIA.

### Task B4: Pantalla

**Files:** `src/Index.html` (partir de `ACTIVIDAD FISICA/src/Index.html`).

**Acceptance Criteria:**
- [ ] Cabecera: nombre, disciplina, unidad; selector de mes (≤ mes en curso).
- [ ] Nutrición: 3 números + evidencias (2 PDF sugeridos: colaterales firmados, evidencias).
- [ ] Psicología: consultas (4 números), tabla de temas (sesiones, asistentes), población (H/M + 4 edades) con **indicador en vivo** de si cuadra, material, evidencias.
- [ ] Guardar (borrador) y «Enviar informe» (confirmación; bloqueado si hay errores duros o 0 evidencias); ENVIADO = solo lectura.
- [ ] Alertas no bloqueantes visibles; PDF sube sin recomprimir; imágenes se reducen como en AF.

### Task B5: Despliegue, alta e importación

- [ ] `clasp create` (cuenta del comité), secreto con instalador temporal, `configurarTodo`, deployment, repo privado.
- [ ] Fila en `DESTINOS_CONOCIDOS` de la máscara: `atencion`, «Informe mensual de Atención», apartado «Reporte mensual», `HERMANO_CON_CONTRASENA`, `aplica_a ROL:NUTRICION,ROL:PSICOLOGIA`, `sonda NATIVA`, orden 5.
- [ ] Importar histórico y revisar la hoja `IMPORTACION` con el usuario.
- [ ] Prueba en vivo con una cuenta de nutrición y una de psicología desde el teléfono.
- [ ] Bitácora de cambios drásticos y memoria de despliegue.
