'use strict';

// Pantalla del capturador de Atención. Es la de ATENCION/src/Index.html, pero
// servida desde GitHub Pages: en Android Chrome firmado con cuentas de Google,
// las páginas de script.google.com fallan («No se pudo abrir el archivo»).
// Habla con el Apps Script por POST (llamar); EXEC_ATENCION vive en config.js.

// ---------------------------------------------------------------- Datos fijos
// Réplica de Modelo.gs (TEMAS_PSI, ETIQUETAS, campos) y de los topes del servidor.
var TEMAS_PSI = [
  { id: 'ansiedad', nombre: 'Ansiedad' },
  { id: 'depresion', nombre: 'Depresión' },
  { id: 'demencias', nombre: 'Demencias (senil, Alzheimer, Parkinson, etc.)' },
  { id: 'epilepsia', nombre: 'Epilepsia' },
  { id: 'infantil', nombre: 'Psicopatología infantil y de la adolescencia' },
  { id: 'estres_postraumatico', nombre: 'Estrés postraumático' },
  { id: 'suicidio', nombre: 'Suicidio' },
  { id: 'violencia', nombre: 'Prevención de violencia' },
  { id: 'adicciones', nombre: 'Adicciones' },
  { id: 'otro', nombre: 'Otro tema' }
];
var ETIQUETAS = {
  consultas: 'Consultas de nutrición',
  orientaciones: 'Orientaciones alimentarias (sesiones)',
  box_lunch: 'Box lunch',
  consultas_total: 'Consultas individuales (total)',
  consultas_menores18: 'Consultas a menores de 18 años',
  consultas_60mas: 'Consultas a personas de 60 años y más',
  consultas_lgbtiq: 'Consultas a personas LGBTIQ+',
  hombres: 'Hombres',
  mujeres: 'Mujeres',
  edad_13_17: 'Adolescentes de 13 a 17 años',
  edad_18_21: 'Jóvenes de 18 a 21 años',
  edad_22_59: 'Adultos de 22 a 59 años',
  edad_60mas: 'Adultos mayores (60 años y más)',
  murales: 'Periódicos murales',
  folletos: 'Folletos',
  carteles: 'Carteles',
  tema_material: 'Tema del material informativo',
  otro_texto: 'Otro tema: cuál'
};
var CAMPOS_NUT = ['consultas', 'orientaciones', 'box_lunch'];
var CAMPOS_PSI_CONSULTA = ['consultas_total', 'consultas_menores18', 'consultas_60mas', 'consultas_lgbtiq'];
var SUBGRUPOS_PSI_CONSULTA = ['consultas_menores18', 'consultas_60mas', 'consultas_lgbtiq'];
var CAMPOS_POBLACION = ['hombres', 'mujeres', 'edad_13_17', 'edad_18_21', 'edad_22_59', 'edad_60mas'];
var CAMPOS_SEXO = ['hombres', 'mujeres'];
var CAMPOS_EDAD = ['edad_13_17', 'edad_18_21', 'edad_22_59', 'edad_60mas'];
var CAMPOS_MATERIAL_NUM = ['murales', 'folletos', 'carteles'];

var MAX_VALOR = 100000, MAX_TEXTO = 200;          // Modelo.gs
var MAX_EVIDENCIAS = 10;                          // Evidencia.gs
var MAX_BYTES = 8 * 1024 * 1024;                  // MAX_BYTES_EVIDENCIA: bytes ya decodificados
var META_FOTO = 1.5 * 1024 * 1024;                // una foto reducida debería quedar por debajo
// Escalera de compresión de fotos: lado mayor y calidad JPEG, de mejor a peor.
var PASOS_FOTO = [[1600, 0.8], [1600, 0.7], [1280, 0.7], [1280, 0.6], [1024, 0.6]];
var MES_MINIMO = 2025 * 12 + 1;                   // antes de enero de 2025 no se captura
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
             'septiembre', 'octubre', 'noviembre', 'diciembre'];
var MSG_RED = 'No se pudo conectar. Revise su señal e intente de nuevo.';
var MSG_ENTRE = 'Entre desde el portal de Promoción.';
var MSG_PDF_GRANDE = 'El PDF pesa más de 8 MB; divídalo o reduzca su calidad.';

// ---------------------------------------------------------------- Estado
var S = {
  token: null, boleto: null, rol: null, anio: 0, mes: 0, pedido: 0,
  datos: null,            // respuesta de informeDelMes del mes abierto
  sucio: false, ocupado: false, bloqueo: null,
  erroresServidor: [],    // los que devolvió el último guardado (por si difieren de los del teléfono)
  cola: [], subiendo: false
};

function $(id) { return document.getElementById(id); }
function mesTexto(anio, mes) { return MESES[mes - 1] + ' de ' + anio; }
function mesTitulo(anio, mes) { var t = mesTexto(anio, mes); return t.charAt(0).toUpperCase() + t.slice(1); }
function el(tag, attrs, hijos) {
  var e = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) {
    if (k === 'text') e.textContent = attrs[k];
    else if (k === 'class') e.className = attrs[k];
    else e.setAttribute(k, attrs[k]);
  });
  (hijos || []).forEach(function (h) { if (h) e.appendChild(h); });
  return e;
}
function icono(id) {
  var ns = 'http://www.w3.org/2000/svg';
  var s = document.createElementNS(ns, 'svg'); s.setAttribute('aria-hidden', 'true');
  var u = document.createElementNS(ns, 'use'); u.setAttribute('href', '#' + id);
  s.appendChild(u); return s;
}
function tamano(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
function enviado() { return !!(S.datos && S.datos.estado === 'ENVIADO'); }
// Solo lectura: enviado, o el servidor dijo que este informe no se puede escribir
// (ROL_CAMBIO: cambió su disciplina; PERIODO_ANTIGUO: mes anterior a 2025).
function soloLectura() { return enviado() || !!S.bloqueo; }
var CODIGOS_BLOQUEO = /^(ROL_CAMBIO|PERIODO_ANTIGUO)$/;
// Si la respuesta dice que el informe no se puede escribir, lo deja en solo lectura.
function bloqueado(r) {
  if (!(r && CODIGOS_BLOQUEO.test(r.code))) return false;
  S.bloqueo = r.msg || 'Este informe no se puede modificar.';
  S.sucio = false; S.cola = [];
  if (S.datos) pintarInforme();
  return true;
}

// Igual que google.script.run: se cumple con la respuesta del servidor (también
// {ok:false,...}) y se rechaza solo si no llegó una respuesta legible (sin red,
// se tardó de más, o no vino JSON): eso va por «No se pudo conectar».
// Content-Type text/plain A PROPÓSITO: con application/json el navegador manda
// antes un OPTIONS que Apps Script no contesta. doPost lee e.postData.contents.
var ESPERA_MS = 60000, ESPERA_SUBIDA_MS = 300000;
function llamar(fn, args) {
  var control = window.AbortController ? new AbortController() : null;
  var reloj = control ? setTimeout(function () { control.abort(); },
                                   fn === 'subirEvidencia' ? ESPERA_SUBIDA_MS : ESPERA_MS) : 0;
  return fetch(EXEC_ATENCION, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ accion: fn, args: args || [] }),
    redirect: 'follow',
    signal: control ? control.signal : undefined
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (r) {
    clearTimeout(reloj); return r;
  }, function (e) {
    clearTimeout(reloj); throw e;
  });
}

