// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) return;

    // 1. Detectar si estamos en la página de login
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    try {
        const { data: { session } } = await db.auth.getSession();
        
        // CASO A: No hay sesión activa
        if (!session || !session.user) {
            if (!isLoginPage) {
                window.location.href = 'index.html';
            }
            return; // Detenemos la ejecución aquí
        }

        // CASO B: VERIFICAR BLOQUEO (PARA TODOS LOS USUARIOS CON SESIÓN)
        // Esto se ejecuta sin importar si está en el login o en el dashboard
        const { data: perfil, error } = await db
            .from('perfiles')
            .select('bloqueado, motivo_bloqueo')
            .eq('id', session.user.id)
            .maybeSingle();

        if (perfil && perfil.bloqueado === true) {
            // 1. Cerrar sesión inmediatamente
            await db.auth.signOut();
            
            // 2. Mostrar la alerta al usuario
            alert(`🚫 ACCESO DENEGADO\n\nMotivo: ${perfil.motivo_bloqueo || 'Tu cuenta ha sido bloqueada por el administrador.'}`);
            
            // 3. Redirigir al login. Al recargar, ya no tendrá sesión y se quedará aquí.
            window.location.href = 'index.html';
            return; // Detener ejecución para que no cargue la página protegida
        }

        // CASO C: Hay sesión activa, NO está bloqueado, pero está intentando entrar al login
        if (isLoginPage) {
            window.location.href = 'hub-juegos.html'; 
            return;
        }

        // CASO D: Hay sesión activa, NO está bloqueado y está en una página protegida.
        // El usuario puede ver la página normalmente.
        console.log('✅ Auth Guard: Acceso permitido a', window.location.pathname);

    } catch (err) {
        console.error('❌ Error crítico en Auth Guard:', err);
        // En caso de error de red, NO redirigimos para evitar bucles infinitos
    }
});
