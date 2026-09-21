var ACCIONES_AUDITABLES = ['INGRESO', 'RESTABLECER_CONTRASENA', 'ROTAR_SECRETO'];

// La acción se valida antes de tocar la hoja, para que sea comprobable sin
// SpreadsheetApp: una acción inventada nunca llega a escribirFilas.
//
// Si la hoja está ocupada o la escritura falla se omite el asiento en vez de
// fallar: la bitácora no debe impedir que una coordinación entre.
function registrarEvento(usuario, accion, detalle) {
  if (ACCIONES_AUDITABLES.indexOf(accion) === -1) {
    throw new Error('ACCION_INVALIDA: "' + accion + '" no es una acción auditable.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return 0;
  try {
    return escribirFilas(HOJAS.AUDITORIA, [{ timestamp: new Date(), usuario: usuario,
                                              accion: accion, detalle: detalle || '' }]);
  } catch (e) {
    console.error('bitácora no escrita: ' + e.message);
    return 0;
  } finally {
    lock.releaseLock();
  }
}