// La sesión se guarda en sessionStorage (solo esta pestaña) para sobrevivir a
// una recarga: el boleto se borra de la dirección al leerlo, y además puede
// haber vencido. Se anota junto con la cola del boleto (su firma, que sola no
// sirve para entrar) para no usar la sesión de otro boleto. El prefijo
// 'atencion:' evita chocar con lo que guarda el portal en el mismo dominio.
// Si el navegador no deja guardar, se vive sin ella.
var CLAVE_SESION = 'atencion:sesion';
function huellaBoleto(b) { return b ? String(b).slice(-16) : ''; }
function recordar(ses) {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ huella: huellaBoleto(S.boleto), ses: ses }));
  } catch (e) { /* sin almacenamiento */ }
}
// Con boleto: solo la sesión de ese boleto. Sin boleto (recarga): la guardada.
function recordada(boleto) {
  try {
    var t = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null');
    if (!t || !t.ses) return null;
    if (boleto && t.huella !== huellaBoleto(boleto)) return null;
    return t.ses;
  } catch (e) { return null; }
}
function olvidar() {
  try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* sin almacenamiento */ }
}

// Toda respuesta pasa por aquí: si la sesión terminó, se va a la entrada.
function sinSesion(r) {
  if (r && r.code === 'SIN_SESION') {
    olvidar();
    S.sucio = false; S.cola = []; S.subiendo = false;
    mostrarEntrada(r.msg || 'Su sesión terminó. Vuelva a entrar desde el portal.');
    return true;
  }
  return false;
}

// Error de una acción en el contenedor `id`. Si el servidor estaba ocupado
// (OCUPADO) o no hubo conexión, agrega «Intentar de nuevo», que repite la acción.
function mostrarError(id, msg, reintentar) {
  var c = $(id); c.textContent = msg;
  if (reintentar) {
    var b = el('button', { type: 'button', class: 'btn-chico', text: 'Intentar de nuevo' });
    b.addEventListener('click', function () { c.textContent = ''; reintentar(); });
    c.appendChild(el('span', { style: 'display:block;margin-top:8px' }, [b]));
  }
}
function falla(id, r, reintentar) {
  mostrarError(id, (r && r.msg) || 'Algo falló. Intente de nuevo.', r && r.code === 'OCUPADO' ? reintentar : null);
}

// ---------------------------------------------------------------- Vistas
function mostrar(id) {
  ['cargando', 'entrada', 'vista-informe'].forEach(function (v) { $(v).hidden = v !== id; });
  var v = $(id);
  v.classList.remove('entrando'); void v.offsetWidth; v.classList.add('entrando');
  window.scrollTo(0, 0);
}

function mostrarEntrada(msg, reintentable) {
  S.token = null;
  $('entrada-msg').textContent = msg || MSG_ENTRE;
  $('btn-reintentar-entrada').hidden = !reintentable;
  mostrar('entrada');
}

