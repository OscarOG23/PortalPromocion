'use strict';

// ---------------------------------------------------------------- Datos fijos
// Réplica de GRUPOS_AF (Captura.gs) con los encabezados oficiales del formato.
var GRUPOS = [
  { corto: 'Sesiones con la población', titulo: 'Sesiones de actividad física con la población en general',
    actividad: 'ses_pob', etiqueta: 'Número de sesiones', personas: 'Asistentes', h: 'asis_pob_h', m: 'asis_pob_m' },
  { corto: 'Talleres al personal', titulo: 'Talleres de alimentación y actividad física al personal de salud',
    actividad: 'tall_pers', etiqueta: 'Número de talleres', personas: 'Asistentes', h: 'asis_tall_h', m: 'asis_tall_m' },
  { corto: 'Pausa para la salud', titulo: 'Sesiones de pausa para la salud al personal de salud',
    actividad: 'pausa_pers', etiqueta: 'Número de sesiones', personas: 'Participantes', h: 'asis_pausa_h', m: 'asis_pausa_m' },
  { corto: 'Bicicleta', titulo: 'Actividades que involucran el uso de la bicicleta',
    actividad: 'bici', etiqueta: 'Número de actividades', personas: 'Participantes', h: 'asis_bici_h', m: 'asis_bici_m' }
];
// Mismo orden que CAMPOS_AF.
var CAMPOS = [];
GRUPOS.forEach(function (g) { CAMPOS.push(g.actividad, g.h, g.m); });

var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
             'septiembre', 'octubre', 'noviembre', 'diciembre'];
var MAX_FOTOS = 3, MAX_VALOR = 100000;   // MAX_FOTOS_AF y MAX_VALOR_AF del servidor
var MAX_BYTES = 512000;                  // MAX_BYTES_FOTO_AF: bytes ya decodificados
// Escalera de compresión: lado mayor y calidad JPEG, de mejor a peor.
var PASOS_FOTO = [[1280, 0.75], [1280, 0.6], [1024, 0.6], [1024, 0.5]];
var MSG_RED = 'No se pudo conectar. Revise su señal e intente de nuevo.';
var MSG_ENTRE = 'Entre desde el portal de Promoción.';

// ---------------------------------------------------------------- Estado
var S = {
  token: null, anio: 0, mes: 0, estado: null, pedido: 0,
  unidad: null, sucio: false, ocupado: false,
  cola: [], subiendo: false, miniaturas: {}, verGen: 0,
  boleto: null
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

// Igual que google.script.run: se cumple con la respuesta del servidor (también
// {ok:false,...}) y se rechaza solo si no llegó una respuesta legible (sin red,
// se tardó de más, o no vino JSON): eso va por «No se pudo conectar».
// Content-Type text/plain A PROPÓSITO: con application/json el navegador manda
// antes un OPTIONS que Apps Script no contesta. doPost lee e.postData.contents.
var ESPERA_MS = 60000, ESPERA_SUBIDA_MS = 180000;
function llamar(fn, args) {
  var control = window.AbortController ? new AbortController() : null;
  var reloj = control ? setTimeout(function () { control.abort(); },
                                   fn === 'subirFoto' ? ESPERA_SUBIDA_MS : ESPERA_MS) : 0;
  return fetch(EXEC_AF, {
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
// 'af:' evita chocar con lo que guarda el portal en el mismo dominio.
// Si el navegador no deja guardar, se vive sin ella.
var CLAVE_SESION = 'af:sesion';
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
  ['cargando', 'entrada', 'vista-lista', 'vista-unidad'].forEach(function (v) { $(v).hidden = v !== id; });
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
  if (!(window.fetch && window.URLSearchParams && typeof EXEC_AF === 'string')) return mostrarEntrada(MSG_ENTRE);
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
    var ses = { token: r.token, coordinacion: r.coordinacion, porDefecto: r.porDefecto };
    recordar(ses);
    arrancar(ses);
  }, function () { mostrarEntrada(MSG_RED, true); });
}

function arrancar(ses) {
  S.token = ses.token;
  S.anio = Number(ses.porDefecto.anio); S.mes = Number(ses.porDefecto.mes);
  $('coordinacion').textContent = ses.coordinacion || '';
  llenarMeses(S.anio, S.mes);
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
      if (a * 12 + m > tope) continue;
      var o = el('option', { value: a + '-' + m, text: mesTitulo(a, m) });
      if (a === anio && m === mes) o.selected = true;
      g.appendChild(o);
    }
    s.appendChild(g);
  });
}

