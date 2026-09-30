// Navegador real con respuestas ficticias; no consulta ni escribe en producción.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { chromium } = createRequire(path.resolve(root, '../DeterminantesConcentrado/package.json'))('playwright');
const fixture = {
  ok: true, periodo: '2026-09', usuario: { nombre: 'Prueba <script>', rol: 'ADMIN' },
  unidades: [{ id: 'U1', nombre: 'Unidad uno' }, { id: 'U2', nombre: 'Unidad dos' }],
  indicadores: [
    { id: 'I1', unidad_id: 'U1', unidad: 'Unidad uno', programa: 'Adicciones', nombre: 'Sesiones', medida: 'sesiones', valor: 0, programado: 5, meta: 10, porcentaje: 0, faltante: 10, estado: 'CERO_DECLARADO', fuente: 'Determinantes', corte: '2026-09-29' },
    { id: 'I2', unidad_id: 'U2', unidad: 'Unidad dos', programa: 'Escolar', nombre: 'Asistencias', medida: 'asistencias', valor: null, programado: null, meta: null, porcentaje: null, faltante: null, estado: 'SIN_REPORTE', fuente: 'Jornadas', corte: null },
    { id: 'I3', unidad_id: 'U1', unidad: 'Unidad uno', programa: 'Adicciones', nombre: '<img src=x onerror=alert(1)>', medida: 'cuestionarios', valor: 20, programado: null, meta: null, porcentaje: null, faltante: null, estado: 'EN_REVISION', fuente: 'Nominal', corte: '2026-09-28', nota: 'Corte parcial' }
  ],
  pendientes: [{ id: 'P1', unidad_id: 'U1', unidad: 'Unidad uno', programa: 'Adicciones', causa: 'FALTA_ACTIVIDAD', detalle: 'Revisar sesiones', responsable: '', comentario: '', fecha_compromiso: '', estado_atencion: 'ABIERTA', version: 3 }],
  fuentes: [{ fuente: 'Nominal', corte: '2026-09-28', estado: 'PARCIAL', detalle: 'Corte parcial' }]
};
async function run(scenario, options = {}) {
  assert.ok(fs.existsSync(path.join(root, 'web/seguimiento/index.html')), 'Falta crear la página de seguimiento');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const calls = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ session }) => {
    localStorage.clear();
    if (session) localStorage.setItem('mascara_boleto', 'boleto-ficticio');
  }, { session: options.session !== false });
  await page.route('https://seguimiento.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api') {
      const data = JSON.parse(route.request().postData()); calls.push(data);
      assert.match(route.request().headers()['content-type'], /^text\/plain/);
      const response = options.response ? await options.response(data, calls) : fixture;
      return route.fulfill({ json: response });
    }
    const relative = url.pathname === '/seguimiento/' ? 'seguimiento/index.html' : url.pathname.slice(1);
    let body = relative === 'config.js' ? "var ENDPOINT='https://seguimiento.test/api';" : fs.readFileSync(path.join(root, 'web', relative));
    if (relative.endsWith('.html')) body = body.toString().replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, '');
    return route.fulfill({ body, contentType: relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.png') ? 'image/png' : 'text/html' });
  });
  try {
    await page.goto('https://seguimiento.test/seguimiento/');
    await scenario(page, calls);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
test('sesión requerida: enlace de acceso y ninguna consulta', () => run(async (page, calls) => {
  await page.locator('#acceso-requerido').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#acceso-requerido a').getAttribute('href'), '../');
  assert.equal(calls.length, 0);
}, { session: false }));
test('consulta, cero/ausencia/revisión, texto seguro y filtros locales', () => run(async (page, calls) => {
  await page.locator('#indicadores tbody tr').nth(2).waitFor();
  assert.equal(calls[0].accion, 'seguimiento'); assert.equal(calls[0].boleto, 'boleto-ficticio');
  assert.match(calls[0].periodo, /^\d{4}-\d{2}$/);
  assert.match(await page.locator('#indicadores tbody tr').nth(0).innerText(), /Cero declarado/);
  assert.match(await page.locator('#indicadores tbody tr').nth(1).innerText(), /Sin dato/);
  assert.match(await page.locator('#indicadores tbody tr').nth(2).innerText(), /En revisión/);
  assert.equal(await page.locator('#indicadores tbody img').count(), 0);
  assert.match(await page.locator('#identidad').innerText(), /Prueba <script>/);
  assert.equal(await page.locator('#resumen-indicadores').innerText(), '3');
  await page.locator('#programa').selectOption('Escolar');
  assert.equal(await page.locator('#indicadores tbody tr').count(), 1);
  assert.equal(calls.length, 1, 'El filtro programa debe ser local');
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'La vista móvil desborda');
  assert.ok(await page.locator('#periodo').evaluate(el => el.getBoundingClientRect().height >= 44));
  assert.ok(await page.locator('#periodo').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
}));
test('guardar atención transmite versión y recarga tras conflicto', () => run(async (page, calls) => {
  const form = page.locator('#pendientes form'); await form.waitFor();
  await form.locator('[name=responsable]').fill('Equipo');
  await form.locator('[name=comentario]').fill('Se revisará la fuente');
  await form.locator('[name=fecha_compromiso]').fill('2026-10-03');
  await form.locator('[name=estado_atencion]').selectOption('EN_PROCESO');
  await form.locator('button').click();
  await page.waitForFunction(() => document.querySelector('#aviso').textContent.includes('Otra persona'));
  const save = calls.find(c => c.accion === 'atenderPreventivo');
  assert.equal(save.version, 3); assert.equal(save.unidad_id, 'U1'); assert.equal(save.pendiente_id, 'P1');
  assert.equal(save.responsable, 'Equipo'); assert.equal(save.estado_atencion, 'EN_PROCESO');
  assert.equal(calls.filter(c => c.accion === 'seguimiento').length, 2);
  assert.equal(await page.locator('#indicadores input').count(), 0);
}, { response: data => data.accion === 'atenderPreventivo' ? { ok: false, code: 'CONFLICTO', message: 'Otra persona actualizó este pendiente.' } : fixture }));
test('errores de API visibles y recuperación mediante recarga', () => run(async (page, calls) => {
  await page.waitForFunction(() => document.querySelector('#aviso').textContent.includes('Fuente no disponible'));
  assert.equal(await page.locator('#contenido').isVisible(), false);
  await page.locator('#actualizar').click();
  await page.locator('#indicadores tbody tr').nth(2).waitFor();
  assert.equal(calls.length, 2);
}, { response: (_, calls) => calls.length === 1 ? { ok: false, message: 'Fuente no disponible' } : fixture }));
test('filtros de unidad y mes consultan con el ámbito seleccionado', () => run(async (page, calls) => {
  await page.locator('#indicadores tbody tr').nth(2).waitFor();
  await page.locator('#unidad').selectOption('U2');
  await page.waitForFunction(() => !document.querySelector('#actualizar').disabled);
  assert.equal(calls[1].unidad_id, 'U2');
  assert.equal(await page.locator('#indicadores tbody tr').count(), 1);
  await page.locator('#periodo').fill('2026-08'); await page.locator('#periodo').dispatchEvent('change');
  await page.waitForFunction(() => document.querySelector('#periodo-vista').textContent.includes('agosto'));
  assert.equal(calls.at(-1).periodo, '2026-08'); assert.equal(calls.at(-1).unidad_id, 'U2');
  await page.setViewportSize({ width: 812, height: 375 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'La vista horizontal desborda');
}));
test('atención guardada recarga la versión sin alterar cifras', () => {
  let saved = false;
  return run(async (page, calls) => {
    const form = page.locator('#pendientes form'); await form.waitFor();
    await form.locator('[name=responsable]').fill('Equipo');
    await form.locator('[name=estado_atencion]').selectOption('ATENDIDA');
    await form.locator('button').click();
    await page.waitForFunction(() => document.querySelector('#aviso').textContent.includes('Atención guardada'));
    assert.equal(await page.locator('#resumen-pendientes').innerText(), '0');
    assert.equal(await page.locator('#pendientes [name=responsable]').inputValue(), 'Equipo');
    const save = calls.find(c => c.accion === 'atenderPreventivo');
    assert.equal(save.version, 3); assert.equal(save.boleto, 'boleto-ficticio');
    assert.equal(Object.hasOwn(save, 'valor'), false); assert.equal(Object.hasOwn(save, 'meta'), false);
    assert.match(await page.locator('#indicadores tbody tr').first().innerText(), /Cero declarado/);
  }, { response: data => {
    if (data.accion === 'atenderPreventivo') { saved = true; return { ok: true, version: 4 }; }
    return saved ? { ...fixture, pendientes: [{ ...fixture.pendientes[0], responsable: 'Equipo', estado_atencion: 'ATENDIDA', version: 4 }] } : fixture;
  } });
});
test('error al guardar conserva el comentario y permite reintentar', () => run(async page => {
  const form = page.locator('#pendientes form'); await form.waitFor();
  await form.locator('[name=comentario]').fill('Comentario que debe conservarse');
  await form.locator('button').click();
  await form.locator('.mensaje.error').waitFor();
  assert.match(await form.locator('.mensaje.error').innerText(), /No se pudo guardar/);
  assert.equal(await form.locator('[name=comentario]').inputValue(), 'Comentario que debe conservarse');
  assert.equal(await form.locator('button').isEnabled(), true);
}, { response: data => data.accion === 'atenderPreventivo' ? { ok: false, message: 'No se pudo guardar' } : fixture }));
test('filtrar programa conserva una atención todavía sin guardar', () => run(async page => {
  await page.locator('#pendientes form').waitFor();
  await page.locator('#pendientes [name=comentario]').fill('Compromiso sin guardar');
  await page.locator('#programa').selectOption('Escolar');
  await page.locator('#programa').selectOption('Adicciones');
  assert.equal(await page.locator('#pendientes [name=comentario]').inputValue(), 'Compromiso sin guardar');
}));
