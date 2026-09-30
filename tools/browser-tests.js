// Chrome/Edge real, datos ficticios y fetch simulado: no escribe en producción.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
if (!chrome) throw new Error('Se requiere Chrome/Edge o CHROME_PATH para estas pruebas.');

function run(folder, setup, scenario) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-prueba-'));
  const script = code => '<script>' + code.replace(/<\/script/gi, '<\\/script') + '</script>';
  let html = fs.readFileSync(path.join(root, 'web', folder, 'index.html'), 'utf8')
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, '')
    .replace(/<link[^>]*>/g, '')
    .replace(/<script src="[^"]*"><\/script>/g, '');
  const boot = `window.errors=[]; window.addEventListener('error', e=>errors.push(e.message));
    window.addEventListener('unhandledrejection', e=>errors.push(String(e.reason)));
    localStorage.clear(); sessionStorage.clear(); window.calls=[];
    var ENDPOINT='https://example.test/api', EXEC_AF=ENDPOINT, EXEC_ATENCION=ENDPOINT, EXEC_JORNADAS=ENDPOINT;
    function reply(data){return Promise.resolve({ok:true,json:()=>Promise.resolve(data)});}
    function check(ok,msg){if(!ok) throw Error(msg);}
    function tick(){return new Promise(r=>setTimeout(r,30));}
    window.fetch=()=>reply({ok:false,code:'PRUEBA',msg:'Sin catálogo de prueba'});
    ${setup}`;
  const end = `(async()=>{try{await tick(); ${scenario}; await tick(); check(!errors.length,errors.join('; '));
    document.body.appendChild(Object.assign(document.createElement('pre'),{id:'resultado-test',textContent:'OK'}));
    }catch(e){document.body.appendChild(Object.assign(document.createElement('pre'),{id:'resultado-test',textContent:e.stack}));}})();`;
  html = html.replace('</body>', script(boot) + script(fs.readFileSync(path.join(root,'web',folder,'app.js'),'utf8')) + script(end) + '</body>');
  try {
    const page = path.join(dir, 'test.html'); fs.writeFileSync(page, html);
    const r = spawnSync(chrome, ['--headless=new','--disable-gpu','--no-sandbox','--disable-extensions',
      '--user-data-dir='+path.join(dir,'profile'),'--virtual-time-budget=3000','--dump-dom',pathToFileURL(page).href],
      {encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,windowsHide:true});
    if(r.error) throw r.error;
    const match = r.stdout.match(/<pre id="resultado-test">([\s\S]*?)<\/pre>/);
    assert.equal(match && match[1], 'OK', match ? match[1] : r.stderr.slice(-1000));
  } finally {
    // Únicamente el directorio temporal creado por esta prueba.
    if(path.dirname(dir) === path.resolve(os.tmpdir()) && path.basename(dir).startsWith('portal-prueba-'))
      fs.rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}

test('alta médica: boleto en el envío, unidad única y otra captura',()=>run('jornada-medica',`
  sessionStorage.setItem('jornadaMedica:boleto','boleto-ficticio');
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);calls.push(p);return reply(p.accion==='datosAltaMedica'
    ? {unidades:[{id:'U1',nombre:'Unidad prueba',municipio:'Municipio',coordinacion:'C1'}],modulos:[{clave:'M1',nombre:'Módulo'}]}
    : {ok:true,folio:'PRUEBA'});};`, `
  check(document.getElementById('unidad').value==='U1','La unidad única no quedó seleccionada');
  check(document.getElementById('coordinacionUnidad').textContent==='C1','Falta actualizar la coordinación');
  ['fecha','localidad','lugar','poblacionProyectada','solicitante'].forEach((id,i)=>document.getElementById(id).value=['2026-09-29','Localidad','Lugar','20','Prueba'][i]);
  document.querySelector('#modulos input').checked=true;
  document.getElementById('form').dispatchEvent(new Event('submit',{cancelable:true})); await tick();
  check(calls.find(p=>p.accion==='altaJornadaMedica').args[0].boleto==='boleto-ficticio','El alta salió sin boleto');
  document.getElementById('btnOtra').click();
  check(document.getElementById('unidad').value==='U1','Otra captura perdió la unidad única');
`));

