# Fase 6 — Capturador de Actividad Física — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un capturador hermano (Apps Script propio) donde cada coordinación captura el
Reporte de Actividad Física por unidad, con fotos, y del que la jurisdicción descarga el
colateral `.xlsx` idéntico al formato de Toluca.

**Architecture:** Proyecto nuevo en `C:\Users\oscda\PROYECTOS ISEM\ACTIVIDAD FISICA`
(repo git privado `OscarOG23/isem-actividad-fisica`). Lógica pura en `.gs` probada en Node
con `vm` (mismo patrón que PortalPromocion). El Excel se arma editando el XML del `.xlsx`
original (plantilla embebida en base64), con `Utilities.unzip/zip` en Apps Script y `jszip`
en Node para la prueba de fidelidad. Entra solo con boleto de la máscara; contesta sondas.

**Tech Stack:** Google Apps Script V8, clasp, HTML/JS sin framework, Node 24 (`vm`, `jszip`),
Python 3 + openpyxl (solo para verificar fidelidad).

**Spec:** `docs/superpowers/specs/2026-09-23-fase-6-actividad-fisica-design.md`.

---

## Mapa de archivos (repo `ACTIVIDAD FISICA`)

| Archivo | Responsabilidad | Puro |
|---|---|---|
| `src/appsscript.json` | Manifiesto: V8, web app ANYONE_ANONYMOUS, alcances | — |
| `src/Boleto.gs` | Copia literal de `PortalPromocion/src/Boleto.gs` | sí |
| `src/Catalogos.generado.gs` | Copia literal de `PortalPromocion/src/Catalogos.generado.gs` (mismos `COORxx`/`Uxxx` que el boleto) | sí |
| `src/Catalogo.gs` | CSV → unidades activas por `coordinacion_id` | sí |
| `src/Periodo.gs` | mes por defecto, validar periodo, nombres de mes | sí |
| `src/Captura.gs` | campos, validación, alertas, orden de filas del colateral | sí |
| `src/Sonda.gs` | `avanceAF` (puro) + `responderSonda_` (IO) | mixto |
| `src/Xlsx.gs` | edición de `sheet1.xml`, `drawing1.xml`, rels, content types, calcChain | sí |
| `src/Plantilla.generado.gs` | `PLANTILLA_AF_B64` (plantilla sin fotos) — la genera `tools/hacer-plantilla.js` | — |
| `src/Datos.gs` | hojas: leer/escribir/upsert, propiedades, `soloDueno_` | no |
| `src/Setup.gs` | `configurarTodo()` (hojas, carpeta de Drive, propiedades) | no |
| `src/Api.gs` | lo que llama la pantalla: `entrar`, `estadoDelMes`, `guardarUnidad`, `borrarUnidad`, `subirFoto`, `borrarFoto`, `terminarMes` | no |
| `src/Colateral.gs` | `onOpen` (menú), generar colateral, reabrir mes | no |
| `src/Web.gs` | `doGet` (pantalla o sonda) | no |
| `src/Index.html` | pantalla para teléfono | — |
| `src/TestRunner.gs`, `src/Tests.gs` | pruebas puras (corren en Node y en el editor) | sí |
| `tools/run-tests.js` | corredor Node | — |
| `tools/hacer-plantilla.js` | referencia → plantilla sin fotos → `Plantilla.generado.gs` | — |
| `tools/fidelidad.js` + `tools/fidelidad.py` | arma agosto con 6 fotos y lo compara con la referencia | — |
| `referencia/08 COLATERAL DE AF 2026.xlsx` | el archivo del usuario (movido de PortalPromocion) | — |

Hojas: `CAPTURA_AF`, `FOTOS_AF`, `CIERRES_AF`, `AUDITORIA`. Propiedades del script:
`SECRETO_BOLETOS`, `ID_HOJA`, `ID_CARPETA_RAIZ`, `CORREO_DUENO`.

Columnas del formato ↔ campos (orden fijo, B..M):
`ses_pob, asis_pob_h, asis_pob_m, tall_pers, asis_tall_h, asis_tall_m, pausa_pers, asis_pausa_h, asis_pausa_m, bici, asis_bici_h, asis_bici_m`.

Estilos de la referencia (índices `s=`): fila de datos A=`12`, B..M=`13`; TOTAL A=`10`, B..M=`11`.
Filas 1–9 no se tocan salvo `K7` (`<c r="K7" s="7"><v>46235</v></c>`).

---

### Task 0: Esqueleto del repo

**Goal:** Repo privado con corredor de pruebas vacío pasando.

**Files:** Create `ACTIVIDAD FISICA/{.gitignore,.claspignore,package.json,src/appsscript.json,src/Boleto.gs,src/Catalogos.generado.gs,src/TestRunner.gs,src/Tests.gs,tools/run-tests.js,referencia/…xlsx}`

**Acceptance Criteria:**
- [ ] `node tools/run-tests.js` sale con código 0.
- [ ] `git config user.email` = `272093836+OscarOG23@users.noreply.github.com`.
- [ ] El `.xlsx` de referencia salió de PortalPromocion y vive en `referencia/`.

**Verify:** `node tools/run-tests.js` → `0 fallas`

**Steps:**

- [ ] **1.** `mkdir "ACTIVIDAD FISICA"`, `git init -b main`, `git config user.email 272093836+OscarOG23@users.noreply.github.com`.
- [ ] **2.** `git mv` no aplica (el xlsx no está versionado): `mv "../PortalPromocion/08 COLATERAL DE AF 2026.xlsx" referencia/`.
- [ ] **3.** Copiar literal `Boleto.gs` y `Catalogos.generado.gs` de `PortalPromocion/src/`.
- [ ] **4.** `.gitignore`: `.clasp.json`, `.clasprc.json`, `node_modules/`, `~$*`, `salida/`.
- [ ] **5.** `.claspignore` (lista blanca):
```
**/**
!appsscript.json
!*.gs
!Index.html
```
(el `rootDir` de clasp es `src/`, así que `tools/` nunca sube.)
- [ ] **6.** `src/appsscript.json`:
```json
{
  "timeZone": "America/Mexico_City",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```
- [ ] **7.** `src/TestRunner.gs` (mismo contrato que PortalPromocion: `test(nombre, fn)`, `assertEq`, `assert`, `runAllTests()` devuelve fallas):
```js
var _PRUEBAS = [];
function test(nombre, fn) { _PRUEBAS.push({ nombre: nombre, fn: fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }
function assertEq(actual, esperado, msg) {
  var a = JSON.stringify(actual), e = JSON.stringify(esperado);
  if (a !== e) throw new Error((msg || 'distintos') + '\n  actual:   ' + a + '\n  esperado: ' + e);
}
function runAllTests() {
  var fallas = 0;
  _PRUEBAS.forEach(function (p) {
    try { p.fn(); } catch (e) { fallas++; Logger.log('FALLA ' + p.nombre + ': ' + e.message); }
  });
  Logger.log(_PRUEBAS.length + ' pruebas, ' + fallas + ' fallas');
  return fallas;
}
```
`src/Tests.gs` empieza vacío (`// Pruebas puras. Se agregan por tarea.`).
- [ ] **8.** `tools/run-tests.js`: copia de `PortalPromocion/tools/run-tests.js` con
`PUROS = ['TestRunner.gs','Boleto.gs','Catalogos.generado.gs','Catalogo.gs','Periodo.gs','Captura.gs','Sonda.gs','Xlsx.gs','Tests.gs']`
(los que no existen se saltan, igual que allá). Agregar al contexto `Utilities.formatDate` no hace falta.
- [ ] **9.** `package.json`: `{"private":true,"devDependencies":{"jszip":"^3.10.1"}}` y `npm install`.
- [ ] **10.** Correr pruebas → `0 pruebas, 0 fallas`. Commit `chore: esqueleto del capturador de Actividad Fisica`.

---

### Task 1: Xlsx.gs y prueba de fidelidad (la tarea que decide el enfoque)

**Goal:** Funciones puras que convierten la plantilla + datos en un `.xlsx` idéntico a la referencia.

**Files:** Create `src/Xlsx.gs`, `tools/hacer-plantilla.js`, `src/Plantilla.generado.gs`, `tools/fidelidad.js`, `tools/fidelidad.py`; Modify `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] Con los 7 renglones de agosto y las 6 fotos de la referencia, `fidelidad.py` no encuentra diferencias en: valores A7:M17, fórmulas del TOTAL, combinados, anchos, altos filas 1–17, fuentes/bordes de cada celda A1:M17, logos.
- [ ] El archivo abre en Excel sin aviso de reparación (COM, ver paso 8).
- [ ] Pruebas puras de `Xlsx.gs` pasan.

**Verify:** `node tools/run-tests.js && node tools/fidelidad.js && python tools/fidelidad.py` → `FIDELIDAD OK`

**Steps:**

- [ ] **1. Pruebas (en `Tests.gs`)** — fallan primero:
```js
test('serialExcel: 1 ago 2026 = 46235', function () {
  assertEq(serialExcel(2026, 8), 46235);
});
test('columnaLetra', function () {
  assertEq([columnaLetra(0), columnaLetra(12)], ['A', 'M']);
});
var _HOJA_MIN = '<worksheet><dimension ref="A1:M17"/><sheetData>' +
  '<row r="7" spans="1:13" ht="15"><c r="K7" s="7"><v>46235</v></c></row>' +
  '<row r="10" spans="1:13" ht="15.75" customHeight="1" thickBot="1"><c r="A10" s="12" t="s"><v>21</v></c><c r="B10" s="13"><v>1</v></c></row>' +
  '<row r="17" spans="1:13" ht="15.5"><c r="A17" s="10" t="s"><v>3</v></c><c r="B17" s="11"><f>SUM(B10:B16)</f><v>18</v></c></row>' +
  '</sheetData><mergeCells count="1"><mergeCell ref="A1:M1"/></mergeCells></worksheet>';
