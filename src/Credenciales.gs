// La contraseña nunca se guarda. Se guarda la sal y la huella SHA-256 de
// sal + contraseña. La sal por usuario impide que dos coordinaciones con la
// misma contraseña compartan huella, y que una tabla precalculada sirva.
//
// SHA-256 no es un algoritmo de contraseñas fuerte: los adecuados (bcrypt,
// scrypt, PBKDF2) son deliberadamente lentos y Apps Script no ofrece ninguno.
// Es aceptable aquí SOLO porque las contraseñas las genera el sistema con
// suficiente entropía y nadie las elige a mano. Si algún día se permite
// elegirlas, hay que cambiar el algoritmo antes.
function huellaContrasena(sal, contrasena) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
                                      String(sal) + String(contrasena),
                                      Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function verificarContrasena(contrasena, sal, huellaGuardada) {
  if (!contrasena || !sal || !huellaGuardada) return false;
  return huellaContrasena(sal, contrasena) === String(huellaGuardada);
}

function generarSal() {
  return Utilities.getUuid().replace(/-/g, '');
}