// ---------------------------------------------------------------- Arranque
// El boleto es una credencial: se lee una vez y se quita de la barra de
// direcciones (y del historial), sin recargar. Se queda solo en memoria (S.boleto),
// para «Intentar de nuevo».
function boletoDeLaDireccion() {
  var q;
  try { q = new URLSearchParams(location.search); } catch (e) { return null; }
  var b = q.get('boleto');
  if (b) {
    q.delete('boleto');
    var resto = q.toString();
    try {
      history.replaceState(history.state, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
    } catch (e) { /* sin history: el boleto vence solo */ }
  }
  return b;
}

function iniciar() {
  if (!(window.fetch && window.URLSearchParams && typeof EXEC_ATENCION === 'string')) return mostrarEntrada(MSG_ENTRE);
  mostrar('cargando');
  var b = S.boleto;
  if (!b) {
    // Recarga de la pestaña: el boleto ya no está en la dirección.
    var guardada = recordada(null);
    return guardada ? arrancar(guardada) : mostrarEntrada(MSG_ENTRE);
  }
  llamar('entrar', [b]).then(function (r) {
    if (!r || !r.ok) {
      var previa = r && (r.code === 'BOLETO_VENCIDO' || r.code === 'BOLETO_INVALIDO') ? recordada(b) : null;
      if (previa) return arrancar(previa);
      return mostrarEntrada((r && r.msg) || MSG_ENTRE);
    }
    var ses = { token: r.token, nombre: r.nombre, rol: r.rol, unidad: r.unidad, porDefecto: r.porDefecto };
    recordar(ses);
    arrancar(ses);
  }, function () { mostrarEntrada(MSG_RED, true); });
}

function arrancar(ses) {
  S.token = ses.token; S.rol = ses.rol;
  S.anio = Number(ses.porDefecto.anio); S.mes = Number(ses.porDefecto.mes);
  $('persona').textContent = ses.nombre || '';
  $('disciplina').textContent = (ses.rol === 'NUTRICION' ? 'Nutrición' : 'Psicología') +
                                (ses.unidad ? ' · ' + ses.unidad : '');
  armarModulo(ses.rol);
  llenarMeses(S.anio, S.mes);
  mostrar('vista-informe');
  cargarMes();
}

// Meses del año del periodo por defecto y del anterior, del más nuevo al más
// viejo, sin pasar del mes en curso (fecha del teléfono) ni quitar el de por defecto.
function llenarMeses(anio, mes) {
  var s = $('mes'); s.textContent = '';
  var hoy = new Date();
  var tope = Math.max(hoy.getFullYear() * 12 + hoy.getMonth() + 1, anio * 12 + mes);
  [anio, anio - 1].forEach(function (a) {
    var g = el('optgroup', { label: String(a) });
    for (var m = 12; m >= 1; m--) {
      if (a * 12 + m > tope || a * 12 + m < MES_MINIMO) continue;
      var o = el('option', { value: a + '-' + m, text: mesTitulo(a, m) });
      if (a === anio && m === mes) o.selected = true;
      g.appendChild(o);
    }
    if (g.children.length) s.appendChild(g);
  });
}

$('mes').addEventListener('change', function () {
  var p = this.value.split('-');
  if (S.sucio && !soloLectura() && !window.confirm('Hay cambios sin guardar en ' + mesTexto(S.anio, S.mes) +
                                              '. ¿Cambiar de mes sin guardarlos?')) {
    this.value = S.anio + '-' + S.mes;
    return;
  }
  S.anio = Number(p[0]); S.mes = Number(p[1]);
  cargarMes();
});
$('btn-reintentar-entrada').addEventListener('click', iniciar);
$('btn-reintentar-carga').addEventListener('click', function () { cargarMes(); });

window.addEventListener('beforeunload', function (ev) {
  if ((S.sucio && !soloLectura()) || S.subiendo || S.cola.some(function (x) { return x.estado !== 'error'; })) {
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  }
});

// ---------------------------------------------------------------- Módulo del rol
// Cada entrada lleva data-ruta: 'nut.consultas', 'psi.temas.ansiedad.sesiones', etc.
function entradaNumero(ruta, id, etiquetaOculta) {
  var attrs = { id: id, type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6',
                autocomplete: 'off', enterkeyhint: 'next', 'data-ruta': ruta, 'data-numero': '1' };
  if (etiquetaOculta) attrs['aria-label'] = etiquetaOculta;
  return el('input', attrs);
}
function campoNumero(ruta, texto) {
  var id = 'c-' + ruta.replace(/\./g, '-');
  return el('div', { class: 'campo' }, [el('label', { for: id, text: texto }), entradaNumero(ruta, id)]);
}
function campoTexto(ruta, texto, placeholder) {
  var id = 'c-' + ruta.replace(/\./g, '-');
  return el('div', { class: 'campo' }, [el('label', { for: id, text: texto }),
    el('input', { id: id, type: 'text', class: 'texto', maxlength: String(MAX_TEXTO), autocomplete: 'off',
                  enterkeyhint: 'next', 'data-ruta': ruta, placeholder: placeholder || '' })]);
}
function tarjeta(titulo, ayuda, hijos) {
  var fs = el('fieldset', { class: 'grupo' }, [el('legend', { text: titulo })]);
  if (ayuda) fs.appendChild(el('p', { class: 'ayuda', text: ayuda }));
  hijos.forEach(function (h) { fs.appendChild(h); });
  return fs;
}

function armarModulo(rol) {
  var cont = $('modulo'); cont.textContent = '';
  if (rol === 'NUTRICION') {
    cont.appendChild(tarjeta('Actividades del mes', 'Escriba 0 donde no hubo.', [el('div', { class: 'campos' }, [
      campoNumero('nut.consultas', ETIQUETAS.consultas),
      campoNumero('nut.orientaciones', ETIQUETAS.orientaciones),
      campoNumero('nut.box_lunch', ETIQUETAS.box_lunch)
    ])]));
    $('pistas').textContent = '';
    ['Colaterales firmados y sellados (PDF)',
     'Evidencias: cartas descriptivas, listas de asistencia, fotos (PDF o imagen)'].forEach(function (t) {
      $('pistas').appendChild(el('li', { text: t }));
    });
    return;
  }

  // Psicología
  cont.appendChild(tarjeta('Consultas individuales', 'Del total, cuántas fueron a cada grupo. Escriba 0 donde no hubo.', [
    campoNumero('psi.consultas.consultas_total', 'Total de consultas'),
    el('p', { class: 'subtitulo', text: 'De ellas' }),
    el('div', { class: 'trio' }, [
      campoNumero('psi.consultas.consultas_menores18', 'Menores de 18'),
      campoNumero('psi.consultas.consultas_60mas', '60 y más'),
      campoNumero('psi.consultas.consultas_lgbtiq', 'LGBTIQ+')
    ])
  ]));

  var temas = el('div', { class: 'temas', role: 'group', 'aria-label': 'Sesiones y asistentes por tema' });
  temas.appendChild(el('div', { class: 'tema-cab', 'aria-hidden': 'true' }, [
    el('span', { text: 'Tema' }), el('span', { text: 'Sesiones' }), el('span', { text: 'Asistentes' })]));
  TEMAS_PSI.forEach(function (t) {
    var ids = 'c-psi-temas-' + t.id + '-sesiones', ida = 'c-psi-temas-' + t.id + '-asistentes';
    var fila = el('div', { class: 'tema' }, [
      el('span', { class: 'tema-nombre', id: 'n-' + t.id, text: t.nombre }),
      entradaNumero('psi.temas.' + t.id + '.sesiones', ids, t.nombre + ': sesiones'),
      entradaNumero('psi.temas.' + t.id + '.asistentes', ida, t.nombre + ': asistentes')
    ]);
    if (t.id === 'otro') {
      fila.appendChild(el('div', { class: 'tema-otro', id: 'otro-cual', hidden: '' }, [
        el('label', { for: 'c-psi-otro_texto', text: '¿Cuál fue el otro tema?' }),
        el('input', { id: 'c-psi-otro_texto', type: 'text', class: 'texto', maxlength: String(MAX_TEXTO),
                      autocomplete: 'off', 'data-ruta': 'psi.otro_texto' })
      ]));
    }
    temas.appendChild(fila);
  });
  temas.appendChild(el('p', { class: 'tema-total' }, [el('span', { text: 'Total de asistentes' }),
                                                     el('strong', { id: 'total-asistentes', text: '0' })]));
  cont.appendChild(tarjeta('Sesiones grupales por tema', 'Número de sesiones y total de asistentes de cada tema.', [temas]));

  cont.appendChild(tarjeta('Población de las sesiones', 'Las mismas personas contadas por sexo y por edad.', [
    el('p', { class: 'subtitulo', text: 'Por sexo' }),
    el('div', { class: 'pareja' }, [campoNumero('psi.poblacion.hombres', 'Hombres'),
                                    campoNumero('psi.poblacion.mujeres', 'Mujeres')]),
    el('p', { class: 'subtitulo', text: 'Por edad' }),
    el('div', { class: 'pareja' }, [campoNumero('psi.poblacion.edad_13_17', '13 a 17 años'),
                                    campoNumero('psi.poblacion.edad_18_21', '18 a 21 años')]),
    el('div', { class: 'pareja', style: 'margin-top:10px' }, [campoNumero('psi.poblacion.edad_22_59', '22 a 59 años'),
                                    campoNumero('psi.poblacion.edad_60mas', '60 años y más')]),
    el('div', { id: 'cuadre', class: 'cuadre', role: 'status', 'aria-live': 'polite' })
  ]));

  cont.appendChild(tarjeta('Material informativo', 'Material que elaboró o distribuyó en el mes.', [
    el('div', { class: 'trio' }, [
      campoNumero('psi.material.murales', 'Periódicos murales'),
      campoNumero('psi.material.folletos', 'Folletos'),
      campoNumero('psi.material.carteles', 'Carteles')
    ]),
    el('div', { style: 'margin-top:12px' }, [campoTexto('psi.material.tema_material', 'Tema del material')])
  ]));

  $('pistas').textContent = '';
  ['Listas de asistencia de las sesiones (PDF o foto)', 'Fotos de las sesiones y del material (PDF o imagen)']
    .forEach(function (t) { $('pistas').appendChild(el('li', { text: t })); });
}

function entradas() { return Array.prototype.slice.call(document.querySelectorAll('#modulo input[data-ruta]')); }

function valorEn(obj, ruta) {
  return ruta.split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, obj);
}
function ponerEn(obj, ruta, v) {
  var ks = ruta.split('.'), o = obj;
  for (var i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = v;
}

// El informe tal como está en pantalla (cifras como texto; el servidor las normaliza).
function leerInforme() {
  var inf = { rol: S.rol };
  entradas().forEach(function (inp) { ponerEn(inf, inp.getAttribute('data-ruta'), inp.value.trim()); });
  return inf;
}

$('modulo').addEventListener('input', function (ev) {
  var t = ev.target;
  if (!t.matches || !t.matches('input[data-ruta]')) return;
  if (t.hasAttribute('data-numero')) {
    // Solo dígitos: los teclados de algunos teléfonos dejan poner punto o guion.
    var limpio = t.value.replace(/[^0-9]/g, '');
    if (limpio !== t.value) t.value = limpio;
  }
  S.sucio = true;
  S.erroresServidor = [];
  $('guardado').textContent = '';
  revisarEnVivo();
});

// ---------------------------------------------------------------- Reglas (réplica de Reglas.gs)
function _cifra(v, etiqueta, errores) {
  var s = (v === undefined || v === null) ? '' : String(v).trim();
  if (s === '') { errores.push({ falta: true, msg: etiqueta + ': falta el número (escriba 0 si no hubo).' }); return null; }
  if (!/^\d+$/.test(s)) { errores.push({ msg: etiqueta + ': debe ser un número entero, sin decimales, signos ni letras.' }); return null; }
  var n = Number(s);
  if (n > MAX_VALOR) { errores.push({ msg: etiqueta + ': el máximo es ' + MAX_VALOR + '.' }); return null; }
  return n;
}
function _texto(v, etiqueta, errores) {
  var s = String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > MAX_TEXTO) { errores.push({ msg: etiqueta + ': máximo ' + MAX_TEXTO + ' caracteres (lleva ' + s.length + ').' }); return null; }
  return s;
}
function _suma(obj, campos) { return campos.reduce(function (s, k) { return s + (Number(obj[k]) || 0); }, 0); }

