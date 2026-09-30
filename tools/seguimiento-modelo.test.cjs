const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const contexto = vm.createContext({});
const archivo = path.join(__dirname, '../src/SeguimientoModelo.gs');
if (fs.existsSync(archivo)) vm.runInContext(fs.readFileSync(archivo, 'utf8'), contexto);
function construir(datos) {
  assert.equal(typeof contexto.construirSeguimientoPreventivo, 'function', 'Falta el motor puro de seguimiento preventivo');
  return JSON.parse(JSON.stringify(contexto.construirSeguimientoPreventivo(datos)));
}
function base() {
  return { periodo: '2026-09', unidades: [{ id: 'CLUES1', nombre: 'Centro Uno', determinantes_id: 'INT1' }],
    determinantes: [{ anio: 2026, mes: 9, unidad_id: 'INT1', indicador_id: 'SUB039', talleres_programados: 8,
      talleres_alcanzados: 4, femenino: 12, masculino: 8, estatus: 'ENVIADO' }],
    evidencias: [{ anio: 2026, mes: 9, unidad_id: 'INT1', subtema_declarado: 'SUB039' }],
    escolar: [], fuentes: { nominal: [], cubos: [], sinba: [], comparacion: [], fuentes: [] },
    metas: [{ unidad_id: 'CLUES1', periodo: '2026-09', id_meta: '01.02.02.01', meta: 10, medida: 'SESIONES' }],
    disponibilidad: [{ fuente: 'DETERMINANTES', corte: '2026-09-30', estado: 'DISPONIBLE' }] };
}
function indicador(r, id) { return r.indicadores.find(x => x.id === id && x.unidad_id === 'CLUES1'); }
function pending(r, causa, id) { return r.pendientes.filter(x => x.causa === causa && (!id || x.id.endsWith('|' + id))); }
function cuestionario(total, extra) {
  return Object.assign({ periodo: '2026-09', unidad_id: 'CLUES1', instrumento: 'AUDIT', total, recurso_id: 'r1',
    recurso_nombre: 'Recurso conocido', estado: 'REVISION', corte: '2026-09-28' }, extra);
}
test('sesiones SUB039 aplican meta oficial compatible y conservan programación', () => {
  const r = construir(base()), i = indicador(r, 'ADICCIONES_SESIONES');
  assert.equal(i.valor, 4); assert.equal(i.programado, 8); assert.equal(i.meta, 10);
  assert.equal(i.porcentaje, 40); assert.equal(i.faltante, 6);
  assert.equal(indicador(r, 'ADICCIONES_ASISTENCIAS').valor, 20);
});
test('borrador conserva observación y excluye cumplimiento oficial', () => {
  const d = base(); d.determinantes[0].estatus = 'BORRADOR';
  const r = construir(d), i = indicador(r, 'ADICCIONES_SESIONES');
  assert.equal(i.valor, 4); assert.equal(i.estado, 'BORRADOR'); assert.equal(i.porcentaje, null); assert.equal(i.faltante, null);
  assert.equal(pending(r, 'FALTA_REPORTE', i.id).length, 1);
});
test('no convierte blancos desconocidos booleanos ni negativos en cero', () => {
  for (const v of ['', ' ', 'desconocido', true, -1, null, undefined]) {
    const d = base(); d.determinantes[0].talleres_alcanzados = v;
    const i = indicador(construir(d), 'ADICCIONES_SESIONES'); assert.equal(i.valor, null); assert.equal(i.porcentaje, null);
  }
  const d = base(); d.determinantes[0].talleres_alcanzados = 0;
  assert.equal(indicador(construir(d), 'ADICCIONES_SESIONES').valor, 0);
});
test('meta ausente cero o incompatible es no evaluable', () => {
  for (const metas of [[], [{ unidad_id: 'CLUES1', periodo: '2026-09', id_meta: '01.02.02.01', meta: 0, medida: 'SESIONES' }],
    [{ unidad_id: 'CLUES1', periodo: '2026-09', id_meta: '01.02.02.01', meta: 10, medida: 'PERSONAS' }]]) {
    const d = base(); d.metas = metas; const r = construir(d);
    assert.equal(indicador(r, 'ADICCIONES_SESIONES').porcentaje, null);
    assert.equal(pending(r, 'META_NO_DEFINIDA', 'ADICCIONES_SESIONES').length, 1);
  }
});
test('no duplica talleres cuando hay conflicto de filas del mismo mes', () => {
  const d = base(); d.determinantes.push(Object.assign({}, d.determinantes[0], { talleres_alcanzados: 7 }));
  const r = construir(d); assert.equal(indicador(r, 'ADICCIONES_SESIONES').valor, null);
  assert.equal(pending(r, 'CALIDAD_FUENTE', 'ADICCIONES_SESIONES').length, 1);
});
test('sin puente interno no atribuye actividad por nombre o coincidencia CLUES', () => {
  const d = base(); delete d.unidades[0].determinantes_id; d.determinantes[0].unidad_id = 'CLUES1';
  const r = construir(d); assert.equal(indicador(r, 'ADICCIONES_SESIONES').valor, null);
  assert.equal(pending(r, 'CALIDAD_FUENTE', 'ADICCIONES_SESIONES').length, 1);
});
test('fuente nominal prima sobre Cubos sin sumar alternativas', () => {
  const d = base(); d.fuentes.nominal = [cuestionario(5), cuestionario(3, { recurso_id: 'r2' })];
  d.fuentes.cubos = [cuestionario(100, { recurso_id: '' })];
  d.metas.push({ unidad_id: 'CLUES1', periodo: d.periodo, id_meta: 'DETECCIONES', meta: 20, medida: 'TAMIZAJES' });
  const i = indicador(construir(d), 'CUESTIONARIOS_AUDIT');
  assert.equal(i.valor, 8); assert.equal(i.fuente, 'NOMINAL'); assert.equal(i.porcentaje, null); assert.equal(i.meta, null);
});
test('nominal desconocido no cae a Cubos y nominal cero prevalece', () => {
  const d = base(); d.fuentes.nominal = [cuestionario(null)]; d.fuentes.cubos = [cuestionario(100)];
  assert.equal(indicador(construir(d), 'CUESTIONARIOS_AUDIT').valor, null);
  d.fuentes.nominal[0].total = 0; assert.equal(indicador(construir(d), 'CUESTIONARIOS_AUDIT').valor, 0);
  d.fuentes.nominal = []; const i = indicador(construir(d), 'CUESTIONARIOS_AUDIT');
  assert.equal(i.valor, 100); assert.equal(i.fuente, 'CUBOS');
});
test('recurso pendiente genera acción sin atribuir cifra a una persona', () => {
  const d = base(); d.fuentes.nominal = [cuestionario(7, { estado_fuente: 'RECURSO_PENDIENTE', recurso_nombre: 'SIN IDENTIDAD DEL RECURSO EN LA FUENTE' })];
  const r = construir(d); assert.equal(indicador(r, 'CUESTIONARIOS_AUDIT').valor, 7);
  assert.equal(pending(r, 'IDENTIDAD_RECURSO_PENDIENTE', 'CUESTIONARIOS_AUDIT').length, 1);
  assert.ok(!('recurso_nombre' in indicador(r, 'CUESTIONARIOS_AUDIT')));
});
test('SINBA conserva detecciones generales acumuladas y nunca las mensualiza', () => {
  const d = base(); d.fuentes.sinba = [{ periodo: '2026-01/2026-09', unidad_id: 'CLUES1', recurso_id: 'r1',
    medicion: 'DETECCIONES_GENERALES', total: 90, corte: '2026-09-30', inicio: '2026-01-01', fin: '2026-09-30' }];
  const i = indicador(construir(d), 'SINBA_DETECCIONES_GENERALES');
  assert.equal(i.valor, 90); assert.equal(i.medida, 'DETECCIONES_GENERALES_ACUMULADAS'); assert.equal(i.porcentaje, null);
  assert.match(i.nota, /2026-01/); assert.match(i.nota, /2026-09/);
});
test('escuelas cuentan CCT distintas y sesiones enviadas sin usar temas ni matrícula', () => {
  const d = base(); d.escolar = [
    { UNIDAD_ID: 'CLUES1', PERIODO: d.periodo, CCT: 'CCT1', TURNO: 'M', PROGRAMADAS: 3, REALIZADAS: 2, ALUMNOS: 10, DOCENTES: 1, PADRES: 0, ESTATUS: 'ENVIADO', EVIDENCIAS_JSON: '[{"id":"e1"}]', TEMAS_JSON: '[1,2,3]', MATRICULA: 999 },
    { UNIDAD_ID: 'CLUES1', PERIODO: d.periodo, CCT: 'CCT1', TURNO: 'V', PROGRAMADAS: 1, REALIZADAS: 1, ALUMNOS: 4, DOCENTES: 0, PADRES: 2, ESTATUS: 'ENVIADO', EVIDENCIAS_JSON: '[{"id":"e2"}]' },
    { UNIDAD_ID: 'CLUES1', PERIODO: d.periodo, CCT: 'CCT2', TURNO: 'M', PROGRAMADAS: 1, REALIZADAS: 9, ALUMNOS: 50, DOCENTES: 1, PADRES: 0, ESTATUS: 'BORRADOR', EVIDENCIAS_JSON: '[]' }];
  const r = construir(d); assert.equal(indicador(r, 'ESCUELAS_SESIONES').valor, 3);
  assert.equal(indicador(r, 'ESCUELAS_PLANTELES').valor, 1); assert.equal(indicador(r, 'ESCUELAS_ALUMNOS').valor, 14);
  assert.equal(indicador(r, 'ESCUELAS_PLANTELES').porcentaje, null);
  assert.match(indicador(r, 'ESCUELAS_SESIONES').nota, /revisión/i);
});
test('reporte falta y cero declarado tienen pendientes diferentes; evidencia es por SUB039', () => {
  const d = base(); d.determinantes[0].talleres_alcanzados = 0; d.evidencias = [];
  let r = construir(d); assert.equal(pending(r, 'FALTA_ACTIVIDAD', 'ADICCIONES_SESIONES').length, 1);
  assert.equal(pending(r, 'FALTA_REPORTE', 'ADICCIONES_SESIONES').length, 0);
  d.determinantes[0].talleres_alcanzados = 4; d.evidencias = [{ anio: 2026, mes: 9, unidad_id: 'INT1', subtema_declarado: 'SUB038' }];
  r = construir(d); assert.equal(pending(r, 'FALTA_EVIDENCIA', 'ADICCIONES_SESIONES').length, 1);
});
test('cortes parciales desconocidos y diferencias generan acciones de calidad', () => {
  const d = base(); d.fuentes.nominal = [cuestionario(5, { estado: 'CORTE_PARCIAL' })];
  d.fuentes.comparacion = [{ periodo: d.periodo, unidad_id: 'CLUES1', instrumento: 'AUDIT', nominal: 5, cubos: 9, estado: 'DIFERENCIA_OBSERVADA' }];
  let r = construir(d); assert.equal(pending(r, 'FUENTE_SIN_ACTUALIZAR', 'CUESTIONARIOS_AUDIT').length, 1);
  assert.equal(pending(r, 'DIFERENCIA_FUENTES', 'CUESTIONARIOS_AUDIT').length, 1);
  delete d.fuentes.nominal[0].corte; delete d.fuentes.nominal[0].estado;
  r = construir(d); assert.equal(indicador(r, 'CUESTIONARIOS_AUDIT').corte, null);
  assert.notEqual(indicador(r, 'CUESTIONARIOS_AUDIT').estado, 'ELEGIBLE');
});
test('identificadores son estables, salida es JSON y entradas no se modifican', () => {
  const d = base(), original = JSON.stringify(d), r1 = construir(d), r2 = construir(d);
  assert.equal(JSON.stringify(d), original); assert.deepEqual(r1, r2);
  assert.ok(r1.pendientes.every(p => p.id.startsWith('2026-09|CLUES1|' )));
  assert.equal(new Set(r1.pendientes.map(p => p.id)).size, r1.pendientes.length);
  assert.throws(() => construir(Object.assign(base(), { periodo: '2026-13' })), /Periodo/);
});
test('filtra otro periodo y otras unidades incluso en agregados de fuentes', () => {
  const d = base(); d.fuentes.nominal = [cuestionario(100, { periodo: '2026-08' }), cuestionario(200, { unidad_id: 'OTRA' })];
  d.determinantes.push(Object.assign({}, d.determinantes[0], { mes: 8, talleres_alcanzados: 100 }));
  const r = construir(d); assert.equal(indicador(r, 'CUESTIONARIOS_AUDIT').valor, null);
  assert.equal(indicador(r, 'ADICCIONES_SESIONES').valor, 4);
});
test('puente interno ambiguo no replica la misma producción en dos CLUES', () => {
  const d = base(); d.unidades.push({ id: 'CLUES2', nombre: 'Centro Dos', determinantes_id: 'INT1' });
  const r = construir(d); assert.equal(indicador(r, 'ADICCIONES_SESIONES').valor, null);
  assert.ok(r.indicadores.filter(i => i.id === 'ADICCIONES_SESIONES').every(i => i.valor === null));
  assert.equal(pending(r, 'CALIDAD_FUENTE', 'ADICCIONES_SESIONES').length, 2);
});
test('asistencias desconocidas generan revisión de calidad conservando sesiones conocidas', () => {
  const d = base(); d.determinantes[0].femenino = '';
  const r = construir(d); assert.equal(indicador(r, 'ADICCIONES_ASISTENCIAS').valor, null);
  assert.equal(indicador(r, 'ADICCIONES_SESIONES').valor, 4);
  assert.equal(pending(r, 'CALIDAD_FUENTE', 'ADICCIONES_ASISTENCIAS').length, 1);
});
test('no suma dos intervalos SINBA superpuestos', () => {
  const d = base(); d.fuentes.sinba = [
    { unidad_id: 'CLUES1', periodo: '2026-01/2026-09', medicion: 'DETECCIONES_GENERALES', recurso_id: 'r1', total: 90, corte: '2026-09-30' },
    { unidad_id: 'CLUES1', periodo: '2026-08/2026-09', medicion: 'DETECCIONES_GENERALES', recurso_id: 'r1', total: 20, corte: '2026-09-30' }];
  const r = construir(d); assert.equal(indicador(r, 'SINBA_DETECCIONES_GENERALES').valor, null);
  assert.equal(pending(r, 'CALIDAD_FUENTE', 'SINBA_DETECCIONES_GENERALES').length, 1);
});
test('disponibilidad parcial bloquea porcentaje oficial de sesiones enviadas', () => {
  const d = base(); d.disponibilidad[0].estado = 'CORTE_PARCIAL';
  const r = construir(d); assert.equal(indicador(r, 'ADICCIONES_SESIONES').valor, 4);
  assert.equal(indicador(r, 'ADICCIONES_SESIONES').porcentaje, null);
  assert.equal(pending(r, 'FUENTE_SIN_ACTUALIZAR', 'ADICCIONES_SESIONES').length, 1);
});
test('SINBA parcial conserva alerta de actualización y su intervalo acumulado', () => {
  const d = base(); d.fuentes.sinba = [{ unidad_id: 'CLUES1', periodo: '2026-01/2026-09',
    medicion: 'DETECCIONES_GENERALES', recurso_id: 'r1', total: 90, corte: '2026-09-28', estado: 'CORTE_PARCIAL',
    inicio: '2026-01-01', fin: '2026-09-28' }];
  const r = construir(d), i = indicador(r, 'SINBA_DETECCIONES_GENERALES');
  assert.equal(i.estado, 'CORTE_PARCIAL'); assert.equal(i.valor, 90);
  assert.equal(i.medida, 'DETECCIONES_GENERALES_ACUMULADAS'); assert.equal(i.porcentaje, null);
  assert.match(i.nota, /2026-01\/2026-09/);
  assert.equal(pending(r, 'FUENTE_SIN_ACTUALIZAR', i.id).length, 1);
});
test('SINBA con filas idénticas conserva revisión y pendiente de calidad', () => {
  const d = base(); d.fuentes.sinba = [{ unidad_id: 'CLUES1', periodo: '2026-01/2026-09',
    medicion: 'DETECCIONES_GENERALES', recurso_id: 'r1', total: 90, corte: '2026-09-30', estado: 'REVISAR_FILAS_IDENTICAS' }];
  const r = construir(d), i = indicador(r, 'SINBA_DETECCIONES_GENERALES');
  assert.equal(i.estado, 'REVISION'); assert.equal(i.valor, 90);
  assert.equal(i.medida, 'DETECCIONES_GENERALES_ACUMULADAS'); assert.equal(i.porcentaje, null);
  assert.match(i.nota, /2026-01\/2026-09/);
  assert.equal(pending(r, 'CALIDAD_FUENTE', i.id).length, 1);
});
function avanceOficial(extra) {
  return Object.assign({ unidad_id: 'CLUES1', periodo: '2026-09', id_meta: '01.02.02.02',
    avance: 12, estado_fuente: 'OK', corte: null }, extra);
}
function metaDetecciones(d, extra) {
  d.metas.push(Object.assign({ unidad_id: 'CLUES1', periodo: '2026-09', id_meta: '01.02.02.02', meta: 30, medida: 'Deteccion' }, extra));
}
test('detecciones oficiales preservan numerador propio observado y meta sin certificación de corte', () => {
  const d = base(); d.avances_oficiales = [avanceOficial()]; metaDetecciones(d);
  d.fuentes.nominal = [cuestionario(900)];
  const r = construir(d), i = indicador(r, 'DETECCIONES_META_OFICIAL');
  assert.ok(i); assert.equal(i.valor, 12); assert.equal(i.meta, 30); assert.equal(i.estado, 'REVISION');
  assert.equal(i.programa, 'DETECCIONES'); assert.equal(i.medida, 'DETECCIONES_POR_SUSTANCIA');
  assert.equal(i.fuente, 'EVALUADOR_CUBOS'); assert.equal(i.corte, null);
  assert.equal(i.porcentaje, null); assert.equal(i.faltante, null);
  assert.equal(indicador(r, 'CUESTIONARIOS_AUDIT').valor, 900);
  assert.equal(indicador(r, 'CUESTIONARIOS_AUDIT').meta, null);
  assert.equal(pending(r, 'FUENTE_SIN_ACTUALIZAR', i.id).length, 1);
});
test('sin fuente oficial no convierte cero ni cuestionarios en avance de detecciones', () => {
  for (const avances of [[], [avanceOficial({ estado_fuente: 'SIN_FUENTE', avance: 0 })]]) {
    const d = base(); d.avances_oficiales = avances; metaDetecciones(d); d.fuentes.nominal = [cuestionario(800)];
    const r = construir(d), i = indicador(r, 'DETECCIONES_META_OFICIAL');
    assert.ok(i); assert.equal(i.valor, null); assert.equal(i.meta, 30); assert.equal(i.porcentaje, null);
    assert.equal(pending(r, 'FUENTE_SIN_ACTUALIZAR', i.id).length, 1);
  }
});
test('cumplimiento oficial de detecciones requiere validación explícita y corte confirmado', () => {
  for (const extra of [{ estado_fuente: 'OK', corte: '2026-09-30' },
    { estado_fuente: 'VALIDADO', corte: null }, { estado_fuente: 'VALIDADO', corte: '2026-08-31' },
    { estado_fuente: 'VALIDADO', corte: '2026-09-10' }]) {
    const d = base(); d.avances_oficiales = [avanceOficial(extra)]; metaDetecciones(d);
    const i = indicador(construir(d), 'DETECCIONES_META_OFICIAL');
    assert.ok(i); assert.equal(i.porcentaje, null); assert.equal(i.faltante, null);
  }
  const d = base(); d.avances_oficiales = [avanceOficial({ estado_fuente: 'VALIDADO', corte: '2026-09-30' })]; metaDetecciones(d);
  const i = indicador(construir(d), 'DETECCIONES_META_OFICIAL');
  assert.ok(i); assert.equal(i.porcentaje, 40); assert.equal(i.faltante, 18);
});
test('avance oficial duplicado o desconocido exige calidad sin sumar filas', () => {
  for (const avances of [[avanceOficial(), avanceOficial({ avance: 8 })], [avanceOficial({ avance: '' })]]) {
    const d = base(); d.avances_oficiales = avances; metaDetecciones(d);
    const r = construir(d), i = indicador(r, 'DETECCIONES_META_OFICIAL');
    assert.ok(i); assert.equal(i.valor, null); assert.equal(i.porcentaje, null);
    assert.equal(pending(r, 'CALIDAD_FUENTE', i.id).length, 1);
  }
});
test('meta oficial de detecciones ausente cero o de otra medida es no evaluable', () => {
  for (const meta of [null, { meta: 0 }, { medida: 'CUESTIONARIOS' }]) {
    const d = base(); d.avances_oficiales = [avanceOficial({ estado_fuente: 'VALIDADO', corte: '2026-09-30' })];
    if (meta) metaDetecciones(d, meta);
    const r = construir(d), i = indicador(r, 'DETECCIONES_META_OFICIAL');
    assert.ok(i); assert.equal(i.porcentaje, null); assert.equal(i.faltante, null);
    assert.equal(pending(r, 'META_NO_DEFINIDA', i.id).length, 1);
  }
});
test('avance oficial respeta unidad periodo y definición aunque haya otros cortes', () => {
  const d = base(); d.avances_oficiales = [avanceOficial({ unidad_id: 'OTRA', avance: 100 }),
    avanceOficial({ periodo: '2026-08', avance: 200 }), avanceOficial({ id_meta: '01.02.02.01', avance: 300 }), avanceOficial({ avance: 0 })];
  metaDetecciones(d); const i = indicador(construir(d), 'DETECCIONES_META_OFICIAL');
  assert.ok(i); assert.equal(i.valor, 0); assert.equal(i.meta, 30);
});