$('mes').addEventListener('change', function () {
  var p = this.value.split('-');
  S.anio = Number(p[0]); S.mes = Number(p[1]);
  cargarMes();
});
$('btn-reintentar-entrada').addEventListener('click', iniciar);
$('btn-reintentar-lista').addEventListener('click', cargarMes);

// ---------------------------------------------------------------- Lista
function cargarMes(abrirUnica) {
  var n = ++S.pedido;
  S.estado = null;
  mostrar('vista-lista');
  $('error-lista').textContent = ''; $('btn-reintentar-lista').hidden = true;
  $('lista').textContent = ''; $('lista-carga').hidden = false;
  $('resumen').hidden = true; $('aviso-cerrado').hidden = true; $('cierre').hidden = true;
  $('apartado-unidades').setAttribute('aria-busy', 'true');
  llamar('estadoDelMes', [S.token, S.anio, S.mes]).then(function (r) {
    if (n !== S.pedido) return;
    if (sinSesion(r)) return;
    if (!r || !r.ok) return errorLista((r && r.msg) || 'Algo falló. Intente de nuevo.');
    S.estado = r;
    pintarLista();
    if (abrirUnica !== false && !r.cerrado && (r.unidades || []).length === 1) abrirUnidad(r.unidades[0]);
  }, function () { if (n === S.pedido) errorLista(MSG_RED); });
}

function errorLista(msg) {
  $('lista-carga').hidden = true;
  $('apartado-unidades').setAttribute('aria-busy', 'false');
  $('error-lista').textContent = msg;
  $('btn-reintentar-lista').hidden = false;
}

function textoEstado(u) {
  if (!u.capturada) return 'Sin capturar';
  var n = (u.fotos || []).length;
  return 'Capturada · ' + (n === 1 ? '1 foto' : n + ' fotos');
}

function pintarLista() {
  var r = S.estado, us = r.unidades || [];
  $('lista-carga').hidden = true;
  $('apartado-unidades').setAttribute('aria-busy', 'false');
  $('aviso-cerrado').hidden = !r.cerrado;
  $('cierre').hidden = !!r.cerrado;
  $('error-terminar').textContent = '';

  var hechas = us.filter(function (u) { return u.capturada; }).length;
  var res = $('resumen'); res.textContent = '';
  res.appendChild(el('p', {}, [el('strong', { text: String(hechas) }),
    document.createTextNode(' de ' + us.length + (us.length === 1 ? ' unidad capturada' : ' unidades capturadas') +
                            ' · ' + mesTexto(S.anio, S.mes))]));
  var barra = el('div', { class: 'resumen-barra', 'aria-hidden': 'true' });
  us.forEach(function (u) { barra.appendChild(el('span', { class: u.capturada ? 'lleno' : '' })); });
  res.appendChild(barra);
  res.hidden = false;

  var ul = $('lista'); ul.textContent = '';
  us.forEach(function (u) {
    var b = el('button', { type: 'button', class: 'fila' }, [
      el('span', {}, [
        el('span', { class: 'nombre', text: u.nombre }),
        el('span', { class: 'estado ' + (u.capturada ? 'si' : 'no') },
           [icono(u.capturada ? 'i-listo' : 'i-guion'), el('span', { text: textoEstado(u) })])
      ]),
      el('span', { class: 'flecha' }, [icono('i-derecha')])
    ]);
    b.addEventListener('click', function () { abrirUnidad(u); });
    ul.appendChild(el('li', {}, [b]));
  });
}