// → [{msg, falta?}] con los mismos mensajes que validarInforme del servidor.
function validarCliente(inf) {
  var errores = [];
  if (S.rol === 'NUTRICION') {
    var nut = inf.nut || {};
    CAMPOS_NUT.forEach(function (k) { _cifra(nut[k], ETIQUETAS[k], errores); });
    return errores;
  }
  var psi = inf.psi || {}, v = { consultas: {}, temas: {}, poblacion: {}, material: {} };
  var c = psi.consultas || {};
  CAMPOS_PSI_CONSULTA.forEach(function (k) { v.consultas[k] = _cifra(c[k], ETIQUETAS[k], errores); });
  if (v.consultas.consultas_total !== null) {
    SUBGRUPOS_PSI_CONSULTA.forEach(function (k) {
      if (v.consultas[k] !== null && v.consultas[k] > v.consultas.consultas_total) {
        errores.push({ msg: ETIQUETAS[k] + ' (' + v.consultas[k] + ') no puede ser mayor que el total de consultas (' +
                            v.consultas.consultas_total + ').' });
      }
    });
  }
  var t = psi.temas || {}, temasBien = true;
  TEMAS_PSI.forEach(function (tema) {
    var f = t[tema.id] || {};
    var s = _cifra(f.sesiones, tema.nombre + ' — sesiones', errores);
    var a = _cifra(f.asistentes, tema.nombre + ' — asistentes', errores);
    if (s === null || a === null) temasBien = false;
    else if (s === 0 && a > 0) errores.push({ msg: tema.nombre + ': hay asistentes pero 0 sesiones.' });
    v.temas[tema.id] = { sesiones: s, asistentes: a };
  });
  var otro = _texto(psi.otro_texto, ETIQUETAS.otro_texto, errores);
  if (v.temas.otro.sesiones > 0 && otro === '') errores.push({ msg: 'Otro tema: hay sesiones; escriba cuál fue el tema.' });

  var p = psi.poblacion || {};
  CAMPOS_POBLACION.forEach(function (k) { v.poblacion[k] = _cifra(p[k], ETIQUETAS[k], errores); });
  var pobBien = CAMPOS_POBLACION.every(function (k) { return v.poblacion[k] !== null; });
  if (pobBien && temasBien) {
    var sexo = _suma(v.poblacion, CAMPOS_SEXO), edad = _suma(v.poblacion, CAMPOS_EDAD);
    var asist = TEMAS_PSI.reduce(function (s, tema) { return s + v.temas[tema.id].asistentes; }, 0);
    if (sexo !== edad) errores.push({ msg: 'Población: hombres + mujeres (' + sexo + ') no cuadra con la suma de los grupos de edad (' + edad + ').' });
    if (sexo !== asist) errores.push({ msg: 'Población: hombres + mujeres (' + sexo + ') no cuadra con el total de asistentes de la tabla de temas (' + asist + ').' });
  }
  var m = psi.material || {};
  CAMPOS_MATERIAL_NUM.forEach(function (k) { v.material[k] = _cifra(m[k], ETIQUETAS[k], errores); });
  var tm = _texto(m.tema_material, ETIQUETAS.tema_material, errores);
  if (_suma(v.material, CAMPOS_MATERIAL_NUM) > 0 && tm === '') errores.push({ msg: 'Material informativo: hay material; escriba el tema.' });
  return errores;
}

