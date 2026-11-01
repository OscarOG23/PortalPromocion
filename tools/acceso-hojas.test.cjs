const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('la API lee su base sin depender del documento activo del editor', () => {
  const parentId = JSON.parse(fs.readFileSync(path.join(__dirname, '../.clasp.json'), 'utf8')).parentId;
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'ID_BASE_PORTAL' ? parentId : null }) },
    SpreadsheetApp: {
      getActive() { throw new Error('El documento activo no está disponible en aplicaciones web'); },
      openById(id) {
        assert.equal(id, parentId);
        return { getSheetByName: name => name === 'USUARIOS' ? {
          getDataRange: () => ({getValues: () => [['usuario', 'activo'], ['prueba', true]]})
        } : null };
      }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/Sheets.gs'), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.leerTabla('USUARIOS'))), [{usuario: 'prueba', activo: true}]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.leerTabla('NO_EXISTE'))), []);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/SeguimientoApi.gs'), 'utf8'), context);
  const sheet = {getRange: () => ({setValues: () => {}}), setFrozenRows: () => {}};
  context.SpreadsheetApp.openById = id => {
    assert.equal(id, parentId);
    return {getSheetByName: () => sheet};
  };
  assert.equal(context.hojaAtencionPreventiva_(), sheet);
});