$('btn-terminar').addEventListener('click', function () {
  if (!S.estado || S.estado.cerrado || S.ocupado) return;
  var us = S.estado.unidades || [];
  var hechas = us.filter(function (u) { return u.capturada; }).length;
  var txt = '¿Terminar ' + mesTexto(S.anio, S.mes) + '?\n\nDespués ya no podrá cambiar nada de este mes.';
  txt += hechas === 0
    ? '\n\nNo hay unidades capturadas: el mes se reportará sin actividad.'
    : '\n\nQuedan ' + hechas + ' de ' + us.length + ' unidades capturadas.';
  if (!window.confirm(txt)) return;
  terminar();
});

function terminar() {
  var btn = $('btn-terminar');
  $('error-terminar').textContent = '';
  ocupar(btn, true);
  llamar('terminarMes', [S.token, S.anio, S.mes]).then(function (r) {
    ocupar(btn, false);
    if (sinSesion(r)) return;
    if (!r || !r.ok) return falla('error-terminar', r, terminar);
    cargarMes();
  }, function () { ocupar(btn, false); mostrarError('error-terminar', MSG_RED, terminar); });
}

function ocupar(btn, si) {
  S.ocupado = si;
  btn.disabled = si;
  btn.setAttribute('aria-busy', si ? 'true' : 'false');
  var g = btn.querySelector('.giro'); if (g) g.hidden = !si;
}

// ---------------------------------------------------------------- Hoja de la unidad
// Las 4 tarjetas se arman una vez; al abrir una unidad solo se llenan.
(function armarGrupos() {
  var cont = $('grupos');
  GRUPOS.forEach(function (g, i) {
    function campo(clave, texto, oculto) {
      var id = 'c-' + clave;
      var lab = el('label', { for: id });
      if (oculto) lab.appendChild(el('span', { class: 'solo-lector', text: oculto }));
      lab.appendChild(document.createTextNode(texto));
      return el('div', { class: 'campo' }, [lab, el('input', {
        id: id, name: clave, type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6',
        autocomplete: 'off', enterkeyhint: 'next', required: '', 'data-campo': clave
      })]);
    }
    var fs = el('fieldset', { class: 'grupo' }, [
      el('legend', { text: g.titulo }),
      campo(g.actividad, g.etiqueta),
      el('p', { class: 'subtitulo', 'aria-hidden': 'true', text: g.personas }),
      el('div', { class: 'pareja' }, [
        campo(g.h, 'Hombres', g.personas + ' '),
        campo(g.m, 'Mujeres', g.personas + ' ')
      ])
    ]);
    cont.appendChild(fs);
  });
  cont.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t.matches || !t.matches('input')) return;
    // Solo dígitos: los teclados de algunos teléfonos dejan poner punto o guion.
    var limpio = t.value.replace(/[^0-9]/g, '');
    if (limpio !== t.value) t.value = limpio;
    t.removeAttribute('aria-invalid');
    S.sucio = true;
    $('resultado').textContent = '';
    $('btn-listo').hidden = true;
  });
})();

function nombreDeCampo(k) {
  var g = GRUPOS.filter(function (x) { return x.actividad === k || x.h === k || x.m === k; })[0];
  if (!g) return k;
  if (k === g.actividad) return g.corto + ' · ' + g.etiqueta.toLowerCase();
  return g.corto + ' · ' + g.personas.toLowerCase() + (k === g.h ? ' hombres' : ' mujeres');
}
function entradas() { return Array.prototype.slice.call(document.querySelectorAll('#grupos input')); }