// Indicador, marcas en los campos, lista de pendientes y botón de envío.
function revisarEnVivo() {
  if (!S.datos) return;
  var inf = leerInforme();
  entradas().forEach(function (inp) {
    var v = inp.value.trim();
    if (inp.hasAttribute('data-numero') && v !== '' && Number(v) > MAX_VALOR) inp.setAttribute('aria-invalid', 'true');
    else inp.removeAttribute('aria-invalid');
  });
  if (S.rol === 'PSICOLOGIA') pintarCuadre(inf.psi);
  pintarPendientes(validarCliente(inf));
}

function pintarCuadre(psi) {
  var p = psi.poblacion, t = psi.temas;
  var sexo = _suma(p, CAMPOS_SEXO), edad = _suma(p, CAMPOS_EDAD);
  var asist = TEMAS_PSI.reduce(function (s, tema) { return s + (Number(t[tema.id].asistentes) || 0); }, 0);
  var completos = CAMPOS_POBLACION.every(function (k) { return String(p[k]).trim() !== ''; });
  var iguales = sexo === edad && sexo === asist;
  $('total-asistentes').textContent = String(asist);
  var otroSes = Number(t.otro.sesiones) || 0;
  var cual = $('otro-cual');
  cual.hidden = otroSes <= 0;
  var c = $('cuadre'); c.textContent = '';
  var clase = !iguales ? 'mal' : completos ? 'bien' : '';
  c.className = 'cuadre' + (clase ? ' ' + clase : '');
  var titulo = !iguales ? 'No cuadra: las tres cifras deben ser iguales'
             : completos ? 'Cuadra' : 'Complete la población';
  c.appendChild(el('strong', {}, [icono(!iguales ? 'i-equis' : completos ? 'i-listo' : 'i-guion'),
                                  el('span', { text: titulo })]));
  c.appendChild(el('span', { text: 'Hombres + Mujeres = ' + sexo + ' · Suma por edad = ' + edad +
                                   ' · Asistentes por tema = ' + asist }));
}

function pintarPendientes(errores) {
  var cont = $('pendientes'); cont.textContent = '';
  var nota = $('nota-envio'), btn = $('btn-enviar');
  if (soloLectura()) { $('envio').hidden = true; return; }
  $('envio').hidden = false;
  var lista = errores.length ? errores : S.erroresServidor.map(function (m) { return { msg: m }; });
  var faltan = lista.filter(function (e) { return e.falta; }).length;
  var otros = lista.filter(function (e) { return !e.falta; });
  var nEv = ((S.datos && S.datos.evidencias) || []).length;

  if (lista.length || !nEv) {
    var ul = el('ul');
    if (faltan) ul.appendChild(el('li', { text: faltan === 1 ? 'Falta 1 número (escriba 0 si no hubo).'
                                                             : 'Faltan ' + faltan + ' números (escriba 0 donde no hubo).' }));
    otros.forEach(function (e) { ul.appendChild(el('li', { text: e.msg })); });
    if (!nEv) ul.appendChild(el('li', { text: 'Suba al menos una evidencia (PDF o foto).' }));
    cont.appendChild(el('div', { class: 'aviso neutro' }, [icono('i-guion'), el('div', {}, [
      el('strong', { text: 'Pendiente para enviar' }), ul])]));
  }
  var bloqueado = lista.length > 0 || !nEv;
  btn.disabled = bloqueado || S.ocupado || S.subiendo;
  if (bloqueado) nota.textContent = 'Podrá enviar cuando no quede nada pendiente. Mientras, puede guardar el borrador.';
  else if (S.subiendo) nota.textContent = 'Espere a que terminen de subir las evidencias.';
  else nota.textContent = 'Al enviar, el informe de ' + mesTexto(S.anio, S.mes) + ' queda cerrado y ya no se puede cambiar.';
}

// ---------------------------------------------------------------- Cargar el mes
function cargarMes() {
  var n = ++S.pedido;
  S.datos = null; S.sucio = false; S.erroresServidor = []; S.cola = []; S.bloqueo = null;
  $('contenido').hidden = true; $('estado-informe').hidden = true;
  $('error-carga').textContent = ''; $('btn-reintentar-carga').hidden = true;
  $('carga-mes').hidden = false;
  $('vista-informe').setAttribute('aria-busy', 'true');
  llamar('informeDelMes', [S.token, S.anio, S.mes]).then(function (r) {
    if (n !== S.pedido) return;
    if (sinSesion(r)) return;
    if (!r || !r.ok) return errorCarga((r && r.msg) || 'Algo falló. Intente de nuevo.', r && CODIGOS_BLOQUEO.test(r.code));
    S.datos = r;
    if (r.code && CODIGOS_BLOQUEO.test(r.code)) S.bloqueo = r.msg || 'Este informe no se puede modificar.';
    pintarInforme();
  }, function () { if (n === S.pedido) errorCarga(MSG_RED); });
}

function errorCarga(msg, sinReintento) {
  $('carga-mes').hidden = true;
  $('vista-informe').setAttribute('aria-busy', 'false');
  $('error-carga').textContent = msg;
  $('btn-reintentar-carga').hidden = !!sinReintento;
}