test('editarHoja: filas, total y fecha', function () {
  var filas = [
    { unidad: 'PLATEROS', valores: [1,9,13,0,0,0,0,0,0,0,0,0] },
    { unidad: 'A & B <x>', valores: [2,1,1,0,0,0,0,0,0,1,1,0] }
  ];
  var r = editarHoja(_HOJA_MIN, filas, 46266, []);
  assert(r.xml.indexOf('<c r="K7" s="7"><v>46266</v></c>') > 0, 'fecha');
  assert(r.xml.indexOf('<c r="A10" s="12" t="inlineStr"><is><t>PLATEROS</t></is></c>') > 0, 'unidad 1');
  assert(r.xml.indexOf('<t>A &amp; B &lt;x&gt;</t>') > 0, 'escapa');
  assert(r.xml.indexOf('<c r="B11" s="13"><v>2</v></c>') > 0, 'valor fila 11');
  assert(r.xml.indexOf('<row r="12" spans="1:13" ht="15.5">') > 0, 'total en 12');
  assert(r.xml.indexOf('<c r="B12" s="11"><f>SUM(B10:B11)</f><v>3</v></c>') > 0, 'suma B');
  assert(r.xml.indexOf('<c r="K12" s="11"><f>SUM(K10:K11)</f><v>1</v></c>') > 0, 'suma K');
  assert(r.xml.indexOf('<dimension ref="A1:M12"/>') > 0, 'dimension');
  assertEq(r.filaTotal, 12);
});
test('editarHoja: sin unidades deja TOTAL en 10 con ceros', function () {
  var r = editarHoja(_HOJA_MIN, [], 46235, []);
  assert(r.xml.indexOf('<c r="B10" s="11"><f>SUM(B10:B9)</f>') === -1, 'rango invertido');
  assert(r.xml.indexOf('<c r="B10" s="11"><v>0</v></c>') > 0, 'cero sin formula');
});
test('editarHoja: etiquetas de fotos', function () {
  var r = editarHoja(_HOJA_MIN, [], 46235, [{ fila: 14, texto: 'PLATEROS' }]);
  assert(r.xml.indexOf('<row r="14"><c r="A14" s="12" t="inlineStr"><is><t>PLATEROS</t></is></c></row>') > 0);
});
test('acomodoDeFotos: grupos por unidad, 3 por renglón', function () {
  var fotos = [
    { unidad: 'U1', ancho: 1280, alto: 960 }, { unidad: 'U1', ancho: 960, alto: 1280 },
    { unidad: 'U2', ancho: 1280, alto: 960 }
  ];
  var a = acomodoDeFotos(fotos, 12);           // total en fila 12 → fotos desde 14
  assertEq(a.etiquetas, [{ fila: 14, texto: 'U1' }, { fila: 29, texto: 'U2' }]);
  assertEq(a.anclas[0].fila0, 14);              // 0-based: debajo de la etiqueta (fila 15 en Excel)
  assertEq(a.anclas[0].cy, ALTO_FOTO_EMU);
  assertEq(a.anclas[0].cx, Math.round(ALTO_FOTO_EMU * 1280 / 960));
  assert(a.anclas[1].x > a.anclas[0].x, 'segunda a la derecha');
  assertEq(a.anclas[2].fila0, 29);
});
test('agregarFotosAlDibujo: anclas, rels y tipo jpeg', function () {
  var dib = '<xdr:wsDr xmlns:xdr="x" xmlns:a="y"><xdr:oneCellAnchor/></xdr:wsDr>';
  var rels = '<Relationships xmlns="z"><Relationship Id="rId1" Type="t" Target="../media/image1.png"/></Relationships>';
  var tipos = '<Types xmlns="w"><Default Extension="png" ContentType="image/png"/></Types>';
  var r = agregarFotosAlDibujo(dib, rels, tipos, [{ fila0: 14, x: 0, cx: 100, cy: 50 }]);
  assert(r.dibujo.indexOf('r:embed="rIdF1"') > 0, 'embed');
  assert(r.dibujo.indexOf('<xdr:row>14</xdr:row>') > 0, 'fila');
  assert(r.rels.indexOf('Id="rIdF1"') > 0 && r.rels.indexOf('../media/foto1.jpeg') > 0, 'rel');
  assert(r.tipos.indexOf('Extension="jpeg"') > 0, 'jpeg');
  assertEq(r.medios, ['xl/media/foto1.jpeg']);
});
test('sinCalcChain', function () {
  var r = sinCalcChain(
    '<Types><Override PartName="/xl/calcChain.xml" ContentType="c"/></Types>',
    '<Relationships><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>',
    '<workbook><calcPr calcId="191029"/></workbook>');
  assert(r.tipos.indexOf('calcChain') === -1 && r.rels.indexOf('calcChain') === -1, 'fuera');
  assert(r.libro.indexOf('<calcPr calcId="191029" fullCalcOnLoad="1"/>') > 0, 'recalcula');
});
test('nombreDelColateral', function () {
  assertEq(nombreDelColateral(2026, 8), '08 COLATERAL DE AF 2026 - AGOSTO.xlsx');
});
```

- [ ] **2.** `node tools/run-tests.js` → fallan por funciones no definidas.

- [ ] **3. `src/Xlsx.gs`:**
```js
// Arma el colateral editando el XML del .xlsx original. Todo es texto → texto:
// lo que no se toca (estilos, tema, combinados, logos, impresión) sale igual.
// Contrato con la plantilla (tools/hacer-plantilla.js): fila 10 = prototipo de
// datos (A s=12, B..M s=13); la última fila de sheetData = prototipo de TOTAL.

var COLUMNAS_AF = 13;                 // A..M
var FILA_PRIMERA_AF = 10;
var ALTO_FOTO_EMU = 2286000;          // 6 cm
var SEPARACION_EMU = 114300;          // 3 mm
var ANCHO_UTIL_EMU = 15811500;        // hasta la columna L, donde está el logo derecho
var ALTO_FILA_EMU = 184150;           // 14.5 pt (defaultRowHeight de la hoja)
var MESES_AF = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO',
                'SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function serialExcel(anio, mes) {
  return Math.round((Date.UTC(anio, mes - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000);
}

function columnaLetra(i) { return String.fromCharCode(65 + i); }

function escaparXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;');
}

function _fila(xml, n) {
  var m = xml.match(new RegExp('<row r="' + n + '"[^>]*>[\\s\\S]*?</row>'));
  return m ? m[0] : null;
}

function _atributosFila(filaXml) { return filaXml.match(/^<row r="\d+"([^>]*)>/)[1]; }

function _estilo(filaXml, col) {
  var m = filaXml.match(new RegExp('<c r="' + col + '\\d+" s="(\\d+)"'));
  return m ? m[1] : null;
}

function _celdaTexto(ref, s, texto) {
  return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t>' + escaparXml(texto) + '</t></is></c>';
}

// filas: [{unidad, valores:[12 enteros]}]; etiquetas: [{fila, texto}] (1-based)
function editarHoja(xml, filas, serialFecha, etiquetas) {
  var proto = _fila(xml, FILA_PRIMERA_AF);
  var filasXml = xml.match(/<row r="\d+"[^>]*>[\s\S]*?<\/row>/g);
  var protoTotal = filasXml[filasXml.length - 1];
  var attrDato = _atributosFila(proto), attrTotal = _atributosFila(protoTotal);
  var sA = _estilo(proto, 'A'), sN = _estilo(proto, 'B');
  var sTA = _estilo(protoTotal, 'A'), sTN = _estilo(protoTotal, 'B');
  var textoTotal = protoTotal.match(/<c r="A\d+"[^>]*>[\s\S]*?<\/c>/)[0];

  var cabeza = xml.slice(0, xml.indexOf(proto));   // filas 1..9 intactas
  cabeza = cabeza.replace(/(<c r="K7"[^>]*>)<v>[^<]*<\/v>/, '$1<v>' + serialFecha + '</v>');

  var cuerpo = filas.map(function (f, i) {
    var n = FILA_PRIMERA_AF + i;
    var celdas = _celdaTexto('A' + n, sA, f.unidad);
    for (var c = 0; c < 12; c++) {
      celdas += '<c r="' + columnaLetra(c + 1) + n + '" s="' + sN + '"><v>' + Number(f.valores[c]) + '</v></c>';
    }
    return '<row r="' + n + '"' + attrDato + '>' + celdas + '</row>';
  }).join('');

  var nT = FILA_PRIMERA_AF + filas.length;
  var total = '<row r="' + nT + '"' + attrTotal + '>' +
    textoTotal.replace(/r="A\d+"/, 'r="A' + nT + '"');
  for (var c = 0; c < 12; c++) {
    var L = columnaLetra(c + 1);
    var suma = filas.reduce(function (s, f) { return s + Number(f.valores[c]); }, 0);
    total += filas.length
      ? '<c r="' + L + nT + '" s="' + sTN + '"><f>SUM(' + L + FILA_PRIMERA_AF + ':' + L + (nT - 1) + ')</f><v>' + suma + '</v></c>'
      : '<c r="' + L + nT + '" s="' + sTN + '"><v>0</v></c>';
  }
  total += '</row>';

  var extra = (etiquetas || []).map(function (e) {
    return '<row r="' + e.fila + '">' + _celdaTexto('A' + e.fila, sA, e.texto) + '</row>';
  }).join('');

  var finSheetData = xml.indexOf('</sheetData>');
  var salida = cabeza + cuerpo + total + extra + xml.slice(finSheetData);
  var ultima = (etiquetas && etiquetas.length) ? etiquetas[etiquetas.length - 1].fila : nT;
  salida = salida.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:M' + Math.max(ultima, nT) + '"/>');
  return { xml: salida, filaTotal: nT };
}

