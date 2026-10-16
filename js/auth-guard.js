document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const { data: { session } } = await db.auth.getSession();
        
        // Si no hay sesión, mandar al login sin más
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }

        // Si hay sesión, verificar si está bloqueado en la base de datos
        const { data: perfil, error } = await db.from('perfiles')
            .select('bloqueado, motivo_bloqueo')
            .eq('id', session.user.id)
            .single();

        if (perfil && perfil.bloqueado === true) {
            // Usuario bloqueado: cerrar sesión y redirigir al login con la bandera especial
            await db.auth.signOut();
            window.location.href = 'index.html?blocked=true';
            return; // Detener ejecución para evitar que la página siga cargando
        }

        // Si llega aquí, el usuario tiene sesión y NO está bloqueado.
        // Permitir que la página (hub-juegos.html, dashboard, etc.) cargue normalmente.
        
    } catch (err) {
        console.error('Error crítico en auth-guard:', err);
        window.location.href = 'index.html';
    }
});
