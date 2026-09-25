/* ARCHIVO GENERADO por JS19-JORNADAS/scripts/publicar_pages_medica.py — NO EDITAR A MANO. */
/* ============================================================
   PUENTE · alta de jornada médica de JS19 servida desde GitHub Pages
   Va al principio de app.js (scripts/publicar_pages_medica.py). Sustituye
   google.script.run por fetch POST al /exec (EXEC_JORNADAS, config.js) con
   {"accion", "args"} en text/plain, igual que el puente del capturador
   (pages/puente.js) y que Atención.

   A diferencia del capturador, este formulario no necesita boleto: el alta
   es directa, sin sesión administrativa, y no depende de una coordinación
   (el propio formulario deja elegir la unidad médica). Si llega un
   ?boleto= en la dirección porque se entró desde la máscara, se quita de
   la barra igual que en el resto del portal, pero no se usa para nada.
   ============================================================ */

var ACCIONES_PUENTE = ["datosAltaMedica", "altaJornadaMedica"];
var ESPERA_PUENTE_MS = 45000;

/** Quita ?boleto= de la dirección si llegó desde la máscara; no se usa. */
function limpiarBoletoDeUrl_(){
  var q;
  try { q = new URLSearchParams(location.search); } catch (e){ return; }
  if (!q.get("boleto")) return;
  q["delete"]("boleto");
  var resto = q.toString();
  try { history.replaceState(history.state, "", location.pathname + (resto ? "?" + resto : "") + location.hash); }
  catch (e){ /* sin history: el parámetro se queda en la barra, no rompe nada */ }
}

function llamarExec_(accion, args){
  if (typeof EXEC_JORNADAS !== "string" || !EXEC_JORNADAS){
    return Promise.reject(new Error("Falta configurar la dirección del sistema (config.js)."));
  }
  var control = window.AbortController ? new AbortController() : null;
  var reloj = control ? setTimeout(function(){ control.abort(); }, ESPERA_PUENTE_MS) : 0;
  return fetch(EXEC_JORNADAS, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: accion, args: args || [] }),
    signal: control ? control.signal : undefined
  }).then(function(r){
    if (!r.ok) throw new Error("El sistema no respondió (" + r.status + ").");
    return r.json();
  }).then(function(datos){
    clearTimeout(reloj);
    if (datos && datos.ok === false){
      var e = new Error(datos.msg || datos.message || "No se pudo completar.");
      e.code = datos.code;
      throw e;
    }
    return datos;
  }, function(err){ clearTimeout(reloj); throw err; });
}

/** Lo que el formulario pide por google.script.run, contestado desde el /exec. */
function atenderPuente_(accion, args){
  if (ACCIONES_PUENTE.indexOf(accion) < 0) return Promise.reject(new Error("Acción no disponible: " + accion));
  return llamarExec_(accion, args);
}

function crearRunnerPuente_(exito, fallo){
  var base = {
    withSuccessHandler: function(f){ return crearRunnerPuente_(f, fallo); },
    withFailureHandler: function(f){ return crearRunnerPuente_(exito, f); }
  };
  ACCIONES_PUENTE.forEach(function(accion){
    base[accion] = function(){
      var args = Array.prototype.slice.call(arguments);
      atenderPuente_(accion, args).then(function(r){ if (exito) exito(r); },
                                        function(e){ if (fallo) fallo(e); });
    };
  });
  return base;
}

/* Sólo en el navegador: en las pruebas de Node no hay location. */
if (typeof window !== "undefined" && typeof location !== "undefined"){
  limpiarBoletoDeUrl_();
  window.google = { script: { run: crearRunnerPuente_(null, null) } };
}


/* ============================================================
   NÚCLEO COMPARTIDO · JS19-JORNADAS
   Constantes, lógica pura, almacenamiento, puente y fotos.
   Sin layout y sin acceso al DOM al cargar: se prueba con
   node --test extrayendo este bloque.
   ============================================================ */