// fotos en el orden de la tabla: [{unidad, ancho, alto}]. Devuelve las anclas
// (fila0 = fila 0-based de la esquina, x = desplazamiento EMU desde la col A)
// y la fila de etiqueta (1-based) de cada unidad.
function acomodoDeFotos(fotos, filaTotal) {
  var filasPorFoto = Math.ceil(ALTO_FOTO_EMU / ALTO_FILA_EMU) + 1;
  var anclas = [], etiquetas = [];
  var fila = filaTotal + 2, x = 0, actual = null, abierto = false;
  fotos.forEach(function (f) {
    var cx = Math.round(ALTO_FOTO_EMU * f.ancho / f.alto);
    if (f.unidad !== actual) {
      if (abierto) fila += filasPorFoto + 1;
      etiquetas.push({ fila: fila, texto: f.unidad });
      actual = f.unidad; x = 0; abierto = true;
    } else if (x + cx > ANCHO_UTIL_EMU) {
      fila += filasPorFoto; x = 0;
    }
    anclas.push({ fila0: fila, x: x, cx: cx, cy: ALTO_FOTO_EMU });
    x += cx + SEPARACION_EMU;
  });
  return { anclas: anclas, etiquetas: etiquetas };
}

function _anclaFoto(a, i) {
  var id = 100 + i;
  return '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>' + a.x + '</xdr:colOff>' +
    '<xdr:row>' + a.fila0 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
    '<xdr:ext cx="' + a.cx + '" cy="' + a.cy + '"/><xdr:pic><xdr:nvPicPr>' +
    '<xdr:cNvPr id="' + id + '" name="Foto ' + (i + 1) + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>' +
    '</xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdF' + (i + 1) + '"/>' +
    '<a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/>' +
    '<a:ext cx="' + a.cx + '" cy="' + a.cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>' +
    '</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';
}

function agregarFotosAlDibujo(dibujo, rels, tipos, anclas) {
  var medios = [];
  var nuevasAnclas = anclas.map(_anclaFoto).join('');
  var nuevasRels = anclas.map(function (_a, i) {
    medios.push('xl/media/foto' + (i + 1) + '.jpeg');
    return '<Relationship Id="rIdF' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/foto' + (i + 1) + '.jpeg"/>';
  }).join('');
  if (anclas.length && tipos.indexOf('Extension="jpeg"') === -1) {
    tipos = tipos.replace(/(<Types[^>]*>)/, '$1<Default Extension="jpeg" ContentType="image/jpeg"/>');
  }
  return {
    dibujo: dibujo.replace('</xdr:wsDr>', nuevasAnclas + '</xdr:wsDr>'),
    rels: rels.replace('</Relationships>', nuevasRels + '</Relationships>'),
    tipos: tipos, medios: medios
  };
}

function sinCalcChain(tipos, relsLibro, libro) {
  return {
    tipos: tipos.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''),
    rels: relsLibro.replace(/<Relationship [^>]*relationships\/calcChain"[^>]*\/>/, ''),
    libro: libro.replace(/<calcPr([^>]*?)\s*\/>/, function (_m, attrs) {
      return '<calcPr' + attrs.replace(/\s*fullCalcOnLoad="[^"]*"/, '') + ' fullCalcOnLoad="1"/>';
    })
  };
}

function nombreDelColateral(anio, mes) {
  return '08 COLATERAL DE AF ' + anio + ' - ' + MESES_AF[mes - 1] + '.xlsx';
}

// archivos: { ruta: textoXml } con las 6 partes que se editan. Devuelve las
// partes nuevas, las rutas de medios en el orden de `fotos` y lo que se borra.
function armarColateral(archivos, filas, fotos, anio, mes) {
  var serial = serialExcel(anio, mes);
  var h1 = editarHoja(archivos['xl/worksheets/sheet1.xml'], filas, serial, []);
  var ac = acomodoDeFotos(fotos, h1.filaTotal);
  var hoja = editarHoja(archivos['xl/worksheets/sheet1.xml'], filas, serial, ac.etiquetas);
  var d = agregarFotosAlDibujo(archivos['xl/drawings/drawing1.xml'],
                               archivos['xl/drawings/_rels/drawing1.xml.rels'],
                               archivos['[Content_Types].xml'], ac.anclas);
  var sc = sinCalcChain(d.tipos, archivos['xl/_rels/workbook.xml.rels'], archivos['xl/workbook.xml']);
  var salida = {};
  salida['xl/worksheets/sheet1.xml'] = hoja.xml;
  salida['xl/drawings/drawing1.xml'] = d.dibujo;
  salida['xl/drawings/_rels/drawing1.xml.rels'] = d.rels;
  salida['[Content_Types].xml'] = sc.tipos;
  salida['xl/_rels/workbook.xml.rels'] = sc.rels;
  salida['xl/workbook.xml'] = sc.libro;
  return { partes: salida, medios: d.medios, borrar: ['xl/calcChain.xml'] };
}

var PARTES_EDITABLES_AF = ['xl/worksheets/sheet1.xml', 'xl/drawings/drawing1.xml',
  'xl/drawings/_rels/drawing1.xml.rels', '[Content_Types].xml',
  'xl/_rels/workbook.xml.rels', 'xl/workbook.xml'];
```
**Nota del implementador:** el `colOff` puede exceder el ancho de la columna A: Excel lo acepta en un `oneCellAnchor`
(lo resuelve recorriendo columnas). Si la prueba de fidelidad (paso 8) muestra las fotos
amontonadas en A, convertir `x` a `col`+`colOff` con los anchos de `<cols>` (px = ancho×7+5,
EMU = px×9525) antes de seguir.

- [ ] **4.** Pruebas pasan: `node tools/run-tests.js`.

- [ ] **5. `tools/hacer-plantilla.js`** — lee `referencia/…xlsx` con jszip y escribe la plantilla:
  - `drawing1.xml`: deja solo los dos `<xdr:oneCellAnchor>` (logos); quita los `<xdr:twoCellAnchor …>…</xdr:twoCellAnchor>`.
  - `drawing1.xml.rels`: deja solo `rId1` y `rId2`; borra `xl/media/image3..8.png`.
  - Sin tocar nada más (filas 10–17 quedan: fila 10 = prototipo, 17 = prototipo de TOTAL).
  - Escribe `salida/COLATERAL_AF_PLANTILLA.xlsx` y `src/Plantilla.generado.gs`:
    `/* GENERADO por tools/hacer-plantilla.js — NO EDITAR */\nvar PLANTILLA_AF_B64 = '<base64>';`
  - Imprime el tamaño (esperado < 80 KB de base64).

- [ ] **6. `tools/fidelidad.js`** — carga `Xlsx.gs` en `vm`, abre la plantilla generada con jszip, lee
  las 6 fotos de la referencia (`image3..8.png`, con sus px de `twoCellAnchor`/`a:ext` → ancho/alto),
  arma agosto con las 7 filas de la referencia (leídas de su `sheet1.xml` + `sharedStrings.xml`),
  con la foto `i` asignada a la unidad `i % 7`. Las fotos de la referencia son PNG: después de
  `armarColateral`, `fidelidad.js` cambia `foto(\d+)\.jpeg` → `foto$1.png` en la rels del dibujo y en
  `medios` (el tipo `png` ya está en `[Content_Types].xml`) y escribe esos bytes. En producción las
  fotos siempre son JPEG del teléfono. Escribe `salida/FIDELIDAD_AGOSTO.xlsx`.

- [ ] **7. `tools/fidelidad.py`** (openpyxl): compara `salida/FIDELIDAD_AGOSTO.xlsx` contra la referencia
  celda por celda en A1:M17 — `value` (las fórmulas del TOTAL deben ser `=SUM(B10:B16)`… en ambas;
  la referencia usa fórmula compartida, openpyxl la expande igual), `font.name/sz/b`, `border.*.style`,
  `alignment.horizontal/wrap_text`, `number_format`; `merged_cells`, `column_dimensions[*].width`,
  `row_dimensions[1..17].height`; que haya 2 + 6 imágenes. Imprime cada diferencia y al final
  `FIDELIDAD OK` o `N DIFERENCIAS` (sale con 1).

- [ ] **8. Prueba en Excel real** (PowerShell, Excel instalado):
```powershell
$x = New-Object -ComObject Excel.Application; $x.DisplayAlerts = $false
$wb = $x.Workbooks.Open((Resolve-Path 'salida\FIDELIDAD_AGOSTO.xlsx').Path, 0, $true, 5, '', '', $true, 2, '', $false, $false, 0, $false, $true, 0)
"{0} {1} {2}" -f $wb.Sheets(1).Range('A17').Text, $wb.Sheets(1).Range('D17').Text, $wb.Sheets(1).Shapes.Count
$wb.Close($false); $x.Quit()
```
  Esperado: `TOTAL 150 8`. `CorruptLoad=0` (xlNormalLoad): si el archivo necesitara reparación, `Open` falla.
  Además abrirlo a mano y mandar captura al usuario (SendUserFile) para que confirme a ojo.

- [ ] **9.** Commit `feat: el colateral se arma editando el xlsx original, con prueba de fidelidad`.
  (`salida/` está ignorada; `Plantilla.generado.gs` sí se versiona: el repo es privado.)

---

### Task 2: Catálogo y periodo

**Goal:** Unidades activas de una coordinación por id, y reglas de mes.

**Files:** Create `src/Catalogo.gs`, `src/Periodo.gs`; Modify `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] `unidadesDeCoordinacion('COOR01')` devuelve las unidades activas de CHIAUTLA en el orden del CSV.
- [ ] `mesPorDefecto` = mes anterior; desde el día 25, el mes en curso (enero → diciembre del año anterior).
- [ ] `periodoValido` rechaza lo que no sea año 2000–2100 y mes 1–12 enteros.

