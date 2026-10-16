// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    // Si no hay cliente de Supabase, redirigir al login
    if (!db) {
        window.location.href = 'index.html';
        return;
    }

    // 1. Verificar si hay una sesión activa
    const { data: { session } } = await db.auth.getSession();
    
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Verificar en la base de datos si el usuario está bloqueado
    try {
        const { data: perfil, error } = await db
            .from('perfiles')
            .select('bloqueado')
            .eq('id', session.user.id)
            .maybeSingle(); // maybeSingle evita errores si el perfil aún no se ha creado

        if (error) {
            console.error('Error verificando estado de bloqueo:', error);
            return; // No bloqueamos agresivamente por errores de red temporales
        }

        // 3. Si la columna 'bloqueado' es true, expulsar inmediatamente
        if (perfil && perfil.bloqueado === true) {
            // Cerrar sesión de forma segura
            await db.auth.signOut();
            
            // Crear un modal profesional de bloqueo (mejor que un alert feo)
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.95); z-index: 99999;
                display: flex; justify-content: center; align-items: center;
                font-family: 'Montserrat', sans-serif;
            `;
            modal.innerHTML = `
                <div style="
                    background: #111; border: 2px solid #ff4444; border-radius: 16px;
                    padding: 40px 30px; max-width: 400px; width: 90%; text-align: center;
                    box-shadow: 0 0 40px rgba(255, 68, 68, 0.3);
                    animation: fadeIn 0.3s ease;
                ">
                    <style>@keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }</style>
                    <i class="fas fa-ban" style="font-size: 3rem; color: #ff4444; margin-bottom: 20px;"></i>
                    <h2 style="color: #ff4444; font-size: 1.5rem; margin-bottom: 15px; font-weight: 800;">ACCESO DENEGADO</h2>
                    <p style="color: #ccc; font-size: 1rem; line-height: 1.5; margin-bottom: 20px;">
                        Tu cuenta ha sido <strong>bloqueada o eliminada</strong>.<br><br>
                        Por favor, contacta a soporte si crees que esto es un error.
                    </p>
                    <p style="color: #666; font-size: 0.85rem;">Redirigiendo al inicio...</p>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Redirigir al login después de 2.5 segundos para que lean el mensaje
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2500);
        }
    } catch (err) {
        console.error('Error crítico en auth-guard:', err);
    }
});