/* ---------- Los 29 indicadores, orden oficial inmutable ---------- */
var INDICADORES_29 = [
  "CONSULTA MÉDICA",
  "CONSULTA DE NUTRICIÓN",
  "CONSULTA ODONTOLÓGICA",
  "CONSULTA PSICOLÓGICA",
  "VACUNACIÓN UNIVERSAL",
  "FACTORES DE RIESGO",
  "GLUCOSA",
  "LÍPIDOS",
  "VIH",
  "SÍFILIS",
  "HEPATITIS C",
  "DETECCIÓN PROSTÁTICA",
  "ORIENTACIÓN PLANIFICACIÓN FAMILIAR",
  "MÉTODOS DE PLANIFICACIÓN FAMILIAR",
  "OTORGAMIENTO DE ÁCIDO FÓLICO",
  "TALLERES",
  "PREVENCIÓN IRAS Y EDAS",
  "VSO",
  "ALBENDAZOL",
  "PREVENCIÓN ACCIDENTES EN EL HOGAR",
  "DETECCIÓN Y PREVENCIÓN DE VIOLENCIA",
  "ORIENTACIÓN Y PREVENCIÓN DE ADICCIONES",
  "DETECCIÓN Y PREVENCIÓN DE DEPRESIÓN",
  "DETECCIÓN Y PREVENCIÓN DE ESTRÉS Y SUICIDIO",
  "ORIENTACIÓN (SALUD MENTAL)",
  "VACUNACIÓN CANINA/FELINA",
  "ESTERILIZACIÓN CANINA/FELINA",
  "CERTIFICADOS MÉDICOS",
  "PRE REGISTRO DISCAPACIDAD"
];

/* TOTAL DE ACTIVIDADES (col. AM) = SUM(J:AJ) y excluye estos dos.
   Criterio heredado del formato de SAM. No cambiar sin autorización. */
var EXCLUIDOS_DEL_TOTAL = ["CERTIFICADOS MÉDICOS", "PRE REGISTRO DISCAPACIDAD"];

/* El catálogo indicador→módulo ya no vive aquí: llega en el objeto de arranque
   (datosArranque) y se indexa con crearIndiceCatalogo. La hoja CAT es la única
   fuente de verdad. */

/* El indicador que recibe la entrega de preservativos. Es el #14 del
   formato oficial: no se crea un indicador nuevo. */
var IND_PRESERVATIVOS = "MÉTODOS DE PLANIFICACIÓN FAMILIAR";

/* Los ocho destinos canónicos de TALLERES. El noveno componente de TALLERES,
   ORIENTACIÓN (SALUD MENTAL), no es un destino marcable: se deriva del
   estrés (ver concentrarTalleres). Única fuente de verdad: se usa aquí y
   como valor por defecto de PREF_INICIALES.destinosTaller. */
var DESTINOS_TALLER_CANONICOS = [
  "PREVENCIÓN IRAS Y EDAS",
  "VSO",
  "ALBENDAZOL",
  "PREVENCIÓN ACCIDENTES EN EL HOGAR",
  "DETECCIÓN Y PREVENCIÓN DE VIOLENCIA",
  "ORIENTACIÓN Y PREVENCIÓN DE ADICCIONES",
  "DETECCIÓN Y PREVENCIÓN DE DEPRESIÓN",
  "DETECCIÓN Y PREVENCIÓN DE ESTRÉS Y SUICIDIO"
];

/* Divisor de condones por persona orientada en planificación familiar. Única
   fuente de verdad de la cifra por defecto y de su rango válido (2 a 5, spec):
   la usan PREF_INICIALES, curarPref_ y la interfaz al editarlo. Antes vivía
   duplicado: esta constante muerta y el "3" a mano en PREF_INICIALES. */
var DIVISOR_ORIENTACION_PF = 3;
var DIVISOR_ORIENTACION_PF_MIN = 2;
var DIVISOR_ORIENTACION_PF_MAX = 5;

/** ¿Es un divisor de orientación en planificación familiar válido? */
function divisorOrientacionPFValido_(v){
  var n = Number(v);
  return isFinite(n) && n >= DIVISOR_ORIENTACION_PF_MIN && n <= DIVISOR_ORIENTACION_PF_MAX;
}

/* ---------- Preferencias iniciales (el usuario las ajusta en la UI) ---------- */
var PREF_INICIALES = {
  setHabitual: [
    "CONSULTA MÉDICA",
    "CONSULTA ODONTOLÓGICA",
    "VACUNACIÓN UNIVERSAL",
    "FACTORES DE RIESGO",
    "GLUCOSA",
    "LÍPIDOS",
    "VIH",
    "SÍFILIS",
    "MÉTODOS DE PLANIFICACIÓN FAMILIAR",
    "TALLERES",
    "PREVENCIÓN IRAS Y EDAS",
    "VSO",
    "PREVENCIÓN ACCIDENTES EN EL HOGAR",
    "VACUNACIÓN CANINA/FELINA",
    "ESTERILIZACIÓN CANINA/FELINA"
  ],
  destinosTaller: DESTINOS_TALLER_CANONICOS.slice(),
  factorPreservativos: 0.30,
  divisorOrientacionPF: DIVISOR_ORIENTACION_PF
};

