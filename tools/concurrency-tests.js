// Intercalado determinista de ejecuciones Apps Script con caché y candado compartidos.
// No llama servicios reales ni inicia sesiones en producción.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const utility = {
  getUuid: () => crypto.randomUUID(), Charset: {UTF_8:'utf8'}, DigestAlgorithm:{SHA_256:'sha256'},
  computeDigest: (_a,s) => [...crypto.createHash('sha256').update(s).digest()],
  computeHmacSha256Signature: (s,k) => [...crypto.createHmac('sha256',k).update(s).digest()],
  base64EncodeWebSafe: s => Buffer.from(s).toString('base64url'),
  base64DecodeWebSafe: s => [...Buffer.from(s,'base64url')],
  newBlob: a => ({getDataAsString:()=>Buffer.from(a).toString('utf8')})
};
function environment(){
  const e={now:0,locked:false,waits:[],network:0,rows:[],errors:[],cache:new Map()};
  e.service={get:k=>{
    const v=e.cache.get(k);return v && v.until>e.now?v.value:null;
  },put:(k,v,ttl)=>e.cache.set(k,{value:v,until:e.now+ttl*1000}),remove:k=>e.cache.delete(k)};
  e.context=()=>{
    let held=false;
    const c=vm.createContext({console:{error:m=>e.errors.push(String(m))},Utilities:utility,
      CacheService:{getScriptCache:()=>e.service},
      LockService:{getScriptLock:()=>({tryLock:ms=>{e.waits.push(ms);if(e.locked)return false;e.locked=held=true;return true;},
        releaseLock:()=>{if(held){e.locked=held=false;}}})},
      UrlFetchApp:{fetchAll:requests=>{
        assert.equal(e.locked,false,'Nunca mantener el candado durante una petición remota');
        e.network++;if(e.duringFetch)e.duringFetch();if(e.fail)throw Error('servidor ocupado');
        return requests.map(()=>({getResponseCode:()=>200,getContentText:()=>'{"ok":true,"reportado":true}'}));
      }}
    });
    ['Claves.gs','Credenciales.gs','Config.gs','Boleto.gs','Acceso.gs','Auditoria.gs','Destinos.gs']
      .forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'),c));
    c.problemasDeDestino=()=>[];
    return c;
  };
  return e;
}
const cuenta={usuario:'cuenta-prueba',nombre:'Prueba',coordinacion_id:'C1',rol:'COORDINACION'};
const destinos=[{destino_id:'captura',sonda:'NATIVA',url:'https://example.test/'}];
function sondas(c,progreso,u=cuenta){return c.consultarSondasNativas_(destinos,u,2026,9,'secreto-prueba',progreso);}