**Verify:** `node tools/run-tests.js`

**Steps:**
- [ ] **1. Pruebas:**
```js
test('unidadesDeCoordinacion: activas y en orden', function () {
  var u = unidadesDeCoordinacion('COOR01');
  assert(u.length > 0, 'hay');
  assertEq(u[0], { unidad_id: 'U001', nombre: 'SAN ANDRÉS CHIAUTLA', coordinacion_id: 'COOR01' });
  assert(u.every(function (x) { return x.coordinacion_id === 'COOR01'; }), 'solo la suya');
});
test('unidadesDeCoordinacion: desconocida → []', function () {
  assertEq(unidadesDeCoordinacion('NOPE'), []);
});
test('ordenDeUnidades: coordinación y luego catálogo', function () {
  var o = ordenDeUnidades();
  assert(o.U001 < o.U002, 'orden del csv');
});
test('mesPorDefecto', function () {
  assertEq(mesPorDefecto(new Date(2026, 8, 10)), { anio: 2026, mes: 8 });
  assertEq(mesPorDefecto(new Date(2026, 8, 25)), { anio: 2026, mes: 9 });
  assertEq(mesPorDefecto(new Date(2026, 0, 3)), { anio: 2025, mes: 12 });
});
test('periodoValido', function () {
  assertEq(periodoValido('2026', '8'), { anio: 2026, mes: 8 });
  assertEq([periodoValido(2026, 13), periodoValido('', 1), periodoValido(2026.5, 1)], [null, null, null]);
});
```
- [ ] **2. `src/Catalogo.gs`:**
```js
function _csv(texto) {
  var lineas = String(texto).split('\n');
  var cols = lineas[0].split(',');
  return lineas.slice(1).filter(Boolean).map(function (l) {
    var v = l.split(','), o = {};
    cols.forEach(function (c, i) { o[c] = v[i]; });
    return o;
  });
}

function unidadesDeCoordinacion(coordinacionId) {
  return _csv(CSV_UNIDADES).filter(function (u) {
    return u.coordinacion_id === coordinacionId && u.activo === 'TRUE';
  }).map(function (u) {
    return { unidad_id: u.unidad_id, nombre: u.nombre_unidad, coordinacion_id: u.coordinacion_id };
  });
}

function nombreDeCoordinacion(coordinacionId) {
  var c = _csv(CSV_COORDINACIONES).filter(function (x) { return x.coordinacion_id === coordinacionId; })[0];
  return c ? c.nombre : '';
}

// unidad_id → posición global: primero por `orden` de la coordinación, luego por el CSV.
function ordenDeUnidades() {
  var ordenCoord = {};
  _csv(CSV_COORDINACIONES).forEach(function (c) { ordenCoord[c.coordinacion_id] = Number(c.orden); });
  var lista = _csv(CSV_UNIDADES).map(function (u, i) {
    return { id: u.unidad_id, k: (ordenCoord[u.coordinacion_id] || 999) * 10000 + i };
  });
  lista.sort(function (a, b) { return a.k - b.k; });
  var r = {};
  lista.forEach(function (x, i) { r[x.id] = i; });
  return r;
}
```
(Si algún nombre de unidad contiene coma, el CSV generado ya lo evita; la prueba 1 lo cubre para COOR01.)
- [ ] **3. `src/Periodo.gs`:**
```js
function mesPorDefecto(hoy) {
  var a = hoy.getFullYear(), m = hoy.getMonth() + 1;
  if (hoy.getDate() >= 25) return { anio: a, mes: m };
  return m === 1 ? { anio: a - 1, mes: 12 } : { anio: a, mes: m - 1 };
}

function periodoValido(anio, mes) {
  if (String(anio).trim() === '' || String(mes).trim() === '') return null;
  var a = Number(anio), m = Number(mes);
  if (Math.floor(a) !== a || a < 2000 || a > 2100) return null;
  if (Math.floor(m) !== m || m < 1 || m > 12) return null;
  return { anio: a, mes: m };
}
```
- [ ] **4.** Pruebas pasan. Commit `feat: catalogo de unidades por coordinacion y reglas de periodo`.

---

### Task 3: Captura (validación, alertas, filas del colateral)

**Goal:** Reglas puras de una captura y orden de la tabla.

**Files:** Create `src/Captura.gs`; Modify `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] Rechaza campos faltantes, negativos, decimales y texto; acepta `'0'`.
- [ ] Alertas no bloqueantes de §3 del spec.
- [ ] `filasDelColateral` ordena por `ordenDeUnidades` y convierte a `{unidad, valores}`.

**Verify:** `node tools/run-tests.js`

**Steps:**
- [ ] **1. Pruebas:**
```js
function _cap(o) {
  var c = {}; CAMPOS_AF.forEach(function (k) { c[k] = 0; });
  for (var k in o) c[k] = o[k]; return c;
}
test('validarCaptura: ok y normaliza a número', function () {
  var r = validarCaptura(_cap({ ses_pob: '3', asis_pob_h: 2, asis_pob_m: 5 }));
  assertEq(r.ok, true); assertEq(r.valores.ses_pob, 3);
});
test('validarCaptura: faltante, negativo, decimal, texto', function () {
  var c = _cap({}); delete c.bici;
  assertEq(validarCaptura(c).errores, ['bici: falta']);
  assertEq(validarCaptura(_cap({ ses_pob: -1 })).errores, ['ses_pob: entero de 0 en adelante']);
  assertEq(validarCaptura(_cap({ ses_pob: 1.5 })).errores, ['ses_pob: entero de 0 en adelante']);
  assertEq(validarCaptura(_cap({ ses_pob: 'x' })).errores, ['ses_pob: entero de 0 en adelante']);
  assertEq(validarCaptura(_cap({ ses_pob: '' })).errores, ['ses_pob: falta']);
});
test('alertasDeCaptura', function () {
  assertEq(alertasDeCaptura(_cap({ ses_pob: 3 })), ['Sesiones con la población: hay actividad pero 0 asistentes.']);
  assertEq(alertasDeCaptura(_cap({ asis_bici_m: 4 })), ['Bicicleta: hay asistentes pero 0 actividades.']);
  assertEq(alertasDeCaptura(_cap({})), ['La unidad quedó toda en ceros.']);
  assertEq(alertasDeCaptura(_cap({ tall_pers: 1, asis_tall_h: 1 })), []);
});
test('filasDelColateral: orden de catálogo', function () {
  var capturas = [
    _cap({ unidad_id: 'U002', unidad: 'OCOPULCO', ses_pob: 1 }),
    _cap({ unidad_id: 'U001', unidad: 'SAN ANDRÉS CHIAUTLA', ses_pob: 2 })
  ];
  var f = filasDelColateral(capturas);
  assertEq(f[0].unidad, 'SAN ANDRÉS CHIAUTLA');
  assertEq(f[0].valores, [2,0,0,0,0,0,0,0,0,0,0,0]);
});
```
- [ ] **2. `src/Captura.gs`:**
```js
var CAMPOS_AF = ['ses_pob', 'asis_pob_h', 'asis_pob_m', 'tall_pers', 'asis_tall_h', 'asis_tall_m',
                 'pausa_pers', 'asis_pausa_h', 'asis_pausa_m', 'bici', 'asis_bici_h', 'asis_bici_m'];