/* ============================================================
   LÓGICA PURA — cubierta por tests/nucleo.test.mjs
   ============================================================ */

function numero_(v){
  if (v === "" || v === null || v === undefined) return 0;
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

/** Indexa el catálogo recibido: módulos por clave e indicador→módulo. */
function crearIndiceCatalogo(catalogo){
  var idx = { modulos: {}, porIndicador: {}, porModulo: {} };
  var c = catalogo || {};
  (c.modulos || []).forEach(function(m){
    idx.modulos[m.clave] = m; idx.porModulo[m.clave] = [];
  });
  (c.indicadores || []).forEach(function(i){
    idx.porIndicador[i.indicador] = i;
    if (!idx.porModulo[i.modulo]) idx.porModulo[i.modulo] = [];
    idx.porModulo[i.modulo].push(i);
  });
  return idx;
}

/** El bootstrap sólo se acepta si trae los 29 indicadores exactamente una vez. */
function validarBootstrap(b){
  var errores = [], catalogo = (b && b.catalogo) || {}, vistos = {};
  (catalogo.indicadores || []).forEach(function(i){ vistos[i.indicador] = (vistos[i.indicador] || 0) + 1; });
  INDICADORES_29.forEach(function(n){ if (vistos[n] !== 1) errores.push(n); });
  if ((catalogo.modulos || []).some(function(m){ return !/^M[1-9]$/.test(m.clave); })) errores.push('CLAVE_MODULO');
  return { ok: errores.length === 0, errores: errores };
}

function moduloDeIndicador(nombre, idx){ return idx && idx.porIndicador[nombre] ? idx.porIndicador[nombre].modulo : ""; }
function grupoDeIndicador(nombre, idx){ return idx && idx.porIndicador[nombre] ? idx.porIndicador[nombre].grupo : ""; }

function agruparPorModulo(datos, idx){
  var salida = {};
  Object.keys(datos || {}).forEach(function(nombre){
    var m = moduloDeIndicador(nombre, idx);
    if (!m) return;
    if (!salida[m]) salida[m] = {};
    salida[m][nombre] = datos[nombre];
  });
  return salida;
}

/** Antigüedad en minutos completos de la copia local del catálogo. */
function edadCache_(cache, ahora){ return Math.floor((Number(ahora) - Number((cache || {}).guardadoEn || 0)) / 60000); }

/** Módulos convocados que además siguen vigentes en el catálogo. */
function modulosDeJornada_(jornada, idx){
  return ((jornada || {}).modulos || []).filter(function(m){
    return idx.modulos[m] && idx.modulos[m].activo !== false;
  });
}

function sumaTotal(datos){
  var d = datos || {};
  return INDICADORES_29.reduce(function(t, n){ return t + numero_(d[n]); }, 0);
}

function totalActividades(datos){
  var d = datos || {};
  return INDICADORES_29.reduce(function(t, n){
    if (EXCLUIDOS_DEL_TOTAL.indexOf(n) >= 0) return t;
    return t + numero_(d[n]);
  }, 0);
}

function diferenciaTotales(datos){
  var d = datos || {};
  var pob = sumaTotal(d), act = totalActividades(d);
  return {
    poblacion: pob,
    actividades: act,
    diferencia: pob - act,
    detalle: EXCLUIDOS_DEL_TOTAL.map(function(n){
      return { indicador: n, valor: numero_(d[n]) };
    })
  };
}

function preservativosDesdePoblacion(poblacion, factor){
  var p = numero_(poblacion), f = Number(factor);
  if (!isFinite(f) || f < 0) return 0;
  return Math.round(p * f);
}

function aplicarAVarios(valor, destinos, datos){
  var salida = {};
  Object.keys(datos || {}).forEach(function(k){ salida[k] = datos[k]; });
  var v = Number(valor);
  if (!isFinite(v) || v < 0) return salida;
  (destinos || []).forEach(function(n){
    if (INDICADORES_29.indexOf(n) >= 0) salida[n] = v;
  });
  return salida;
}

/* ---------- Paquetes de acciones ----------
   Hay cifras que no pueden diferir: salen de un mismo formato o de un
   mismo piquete. Y hay cifras que se derivan de otras. Ver
   docs/superpowers/specs/2026-08-17-paquetes-de-acciones-design.md */

var ATADOS = [
  ["VIH", "SÍFILIS"],                  // prueba dual
  ["FACTORES DE RIESGO", "GLUCOSA"]    // un formato evalúa riesgo, diabetes e hipertensión
];

var IND_TALLERES = "TALLERES";
var IND_ORIENTACION_SM = "ORIENTACIÓN (SALUD MENTAL)";
var IND_ESTRES = "DETECCIÓN Y PREVENCIÓN DE ESTRÉS Y SUICIDIO";
var IND_ORIENTACION_PF = "ORIENTACIÓN PLANIFICACIÓN FAMILIAR";
var IND_LIPIDOS = "LÍPIDOS";
var CONSULTAS_POBLACION = [
  "CONSULTA MÉDICA", "CONSULTA DE NUTRICIÓN",
  "CONSULTA ODONTOLÓGICA", "CONSULTA PSICOLÓGICA"
];

function parejaAtada(nombre){
  var salida = "";
  ATADOS.forEach(function(par){
    if (par[0] === nombre) salida = par[1];
    else if (par[1] === nombre) salida = par[0];
  });
  return salida;
}

/** Iguala la pareja del indicador tocado. Vaciar uno vacía al otro. */
function propagarAtados(datos, nombre){
  var salida = {};
  Object.keys(datos || {}).forEach(function(k){ salida[k] = datos[k]; });
  var pareja = parejaAtada(nombre);
  if (!pareja) return salida;
  if (salida[nombre] === undefined || salida[nombre] === "") delete salida[pareja];
  else salida[pareja] = salida[nombre];
  return salida;
}

/**
 * Una cifra de asistentes va a los destinos marcados. TALLERES nunca se
 * acepta como su propio destino: si viene en la lista (preferencia vieja
 * sin curar) se descarta aquí mismo, por construcción, o el concentrado se
 * sumaría a sí mismo. Orientación en salud mental es la cuarta parte del
 * estrés, pero sólo se deriva cuando estrés participa de verdad en esta
 * aplicación: si no participa, se respeta lo que ya hubiera capturado a
 * mano. Y TALLERES concentra la suma real de sus nueve columnas tal como
 * quedan — los ocho destinos canónicos más la orientación — leída de la
 * salida, no del argumento: una columna con cifra propia pero desmarcada
 * en esta aplicación sigue contando.
 */
function concentrarTalleres(valor, destinos, datos){
  var destinosLimpios = (destinos || []).filter(function(n){ return n !== IND_TALLERES; });
  var salida = aplicarAVarios(valor, destinosLimpios, datos);
  var v = Number(valor);
  if (!isFinite(v) || v < 0) return salida;
  if (destinosLimpios.indexOf(IND_ESTRES) >= 0){
    salida[IND_ORIENTACION_SM] = Math.round(numero_(salida[IND_ESTRES]) / 4);
  }
  var suma = DESTINOS_TALLER_CANONICOS.reduce(function(t, n){
    return t + numero_(salida[n]);
  }, 0);
  salida[IND_TALLERES] = suma + numero_(salida[IND_ORIENTACION_SM]);
  return salida;
}

/**
 * Lípidos sale del mismo piquete que VIH y sífilis, pero sólo si se llevó el
 * insumo: por eso se ofrece y no se impone.
 */
function sugerirLipidos(datos){
  var salida = {};
  Object.keys(datos || {}).forEach(function(k){ salida[k] = datos[k]; });
  var referencia = salida["VIH"] !== undefined && salida["VIH"] !== ""
    ? salida["VIH"] : salida["SÍFILIS"];
  if (referencia === undefined || referencia === "") return salida;
  salida[IND_LIPIDOS] = numero_(referencia);
  return salida;
}

/** Cada persona orientada se lleva de 2 a 5 condones. */
function orientacionDesdeMetodos(metodos, divisor){
  var d = Number(divisor);
  if (!isFinite(d) || d <= 0) return 0;
  return Math.round(numero_(metodos) / d);
}

/** Las cuatro consultas más los asistentes al taller. */
function poblacionAtendida(datos, valorTaller){
  var d = datos || {};
  var base = CONSULTAS_POBLACION.reduce(function(t, n){ return t + numero_(d[n]); }, 0);
  var v = numero_(valorTaller);
  return base + (v < 0 ? 0 : Math.round(v));
}

/* ---------- Dependencias entre derivados ----------
   Qué indicador deja de ser confiable si cambia su fuente. Estrategia elegida
   para el hallazgo C-2 (revisión de la Task 1): apagar la marca de
   "calculado" cuando cambia el origen, no recalcular sola. Es más simple y no
   pisa lo que el capturista acaba de escribir; el capturista decide si vuelve
   a pedir el cálculo. La cadena es transitiva: tocar el estrés apaga la marca
   de ORIENTACIÓN (SALUD MENTAL) y, en cadena, la de TALLERES, porque TALLERES
   suma esa orientación; tocar una consulta apaga MÉTODOS DE PLANIFICACIÓN
   FAMILIAR (nace de POBLACIÓN ATENDIDA) y, en cadena, ORIENTACIÓN
   PLANIFICACIÓN FAMILIAR (nace de los métodos). */
var DEPENDE_DE = {};
DEPENDE_DE[IND_TALLERES] = DESTINOS_TALLER_CANONICOS.concat([IND_ORIENTACION_SM]);
DEPENDE_DE[IND_ORIENTACION_SM] = [IND_ESTRES];
DEPENDE_DE[IND_ORIENTACION_PF] = [IND_PRESERVATIVOS];
DEPENDE_DE[IND_PRESERVATIVOS] = CONSULTAS_POBLACION.slice();
/* P1-1 (revisión final de 52cc1fd): sugerirLipidos es la quinta regla que
   escribe y marca un indicador, y se quedó fuera de este grafo. Sin esta
   entrada, corregir VIH o sífilis no apagaba la marca de LÍPIDOS: quedaba en
   oro endosando una cifra que ya no correspondía a nada (medido: VIH 30 →
   lípidos 30 en oro; corrijo VIH a 12 → lípidos se queda en 30 y sigue
   marcado). LÍPIDOS cuelga de los dos, no sólo del que sugerirLipidos usó
   como referencia: propagarAtados iguala VIH y sífilis, así que cualquiera
   de los dos pudo ser la fuente real de la cifra copiada. */
DEPENDE_DE[IND_LIPIDOS] = ["VIH", "SÍFILIS"];

/** Todo lo que deja de ser confiable si cambia `nombre`, siguiendo la cadena
 * de DEPENDE_DE. No incluye a `nombre` mismo. */
function dependientesDe(nombre){
  var vistos = {}, cola = [nombre], salida = [];
  while (cola.length){
    var actual = cola.shift();
    Object.keys(DEPENDE_DE).forEach(function(dependiente){
      if (vistos[dependiente]) return;
      if (DEPENDE_DE[dependiente].indexOf(actual) >= 0){
        vistos[dependiente] = true;
        salida.push(dependiente);
        cola.push(dependiente);
      }
    });
  }
  return salida;
}

/* ============================================================
   ALMACENAMIENTO tolerante: localStorage con respaldo en memoria
   ============================================================ */
var _mem = {};
var Guardado = {
  leer: function(k){
    try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch(e){ return _mem[k] || null; }
  },
  escribir: function(k, v){
    try { window.localStorage.setItem(k, JSON.stringify(v)); }
    catch(e){ _mem[k] = v; }
  }
};

/* ---------- Puente con Apps Script ---------- */
function llamar(fn, arg){
  return new Promise(function(res, rej){
    if (typeof google === "undefined" || !google.script){
      return rej(new Error("Fuera de Apps Script"));
    }
    google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](arg);
  });
}

