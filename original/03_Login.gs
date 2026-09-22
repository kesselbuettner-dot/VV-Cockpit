
// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 03_Login.gs
// =====================================================

/**
 * Zentrale Login-Funktion für Index.html
 */
function loginUser(password) {

  const role = getRole(password);

  if (!role) {
    return {
      success: false,
      role: null,
      message: 'Anmeldung fehlgeschlagen.'
    };
  }

  return {
    success: true,
    role: role,
    message: 'Anmeldung erfolgreich.'
  };
}