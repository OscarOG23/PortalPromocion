var CLAVE_BOLETO = 'mascara_boleto';
var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
             'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var ETIQUETAS_ESTADO = { REPORTADO: 'Reportado', PENDIENTE: 'Pendiente', NO_SE_SABE: 'Sin dato' };
var ICONOS_ESTADO = { REPORTADO: 'i-listo', PENDIENTE: 'i-reloj', NO_SE_SABE: 'i-guion' };

// Ícono y tono de cada capturador conocido; los nuevos toman el de su clase.
var ICONOS_DESTINO = {
  determinantes: ['i-grupo', ''],
  mensual_coordinacion: ['i-grafica', 'tono-verde'],
  sips: ['i-estrella', 'tono-dorado']
};
var ICONOS_CLASE = {
  HERMANO_CON_CONTRASENA: ['i-portapapeles', ''],
  HERMANO_SIN_CONTRASENA: ['i-calendario', 'tono-verde'],
  FORMULARIO: ['i-documento', 'tono-dorado']
};
var DETALLES_CLASE = {
  HERMANO_CON_CONTRASENA: 'Entra con su sesión',
  HERMANO_SIN_CONTRASENA: 'Llega con su coordinación elegida',
  FORMULARIO: 'Formulario ya prellenado'
};

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

// --- Piezas de interfaz -------------------------------------------------------

var SVG = 'http://www.w3.org/2000/svg';

function icono(id) {
  var svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  var use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', '#' + id);
  svg.appendChild(use);
  return svg;
}

