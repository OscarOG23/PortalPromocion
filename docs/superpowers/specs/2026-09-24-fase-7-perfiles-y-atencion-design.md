# Fase 7 — Perfiles en la máscara y capturador de Atención (Nutrición y Psicología) — Diseño

**Fecha:** 2026-09-24 · **Aprobación de rumbo:** del usuario en la sesión de diseño.

**Objetivo:** Que nutriólogos y psicólogos (y luego promotores) entren al mismo portal con
su propia cuenta y vean solo sus capturadores, y que un capturador nuevo, **Atención**,
reemplace los formularios «Productividad Mensual Nutrición 2025» y el de psicólogos con un
registro mensual limpio, desglosado y con evidencias, que alimente la evaluación de metas
18, 71, 85, 86 y 90.

Decisiones del usuario:

- Un solo portal; cada persona ve sus formularios. «Paramédico» = nutriólogos y psicólogos.
- Nutrición y Psicología van **juntos** en un capturador (módulos por disciplina).
- Promotores: cada formulario es su propio capturador (fase posterior, fuera de este spec).
- Registro = **resumen mensual + lista nominal / evidencias** (lo que ya suben).
- Psicología incluye **consultas individuales** (< 18, 60 y más, LGBTIQ+), hoy reportadas fuera.
- Nutrición conserva sus 3 totales (sin carga nueva).

## 1. Lo que dicen los datos actuales

**Nutrición** (respuestas abr-2025 → sep-2026, 8 nutriólogos, 9 unidades):
una pregunta de nombre por unidad (9 columnas), sin campo de mes (se infiere de la marca
temporal: el 1, el 30 o el 4), envíos duplicados, cifras idénticas mes a mes en algunas unidades y errores de dedo
(una cifra con un dígito de menos, «00»). Campos: consultas, orientaciones alimentarias, box lunch, 2 PDF (colaterales firmados
y evidencias).

**Psicología** (mar → jul 2026, ~12 psicólogos): una pregunta de nombre por unidad (11
columnas), mes como «Pregunta sin título», hoja rota por reestructuras del formulario (pares
«NO. / ASIST» sin tema, «Columna 31/52/53», unidad duplicada), asistentes casi siempre
22 × sesión, correo tecleado. Bien: H/M y grupos de edad cuadran. Falta: consultas individuales.

## 2. Parte A — Perfiles en la máscara

- `USUARIOS.rol` (ya existe) toma valores: `COORDINACION`, `NUTRICION`, `PSICOLOGIA`
  (y después `PROMOTOR`). Columna nueva `unidad_id` (vacía para coordinaciones).
- Cuentas de persona: `usuario` = iniciales + apellido sin acentos (p. ej. `aperezl` para «Ana Pérez López»),
  `nombre` completo, `coordinacion_id` = la de su unidad, `unidad_id`. Se cargan con
  `crearCuentasDePersonal()` desde una hoja `PERSONAL` (pegada de los padrones), que se
  cruza con el catálogo por **CLUES normalizada** (la O por 0, sin espacios) o nombre de unidad;
  lo que no cruce se reporta y no se crea.
- **Contraseña de persona: usuario + `26`**, igual que las coordinaciones (decisión del usuario,
  2026-09-24: la cuenta solo sirve para capturar su propio informe —no hay descarga de
  evidencias ni vista de otros— y una contraseña difícil sería pretexto para no reportar).
  `igualarContrasenasDePersonal()` pasa a esta regla las cuentas creadas antes con contraseña
  aleatoria.
- `DESTINOS.aplica_a` acepta además perfiles: `ROL:NUTRICION`, `ROL:PSICOLOGIA`,
  combinables con coma (`ROL:NUTRICION,ROL:PSICOLOGIA`). `TODAS` sigue significando
  «todas las **coordinaciones**» (las cuentas de persona no ven los destinos de coordinación).
- El boleto suma dos campos opcionales: `r` (rol) y `x` (unidad_id). Los verificadores
  actuales los ignoran (no rompen Determinantes, Mensual, SIPS ni Actividad Física).