/** Variante para funciones del servidor que reciben varios argumentos. */
function llamarArgs(fn, args){
  return new Promise(function(res, rej){
    if (typeof google === "undefined" || !google.script){
      return rej(new Error("Fuera de Apps Script"));
    }
    var runner = google.script.run.withSuccessHandler(res).withFailureHandler(rej);
    runner[fn].apply(runner, args || []);
  });
}

/* Valor por defecto de destinosTaller anterior a 2026-08-17: sólo cuatro
   entradas y con TALLERES adentro. Quien lo trae guardado tal cual nunca
   eligió taller de salud mental a propósito, así que se sustituye por los
   ocho canónicos en vez de limpiarlo a medias. */
var DESTINOS_TALLER_ANTERIOR = [
  "TALLERES", "PREVENCIÓN IRAS Y EDAS", "VSO", "PREVENCIÓN ACCIDENTES EN EL HOGAR"
];

function mismaLista_(a, b){
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++){ if (a[i] !== b[i]) return false; }
  return true;
}

/* ---------- Preferencias: caché local, refresco en segundo plano ---------- */
/**
 * Cura una preferencia cruda —local o recién llegada del servidor— para que
 * siempre tenga los cuatro campos completos y válidos: agrega lo que falte,
 * migra destinosTaller si es la lista anterior a 2026-08-17, limpia entradas
 * inválidas y corrige un divisor fuera de rango. Es la única puerta de
 * entrada: preferencias() y aplicarBootstrap() (en capturador.html) deben
 * pasar los dos por aquí, o la migración no se aplica de verdad (hallazgo
 * C-1, revisión de la Task 1: el bootstrap del servidor llegaba crudo y
 * `divisorOrientacionPF` terminaba `undefined`). No muta su entrada.
 */