const afSetup = `sessionStorage.setItem('af:sesion',JSON.stringify({ses:{token:'prueba',coordinacion:'Prueba',porDefecto:{anio:2026,mes:9}}}));
  var units=[{unidad_id:'U1',nombre:'Unidad prueba',capturada:false,fotos:[]}];
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);calls.push(p);
    if(p.accion==='guardarUnidad') return new Promise(r=>window.resolveSave=()=>r({ok:true,json:()=>Promise.resolve({ok:true})}));
    return reply({ok:true,unidades:units,cerrado:false});};`;
test('actividad física: unidad única abre captura y volver conserva el resumen',()=>run('actividad-fisica',afSetup,`
  check(S.unidad && S.unidad.unidad_id==='U1','No abrió la unidad única');
  document.getElementById('btn-volver').click(); await tick();
  check(!document.getElementById('vista-lista').hidden,'Volver debe mostrar el cierre mensual');
`));
test('actividad física: editar durante guardado conserva cambios pendientes',()=>run('actividad-fisica',afSetup,`
  if(!S.unidad) abrirUnidad(units[0]);
  entradas().forEach(i=>i.value='1');
  document.getElementById('form-unidad').dispatchEvent(new Event('submit',{cancelable:true}));
  var input=entradas()[0];input.value='2';input.dispatchEvent(new Event('input',{bubbles:true}));
  resolveSave();await tick();check(S.sucio,'Se marcaron como guardados cambios nuevos');
  var ev=new Event('beforeunload',{cancelable:true});window.dispatchEvent(ev);
  check(ev.defaultPrevented,'No advierte al recargar con cambios');
`));
test('actividad física: varias unidades, catálogo vacío y mes cerrado conservan resumen',()=>run('actividad-fisica',afSetup,`
  units.push({unidad_id:'U2',nombre:'Otra',capturada:false,fotos:[]});cargarMes();await tick();
  check(!document.getElementById('vista-lista').hidden,'Eligió una unidad entre varias');
  units=[];cargarMes();await tick();check(!document.getElementById('vista-lista').hidden,'Catálogo vacío ocultó el resumen');
  fetch=()=>reply({ok:true,unidades:[{unidad_id:'U1',nombre:'Prueba',capturada:true,fotos:[]}],cerrado:true});
  cargarMes();await tick();check(!document.getElementById('vista-lista').hidden,'Mes cerrado abrió captura automáticamente');
`));
test('atención: editar durante guardado no envía una versión anterior',()=>run('atencion',`
  sessionStorage.setItem('atencion:sesion',JSON.stringify({ses:{token:'prueba',nombre:'Prueba',rol:'NUTRICION',unidad:'U1',porDefecto:{anio:2026,mes:9}}}));
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);calls.push(p);
    if(p.accion==='guardarInforme') return new Promise(r=>window.resolveSave=()=>r({ok:true,json:()=>Promise.resolve({ok:true})}));
    return reply({ok:true,estado:'BORRADOR',existe:true,informe:{nut:{}},evidencias:[]});};`, `
  entradas().forEach(i=>i.value='1'); S.sucio=true;var envio=false;guardar(()=>envio=true);
  var input=entradas()[0];input.value='2';input.dispatchEvent(new Event('input',{bubbles:true}));
  resolveSave();await tick();check(S.sucio,'La edición nueva se marcó guardada');check(!envio,'Se envió una versión anterior');
`));
test('jornadas: única unidad en nueva jornada y ficha; varias requieren elección',()=>run('jornadas',`
  sessionStorage.setItem('jornadas:boleto','boleto-prueba');`, `
  estado.fichaDatos.unidades=[{id:'U1',nombre:'Unidad prueba',municipio:'Municipio',coordinacion:'C1'}];
  estado.ficha.unidadId='UNIDAD-ANTERIOR';prepararNueva();
  check($('nuevaUnidad').value==='U1','Nueva jornada no preselecciona');
  construirBloqueFicha();check($('fichaUnidad').value==='U1' && estado.ficha.unidadId==='U1','Ficha no preselecciona');
  estado.fichaDatos.unidades.push({id:'U2',nombre:'Otra',municipio:'Municipio',coordinacion:'C1'});
  estado.ficha.unidadId='';$('nuevaUnidad').value='';prepararNueva();
  check($('nuevaUnidad').value==='','No debe adivinar entre varias unidades');
`));

