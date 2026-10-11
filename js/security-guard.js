// ============================================
// 🛡️ SECURITY GUARD - Bloquea sesiones de recuperación
// Impide que un enlace de recuperación dé acceso al sitio
// sin haber cambiado la contraseña primero.
// ============================================
(function() {
    const db = window.supabaseClient;
    if (!db) return;

    db.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            // Si NO estamos ya en la página de recuperación → expulsar allí
            if (!window.location.pathname.includes('recuperar-contrasena')) {
                console.warn('🛡️ Sesión de recuperación detectada. Redirigiendo a cambio de contraseña...');
                sessionStorage.setItem('auth_message', '🔐 Por seguridad, primero debes crear una nueva contraseña.');
                sessionStorage.setItem('auth_type', 'info');
                window.location.href = 'recuperar-contrasena.html';
            }
        }
    });
})();
