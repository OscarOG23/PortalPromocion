/**
 * Motor puro: recibe agregados ya autorizados y no consulta servicios ni archivos.
 * Los cuestionarios son aplicaciones observadas; SINBA conserva su intervalo.
 * ENVIADO indica elegibilidad del registro, no certifica el cierre del mes.
 */
function construirSeguimientoPreventivo(datos) {
  datos = datos || {};
  var periodo = datos.periodo;
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(String(periodo))) throw new Error('Periodo inválido.');
  var unidades = lista(datos.unidades), fuentes = datos.fuentes || {};
  var disponibilidad = lista(datos.disponibilidad), indicadores = [], pendientes = [], claves = {};
  var unidadesVistas = {}, puentes = {};
  unidades.forEach(function(u) {
    if (!u || !texto(u.id) || unidadesVistas[u.id]) throw new Error('Unidad inválida o duplicada.');
    unidadesVistas[u.id] = true;
    var puente = texto(u.determinantes_id);
    if (puente) puentes[puente] = (puentes[puente] || 0) + 1;
  });
  function lista(v) { return Array.isArray(v) ? v : []; }
  function texto(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function mayus(v) { return texto(v).toUpperCase(); }
  // No usar Number sobre celdas vacías, booleanos o texto desconocido.
  function numero(v) {
    if (typeof v === 'string') {
      if (!/^\d+(\.\d+)?$/.test(v.trim())) return null;
      v = Number(v.trim());
    }
    return typeof v === 'number' && isFinite(v) && v >= 0 ? v : null;
  }
  function suma(filas, campo) {
    if (!filas.length) return null;
    var total = 0;
    for (var n = 0; n < filas.length; n++) {
      var valor = numero(filas[n][campo]);
      if (valor === null) return null;
      total += valor;
    }
    return total;
  }
  function corteValido(v) {
    if (!/^20\d\d-\d\d-\d\d$/.test(texto(v))) return null;
    var d = new Date(v + 'T12:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
  }
  function corteFilas(filas) {
    if (!filas.length) return null;
    var cortes = filas.map(function(f) { return corteValido(f.corte); });
    if (cortes.some(function(c) { return c === null; })) return null;
    return cortes.sort()[0]; // El corte más antiguo limita el conjunto observado.
  }
  function disp(fuente) { return disponibilidad.filter(function(f) { return mayus(f.fuente) === fuente; })[0] || {}; }
  function fuentePendiente(fuente) {
    var d = disp(fuente), c = corteValido(d.corte);
    return ['NO_CONFIGURADA', 'SIN_CONFIGURAR', 'ERROR', 'PENDIENTE', 'NO_DISPONIBLE', 'SIN_ACTUALIZAR', 'CORTE_PARCIAL', 'INCOMPATIBLE'].indexOf(mayus(d.estado)) >= 0 ||
      (c !== null && c.slice(0, 7) < periodo);
  }
  function delMes(f) { return numero(f.anio) === Number(periodo.slice(0, 4)) && numero(f.mes) === Number(periodo.slice(5, 7)); }
  function pendiente(u, programa, causa, id, detalle) {
    var clave = [periodo, u.id, causa, id].join('|');
    if (claves[clave]) return;
    claves[clave] = true;
    pendientes.push({ id: clave, unidad_id: u.id, unidad: texto(u.nombre), programa: programa, causa: causa, detalle: detalle });
  }
  function indicador(u, id, programa, nombre, medida, valor, programado, meta, estado, fuente, corte, nota, elegible) {
    var porcentaje = elegible && valor !== null && meta !== null && meta > 0 ? valor / meta * 100 : null;
    var i = { id: id, unidad_id: u.id, unidad: texto(u.nombre), programa: programa, nombre: nombre, medida: medida,
      valor: valor, programado: programado, meta: meta, porcentaje: porcentaje,
      faltante: porcentaje === null ? null : Math.max(meta - valor, 0), estado: estado, fuente: fuente, corte: corte, nota: nota || '' };
    indicadores.push(i);
    return i;
  }
  unidades.forEach(function(u) {
    var programa = 'ADICCIONES', id = 'ADICCIONES_SESIONES', interno = texto(u.determinantes_id);
    var puenteAmbiguo = interno && puentes[interno] > 1;
    var det = lista(datos.determinantes).filter(function(f) {
      return interno && !puenteAmbiguo && texto(f.unidad_id) === interno && f.indicador_id === 'SUB039' && delMes(f);
    });
    var fila = det.length === 1 ? det[0] : null;
    var valor = fila ? numero(fila.talleres_alcanzados) : null;
    var programado = fila ? numero(fila.talleres_programados) : null;
    var estado = det.length > 1 ? 'REVISION' : fila ? mayus(fila.estatus) || 'REVISION' : 'SIN_REPORTE';
    var metaFilas = lista(datos.metas).filter(function(m) {
      return m.unidad_id === u.id && m.periodo === periodo && m.id_meta === '01.02.02.01';
    });
    var metaFila = metaFilas.length === 1 ? metaFilas[0] : null;
    var medidaCompatible = metaFila && ['SESION', 'SESIONES', 'TALLER', 'TALLERES'].indexOf(mayus(metaFila.medida)) >= 0;
    var meta = medidaCompatible ? numero(metaFila.meta) : null;
    var corte = corteValido(disp('DETERMINANTES').corte);
    var elegible = estado === 'ENVIADO' && !fuentePendiente('DETERMINANTES');
    indicador(u, id, programa, 'Sesiones de Adicciones', 'SESIONES', valor, programado, meta, estado, 'DETERMINANTES', corte,
      'Talleres SUB039. Programación operativa y meta oficial se conservan por separado. El envío no certifica cierre mensual.', elegible);
    if (!interno) pendiente(u, programa, 'CALIDAD_FUENTE', id, 'Falta el puente verificado entre CLUES y la unidad de Determinantes.');
    if (puenteAmbiguo) pendiente(u, programa, 'CALIDAD_FUENTE', id, 'La unidad interna de Determinantes corresponde a más de una CLUES; revisar el puente antes de atribuir actividad.');
    if (det.length > 1) pendiente(u, programa, 'CALIDAD_FUENTE', id, 'Hay más de una fila SUB039 para la misma unidad y periodo; resolver el conflicto en el capturador.');
    if (!fila || estado !== 'ENVIADO') pendiente(u, programa, 'FALTA_REPORTE', id, fila ? 'El registro SUB039 está en revisión y falta su envío.' : 'No hay un reporte SUB039 único y enviado para el periodo.');
    if (fila && (valor === null || programado === null)) pendiente(u, programa, 'CALIDAD_FUENTE', id, 'Faltan cifras válidas de talleres; una celda vacía no equivale a cero.');
    if (elegible && valor !== null && ((meta !== null && meta > valor) || (programado !== null && programado > valor)))
      pendiente(u, programa, 'FALTA_ACTIVIDAD', id, 'Las sesiones declaradas no alcanzan la meta o la programación operativa del periodo.');
    if (meta === null || meta === 0) pendiente(u, programa, 'META_NO_DEFINIDA', id, 'Falta una meta positiva única de sesiones 01.02.02.01 compatible con unidad y periodo.');
    if (fuentePendiente('DETERMINANTES')) pendiente(u, programa, 'FUENTE_SIN_ACTUALIZAR', id, texto(disp('DETERMINANTES').detalle) || 'La fuente de Determinantes no está disponible o su corte requiere actualización.');
    var evidencia = lista(datos.evidencias).some(function(e) {
      return interno && texto(e.unidad_id) === interno && e.subtema_declarado === 'SUB039' && delMes(e) &&
        (!texto(e.estatus) || mayus(e.estatus) === 'ENVIADO');
    });
    if (valor !== null && valor > 0 && !evidencia) pendiente(u, programa, 'FALTA_EVIDENCIA', id, 'Revisar evidencia declarada expresamente como SUB039 en el mismo periodo.');
    var femenino = fila ? numero(fila.femenino) : null, masculino = fila ? numero(fila.masculino) : null;
    indicador(u, 'ADICCIONES_ASISTENCIAS', programa, 'Asistencias a Adicciones', 'ASISTENCIAS',
      femenino === null || masculino === null ? null : femenino + masculino, null, null, estado, 'DETERMINANTES', corte,
      'Femenino + masculino de SUB039; son asistencias acumuladas, no personas únicas.', false);
    if (fila && (femenino === null || masculino === null)) pendiente(u, programa, 'CALIDAD_FUENTE', 'ADICCIONES_ASISTENCIAS', 'Faltan cifras válidas de asistencias femeninas o masculinas; revisar el capturador.');

    programa = 'ESCUELAS';
    var escolar = lista(datos.escolar).filter(function(f) { return f.UNIDAD_ID === u.id && f.PERIODO === periodo; });
    var enviadas = escolar.filter(function(f) { return mayus(f.ESTATUS) === 'ENVIADO'; });
    var revision = escolar.filter(function(f) { return mayus(f.ESTATUS) !== 'ENVIADO'; });
    var usadas = enviadas.length ? enviadas : revision;
    var escolarEstado = enviadas.length ? (revision.length ? 'ENVIADO_CON_REVISION' : 'ENVIADO') : revision.length ? 'BORRADOR' : 'SIN_REPORTE';
    var nota = 'Las sesiones provienen de REALIZADAS; no se suman temas. ' +
      (revision.length ? revision.length + ' registro(s) en revisión' + (enviadas.length ? ', excluidos del total enviado.' : ', actividad observada pendiente de envío.') : '');
    var grupos = {}, duplicados = false;
    usadas.forEach(function(f) { var k = texto(f.CCT) + '|' + texto(f.TURNO); if (grupos[k]) duplicados = true; grupos[k] = true; });
    var escolarCorte = corteValido(disp('ESCOLAR').corte);
    var sesiones = duplicados ? null : suma(usadas, 'REALIZADAS');
    indicador(u, 'ESCUELAS_SESIONES', programa, 'Sesiones escolares', 'SESIONES', sesiones,
      duplicados ? null : suma(usadas, 'PROGRAMADAS'), null, duplicados ? 'REVISION' : escolarEstado, 'ESCOLAR', escolarCorte, nota, false);
    var ccts = {}, cctDesconocida = false;
    usadas.forEach(function(f) {
      var realizadas = numero(f.REALIZADAS);
      if (realizadas === null) cctDesconocida = true;
      else if (realizadas > 0) { if (texto(f.CCT)) ccts[texto(f.CCT)] = true; else cctDesconocida = true; }
    });
    indicador(u, 'ESCUELAS_PLANTELES', programa, 'Planteles atendidos', 'CCT_DISTINTAS',
      !usadas.length || duplicados || cctDesconocida ? null : Object.keys(ccts).length,
      null, null, escolarEstado, 'ESCOLAR', escolarCorte, 'CCT distintas con actividad. Sin padrón completo no hay cobertura porcentual; una intervención no acredita certificación.', false);
    ['ALUMNOS', 'DOCENTES', 'PADRES'].forEach(function(campo) {
      indicador(u, 'ESCUELAS_' + campo, programa, 'Asistencias escolares: ' + campo.toLowerCase(), 'ASISTENCIAS',
        duplicados ? null : suma(usadas, campo), null, null, escolarEstado, 'ESCOLAR', escolarCorte, 'Asistencias declaradas; no equivalen a personas únicas ni a matrícula. ' + nota, false);
    });
    if (!enviadas.length || revision.length) pendiente(u, programa, 'FALTA_REPORTE', 'ESCUELAS_SESIONES', revision.length ? 'Hay registros escolares pendientes de envío.' : 'No hay un reporte escolar enviado para el periodo.');
    if (duplicados || usadas.some(function(f) { return !texto(f.CCT) || numero(f.REALIZADAS) === null || numero(f.PROGRAMADAS) === null; }))
      pendiente(u, programa, 'CALIDAD_FUENTE', 'ESCUELAS_SESIONES', 'Revisar CCT, cifras desconocidas o filas repetidas de CCT/turno/periodo.');
    if (!duplicados && enviadas.some(function(f) { var r = numero(f.REALIZADAS), p = numero(f.PROGRAMADAS); return r !== null && p !== null && r < p; }))
      pendiente(u, programa, 'FALTA_ACTIVIDAD', 'ESCUELAS_SESIONES', 'Hay planteles con sesiones realizadas por debajo de su programación operativa.');
    if (usadas.some(function(f) {
      if (!(numero(f.REALIZADAS) > 0)) return false;
      try { return !Array.isArray(JSON.parse(f.EVIDENCIAS_JSON || '[]')) || !JSON.parse(f.EVIDENCIAS_JSON || '[]').length; }
      catch (e) { return true; }
    })) pendiente(u, programa, 'FALTA_EVIDENCIA', 'ESCUELAS_SESIONES', 'Revisar evidencia escolar en los planteles que declaran sesiones.');
    if (fuentePendiente('ESCOLAR')) pendiente(u, programa, 'FUENTE_SIN_ACTUALIZAR', 'ESCUELAS_SESIONES', texto(disp('ESCOLAR').detalle) || 'La fuente escolar requiere configuración o actualización.');

    programa = 'DETECCIONES';
    // El evaluador conserva el numerador por sustancia del mapeo SIS oficial.
    // Ningún cuestionario ni acumulado SINBA sustituye este avance.
    var did = 'DETECCIONES_META_OFICIAL';
    var avancesDetecciones = lista(datos.avances_oficiales).filter(function(a) {
      return a.unidad_id === u.id && a.periodo === periodo && a.id_meta === '01.02.02.02';
    });
    var avanceDeteccion = avancesDetecciones.length === 1 ? avancesDetecciones[0] : null;
    var estadoAvance = avanceDeteccion ? mayus(avanceDeteccion.estado_fuente) : 'SIN_FUENTE';
    var conFuenteAvance = avanceDeteccion && ['OK', 'OBSERVADO', 'REVISION', 'VALIDADO'].indexOf(estadoAvance) >= 0;
    var valorDeteccion = conFuenteAvance ? numero(avanceDeteccion.avance) : null;
    var corteDeteccion = avanceDeteccion ? corteValido(avanceDeteccion.corte) : null;
    var metasDetecciones = lista(datos.metas).filter(function(m) {
      return m.unidad_id === u.id && m.periodo === periodo && m.id_meta === '01.02.02.02';
    });
    var metaDeteccionFila = metasDetecciones.length === 1 ? metasDetecciones[0] : null;
    var medidaDeteccion = metaDeteccionFila && ['DETECCION', 'DETECCIONES', 'DETECCIONES_POR_SUSTANCIA'].indexOf(mayus(metaDeteccionFila.medida)) >= 0;
    var metaDeteccion = medidaDeteccion ? numero(metaDeteccionFila.meta) : null;
    var finPeriodo = periodo + '-' + new Date(Number(periodo.slice(0,4)),Number(periodo.slice(5,7)),0).getDate();
    var deteccionElegible = conFuenteAvance && estadoAvance === 'VALIDADO' && corteDeteccion !== null &&
      corteDeteccion >= finPeriodo && !fuentePendiente('EVALUADOR_CUBOS');
    var deteccionEstado = avancesDetecciones.length > 1 ? 'REVISION' : !conFuenteAvance ? 'SIN_FUENTE' :
      deteccionElegible && valorDeteccion !== null ? 'VALIDADO' : 'REVISION';
    indicador(u, did, programa, 'Detecciones por sustancia: meta oficial', 'DETECCIONES_POR_SUSTANCIA',
      valorDeteccion, null, metaDeteccion, deteccionEstado, 'EVALUADOR_CUBOS', corteDeteccion,
      'Avance oficial 01.02.02.02 del evaluador: variables SIS por sustancia. El snapshot es observado hasta validar corte y cobertura; los cuestionarios tienen otra definición.', deteccionElegible);
    if (avancesDetecciones.length > 1 || (conFuenteAvance && valorDeteccion === null))
      pendiente(u, programa, 'CALIDAD_FUENTE', did, 'El avance oficial tiene filas duplicadas o una cifra desconocida; revisar el evaluador sin sumar registros.');
    if (!deteccionElegible)
      pendiente(u, programa, 'FUENTE_SIN_ACTUALIZAR', did, 'Falta el avance oficial o su corte confirmado; revisar el snapshot y la cobertura del evaluador.');
    if (metaDeteccion === null || metaDeteccion === 0)
      pendiente(u, programa, 'META_NO_DEFINIDA', did, 'Falta una meta positiva única 01.02.02.02 de detecciones por sustancia compatible con unidad y periodo.');
    if (deteccionElegible && valorDeteccion !== null && metaDeteccion !== null && metaDeteccion > valorDeteccion)
      pendiente(u, programa, 'FALTA_ACTIVIDAD', did, 'Las detecciones oficiales validadas no alcanzan la meta compatible del periodo.');
    ['AUDIT', 'FAGERSTROM', 'DROGAS'].forEach(function(instrumento) {
      var nominal = lista(fuentes.nominal).filter(function(f) { return f.unidad_id === u.id && f.periodo === periodo && f.instrumento === instrumento; });
      var cubos = lista(fuentes.cubos).filter(function(f) { return f.unidad_id === u.id && f.periodo === periodo && f.instrumento === instrumento; });
      var seleccionadas = nominal.length ? nominal : cubos, origen = nominal.length ? 'NOMINAL' : cubos.length ? 'CUBOS' : 'NOMINAL';
      var cid = 'CUESTIONARIOS_' + instrumento, c = corteFilas(seleccionadas);
      var parcial = seleccionadas.some(function(f) { return mayus(f.estado) === 'CORTE_PARCIAL'; });
      var mala = seleccionadas.some(function(f) { return ['CATEGORIAS_INCOMPLETAS', 'REVISAR_FILAS_IDENTICAS', 'REVISAR_FUENTE'].indexOf(mayus(f.estado)) >= 0; });
      var total = origen === 'CUBOS' && seleccionadas.length > 1 ? null : suma(seleccionadas, 'total');
      var estadoCuestionario = !seleccionadas.length ? 'SIN_REPORTE' : parcial ? 'CORTE_PARCIAL' : mala || c === null ? 'REVISION' : 'OBSERVADO';
      indicador(u, cid, programa, 'Cuestionarios ' + instrumento, 'CUESTIONARIOS', total, null, null, estadoCuestionario, origen, c,
        'Aplicaciones observadas. Nominal y Cubos son alternativas y no se suman. No son compatibles con metas de tamizajes por sustancia.', false);
      if (!seleccionadas.length) pendiente(u, programa, 'FALTA_REPORTE', cid, 'No hay cuestionarios agregados de ' + instrumento + ' para la unidad y periodo.');
      if (seleccionadas.length && (total === null || mala || (origen === 'CUBOS' && seleccionadas.length > 1)))
        pendiente(u, programa, 'CALIDAD_FUENTE', cid, 'La cifra está incompleta o requiere revisión del agregado original.');
      if (parcial || (seleccionadas.length && (c === null || c.slice(0, 7) < periodo)) || fuentePendiente(origen))
        pendiente(u, programa, 'FUENTE_SIN_ACTUALIZAR', cid, 'El corte es parcial, desconocido o anterior al periodo; confirmar cobertura y actualización.');
      if (nominal.some(function(f) { return mayus(f.estado_fuente || f.estado) === 'RECURSO_PENDIENTE' || !texto(f.recurso_id) || /SIN IDENTIDAD/.test(mayus(f.recurso_nombre)); }))
        pendiente(u, programa, 'IDENTIDAD_RECURSO_PENDIENTE', cid, 'El nominal incluye producción sin identidad de recurso; completar el dato en origen sin atribuirlo a una persona.');
      lista(fuentes.comparacion).filter(function(f) { return f.unidad_id === u.id && f.periodo === periodo && f.instrumento === instrumento; }).forEach(function(f) {
        if (f.estado === 'DIFERENCIA_OBSERVADA') pendiente(u, programa, 'DIFERENCIA_FUENTES', cid, 'Nominal y Cubos difieren en cortes comparables; revisar las fuentes sin sumarlas.');
        else if (['CORTES_NO_COMPARABLES', 'REVISAR_FUENTE'].indexOf(f.estado) >= 0)
          pendiente(u, programa, 'CALIDAD_FUENTE', cid, 'El contraste Nominal/Cubos requiere revisión: ' + f.estado + '.');
      });
    });
    var sinba = lista(fuentes.sinba).filter(function(f) {
      var rango = texto(f.periodo).split('/');
      return f.unidad_id === u.id && f.medicion === 'DETECCIONES_GENERALES' && rango.length === 2 &&
        /^20\d\d-(0[1-9]|1[0-2])$/.test(rango[0]) && /^20\d\d-(0[1-9]|1[0-2])$/.test(rango[1]) && rango[0] <= periodo && rango[1] >= periodo;
    });
    // Distintos intervalos no forman una suma válida aunque ambos contengan el mes.
    if (sinba.length) {
      var rangos = {};
      sinba.forEach(function(f) { rangos[f.periodo + '|' + texto(f.inicio) + '|' + texto(f.fin)] = true; });
      var conflicto = Object.keys(rangos).length !== 1, sid = 'SINBA_DETECCIONES_GENERALES';
      var sinbaTotal = conflicto ? null : suma(sinba, 'total');
      var sinbaCorte = corteFilas(sinba);
      var sinbaParcial = sinba.some(function(f) { return mayus(f.estado) === 'CORTE_PARCIAL'; });
      var sinbaRevision = sinba.some(function(f) { return ['REVISAR_FILAS_IDENTICAS', 'REVISAR_FUENTE', 'CATEGORIAS_INCOMPLETAS'].indexOf(mayus(f.estado)) >= 0; });
      var sinbaEstado = conflicto || sinbaTotal === null || sinbaCorte === null || sinbaRevision ? 'REVISION' : sinbaParcial ? 'CORTE_PARCIAL' : 'ACUMULADO';
      indicador(u, sid, programa, 'Detecciones generales acumuladas SINBA', 'DETECCIONES_GENERALES_ACUMULADAS', sinbaTotal,
        null, null, sinbaEstado, 'SINBA', sinbaCorte,
        'Intervalo ' + sinba[0].periodo + ' (' + (sinba[0].inicio || 'inicio no declarado') + ' a ' + (sinba[0].fin || 'fin no declarado') + '). No representa productividad mensual ni cuestionarios.', false);
      if (conflicto || sinbaTotal === null || sinbaRevision) pendiente(u, programa, 'CALIDAD_FUENTE', sid, 'SINBA contiene cifras desconocidas, intervalos acumulados incompatibles o alertas de calidad del agregado original.');
      if (sinbaParcial || sinbaCorte === null || fuentePendiente('SINBA')) pendiente(u, programa, 'FUENTE_SIN_ACTUALIZAR', sid, 'Revisar corte parcial, corte desconocido o disponibilidad del acumulado SINBA.');
      if (sinba.some(function(f) { return mayus(f.estado_fuente || f.estado) === 'RECURSO_PENDIENTE'; }))
        pendiente(u, programa, 'IDENTIDAD_RECURSO_PENDIENTE', sid, 'El acumulado SINBA incluye un recurso cuya identidad está pendiente en la fuente.');
    }
  });
  var resumenFuentes = lista(fuentes.fuentes).map(function(f) {
    return { fuente: texto(f.fuente), corte: corteValido(f.corte), estado: 'OBSERVADO', detalle: texto(f.ambito) };
  });
  disponibilidad.forEach(function(f) { resumenFuentes.push({ fuente: texto(f.fuente), corte: corteValido(f.corte), estado: texto(f.estado) || 'DESCONOCIDO', detalle: texto(f.detalle) }); });
  return { indicadores: indicadores, pendientes: pendientes, fuentes: resumenFuentes };
}