function abrirUnidad(u) {
  var cerrado = !!S.estado.cerrado;
  S.unidad = u; S.sucio = false; S.cola = []; S.verGen++;
  $('unidad-nombre').textContent = u.nombre;
  $('unidad-mes').textContent = mesTitulo(S.anio, S.mes) + ' · ' + (u.capturada ? 'capturada' : 'sin capturar');
  $('aviso-cerrado-unidad').hidden = !cerrado;
  $('error-unidad').textContent = '';
  $('resultado').textContent = '';
  $('btn-listo').hidden = true;
  entradas().forEach(function (inp) {
    var k = inp.getAttribute('data-campo');
    inp.value = u.valores && u.valores[k] !== undefined && u.valores[k] !== null ? String(u.valores[k]) : '';
    inp.disabled = cerrado;
    inp.removeAttribute('aria-invalid');
  });
  $('acciones-guardar').hidden = cerrado;
  $('btn-guardar').querySelector('span:last-child').textContent = u.capturada ? 'Guardar cambios' : 'Guardar';
  pintarAcciones();
  pintarFotos();
  mostrar('vista-unidad');
  $('unidad-nombre').focus();
  cargarMiniaturas(u);
}

function pintarAcciones() {
  var u = S.unidad, cerrado = !!S.estado.cerrado;
  $('btn-borrar').hidden = cerrado || !(u.capturada || (u.fotos || []).length);
  var bloqueado = S.subiendo || S.ocupado;
  $('btn-volver').disabled = bloqueado;
  $('btn-listo').disabled = bloqueado;
  $('btn-borrar').disabled = bloqueado;
  $('btn-guardar').disabled = bloqueado;
}

// Misma regla que validarCaptura del servidor: enteros ≥ 0, todos obligatorios.
function leerFormulario() {
  var captura = {}, malos = [], grandes = [];
  entradas().forEach(function (inp) {
    var v = inp.value.trim();
    if (!/^\d+$/.test(v)) { malos.push(inp); inp.setAttribute('aria-invalid', 'true'); }
    else if (Number(v) > MAX_VALOR) { grandes.push(inp); inp.setAttribute('aria-invalid', 'true'); }
    else { inp.removeAttribute('aria-invalid'); captura[inp.getAttribute('data-campo')] = Number(v); }
  });
  if (grandes.length && !malos.length) {
    $('error-unidad').textContent = grandes.map(function (inp) {
      return nombreDeCampo(inp.getAttribute('data-campo')) + ': máximo ' + MAX_VALOR;
    }).join('. ') + '.';
    grandes[0].focus();
    return null;
  }
  if (malos.length) {
    $('error-unidad').textContent = malos.length === 1
      ? 'Falta un número. Escriba 0 si no hubo.'
      : 'Faltan ' + malos.length + ' números. Escriba 0 donde no hubo.';
    malos[0].focus();
    return null;
  }
  return captura;
}

$('form-unidad').addEventListener('submit', function (ev) {
  ev.preventDefault();
  if (!S.unidad || S.estado.cerrado || S.ocupado || S.subiendo) return;
  $('error-unidad').textContent = '';
  var c = leerFormulario();
  if (!c) return;
  var u = S.unidad, btn = $('btn-guardar');
  var valoresEnviados = JSON.stringify(entradas().map(function (inp) { return inp.value; }));
  ocupar(btn, true); pintarAcciones();
  llamar('guardarUnidad', [S.token, S.anio, S.mes, u.unidad_id, c]).then(function (r) {
    ocupar(btn, false); pintarAcciones();
    if (sinSesion(r)) return;
    if (!r || !r.ok) return falla('error-unidad', r, function () { $('btn-guardar').click(); });
    u.valores = c; u.capturada = true;
    S.sucio = valoresEnviados !== JSON.stringify(entradas().map(function (inp) { return inp.value; }));
    if (S.unidad !== u) return;
    $('unidad-mes').textContent = mesTitulo(S.anio, S.mes) + ' · capturada';
    btn.querySelector('span:last-child').textContent = 'Guardar cambios';
    pintarResultado(r.alertas || []);
    if (S.sucio) {
      $('resultado').textContent = 'Se guardó la versión enviada. Hay cambios nuevos sin guardar.';
      $('btn-listo').hidden = true;
    }
    pintarAcciones();
    pintarFotos();
  }, function () {
    ocupar(btn, false); pintarAcciones();
    mostrarError('error-unidad', MSG_RED, function () { $('btn-guardar').click(); });
  });
});

