// Prueba visual local con datos ficticios. No se conecta a Apps Script.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const workspace=path.resolve(__dirname,'..');
const det=path.resolve(workspace,'../DeterminantesConcentrado');
const jor=path.resolve(workspace,'../JORNADA SALUD/JS19-JORNADAS');
const {chromium}=createRequire(path.join(det,'package.json'))('playwright');
const salida=path.join(workspace,'.worktrees/integracion/qa');fs.mkdirSync(salida,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  let html=fs.readFileSync(path.join(det,'src/Index.html'),'utf8');
  for(const n of ['Styles','Scripts','LogosInstitucionales'])html=html.replace(`<?!= include('${n}'); ?>`,fs.readFileSync(path.join(det,'src',n+'.html'),'utf8').replace("window.addEventListener('DOMContentLoaded', iniciar);",''));
  await page.setContent(html);
  await page.evaluate(()=>{
   CTX={periodo:{anio:2026,mes:9}};TOKEN='FICTICIO';
   document.getElementById('acceso').hidden=true;document.getElementById('aplicacion').hidden=false;
   document.getElementById('evidencia').hidden=false;
   document.getElementById('unidad').innerHTML='<option value="U1">Unidad ficticia</option>';
   _pintarEvidencias({cuadre:{message:'Dos archivos recibidos. Contenido pendiente de revisión.',veredicto:'INCOMPLETA'},adicciones:{sesiones:3,asistencias:60,estatus:'ENVIADO'},evidencias:[{evidencia_id:'E1',nombre:'Lista ficticia de Adicciones.pdf',bytes:40000,subtema_declarado:'SUB039',veredicto:'EN_REVISION'},{evidencia_id:'E2',nombre:'Registro ficticio existente.jpg',bytes:30000,veredicto:'FORMATO_VALIDO'}]});
  });
  assert.equal(await page.locator('#lista-adicciones li').count(),1);
  assert.match(await page.locator('#resumen-adicciones').innerText(),/3 sesiones.*60 asistencias/);
  for(const width of [1440,375]){
   await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const textWidth=await page.locator('#lista-evidencia li').last().locator('span').evaluate(n=>n.getBoundingClientRect().width);
   assert.ok(textWidth>=150,'El nombre de la evidencia debe poder leerse sin quedar comprimido.');
   await page.screenshot({path:path.join(salida,`adicciones-${width}.png`),fullPage:true});
  }
  await page.evaluate(()=>{
   window.subidas=[];_prepararArchivo=(_f,cb)=>cb({nombre:'ficticio.pdf',mime:'application/pdf',bytes:30000,contenido:'FICTICIO'});
   function runner(ok){return {withSuccessHandler:f=>runner(f),withFailureHandler:()=>runner(ok),apiSubirEvidencia:function(){subidas.push(Array.from(arguments));setTimeout(()=>ok({success:true}),10);},apiEvidenciasDeUnidad:()=>{}};}
   window.google={script:{run:runner(null)}};subirEvidencias([{name:'ficticio.pdf'}],'SUB039');CTX.periodo={anio:2026,mes:10};
  });
  await page.waitForTimeout(50);
  const subida=await page.evaluate(()=>subidas[0]);assert.equal(subida[2],9);assert.equal(subida[5],'SUB039');
  await page.close();
  const escuela=await browser.newPage({viewport:{width:1440,height:1000}});
  escuela.on('pageerror',e=>errors.push(e.message));
  const style=fs.readFileSync(path.join(jor,'apps_script/estilos.html'),'utf8');
  const content=fs.readFileSync(path.join(jor,'apps_script/escolar.html'),'utf8');
  await escuela.setContent(`<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">${style}</head><body class="jornada-ui"><header><h1>Jornadas</h1><button id="btnEscolar">Trabajo preventivo en escuelas</button></header><div class="progreso"></div><div class="wrap">${content}</div><div class="barra"></div><script>
    function pintarProgreso(){};function runner(ok){return {withSuccessHandler:function(f){return runner(f);},withFailureHandler:function(){return runner(ok);},leerEscolar:function(){setTimeout(function(){ok({unidades:[{id:'U1',nombre:'Unidad ficticia'}],registros:[],planteles:[]});},10);}};}
    var google={script:{run:runner(null)}};iniciarEscolar();abrirEscolar();
  </script></body></html>`);
  await escuela.waitForFunction(()=>document.getElementById('escolarMensaje').textContent.includes('registrados'));
  await escuela.locator('#escolarCCT').fill('15EPR0001A');await escuela.locator('#escolarNombre').fill('Plantel ficticio');
  await escuela.locator('#escolarTurno').selectOption('MATUTINO');await escuela.locator('#escolarMatricula').fill('200');
  for(const width of [1440,375,320]){
   await escuela.setViewportSize({width,height:1000});
   const overflow=await escuela.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodos:Array.from(document.querySelectorAll('body *')).filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>({id:n.id,clase:n.className,ancho:n.getBoundingClientRect().width})).slice(0,10)}));
   assert.equal(overflow.scroll>overflow.width,false,JSON.stringify(overflow));
   await escuela.screenshot({path:path.join(salida,`escolar-${width}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('OK: Adicciones, archivos compartidos, carga con periodo estable y vista escolar sin desbordamiento en escritorio/móvil.');
 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