// Cada actividad con sus asistentes H/M, para las alertas y la pantalla.
var GRUPOS_AF = [
  { nombre: 'Sesiones con la población', actividad: 'ses_pob', h: 'asis_pob_h', m: 'asis_pob_m' },
  { nombre: 'Talleres al personal', actividad: 'tall_pers', h: 'asis_tall_h', m: 'asis_tall_m' },
  { nombre: 'Pausa para la salud', actividad: 'pausa_pers', h: 'asis_pausa_h', m: 'asis_pausa_m' },
  { nombre: 'Bicicleta', actividad: 'bici', h: 'asis_bici_h', m: 'asis_bici_m' }
];

function validarCaptura(c) {
  var errores = [], valores = {};
  CAMPOS_AF.forEach(function (k) {
    var v = c ? c[k] : undefined;
    if (v === undefined || v === null || String(v).trim() === '') { errores.push(k + ': falta'); return; }
    var n = Number(v);
    if (!/^\d+$/.test(String(v).trim()) || !isFinite(n)) { errores.push(k + ': entero de 0 en adelante'); return; }
    valores[k] = n;
  });
  return errores.length ? { ok: false, errores: errores } : { ok: true, valores: valores };
}

function alertasDeCaptura(v) {
  var a = [];
  GRUPOS_AF.forEach(function (g) {
    var act = Number(v[g.actividad]), asis = Number(v[g.h]) + Number(v[g.m]);
    if (act > 0 && asis === 0) a.push(g.nombre + ': hay actividad pero 0 asistentes.');
    if (act === 0 && asis > 0) a.push(g.nombre + ': hay asistentes pero 0 actividades.');
  });
  var todo = CAMPOS_AF.reduce(function (s, k) { return s + Number(v[k]); }, 0);
  if (todo === 0) a.push('La unidad quedó toda en ceros.');
  return a;
}

// capturas: filas de CAPTURA_AF como objetos. → [{unidad_id, unidad, valores}]
function filasDelColateral(capturas) {
  var orden = ordenDeUnidades();
  return capturas.slice().sort(function (a, b) {
    return (orden[a.unidad_id] === undefined ? 1e9 : orden[a.unidad_id]) -
           (orden[b.unidad_id] === undefined ? 1e9 : orden[b.unidad_id]);
  }).map(function (c) {
    return { unidad_id: c.unidad_id, unidad: c.unidad,
             valores: CAMPOS_AF.map(function (k) { return Number(c[k]) || 0; }) };
  });
}
```
- [ ] **3.** Pruebas pasan. Commit `feat: validacion, alertas y orden del colateral`.

---

### Task 4: Sonda pura

**Goal:** `avanceAF` con el contrato de la fase 5.

**Files:** Create `src/Sonda.gs` (parte pura); Modify `src/Tests.gs`.

**Acceptance Criteria:**
- [ ] Sin unidades → `{ok:false, code:'SIN_UNIDADES'}`.
- [ ] `reportado` sale de `CIERRES_AF` (último estado de esa coordinación y mes = `CERRADO`).

**Verify:** `node tools/run-tests.js`

**Steps:**
- [ ] **1. Pruebas:**
```js
test('avanceAF: cerrado y conteo', function () {
  var cap = [{ anio: 2026, mes: 8, coordinacion_id: 'COOR01', unidad_id: 'U001' },
             { anio: 2026, mes: 7, coordinacion_id: 'COOR01', unidad_id: 'U002' }];
  var cie = [{ anio: 2026, mes: 8, coordinacion_id: 'COOR01', estado: 'CERRADO' }];
  var r = avanceAF('COOR01', cap, cie, 2026, 8);
  assertEq([r.ok, r.reportado, r.reportadas], [true, true, 1]);
  assert(r.unidades === unidadesDeCoordinacion('COOR01').length);
});
test('avanceAF: reabierto → pendiente', function () {
  var cie = [{ anio: 2026, mes: 8, coordinacion_id: 'COOR01', estado: 'CERRADO' },
             { anio: 2026, mes: 8, coordinacion_id: 'COOR01', estado: 'ABIERTO' }];
  assertEq(avanceAF('COOR01', [], cie, 2026, 8).reportado, false);
});
test('avanceAF: sin unidades', function () {
  assertEq(avanceAF('NOPE', [], [], 2026, 8), { ok: false, code: 'SIN_UNIDADES' });
});
test('estadoDeCierre: último manda', function () {
  var cie = [{ anio: 2026, mes: 8, coordinacion_id: 'COOR01', estado: 'CERRADO' }];
  assertEq(estadoDeCierre(cie, 'COOR01', 2026, 8), 'CERRADO');
  assertEq(estadoDeCierre(cie, 'COOR01', 2026, 9), 'ABIERTO');
});
```
- [ ] **2. `src/Sonda.gs`** (parte pura):
```js
var DESTINO_AF = 'actividad_fisica';
var DESTINO_SONDA_AF = 'sonda:actividad_fisica';

function _mismoPeriodo(f, coord, anio, mes) {
  return String(f.coordinacion_id) === coord && Number(f.anio) === anio && Number(f.mes) === mes;
}

// CIERRES_AF es una bitácora: la última fila de esa coordinación y mes manda.
function estadoDeCierre(cierres, coord, anio, mes) {
  var e = 'ABIERTO';
  cierres.forEach(function (f) { if (_mismoPeriodo(f, coord, anio, mes)) e = String(f.estado); });
  return e;
}

function avanceAF(coord, capturas, cierres, anio, mes) {
  var unidades = unidadesDeCoordinacion(coord);
  if (!unidades.length) return { ok: false, code: 'SIN_UNIDADES' };
  var reportadas = capturas.filter(function (f) { return _mismoPeriodo(f, coord, anio, mes); }).length;
  return { ok: true, reportado: estadoDeCierre(cierres, coord, anio, mes) === 'CERRADO',
           unidades: unidades.length, reportadas: reportadas };
}
```
- [ ] **3.** Pruebas pasan. Commit `feat: avance de actividad fisica para la sonda`.

---

### Task 5: Datos, Setup y API del servidor

**Goal:** Todo lo que toca Sheets/Drive/Cache, detrás de un token de sesión.

**Files:** Create `src/Datos.gs`, `src/Setup.gs`, `src/Api.gs`; Modify `src/Sonda.gs` (añadir `responderSonda_`).

**Acceptance Criteria:**
- [ ] Toda función sin `_` final valida el token (o `soloDueno_`) antes de hacer algo.
- [ ] Escribir en un mes `CERRADO` responde `{ok:false, code:'MES_CERRADO'}`.
- [ ] Las escrituras usan `LockService.getScriptLock()`.
- [ ] Una foto: solo JPEG (`/9j/` al inicio del base64), ≤ 1.5 MB, máximo 3 por unidad y mes, unidad ya capturada.

**Verify:** en el editor, `runAllTests()` y la verificación en vivo de la Task 9.

**Steps:**
- [ ] **1. `src/Datos.gs`:**
```js
var HOJAS_AF = {
  CAPTURA: ['id', 'anio', 'mes', 'coordinacion_id', 'coordinacion', 'unidad_id', 'unidad']
             .concat(CAMPOS_AF).concat(['usuario', 'actualizado']),
  FOTOS: ['foto_id', 'anio', 'mes', 'coordinacion_id', 'unidad_id', 'drive_id', 'ancho', 'alto', 'usuario', 'fecha'],
  CIERRES: ['anio', 'mes', 'coordinacion_id', 'estado', 'usuario', 'fecha'],
  AUDITORIA: ['fecha', 'usuario', 'accion', 'detalle']
};
var NOMBRE_HOJA_AF = { CAPTURA: 'CAPTURA_AF', FOTOS: 'FOTOS_AF', CIERRES: 'CIERRES_AF', AUDITORIA: 'AUDITORIA' };

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function libro_() { return SpreadsheetApp.openById(prop_('ID_HOJA')); }
function hoja_(clave) { return libro_().getSheetByName(NOMBRE_HOJA_AF[clave]); }

function leer_(clave) {
  var v = hoja_(clave).getDataRange().getValues();
  var cab = v[0];
  return v.slice(1).map(function (fila, i) {
    var o = { _fila: i + 2 }; cab.forEach(function (c, j) { o[c] = fila[j]; }); return o;
  });
}

function agregar_(clave, obj) {
  hoja_(clave).appendRow(HOJAS_AF[clave].map(function (c) { return obj[c] === undefined ? '' : obj[c]; }));
}

function reemplazarFila_(clave, fila, obj) {
  hoja_(clave).getRange(fila, 1, 1, HOJAS_AF[clave].length)
    .setValues([HOJAS_AF[clave].map(function (c) { return obj[c] === undefined ? '' : obj[c]; })]);
}

function borrarFila_(clave, fila) { hoja_(clave).deleteRow(fila); }

function auditar_(usuario, accion, detalle) {
  try { agregar_('AUDITORIA', { fecha: new Date(), usuario: usuario, accion: accion, detalle: detalle }); }
  catch (e) { console.error(e); }
}