function pintarInforme() {
  var r = S.datos, ro = soloLectura();
  $('carga-mes').hidden = true;
  $('vista-informe').setAttribute('aria-busy', 'false');
  pintarEstado();
  entradas().forEach(function (inp) {
    var v = valorEn(r.informe || {}, inp.getAttribute('data-ruta'));
    inp.value = v === undefined || v === null ? '' : String(v);
    inp.disabled = ro;
    // Importados del formulario: las consultas de psicología no existían (null).
    inp.placeholder = ro && inp.value === '' ? 'Sin dato' : '';
    inp.removeAttribute('aria-invalid');
  });
  $('acciones-guardar').hidden = ro;
  $('error-guardar').textContent = ''; $('guardado').textContent = '';
  $('error-enviar').textContent = ''; $('error-evidencias').textContent = '';
  pintarAlertas(r.alertas || []);
  $('contenido').hidden = false;
  pintarEvidencias();
  revisarEnVivo();
  pintarBotones();
}

function pintarEstado() {
  var r = S.datos, c = $('estado-informe'); c.textContent = '';
  var env = enviado();
  c.appendChild(el('span', { class: 'chip ' + (env ? 'enviado' : 'borrador') },
    [icono(env || S.bloqueo ? 'i-candado' : 'i-lapiz'),
     el('span', { text: env ? 'Enviado' : S.bloqueo ? 'Borrador · solo lectura' : 'Borrador' })]));
  if (S.bloqueo && !env) c.appendChild(el('p', { text: S.bloqueo }));
  else c.appendChild(el('p', { text: env
    ? 'El informe de ' + mesTexto(S.anio, S.mes) + ' ya se envió: solo puede consultarlo. Si necesita corregir algo, pida a la jurisdicción que lo reabra.'
    : r.existe ? 'Informe de ' + mesTexto(S.anio, S.mes) + ' guardado como borrador. Todavía no se envía.'
               : 'Todavía no hay informe de ' + mesTexto(S.anio, S.mes) + '. Llene las cifras y guarde el borrador.' }));
  if (r.origen === 'FORMULARIO') {
    c.appendChild(el('p', { class: 'importado' }, [icono('i-historial'),
      el('span', { text: 'Importado del formulario anterior.' })]));
  }
  c.hidden = false;
}

function pintarAlertas(alertas) {
  var cont = $('alertas'); cont.textContent = '';
  if (!alertas.length) return;
  var ul = el('ul');
  alertas.forEach(function (a) { ul.appendChild(el('li', { text: a })); });
  cont.appendChild(el('div', { class: 'aviso' }, [icono('i-aviso'), el('div', {}, [
    el('strong', { text: 'Revise, por si acaso' }), el('span', { text: ' (no impide enviar):' }), ul])]));
}

function ocupar(btn, si) {
  S.ocupado = si;
  btn.setAttribute('aria-busy', si ? 'true' : 'false');
  var g = btn.querySelector('.giro'); if (g) g.hidden = !si;
  pintarBotones();
}

function pintarBotones() {
  var bloqueado = S.ocupado || S.subiendo;
  $('btn-guardar').disabled = bloqueado;
  $('mes').disabled = bloqueado;
  if (S.datos) pintarPendientes(validarCliente(leerInforme()));
  pintarEvidencias();
}

// ---------------------------------------------------------------- Guardar
$('form-informe').addEventListener('submit', function (ev) {
  ev.preventDefault();
  if (!S.datos || soloLectura() || S.ocupado || S.subiendo) return;
  guardar();
});

// Guarda el borrador. `luego(r)` se llama solo si quedó guardado.
function guardar(luego) {
  var btn = $('btn-guardar'), inf = leerInforme(), n = S.pedido;
  $('error-guardar').textContent = ''; $('guardado').textContent = '';
  var grande = entradas().filter(function (inp) { return inp.getAttribute('aria-invalid') === 'true'; })[0];
  if (grande) {
    $('error-guardar').textContent = 'Hay cifras mayores que ' + MAX_VALOR + '. Corríjalas antes de guardar.';
    grande.focus();
    return;
  }
  ocupar(btn, true);
  llamar('guardarInforme', [S.token, S.anio, S.mes, inf]).then(function (r) {
    ocupar(btn, false);
    if (n !== S.pedido) return;
    if (sinSesion(r)) return;
    if (!r || !r.ok) {
      if (r && r.code === 'INFORME_ENVIADO') { cargarMes(); return; }
      if (bloqueado(r)) return;
      return falla('error-guardar', r, function () { guardar(luego); });
    }
    S.sucio = false; S.datos.existe = true; S.datos.informe = inf;
    S.erroresServidor = r.errores || [];
    S.datos.alertas = r.alertas || [];
    pintarEstado();
    pintarAlertas(S.datos.alertas);
    $('guardado').appendChild(el('p', { class: 'aviso ok' }, [icono('i-listo'), el('span', {
      text: (r.errores || []).length ? 'Borrador guardado. Todavía hay pendientes para poder enviarlo.'
                                     : 'Borrador guardado.' })]));
    revisarEnVivo();
    if (luego) luego(r);
  }, function () {
    ocupar(btn, false);
    if (n === S.pedido) mostrarError('error-guardar', MSG_RED, function () { guardar(luego); });
  });
}

// ---------------------------------------------------------------- Enviar
$('btn-enviar').addEventListener('click', function () {
  if (!S.datos || soloLectura() || S.ocupado || S.subiendo) return;
  if (validarCliente(leerInforme()).length || !(S.datos.evidencias || []).length) return;
  var txt = '¿Enviar el informe de ' + mesTexto(S.anio, S.mes) + '?\n\n' +
            'Después ya no podrá cambiarlo; si necesita corregir algo, la jurisdicción tendrá que reabrirlo.';
  if (!window.confirm(txt)) return;
  $('error-enviar').textContent = '';
  // El servidor revisa lo guardado: si hay cambios en pantalla, primero se guardan.
  if (S.sucio || !S.datos.existe) {
    guardar(function (r) {
      if ((r.errores || []).length) {
        $('error-enviar').textContent = 'No se envió: corrija lo pendiente.';
        return;
      }
      enviar();
    });
  } else {
    enviar();
  }
});

function enviar() {
  var btn = $('btn-enviar'), n = S.pedido;
  $('error-enviar').textContent = '';
  ocupar(btn, true);
  llamar('enviarInforme', [S.token, S.anio, S.mes]).then(function (r) {
    ocupar(btn, false);
    if (n !== S.pedido) return;
    if (sinSesion(r)) return;
    if (!r || !r.ok) {
      if (r && r.code === 'INFORME_ENVIADO') { cargarMes(); return; }
      if (bloqueado(r)) return;
      if (r && r.errores) { S.erroresServidor = r.errores; revisarEnVivo(); }
      return falla('error-enviar', r, enviar);
    }
    S.datos.estado = 'ENVIADO'; S.sucio = false;
    pintarInforme();
    window.scrollTo(0, 0);
    $('persona').focus();
  }, function () {
    ocupar(btn, false);
    if (n === S.pedido) mostrarError('error-enviar', MSG_RED, enviar);
  });
}

