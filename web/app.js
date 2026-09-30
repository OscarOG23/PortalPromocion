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

// Cuentas de persona (fase 7): la cabecera dice su disciplina y su unidad.
var DISCIPLINAS = { NUTRICION: 'Nutrición', PSICOLOGIA: 'Psicología', PROMOTOR: 'Promoción' };

// Qué dice la cabecera y el aviso sin destinos. Una coordinación (o una
// respuesta sin rol, de antes de la fase 7) se ve igual que siempre.
function textosDeCuenta(usuario) {
  var rol = String((usuario && usuario.rol) || '').toUpperCase();
  if (rol === 'ADMIN') return { sobre: 'Administración', vacio: '' };
  if (!rol || rol === 'COORDINACION') {
    return { sobre: 'Coordinación',
             vacio: 'Todavía no hay capturadores asignados a su coordinación.' };
  }
  var partes = [DISCIPLINAS[rol] || rol];
  if (usuario.unidad) partes.push(usuario.unidad);
  return { sobre: partes.join(' · '), vacio: 'Aún no hay formularios para su perfil.' };
}

// Admin "viendo como" otra cuenta: vive en la pestaña (sessionStorage), así
// que cerrar la pestaña devuelve al admin a su propia vista.
var CLAVE_COMO = 'mascara_como';
var verComo = leerComo();

function leerComo() {
  try { return sessionStorage.getItem(CLAVE_COMO) || ''; } catch (e) { return ''; }
}
function guardarComo(usuario) {
  verComo = usuario || '';
  try {
    if (verComo) sessionStorage.setItem(CLAVE_COMO, verComo); else sessionStorage.removeItem(CLAVE_COMO);
  } catch (e) {}
}

var MINUTOS_REFRESCO = 60;
var ultimaCarga = 0;
var generacionContexto = 0;
var contextoEnCurso = null;

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
function llamar(accion, datos, esperaMs) {
  var cuerpo = Object.assign({ accion: accion }, datos || {});
  var control = new AbortController();
  var reloj = setTimeout(function () { control.abort(); }, esperaMs || 20000);
  return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                           body: JSON.stringify(cuerpo), signal: control.signal })
    .then(function (r) { if (!r.ok) throw new Error('HTTP'); return r.json(); })
    .then(function (r) { if (!r || typeof r.ok !== 'boolean') throw new Error('Respuesta inválida'); return r; })
    .catch(function () {
      return { ok: false, code: 'SIN_CONEXION', message: 'No se pudo conectar. Revise su internet e intente de nuevo.' };
    })
    .finally(function () { clearTimeout(reloj); });
}

