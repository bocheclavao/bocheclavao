// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    // 1. Verificar que Supabase cargó
    if (!db) {
        console.error('❌ AUTH GUARD: No se encontró window.supabaseClient. Revisa config.js');
        return;
    }

    // 2. Obtener la sesión actual
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    
    if (sessionError || !session || !session.user) {
        console.warn('⚠️ AUTH GUARD: No hay sesión activa. Redirigiendo al login...');
        window.location.href = 'index.html';
        return;
    }

    console.log('🔍 AUTH GUARD: Verificando estado del usuario:', session.user.email);

    // 3. Consultar la tabla 'perfiles' para ver si está bloqueado
    const { data: perfil, error: perfilError } = await db
        .from('perfiles')
        .select('bloqueado, motivo_bloqueo')
        .eq('id', session.user.id)
        .single();

    if (perfilError) {
        console.error('❌ AUTH GUARD: Error al consultar el perfil en la BD:', perfilError);
        // Por seguridad, si no podemos verificar, cerramos la sesión
        await db.auth.signOut();
        window.location.href = 'index.html';
        return;
    }

    // 4. Evaluar si está bloqueado
    if (perfil && perfil.bloqueado === true) {
        console.warn('🚫 AUTH GUARD: ¡USUARIO BLOQUEADO DETECTADO! Motivo:', perfil.motivo_bloqueo);
        
        // Forzar cierre de sesión inmediatamente
        await db.auth.signOut();
        
        // Mostrar alerta y redirigir
        alert(`🚫 ACCESO DENEGADO\n\nTu cuenta ha sido bloqueada.\nMotivo: ${perfil.motivo_bloqueo || 'Violación de las políticas de la plataforma.'}\n\nSerás redirigido al inicio de sesión.`);
        
        window.location.href = 'index.html';
        return; // Detiene la ejecución del resto de la página
    }

    // 5. Si llega aquí, todo está bien
    console.log('✅ AUTH GUARD: Usuario verificado y autorizado correctamente.');
});