- La pantalla del portal no cambia de estructura: el apartado y el semáforo salen de los
  destinos que le tocan a la cuenta.

## 3. Parte B — Capturador de Atención

Hermano nuevo (repo privado `isem-atencion`, mismo patrón que Actividad Física): entra solo
con boleto, identidad = persona del boleto (`u`, `n`, `r`, `x`), contesta sondas.

**Pantalla:** mes (≤ mes en curso) → un solo informe por persona × mes (reenviar reemplaza),
con el módulo de su disciplina. «Enviar informe» lo cierra; la jurisdicción lo reabre.

**Módulo Nutrición:** consultas de nutrición (meta 71), orientaciones alimentarias —
sesiones (meta 18), box lunch; PDF de colaterales firmados y PDF de evidencias (≤ 10 MB c/u).

**Módulo Psicología:**
- Consultas individuales del mes: total, < 18 años (meta 85), 60 y más (meta 86),
  LGBTIQ+ (meta 90).
- Sesiones grupales por tema (tabla fija, sesiones + asistentes): ansiedad, depresión,
  demencias, epilepsia, psicopatología infantil y adolescencia, estrés postraumático,
  suicidio, prevención de violencia, adicciones, otro (con texto).
- Material informativo: periódicos murales, folletos, carteles, tema.
- Población de las sesiones: hombres, mujeres; adolescentes 13–17, jóvenes 18–21,
  adultos 22–59, adultos mayores. **Regla dura:** H+M = suma de edades = suma de asistentes
  de la tabla de temas.
- Evidencias: listas de asistencia y fotos (PDF o imágenes).

**Alertas que no bloquean:** cifras idénticas al mes anterior; asistentes = 22 × sesiones en
todas las filas; consultas en 0 con sesiones > 0 (y al revés).

**Datos:** `INFORMES` (persona × mes, cabecera + campos de ambos módulos), `TEMAS_PSI`
(informe × tema), `EVIDENCIAS` (informe × archivo en Drive privado, carpeta por
disciplina/mes/persona), `CIERRES`, `AUDITORIA`. Clave: `anio + mes + usuario`.

**Salidas:**
- Hoja `CONCENTRADO_METAS`: unidad × mes × meta × cantidad (18, 71, 85, 86, 90), con la forma
  que espera `EVALUACION MENSUAL TRIMESTRAL Y ANUAL/colaterales`.
- Menú de la hoja: reabrir informe, exportar concentrado del mes a `.xlsx`.
- **Importación del histórico** 2025–2026 desde las dos hojas de respuestas (nombre → cuenta;
  mes: el campo explícito en psicología; en nutrición, el mes anterior a la marca temporal si
  es día ≤ 10, el mismo mes si es ≥ 25; lo ambiguo se reporta). Duplicados exactos se
  descartan; el resto queda con `origen = FORMULARIO`.

**Confidencialidad:** nada nominal de pacientes se teclea; las listas nominales solo existen
como archivos de evidencia en el Drive privado del comité, sin compartir. El concentrado
no lleva nombres de pacientes.

**Sonda:** `reportado` = el informe del mes está enviado.

## 4. Fuera de alcance

Promotores (fase siguiente, reutiliza la Parte A), formulario de coordinaciones (pendiente de
que se comparta), tablero, captura por paciente.

## 5. Riesgos

- Contraseña deducible (usuario + 26): quien conozca el usuario de otra persona puede capturar a
  su nombre. Riesgo aceptado por el usuario, igual que en las coordinaciones.
- El cruce padrón ↔ catálogo tiene errores de CLUES (una O en lugar de un 0, CLUES nuevas `MCIMB…` contra las del catálogo `MCSSA…`); se normaliza y lo que
  no cruce se corrige a mano en `PERSONAL`.
- Servir la pantalla desde `script.google.com` falla en algunos Android con varias cuentas
  (lección de SSOP). Si aparece, la pantalla de Atención pasa a GitHub Pages como la máscara.