// Solo la cuenta dueña, desde el editor o la hoja. En el web app anónimo
// getActiveUser() viene vacío, así que nadie de fuera pasa.
function soloDueno_() {
  var yo = Session.getActiveUser().getEmail();
  if (!yo || yo !== prop_('CORREO_DUENO')) throw new Error('Solo la cuenta dueña puede hacer esto.');
}
```
- [ ] **2. `src/Setup.gs`** — `configurarTodo()` (idempotente; se corre en el editor):
```js
function configurarTodo() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var dueno = Session.getEffectiveUser().getEmail();
  if (props.getProperty('CORREO_DUENO') && props.getProperty('CORREO_DUENO') !== dueno) {
    throw new Error('Esta configuración es de ' + props.getProperty('CORREO_DUENO'));
  }
  props.setProperty('CORREO_DUENO', dueno);
  props.setProperty('ID_HOJA', libro.getId());
  Object.keys(NOMBRE_HOJA_AF).forEach(function (k) {
    var h = libro.getSheetByName(NOMBRE_HOJA_AF[k]) || libro.insertSheet(NOMBRE_HOJA_AF[k]);
    if (h.getLastRow() === 0) { h.appendRow(HOJAS_AF[k]); h.setFrozenRows(1); }
  });
  if (!props.getProperty('ID_CARPETA_RAIZ')) {
    props.setProperty('ID_CARPETA_RAIZ', DriveApp.createFolder('Actividad Física').getId());
  }
  if (!props.getProperty('SECRETO_BOLETOS')) Logger.log('FALTA SECRETO_BOLETOS: instalarlo (el mismo de los hermanos).');
  Logger.log('listo: hoja ' + libro.getId() + ', carpeta ' + props.getProperty('ID_CARPETA_RAIZ'));
}
```
  (Se ejecuta desde el editor; queda expuesta a `google.script.run`, pero no borra nada y
  solo escribe propiedades con el correo de quien ejecuta el deployment → llamarla desde fuera
  no cambia el dueño gracias a la guarda. Aun así, añadir al inicio `if (!Session.getActiveUser().getEmail()) throw ...`.)
- [ ] **3. `src/Api.gs`:**
```js
var VIDA_SESION_S = 21600;   // 6 h, el máximo de CacheService

function secretoAF_() {
  var s = prop_('SECRETO_BOLETOS');
  if (!s) throw new Error('SIN_SECRETO');
  return s;
}

function sesion_(token) {
  var t = token && CacheService.getScriptCache().get('s:' + token);
  if (!t) throw { code: 'SIN_SESION', msg: 'Su sesión terminó. Vuelva a entrar desde el portal.' };
  return JSON.parse(t);
}

// Envoltura de todas las funciones públicas: errores conocidos → {ok:false, code, msg};
// los demás → mensaje genérico y detalle en el registro.
function responder_(fn) {
  try { return fn(); }
  catch (e) {
    if (e && e.code) return { ok: false, code: e.code, msg: e.msg };
    console.error(e);
    return { ok: false, code: 'ERROR_INTERNO', msg: 'Algo falló. Intente de nuevo.' };
  }
}

function conCandado_(fn) {
  var l = LockService.getScriptLock(); l.waitLock(20000);
  try { return fn(); } finally { l.releaseLock(); }
}

function periodo_(anio, mes) {
  var p = periodoValido(anio, mes);
  if (!p) throw { code: 'PERIODO_INVALIDO', msg: 'Mes no válido.' };
  return p;
}

function abierto_(s, p) {
  if (estadoDeCierre(leer_('CIERRES'), s.c, p.anio, p.mes) === 'CERRADO') {
    throw { code: 'MES_CERRADO', msg: 'Este mes ya se terminó. Pida a la jurisdicción que lo reabra.' };
  }
}

function unidadPropia_(s, unidadId) {
  var u = unidadesDeCoordinacion(s.c).filter(function (x) { return x.unidad_id === unidadId; })[0];
  if (!u) throw { code: 'UNIDAD_AJENA', msg: 'Esa unidad no es de su coordinación.' };
  return u;
}

function entrar(boleto) {
  return responder_(function () {
    var v = verificarBoleto(boleto, secretoAF_(), DESTINO_AF, Date.now());
    if (!v.ok) return { ok: false, code: v.code, msg: 'Entre desde el portal de Promoción.' };
    if (!unidadesDeCoordinacion(v.coordinacion_id).length) {
      return { ok: false, code: 'SIN_UNIDADES', msg: 'Su coordinación no tiene unidades en el catálogo.' };
    }
    var token = Utilities.getUuid();
    var s = { c: v.coordinacion_id, n: v.nombre || nombreDeCoordinacion(v.coordinacion_id), u: v.usuario };
    CacheService.getScriptCache().put('s:' + token, JSON.stringify(s), VIDA_SESION_S);
    return { ok: true, token: token, coordinacion: s.n, porDefecto: mesPorDefecto(new Date()) };
  });
}

function estadoDelMes(token, anio, mes) {
  return responder_(function () {
    var s = sesion_(token), p = periodo_(anio, mes);
    var caps = leer_('CAPTURA').filter(function (f) { return _mismoPeriodo(f, s.c, p.anio, p.mes); });
    var fotos = leer_('FOTOS').filter(function (f) { return _mismoPeriodo(f, s.c, p.anio, p.mes); });
    var porUnidad = {};
    caps.forEach(function (c) {
      var o = { capturada: true }; CAMPOS_AF.forEach(function (k) { o[k] = Number(c[k]); });
      porUnidad[c.unidad_id] = o;
    });
    fotos.forEach(function (f) {
      var o = porUnidad[f.unidad_id] = porUnidad[f.unidad_id] || { capturada: false };
      (o.fotos = o.fotos || []).push({ foto_id: f.foto_id, drive_id: f.drive_id });
    });
    return { ok: true, cerrado: estadoDeCierre(leer_('CIERRES'), s.c, p.anio, p.mes) === 'CERRADO',
             unidades: unidadesDeCoordinacion(s.c).map(function (u) {
               var d = porUnidad[u.unidad_id] || { capturada: false };
               return { unidad_id: u.unidad_id, nombre: u.nombre, capturada: !!d.capturada,
                        valores: d.capturada ? d : null, fotos: d.fotos || [] };
             }) };
  });
}

function guardarUnidad(token, anio, mes, unidadId, captura) {
  return responder_(function () {
    var s = sesion_(token), p = periodo_(anio, mes), u = unidadPropia_(s, unidadId);
    var v = validarCaptura(captura);
    if (!v.ok) return { ok: false, code: 'CAPTURA_INVALIDA', msg: v.errores.join('; ') };
    return conCandado_(function () {
      abierto_(s, p);
      var previa = leer_('CAPTURA').filter(function (f) {
        return Number(f.anio) === p.anio && Number(f.mes) === p.mes && f.unidad_id === unidadId;
      })[0];
      var fila = { id: previa ? previa.id : Utilities.getUuid(), anio: p.anio, mes: p.mes,
                   coordinacion_id: s.c, coordinacion: s.n, unidad_id: unidadId, unidad: u.nombre,
                   usuario: s.u, actualizado: new Date() };
      CAMPOS_AF.forEach(function (k) { fila[k] = v.valores[k]; });
      if (previa) reemplazarFila_('CAPTURA', previa._fila, fila); else agregar_('CAPTURA', fila);
      auditar_(s.u, 'guardarUnidad', p.anio + '-' + p.mes + ' ' + unidadId);
      return { ok: true, alertas: alertasDeCaptura(v.valores) };
    });
  });
}

function borrarUnidad(token, anio, mes, unidadId) {
  return responder_(function () {
    var s = sesion_(token), p = periodo_(anio, mes); unidadPropia_(s, unidadId);
    return conCandado_(function () {
      abierto_(s, p);
      var mismo = function (f) { return Number(f.anio) === p.anio && Number(f.mes) === p.mes && f.unidad_id === unidadId; };
      leer_('FOTOS').filter(mismo).reverse().forEach(function (f) {
        try { DriveApp.getFileById(f.drive_id).setTrashed(true); } catch (e) { console.error(e); }
        borrarFila_('FOTOS', f._fila);
      });
      leer_('CAPTURA').filter(mismo).reverse().forEach(function (f) { borrarFila_('CAPTURA', f._fila); });
      auditar_(s.u, 'borrarUnidad', p.anio + '-' + p.mes + ' ' + unidadId);
      return { ok: true };
    });
  });
}

var MAX_FOTOS_AF = 3, MAX_BYTES_FOTO_AF = 1572864;

function carpetaDe_(p, s, u) {
  var c = DriveApp.getFolderById(prop_('ID_CARPETA_RAIZ'));
  [p.anio + '-' + ('0' + p.mes).slice(-2), s.n, u.nombre].forEach(function (nombre) {
    var it = c.getFoldersByName(nombre);
    c = it.hasNext() ? it.next() : c.createFolder(nombre);
  });
  return c;
}