function pintarResultado(alertas) {
  var cont = $('resultado'); cont.textContent = '';
  cont.appendChild(el('p', { class: 'aviso ok' }, [icono('i-listo'),
    el('span', { text: 'Quedó guardado. Si tiene fotos, agréguelas abajo.' })]));
  if (alertas.length) {
    var ul = el('ul');
    alertas.forEach(function (a) { ul.appendChild(el('li', { text: a })); });
    cont.appendChild(el('div', { class: 'aviso' }, [icono('i-aviso'), el('div', {}, [
      el('span', { text: 'Revise, por si acaso (ya quedó guardado):' }), ul])]));
  }
  $('btn-listo').hidden = false;
}

function volver() {
  if (S.subiendo || S.ocupado) return;
  if (S.sucio && !S.estado.cerrado && !window.confirm('Hay cambios sin guardar. ¿Salir sin guardar?')) return;
  S.unidad = null; S.sucio = false; S.cola = []; S.verGen++;
  cargarMes(false);
}
$('btn-volver').addEventListener('click', volver);
$('btn-listo').addEventListener('click', volver);

window.addEventListener('beforeunload', function (ev) {
  if (S.sucio || S.ocupado || S.subiendo || S.cola.length) {
    ev.preventDefault();
    ev.returnValue = '';
  }
});

$('btn-borrar').addEventListener('click', function () {
  var u = S.unidad;
  if (!u || S.estado.cerrado || S.ocupado || S.subiendo) return;
  if (!window.confirm('¿Borrar la captura de ' + u.nombre + ' en ' + mesTexto(S.anio, S.mes) +
                      '?\n\nSe borran sus números y sus fotos.')) return;
  borrarUnidad();
});

function borrarUnidad() {
  var u = S.unidad, btn = $('btn-borrar');
  $('error-unidad').textContent = '';
  ocupar(btn, true); pintarAcciones();
  llamar('borrarUnidad', [S.token, S.anio, S.mes, u.unidad_id]).then(function (r) {
    ocupar(btn, false); pintarAcciones();
    if (sinSesion(r)) return;
    if (!r || !r.ok) return falla('error-unidad', r, borrarUnidad);
    S.sucio = false; volver();
  }, function () {
    ocupar(btn, false); pintarAcciones();
    mostrarError('error-unidad', MSG_RED, borrarUnidad);
  });
}