test('jornadas: arranque reutiliza preferencias y evita una petición redundante',()=>run('jornadas',`
  sessionStorage.setItem('jornadas:boleto','boleto-prueba');
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);calls.push(p);
    if(p.accion==='entrarConBoleto')return reply({ok:true,nombre:'Prueba',coordinacion_id:'C1',unidades:[]});
    if(p.accion==='datosArranque')return reply({jornadas:[],catalogo:{modulos:[{clave:'M1',nombre:'Módulo'}],
      indicadores:INDICADORES_29.map(n=>({indicador:n,modulo:'M1',grupo:'Prueba'}))},preferencias:{factorPreservativos:0.4}});
    return reply(null);};`, `
  check(!!estado.bootstrap,'No completó arranque');
  check(calls.length===2 && !calls.some(p=>p.accion==='leerPreferencias'),'Consulta preferencias dos veces');
  check(estado.pref.factorPreservativos===0.4,'No aplicó preferencias de arranque');
  check(preferencias().factorPreservativos===0.4,'No recordó preferencias para uso sin conexión');
  Guardado.escribir('pref',{factorPreservativos:0.6});aplicarBootstrap(estado.bootstrap,true);
  check(estado.pref.factorPreservativos===0.6,'El catálogo viejo pisó ajustes locales más recientes');
`));

test('portal: enlaces disponibles mientras llegan estados; respuesta tardía no revive sesión',()=>run('',`
  localStorage.setItem('mascara_boleto','prueba');
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);calls.push(p);
    if(p.accion==='estados') return new Promise(r=>window.resolveStates=()=>r({ok:true,json:()=>Promise.resolve({ok:true,periodo:{anio:2026,mes:9},estados:{uno:'REPORTADO'}})}));
    return reply({ok:true,usuario:{nombre:'Prueba',rol:'COORDINACION'},periodo:{anio:2026,mes:9},estadosPendientes:true,
      destinos:[{destino_id:'uno',nombre:'Uno',clase:'HERMANO_CON_CONTRASENA',enlace:'https://example.test/',estado:'NO_SE_SABE'}]});};`, `
  check(calls[0].omitirSondas===true,'El portal sigue esperando las sondas');
  check(!el('portal').hidden && !!document.querySelector('a.tarjeta'),'Faltan enlaces mientras se consulta');
  check(calls.filter(p=>p.accion==='estados').length===1,'Falta carga de estados');
  resolveStates();await tick();check(el('resumen-hechos').textContent==='1','No actualiza avance');
  cargarContexto();await tick();el('btn-salir').click();resolveStates();await tick();
  check(el('portal').hidden,'Una respuesta tardía reabrió el portal');
`));

test('jornadas: rechazo de validación conserva captura y no encola',()=>run('jornadas',`
  sessionStorage.setItem('jornadas:boleto','boleto-prueba');`, `
  estado.paso=4;estado.datos={PRUEBA:3};paquete=()=>({modulos:{M1:{}},idLocal:'prueba'});
  llamar=()=>Promise.reject(Object.assign(new Error('Corrija la unidad'),{code:'UNIDAD_INVALIDA'}));
  enviar();await tick();check(estado.paso===4 && estado.datos.PRUEBA===3,'Se borró la captura rechazada');
  check(pendientes()===0,'Se encoló una captura inválida');
  check($('estado').textContent.includes('Corrija la unidad'),'No se explica el rechazo');
`));

test('jornadas: timeout de red conserva el envío en la cola local',()=>run('jornadas',`
  sessionStorage.setItem('jornadas:boleto','boleto-prueba');`, `
  estado.paso=4;estado.datos={PRUEBA:3};paquete=()=>({modulos:{M1:{}},idLocal:'timeout'});
  llamar=()=>Promise.reject(new DOMException('La conexión tardó demasiado','AbortError'));
  enviar();await tick();check(pendientes()===1,'El timeout no dejó copia local');
`));

test('jornadas: almacenamiento lleno conserva formulario y explica que no guardó',()=>run('jornadas',`
  sessionStorage.setItem('jornadas:boleto','boleto-prueba');`, `
  estado.paso=4;estado.datos={PRUEBA:3};paquete=()=>({modulos:{M1:{}},idLocal:'lleno'});
  var write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){
    if(k==='jornadas:cola') throw new DOMException('Almacenamiento lleno','QuotaExceededError');return write.call(this,k,v);};
  llamar=()=>Promise.reject(new TypeError('Failed to fetch'));enviar();await tick();
  check(estado.paso===4 && estado.datos.PRUEBA===3,'Se borró la captura sin copia persistente');
  check($('estado').textContent.includes('No cierre'),'No avisa del fallo al guardar en teléfono');
  var ev=new Event('beforeunload',{cancelable:true});window.dispatchEvent(ev);
  check(ev.defaultPrevented,'No advierte al recargar con captura pendiente');
`));