function subirFoto(token, anio, mes, unidadId, base64, ancho, alto) {
  return responder_(function () {
    var s = sesion_(token), p = periodo_(anio, mes), u = unidadPropia_(s, unidadId);
    if (typeof base64 !== 'string' || base64.indexOf('/9j/') !== 0) {
      return { ok: false, code: 'NO_ES_JPEG', msg: 'La foto no se pudo leer.' };
    }
    var bytes = Utilities.base64Decode(base64);
    if (bytes.length > MAX_BYTES_FOTO_AF) return { ok: false, code: 'FOTO_GRANDE', msg: 'La foto pesa demasiado.' };
    ancho = Number(ancho); alto = Number(alto);
    if (!(ancho > 0 && alto > 0 && ancho <= 4000 && alto <= 4000)) return { ok: false, code: 'FOTO_INVALIDA', msg: 'La foto no se pudo leer.' };
    return conCandado_(function () {
      abierto_(s, p);
      var mismo = function (f) { return Number(f.anio) === p.anio && Number(f.mes) === p.mes && f.unidad_id === unidadId; };
      if (!leer_('CAPTURA').some(mismo)) return { ok: false, code: 'SIN_CAPTURA', msg: 'Guarde primero los números de la unidad.' };
      if (leer_('FOTOS').filter(mismo).length >= MAX_FOTOS_AF) return { ok: false, code: 'MAX_FOTOS', msg: 'Ya hay 3 fotos.' };
      var id = Utilities.getUuid();
      var archivo = carpetaDe_(p, s, u).createFile(Utilities.newBlob(bytes, 'image/jpeg', id + '.jpg'));
      agregar_('FOTOS', { foto_id: id, anio: p.anio, mes: p.mes, coordinacion_id: s.c, unidad_id: unidadId,
                          drive_id: archivo.getId(), ancho: ancho, alto: alto, usuario: s.u, fecha: new Date() });
      return { ok: true, foto_id: id };
    });
  });
}

function borrarFoto(token, anio, mes, fotoId) {
  return responder_(function () {
    var s = sesion_(token), p = periodo_(anio, mes);
    return conCandado_(function () {
      abierto_(s, p);
      var f = leer_('FOTOS').filter(function (x) { return x.foto_id === fotoId && x.coordinacion_id === s.c; })[0];
      if (!f) return { ok: false, code: 'NO_EXISTE', msg: 'Esa foto ya no está.' };
      try { DriveApp.getFileById(f.drive_id).setTrashed(true); } catch (e) { console.error(e); }
      borrarFila_('FOTOS', f._fila);
      return { ok: true };
    });
  });
}

// Miniatura para la pantalla: el archivo no se comparte; se manda el base64.
function verFoto(token, fotoId) {
  return responder_(function () {
    var s = sesion_(token);
    var f = leer_('FOTOS').filter(function (x) { return x.foto_id === fotoId && x.coordinacion_id === s.c; })[0];
    if (!f) return { ok: false, code: 'NO_EXISTE', msg: 'Esa foto ya no está.' };
    return { ok: true, base64: Utilities.base64Encode(DriveApp.getFileById(f.drive_id).getBlob().getBytes()) };
  });
}

function terminarMes(token, anio, mes) {
  return responder_(function () {
    var s = sesion_(token), p = periodo_(anio, mes);
    return conCandado_(function () {
      abierto_(s, p);
      agregar_('CIERRES', { anio: p.anio, mes: p.mes, coordinacion_id: s.c, estado: 'CERRADO', usuario: s.u, fecha: new Date() });
      auditar_(s.u, 'terminarMes', p.anio + '-' + p.mes);
      return { ok: true };
    });
  });
}
```
- [ ] **4.** Añadir a `src/Sonda.gs`:
```js
function responderSonda_(par) {
  var json = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var v = verificarBoleto(par.sonda, secretoAF_(), DESTINO_SONDA_AF, Date.now());
    if (!v.ok) return json({ ok: false, code: v.code });
    var p = periodoValido(par.anio, par.mes);
    if (!p) return json({ ok: false, code: 'PERIODO_INVALIDO' });
    return json(avanceAF(v.coordinacion_id, leer_('CAPTURA'), leer_('CIERRES'), p.anio, p.mes));
  } catch (e) {
    console.error(e);
    return json({ ok: false, code: 'ERROR_INTERNO' });
  }
}
```
- [ ] **5.** `node tools/run-tests.js` sigue pasando (los archivos nuevos no están en `PUROS`, salvo `Sonda.gs`, que solo define funciones). Commit `feat: hojas, sesion por boleto y API de captura con fotos`.

---

### Task 6: Colateral (menú de la hoja) y doGet

**Goal:** Generar el `.xlsx` jurisdiccional desde la hoja y reabrir meses.

**Files:** Create `src/Colateral.gs`, `src/Web.gs`.

**Acceptance Criteria:**
- [ ] Menú «Actividad Física» con «Generar colateral del mes…» y «Reabrir mes de una coordinación…».
- [ ] El archivo queda en `Actividad Física/Colaterales/` con el nombre de `nombreDelColateral`, reemplazando el anterior del mismo mes.
- [ ] Avisa las coordinaciones sin cerrar y si el archivo pasa de 10 MB.

**Verify:** en vivo (Task 9).

**Steps:**
- [ ] **1. `src/Colateral.gs`:**
```js
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Actividad Física')
    .addItem('Generar colateral del mes…', 'menuGenerarColateral')
    .addItem('Reabrir mes de una coordinación…', 'menuReabrirMes')
    .addToUi();
}

function _pedirPeriodo_(ui) {
  var d = mesPorDefecto(new Date());
  var r = ui.prompt('Periodo', 'Año y mes (AAAA-MM). Enter = ' + d.anio + '-' + ('0' + d.mes).slice(-2), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  var t = r.getResponseText().trim();
  if (!t) return d;
  var m = t.match(/^(\d{4})-(\d{1,2})$/);
  return m ? periodoValido(m[1], m[2]) : null;
}

function menuGenerarColateral() {
  soloDueno_();
  var ui = SpreadsheetApp.getUi();
  var p = _pedirPeriodo_(ui);
  if (!p) return;
  var cierres = leer_('CIERRES');
  var caps = leer_('CAPTURA').filter(function (f) { return Number(f.anio) === p.anio && Number(f.mes) === p.mes; });
  var coordsCon = {};
  caps.forEach(function (c) { coordsCon[c.coordinacion_id] = c.coordinacion; });
  var sinCerrar = _csv(CSV_COORDINACIONES).filter(function (c) {
    return c.activo === 'TRUE' && estadoDeCierre(cierres, c.coordinacion_id, p.anio, p.mes) !== 'CERRADO';
  }).map(function (c) { return c.nombre; });
  if (sinCerrar.length) {
    var r = ui.alert('Faltan por terminar el mes', sinCerrar.join(', ') + '\n\n¿Generar de todos modos?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
  }
  var archivo = generarColateral_(p.anio, p.mes, caps);
  var mb = archivo.getSize() / 1048576;
  ui.alert('Colateral listo', archivo.getName() + ' (' + mb.toFixed(1) + ' MB)\n' + archivo.getUrl() +
           (mb > 10 ? '\n\nOjo: pasa de 10 MB.' : ''), ui.ButtonSet.OK);
}

function generarColateral_(anio, mes, caps) {
  var filas = filasDelColateral(caps);
  var orden = {}; filas.forEach(function (f, i) { orden[f.unidad_id] = i; });
  var fotosFilas = leer_('FOTOS').filter(function (f) {
    return Number(f.anio) === anio && Number(f.mes) === mes && orden[f.unidad_id] !== undefined;
  }).sort(function (a, b) { return orden[a.unidad_id] - orden[b.unidad_id]; });
  var nombreUnidad = {}; filas.forEach(function (f) { nombreUnidad[f.unidad_id] = f.unidad; });
  var fotos = fotosFilas.map(function (f) {
    return { unidad: nombreUnidad[f.unidad_id], ancho: Number(f.ancho), alto: Number(f.alto), drive_id: f.drive_id };
  });

  var partes = Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(PLANTILLA_AF_B64), 'application/zip'));
  var porRuta = {}; partes.forEach(function (b) { porRuta[b.getName()] = b; });
  var textos = {};
  PARTES_EDITABLES_AF.forEach(function (r) { textos[r] = porRuta[r].getDataAsString('UTF-8'); });
  var a = armarColateral(textos, filas, fotos, anio, mes);

  Object.keys(a.partes).forEach(function (r) {
    porRuta[r] = Utilities.newBlob(a.partes[r], 'application/xml', r);
  });
  a.borrar.forEach(function (r) { delete porRuta[r]; });
  a.medios.forEach(function (ruta, i) {
    porRuta[ruta] = DriveApp.getFileById(fotos[i].drive_id).getBlob().setName(ruta);
  });
  var orden2 = ['[Content_Types].xml'].concat(Object.keys(porRuta).filter(function (r) { return r !== '[Content_Types].xml'; }));
  var nombre = nombreDelColateral(anio, mes);
  var zip = Utilities.zip(orden2.map(function (r) { return porRuta[r].setName(r); }), nombre)
                     .setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  var raiz = DriveApp.getFolderById(prop_('ID_CARPETA_RAIZ'));
  var it = raiz.getFoldersByName('Colaterales');
  var carpeta = it.hasNext() ? it.next() : raiz.createFolder('Colaterales');
  var viejos = carpeta.getFilesByName(nombre);
  while (viejos.hasNext()) viejos.next().setTrashed(true);
  var archivo = carpeta.createFile(zip);
  auditar_(Session.getActiveUser().getEmail(), 'generarColateral', anio + '-' + mes + ' ' + filas.length + ' unidades, ' + fotos.length + ' fotos');
  return archivo;
}