// ---------------------------------------------------------------- Evidencias
function esPdf(f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''); }

function pintarEvidencias() {
  if (!S.datos) return;
  var ro = soloLectura(), ul = $('evidencias'), evs = S.datos.evidencias || [];
  ul.textContent = '';
  evs.forEach(function (ev) {
    var botones = el('div', { class: 'ev-botones' });
    if (!ro) {
      var b = el('button', { type: 'button', class: 'btn-chico peligro', text: 'Borrar' });
      b.setAttribute('aria-label', 'Borrar ' + ev.nombre);
      b.disabled = S.subiendo || S.ocupado;
      b.addEventListener('click', function () { borrarEvidencia(ev); });
      botones.appendChild(b);
    }
    ul.appendChild(el('li', { class: 'evidencia' }, [
      el('span', { class: 'ev-icono', 'aria-hidden': 'true' }, [icono(ev.tipo === 'application/pdf' ? 'i-archivo' : 'i-imagen')]),
      el('div', { class: 'ev-texto' }, [el('span', { class: 'ev-nombre', text: ev.nombre }),
        el('span', { text: (ev.tipo === 'application/pdf' ? 'PDF' : 'Imagen') + ' · ' + tamano(ev.bytes) }),
        ro ? null : botones])
    ]));
  });
  S.cola.forEach(function (it) {
    var texto = el('div', { class: 'ev-texto' }, [el('span', { class: 'ev-nombre', text: it.archivo.name || 'Archivo' })]);
    if (it.estado === 'error') {
      texto.appendChild(el('p', { class: 'error', text: 'No se subió. ' + (it.msg || '') }));
      var bs = el('div', { class: 'ev-botones' });
      if (!it.sinReintento) {
        var re = el('button', { type: 'button', class: 'btn-chico', text: 'Reintentar' });
        re.addEventListener('click', function () { it.estado = 'espera'; procesarCola(); });
        bs.appendChild(re);
      }
      var q = el('button', { type: 'button', class: 'btn-chico', text: 'Quitar' });
      q.addEventListener('click', function () { S.cola = S.cola.filter(function (x) { return x !== it; }); pintarBotones(); });
      bs.appendChild(q);
      texto.appendChild(bs);
    } else {
      texto.appendChild(el('span', {}, [el('span', { class: 'giro oscuro', 'aria-hidden': 'true', style: 'vertical-align:-3px' }),
        document.createTextNode(it.estado === 'subiendo' ? ' ' + (it.fase || 'Subiendo…') : ' En espera…')]));
    }
    ul.appendChild(el('li', { class: 'evidencia' }, [
      el('span', { class: 'ev-icono', 'aria-hidden': 'true' }, [icono(esPdf(it.archivo) ? 'i-archivo' : 'i-imagen')]), texto]));
  });

  var libres = MAX_EVIDENCIAS - evs.length - S.cola.filter(function (x) { return x.estado !== 'error'; }).length;
  var btn = $('btn-evidencia'), nota = $('nota-evidencias');
  btn.hidden = ro;
  $('pistas').hidden = ro;
  btn.disabled = libres <= 0 || S.ocupado;
  if (ro) nota.textContent = evs.length ? '' : 'Este informe no tiene evidencias.';
  else if (libres <= 0) nota.textContent = 'Ya tiene las ' + MAX_EVIDENCIAS + ' evidencias permitidas. Borre alguna o júntelas en un PDF.';
  else nota.textContent = 'PDF de hasta 8 MB o fotos (se reducen solas). Le quedan ' + libres + ' de ' + MAX_EVIDENCIAS + '.';
}

$('btn-evidencia').addEventListener('click', function () { $('archivo').click(); });
$('archivo').addEventListener('change', function () {
  if (!S.datos || soloLectura()) return;
  var libres = MAX_EVIDENCIAS - (S.datos.evidencias || []).length -
               S.cola.filter(function (x) { return x.estado !== 'error'; }).length;
  var archivos = Array.prototype.slice.call(this.files || []);
  if (archivos.length > libres) {
    window.alert('Solo caben ' + libres + (libres === 1 ? ' evidencia más' : ' evidencias más') + '; se tomarán las primeras.');
    archivos = archivos.slice(0, Math.max(0, libres));
  }
  var gen = S.pedido;
  archivos.forEach(function (f) { S.cola.push({ archivo: f, estado: 'espera', gen: gen }); });
  this.value = '';
  $('error-evidencias').textContent = '';
  pintarEvidencias();
  procesarCola();
});

// Lee un archivo como base64 (sin el prefijo data:).
function leerBase64(archivo) {
  return new Promise(function (ok, mal) {
    var fr = new FileReader();
    fr.onload = function () { var u = String(fr.result); ok(u.slice(u.indexOf(',') + 1)); };
    fr.onerror = function () { mal(new Error('ilegible')); };
    fr.readAsDataURL(archivo);
  });
}
// Bytes que quedan al decodificar: 3 por cada 4 caracteres, menos el relleno '='.
function bytesDeBase64(b64) {
  var relleno = b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0;
  return Math.floor(b64.length / 4) * 3 - relleno;
}
function dibujable(archivo) {
  if (window.createImageBitmap) {
    return createImageBitmap(archivo, { imageOrientation: 'from-image' })
      .catch(function () { return cargarImagen(archivo); });
  }
  return cargarImagen(archivo);
}
function cargarImagen(archivo) {
  return new Promise(function (ok, mal) {
    var img = new Image(), url = URL.createObjectURL(archivo);
    img.onload = function () { URL.revokeObjectURL(url); ok(img); };
    img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('no es imagen')); };
    img.src = url;
  });
}
// Foto → JPEG de lado mayor 1600 px y calidad 0.8; baja por la escalera si pasa
// de META_FOTO. Respeta la orientación EXIF. PNG con transparencia → fondo blanco.
function reducir(archivo) {
  return dibujable(archivo).then(function (img) {
    var w = img.width, h = img.height;
    if (!(w > 0 && h > 0)) throw new Error('no es imagen');
    var c = document.createElement('canvas'), lado = 0, b64 = '';
    for (var i = 0; i < PASOS_FOTO.length; i++) {
      if (PASOS_FOTO[i][0] !== lado) {
        lado = PASOS_FOTO[i][0];
        var k = Math.min(1, lado / Math.max(w, h));
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
      }
      var url = c.toDataURL('image/jpeg', PASOS_FOTO[i][1]);
      b64 = url.slice(url.indexOf(',') + 1);
      if (url.indexOf('data:image/jpeg') !== 0) throw new Error('sin jpeg');
      if (bytesDeBase64(b64) <= META_FOTO) break;
    }
    if (img.close) img.close();
    if (bytesDeBase64(b64) > MAX_BYTES) throw new Error('grande');
    return { base64: b64, tipo: 'image/jpeg', nombre: String(archivo.name || 'foto').replace(/\.[^.]*$/, '') + '.jpg' };
  });
}

