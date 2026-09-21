// El usuario sale del nombre de la coordinación: 'CEAPS SANTA ROSA' da
// 'ceapssantarosa'. Se quitan acentos, espacios y signos porque este texto se
// teclea en un celular y se dicta por teléfono.
function usuarioDeCoordinacion(nombre) {
  return sinAcentos(String(nombre))
           .toLowerCase()
           .replace(/[^a-z0-9]/g, '');
}

// La contraseña es el usuario con '26' al final. Es DEDUCIBLE a propósito, por
// decisión explícita del usuario (2026-09-21), la misma que en Determinantes.
//
// Aquí pesa más que allá, y quedó dicho al decidir: la máscara se sirve desde
// GitHub Pages, que es público, así que ya no existe la barrera de "no
// publicar la URL". Quien sepa el nombre de una coordinación y encuentre la
// página entra como ella a TODOS sus capturadores.
//
// Para endurecerla basta cambiar esta función, correr
// crearCuentasDeCoordinaciones() y repartir las nuevas: nada más depende de
// cómo se forma la contraseña.
function contrasenaDeUsuario(usuario) {
  return usuario + '26';
}