test('tres dispositivos comparten una sola consulta de avance en curso',()=>{
  const e=environment(), a=e.context(), b=e.context(), c=e.context();let rb,rc;const pb={},pc={};
  e.duringFetch=()=>{if(e.network===1){rb=sondas(b,pb);rc=sondas(c,pc);}};
  const ra=sondas(a,{});
  assert.equal(e.network,1,'Se repitió la misma llamada remota por dispositivo');
  assert.equal(pb.enCurso,true);assert.equal(pc.enCurso,true);
  assert.equal(ra.captura,'REPORTADO');assert.notEqual(rb.captura,'REPORTADO');assert.notEqual(rc.captura,'REPORTADO');
  assert.equal(sondas(b,{}).captura,'REPORTADO');assert.equal(e.network,1);
});
test('una consulta en curso no bloquea otras coordinaciones',()=>{
  const e=environment(),a=e.context(),b=e.context();let otra;
  e.duringFetch=()=>{if(e.network===1)otra=sondas(b,{},Object.assign({},cuenta,{coordinacion_id:'C2'}));};
  sondas(a,{});assert.equal(e.network,2);assert.equal(otra.captura,'REPORTADO');
});
test('un fallo remoto tiene pausa breve y permite recuperarse después',()=>{
  const e=environment(),c=e.context();e.fail=true;
  sondas(c,{});sondas(c,{});assert.equal(e.network,1,'El fallo provocó consultas repetidas inmediatas');
  e.now+=31000;e.fail=false;assert.equal(sondas(c,{}).captura,'REPORTADO');assert.equal(e.network,2);
});
test('candado ocupado devuelve pendiente sin esperar segundos ni disparar otra sonda',()=>{
  const e=environment(),c=e.context(),p={};e.locked=true;
  sondas(c,p);assert.equal(e.network,0);assert.equal(p.enCurso,true);
  assert.ok(e.waits.every(ms=>ms<=100));
});
test('ingreso no espera cinco segundos por una bitácora ocupada; otros eventos conservan espera',()=>{
  const e=environment(),c=e.context();e.locked=true;
  assert.equal(c.registrarEvento('prueba','INGRESO','C1'),0);
  assert.ok(e.waits[0]<=100,'Ingresar espera innecesariamente la bitácora');
  c.registrarEvento('prueba','ROTAR_SECRETO','');assert.equal(e.waits[1],5000);
});
test('los boletos de tres dispositivos siguen siendo válidos al entrar los demás',()=>{
  const e=environment(),devices=[e.context(),e.context(),e.context()];
  const row=Object.assign({},cuenta,{activo:true,sal:'prueba',huella:devices[0].huellaContrasena('prueba','clave')});
  for(const c of devices){c.leerCatalogo=()=>[row];c.secretoDeBoletos=()=> 'secreto-prueba';c.escribirFilas=(_t,rows)=>{e.rows.push(...rows);return rows.length;};}
  const sesiones=devices.map(c=>c.iniciarSesion('cuenta-prueba','clave'));
  for(let i=0;i<devices.length;i++){assert.equal(sesiones[i].ok,true);assert.equal(devices[i].usuarioDeBoleto(sesiones[i].boleto).ok,true);}
  assert.equal(e.rows.length,3);
});

for (const [folder,destino] of [['ATENCION','atencion'],['ACTIVIDAD FISICA','actividad_fisica']]) {
  const file=path.join(__dirname,'../..',folder,'src/Api.gs');
  test(folder+': tres dispositivos mantienen tokens independientes', {skip:!fs.existsSync(file)},()=>{
    const e=environment();
    const devices=[e.context(),e.context(),e.context()];
    for(const c of devices){
      vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
      c.DESTINO_ATENCION=destino;c.DESTINO_AF=destino;c.ROLES_ATENCION=['NUTRICION','PSICOLOGIA'];
      c.secreto_=c.secretoAF_=()=> 'secreto-prueba';c.unidadDelCatalogo=()=>({nombre:'Unidad prueba'});
      c.unidadesDeCoordinacion=()=>[{unidad_id:'U1'}];c.mesPorDefecto=()=>({anio:2026,mes:9});
    }
    const boleto=devices[0].emitirBoleto('prueba','C1',destino,Date.now()+60000,'secreto-prueba','Prueba',{r:'NUTRICION',x:'U1'});
    const sessions=devices.map(c=>c.entrar(boleto));
    assert.ok(sessions.every(s=>s.ok));assert.equal(new Set(sessions.map(s=>s.token)).size,3);
    for(let i=0;i<3;i++)assert.equal(devices[i].sesion_(sessions[i].token).u,'prueba');
  });
}

test('si una ejecución termina abruptamente, su reserva caduca y otra puede consultar',()=>{
  const e=environment(),c=e.context(),p={};
  const key=c.claveDeSonda('captura',cuenta,2026,9);
  e.service.put('en-curso:'+key,'ejecucion-interrumpida',360);
  sondas(c,p);assert.equal(p.enCurso,true);assert.equal(e.network,0);
  e.now+=361000;assert.equal(sondas(c,{}).captura,'REPORTADO');assert.equal(e.network,1);
});