test('portal: error o respuesta ilegible no bloquea acceso ni borra boleto',()=>run('',`
  localStorage.setItem('mascara_boleto','prueba');fetch=()=>reply(null);`, `
  check(!el('acceso').hidden,'Respuesta ilegible dejó la pantalla cargando');
  check(leerBoleto()==='prueba','Error de red borró el boleto');
`));

test('portal: solicitudes simultáneas de contexto se reúnen en una sola',()=>run('',`
  localStorage.setItem('mascara_boleto','prueba');
  fetch=(url,opts)=>{calls.push(JSON.parse(opts.body));return new Promise(()=>{});};`, `
  cargarContexto();cargarContexto();check(calls.length===1,'Se duplicó el contexto en vuelo');
`));

test('portal: otro dispositivo está consultando; espera caché sin ocultar enlaces',()=>run('',`
  localStorage.setItem('mascara_boleto','prueba');var estadosLlamados=0;
  var fixture={ok:true,usuario:{nombre:'Prueba',rol:'COORDINACION'},periodo:{anio:2026,mes:9},
    destinos:[{destino_id:'uno',nombre:'Uno',enlace:'https://example.test/',estado:'NO_SE_SABE'}]};
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);calls.push(p);
    if(p.accion==='estados'){estadosLlamados++;return reply({ok:true,consultando:estadosLlamados===1,
      periodo:{anio:2026,mes:9},estados:estadosLlamados===1?{}:{uno:'REPORTADO'}});}
    return reply(fixture);};`, `
  ESPERAS_AVANCE_MS=[5,5];var link=document.querySelector('a.tarjeta');
  cargarEstados(fixture,leerBoleto(),verComo,generacionContexto);await tick();await tick();
  check(estadosLlamados===2,'No recuperó el resultado compartido');
  check(el('resumen-hechos').textContent==='1','No mostró el avance');
  check(document.querySelector('a.tarjeta')===link && !el('portal').hidden,'Reconstruyó u ocultó los enlaces');
`));

test('portal: cerrar sesión cancela reintentos pendientes de avances',()=>run('',`
  localStorage.setItem('mascara_boleto','prueba');var estadosLlamados=0;
  var fixture={ok:true,usuario:{nombre:'Prueba',rol:'COORDINACION'},periodo:{anio:2026,mes:9},destinos:[]};
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);if(p.accion==='estados'){estadosLlamados++;
    return reply({ok:true,consultando:true,periodo:{anio:2026,mes:9},estados:{}});}return reply(fixture);};`, `
  ESPERAS_AVANCE_MS=[50,50];cargarEstados(fixture,leerBoleto(),verComo,generacionContexto);
  await tick();el('btn-salir').click();await tick();await tick();
  check(estadosLlamados===1,'Siguió consultando tras salir');check(el('portal').hidden,'Volvió al portal');
`));

test('portal: avances ocupados tienen reintentos limitados y no bloquean capturadores',()=>run('',`
  localStorage.setItem('mascara_boleto','prueba');var estadosLlamados=0;
  var fixture={ok:true,usuario:{nombre:'Prueba',rol:'COORDINACION'},periodo:{anio:2026,mes:9},
    destinos:[{destino_id:'uno',nombre:'Uno',enlace:'https://example.test/',estado:'NO_SE_SABE'}]};
  fetch=(url,opts)=>{var p=JSON.parse(opts.body);if(p.accion==='estados'){estadosLlamados++;
    return reply({ok:true,consultando:true,periodo:{anio:2026,mes:9},estados:{}});}return reply(fixture);};`, `
  ESPERAS_AVANCE_MS=[5,5];cargarEstados(fixture,leerBoleto(),verComo,generacionContexto);
  await tick();await tick();check(estadosLlamados===3,'No respetó el límite de reintentos');
  check(!el('portal').hidden && !!document.querySelector('a.tarjeta'),'Bloqueó el acceso');
  check(el('aviso-portal').textContent.includes('siguen consultándose'),'No explicó la consulta pendiente');
`));
