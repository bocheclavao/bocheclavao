// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const { data: { session } } = await db.auth.getSession();
        
        // Si no hay sesión, mandar al login
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }

        // Verificar si el usuario está bloqueado
        const { data: perfil } = await db
            .from('perfiles')
            .select('bloqueado')
            .eq('id', session.user.id)
            .maybeSingle();

        if (perfil && perfil.bloqueado === true) {
            // 1. Cerrar sesión inmediatamente
            await db.auth.signOut();
            
            // 2. Redirigir al login con una señal de bloqueo en la URL
            window.location.href = 'index.html?blocked=true';
            return;
        }

    } catch (err) {
        console.error('Error en auth-guard:', err);
        window.location.href = 'index.html';
    }
});
