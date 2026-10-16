document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        window.location.href = 'index.html'; 
        return; 
    }

    // ============================================
    // 🚨 FUNCIÓN PARA MOSTRAR MODAL ESTILIZADO DE BLOQUEO
    // ============================================
    window.mostrarModalBloqueo = function(motivo) {
        const existing = document.getElementById('modalBloqueo');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'modalBloqueo';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95); z-index: 999999;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Montserrat', sans-serif;
        `;
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
                border: 2px solid #ff4444; border-radius: 16px;
                padding: 40px 30px; max-width: 450px; width: 90%;
                text-align: center; box-shadow: 0 20px 60px rgba(255, 0, 0, 0.4);
                animation: modalAppear 0.4s ease;
            ">
                <style>
                    @keyframes modalAppear { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                </style>
                <div style="
                    width: 80px; height: 80px; background: rgba(255, 0, 0, 0.15);
                    border: 2px solid #ff4444; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 20px; font-size: 2.5rem;
                ">
                    <i class="fas fa-ban" style="color: #ff4444;"></i>
                </div>
                <h2 style="color: #ff4444; font-size: 1.5rem; margin-bottom: 15px; font-weight: 800;">ACCESO DENEGADO</h2>
                <p style="color: #cccccc; font-size: 1rem; line-height: 1.6; margin-bottom: 25px;">
                    Tu cuenta ha sido bloqueada permanentemente.<br>
                    <strong style="color: #FFD700;">Motivo:</strong> ${motivo || 'Violación de las políticas de la plataforma.'}
                </p>
                <button onclick="cerrarSesionForzada()" style="
                    width: 100%; padding: 14px;
                    background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
                    color: #fff; border: none; border-radius: 8px;
                    font-size: 1rem; font-weight: 700; cursor: pointer;
                    transition: all 0.3s ease; font-family: 'Montserrat', sans-serif;
                ">
                    <i class="fas fa-sign-out-alt"></i> Entendido, Cerrar Sesión
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    };

    window.cerrarSesionForzada = async function() {
        await db.auth.signOut({ scope: 'global' });
        localStorage.clear();
        window.location.href = 'index.html';
    };

    // ============================================
    // 🔐 VERIFICACIÓN DE SESIÓN Y BLOQUEO
    // ============================================
    try {
        const { data: { session } } = await db.auth.getSession();
        
        // 1. Si no hay sesión, mandar al login
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }

        // 2. 🚨 VERIFICAR SI EL USUARIO ESTÁ BLOQUEADO
        const { data: perfil } = await db.from('perfiles')
            .select('bloqueado, motivo_bloqueo')
            .eq('id', session.user.id)
            .single();

        if (perfil && perfil.bloqueado === true) {
            mostrarModalBloqueo(perfil.motivo_bloqueo);
            return; // DETENER EJECUCIÓN: No cargar el resto de la página
        }

        // 3. Si está en index.html pero tiene sesión válida, redirigir al Hub
        const path = window.location.pathname.toLowerCase();
        if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
            window.location.href = 'hub-juegos.html';
            return;
        }

        // 4. Si llega aquí, el usuario tiene sesión y NO está bloqueado.
        // La página (hub-juegos.html) continuará cargando normalmente.
        console.log('✅ Auth Guard: Usuario verificado y autorizado.');

    } catch (err) {
        console.error('❌ Error en Auth Guard:', err);
        window.location.href = 'index.html';
    }
});
