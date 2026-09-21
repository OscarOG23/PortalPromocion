var CLAVE_BOLETO = 'mascara_boleto';
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
             'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var ETIQUETAS_ESTADO = { REPORTADO: 'Reportado', PENDIENTE: 'Pendiente', NO_SE_SABE: 'Sin dato' };
var MINUTOS_REFRESCO = 60;
var ultimaCarga = 0;

function el(id) { return document.getElementById(id); }

function leerBoleto() {
  try { return localStorage.getItem(CLAVE_BOLETO); } catch (e) { return null; }
}
function guardarBoleto(b) {
  try {
    if (b) localStorage.setItem(CLAVE_BOLETO, b); else localStorage.removeItem(CLAVE_BOLETO);
  } catch (e) {}
}

// Content-Type text/plain A PROPÓSITO: con application/json el navegador manda
// antes un OPTIONS que Apps Script no contesta (no existe doOptions), y la
// llamada muere. doPost recibe el cuerpo igual en e.postData.contents.
function llamar(accion, datos) {
  var cuerpo = Object.assign({ accion: accion }, datos || {});
  var control = new AbortController();
  var reloj = setTimeout(function () { control.abort(); }, 20000);
  return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                           body: JSON.stringify(cuerpo), signal: control.signal })
    .then(function (r) { return r.json(); })
    .catch(function () {
      return { ok: false, code: 'SIN_CONEXION', message: 'No se pudo conectar. Revise su internet e intente de nuevo.' };
    })
    .finally(function () { clearTimeout(reloj); });
}

function mostrar(seccion) {
  ['acceso', 'portal', 'cargando'].forEach(function (id) { el(id).hidden = id !== seccion; });
}

function mostrarAcceso(mensaje) {
  el('error-acceso').textContent = mensaje || '';
  mostrar('acceso');
  el('usuario').focus();
}

function pintarPortal(ctx) {
  el('identidad').textContent = ctx.usuario.nombre;
  var mes = parseInt(ctx.periodo.mes, 10);
  el('periodo').textContent = mes >= 1 && mes <= 12 ? 'Periodo: ' + MESES[mes - 1] + ' ' + ctx.periodo.anio : '';

  var contenedor = el('apartados');
  contenedor.replaceChildren();
  var grupos = {};
  var orden = [];
  ctx.destinos.forEach(function (d) {
    var clave = d.apartado || 'Capturadores';
    if (!grupos[clave]) { grupos[clave] = []; orden.push(clave); }
    grupos[clave].push(d);
  });

  orden.forEach(function (clave) {
    var seccion = document.createElement('section');
    seccion.className = 'apartado';
    var titulo = document.createElement('h2');
    titulo.textContent = clave;
    var lista = document.createElement('ul');
    lista.className = 'destinos';
    grupos[clave].forEach(function (d) { lista.appendChild(renglon(d)); });
    seccion.appendChild(titulo);
    seccion.appendChild(lista);
    contenedor.appendChild(seccion);
  });

  el('sin-destinos').hidden = ctx.destinos.length > 0;
  mostrar('portal');
}

function renglon(d) {
  var li = document.createElement('li');
  li.className = 'destino';
  var caja;
  if (d.enlace) {
    caja = document.createElement('a');
    caja.href = d.enlace;
    caja.target = '_blank';
    caja.rel = 'noopener noreferrer';
  } else {
    caja = document.createElement('div');
    caja.className = 'sin-enlace';
  }
  var nombre = document.createElement('span');
  nombre.className = 'nombre';
  nombre.textContent = d.enlace ? d.nombre : d.nombre + ' — No disponible';
  var estado = document.createElement('span');
  var codigo = ETIQUETAS_ESTADO[d.estado] ? d.estado : 'NO_SE_SABE';
  estado.className = 'estado estado-' + codigo;
  estado.textContent = ETIQUETAS_ESTADO[codigo];
  caja.appendChild(nombre);
  caja.appendChild(estado);
  li.appendChild(caja);
  return li;
}

function cargarContexto() {
  var boleto = leerBoleto();
  if (!boleto) { mostrarAcceso(''); return; }
  llamar('contexto', { boleto: boleto }).then(function (r) {
    if (r.ok) { ultimaCarga = Date.now(); pintarPortal(r); return; }
    if (r.code === 'BOLETO_INVALIDO' || r.code === 'BOLETO_VENCIDO') {
      guardarBoleto(null);
      mostrarAcceso(r.message);
      return;
    }
    // Sin conexión o error del servidor: el boleto sigue siendo bueno, no se borra.
    mostrarAcceso(r.message || 'Algo salió mal. Intente de nuevo.');
  });
}

el('form-acceso').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var boton = el('btn-entrar');
  boton.disabled = true;
  el('error-acceso').textContent = '';
  llamar('iniciarSesion', { usuario: el('usuario').value, contrasena: el('contrasena').value })
    .then(function (r) {
      boton.disabled = false;
      if (!r.ok) { el('error-acceso').textContent = r.message; return; }
      guardarBoleto(r.boleto);
      el('contrasena').value = '';
      mostrar('cargando');
      cargarContexto();
    });
});

el('btn-salir').addEventListener('click', function () {
  guardarBoleto(null);
  mostrarAcceso('');
});

// Los boletos de cada destino duran 8 horas. Si la página se quedó abierta en
// el teléfono, al volver a ella se piden enlaces nuevos.
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && leerBoleto() &&
      Date.now() - ultimaCarga > MINUTOS_REFRESCO * 60000) {
    cargarContexto();
  }
});

cargarContexto();