function curarPref_(p){
  var q = {};
  Object.keys(p || {}).forEach(function(k){ q[k] = p[k]; });

  if (!q.setHabitual || !q.setHabitual.length) q.setHabitual = PREF_INICIALES.setHabitual.slice();

  if (!q.destinosTaller || !q.destinosTaller.length) {
    q.destinosTaller = PREF_INICIALES.destinosTaller.slice();
  } else if (mismaLista_(q.destinosTaller, DESTINOS_TALLER_ANTERIOR)) {
    q.destinosTaller = DESTINOS_TALLER_CANONICOS.slice();
  } else {
    var limpios = q.destinosTaller
      .filter(function(n){ return n !== IND_TALLERES; })
      .filter(function(n){ return INDICADORES_29.indexOf(n) >= 0; });
    q.destinosTaller = limpios.length ? limpios : PREF_INICIALES.destinosTaller.slice();
  }

  if (typeof q.factorPreservativos !== "number") {
    q.factorPreservativos = PREF_INICIALES.factorPreservativos;
  }
  if (typeof q.divisorOrientacionPF !== "number" || !divisorOrientacionPFValido_(q.divisorOrientacionPF)) {
    q.divisorOrientacionPF = DIVISOR_ORIENTACION_PF;
  }
  return q;
}

