const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('instalación crea sólo la tabla lateral ausente y es idempotente',()=>{
 const headers=['evidencia_id','subtema_declarado','origen_declaracion','usuario_declaracion','fecha_declaracion'];let tabla=null,creadas=0;
 const range={setValues(values){tabla.headers=values[0];return this;},setFontWeight(){return this;},setValue(v){tabla.headers.push(v);return this;},getValues(){return [tabla.headers];}};
 const ss={getSheetByName:()=>tabla,insertSheet(name){assert.equal(name,'EVIDENCIAS');creadas++;tabla={headers:[],getRange:()=>range,getLastColumn:()=>tabla.headers.length,setFrozenRows(){}};return tabla;}};
 const ctx=vm.createContext({HOJAS:{EVIDENCIAS:'EVIDENCIAS'},ESQUEMA:[['EVIDENCIAS',headers]],SpreadsheetApp:{getActive:()=>ss}});
 vm.runInContext(fs.readFileSync('../DeterminantesConcentrado/src/Adicciones.gs','utf8'),ctx);
 ctx.migrarDeclaracionEvidencias();assert.equal(creadas,1);assert.deepEqual(tabla.headers,headers);ctx.migrarDeclaracionEvidencias();assert.equal(creadas,1);
});