// Solo lecturas de avances. Si otro dispositivo ya está consultando, se
// espera su resultado con pausas crecientes y un límite de reintentos.
var ESPERAS_AVANCE_MS = [5000, 10000, 20000, 30000, 30000, 30000];
function llamarAvance(accion, datos, vigente, intento) {
  intento = intento || 0;
  if (!vigente()) return Promise.resolve(null);
  return llamar(accion, datos, 150000).then(function (r) {
    if (!vigente()) return null;
    if (r.ok && r.consultando && intento < ESPERAS_AVANCE_MS.length) {
      return new Promise(function (resolver) {
        setTimeout(function () {
          resolver(llamarAvance(accion, datos, vigente, intento + 1));
        }, ESPERAS_AVANCE_MS[intento]);
      });
    }
    return r;
  });
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

function ponerTexto(id, texto) {
  var nodo = el(id);
  if (nodo) nodo.textContent = texto;
}

// --- Portal -------------------------------------------------------------------

function pintarPortal(ctx) {
  var textos = textosDeCuenta(ctx.usuario);
  // Con una página vieja en caché estos elementos pueden no existir todavía:
  // se escribe solo en los que estén, para que el portal nunca se quede trabado.
  ponerTexto('cabecera-sobre', textos.sobre);
  ponerTexto('identidad', ctx.usuario.nombre);
  ponerTexto('sin-destinos-texto', textos.vacio);

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

  var esAdminCtx = ctx.usuario.rol === 'ADMIN';
  el('admin').hidden = !esAdminCtx;
  pintarBandaComo(ctx.verComo, ctx.usuario.nombre);

  var contenedor = el('apartados');
  contenedor.replaceChildren();
  if (esAdminCtx) {
    el('resumen').hidden = true;
    el('sin-destinos').hidden = true;
    pintarAdmin(ctx);
    mostrar('portal');
    return;
  }

  pintarResumen(ctx.destinos);
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

// --- Administración -------------------------------------------------------------

function pintarBandaComo(como, nombre) {
  var banda = el('banda-como');
  banda.hidden = !como;
  if (como) el('banda-como-texto').textContent = 'Viendo como ' + nombre + '.';
}

var ETIQUETAS_GRUPO = { NUTRICION: 'Nutrición', PSICOLOGIA: 'Psicología', PROMOTOR: 'Promoción' };
var tableroCargado = false;

function pintarAdmin(ctx) {
  var sel = el('ver-como');
  var previo = sel.value;
  sel.replaceChildren();
  var grupos = [{ etiqueta: 'Coordinaciones', cuentas: ctx.admin.coordinaciones }];
  var porRol = {};
  ctx.admin.personas.forEach(function (p) {
    if (!porRol[p.rol]) { porRol[p.rol] = []; grupos.push({ etiqueta: ETIQUETAS_GRUPO[p.rol] || p.rol, cuentas: porRol[p.rol] }); }
    porRol[p.rol].push(p);
  });
  grupos.forEach(function (g) {
    if (!g.cuentas.length) return;
    var og = document.createElement('optgroup');
    og.label = g.etiqueta;
    g.cuentas.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.usuario;
      o.textContent = c.nombre + (c.unidad ? ' · ' + c.unidad : '');
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  if (previo) sel.value = previo;
  if (!tableroCargado) cargarTablero();
}

function elegirPestana(cual) {
  var tablero = cual === 'tablero';
  el('tab-tablero').setAttribute('aria-selected', tablero ? 'true' : 'false');
  el('tab-como').setAttribute('aria-selected', tablero ? 'false' : 'true');
  el('panel-tablero').hidden = !tablero;
  el('panel-como').hidden = tablero;
}

// El tablero llega en dos tiempos: primero las columnas y las coordinaciones
// (al instante) y luego cada fila por separado, varias a la vez. Consultar
// las 22 de un jalón pasaba del límite de 6 minutos de Apps Script.
var FILAS_A_LA_VEZ = 4;
var generacionTablero = 0;
var tableroActual = null;

function cargarTablero() {
  var boleto = leerBoleto();
  if (!boleto) return;
  var gen = ++generacionTablero;
  tableroCargado = true;
  el('btn-tablero').disabled = true;
  el('tablero-nota').textContent = 'Preparando el tablero…';
  llamar('tablero', { boleto: boleto }).then(function (r) {
    if (gen !== generacionTablero || leerBoleto() !== boleto) return;
    if (!r.ok) {
      tableroCargado = false;
      el('btn-tablero').disabled = false;
      el('tablero-nota').textContent = r.message || 'No se pudo cargar el tablero.';
      return;
    }
    tableroActual = r;
    pintarTablero(r);
    cargarFilas(r, boleto, gen);
  });
}

function cargarFilas(t, boleto, gen) {
  var pendientes = t.filas.map(function (f) { return f.usuario; });
  var terminadas = 0;
  function notaAvance() {
    el('tablero-nota').textContent = 'Consultando coordinaciones: ' + terminadas + ' de ' + t.filas.length + '…';
  }
  function siguiente() {
    if (gen !== generacionTablero) return;
    var usuario = pendientes.shift();
    if (!usuario) {
      if (terminadas === t.filas.length) terminarTablero(t);
      return;
    }
    llamarAvance('tableroFila', { boleto: boleto, usuario: usuario }, function () {
      return gen === generacionTablero && leerBoleto() === boleto;
    }).then(function (r) {
      if (!r || gen !== generacionTablero) return;
      terminadas++;
      pintarFila(usuario, r.ok ? r : null, t.columnas);
      notaAvance();
      siguiente();
    });
  }
  notaAvance();
  for (var k = 0; k < FILAS_A_LA_VEZ; k++) siguiente();
}

function terminarTablero(t) {
  el('btn-tablero').disabled = false;
  var alDia = t.filas.filter(function (f) { return f.total && f.reportados === f.total; }).length;
  var mes = parseInt(t.periodo.mes, 10);
  el('tablero-nota').textContent = alDia + ' de ' + t.filas.length +
    ' coordinaciones con todo reportado' + (mes >= 1 && mes <= 12 ? ' · ' + MESES[mes - 1] + ' ' + t.periodo.anio : '') +
    '. Toque una coordinación para ver como ella.';
}

function celdaEstado(codigo) {
  var td = document.createElement('td');
  if (codigo === undefined) {
    td.className = 'c-cargando';
    td.textContent = '…';
    td.title = 'Consultando';
    return td;
  }
  if (!codigo) {
    td.className = 'c-vacio';
    td.textContent = '—';
    td.title = 'No le aplica';
    return td;
  }
  codigo = ETIQUETAS_ESTADO[codigo] ? codigo : 'NO_SE_SABE';
  td.className = 'c-' + codigo;
  td.title = ETIQUETAS_ESTADO[codigo];
  td.appendChild(icono(ICONOS_ESTADO[codigo]));
  td.appendChild(nodo('span', 'solo-lector', ETIQUETAS_ESTADO[codigo]));
  return td;
}

function pintarTablero(t) {
  var tabla = el('tablero');
  tabla.replaceChildren();
  var thead = document.createElement('thead');
  var cab = document.createElement('tr');
  var esquina = document.createElement('th');
  esquina.scope = 'col';
  esquina.textContent = 'Coordinación';
  cab.appendChild(esquina);
  t.columnas.concat([{ nombre: 'Al día' }]).forEach(function (c) {
    var th = document.createElement('th');
    th.scope = 'col';
    th.textContent = c.nombre;
    cab.appendChild(th);
  });
  thead.appendChild(cab);
  tabla.appendChild(thead);

  var cuerpo = document.createElement('tbody');
  t.filas.forEach(function (f) {
    var tr = document.createElement('tr');
    tr.dataset.usuario = f.usuario;
    var th = document.createElement('th');
    th.scope = 'row';
    var b = nodo('button', 'btn-enlace', f.nombre);
    b.type = 'button';
    b.title = 'Ver como ' + f.nombre;
    b.addEventListener('click', function () { entrarComo(f.usuario); });
    th.appendChild(b);
    tr.appendChild(th);
    t.columnas.forEach(function () { tr.appendChild(celdaEstado(undefined)); });
    tr.appendChild(nodo('td', 'cuenta', '…'));
    cuerpo.appendChild(tr);
  });
  tabla.appendChild(cuerpo);
}

// fila = respuesta de tableroFila, o null si falló (se marca "sin dato").
function pintarFila(usuario, fila, columnas) {
  var tr = Array.prototype.filter.call(el('tablero').querySelectorAll('tbody tr'),
    function (x) { return x.dataset.usuario === usuario; })[0];
  if (!tr) return;
  var th = tr.firstChild;
  tr.replaceChildren(th);
  columnas.forEach(function (c) {
    var codigo = fila ? (fila.estados[c.destino_id] || '') : 'NO_SE_SABE';
    tr.appendChild(celdaEstado(codigo));
  });
  tr.appendChild(nodo('td', 'cuenta', fila ? fila.reportados + '/' + fila.total : '—'));
  var resumen = tableroActual && tableroActual.filas.filter(function (f) { return f.usuario === usuario; })[0];
  if (resumen && fila) { resumen.reportados = fila.reportados; resumen.total = fila.total; }
}

function entrarComo(usuario) {
  if (!usuario) return;
  guardarComo(usuario);
  mostrar('cargando');
  cargarContexto();
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
  li.dataset.destino = d.destino_id;
  li.style.setProperty('--i', i);

  // Defensa en profundidad: aunque el servidor ya filtra, aquí no se arma un
  // <a> salvo que el enlace sea de verdad una URL https.
  var tieneEnlace = typeof d.enlace === 'string' && /^https:\/\//.test(d.enlace);
  var caja;
  if (tieneEnlace) {
    caja = nodo('a', 'tarjeta');
    caja.href = d.enlace;
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
  var como = verComo;
  if (contextoEnCurso && contextoEnCurso.boleto === boleto && contextoEnCurso.como === como) return;
  var gen = ++generacionContexto;
  contextoEnCurso = { boleto: boleto, como: como };
  var peticion = como ? llamar('contextoComo', { boleto: boleto, usuario: como, omitirSondas: true })
                      : llamar('contexto', { boleto: boleto, omitirSondas: true });
  peticion.then(function (r) {
    if (gen !== generacionContexto) return;
    contextoEnCurso = null;
    // El usuario pudo haber salido (o cambiado de boleto) mientras la
    // llamada estaba en el aire: una respuesta vieja no debe pisar la nueva.
    if (leerBoleto() !== boleto || verComo !== como) return;

    // "Ver como" ya no procede (la cuenta se dio de baja, o este boleto no es
    // de admin): se vuelve a la vista propia.
    if (como && (r.code === 'NO_AUTORIZADO' || r.code === 'CUENTA_NO_DISPONIBLE')) {
      guardarComo('');
      cargarContexto();
      return;
    }

    if (r.ok) {
      ultimaCarga = Date.now();
      mostrarAvisoPortal('');
      try {
        pintarPortal(r);
        // Solo al ENTRAR al portal (recién logueado o recién cargada la
        // página): un refresco periódico con el portal ya abierto no debe
        // robarle el foco a quien está leyendo.
        if (entrandoAlPortal) el('identidad').focus();
        if (r.estadosPendientes && r.destinos.length) cargarEstados(r, boleto, como, gen);
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

function cargarEstados(ctx, boleto, como, gen) {
  mostrarAvisoPortal('Actualizando avances. Ya puede abrir los capturadores.');
  llamarAvance('estados', { boleto: boleto, usuario: como || '' }, function () {
    return gen === generacionContexto && leerBoleto() === boleto && verComo === como;
  }).then(function (r) {
    if (!r || gen !== generacionContexto || leerBoleto() !== boleto || verComo !== como) return;
    if (!r.ok || !r.estados || !r.periodo || String(r.periodo.anio) !== String(ctx.periodo.anio) ||
        String(r.periodo.mes) !== String(ctx.periodo.mes)) {
      mostrarAvisoPortal('No se pudo actualizar el avance. Puede seguir usando los capturadores.');
      return;
    }
    ctx.destinos.forEach(function (d) { d.estado = r.estados[d.destino_id] || 'NO_SE_SABE'; });
    Array.prototype.forEach.call(el('apartados').querySelectorAll('.destino'), function (fila) {
      var d = ctx.destinos.filter(function (x) { return x.destino_id === fila.dataset.destino; })[0];
      var indicador = fila.querySelector('.estado');
      if (!d || !indicador) return;
      var codigo = codigoDeEstado(d);
      indicador.className = 'estado estado-' + codigo;
      indicador.replaceChildren(icono(ICONOS_ESTADO[codigo]), document.createTextNode(ETIQUETAS_ESTADO[codigo]));
    });
    pintarResumen(ctx.destinos);
    mostrarAvisoPortal(r.consultando ? 'Los avances siguen consultándose. Puede usar los capturadores y actualizar más tarde.' : '');
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
  if (el('btn-entrar').disabled) return;
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
        if (r.code === 'CREDENCIALES_INVALIDAS') el('como-entro').open = true;
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

el('tab-tablero').addEventListener('click', function () { elegirPestana('tablero'); });
el('tab-como').addEventListener('click', function () { elegirPestana('como'); });
el('btn-tablero').addEventListener('click', cargarTablero);
el('btn-ver-como').addEventListener('click', function () { entrarComo(el('ver-como').value); });
el('btn-volver-admin').addEventListener('click', function () {
  guardarComo('');
  mostrar('cargando');
  cargarContexto();
});

el('btn-salir').addEventListener('click', function () {
  generacionContexto++;
  generacionTablero++;
  contextoEnCurso = null;
  guardarComo('');
  tableroCargado = false;
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
