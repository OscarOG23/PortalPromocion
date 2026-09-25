/* ARCHIVO GENERADO por JS19-JORNADAS/scripts/publicar_pages.py — NO EDITAR A MANO. */
/* ============================================================
   PUENTE · capturador de JS19 servido desde GitHub Pages
   Va al principio de app.js (scripts/publicar_pages.py). Sustituye
   google.script.run por fetch POST al /exec (EXEC_JORNADAS, config.js)
   con {"accion", "args"} en text/plain, igual que Atención: con
   application/json el navegador exige un OPTIONS que Apps Script no
   contesta. El resto del capturador es el mismo código que en /exec.

   El boleto del portal se lee de la dirección una vez, se quita con
   history.replaceState y viaja en cada guardado: el servidor pone la
   coordinación y valida la unidad. Sin boleto, la pantalla pide entrar
   desde el portal (el /exec sigue sirviendo el acceso de siempre).
   ============================================================ */

var ACCIONES_PUENTE = ["entrarConBoleto", "datosArranque", "guardarCierre",
  "guardarJornadaCompleta", "leerPreferencias", "guardarPreferencias"];
var CLAVE_BOLETO_PUENTE = "jornadas:boleto";
var ESPERA_PUENTE_MS = 45000;
var ESPERA_SUBIDA_PUENTE_MS = 180000; // un cierre de jornada lleva fotos
var MSG_ENTRE_PUENTE = "Entre desde el portal de Promoción.";

/** Lee el boleto de ?boleto= y lo borra de la dirección y del historial. */
function boletoDeUrl_(busqueda){
  var q;
  try { q = new URLSearchParams(busqueda); } catch (e){ return { boleto: null, resto: busqueda }; }
  var b = q.get("boleto");
  q["delete"]("boleto");
  var resto = q.toString();
  return { boleto: b || null, resto: resto ? "?" + resto : "" };
}

function modoDeBusqueda_(busqueda){
  var m = "";
  try { m = new URLSearchParams(busqueda).get("modo") || ""; } catch (e){ m = ""; }
  return m === "jornada" || m === "modulo" ? m : "";
}

/** Los guardados llevan el boleto; sólo si no traen ya uno (la cola conserva el suyo). */
function conBoleto_(accion, args, boleto){
  if (!boleto || (accion !== "guardarCierre" && accion !== "guardarJornadaCompleta")) return args;
  var p = args[0];
  if (p && typeof p === "object" && !p.boleto) p.boleto = boleto;
  return args;
}

/** Arranque desde Pages: la lista de unidades es sólo la de la coordinación del boleto. */
function mezclarEntrada_(arranque, entrada){
  var b = arranque || {};
  b.ficha = b.ficha || { unidades: [], costos: [] };
  b.ficha.unidades = entrada.unidades || [];
  b.coordinacion = { id: entrada.coordinacion_id, nombre: entrada.nombre };
  return b;
}

var BOLETO_PUENTE = null;

function leerBoletoInicial_(){
  var r = boletoDeUrl_(location.search);
  if (r.boleto){
    try { history.replaceState(history.state, "", location.pathname + r.resto + location.hash); }
    catch (e){ /* sin history: el boleto vence solo */ }
    try { sessionStorage.setItem(CLAVE_BOLETO_PUENTE, r.boleto); } catch (e){ /* sin almacenamiento */ }
    return r.boleto;
  }
  try { return sessionStorage.getItem(CLAVE_BOLETO_PUENTE); } catch (e){ return null; }
}