function preferencias(){
  return curarPref_(Guardado.leer("pref") || {});
}

function guardarPref(p){
  Guardado.escribir("pref", p);
  llamar("guardarPreferencias", p).catch(function(){ /* offline: queda local */ });
}

function sincronizarPref(){
  return llamar("leerPreferencias").then(function(remoto){
    if (remoto) Guardado.escribir("pref", remoto);
    return preferencias();
  }).catch(function(){ return preferencias(); });
}

/* ---------- Fotos: compresión antes de salir del teléfono ---------- */
function comprimirFoto(file, etiqueta){
  return new Promise(function(res, rej){
    var lector = new FileReader();
    lector.onerror = function(){ rej(new Error("No se pudo leer la imagen")); };
    lector.onload = function(ev){
      var img = new Image();
      img.onerror = function(){ rej(new Error("Imagen inválida")); };
      img.onload = function(){
        var max = 1400, esc = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.width * esc);
        cv.height = Math.round(img.height * esc);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        res({
          nombre: file.name,
          datos: cv.toDataURL("image/jpeg", 0.72),
          modulo: etiqueta || "JORNADA"
        });
      };
      img.src = ev.target.result;
    };
    lector.readAsDataURL(file);
  });
}

/* ---------- Cola offline compartida por los dos modos ---------- */
function encolar(paquete){
  var cola = Guardado.leer("cola") || [];
  var yaEsta = cola.some(function(p){ return p.idLocal === paquete.idLocal; });
  if (yaEsta){
    cola = cola.map(function(p){ return p.idLocal === paquete.idLocal ? paquete : p; });
  } else {
    cola.push(paquete);
  }
  Guardado.escribir("cola", cola);
  return cola.length;
}

function pendientes(){
  return (Guardado.leer("cola") || []).length;
}

