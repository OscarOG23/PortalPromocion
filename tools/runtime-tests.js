const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function context(){
  const c=vm.createContext({console});
  ['Config.gs','Boleto.gs','Destinos.gs','Admin.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'),c));
  c.u={usuario:'prueba',nombre:'Prueba',rol:'COORDINACION',coordinacion_id:'C1'};
  c.usuarioDeBoleto=()=>({ok:true,usuario:c.u});c.getConfig=k=>k==='mes_activo'?9:2026;
  c.secretoDeBoletos=()=> 'prueba';c.leerCatalogo=()=>[{}];c.destinosDeCuenta=x=>x;
  c.problemasDeDestino=()=>[];c.boletoParaDestino=()=> 'boleto';c.enlaceDeDestino=()=> 'https://example.test/';
  c.leerCatalogo=()=>[{destino_id:'uno',nombre:'Uno',clase:'HERMANO_CON_CONTRASENA',sonda:'NATIVA'}];
  c.calls=0;c.consultarSondasNativas_=()=>{c.calls++;return {uno:'REPORTADO'};};
  return c;
}
test('contexto rápido entrega enlaces sin ejecutar sondas',()=>{
  const c=context();const r=c.despachar({accion:'contexto',boleto:'prueba',omitirSondas:true});
  assert.equal(r.ok,true);assert.equal(c.calls,0);assert.equal(r.destinos[0].enlace,'https://example.test/');
  assert.equal(r.estadosPendientes,true);
});
test('clientes anteriores conservan estados en contexto',()=>{
  const c=context();const r=c.despachar({accion:'contexto',boleto:'prueba'});
  assert.equal(r.destinos[0].estado,'REPORTADO');assert.equal(c.calls,1);
});
test('consulta de estados valida sesión y permisos antes de sondear',()=>{
  const c=context();const r=c.despachar({accion:'estados',boleto:'prueba'});
  assert.equal(r.ok,true);assert.equal(r.estados.uno,'REPORTADO');
  c.usuarioDeBoleto=()=>({ok:false,code:'BOLETO_VENCIDO'});c.calls=0;
  assert.equal(c.despachar({accion:'estados',boleto:'vencido'}).code,'BOLETO_VENCIDO');assert.equal(c.calls,0);
});
test('una coordinación no puede consultar estados como otra',()=>{
  const c=context();const r=c.despachar({accion:'estados',boleto:'prueba',usuario:'otra'});
  assert.equal(r.code,'NO_AUTORIZADO');assert.equal(c.calls,0);
});
test('estados de ver como usa solo la cuenta autorizada por servidor',()=>{
  const c=context();c.u.rol='ADMIN';let consultada;
  c.cuentaParaVerComo=()=>({ok:true,fila:{usuario:'objetivo',coordinacion_id:'C2',rol:'COORDINACION'}});
  c._cuentaPublica=x=>x;c.consultarSondasNativas_=(_f,u)=>{consultada=u;return {};};
  assert.equal(c.despachar({accion:'estados',boleto:'prueba',usuario:'objetivo'}).ok,true);
  assert.equal(consultada.coordinacion_id,'C2');
  c.cuentaParaVerComo=()=>({ok:false,code:'CUENTA_NO_DISPONIBLE'});
  assert.equal(c.despachar({accion:'estados',boleto:'prueba',usuario:'inactiva'}).code,'CUENTA_NO_DISPONIBLE');
});
