// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) return;

    // 1. Detectar si estamos en la página de login para evitar bucles
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

        // CASO B: Hay sesión activa, pero el usuario está intentando entrar al login
        if (isLoginPage) {
            window.location.href = 'hub-juegos.html'; // Redirigir al hub si ya está logueado
            return;
        }

        // CASO C: Hay sesión activa y estamos en una página protegida (dashboard, hub, etc.)
        // Usamos .maybeSingle() en lugar de .single() para que NO lance error si la política RLS falla temporalmente
        const { data: perfil, error } = await db
            .from('perfiles')
            .select('bloqueado, motivo_bloqueo')
            .eq('id', session.user.id)
            .maybeSingle();

        // Solo bloqueamos si CONFIRMAMOS que el perfil existe y la columna 'bloqueado' es true.
        // Si 'perfil' es null (por un error de RLS o retraso), NO redirigimos para evitar el bucle.
        if (perfil && perfil.bloqueado === true) {
            await db.auth.signOut();
            alert(`🚫 ACCESO DENEGADO\n\nMotivo: ${perfil.motivo_bloqueo || 'Tu cuenta ha sido bloqueada por el administrador.'}`);
            window.location.href = 'index.html';
            return;
        }

        // Si llegamos aquí, todo está bien. El usuario puede ver la página.
        console.log('✅ Auth Guard: Acceso permitido a', window.location.pathname);

    } catch (err) {
        console.error('❌ Error crítico en Auth Guard:', err);
        // En caso de error de red, NO redirigimos para evitar bucles infinitos
    }
});