function menuReabrirMes() {
  soloDueno_();
  var ui = SpreadsheetApp.getUi();
  var p = _pedirPeriodo_(ui);
  if (!p) return;
  var r = ui.prompt('Reabrir', 'Nombre de la coordinación (tal como aparece en el catálogo):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var buscado = r.getResponseText().trim().toUpperCase();
  var c = _csv(CSV_COORDINACIONES).filter(function (x) { return x.nombre.toUpperCase() === buscado; })[0];
  if (!c) { ui.alert('No encontré «' + buscado + '».'); return; }
  agregar_('CIERRES', { anio: p.anio, mes: p.mes, coordinacion_id: c.coordinacion_id, estado: 'ABIERTO',
                        usuario: Session.getActiveUser().getEmail(), fecha: new Date() });
  ui.alert(c.nombre + ' puede volver a capturar ' + p.anio + '-' + p.mes + '.');
}
```
  (`Utilities.zip` no tiene orden garantizado documentado; si Excel rechaza el archivo en la
  Task 9, es lo primero a revisar. Los nombres con `/` crean las carpetas del zip.)
- [ ] **2. `src/Web.gs`:**
```js
function doGet(e) {
  if (e && e.parameter && e.parameter.sonda) return responderSonda_(e.parameter);
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Actividad Física — Promoción de la Salud')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
```
- [ ] **3.** Commit `feat: menu para generar el colateral y reabrir meses`.

---

### Task 7: Pantalla (Index.html)

**Goal:** Captura en teléfono con la identidad visual de los hermanos.

**Files:** Create `src/Index.html`.

**Acceptance Criteria:**
- [ ] Lee `boleto` con `google.script.url.getLocation`; sin boleto → «Entre desde el portal de Promoción».
- [ ] Selector de mes (12 meses del año del periodo por defecto y el anterior), lista de unidades con estado, formulario por unidad en 4 tarjetas (actividad + H + M), fotos (máx. 3), guardar/borrar, «Terminar el mes» con confirmación, modo solo lectura si está cerrado.
- [ ] Las fotos se reducen en `<canvas>` a lado mayor 1280 px, `toDataURL('image/jpeg', 0.75)`; se envía sin el prefijo `data:image/jpeg;base64,`.
- [ ] Alertas de `guardarUnidad` se muestran sin bloquear; errores con `msg`.
- [ ] Usable a 360 px de ancho; inputs `inputmode="numeric"`.

**Verify:** en vivo (Task 9), en Android.

**Steps:**
- [ ] **1.** Tomar como base visual `PortalPromocion/web/estilos.css` (tokens de color, tipografía del sistema, tarjetas redondeadas, acabado tipo iOS) — copiar los tokens `:root` y las clases de tarjeta/botón en un `<style>` dentro de `Index.html`.
- [ ] **2.** Estructura: `#entrada` (mensaje), `#app` con cabecera (coordinación + `<select id="mes">`), `#lista` (una fila por unidad: nombre, «Capturada · 2 fotos» o «Sin capturar», botón), `#unidad` (hoja con los 4 grupos de `GRUPOS_AF` —replicar la lista en el cliente—, fotos con `<input type="file" accept="image/*">`, botones Guardar / Borrar unidad / Volver), pie con «Terminar el mes».
- [ ] **3.** Flujo JS:
```js
var S = { token: null, anio: 0, mes: 0, estado: null };
function llamar(fn, args) {
  return new Promise(function (ok, mal) {
    google.script.run.withSuccessHandler(ok).withFailureHandler(mal)[fn].apply(null, args);
  });
}
google.script.url.getLocation(function (loc) {
  var b = loc.parameter && loc.parameter.boleto;
  if (!b) return mostrarEntrada('Entre desde el portal de Promoción.');
  llamar('entrar', [b]).then(function (r) {
    if (!r.ok) return mostrarEntrada(r.msg);
    S.token = r.token; S.anio = r.porDefecto.anio; S.mes = r.porDefecto.mes;
    pintarCabecera(r.coordinacion); cargarMes();
  }, function () { mostrarEntrada('No se pudo conectar. Intente de nuevo.'); });
});
function reducir(archivo) {
  return new Promise(function (ok, mal) {
    var img = new Image();
    img.onload = function () {
      var k = Math.min(1, 1280 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok({ base64: c.toDataURL('image/jpeg', 0.75).split(',')[1], ancho: c.width, alto: c.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = function () { mal(new Error('no es imagen')); };
    img.src = URL.createObjectURL(archivo);
  });
}
```
  `cargarMes()` → `estadoDelMes`; `guardar()` → `guardarUnidad` y luego sube cada foto nueva con
  `subirFoto` (una por una; si una falla, se marca «no se subió, reintentar» junto a ella);
  `terminar()` → `confirm('¿Terminar ' + mes + '? Ya no podrá cambiar nada.')` → `terminarMes`.
  Cualquier respuesta `code === 'SIN_SESION'` → `mostrarEntrada(r.msg)`.
  Miniaturas de fotos guardadas: `verFoto` → `<img src="data:image/jpeg;base64,…">`.
- [ ] **4.** Commit `feat: pantalla de captura de actividad fisica`.

---

### Task 8: Despliegue del hermano y alta en la máscara

**Goal:** Hermano en producción y fila en `DESTINOS`.

**Files:** Modify `PortalPromocion/src/Setup.gs` (DESTINOS_CONOCIDOS), `PortalPromocion/src/Tests.gs` si hay prueba de `DESTINOS_CONOCIDOS`; memoria.

**Acceptance Criteria:**
- [ ] `clasp push` sin errores; deployment creado; `/exec?sonda=x&anio=2026&mes=8` responde `{"ok":false,"code":"BOLETO_INVALIDO"}`.
- [ ] `SECRETO_BOLETOS` instalado igual que en los hermanos (sin rotar).
- [ ] Repo privado `OscarOG23/isem-actividad-fisica` con push.
- [ ] Fila `actividad_fisica` en `DESTINOS_CONOCIDOS`; `node tools/run-tests.js` de PortalPromocion pasa.
- [ ] Bitácora de cambios drásticos actualizada con IDs y reversas.

**Steps:**
- [ ] **1.** Desde `ACTIVIDAD FISICA/`: `clasp login` ya está (cuenta comitepromociontex). `clasp create --type sheets --title "Actividad Física — Capturador" --rootDir src`; restaurar `src/appsscript.json` con `git checkout`; `clasp push --force`.
- [ ] **2.** Instalar secreto con instalador temporal `src/ZZ_Temporal.gs` (patrón de las fases anteriores): `function zzInstalar(){PropertiesService.getScriptProperties().setProperty('SECRETO_BOLETOS','<valor de ~/.config/mascara/SECRETO_BOLETOS>');}` — **nunca** se commitea (añadir a `.gitignore` antes de crearlo). El usuario corre en el editor, en este orden: `zzInstalar`, `configurarTodo`, `runAllTests` (autoriza permisos la primera vez). Luego borrar `ZZ_Temporal.gs` local y `clasp push --force`.
- [ ] **3.** `clasp create-deployment -d "fase 6"` → anotar el id. Probar la sonda con curl (esperado `BOLETO_INVALIDO`).
- [ ] **4.** `gh repo create OscarOG23/isem-actividad-fisica --private --source . --push`.
- [ ] **5.** En PortalPromocion (rama `fase-6-actividad-fisica`), agregar a `DESTINOS_CONOCIDOS`:
```js
  { destino_id: 'actividad_fisica', nombre: 'Reporte de Actividad Física', apartado: 'Reporte mensual',
    clase: 'HERMANO_CON_CONTRASENA',
    url: 'https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec',
    aplica_a: 'TODAS', param_identidad: '', valor_identidad: '', sonda: 'NATIVA', orden: 4, activo: 'TRUE' }
```
  pruebas, commit `feat: Actividad Fisica en los destinos conocidos`, merge a main, push, `clasp push --force`
  (HEAD de la máscara; su deployment de producción no cambia). El usuario corre `sembrarDestinosConocidos` en el editor de la máscara.
- [ ] **6.** Anotar en `cambios-drasticos-mascara.md` y `mascara-despliegue.md` (IDs, reversa: `activo = FALSE`).

---

### Task 9: Verificación en vivo y primer colateral

**Goal:** Probar de punta a punta y generar agosto.

**Acceptance Criteria:**
- [ ] Desde el portal, una coordinación entra sin contraseña, captura una unidad con 1 foto, ve las alertas, termina el mes y la máscara la pinta verde (tras la caché de 10 min o invalidándola).
- [ ] Un boleto alterado en la URL → pantalla «Entre desde el portal».
- [ ] Con agosto capturado (las 7 unidades de la referencia, lo captura el usuario o una prueba), «Generar colateral» produce el `.xlsx`; se descarga y `tools/fidelidad.py --contra <archivo>` no da diferencias en A1:M17; abre en Excel sin reparación.
- [ ] Borrar las capturas de prueba (o dejarlas si son reales, según diga el usuario).

**Steps:**
- [ ] **1.** Pedir al usuario que entre desde el portal con una coordinación y capture; revisar `AUDITORIA`.
- [ ] **2.** Generar el colateral desde el menú; descargarlo (Drive MCP `download_file_content`) y correr la verificación.
- [ ] **3.** Mandarle el archivo al usuario para que lo compare a ojo con el que manda a Toluca.
- [ ] **4.** Avisar que ya puede cerrar el formulario «Reporte de COLATERAL DE ACTIVIDAD FISICA».