function drenarCola(){
  var cola = Guardado.leer("cola") || [];
  if (!cola.length || !navigator.onLine) return Promise.resolve(cola.length);
  var sig = cola[0];
  var fn = sig.modulos ? "guardarJornadaCompleta" : "guardarCierre";
  return llamar(fn, sig).then(function(){
    var resto = (Guardado.leer("cola") || []).filter(function(p){
      return p.idLocal !== sig.idLocal;
    });
    Guardado.escribir("cola", resto);
    return drenarCola();
  }).catch(function(){
    return (Guardado.leer("cola") || []).length;
  });
}

/* ---------- Formato ---------- */
function miles(n){ return Number(n || 0).toLocaleString("es-MX"); }


var UNIDADES = [], MODULOS = [];

function pintarUnidades(){
  var sel = document.getElementById('unidad');
  UNIDADES.forEach(function(u){
    var op = document.createElement('option');
    op.value = u.id; op.textContent = u.nombre + ' (' + u.municipio + ')';
    sel.appendChild(op);
  });
}

function pintarModulos(){
  var cont = document.getElementById('modulos');
  MODULOS.forEach(function(m){
    var etq = document.createElement('label');
    etq.className = 'chk';
    var chk = document.createElement('input');
    chk.type = 'checkbox'; chk.value = m.clave;
    var txt = document.createElement('span'); txt.textContent = ' ' + m.nombre;
    etq.appendChild(chk); etq.appendChild(txt);
    cont.appendChild(etq);
  });
}

function unidadElegida(){
  var u = UNIDADES.filter(function(x){ return x.id === document.getElementById('unidad').value; })[0];
  document.getElementById('municipioUnidad').textContent = u ? u.municipio : '—';
  document.getElementById('coordinacionUnidad').textContent = u ? u.coordinacion : '—';
  validarFormulario();
}

function modulosSeleccionados(){
  return Array.prototype.slice.call(document.querySelectorAll('#modulos input:checked')).map(function(c){ return c.value; });
}

function validarFormulario(){
  var obligatorios = ['unidad', 'fecha', 'localidad', 'lugar', 'poblacionProyectada', 'solicitante'];
  var completos = obligatorios.every(function(id){ return document.getElementById(id).value.trim(); });
  document.getElementById('btnEnviar').disabled = !(completos && modulosSeleccionados().length);
}

function mostrarAviso(msg){
  var a = document.getElementById('aviso');
  a.textContent = msg; a.classList.remove('oculto');
}

document.getElementById('form').addEventListener('input', validarFormulario);

document.getElementById('form').addEventListener('submit', function(ev){
  ev.preventDefault();
  document.getElementById('aviso').classList.add('oculto');
  var datos = {
    unidadId: document.getElementById('unidad').value,
    fecha: document.getElementById('fecha').value,
    localidad: document.getElementById('localidad').value.trim(),
    lugar: document.getElementById('lugar').value.trim(),
    poblacionProyectada: Number(document.getElementById('poblacionProyectada').value),
    modulos: modulosSeleccionados(),
    solicitante: document.getElementById('solicitante').value.trim()
  };
  document.getElementById('btnEnviar').disabled = true;
  llamar('altaJornadaMedica', datos).then(function(r){
    document.getElementById('folioResultado').textContent = r.folio;
    document.getElementById('mensajeResultado').textContent = r.actualizada
      ? 'Ya existía una jornada con esa fecha, municipio y lugar: se actualizó.'
      : 'Jornada nueva creada.';
    document.getElementById('confirmacion').classList.remove('oculto');
    document.getElementById('form').classList.add('oculto');
  }).catch(function(e){
    mostrarAviso(e.message || String(e));
    document.getElementById('btnEnviar').disabled = false;
  });
});

document.getElementById('btnOtra').addEventListener('click', function(){
  document.getElementById('form').reset();
  document.getElementById('confirmacion').classList.add('oculto');
  document.getElementById('form').classList.remove('oculto');
  unidadElegida();
});

document.getElementById('unidad').addEventListener('change', unidadElegida);

llamar('datosAltaMedica').then(function(d){
  UNIDADES = d.unidades; MODULOS = d.modulos;
  pintarUnidades(); pintarModulos(); validarFormulario();
}).catch(function(e){ mostrarAviso('No se pudo cargar el catálogo: ' + (e.message || e)); });