// Lo que se sube: PDF tal cual (≤ 8 MB); foto reducida; si el teléfono no
// puede dibujarla pero ya es JPG/PNG de ≤ 8 MB, se sube como viene.
function preparar(archivo) {
  if (esPdf(archivo)) {
    if (archivo.size > MAX_BYTES) return Promise.reject(new Error('pdf-grande'));
    return leerBase64(archivo).then(function (b64) {
      if (b64.indexOf('JVBER') !== 0) throw new Error('no-pdf');
      return { base64: b64, tipo: 'application/pdf', nombre: archivo.name || 'evidencia.pdf' };
    });
  }
  var comoViene = function () {
    var tipo = /^image\/(jpeg|png)$/.test(archivo.type) ? archivo.type : null;
    if (!tipo) throw new Error('no-imagen');
    if (archivo.size > MAX_BYTES) throw new Error('grande');
    return leerBase64(archivo).then(function (b64) { return { base64: b64, tipo: tipo, nombre: archivo.name || 'foto' }; });
  };
  return reducir(archivo).catch(function (e) {
    if (e && e.message === 'grande') throw e;
    return comoViene();
  });
}

var CODIGOS_SIN_REINTENTO = /^(MAX_EVIDENCIAS|INFORME_ENVIADO|PERIODO_FUTURO|PERIODO_INVALIDO|TIPO_INVALIDO|ARCHIVO_GRANDE)$/;

// Una evidencia a la vez. Si una falla, se marca y se sigue con las demás.
function procesarCola() {
  if (S.subiendo) return;
  var it = S.cola.filter(function (x) { return x.estado === 'espera'; })[0];
  if (!it) { pintarBotones(); return; }
  S.subiendo = true; it.estado = 'subiendo'; it.fase = esPdf(it.archivo) ? 'Subiendo…' : 'Preparando…';
  pintarBotones();
  var gen = it.gen;
  var terminar = function () { S.subiendo = false; pintarBotones(); procesarCola(); };
  var datos = it.datos ? Promise.resolve(it.datos) : preparar(it.archivo);
  datos.then(function (d) {
    it.datos = d; it.fase = 'Subiendo…'; pintarEvidencias();
    return llamar('subirEvidencia', [S.token, S.anio, S.mes, d.nombre, d.tipo, d.base64])
      .then(function (r) {
        if (sinSesion(r)) { S.subiendo = false; S.cola = []; return; }
        if (gen !== S.pedido) { S.cola = S.cola.filter(function (x) { return x !== it; }); return terminar(); }
        if (r && r.ok) {
          S.datos.evidencias = (S.datos.evidencias || []).concat([r.evidencia]);
          if (!S.datos.existe) { S.datos.existe = true; pintarEstado(); }
          S.cola = S.cola.filter(function (x) { return x !== it; });
        } else {
          it.estado = 'error'; it.msg = (r && r.msg) || 'Intente de nuevo.';
          if (r && r.code === 'ARCHIVO_GRANDE' && d.tipo === 'application/pdf') it.msg = MSG_PDF_GRANDE;
          it.sinReintento = !!(r && CODIGOS_SIN_REINTENTO.test(r.code));
          if (r && r.code === 'INFORME_ENVIADO') { S.subiendo = false; S.cola = []; cargarMes(); return; }
          if (r && CODIGOS_BLOQUEO.test(r.code)) { S.subiendo = false; bloqueado(r); return; }
        }
        terminar();
      }, function () { it.estado = 'error'; it.msg = 'Sin conexión.'; terminar(); });
  }, function (e) {
    var m = e && e.message;
    it.estado = 'error'; it.sinReintento = true;
    it.msg = m === 'pdf-grande' ? MSG_PDF_GRANDE
           : m === 'no-pdf' ? 'Ese archivo no es un PDF válido.'
           : m === 'grande' ? 'La imagen pesa más de 8 MB.'
           : 'Solo se aceptan PDF o fotos (JPG o PNG).';
    terminar();
  });
}

function borrarEvidencia(ev) {
  if (!S.datos || soloLectura() || S.ocupado || S.subiendo) return;
  if (!window.confirm('¿Borrar la evidencia «' + ev.nombre + '»?')) return;
  quitarEvidencia(ev);
}

function quitarEvidencia(ev) {
  var n = S.pedido;
  $('error-evidencias').textContent = '';
  S.ocupado = true; pintarBotones();
  llamar('borrarEvidencia', [S.token, S.anio, S.mes, ev.id]).then(function (r) {
    S.ocupado = false;
    if (sinSesion(r)) return;
    if (n !== S.pedido) return pintarBotones();
    // NO_EXISTE: ya no estaba; se quita igual de la pantalla.
    if (r && (r.ok || r.code === 'NO_EXISTE')) {
      S.datos.evidencias = (S.datos.evidencias || []).filter(function (x) { return x !== ev; });
    } else if (r && r.code === 'INFORME_ENVIADO') {
      return cargarMes();
    } else if (bloqueado(r)) {
      return;
    } else {
      falla('error-evidencias', r, function () { quitarEvidencia(ev); });
    }
    pintarBotones();
  }, function () {
    S.ocupado = false; pintarBotones();
    mostrarError('error-evidencias', MSG_RED, function () { quitarEvidencia(ev); });
  });
}

S.boleto = boletoDeLaDireccion();
iniciar();