function llamarExec_(accion, args){
  if (typeof EXEC_JORNADAS !== "string" || !EXEC_JORNADAS){
    return Promise.reject(new Error("Falta configurar la dirección del sistema (config.js)."));
  }
  var control = window.AbortController ? new AbortController() : null;
  var espera = /^guardar(Cierre|JornadaCompleta)$/.test(accion) ? ESPERA_SUBIDA_PUENTE_MS : ESPERA_PUENTE_MS;
  var reloj = control ? setTimeout(function(){ control.abort(); }, espera) : 0;
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

/** Lo que el capturador pide por google.script.run, contestado desde el /exec. */
function atenderPuente_(accion, args){
  if (ACCIONES_PUENTE.indexOf(accion) < 0) return Promise.reject(new Error("Acción no disponible: " + accion));
  // Sin boleto no se llama al servidor: en Pages sólo se entra desde el portal.
  if (!BOLETO_PUENTE) return Promise.reject(new Error(MSG_ENTRE_PUENTE));
  if (accion === "datosArranque"){
    return llamarExec_("entrarConBoleto", [BOLETO_PUENTE]).then(function(entrada){
      return llamarExec_("datosArranque", []).then(function(b){
        pintarCoordinacionPuente_(entrada.nombre);
        return mezclarEntrada_(b, entrada);
      });
    });
  }
  return llamarExec_(accion, conBoleto_(accion, args, BOLETO_PUENTE));
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

function pintarCoordinacionPuente_(nombre){
  var sub = document.querySelector("header .sub");
  if (sub && nombre) sub.textContent = "Coordinación: " + nombre;
}

/** Sin boleto: la pantalla sólo dice por dónde se entra. */
function mostrarSinBoletoPuente_(){
  ["contexto", "avisoRed", "avisoCola"].forEach(function(id){
    var n = document.getElementById(id); if (n) n.classList.add("oculto");
  });
  Array.prototype.forEach.call(document.querySelectorAll(".progreso, .wrap, .barra"), function(n){
    n.style.display = "none";
  });
  var caja = document.createElement("div");
  caja.className = "wrap";
  var tarjeta = document.createElement("section");
  tarjeta.className = "card";
  var h = document.createElement("h2"); h.textContent = "Captura de Jornadas";
  var p = document.createElement("p"); p.setAttribute("role", "alert"); p.textContent = MSG_ENTRE_PUENTE;
  tarjeta.appendChild(h); tarjeta.appendChild(p); caja.appendChild(tarjeta);
  document.body.insertBefore(caja, document.querySelector(".barra"));
}

/* Sólo en el navegador: en las pruebas de Node no hay location. */
if (typeof window !== "undefined" && typeof location !== "undefined"){
  BOLETO_PUENTE = leerBoletoInicial_();
  window.google = { script: { run: crearRunnerPuente_(null, null) } };
  if (!BOLETO_PUENTE) mostrarSinBoletoPuente_();
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


/* ---- Pages: claves locales con prefijo, el origen es compartido con el portal ---- */
(function(){
  var leer = Guardado.leer, escribir = Guardado.escribir;
  Guardado.leer = function(k){ return leer("jornadas:" + k); };
  Guardado.escribir = function(k, v){ return escribir("jornadas:" + k, v); };
})();


/* ============================================================
   FICHA TÉCNICA · lógica pura compartida
   La incluye el capturador (revisión antes de enviar) y la evalúa
   el servidor (Ficha.gs → logicaFicha_) al generar el documento:
   costo, total y avance salen del MISMO código en los dos lados.
   Sin DOM, sin Apps Script, sin red. `var` y `function` de nivel
   superior: tests/extraer.mjs sólo ve esa forma (regla 9).
   Spec: docs/superpowers/specs/2026-09-25-ficha-tecnica-design.md
   ============================================================ */

/** Datos que la ficha pide y SAM no: blanco = no se ofreció, 0 = sin atender. */
var COMPLEMENTARIOS_FICHA = [
  { clave: "TELEMEDICINA",        etiqueta: "Telemedicina" },
  { clave: "LAB_CLINICO",         etiqueta: "Estudios de laboratorio" },
  { clave: "RX",                  etiqueta: "Servicio de rayos X" },
  { clave: "ULTRASONIDO",         etiqueta: "Ultrasonido" },
  { clave: "ECG",                 etiqueta: "Electrocardiogramas" },
  { clave: "DENSITOMETRIA",       etiqueta: "Densitometría ósea" },
  { clave: "HEPATITIS_B",         etiqueta: "Detección de hepatitis B" },
  { clave: "TALLER_HIGIENE",      etiqueta: "Talleres de cuidado e higiene personal (número de talleres)" },
  { clave: "TALLER_IRAS_EDAS",    etiqueta: "Talleres de prevención de IRAs y EDAs (número de talleres)" },
  { clave: "TALLER_SALUD_MENTAL", etiqueta: "Talleres de salud mental (número de talleres)" },
  { clave: "TALLER_ACCIDENTES",   etiqueta: "Talleres de prevención de accidentes en el hogar (número de talleres)" },
  { clave: "TALLER_NUTRICION",    etiqueta: "Talleres de nutrición (número de talleres)" },
  { clave: "SILLAS_RUEDAS",       etiqueta: "Sillas de ruedas entregadas" },
  { clave: "BASTONES",            etiqueta: "Bastones entregados" },
  { clave: "ANDADERAS",           etiqueta: "Andaderas entregadas" }
];

/**
 * Los 23 conceptos del párrafo «Acciones realizadas», en su orden. Cada uno
 * sale de UN indicador oficial (suma por jornada de PRODUCTIVIDAD) o de UN
 * complementario. VIH/sífilis es prueba dual: se cuenta una vez, desde VIH.
 * Los talleres de la ficha son NÚMERO DE TALLERES, no asistentes.
 */
var CONCEPTOS_FICHA = [
  { clave: "CONSULTA_MEDICA",        etiqueta: "Consulta médica",                      indicador: "CONSULTA MÉDICA" },
  { clave: "CONSULTA_ODONTOLOGICA",  etiqueta: "Consulta odontológica",                indicador: "CONSULTA ODONTOLÓGICA" },
  { clave: "LAB_CLINICO",            etiqueta: "Estudios de laboratorio",              complementario: "LAB_CLINICO" },
  { clave: "RX",                     etiqueta: "Servicio de rayos X",                  complementario: "RX" },
  { clave: "ULTRASONIDO",            etiqueta: "Ultrasonido",                          complementario: "ULTRASONIDO" },
  { clave: "ECG",                    etiqueta: "Electrocardiogramas",                  complementario: "ECG" },
  { clave: "DENSITOMETRIA",          etiqueta: "Densitometría ósea",                   complementario: "DENSITOMETRIA" },
  { clave: "VACUNACION_UNIVERSAL",   etiqueta: "Vacunación universal",                 indicador: "VACUNACIÓN UNIVERSAL" },
  { clave: "DETECCION_CRONICAS",     etiqueta: "Detección de enfermedades crónicas",   indicador: "FACTORES DE RIESGO" },
  { clave: "VIH_SIFILIS",            etiqueta: "Detección de VIH/sífilis",             indicador: "VIH" },
  { clave: "HEPATITIS_B",            etiqueta: "Detección de hepatitis B",             complementario: "HEPATITIS_B" },
  { clave: "PLANIFICACION_FAMILIAR", etiqueta: "Planificación familiar (métodos entregados)", indicador: "MÉTODOS DE PLANIFICACIÓN FAMILIAR" },
  { clave: "TALLER_HIGIENE",         etiqueta: "Talleres de cuidado e higiene personal", complementario: "TALLER_HIGIENE" },
  { clave: "TALLER_IRAS_EDAS",       etiqueta: "Talleres de prevención de IRAs y EDAs",  complementario: "TALLER_IRAS_EDAS" },
  { clave: "TALLER_SALUD_MENTAL",    etiqueta: "Talleres de salud mental",             complementario: "TALLER_SALUD_MENTAL" },
  { clave: "TALLER_ACCIDENTES",      etiqueta: "Talleres de prevención de accidentes en el hogar", complementario: "TALLER_ACCIDENTES" },
  { clave: "TALLER_NUTRICION",       etiqueta: "Talleres de nutrición",                complementario: "TALLER_NUTRICION" },
  { clave: "ESTERILIZACION_CANINA",  etiqueta: "Esterilización canina/felina",         indicador: "ESTERILIZACIÓN CANINA/FELINA" },
  { clave: "VACUNACION_CANINA",      etiqueta: "Vacunación canina/felina",             indicador: "VACUNACIÓN CANINA/FELINA" },
  { clave: "TELEMEDICINA",           etiqueta: "Telemedicina",                         complementario: "TELEMEDICINA" },
  { clave: "SILLAS_RUEDAS",          etiqueta: "Sillas de ruedas entregadas",          complementario: "SILLAS_RUEDAS" },
  { clave: "BASTONES",               etiqueta: "Bastones entregados",                  complementario: "BASTONES" },
  { clave: "ANDADERAS",              etiqueta: "Andaderas entregadas",                 complementario: "ANDADERAS" }
];

var ENCABEZADOS_FICHA = ["FOLIO", "UNIDAD_ID", "COORDINACION", "POBLACION_PROYECTADA"]
  .concat(COMPLEMENTARIOS_FICHA.map(function(c){ return c.clave; }))
  .concat(["COSTO", "TOTAL_ACTIVIDADES", "AVANCE", "FICHA_DOC", "FICHA_PDF", "GENERADA_EN"]);

var ENCABEZADOS_COSTOS = ["CONCEPTO", "COSTO_UNITARIO", "ACTIVO"];

/**
 * Costos unitarios 2025, reconstruidos de la hoja «COSTOS POR UNITARIO».
 * Los que no se conocen van en 0: la generación avisa por cada concepto con
 * cifra y costo 0, y el responsable los llena en la hoja COSTOS.
 */
var COSTOS_CONOCIDOS_2025 = {
  CONSULTA_MEDICA: 220, CONSULTA_ODONTOLOGICA: 120, VACUNACION_UNIVERSAL: 150,
  DETECCION_CRONICAS: 5, VIH_SIFILIS: 750, HEPATITIS_B: 1600, PLANIFICACION_FAMILIAR: 455,
  TALLER_HIGIENE: 750, TALLER_IRAS_EDAS: 750, TALLER_SALUD_MENTAL: 750,
  TALLER_ACCIDENTES: 750, TALLER_NUTRICION: 750
};

var COSTOS_SEMILLA = CONCEPTOS_FICHA.map(function(c){
  return [c.clave, COSTOS_CONOCIDOS_2025[c.clave] || 0, "SI"];
});

var MESES_FICHA = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/* ---------- utilidades internas ---------- */
function vacioFicha_(v){ return v === "" || v === null || v === undefined; }

function numFicha_(v){
  if (vacioFicha_(v)) return 0;
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

/** Entero ≥ 0 o blanco: lo que se acepta de una captura. */
function enteroFicha_(v){
  if (vacioFicha_(v) || String(v).trim() === "") return "";
  var n = Number(v);
  if (!isFinite(n) || n < 0) return "";
  return Math.round(n);
}

function milesFicha_(n){
  var s = String(Math.round(numFicha_(n)));
  var neg = s.charAt(0) === "-";
  if (neg) s = s.slice(1);
  return (neg ? "-" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function pesosFicha_(n){
  var centavos = Math.round(numFicha_(n) * 100);
  var enteros = Math.floor(centavos / 100), resto = centavos % 100;
  return "$" + milesFicha_(enteros) + "." + (resto < 10 ? "0" : "") + resto;
}

function sinAcentosFicha_(texto){
  return String(texto === null || texto === undefined ? "" : texto)
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** {d, m, a} desde Date, "AAAA-MM-DD" o "DD/MM/AAAA"; null si no se entiende. */
function partesFechaFicha_(v){
  if (v instanceof Date && !isNaN(v.getTime())) return { d: v.getDate(), m: v.getMonth() + 1, a: v.getFullYear() };
  var s = String(v === null || v === undefined ? "" : v).trim(), r;
  if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return { d: +r[3], m: +r[2], a: +r[1] };
  if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return { d: +r[1], m: +r[2], a: +r[3] };
  return null;
}

function dosDigitosFicha_(n){ return (n < 10 ? "0" : "") + n; }

/* ---------- cálculo ---------- */

/** Indicadores oficiales que la ficha usa. */
function indicadoresDeFicha(){
  return CONCEPTOS_FICHA.filter(function(c){ return c.indicador; })
    .map(function(c){ return c.indicador; });
}

/**
 * Suma por jornada (todos los módulos) de los indicadores que usa la ficha.
 * `filas` son las de PRODUCTIVIDAD sin encabezado; la columna 0 es el folio.
 * Blanco en todas las filas → blanco (no se ofreció).
 */
function sumarProductividadFolio(encabezados, filas, folio){
  var objetivo = String(folio || "").trim(), salida = {};
  var nombres = (encabezados || []).map(function(h){ return String(h === null || h === undefined ? "" : h).trim(); });
  indicadoresDeFicha().forEach(function(ind){
    var col = nombres.indexOf(ind), suma = "";
    if (col >= 0){
      (filas || []).forEach(function(f){
        if (String(f[0] === null || f[0] === undefined ? "" : f[0]).trim() !== objetivo) return;
        if (vacioFicha_(f[col]) || String(f[col]).trim() === "") return;
        suma = numFicha_(suma) + numFicha_(f[col]);
      });
    }
    salida[ind] = suma;
  });
  return salida;
}

/** Las 23 cifras de la ficha: [{clave, etiqueta, cifra}] con cifra número o "". */
function conceptosFicha(indicadores, complementarios){
  var ind = indicadores || {}, comp = complementarios || {};
  return CONCEPTOS_FICHA.map(function(c){
    var v = c.indicador ? ind[c.indicador] : comp[c.complementario];
    return { clave: c.clave, etiqueta: c.etiqueta, cifra: vacioFicha_(v) || String(v).trim() === "" ? "" : numFicha_(v) };
  });
}

/** Criterio de la ficha 2025: suma de los 23. NO es el TOTAL DE ACTIVIDADES de SAM. */
function totalActividadesFicha(conceptos){
  return (conceptos || []).reduce(function(t, c){ return t + numFicha_(c.cifra); }, 0);
}

/**
 * Σ cifra × COSTO_UNITARIO. Un concepto con cifra y sin costo (ausente,
 * inactivo o en 0) suma $0 y deja un aviso con su nombre.
 */
function costoFicha(conceptos, costos){
  var mapa = {};
  (costos || []).forEach(function(c){
    if (c && c.concepto) mapa[String(c.concepto).trim()] = c;
  });
  var total = 0, avisos = [];
  (conceptos || []).forEach(function(c){
    var cifra = numFicha_(c.cifra);
    if (!cifra) return;
    var fila = mapa[c.clave];
    var unitario = fila && fila.activo !== false ? numFicha_(fila.costo) : 0;
    if (!unitario){
      avisos.push(c.etiqueta + ": hay " + cifra + " y no tiene costo unitario en COSTOS; cuenta $0.");
      return;
    }
    total += cifra * unitario;
  });
  return { costo: Math.round(total * 100) / 100, avisos: avisos };
}

/** Población atendida ÷ proyectada, en porcentaje entero; null sin proyectada. */
function avanceFicha(atendida, proyectada){
  var p = numFicha_(proyectada);
  if (!p) return null;
  return Math.round(numFicha_(atendida) / p * 100);
}

function textoAvance(avance){
  return avance === null || avance === undefined || avance === "" ? "—" : avance + "%";
}

function coordinacionDeUnidad(unidadId, unidades){
  var id = String(unidadId || "").trim();
  if (!id) return null;
  var u = (unidades || []).filter(function(x){ return x.id === id; })[0];
  return u ? { coordinacion: u.coordinacion, coordinacionId: u.coordinacionId, nombre: u.nombre } : null;
}

/** Sanea lo que llega del capturador: sólo las 15 claves, enteros ≥ 0 o blanco. */
function normalizarFicha(entrada){
  var e = entrada || {}, comp = e.complementarios || {}, salida = {};
  COMPLEMENTARIOS_FICHA.forEach(function(c){ salida[c.clave] = enteroFicha_(comp[c.clave]); });
  return {
    unidadId: String(e.unidadId || "").trim(),
    poblacionProyectada: enteroFicha_(e.poblacionProyectada),
    complementarios: salida
  };
}

/** Todo lo que la revisión y la generación necesitan, en una llamada. */
function resumenFicha(indicadores, ficha, costos, poblacionAtendida){
  var f = normalizarFicha(ficha);
  var conceptos = conceptosFicha(indicadores, f.complementarios);
  var costo = costoFicha(conceptos, costos);
  var avance = avanceFicha(poblacionAtendida, f.poblacionProyectada);
  var avisos = costo.avisos.slice();
  if (avance === null) avisos.push("Sin población proyectada: el avance real queda en «—».");
  if (!f.unidadId) avisos.push("Falta la unidad de adscripción: la coordinación queda vacía.");
  return {
    conceptos: conceptos,
    total: totalActividadesFicha(conceptos),
    costo: costo.costo,
    avance: avance,
    avisos: avisos
  };
}

/**
 * Fila de FICHA tras un cierre: la captura manda sobre unidad, coordinación
 * (deducida, nunca tecleada), proyectada y los 15 complementarios; lo
 * calculado al generar y los enlaces se conservan.
 */
function filaFichaCombinada(encabezados, previa, folio, ficha, unidades, coordinacionForzada){
  var f = normalizarFicha(ficha);
  var coord = coordinacionDeUnidad(f.unidadId, unidades);
  var nueva = {
    FOLIO: String(folio || "").trim(),
    UNIDAD_ID: f.unidadId,
    // Con boleto del portal, la coordinación es la del boleto (Portal.gs).
    COORDINACION: coordinacionForzada || (coord ? coord.coordinacion : ""),
    POBLACION_PROYECTADA: f.poblacionProyectada
  };
  COMPLEMENTARIOS_FICHA.forEach(function(c){ nueva[c.clave] = f.complementarios[c.clave]; });
  return (encabezados || []).map(function(h, i){
    var nombre = String(h || "").trim();
    if (Object.prototype.hasOwnProperty.call(nueva, nombre)) return nueva[nombre];
    return previa && previa[i] !== undefined && previa[i] !== null ? previa[i] : "";
  });
}

/* ---------- documento ---------- */

function fechaLargaFicha(fecha){
  var p = partesFechaFicha_(fecha);
  return p ? p.d + " de " + MESES_FICHA[p.m - 1] + " de " + p.a : "";
}

/** «FICHA TECNICA JORNADA DD-MM-AAAA LUGAR», sin lo que Drive o Windows rechazan. */
function nombreArchivoFicha(fecha, lugar){
  var p = partesFechaFicha_(fecha);
  var f = p ? dosDigitosFicha_(p.d) + "-" + dosDigitosFicha_(p.m) + "-" + p.a : "SIN-FECHA";
  var l = String(lugar || "").replace(/[\\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return ("FICHA TECNICA JORNADA " + f + (l ? " " + l : "")).slice(0, 150);
}

/** Mapa {{ETIQUETA}} → texto. Las fotos ({{FOTO_1}}, {{FOTO_2}}) se insertan aparte. */
function etiquetasFicha(d){
  var x = d || {}, p = partesFechaFicha_(x.fecha), t = {};
  t["{{FECHA}}"] = fechaLargaFicha(x.fecha);
  t["{{ANIO}}"] = p ? String(p.a) : "";
  t["{{LUGAR}}"] = String(x.lugar || "");
  t["{{LOCALIDAD}}"] = String(x.localidad || "");
  t["{{COORDINACION}}"] = String(x.coordinacion || "");
  t["{{MUNICIPIO}}"] = String(x.municipio || "");
  t["{{POBLACION_ATENDIDA}}"] = milesFicha_(x.poblacionAtendida);
  t["{{POBLACION_PROYECTADA}}"] = numFicha_(x.poblacionProyectada) ? milesFicha_(x.poblacionProyectada) : "—";
  t["{{COSTO}}"] = pesosFicha_(x.costo);
  t["{{AVANCE}}"] = textoAvance(x.avance);
  t["{{TOTAL_ACTIVIDADES}}"] = milesFicha_(x.total);
  t["{{OBSERVACIONES}}"] = String(x.observaciones || "").trim() || "Sin observaciones.";
  (x.conceptos || []).forEach(function(c){ t["{{" + c.clave + "}}"] = milesFicha_(c.cifra); });
  return t;
}

/**
 * Traduce el nombre de una etiqueta AutoCrat de la plantilla 2025 a la
 * etiqueta estable nueva. El orden importa: lo específico va antes que lo
 * genérico (canina antes que vacuna, odontológica antes que consulta).
 * Devuelve "" si no la reconoce: se reporta, no se adivina.
 */
var REGLAS_AUTOCRAT = [
  [/PROYECTAD|ESPERAD/, "POBLACION_PROYECTADA"],
  [/ATENDID|BENEFICIAD/, "POBLACION_ATENDIDA"],
  [/TOTAL/, "TOTAL_ACTIVIDADES"],
  [/COSTO/, "COSTO"],
  [/AVANCE/, "AVANCE"],
  [/OBSERVACION/, "OBSERVACIONES"],
  [/ESTERILIZ/, "ESTERILIZACION_CANINA"],
  [/CANIN|FELIN|ANTIRRABIC/, "VACUNACION_CANINA"],
  [/TELEMEDICINA/, "TELEMEDICINA"],
  [/ODONTO|DENTAL/, "CONSULTA_ODONTOLOGICA"],
  [/CONSULTA/, "CONSULTA_MEDICA"],
  [/LABORATORIO/, "LAB_CLINICO"],
  [/RAYOS|\bRX\b/, "RX"],
  [/ULTRASONID/, "ULTRASONIDO"],
  [/ELECTROCARDIO|\bECG\b/, "ECG"],
  [/DENSITOMETR/, "DENSITOMETRIA"],
  [/VIH|SIFILIS/, "VIH_SIFILIS"],
  [/HEPATITIS/, "HEPATITIS_B"],
  [/CRONIC/, "DETECCION_CRONICAS"],
  [/PLANIFICACION|METODOS? ANTICONCEPTIV/, "PLANIFICACION_FAMILIAR"],
  [/HIGIENE/, "TALLER_HIGIENE"],
  [/\bIRAS?\b|\bEDAS?\b/, "TALLER_IRAS_EDAS"],
  [/SALUD MENTAL/, "TALLER_SALUD_MENTAL"],
  [/ACCIDENTE/, "TALLER_ACCIDENTES"],
  [/NUTRICION/, "TALLER_NUTRICION"],
  [/SILLA/, "SILLAS_RUEDAS"],
  [/BASTON/, "BASTONES"],
  [/ANDADERA/, "ANDADERAS"],
  [/VACUNA/, "VACUNACION_UNIVERSAL"],
  [/COORDINACION/, "COORDINACION"],
  [/MUNICIPIO/, "MUNICIPIO"],
  [/LOCALIDAD/, "LOCALIDAD"],
  [/LUGAR|SEDE/, "LUGAR"],
  [/FECHA/, "FECHA"]
];

function etiquetaNuevaDesdeAutocrat(nombre){
  var n = sinAcentosFicha_(nombre).replace(/[^A-Z0-9]+/g, " ").trim();
  if (!n) return "";
  var foto = /(?:FOTO|IMAGEN|EVIDENCIA)\S*\s*([12])\b/.exec(n);
  if (foto) return "FOTO_" + foto[1];
  for (var i = 0; i < REGLAS_AUTOCRAT.length; i++){
    if (REGLAS_AUTOCRAT[i][0].test(n)) return REGLAS_AUTOCRAT[i][1];
  }
  return "";
}

/** ID de un archivo de Drive dentro de su URL; "" si no trae uno. */
function idDriveFicha(url){
  var m = String(url || "").match(/[-\w]{25,}/);
  return m ? m[0] : "";
}

/**
 * Las primeras `n` fotos de EVIDENCIA para el folio, por fecha de captura
 * (columna 6). `filas` sin encabezado: FOLIO, MÓDULO, TIPO, DESCRIPCIÓN,
 * URL, SUBIDA POR, FECHA/HORA. Devuelve IDs de Drive.
 */
function primerasFotos(filas, folio, n){
  var objetivo = String(folio || "").trim();
  var tiempo = function(v){
    var t = v instanceof Date ? v.getTime() : new Date(v).getTime();
    return isNaN(t) ? Infinity : t;
  };
  return (filas || [])
    .map(function(f, i){ return { i: i, id: idDriveFicha(f[4]), t: tiempo(f[6]), folio: String(f[0] || "").trim() }; })
    .filter(function(x){ return x.folio === objetivo && x.id; })
    .sort(function(a, b){ return a.t - b.t || a.i - b.i; })
    .slice(0, n || 2)
    .map(function(x){ return x.id; });
}

/** Folios del mes con captura COMPLETA: los que entran a «Generar fichas del mes». */
function foliosFichasDelMes(jornadas, clave){
  var k = String(clave || "").trim();
  return (jornadas || []).filter(function(j){
    return String(j.mes || "").trim() === k && sinAcentosFicha_(j.estatus).trim() === "COMPLETA";
  }).map(function(j){ return j.folio; });
}


/* ============================================================
   CAPTURADOR · orquestación del wizard
   El modo llega de la plantilla y se recuerda en el dispositivo.
   ============================================================ */
var MODO_SERVIDOR = modoDeBusqueda_(location.search);
var ROTULOS = ["Jornada y módulo", "Productividad", "Evidencia", "Revisar y enviar"];

var estado = {
  modo: "",            // "jornada" | "modulo"
  paso: 1,
  jornadas: [],
  datos: {},           // { INDICADOR: número }
  // Asistentes aplicados al taller, para POBLACIÓN ATENDIDA. Se reinicia al
  // enviar (limpiar), al cambiar de jornada y al cambiar de modo. Fuera de
  // esos tres límites vive a propósito aunque se corrija a mano un
  // componente de TALLERES: la cifra de asistentes no cambia sólo porque VSO
  // se corrija (eso invalida la marca de TALLERES, no la cuenta de gente).
  // Se descartó derivarlo en vivo del campo "asistentes" (opción preferida
  // del hallazgo C-4): los botones +/- lo pueden mover sin volver a pedir el
  // cálculo, y eso desincronizaría POBLACIÓN ATENDIDA de los nueve
  // indicadores ya escritos en pantalla.
  valorTaller: 0,
  // Bloque «Solo para la ficha técnica» (modo jornada). No va a SAM: viaja
  // en paquete().ficha y el servidor lo guarda en la hoja FICHA por folio.
  ficha: fichaVacia_(""),
  fichaDatos: { unidades: [], costos: [] }, // del arranque: catálogo canónico y COSTOS
  fotos: [],
  pref: null,
  enviando: false,
  bootstrap: null,     // objeto de arranque tal como llegó del servidor
  catalogo: null,      // índice construido con crearIndiceCatalogo
  cacheMinutos: 0
};

var $ = function(id){ return document.getElementById(id); };

function fichaVacia_(unidadId){
  return { unidadId: unidadId || "", poblacionProyectada: "", complementarios: {} };
}

/* ---------- Arranque ---------- */
function iniciar(){
  estado.pref = preferencias();
  estado.modo = MODO_SERVIDOR || Guardado.leer("modo") || "";

  var prev = Guardado.leer("capturista");
  if (prev) $("capturista").value = prev;

  document.body.setAttribute("aria-busy", "true");
  cargarBootstrap().catch(function(error){
    vaciarSelect($("jornada"), "Sin conexión y sin catálogo guardado");
    alerta(error && error.message ? error.message : "No se pudo cargar el catálogo.", true);
  }).then(function(){
    document.body.removeAttribute("aria-busy");
  });

  sincronizarPref().then(function(p){ estado.pref = p; });

  aplicarModo(estado.modo);
  pintarProgreso();
  revisarCola();
}

/** El catálogo se acepta sólo si trae los 29 indicadores exactamente una vez. */
function aplicarBootstrap(b, desdeCache){
  var validacion = validarBootstrap(b);
  if (!validacion.ok) throw new Error("Catálogo incompleto: " + validacion.errores.join(", "));
  estado.bootstrap = b;
  estado.jornadas = b.jornadas || [];
  estado.catalogo = crearIndiceCatalogo(b.catalogo);
  // curarPref_ es obligatorio aquí: b.preferencias llega crudo de
  // leerPreferencias() y puede ser una preferencia guardada antes de la
  // migración (destinosTaller viejo, divisorOrientacionPF ausente). Usar el
  // objeto tal cual (hallazgo C-1, revisión de la Task 1) mandaba TALLERES en
  // 150 donde iban 413.
  estado.pref = curarPref_(b.preferencias || {});
  // Un servidor o una caché de antes de la ficha no trae el bloque: se
  // captura igual, sin unidades y con todos los costos en aviso.
  estado.fichaDatos = {
    unidades: (b.ficha && b.ficha.unidades) || [],
    costos: (b.ficha && b.ficha.costos) || []
  };
  estado.ficha.unidadId = estado.ficha.unidadId || Guardado.leer("fichaUnidad") || "";
  if (!desdeCache) Guardado.escribir("bootstrapValido", { guardadoEn: Date.now(), datos: b });
  pintarJornadas(estado.jornadas);
  pintarModulos([]);
}

function cargarBootstrap(){
  return llamar("datosArranque").then(function(b){ aplicarBootstrap(b, false); })
    .catch(function(error){
      var cache = Guardado.leer("bootstrapValido");
      if (!cache) throw error;
      estado.cacheMinutos = edadCache_(cache, Date.now());
      aplicarBootstrap(cache.datos, true);
      alerta("Sin conexión: catálogo guardado hace " + estado.cacheMinutos + " min.", true);
    });
}

function vaciarSelect(s, rotulo){
  s.textContent = "";
  var o = document.createElement("option");
  o.value = ""; o.textContent = rotulo;
  s.appendChild(o);
}

/** Los módulos ofrecidos son los convocados en la jornada y vigentes en CAT. */
function pintarModulos(claves){
  var s = $("modulo");
  vaciarSelect(s, "Selecciona el módulo…");
  (claves || []).forEach(function(clave){
    var m = estado.catalogo.modulos[clave], o = document.createElement("option");
    o.value = clave; o.textContent = clave + " · " + m.nombre;
    s.appendChild(o);
  });
}

function nombreModulo(clave){
  var m = estado.catalogo && estado.catalogo.modulos[clave];
  return m ? clave + " · " + m.nombre : clave;
}

function aplicarModo(modo){
  estado.modo = modo;
  estado.valorTaller = 0; // otro modo: la cuenta de asistentes al taller ya no aplica
  if (modo) Guardado.escribir("modo", modo);
  $("selectorModo").classList.toggle("oculto", !!modo);
  $("cajaModulo").classList.toggle("oculto", modo === "jornada");
  $("cajaEtiqueta").classList.toggle("oculto", modo !== "jornada");
  $("rotuloTotal").textContent =
    modo === "jornada" ? "Total de la jornada" : "Total del módulo";
  $("btnModoJornada").style.borderWidth = modo === "jornada" ? "3px" : "1px";
  $("btnModoModulo").style.borderWidth  = modo === "modulo"  ? "3px" : "1px";
}

$("btnModoJornada").addEventListener("click", function(){ aplicarModo("jornada"); });
$("btnModoModulo").addEventListener("click",  function(){ aplicarModo("modulo"); });

/* ---------- Progreso ---------- */
function pintarProgreso(){
  var c = $("pasos"); c.textContent = "";
  for (var i = 1; i <= 4; i++){
    var n = document.createElement("div");
    n.className = "paso-num" + (i === estado.paso ? " activo" : (i < estado.paso ? " hecho" : ""));
    n.textContent = i < estado.paso ? "✓" : String(i);
    if (i === estado.paso) n.setAttribute("aria-current", "step");
    c.appendChild(n);
    if (i < 4){
      var l = document.createElement("div");
      l.className = "paso-linea" + (i < estado.paso ? " hecho" : "");
      c.appendChild(l);
    }
  }
  $("rotuloPaso").textContent = "Paso " + estado.paso + " de 4 · " + ROTULOS[estado.paso - 1];
  ["p1","p2","p3","p4"].forEach(function(id, i){
    var visible = (i + 1) === estado.paso;
    $(id).classList.toggle("oculto", !visible);
    $(id).classList.remove("vista-entra");
    if (visible){ void $(id).offsetWidth; $(id).classList.add("vista-entra"); }
  });
  $("btnAtras").classList.toggle("oculto", estado.paso === 1);
  $("btnSiguiente").textContent = estado.paso === 4 ? "Enviar captura" : "Continuar →";
  window.scrollTo(0, 0);
  pintarContexto();
}

function pintarContexto(){
  var j = jornadaActual();
  if (!j || estado.paso === 1){ $("contexto").classList.add("oculto"); return; }
  $("contexto").classList.remove("oculto");
  var etiqueta = estado.modo === "jornada"
    ? "Jornada completa"
    : ($("modulo").value ? nombreModulo($("modulo").value) : "");
  $("ctxTxt").textContent = j.fecha + " · " + j.municipio + " · " + etiqueta;
  $("ctxTotal").textContent = miles(sumaTotal(estado.datos));
}

/* ---------- Jornadas ---------- */
function pintarJornadas(lista){
  estado.jornadas = lista || [];
  var s = $("jornada");
  vaciarSelect(s, "Selecciona la jornada…");
  estado.jornadas.forEach(function(j){
    var o = document.createElement("option");
    o.value = j.folio;
    o.textContent = j.fecha + " · " + j.municipio + " · " + j.lugar;
    s.appendChild(o);
  });
}

function jornadaActual(){
  var folio = $("jornada").value;
  return estado.jornadas.filter(function(x){ return x.folio === folio; })[0] || null;
}

/** Sede, responsable y programas vienen de hojas editables: se pintan como
    texto, nunca con innerHTML. */
function renglonDetalle(caja, rotulo, valor){
  var linea = document.createElement("div");
  var b = document.createElement("b"); b.textContent = rotulo + ": ";
  var t = document.createElement("span"); t.textContent = valor;
  linea.appendChild(b); linea.appendChild(t);
  caja.appendChild(linea);
}

$("jornada").addEventListener("change", function(){
  // P1-4 (revisión final de 52cc1fd): aquí vivía "estado.valorTaller = 0"
  // porque, en teoría, otra jornada invalida la cuenta de asistentes al
  // taller. Se quita a propósito: estado.datos — los 29 indicadores mismos,
  // incluido TALLERES y sus ocho componentes — NUNCA se limpia al cambiar de
  // jornada (sólo limpiar() lo hace, tras un envío real). Reiniciar
  // valorTaller solo, sin tocar estado.datos, era justo el defecto medido:
  // el capturista corrige un folio equivocado con el paso 2 ya lleno
  // (consultas 55 + taller 50 = 105), vuelve al paso 1, elige la jornada
  // correcta, y la población se va a 55 sin ningún aviso — cincuenta
  // personas desaparecidas. Las dos piezas de "lo que llevo capturado en
  // esta sesión" — estado.datos y valorTaller — deben vivir y morir juntas;
  // tener una regla de reinicio para una y otra regla distinta para la otra
  // es lo que producía el hueco. Si de verdad se quiere una jornada nueva
  // sin arrastrar nada de la anterior, hace falta una acción explícita de
  // "empezar de cero" que limpie estado.datos completo, no un reinicio
  // parcial y silencioso de una sola variable — eso es un cambio más grande,
  // deliberado, que queda fuera de este arreglo.
  var j = jornadaActual();
  if (!j){ $("datosJornada").classList.add("oculto"); pintarModulos([]); return; }
  $("datosJornada").classList.remove("oculto");

  var claves = modulosDeJornada_(j, estado.catalogo);
  pintarModulos(claves);

  var caja = $("detalleJornada");
  caja.textContent = "";
  renglonDetalle(caja, "Folio", j.folio);
  renglonDetalle(caja, "Localidad", j.localidad || "—");
  renglonDetalle(caja, "Responsable", j.responsable || "—");
  if (claves.length){
    renglonDetalle(caja, "Módulos convocados", "");
    var chips = document.createElement("div");
    var porModulo = {};
    (j.responsablesModulo || []).forEach(function(r){ porModulo[r.modulo] = r.responsable; });
    claves.forEach(function(clave){
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = nombreModulo(clave) +
        (porModulo[clave] ? " · " + porModulo[clave] : "");
      chips.appendChild(chip);
    });
    caja.appendChild(chips);
  }

  if (j.lat && j.lng){
    $("ligaMapa").href =
      "https://www.google.com/maps/search/?api=1&query=" + j.lat + "," + j.lng;
    $("ligaMapa").style.display = "block";
  } else {
    $("ligaMapa").style.display = "none";
  }
});

/* ---------- Steppers ---------- */
function filaIndicador(nombre){
  var d = document.createElement("div"); d.className = "ind";
  var s = document.createElement("span"); s.className = "ind-nom"; s.textContent = nombre;

  var st = document.createElement("div"); st.className = "stepper";
  var menos = document.createElement("button");
  menos.type = "button"; menos.textContent = "−";
  menos.setAttribute("aria-label", "Restar uno a " + nombre);
  var inp = document.createElement("input");
  inp.type = "number"; inp.min = "0"; inp.step = "1"; inp.inputMode = "numeric";
  inp.placeholder = "—"; inp.dataset.ind = nombre;
  inp.setAttribute("aria-label", nombre);
  if (estado.datos[nombre] !== undefined) inp.value = estado.datos[nombre];
  var mas = document.createElement("button");
  mas.type = "button"; mas.textContent = "+";
  mas.setAttribute("aria-label", "Sumar uno a " + nombre);

  menos.addEventListener("click", function(){
    var v = Number(inp.value || 0) - 1;
    inp.value = v < 0 ? 0 : v;
    registrar(inp);
  });
  mas.addEventListener("click", function(){
    inp.value = Number(inp.value || 0) + 1;
    registrar(inp);
  });
  inp.addEventListener("input", function(){ registrar(inp); });

  st.appendChild(menos); st.appendChild(inp); st.appendChild(mas);
  d.appendChild(s); d.appendChild(st);
  return d;
}

/** Blanco ≠ cero: blanco significa "no se ofreció el servicio". */
function registrar(inp){
  var n = inp.dataset.ind;
  if (inp.value === "") delete estado.datos[n];
  else estado.datos[n] = Number(inp.value);
  // Se edita a mano: su propia marca se apaga (hallazgo I-2: antes el return
  // de la rama de atados se saltaba esto) y la de todo lo que dependía de n
  // también, porque quedó calculado con un origen que ya cambió (C-2).
  invalidarCalculado(n);
  var pareja = parejaAtada(n);
  if (pareja){
    estado.datos = propagarAtados(estado.datos, n);
    // El valor de la pareja también acaba de cambiar (propagarAtados lo
    // iguala a n), así que lo que dependiera de LA PAREJA queda dudoso
    // también, no sólo lo que dependía de n (P1-1, revisión final de
    // 52cc1fd: con DEPENDE_DE.LÍPIDOS = [VIH, SÍFILIS] esto ya es
    // redundante con invalidarCalculado(n) de arriba, pero no hay que
    // apostarle a esa simetría — un futuro atado con una regla derivada de
    // un solo lado del par lo necesitaría de verdad).
    invalidarCalculado(pareja);
    marcarCalculado(pareja);
    refrescarCampos();
    return;
  }
  sumar();
}

function campoDe(nombre){
  return document.querySelector('[data-ind="' + nombre.replace(/"/g, '\\"') + '"]');
}

function marcarCalculado(nombre){
  var c = campoDe(nombre);
  if (c) c.classList.add("calculado");
}

function desmarcarCalculado(nombre){
  var c = campoDe(nombre);
  if (c) c.classList.remove("calculado");
}

/** Apaga la marca de `nombre` y la de todo lo que dependía de él, siguiendo
 * la cadena de DEPENDE_DE (nucleo.html). Estrategia elegida para el hallazgo
 * C-2: apagar la marca en vez de recalcular sola — más simple, y no pisa lo
 * que el capturista acaba de escribir. */
function invalidarCalculado(nombre){
  desmarcarCalculado(nombre);
  dependientesDe(nombre).forEach(desmarcarCalculado);
}

/**
 * Punto único para escribir un derivado: guarda el valor, apaga la marca de
 * quien dependía del valor anterior de `nombre` (dependientesDe, no de
 * `nombre` mismo: ese se marca fresco a continuación) y marca `nombre` como
 * calculado. Antes cada botón improvisaba su propio guardado — taller,
 * preservativos, orientación PF y lípidos — y sólo el del taller invalidaba
 * dependientes, de casualidad (P1-2, revisión final de 52cc1fd: recalcular
 * preservativos dejaba orientación PF en 100 y en oro cuando iban 10). Los
 * cuatro escritores deben pasar por aquí, o el próximo derivado que se
 * agregue va a repetir el mismo defecto.
 */
function fijarCalculado(nombre, valor){
  estado.datos[nombre] = valor;
  dependientesDe(nombre).forEach(desmarcarCalculado);
  marcarCalculado(nombre);
}

function sumar(){
  $("totalMod").textContent = miles(
    estado.modo === "jornada" ? totalActividades(estado.datos) : sumaTotal(estado.datos)
  );
  pintarContexto();
}

/** Vuelca estado.datos a los campos visibles (tras aplicar a varios o calcular). */
function refrescarCampos(){
  document.querySelectorAll("[data-ind]").forEach(function(inp){
    var v = estado.datos[inp.dataset.ind];
    inp.value = (v === undefined) ? "" : v;
  });
  sumar();
}

/* ---------- Paso 2: construir la lista según el modo ----------
 * Hallazgo diagnosticado, no arreglado (menor, revisión final de 52cc1fd):
 * la marca "calculado" no sobrevive a este repintado.
 *
 * marcarCalculado()/desmarcarCalculado() sólo tocan la classList del <input>
 * que ya está dibujado — no hay ningún registro en `estado` de "estos
 * nombres están calculados ahora mismo". construirPaso2() destruye
 * #indicadores y reconstruye cada fila con filaIndicador(), que repone el
 * VALOR (estado.datos[nombre]) pero nunca la clase "calculado", porque no
 * tiene de dónde leerla. Eso pasa cada vez que se vuelve a entrar al paso 2:
 * con btnAtras y Continuar de nuevo, o al cambiar de jornada y avanzar otra
 * vez (el mismo escenario de P1-4, arriba). El dato calculado sigue en
 * estado.datos — TALLERES puede seguir en 413 — pero nada en pantalla dice
 * ya que ese número viene de un cálculo, ni cuándo se hizo. La mitad de la
 * estrategia de invalidación (C-2/I-2: "apagar la marca cuando el origen
 * cambia") depende de que la marca sea confiable, y aquí se evapora sin que
 * el origen haya cambiado en absoluto.
 *
 * No se arregla aquí: arreglarlo de verdad exige mover la marca de la
 * classList a datos — un estado.marcados (nombre → boolean) que
 * marcarCalculado/desmarcarCalculado mantengan y que filaIndicador() consulte
 * al crear cada <input> — más decidir qué implica "calculado" al volver un
 * paso sin haber tocado nada. Es un cambio de modelo, no un ajuste de una
 * línea, y tocar eso a ciegas aquí arriesgaba las cuatro correcciones P1 de
 * esta misma revisión. Queda anotado para una tarea aparte.
 */
function construirPaso2(){
  var cont = $("indicadores"); cont.textContent = "";
  $("taller").classList.add("oculto");
  $("extras").classList.add("oculto");
  $("fichaTecnica").classList.add("oculto");

  if (estado.modo === "modulo"){
    var lista = (estado.catalogo.porModulo[$("modulo").value] || [])
      .filter(function(i){ return i.activo !== false; });
    var grupo = "";
    lista.forEach(function(ind){
      if (ind.grupo !== grupo){
        grupo = ind.grupo;
        var g = document.createElement("div");
        g.className = "grupo"; g.textContent = grupo;
        cont.appendChild(g);
      }
      cont.appendChild(filaIndicador(ind.indicador));
    });
  } else {
    construirModoJornada(cont);
    construirBloqueFicha();
  }
  refrescarCampos();
}

/* ---------- Solo para la ficha técnica (modo jornada) ----------
 * Lo que la Ficha Técnica pide y SAM no: unidad de adscripción, población
 * proyectada y 15 complementarios. La coordinación se deduce de la unidad
 * con el catálogo canónico; no se teclea. Los talleres aquí son NÚMERO DE
 * TALLERES, no asistentes. Spec: 2026-09-25-ficha-tecnica-design.md.
 */
function construirBloqueFicha(){
  var caja = $("fichaTecnica");
  caja.textContent = "";
  caja.classList.remove("oculto");

  var g = document.createElement("div");
  g.className = "grupo"; g.textContent = "Solo para la ficha técnica";
  caja.appendChild(g);
  var pista = document.createElement("p");
  pista.className = "mini";
  pista.textContent = "No va a SAM. Deja vacío lo que no se ofreció; 0 si se ofreció sin atender.";
  caja.appendChild(pista);

  var lu = document.createElement("label");
  lu.setAttribute("for", "fichaUnidad"); lu.textContent = "Unidad de adscripción";
  var sel = document.createElement("select"); sel.id = "fichaUnidad";
  var vacia = document.createElement("option");
  vacia.value = "";
  vacia.textContent = estado.fichaDatos.unidades.length
    ? "Selecciona la unidad…" : "Catálogo de unidades no disponible";
  sel.appendChild(vacia);
  var grupos = {};
  estado.fichaDatos.unidades.forEach(function(u){
    if (!grupos[u.coordinacion]){
      grupos[u.coordinacion] = document.createElement("optgroup");
      grupos[u.coordinacion].label = u.coordinacion;
      sel.appendChild(grupos[u.coordinacion]);
    }
    var o = document.createElement("option");
    o.value = u.id; o.textContent = u.nombre + " · " + u.municipio;
    grupos[u.coordinacion].appendChild(o);
  });
  sel.value = estado.ficha.unidadId;
  if (sel.value !== estado.ficha.unidadId) estado.ficha.unidadId = "";
  var coord = document.createElement("p");
  coord.className = "mini"; coord.id = "fichaCoordinacion";
  var pintarCoord = function(){
    var c = coordinacionDeUnidad(estado.ficha.unidadId, estado.fichaDatos.unidades);
    coord.textContent = "Coordinación: " + (c ? c.coordinacion : "—");
  };
  sel.addEventListener("change", function(){
    estado.ficha.unidadId = sel.value;
    Guardado.escribir("fichaUnidad", sel.value);
    pintarCoord();
  });
  pintarCoord();
  caja.appendChild(lu); caja.appendChild(sel); caja.appendChild(coord);

  var lp = document.createElement("label");
  lp.setAttribute("for", "fichaProyectada");
  lp.textContent = "Población proyectada (beneficiarios esperados)";
  var ip = document.createElement("input");
  ip.id = "fichaProyectada"; ip.type = "number"; ip.min = "0"; ip.step = "1";
  ip.inputMode = "numeric"; ip.placeholder = "—";
  ip.value = estado.ficha.poblacionProyectada;
  ip.addEventListener("input", function(){ estado.ficha.poblacionProyectada = ip.value; });
  caja.appendChild(lp); caja.appendChild(ip);

  COMPLEMENTARIOS_FICHA.forEach(function(c){ caja.appendChild(filaComplementario(c)); });
}

/** Stepper de un complementario: misma forma que filaIndicador, otro destino. */
function filaComplementario(c){
  var d = document.createElement("div"); d.className = "ind";
  var s = document.createElement("span"); s.className = "ind-nom"; s.textContent = c.etiqueta;
  var st = document.createElement("div"); st.className = "stepper";
  var menos = document.createElement("button");
  menos.type = "button"; menos.textContent = "−";
  menos.setAttribute("aria-label", "Restar uno a " + c.etiqueta);
  var inp = document.createElement("input");
  inp.type = "number"; inp.min = "0"; inp.step = "1"; inp.inputMode = "numeric";
  inp.placeholder = "—"; inp.dataset.comp = c.clave;
  inp.setAttribute("aria-label", c.etiqueta);
  var previo = estado.ficha.complementarios[c.clave];
  if (previo !== undefined && previo !== "") inp.value = previo;
  var mas = document.createElement("button");
  mas.type = "button"; mas.textContent = "+";
  mas.setAttribute("aria-label", "Sumar uno a " + c.etiqueta);
  var guardar = function(){
    if (inp.value === "") delete estado.ficha.complementarios[c.clave];
    else estado.ficha.complementarios[c.clave] = Number(inp.value);
  };
  menos.addEventListener("click", function(){
    var v = Number(inp.value || 0) - 1;
    inp.value = v < 0 ? 0 : v; guardar();
  });
  mas.addEventListener("click", function(){ inp.value = Number(inp.value || 0) + 1; guardar(); });
  inp.addEventListener("input", guardar);
  st.appendChild(menos); st.appendChild(inp); st.appendChild(mas);
  d.appendChild(s); d.appendChild(st);
  return d;
}

function construirModoJornada(cont){
  construirBloqueTaller();

  var grupo = "";
  estado.pref.setHabitual.forEach(function(nombre){
    var g = grupoDeIndicador(nombre, estado.catalogo);
    if (g !== grupo){
      grupo = g;
      var e = document.createElement("div");
      e.className = "grupo"; e.textContent = grupo;
      cont.appendChild(e);
    }
    var fila = filaIndicador(nombre);
    if (nombre === IND_PRESERVATIVOS){
      fila.appendChild(bloqueCalculo());
      fila.appendChild(bloqueOrientacionPF());
    }
    if (nombre === "VIH") fila.appendChild(bloqueLipidos());
    cont.appendChild(fila);
  });

  construirExtras();
}

/* ---------- Aplicar a varios ---------- */
function construirBloqueTaller(){
  var caja = $("taller");
  caja.className = "";
  caja.textContent = "";
  caja.classList.remove("oculto");

  var g = document.createElement("div");
  g.className = "grupo"; g.textContent = "Taller · un número para varios";
  caja.appendChild(g);

  var fila = document.createElement("div"); fila.className = "ind";
  var nom = document.createElement("span");
  nom.className = "ind-nom"; nom.textContent = "Asistentes al taller";
  var st = document.createElement("div"); st.className = "stepper";
  var menos = document.createElement("button");
  menos.type = "button"; menos.textContent = "−";
  menos.setAttribute("aria-label", "Restar un asistente");
  var inp = document.createElement("input");
  inp.type = "number"; inp.min = "0"; inp.step = "1"; inp.inputMode = "numeric";
  inp.id = "asistentes"; inp.placeholder = "—";
  inp.setAttribute("aria-label", "Asistentes al taller");
  var mas = document.createElement("button");
  mas.type = "button"; mas.textContent = "+";
  mas.setAttribute("aria-label", "Sumar un asistente");
  menos.addEventListener("click", function(){
    var v = Number(inp.value || 0) - 1; inp.value = v < 0 ? 0 : v;
  });
  mas.addEventListener("click", function(){
    inp.value = Number(inp.value || 0) + 1;
  });
  st.appendChild(menos); st.appendChild(inp); st.appendChild(mas);
  fila.appendChild(nom); fila.appendChild(st);
  caja.appendChild(fila);

  var dest = document.createElement("div"); dest.className = "destinos";
  var rot = document.createElement("p");
  rot.className = "mini";
  rot.style.margin = "0 0 8px";
  rot.textContent = "Aplicar esa cifra a:";
  dest.appendChild(rot);

  // Los destinos del taller cruzan módulos: promoción y salud mental. Se dibujan
  // los ocho canónicos, no los de un solo módulo, o el primer clic los borraría.
  DESTINOS_TALLER_CANONICOS.forEach(function(nombre){
    var l = document.createElement("label"); l.className = "destino";
    var chk = document.createElement("input");
    chk.type = "checkbox"; chk.value = nombre;
    chk.checked = estado.pref.destinosTaller.indexOf(nombre) >= 0;
    chk.addEventListener("change", function(){
      var marcados = [];
      dest.querySelectorAll("input[type=checkbox]").forEach(function(c){
        if (c.checked) marcados.push(c.value);
      });
      estado.pref.destinosTaller = marcados;
      guardarPref(estado.pref);
    });
    var txt = document.createElement("span"); txt.textContent = nombre;
    l.appendChild(chk); l.appendChild(txt);
    dest.appendChild(l);
  });

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "b-sec";
  btn.style.marginTop = "8px";
  btn.textContent = "Aplicar a los marcados";
  btn.addEventListener("click", function(){
    var valor = $("asistentes").value;
    if (valor === "") return alerta("Escribe el número de asistentes.", true);
    if (!estado.pref.destinosTaller.length)
      return alerta("Marca al menos un indicador destino.", true);
    var destinos = estado.pref.destinosTaller;
    // concentrarTalleres sólo deriva ORIENTACIÓN (SALUD MENTAL) cuando el
    // estrés participa en esta aplicación: el mensaje debe reflejar eso, no
    // afirmarlo siempre (hallazgo I-5).
    var derivaOrientacion = destinos.indexOf(IND_ESTRES) >= 0;
    var resultado = concentrarTalleres(valor, destinos, estado.datos);
    // fijarCalculado invalida a quien dependía del valor ANTERIOR de cada
    // nombre que escribe, así que el orden importa: los destinos y la
    // orientación en salud mental primero, TALLERES al final. TALLERES
    // depende de ambos (DEPENDE_DE), así que si se marcara antes, la
    // invalidación de los demás lo apagaría otra vez (P1-2).
    destinos.forEach(function(n){ fijarCalculado(n, resultado[n]); });
    if (derivaOrientacion) fijarCalculado(IND_ORIENTACION_SM, resultado[IND_ORIENTACION_SM]);
    fijarCalculado(IND_TALLERES, resultado[IND_TALLERES]);
    estado.valorTaller = Number(valor) || 0;
    refrescarCampos();
    // La población cambió con los asistentes: lo que dependía de ella
    // (métodos de PF calculados, y en cadena la orientación de PF) queda
    // dudoso (C-2). valorTaller no es uno de los 29 ni tiene entrada propia
    // en DEPENDE_DE (lo alimenta, no lo reemplaza), así que esta
    // invalidación se queda explícita en vez de salir de fijarCalculado.
    invalidarCalculado(IND_PRESERVATIVOS);
    // Algunos de los indicadores tocados viven plegados: que se vean.
    expandirExtras();

    var partes = [destinos.length + " indicador(es)"];
    if (derivaOrientacion) partes.push("orientación en salud mental");
    partes.push("el concentrado " + IND_TALLERES);
    var texto = "Aplicado a " + partes.slice(0, -1).join(", ") +
      (partes.length > 1 ? " y " : "") + partes[partes.length - 1] +
      ". Puedes editar cada uno.";
    alerta(texto, false);
  });
  dest.appendChild(btn);
  caja.appendChild(dest);
}

/* ---------- Cálculo de preservativos ---------- */
function bloqueCalculo(){
  var caja = document.createElement("div");
  caja.style.marginTop = "8px";

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "b-chip";
  btn.textContent = "⟲ calcular desde población";

  var nota = document.createElement("p");
  nota.className = "mini"; nota.id = "notaCalculo";

  // Un solo manejador para el enlace "editar", lo pinte pintarNota() o el
  // resultado del cálculo: antes el enlace de después de calcular sólo
  // llamaba a pintarNota() y el primer clic se gastaba en repintar, sin
  // pedir el factor (hallazgo menor, revisión final de 52cc1fd — dos clics
  // para editar).
  function manejarEdicionFactor(ev){
    ev.preventDefault();
    var f = prompt("Preservativos por persona atendida (por ejemplo 0.30):",
                   String(estado.pref.factorPreservativos));
    if (f === null) return;
    var n = Number(f);
    if (!isFinite(n) || n < 0) return alerta("Factor inválido.", true);
    estado.pref.factorPreservativos = n;
    guardarPref(estado.pref);
    // El parámetro cambió: lo que se calculó con el factor viejo ya no es
    // confiable, y en cadena tampoco lo que dependía de ese resultado
    // (P1-3, revisión final de 52cc1fd — antes el campo se quedaba en oro
    // con el número calculado con el factor anterior).
    invalidarCalculado(IND_PRESERVATIVOS);
    pintarNota();
  }

  function pintarNota(){
    nota.innerHTML = "Factor actual <b>" + estado.pref.factorPreservativos +
      "</b> · <a href=\"#\" id=\"editarFactor\">editar</a>";
    nota.querySelector("#editarFactor").addEventListener("click", manejarEdicionFactor);
  }

  btn.addEventListener("click", function(){
    var poblacion = poblacionAtendida(estado.datos, estado.valorTaller);
    if (!poblacion) return alerta("Captura primero las demás actividades.", true);
    var v = preservativosDesdePoblacion(poblacion, estado.pref.factorPreservativos);
    fijarCalculado(IND_PRESERVATIVOS, v);
    refrescarCampos();
    nota.innerHTML = miles(poblacion) + " × " + estado.pref.factorPreservativos +
      " = <b>" + miles(v) + "</b> · <a href=\"#\" id=\"editarFactor\">editar factor</a>";
    nota.querySelector("#editarFactor").addEventListener("click", manejarEdicionFactor);
  });

  pintarNota();
  caja.appendChild(btn);
  caja.appendChild(nota);
  return caja;
}

/* ---------- Orientación en planificación familiar, desde métodos ---------- */
function bloqueOrientacionPF(){
  var caja = document.createElement("div");
  caja.style.marginTop = "8px";
  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "b-chip";
  btn.textContent = "⟲ orientaciones desde métodos";
  var nota = document.createElement("p");
  nota.className = "mini";

  // Calcado del "editar" de bloqueCalculo: antes faltaba el enlace y el
  // divisor era texto muerto en pantalla (hallazgo I-1). Un solo manejador
  // para los dos momentos en que aparece el enlace (menor, revisión final).
  function manejarEdicionDivisor(ev){
    ev.preventDefault();
    var f = prompt("Condones por persona orientada (entre " + DIVISOR_ORIENTACION_PF_MIN +
                   " y " + DIVISOR_ORIENTACION_PF_MAX + "):",
                   String(estado.pref.divisorOrientacionPF));
    if (f === null) return;
    var n = Number(f);
    if (!divisorOrientacionPFValido_(n)) return alerta("El divisor debe estar entre " +
      DIVISOR_ORIENTACION_PF_MIN + " y " + DIVISOR_ORIENTACION_PF_MAX + ".", true);
    estado.pref.divisorOrientacionPF = n;
    guardarPref(estado.pref);
    // El divisor cambió: la orientación calculada con el divisor anterior ya
    // no es confiable (P1-3, revisión final de 52cc1fd — antes seguía en
    // pantalla, en oro, con el resultado del divisor viejo).
    invalidarCalculado(IND_ORIENTACION_PF);
    pintarNota();
  }

  function pintarNota(){
    nota.innerHTML = "Condones por persona orientada <b>" + estado.pref.divisorOrientacionPF +
      "</b> · <a href=\"#\" id=\"editarDivisorPF\">editar</a>";
    nota.querySelector("#editarDivisorPF").addEventListener("click", manejarEdicionDivisor);
  }

  btn.addEventListener("click", function(){
    var metodos = numero_(estado.datos[IND_PRESERVATIVOS]);
    if (!metodos) return alerta("Captura primero los métodos repartidos.", true);
    var v = orientacionDesdeMetodos(metodos, estado.pref.divisorOrientacionPF);
    fijarCalculado(IND_ORIENTACION_PF, v);
    refrescarCampos();
    nota.innerHTML = miles(metodos) + " ÷ " + estado.pref.divisorOrientacionPF +
      " = <b>" + miles(v) + "</b> orientaciones · <a href=\"#\" id=\"editarDivisorPF\">editar</a>";
    nota.querySelector("#editarDivisorPF").addEventListener("click", manejarEdicionDivisor);
  });

  pintarNota();
  caja.appendChild(btn); caja.appendChild(nota);
  return caja;
}

/* ---------- Lípidos, ofrecido y no impuesto ---------- */
function bloqueLipidos(){
  var caja = document.createElement("div");
  caja.style.marginTop = "8px";
  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "b-chip";
  btn.textContent = "⟲ igualar lípidos al mismo piquete";
  btn.addEventListener("click", function(){
    if (!numero_(estado.datos["VIH"]) && !numero_(estado.datos["SÍFILIS"]))
      return alerta("Captura primero VIH o sífilis.", true);
    var salida = sugerirLipidos(estado.datos);
    fijarCalculado(IND_LIPIDOS, salida[IND_LIPIDOS]);
    refrescarCampos();
    alerta("Lípidos igualado. Bórralo si no llevaste el insumo.", false);
  });
  caja.appendChild(btn);
  return caja;
}

/* ---------- Otros indicadores, plegados ---------- */
var elExtras = null; // { boton, cuerpo, restantes }, fijado por construirExtras()

function construirExtras(){
  var caja = $("extras");
  caja.textContent = "";
  caja.classList.remove("oculto");
  elExtras = null;

  var restantes = INDICADORES_29.filter(function(n){
    return estado.pref.setHabitual.indexOf(n) < 0;
  });
  if (!restantes.length){ caja.classList.add("oculto"); return; }

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "b-fant";
  btn.style.width = "100%"; btn.style.marginTop = "16px";
  btn.textContent = "▸ Otros indicadores (" + restantes.length + ")";

  var cuerpo = document.createElement("div");
  cuerpo.className = "oculto";

  var grupo = "";
  restantes.forEach(function(nombre){
    var g = grupoDeIndicador(nombre, estado.catalogo);
    if (g !== grupo){
      grupo = g;
      var e = document.createElement("div");
      e.className = "grupo"; e.textContent = grupo;
      cuerpo.appendChild(e);
    }
    cuerpo.appendChild(filaIndicador(nombre));
  });

  btn.addEventListener("click", function(){
    var plegado = cuerpo.classList.toggle("oculto");
    btn.textContent = (plegado ? "▸" : "▾") +
      " Otros indicadores (" + restantes.length + ")";
  });

  caja.appendChild(btn);
  caja.appendChild(cuerpo);
  elExtras = { boton: btn, cuerpo: cuerpo, restantes: restantes };
}

/** El taller puede tocar indicadores que viven plegados aquí (violencia,
 * adicciones, depresión, estrés, orientación en salud mental): se despliegan
 * solos para que el capturista vea qué cambió, en vez de que una orientación
 * capturada a mano se pise sin que se note (hallazgo I-3). */
function expandirExtras(){
  if (!elExtras) return;
  elExtras.cuerpo.classList.remove("oculto");
  elExtras.boton.textContent = "▾ Otros indicadores (" + elExtras.restantes.length + ")";
}

/* ---------- Fotos ---------- */
$("archivoFoto").addEventListener("change", function(e){
  var etiqueta = estado.modo === "jornada"
    ? ($("etiquetaFoto").value || "JORNADA")
    : ($("modulo").value || "JORNADA");
  var pendientesFotos = Array.prototype.map.call(e.target.files, function(f){
    return comprimirFoto(f, etiqueta);
  });
  e.target.value = "";
  Promise.all(pendientesFotos).then(function(nuevas){
    estado.fotos = estado.fotos.concat(nuevas);
    pintarFotos();
  }).catch(function(){
    alerta("Una de las imágenes no se pudo procesar.", true);
  });
});

function pintarFotos(){
  var g = $("galeria");
  g.textContent = "";
  var add = document.createElement("label");
  add.className = "add"; add.setAttribute("for", "archivoFoto"); add.textContent = "+";
  g.appendChild(add);
  estado.fotos.forEach(function(f, i){
    var d = document.createElement("div"); d.className = "thumb";
    var im = document.createElement("img"); im.src = f.datos; im.alt = f.nombre;
    var et = document.createElement("span"); et.className = "et";
    et.textContent = String(f.modulo);
    var b = document.createElement("button");
    b.type = "button"; b.textContent = "×";
    b.setAttribute("aria-label", "Quitar foto " + (i + 1));
    b.onclick = function(){ estado.fotos.splice(i, 1); pintarFotos(); };
    d.appendChild(im); d.appendChild(et); d.appendChild(b);
    g.appendChild(d);
  });
}

function llenarEtiquetas(){
  var s = $("etiquetaFoto"); s.textContent = "";
  var j = jornadaActual();
  var claves = j ? modulosDeJornada_(j, estado.catalogo) : [];
  var general = document.createElement("option");
  general.value = "JORNADA"; general.textContent = "JORNADA (general)";
  s.appendChild(general);
  claves.forEach(function(clave){
    var o = document.createElement("option");
    o.value = clave; o.textContent = nombreModulo(clave);
    s.appendChild(o);
  });
}

/* ---------- Paso 4: repaso ---------- */
function construirPaso4(){
  var cont = $("repaso"); cont.textContent = "";
  var porModulo = agruparPorModulo(estado.datos, estado.catalogo);

  Object.keys(porModulo).sort().forEach(function(m){
    var t = document.createElement("div");
    t.className = "grupo"; t.textContent = nombreModulo(m);
    cont.appendChild(t);
    Object.keys(porModulo[m]).forEach(function(n){
      var r = document.createElement("div"); r.className = "repaso";
      var a = document.createElement("span"); a.textContent = n;
      var b = document.createElement("b"); b.textContent = miles(porModulo[m][n]);
      r.appendChild(a); r.appendChild(b);
      cont.appendChild(r);
    });
  });

  var f = document.createElement("div"); f.className = "repaso";
  var fRot = document.createElement("span"); fRot.textContent = "Fotos adjuntas";
  var fVal = document.createElement("b"); fVal.textContent = String(estado.fotos.length);
  f.appendChild(fRot); f.appendChild(fVal);
  cont.appendChild(f);

  $("avisoFotos").classList.toggle("oculto", estado.fotos.length >= 3);
  if (estado.fotos.length < 3){
    $("avisoFotos").textContent =
      "Llevas " + estado.fotos.length + " foto(s) y se piden 3: montaje, " +
      "actividad en curso y panorámica.";
  }

  pintarReconciliacion();
  pintarRevisionFicha();
}

/** Costo, total y avance de la ficha, con el mismo código que la generación. */
function pintarRevisionFicha(){
  var caja = $("reconFicha");
  if (estado.modo !== "jornada"){ caja.classList.add("oculto"); return; }
  var poblacion = poblacionAtendida(estado.datos, estado.valorTaller);
  var r = resumenFicha(estado.datos, estado.ficha, estado.fichaDatos.costos, poblacion);
  caja.classList.remove("oculto");
  caja.textContent = "";
  var fila = function(rotulo, valor, id){
    var d = document.createElement("div"); d.className = "r";
    var a = document.createElement("span"); a.textContent = rotulo;
    var b = document.createElement("b"); b.textContent = valor; b.id = id;
    d.appendChild(a); d.appendChild(b); caja.appendChild(d);
  };
  var t = document.createElement("div"); t.className = "grupo"; t.textContent = "Ficha técnica";
  caja.appendChild(t);
  fila("Total de actividades (ficha, no es el de SAM)", miles(r.total), "fichaTotal");
  fila("Costo de la jornada", etiquetasFicha({ costo: r.costo })["{{COSTO}}"], "fichaCosto");
  fila("Avance real (atendida ÷ proyectada)", textoAvance(r.avance), "fichaAvance");
  if (r.avisos.length){
    var ul = document.createElement("ul"); ul.className = "mini"; ul.id = "fichaAvisos";
    r.avisos.forEach(function(a){
      var li = document.createElement("li"); li.textContent = a; ul.appendChild(li);
    });
    caja.appendChild(ul);
  }
}

/**
 * El último control humano antes de SAM: lo que se ve aquí debe ser lo que
 * se envía. Antes mostraba diferenciaTotales().poblacion (suma de los 29):
 * la pantalla podía decir 998 y a JORNADAS!H llegar 90 (hallazgo C-3). Ahora
 * usa poblacionAtendida, la misma fórmula que arma paquete().poblacion.
 *
 * Con el cambio, población y total de actividades miden cosas distintas a
 * propósito (personas vs. servicios: TALLERES concentra nueve indicadores
 * que también se cuentan por separado). Ya no tiene sentido explicar su
 * diferencia numérica como "el desglose de certificados y pre-registro" —
 * esa identidad sólo se cumplía cuando población era la suma de los 29. El
 * desglose de excluidos se conserva porque sigue siendo información válida
 * por sí sola (qué no cuenta para SAM), pero el texto ya no la presenta como
 * la explicación de la brecha.
 *
 * P1-4 (revisión final de 52cc1fd): estado.valorTaller no tenía campo propio
 * en ningún paso, así que un desfase entre él y los nueve indicadores del
 * taller (por ejemplo, al cambiar de jornada — ver el manejador de
 * "jornada") era invisible: la pantalla mostraba una población menor sin
 * decir por qué. El desglose de abajo es la primera vez que valorTaller se
 * ve, precisamente en el último control humano antes de SAM.
 */
function pintarReconciliacion(){
  var caja = $("recon");
  if (estado.modo !== "jornada"){ caja.classList.add("oculto"); return; }

  var r = diferenciaTotales(estado.datos); // total de actividades y excluidos de SAM
  var consultas = CONSULTAS_POBLACION.reduce(function(t, n){
    return t + numero_(estado.datos[n]);
  }, 0);
  var poblacion = poblacionAtendida(estado.datos, estado.valorTaller); // la misma que envía paquete()
  caja.classList.remove("oculto");

  var desglose = r.detalle
    .filter(function(d){ return d.valor > 0; })
    .map(function(d){ return d.indicador.toLowerCase() + " " + miles(d.valor); })
    .join(" · ");

  caja.innerHTML =
    '<div class="r"><span>Población atendida (lo que se envía)</span>' +
      '<b>' + miles(poblacion) + '</b></div>' +
    '<p class="mini">consultas ' + miles(consultas) + ' + asistentes al taller ' +
      miles(estado.valorTaller) + ' = ' + miles(poblacion) + '</p>' +
    '<div class="r sam"><span>Total de actividades (col. AM · lo que ve SAM)</span>' +
      '<b>' + miles(r.actividades) + '</b></div>' +
    '<div class="r dif"><span>Son cifras distintas a propósito: población cuenta personas ' +
      '(consultas + asistentes al taller), total de actividades cuenta servicios y puede repetir ' +
      'a la misma persona en varios indicadores' +
      (desglose ? '. Además, ' + desglose + ' no cuentan para el total, por criterio de SAM' : '') +
      '.</span></div>';
}

/* ---------- Navegación ---------- */
/** Devuelve el problema y el control que hay que marcar y enfocar. */
function validarPaso(){
  if (estado.paso === 1){
    if (!estado.modo) return { mensaje: "Elige si capturas toda la jornada o solo un módulo.", control: "btnModoJornada" };
    if (!$("jornada").value) return { mensaje: "Falta elegir la jornada.", control: "jornada" };
    if (estado.modo === "modulo" && !$("modulo").value) return { mensaje: "Falta elegir el módulo.", control: "modulo" };
    if (!$("capturista").value.trim()) return { mensaje: "Falta el nombre de quien reporta.", control: "capturista" };
    return null;
  }
  if (estado.paso === 2){
    if (!Object.keys(estado.datos).length) return { mensaje: "No capturaste ningún número.", control: "indicadores" };
    return null;
  }
  return null;
}

function limpiarInvalidos(){
  ["jornada","modulo","capturista"].forEach(function(id){ $(id).removeAttribute("aria-invalid"); });
}

function marcarInvalido(id){
  var c = $(id);
  if (!c) return;
  if (c.tagName === "SELECT" || c.tagName === "INPUT") c.setAttribute("aria-invalid", "true");
  if (typeof c.focus === "function") c.focus();
}

$("btnAtras").addEventListener("click", function(){
  if (estado.paso > 1){ estado.paso--; pintarProgreso(); }
});

$("btnSiguiente").addEventListener("click", function(){
  limpiarInvalidos();
  var problema = validarPaso();
  if (problema){
    marcarInvalido(problema.control);
    return alerta(problema.mensaje, true);
  }

  if (estado.paso === 1){
    Guardado.escribir("capturista", $("capturista").value.trim());
    llenarEtiquetas();
    estado.paso = 2; construirPaso2(); pintarProgreso(); return;
  }
  if (estado.paso === 2){ estado.paso = 3; pintarProgreso(); return; }
  if (estado.paso === 3){ estado.paso = 4; construirPaso4(); pintarProgreso(); return; }
  enviar();
});

/* ---------- Envío ---------- */
function paquete(){
  var base = {
    folio: $("jornada").value,
    capturista: $("capturista").value.trim(),
    notas: $("notas").value.trim(),
    fotos: estado.fotos,
    momento: new Date().toISOString()
  };
  if (estado.modo === "jornada"){
    base.modulos = agruparPorModulo(estado.datos, estado.catalogo);
    base.poblacion = poblacionAtendida(estado.datos, estado.valorTaller);
    base.idLocal = base.folio + "|JORNADA";
    base.ficha = normalizarFicha(estado.ficha);
  } else {
    base.modulo = $("modulo").value;
    base.indicadores = estado.datos;
    base.idLocal = base.folio + "|" + base.modulo;
  }
  return base;
}

function enviar(){
  if (estado.enviando) return;
  var p = paquete();
  var fn = p.modulos ? "guardarJornadaCompleta" : "guardarCierre";
  estado.enviando = true;
  $("btnSiguiente").disabled = true;
  $("btnSiguiente").textContent = "Enviando…";
  document.body.setAttribute("aria-busy", "true");

  llamar(fn, p).then(function(){
    terminar("Captura enviada. Ya aparece en el concentrado.", false);
  }).catch(function(){
    encolar(p);
    terminar("Sin señal. Se guardó en el teléfono y se enviará solo.", true);
  });
}

function terminar(mensaje, esError){
  estado.enviando = false;
  $("btnSiguiente").disabled = false;
  document.body.removeAttribute("aria-busy");
  alerta(mensaje, esError);
  limpiar();
  revisarCola();
}

function limpiar(){
  estado.datos = {}; estado.fotos = []; estado.paso = 1; estado.valorTaller = 0;
  estado.ficha = fichaVacia_(estado.ficha.unidadId); // la unidad se recuerda
  pintarFotos();
  $("notas").value = "";
  $("modulo").value = "";
  $("indicadores").textContent = "";
  pintarProgreso();
}

/* ---------- Cola y red ---------- */
function revisarCola(){
  var n = pendientes();
  $("avisoCola").classList.toggle("oculto", n === 0);
  if (n) $("avisoCola").textContent = n + " captura(s) pendiente(s) de enviar.";
  if (n && navigator.onLine){
    drenarCola().then(function(restantes){
      $("avisoCola").classList.toggle("oculto", restantes === 0);
      if (restantes) $("avisoCola").textContent =
        restantes + " captura(s) pendiente(s) de enviar.";
    });
  }
}

function alerta(txt, esError){
  var e = $("estado");
  e.textContent = txt;
  e.style.color = esError ? "var(--alerta)" : "var(--ok)";
  e.style.fontWeight = "700";
  setTimeout(function(){ if (e.textContent === txt) e.textContent = ""; }, 6000);
}

function estadoRed(){
  $("avisoRed").classList.toggle("oculto", navigator.onLine);
  var insignia = $("insigniaRed");
  insignia.textContent = navigator.onLine
    ? "En línea"
    : (estado.cacheMinutos ? "Sin conexión · catálogo de hace " + estado.cacheMinutos + " min"
                           : "Sin conexión");
  insignia.className = "insignia" + (navigator.onLine ? "" : " sin-red");
  if (navigator.onLine) revisarCola();
}

window.addEventListener("online", estadoRed);
window.addEventListener("offline", estadoRed);

estadoRed();
iniciar();
