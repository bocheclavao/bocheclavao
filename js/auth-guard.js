// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) return;

    // 1. Detectar si estamos en la página de login (index.html)
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    try {
        const { data: { session } } = await db.auth.getSession();
        
        // 2. Si NO hay sesión activa
        if (!session || !session.user) {
            // Solo redirigir al login si NO estamos ya en el login
            if (!isLoginPage) {
                window.location.href = 'index.html';
            }
            return; // Detener la ejecución aquí
        }

        // 3. Si HAY sesión activa, verificar si el usuario está bloqueado
        const { data: perfil } = await db
            .from('perfiles')
            .select('bloqueado, motivo_bloqueo')
            .eq('id', session.user.id)
            .single();

        if (perfil && perfil.bloqueado === true) {
            // Cerrar sesión inmediatamente en Supabase
            await db.auth.signOut();
            
            // Guardar mensaje de error para mostrarlo en el login
            sessionStorage.setItem('auth_message', `🚫 TU CUENTA HA SIDO BLOQUEADA\n\nMotivo: ${perfil.motivo_bloqueo || 'Violación de las políticas de la plataforma.'}\n\nContacta a soporte si crees que es un error.`);
            sessionStorage.setItem('auth_type', 'error');
            
            // Redirigir al login (la verificación isLoginPage evita el bucle infinito)
            if (!isLoginPage) {
                window.location.href = 'index.html';
            }
            return;
        }

        // 4. Si hay sesión activa y estamos en el login, redirigir al Hub/Dashboard
        if (isLoginPage) {
            window.location.href = 'hub-juegos.html'; // O 'dashboard.html' según tu flujo principal
        }

    } catch (err) {
        console.warn('⚠️ Error en la verificación de seguridad (auth-guard):', err);
        // En caso de error de red temporal, NO redirigimos para evitar bucles infinitos
    }
});
