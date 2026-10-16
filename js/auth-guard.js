// js/auth-guard.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) return;

    // Detectar si estamos en la página de login
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    try {
        const { data: { session } } = await db.auth.getSession();
        
        // CASO 1: No hay sesión activa
        if (!session || !session.user) {
            // Solo redirigir al login si NO estamos ya en el login
            if (!isLoginPage) {
                window.location.href = 'index.html';
            }
            return;
        }

        // CASO 2: Hay sesión activa - Verificar si está bloqueado
        const { data: perfil, error } = await db
            .from('perfiles')
            .select('bloqueado, motivo_bloqueo')
            .eq('id', session.user.id)
            .maybeSingle();

        if (perfil && perfil.bloqueado === true) {
            // Usuario bloqueado - Cerrar sesión y redirigir al login con parámetro
            await db.auth.signOut();
            
            // Usar un parámetro URL para indicar que fue bloqueado
            if (!isLoginPage) {
                window.location.href = 'index.html?blocked=true';
            } else {
                // Ya estamos en el login, mostrar el modal directamente
                mostrarModalBloqueo(perfil.motivo_bloqueo);
            }
            return;
        }

        // CASO 3: Hay sesión activa y NO está bloqueado
        if (isLoginPage) {
            // Si está en el login pero tiene sesión válida, redirigir al hub
            window.location.href = 'hub-juegos.html';
            return;
        }

        // CASO 4: Usuario autorizado en página protegida - Permitir acceso
        console.log('✅ Auth Guard: Acceso permitido');

    } catch (err) {
        console.error('❌ Error en Auth Guard:', err);
        // En caso de error, NO redirigir para evitar bucles
    }
});

// Función global para mostrar el modal de bloqueo
function mostrarModalBloqueo(motivo) {
    // Remover modal existente si hay
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
            <div style="width: 80px; height: 80px; background: rgba(255, 0, 0, 0.15); border: 2px solid #ff4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <i class="fas fa-ban" style="font-size: 2.5rem; color: #ff4444;"></i>
            </div>
            <h2 style="color: #ff4444; font-size: 1.5rem; margin-bottom: 15px; font-weight: 800;">ACCESO DENEGADO</h2>
            <p style="color: #cccccc; font-size: 1rem; line-height: 1.6; margin-bottom: 10px;">
                Su cuenta ha sido bloqueada.
            </p>
            <p style="color: #ffffff; font-size: 0.95rem; line-height: 1.5; margin-bottom: 25px; background: rgba(255, 0, 0, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 0, 0, 0.3);">
                <strong>Motivo:</strong> ${motivo || 'Violar las políticas, normas y condiciones de la plataforma.'}
            </p>
            <button onclick="cerrarModalBloqueo()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.3s; font-family: 'Montserrat', sans-serif;">
                Entendido
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function cerrarModalBloqueo() {
    const modal = document.getElementById('modalBloqueo');
    if (modal) modal.style.display = 'none';
}

// Hacer las funciones globales
window.mostrarModalBloqueo = mostrarModalBloqueo;
window.cerrarModalBloqueo = cerrarModalBloqueo;
