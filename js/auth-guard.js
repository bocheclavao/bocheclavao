// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const { data: { session } } = await db.auth.getSession();
        
        // 1. Si no hay sesión activa, mandar al login
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }

        const userEmail = session.user.email.toLowerCase();

        // 2. Verificar si el correo está en la lista negra (eliminados permanentemente)
        // Esto evita que un usuario eliminado vuelva a entrar aunque Google lo autentique de nuevo
        const { data: blacklist } = await db
            .from('lista_bloqueo')
            .select('razon')
            .eq('email', userEmail)
            .single();

        if (blacklist) {
            await db.auth.signOut(); // Cierra la sesión inmediatamente
            alert(`🚫 ACCESO DENEGADO\n\nTu correo ha sido eliminado permanentemente del sistema.\nMotivo: ${blacklist.razon || 'Violación de políticas'}\n\nNo puedes volver a registrarte con este correo.`);
            window.location.href = 'index.html';
            return;
        }

        // 3. Verificar si el perfil está bloqueado por el administrador
        const { data: perfil, error: perfilError } = await db
            .from('perfiles')
            .select('bloqueado, motivo_bloqueo')
            .eq('id', session.user.id)
            .single();

        if (perfilError || !perfil || perfil.bloqueado === true) {
            await db.auth.signOut(); // Cierra la sesión inmediatamente
            const motivo = perfil?.motivo_bloqueo || 'Tu cuenta ha sido suspendida por violar las políticas de la plataforma.';
            alert(`🚫 ACCESO DENEGADO\n\n${motivo}\n\nSerás redirigido al inicio de sesión.`);
            window.location.href = 'index.html';
            return;
        }

        // 4. Si pasa todas las verificaciones, el usuario es legítimo y puede ver la página
        console.log('✅ Usuario verificado y autorizado correctamente.');
        
    } catch (err) {
        console.error('Error crítico de seguridad:', err);
        window.location.href = 'index.html';
    }
});
