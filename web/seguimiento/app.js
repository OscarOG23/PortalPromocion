(function () {
  'use strict';
  var datos = null, boleto = '', carga = 0, guardando = false, periodoCargado = '';
  var borradores = new Map();
  var estados = {
    ELEGIBLE: 'Elegible', REPORTADO: 'Reportado', COMPLETO: 'Completo', CERRADO: 'Cerrado',
    CERO_DECLARADO: 'Cero declarado', SIN_REPORTE: 'Sin reporte', SIN_DATO: 'Sin dato',
    EN_REVISION: 'En revisión', BORRADOR: 'Borrador', PARCIAL: 'Corte parcial', CORTE_PARCIAL: 'Corte parcial',
    NO_APLICABLE: 'No aplicable', NO_EVALUABLE: 'No evaluable', META_NO_DEFINIDA: 'Meta no definida',
    META_AUSENTE: 'Meta no definida', META_CERO: 'Meta cero', FUENTE_SIN_ACTUALIZAR: 'Fuente sin actualizar',
    PENDIENTE: 'Pendiente', DISPONIBLE: 'Disponible', SIN_CONFIGURAR: 'Sin configurar',
    ABIERTA: 'Abierta', EN_PROCESO: 'En proceso', ATENDIDA: 'Atendida',
    FALTA_ACTIVIDAD: 'Falta de actividad', FALTA_REPORTE: 'Falta de reporte', FALTA_EVIDENCIA: 'Falta de evidencia',
    IDENTIDAD_PENDIENTE: 'Identidad pendiente', DIFERENCIA_FUENTES: 'Diferencia entre fuentes'
  };
  function el(id) { return document.getElementById(id); }
  function texto(valor, vacio) { return valor === null || valor === undefined || valor === '' ? (vacio || 'Sin dato') : String(valor); }
  function etiqueta(valor) { return estados[valor] || texto(valor).replace(/_/g, ' '); }
  function numero(valor, vacio) {
    if (valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor))) return vacio || 'Sin dato';
    return Number(valor).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  }
  function nodo(tag, contenido, clase) {
    var n = document.createElement(tag);
    if (contenido !== undefined) n.textContent = contenido;
    if (clase) n.className = clase;
    return n;
  }
  function aviso(mensaje, error) {
    el('aviso').textContent = mensaje || '';
    el('aviso').hidden = !mensaje;
    el('aviso').className = 'aviso' + (error ? ' error' : '');
    el('aviso').setAttribute('role', error ? 'alert' : 'status');
  }
  function controles(ocupado) {
    ['periodo', 'unidad', 'programa', 'actualizar'].forEach(function (id) { el(id).disabled = ocupado; });
    el('actualizar').textContent = ocupado && !guardando ? 'Consultando…' : 'Actualizar consulta';
    el('contenido').setAttribute('aria-busy', String(ocupado));
  }
  async function llamar(accion, args) {
    if (typeof ENDPOINT !== 'string' || !ENDPOINT) throw new Error('No está configurado el servicio de seguimiento.');
    var control = new AbortController(), reloj = setTimeout(function () { control.abort(); }, 25000);
    try {
      var response = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ accion: accion, boleto: boleto }, args)), signal: control.signal
      });
      if (!response.ok) throw new Error('No se pudo consultar el servicio. Intente actualizar de nuevo.');
      var body = await response.json();
      if (!body || body.ok !== true) {
        var e = new Error(body && (body.message || body.msg) || 'El servicio no pudo completar la solicitud.');
        e.code = body && (body.code || body.codigo);
        throw e;
      }
      return body;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('La consulta tardó demasiado. Intente actualizar de nuevo.');
      if (e instanceof TypeError) throw new Error('No se pudo conectar. Revise su conexión e intente actualizar de nuevo.');
      throw e;
    } finally { clearTimeout(reloj); }
  }
  function opciones(select, items, principal, actual) {
    select.replaceChildren();
    var option = nodo('option', principal); option.value = ''; select.appendChild(option);
    items.forEach(function (item) {
      var o = nodo('option', item.nombre); o.value = String(item.id); select.appendChild(o);
    });
    if (items.some(function (item) { return String(item.id) === actual; })) select.value = actual;
  }
  function fechaMes(periodo) {
    var partes = periodo.split('-');
    return new Date(Number(partes[0]), Number(partes[1]) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }
  async function cargar(mensajeDespues) {
    if (guardando) return;
    var periodo = el('periodo').value, unidad = el('unidad').value, anterior = ++carga;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) { aviso('Seleccione un mes válido para consultar.', true); return; }
    datos = null; el('contenido').hidden = true; controles(true);
    aviso('Consultando los indicadores y pendientes…');
    try {
      var args = { periodo: periodo }; if (unidad) args.unidad_id = unidad;
      var respuesta = await llamar('seguimiento', args);
      if (anterior !== carga) return;
      datos = respuesta; periodoCargado = periodo;
      ['unidades', 'indicadores', 'pendientes', 'fuentes'].forEach(function (k) { if (!Array.isArray(datos[k])) datos[k] = []; });
      el('identidad').textContent = texto(datos.usuario && datos.usuario.nombre, 'Usuario') + ' · ' + etiqueta(datos.usuario && datos.usuario.rol);
      opciones(el('unidad'), datos.unidades, 'Todas mis unidades', unidad);
      var programas = Array.from(new Set(datos.indicadores.concat(datos.pendientes).map(function (i) { return i.programa; }).filter(Boolean))).sort();
      opciones(el('programa'), programas.map(function (p) { return { id: p, nombre: p }; }), 'Todos los programas', el('programa').value);
      el('periodo-vista').textContent = fechaMes(periodo);
      pintar(); el('contenido').hidden = false; aviso(mensajeDespues || '');
    } catch (e) {
      if (anterior === carga) aviso(e.message, true);
    } finally { if (anterior === carga) controles(false); }
  }
  function esRevision(estado) { return /REVISION|BORRADOR|PARCIAL/.test(String(estado || '')); }
  function badge(estado) {
    var clase = esRevision(estado) ? ' revision' : /SIN_|PENDIENTE|META_|NO_EVALUABLE/.test(String(estado || '')) ? ' ausencia' : '';
    return nodo('span', etiqueta(estado), 'estado' + clase);
  }
  function celda(fila, label, contenido, secundario) {
    var td = nodo('td'), interior = nodo('div'); td.dataset.label = label;
    if (contenido instanceof Node) interior.appendChild(contenido); else interior.textContent = contenido;
    if (secundario) interior.appendChild(nodo('span', secundario, 'secundario'));
    td.appendChild(interior); fila.appendChild(td);
  }
  function filtrar(items) {
    var unidad = el('unidad').value, programa = el('programa').value;
    return items.filter(function (i) { return (!unidad || i.unidad_id === unidad) && (!programa || i.programa === programa); });
  }
  function pintar() {
    if (!datos) return;
    var indicadores = filtrar(datos.indicadores), pendientes = filtrar(datos.pendientes);
    el('resumen-indicadores').textContent = String(indicadores.length);
    el('resumen-evaluables').textContent = String(indicadores.filter(function (i) { return !esRevision(i.estado) && i.porcentaje !== null && i.porcentaje !== undefined && i.porcentaje !== '' && Number.isFinite(Number(i.porcentaje)); }).length);
    el('resumen-pendientes').textContent = String(pendientes.filter(function (p) { return p.estado_atencion !== 'ATENDIDA'; }).length);
    el('resumen-unidades').textContent = String(new Set(indicadores.concat(pendientes).map(function (i) { return i.unidad_id; }).filter(Boolean)).size);
    var tbody = el('indicadores').querySelector('tbody'); tbody.replaceChildren();
    indicadores.forEach(function (i) {
      var tr = nodo('tr');
      celda(tr, 'Unidad / programa', texto(i.unidad), texto(i.programa));
      celda(tr, 'Indicador', texto(i.nombre), texto(i.medida));
      celda(tr, 'Actividad', numero(i.valor));
      celda(tr, 'Programación', numero(i.programado, 'Sin programación'));
      celda(tr, 'Meta oficial', numero(i.meta, 'Sin meta'));
      var avance = numero(i.porcentaje, 'No evaluable');
      celda(tr, 'Avance', avance === 'No evaluable' ? avance : avance + ' %');
      celda(tr, 'Faltante', numero(i.faltante, 'No evaluable'));
      celda(tr, 'Estado', badge(i.estado), i.nota ? String(i.nota) : '');
      celda(tr, 'Fuente / corte', texto(i.fuente), texto(i.corte, 'Sin corte'));
      tbody.appendChild(tr);
    });
    el('sin-indicadores').hidden = !!indicadores.length; el('indicadores').hidden = !indicadores.length;
    pintarPendientes(pendientes); pintarFuentes();
  }
  function campo(form, label, name, type, value, id) {
    var grupo = nodo('div', undefined, 'campo' + (name === 'comentario' ? ' campo-comentario' : ''));
    var titulo = nodo('label', label), input = nodo(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
    titulo.htmlFor = id; input.id = id; input.name = name;
    if (type !== 'textarea' && type !== 'select') input.type = type;
    if (name === 'responsable') input.maxLength = 120;
    if (name === 'comentario') { input.maxLength = 1000; input.rows = 3; }
    if (type === 'select') ['ABIERTA', 'EN_PROCESO', 'ATENDIDA'].forEach(function (estado) { var option = nodo('option', etiqueta(estado)); option.value = estado; input.appendChild(option); });
    input.value = value || (type === 'select' ? 'ABIERTA' : ''); grupo.append(titulo, input); form.appendChild(grupo);
    return input;
  }
  function pintarPendientes(pendientes) {
    var destino = el('pendientes'); destino.replaceChildren();
    el('cantidad-pendientes').textContent = pendientes.length + (pendientes.length === 1 ? ' pendiente' : ' pendientes');
    el('sin-pendientes').hidden = !!pendientes.length;
    pendientes.forEach(function (p, index) {
      var clave = JSON.stringify([periodoCargado, p.unidad_id, p.id, p.version]);
      var editable = Object.assign({}, p, borradores.get(clave) || {});
      var article = nodo('article', undefined, 'pendiente');
      var titulo = nodo('h3', etiqueta(p.causa)), contexto = nodo('p', texto(p.unidad) + ' · ' + texto(p.programa), 'pendiente-contexto');
      article.append(titulo, contexto, nodo('p', texto(p.detalle), 'pendiente-detalle'));
      var form = nodo('form');
      campo(form, 'Responsable', 'responsable', 'text', editable.responsable, 'responsable-' + index);
      campo(form, 'Fecha compromiso', 'fecha_compromiso', 'date', editable.fecha_compromiso ? String(editable.fecha_compromiso).slice(0, 10) : '', 'fecha-' + index);
      campo(form, 'Estado de atención', 'estado_atencion', 'select', editable.estado_atencion, 'estado-' + index);
      campo(form, 'Comentario de seguimiento', 'comentario', 'textarea', editable.comentario, 'comentario-' + index);
      var acciones = nodo('div', undefined, 'acciones'), boton = nodo('button', 'Guardar atención', 'boton'), mensaje = nodo('p', '', 'mensaje');
      boton.type = 'submit'; mensaje.setAttribute('role', 'status'); mensaje.setAttribute('aria-live', 'polite');
      acciones.append(boton, mensaje); form.appendChild(acciones);
      if (borradores.has(clave)) mensaje.textContent = 'Cambios sin guardar';
      function conservar() {
        var cambios = {};
        ['responsable', 'comentario', 'fecha_compromiso', 'estado_atencion'].forEach(function (k) { cambios[k] = form.elements.namedItem(k).value; });
        borradores.set(clave, cambios); mensaje.className = 'mensaje'; mensaje.textContent = 'Cambios sin guardar';
      }
      form.addEventListener('input', conservar); form.addEventListener('change', conservar);
      form.addEventListener('submit', function (e) { e.preventDefault(); guardar(p, form, mensaje, clave); });
      article.appendChild(form); destino.appendChild(article);
    });
  }
  async function guardar(p, form, mensaje, clave) {
    if (guardando || !form.reportValidity()) return;
    var args = { periodo: periodoCargado, unidad_id: p.unidad_id, pendiente_id: p.id, version: p.version };
    ['responsable', 'comentario', 'fecha_compromiso', 'estado_atencion'].forEach(function (k) { args[k] = form.elements.namedItem(k).value.trim(); });
    guardando = true; controles(true); aviso('');
    el('pendientes').querySelectorAll('input,textarea,select,button').forEach(function (n) { n.disabled = true; });
    var boton = form.querySelector('button'); boton.textContent = 'Guardando…'; mensaje.textContent = ''; mensaje.className = 'mensaje';
    var recargar = '';
    try {
      await llamar('atenderPreventivo', args);
      borradores.delete(clave);
      recargar = 'Atención guardada. Se actualizó la consulta con las cifras de origen.';
    } catch (e) {
      if (/CONFLICT|VERSION/.test(String(e.code || ''))) {
        borradores.delete(clave);
        recargar = e.message + ' Se recargó la versión actual. Revise los datos antes de guardar nuevamente.';
      }
      else { mensaje.textContent = e.message; mensaje.className = 'mensaje error'; }
    } finally {
      guardando = false; controles(false);
      el('pendientes').querySelectorAll('input,textarea,select,button').forEach(function (n) { n.disabled = false; });
      boton.textContent = 'Guardar atención';
    }
    if (recargar) await cargar(recargar);
  }
  function pintarFuentes() {
    var tbody = el('fuentes').querySelector('tbody'); tbody.replaceChildren();
    datos.fuentes.forEach(function (f) {
      var tr = nodo('tr'); celda(tr, 'Fuente', texto(f.fuente)); celda(tr, 'Corte', texto(f.corte, 'Sin corte'));
      celda(tr, 'Estado', badge(f.estado)); celda(tr, 'Detalle', texto(f.detalle)); tbody.appendChild(tr);
    });
    el('sin-fuentes').hidden = !!datos.fuentes.length; el('fuentes').hidden = !datos.fuentes.length;
  }
  try { boleto = localStorage.getItem('mascara_boleto') || ''; } catch (e) { boleto = ''; }
  if (!boleto) { el('acceso-requerido').hidden = false; return; }
  var hoy = new Date(); el('periodo').value = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  el('consulta').hidden = false;
  el('periodo').addEventListener('change', function () { cargar(); });
  el('unidad').addEventListener('change', function () { cargar(); });
  el('programa').addEventListener('change', pintar);
  el('actualizar').addEventListener('click', function () { cargar(); });
  cargar();
}());