// ---------------------------------------------------------------- Fotos
function pintarFotos() {
  var u = S.unidad; if (!u) return;
  var cerrado = !!S.estado.cerrado, ul = $('fotos');
  ul.textContent = '';
  (u.fotos || []).forEach(function (f) {
    var src = S.miniaturas[f.foto_id];
    var mini = src ? el('img', { class: 'miniatura', src: src, alt: 'Foto guardada' })
                   : el('div', { class: 'miniatura', 'aria-hidden': 'true' }, [icono('i-imagen')]);
    var botones = el('div', { class: 'foto-botones' });
    if (!cerrado) {
      var b = el('button', { type: 'button', class: 'btn-chico peligro', text: 'Borrar' });
      b.setAttribute('aria-label', 'Borrar esta foto');
      b.disabled = S.subiendo || S.ocupado;
      b.addEventListener('click', function () { borrarFoto(f); });
      botones.appendChild(b);
    }
    ul.appendChild(el('li', { class: 'foto' }, [mini, el('div', { class: 'foto-texto' }, [
      el('span', { text: src ? 'Guardada' : 'Guardada · cargando vista…' }), botones])]));
  });
  S.cola.forEach(function (it) {
    var mini = it.vista ? el('img', { class: 'miniatura', src: it.vista, alt: 'Foto por subir' })
                        : el('div', { class: 'miniatura', 'aria-hidden': 'true' }, [icono('i-imagen')]);
    var texto = el('div', { class: 'foto-texto' });
    if (it.estado === 'error') {
      texto.appendChild(el('p', { class: 'error', text: 'No se subió. ' + (it.msg || '') }));
      var bs = el('div', { class: 'foto-botones' });
      if (!it.sinReintento) {
        var re = el('button', { type: 'button', class: 'btn-chico', text: 'Reintentar' });
        re.addEventListener('click', function () { it.estado = 'espera'; procesarCola(); });
        bs.appendChild(re);
      }
      var q = el('button', { type: 'button', class: 'btn-chico', text: 'Quitar' });
      q.addEventListener('click', function () { S.cola = S.cola.filter(function (x) { return x !== it; }); pintarFotos(); });
      bs.appendChild(q);
      texto.appendChild(bs);
    } else {
      texto.appendChild(el('span', {}, [el('span', { class: 'giro oscuro', 'aria-hidden': 'true' }),
        document.createTextNode(it.estado === 'subiendo' ? ' Subiendo…' : ' En espera…')]));
    }
    ul.appendChild(el('li', { class: 'foto' }, [mini, texto]));
  });

  var libres = MAX_FOTOS - (u.fotos || []).length - S.cola.length;
  var btn = $('btn-foto'), nota = $('nota-fotos');
  btn.hidden = cerrado;
  btn.disabled = !u.capturada || libres <= 0 || S.ocupado;
  if (cerrado) nota.textContent = (u.fotos || []).length ? '' : 'Esta unidad no tiene fotos.';
  else if (!u.capturada) nota.textContent = 'Guarde primero los números para poder agregar fotos.';
  else if (libres <= 0) nota.textContent = 'Ya tiene las 3 fotos permitidas.';
  else nota.textContent = 'Puede tomarla con la cámara o elegirla de la galería. Le quedan ' + libres + '.';
}

$('btn-foto').addEventListener('click', function () { $('archivo').click(); });
$('archivo').addEventListener('change', function () {
  var u = S.unidad; if (!u) return;
  var libres = MAX_FOTOS - (u.fotos || []).length - S.cola.length;
  var archivos = Array.prototype.slice.call(this.files || []);
  if (archivos.length > libres) {
    window.alert('Solo caben ' + libres + (libres === 1 ? ' foto más' : ' fotos más') + '; se tomarán las primeras.');
    archivos = archivos.slice(0, Math.max(0, libres));
  }
  archivos.forEach(function (f) { S.cola.push({ archivo: f, unidad: u, estado: 'espera' }); });
  this.value = '';
  pintarFotos();
  procesarCola();
});

// Reduce a lado mayor 1280 px y JPEG 0.75 (y baja si pasa de 500 KB), respetando la orientación EXIF.
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
// Bytes que quedan al decodificar: 3 por cada 4 caracteres, menos el relleno '='.
function bytesDeBase64(b64) {
  var relleno = b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0;
  return Math.floor(b64.length / 4) * 3 - relleno;
}
function reducir(archivo) {
  if (archivo.type && archivo.type.indexOf('image/') !== 0) return Promise.reject(new Error('no es imagen'));
  return dibujable(archivo).then(function (img) {
    var w = img.width, h = img.height;
    if (!(w > 0 && h > 0)) throw new Error('no es imagen');
    var c = document.createElement('canvas'), lado = 0, url = '', b64 = '';
    for (var i = 0; i < PASOS_FOTO.length; i++) {
      if (PASOS_FOTO[i][0] !== lado) {
        lado = PASOS_FOTO[i][0];
        var k = Math.min(1, lado / Math.max(w, h));
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);  // PNG con transparencia → fondo blanco
        ctx.drawImage(img, 0, 0, c.width, c.height);
      }
      url = c.toDataURL('image/jpeg', PASOS_FOTO[i][1]);
      b64 = url.slice(url.indexOf(',') + 1);
      if (bytesDeBase64(b64) <= MAX_BYTES) break;
    }
    if (img.close) img.close();
    if (bytesDeBase64(b64) > MAX_BYTES) throw new Error('grande');
    return { base64: b64, vista: url, ancho: c.width, alto: c.height };
  });
}