function nodo(etiqueta, clase, texto) {
  var n = document.createElement(etiqueta);
  if (clase) n.className = clase;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

// Muestra una vista y la anima al entrar. La animación es solo CSS: si el
// sistema pide movimiento reducido, la hoja de estilos la apaga.
function mostrar(seccion) {
  ['acceso', 'portal', 'cargando'].forEach(function (id) {
    var v = el(id);
    var visible = id === seccion;
    if (visible && v.hidden) {
      v.classList.remove('entrando');
      void v.offsetWidth;            // reinicia la animación
      v.classList.add('entrando');
    }
    v.hidden = !visible;
  });
}

function mostrarAcceso(mensaje) {
  el('error-acceso').textContent = mensaje || '';
  mostrar('acceso');
  el('usuario').focus();
}

function sacudir(nodoASacudir) {
  nodoASacudir.classList.remove('sacudir');
  void nodoASacudir.offsetWidth;
  nodoASacudir.classList.add('sacudir');
}

// --- Portal -------------------------------------------------------------------

function pintarPortal(ctx) {
  el('identidad').textContent = ctx.usuario.nombre;

  var mes = parseInt(ctx.periodo.mes, 10);
  var periodo = el('periodo');
  periodo.replaceChildren();
  if (mes >= 1 && mes <= 12) {
    periodo.appendChild(icono('i-calendario'));
    periodo.appendChild(document.createTextNode(MESES[mes - 1] + ' ' + ctx.periodo.anio));
    periodo.hidden = false;
  } else {
    periodo.hidden = true;
  }

  pintarResumen(ctx.destinos);

  var contenedor = el('apartados');
  contenedor.replaceChildren();
  var grupos = {};
  var orden = [];
  ctx.destinos.forEach(function (d) {
    var clave = d.apartado || 'Capturadores';
    if (!grupos[clave]) { grupos[clave] = []; orden.push(clave); }
    grupos[clave].push(d);
  });

  var i = 0;
  orden.forEach(function (clave) {
    var seccion = nodo('section', 'apartado');
    var lista = nodo('ul', 'destinos');
    grupos[clave].forEach(function (d) { lista.appendChild(renglon(d, i++)); });
    seccion.appendChild(nodo('h2', '', clave));
    seccion.appendChild(lista);
    contenedor.appendChild(seccion);
  });

  el('sin-destinos').hidden = ctx.destinos.length > 0;
  mostrar('portal');
}

function codigoDeEstado(d) {
  return ETIQUETAS_ESTADO[d.estado] ? d.estado : 'NO_SE_SABE';
}

// "2 de 3 reportados" y una barra con un tramo por capturador. Lo que no se
// sabe no se cuenta como reportado: se dice aparte.
function pintarResumen(destinos) {
  var resumen = el('resumen');
  if (!destinos.length) { resumen.hidden = true; return; }

  var cuenta = { REPORTADO: 0, PENDIENTE: 0, NO_SE_SABE: 0 };
  var barra = el('resumen-barra');
  barra.replaceChildren();
  destinos.forEach(function (d, i) {
    var codigo = codigoDeEstado(d);
    cuenta[codigo]++;
    var tramo = nodo('span', 't-' + codigo);
    tramo.style.setProperty('--i', i);
    barra.appendChild(tramo);
  });

  el('resumen-hechos').textContent = cuenta.REPORTADO;
  el('resumen-total').textContent = destinos.length;

  var partes = [];
  if (cuenta.PENDIENTE) partes.push(cuenta.PENDIENTE + (cuenta.PENDIENTE === 1 ? ' pendiente' : ' pendientes'));
  if (cuenta.NO_SE_SABE) partes.push(cuenta.NO_SE_SABE + ' sin dato');
  el('resumen-nota').textContent = partes.length ? partes.join(' · ') : 'Todo al día este mes';
  resumen.hidden = false;
}

function renglon(d, i) {
  var li = nodo('li', 'destino');
  li.style.setProperty('--i', i);

  // Defensa en profundidad: aunque el servidor ya filtra, aquí no se arma un
  // <a> salvo que el enlace sea de verdad una URL https.
  var tieneEnlace = typeof d.enlace === 'string' && /^https:\/\//.test(d.enlace);
  var caja;
  if (tieneEnlace) {
    caja = nodo('a', 'tarjeta');
    caja.href = d.enlace;
    caja.target = '_blank';
    caja.rel = 'noopener noreferrer';
  } else {
    caja = nodo('div', 'tarjeta sin-enlace');
  }

  var id = String(d.destino_id || '');
  var aspecto = ICONOS_DESTINO[id] || ICONOS_CLASE[d.clase] || ['i-documento', ''];
  var tile = nodo('span', 'icono-destino ' + aspecto[1]);
  tile.appendChild(icono(aspecto[0]));

  var cuerpo = nodo('span', 'cuerpo');
  var nombre = nodo('span', 'nombre', d.nombre + (tieneEnlace ? '' : ' — No disponible'));
  if (tieneEnlace) nombre.appendChild(nodo('span', 'solo-lector', ' (abre en otra pestaña)'));

  var codigo = codigoDeEstado(d);
  var estado = nodo('span', 'estado estado-' + codigo);
  estado.appendChild(icono(ICONOS_ESTADO[codigo]));
  estado.appendChild(document.createTextNode(ETIQUETAS_ESTADO[codigo]));

  var fila = nodo('span', 'detalle-fila');
  fila.appendChild(estado);
  if (DETALLES_CLASE[d.clase]) fila.appendChild(nodo('span', 'detalle', DETALLES_CLASE[d.clase]));

  cuerpo.appendChild(nombre);
  cuerpo.appendChild(fila);

  caja.appendChild(tile);
  caja.appendChild(cuerpo);
  if (tieneEnlace) {
    var flecha = icono('i-abrir');
    flecha.classList.add('flecha');
    caja.appendChild(flecha);
  }
  li.appendChild(caja);
  return li;
}

function mostrarAvisoPortal(mensaje) {
  var aviso = el('aviso-portal');
  aviso.replaceChildren();
  if (mensaje) {
    aviso.appendChild(icono('i-aviso'));
    aviso.appendChild(nodo('span', '', mensaje));
  }
  aviso.hidden = !mensaje;
}

function cargarContexto() {
  var boleto = leerBoleto();
  if (!boleto) { mostrarAcceso(''); return; }
  var entrandoAlPortal = el('portal').hidden;
  llamar('contexto', { boleto: boleto }).then(function (r) {
    // El usuario pudo haber salido (o cambiado de boleto) mientras la
    // llamada estaba en el aire: una respuesta vieja no debe pisar la nueva.
    if (leerBoleto() !== boleto) return;

    if (r.ok) {
      ultimaCarga = Date.now();
      mostrarAvisoPortal('');
      try {
        pintarPortal(r);
        // Solo al ENTRAR al portal (recién logueado o recién cargada la
        // página): un refresco periódico con el portal ya abierto no debe
        // robarle el foco a quien está leyendo.
        if (entrandoAlPortal) el('identidad').focus();
      } catch (e) {
        mostrarAcceso('Algo salió mal. Intente de nuevo.');
      }
      return;
    }
    if (r.code === 'BOLETO_INVALIDO' || r.code === 'BOLETO_VENCIDO') {
      guardarBoleto(null);
      mostrarAcceso(r.message);
      return;
    }
    // Sin conexión o error del servidor: el boleto sigue siendo bueno, no se
    // borra. Si el portal ya se veía, se queda ahí (los enlaces ya cargados
    // siguen sirviendo); si no, se manda al acceso como antes.
    if (!el('portal').hidden) {
      mostrarAvisoPortal('No se pudo actualizar. Los enlaces siguen sirviendo; intente más tarde.');
      return;
    }
    mostrarAcceso(r.message || 'Algo salió mal. Intente de nuevo.');
  });
}

// --- Acceso -------------------------------------------------------------------

function ocupado(boton, si) {
  boton.disabled = si;
  boton.setAttribute('aria-busy', si ? 'true' : 'false');
  boton.querySelector('.btn-texto').textContent = si ? 'Entrando…' : 'Entrar';
}

el('form-acceso').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var usuario = el('usuario').value.trim();
  var contrasena = el('contrasena').value;
  if (!usuario || !contrasena) {
    el('error-acceso').textContent = 'Escriba usuario y contraseña.';
    sacudir(el('tarjeta-acceso'));
    return;
  }
  var boton = el('btn-entrar');
  ocupado(boton, true);
  el('error-acceso').textContent = '';
  llamar('iniciarSesion', { usuario: usuario, contrasena: contrasena })
    .then(function (r) {
      ocupado(boton, false);
      if (!r.ok) {
        el('error-acceso').textContent = r.message || 'Algo salió mal. Intente de nuevo.';
        sacudir(el('tarjeta-acceso'));
        return;
      }
      guardarBoleto(r.boleto);
      el('contrasena').value = '';
      mostrar('cargando');
      cargarContexto();
    });
});

el('btn-ver-clave').addEventListener('click', function () {
  var campo = el('contrasena');
  var ver = campo.type === 'password';
  campo.type = ver ? 'text' : 'password';
  this.setAttribute('aria-pressed', ver ? 'true' : 'false');
  this.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
  this.querySelector('use').setAttribute('href', ver ? '#i-ojo-no' : '#i-ojo');
  campo.focus();
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