// Una foto a la vez. Si una falla, se marca y se sigue con las demás.
function procesarCola() {
  if (S.subiendo) return;
  var it = S.cola.filter(function (x) { return x.estado === 'espera'; })[0];
  if (!it) { pintarAcciones(); pintarFotos(); return; }
  S.subiendo = true; it.estado = 'subiendo';
  pintarAcciones(); pintarFotos();
  var terminar = function () { S.subiendo = false; pintarAcciones(); pintarFotos(); procesarCola(); };
  var preparar = it.datos ? Promise.resolve(it.datos) : reducir(it.archivo);
  preparar.then(function (d) {
    it.datos = d; it.vista = d.vista; pintarFotos();
    return llamar('subirFoto', [S.token, S.anio, S.mes, it.unidad.unidad_id, d.base64, d.ancho, d.alto])
      .then(function (r) {
        if (sinSesion(r)) { S.subiendo = false; S.cola = []; return; }
        if (r && r.ok) {
          it.unidad.fotos = it.unidad.fotos || [];
          it.unidad.fotos.push({ foto_id: r.foto_id });
          S.miniaturas[r.foto_id] = d.vista;
          S.cola = S.cola.filter(function (x) { return x !== it; });
        } else {
          it.estado = 'error'; it.msg = (r && r.msg) || 'Intente de nuevo.';
          it.sinReintento = !!(r && /^(MAX_FOTOS|MES_CERRADO|PERIODO_FUTURO|SIN_CAPTURA|FOTO_GRANDE|NO_ES_JPEG|FOTO_INVALIDA|UNIDAD_AJENA|PERIODO_INVALIDO)$/.test(r.code));
        }
        terminar();
      }, function () { it.estado = 'error'; it.msg = 'Sin conexión.'; terminar(); });
  }, function (e) {
    it.estado = 'error'; it.sinReintento = true;
    it.msg = e && e.message === 'grande' ? 'La foto es demasiado grande.' : 'Ese archivo no es una imagen que se pueda leer.';
    terminar();
  });
}

// Miniaturas de las fotos ya guardadas: una por una, solo mientras la hoja siga abierta.
function cargarMiniaturas(u) {
  var gen = S.verGen;
  var faltan = (u.fotos || []).filter(function (f) { return !S.miniaturas[f.foto_id]; });
  (function siguiente() {
    var f = faltan.shift();
    if (!f || gen !== S.verGen || !S.token) return;
    llamar('verFoto', [S.token, f.foto_id]).then(function (r) {
      if (sinSesion(r)) return;
      if (r && r.ok && r.base64) S.miniaturas[f.foto_id] = 'data:image/jpeg;base64,' + r.base64;
      if (gen === S.verGen) pintarFotos();
      siguiente();
    }, function () { siguiente(); });
  })();
}

function borrarFoto(f) {
  var u = S.unidad;
  if (!u || S.estado.cerrado || S.ocupado || S.subiendo) return;
  if (!window.confirm('¿Borrar esta foto?')) return;
  quitarFoto(f);
}

function quitarFoto(f) {
  var u = S.unidad;
  if (!u) return;
  $('error-unidad').textContent = '';
  S.ocupado = true; pintarAcciones(); pintarFotos();
  llamar('borrarFoto', [S.token, S.anio, S.mes, f.foto_id]).then(function (r) {
    S.ocupado = false;
    if (sinSesion(r)) return;
    // NO_EXISTE: ya no estaba; se quita igual de la pantalla.
    if (r && (r.ok || r.code === 'NO_EXISTE')) {
      u.fotos = (u.fotos || []).filter(function (x) { return x !== f; });
      delete S.miniaturas[f.foto_id];
    } else {
      falla('error-unidad', r, function () { quitarFoto(f); });
    }
    pintarAcciones(); pintarFotos();
  }, function () {
    S.ocupado = false; pintarAcciones(); pintarFotos();
    mostrarError('error-unidad', MSG_RED, function () { quitarFoto(f); });
  });
}

S.boleto = boletoDeLaDireccion();
iniciar();
