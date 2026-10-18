document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        window.location.href = 'index.html';
        return;
    }

    const btnAdmin = document.getElementById('btnAdmin');
    let sessionCheckActive = false;

    // ============================================
    // 🔐 1. VERIFICAR SESIÓN AL CARGAR
    // ============================================
    const { data: { session } } = await db.auth.getSession();
    
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // ============================================
    // 🚨 2. VERIFICAR BLOQUEO PERMANENTE
    // ============================================
    const { data: perfil } = await db
        .from('perfiles')
        .select('bloqueado, motivo_bloqueo')
        .eq('id', session.user.id)
        .maybeSingle();

    if (perfil && perfil.bloqueado === true) {
        await db.auth.signOut();
        const motivo = perfil.motivo_bloqueo || 'Violación de las políticas, normas y condiciones de la plataforma.';
        
        sessionStorage.setItem('auth_message', `🚫 <strong>TU CUENTA HA SIDO BLOQUEADA PERMANENTEMENTE</strong><br><br>Motivo: ${motivo}<br><br>Contacta a soporte si crees que esto es un error.`);
        sessionStorage.setItem('auth_type', 'error');
        
        window.location.href = 'index.html';
        return;
    }

    // ============================================
    // 🚨 3. VERIFICAR SUSPENSIÓN TEMPORAL
    // ============================================
    const { data: checkData } = await db.rpc('check_login_attempt', { 
        p_email: session.user.email, 
        p_action: 'check' 
    });

    if (checkData && checkData.allowed === false) {
        await db.auth.signOut();
        sessionStorage.setItem('auth_message', `🚫 Tu cuenta está suspendida temporalmente por múltiples intentos fallidos.`);
        sessionStorage.setItem('auth_type', 'error');
        window.location.href = 'index.html';
        return;
    }

    // ============================================
    // 🚨 4. VERIFICAR SESIÓN DUPLICADA (CORREGIDO)
    // ============================================
    async function registrarMiSesion() {
        try {
            if (!session || !session.access_token) return;
            const token = session.access_token;
            localStorage.setItem('session_token', token);
            
            // ✅ USAR UPSERT DIRECTO (no depende de una RPC)
            await db.from('active_sessions').upsert({
                user_id: session.user.id,
                session_token: token,
                last_active: new Date().toISOString(),
                device_info: navigator.userAgent.substring(0, 200)
            });
            console.log('✅ Mi sesión registrada en BD');
        } catch (e) {
            console.warn('⚠️ No se pudo registrar sesión:', e.message);
        }
    }

    async function verificarSesionActiva() {
        if (sessionCheckActive || !session || !session.user) return;
        sessionCheckActive = true;
        
        try {
            const miToken = localStorage.getItem('session_token');
            if (!miToken) {
                await registrarMiSesion();
                return;
            }

            const { data, error } = await db
                .from('active_sessions')
                .select('session_token')
                .eq('user_id', session.user.id)
                .maybeSingle();
            
            if (error || !data) {
                await registrarMiSesion();
                return;
            }

            // 🚨 SI EL TOKEN NO COINCIDE → SESIÓN DUPLICADA
            if (data.session_token !== miToken) {
                console.warn('⚠️ Sesión duplicada detectada en Hub de Juegos');
                mostrarAlertaSesionDuplicada();
            } else {
                try {
                    await db.from('active_sessions')
                        .update({ last_active: new Date().toISOString() })
                        .eq('user_id', session.user.id);
                } catch (e) { /* silencioso */ }
            }
        } catch (err) {
            console.error('Error verificando sesión:', err);
        } finally {
            sessionCheckActive = false;
        }
    }

    // ============================================
    // 🚨 5. MODAL DE SESIÓN DUPLICADA
    // ============================================
    function crearModalSesionDuplicada() {
        const existing = document.getElementById('duplicateSessionModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'duplicateSessionModal';
        modal.style.cssText = `
            display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.95); z-index: 999999;
            justify-content: center; align-items: center; padding: 20px;
            font-family: 'Montserrat', sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 2px solid #ff0000; border-radius: 16px; padding: 40px 30px; max-width: 450px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(255, 0, 0, 0.4); animation: modalAppear 0.4s ease;">
                <style>
                    @keyframes modalAppear { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                </style>
                <div style="width: 80px; height: 80px; background: rgba(255, 0, 0, 0.15); border: 2px solid #ff0000; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 2.5rem; animation: pulse 2s infinite;">
                    <i class="fas fa-shield-alt" style="color: #ff0000;"></i>
                </div>
                <h2 style="color: #ff0000; font-size: 1.4rem; margin-bottom: 15px; font-weight: 800;">⚠️ Sesión Duplicada Detectada</h2>
                <p style="color: #cccccc; font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px;">Se ha iniciado sesión en otro dispositivo. Esta sesión se cerrará automáticamente por motivos de seguridad.</p>
                <button id="closeSessionBtn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.3s ease; font-family: 'Montserrat', sans-serif;">
                    <i class="fas fa-sign-out-alt"></i> Cerrar Sesión Ahora
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('closeSessionBtn').addEventListener('click', async () => {
            sessionStorage.setItem('auth_message', '⚠️ Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo.');
            sessionStorage.setItem('auth_type', 'info');
            
            await db.auth.signOut({ scope: 'global' });
            localStorage.removeItem('session_token');
            window.location.href = 'index.html';
        });
        
        return modal;
    }

    function mostrarAlertaSesionDuplicada() {
        const modal = crearModalSesionDuplicada();
        if (modal.style.display !== 'flex') {
            modal.style.display = 'flex';
            
            setTimeout(async () => {
                if (modal.style.display === 'flex') {
                    sessionStorage.setItem('auth_message', '⚠️ Tu sesión ha sido cerrada automáticamente porque iniciaste sesión en otro dispositivo.');
                    sessionStorage.setItem('auth_type', 'info');
                    
                    await db.auth.signOut({ scope: 'global' });
                    localStorage.removeItem('session_token');
                    window.location.href = 'index.html';
                }
            }, 8000);
        }
    }

    // Ejecutar verificación de sesión duplicada
    await registrarMiSesion();
    await verificarSesionActiva();

    // Escuchar cambios de autenticación en tiempo real
    db.auth.onAuthStateChange((event, currentSession) => {
        if (event === 'SIGNED_IN' && currentSession) {
            registrarMiSesion();
        } else if (event === 'SIGNED_OUT' || !currentSession) {
            localStorage.removeItem('session_token');
            if (!window.location.pathname.includes('index.html')) {
                sessionStorage.setItem('auth_message', 'Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo.');
                sessionStorage.setItem('auth_type', 'info');
                window.location.href = 'index.html';
            }
        }
    });

    // ============================================
    // 🛡️ 6. VERIFICAR SI ES ADMINISTRADOR
    // ============================================
    async function verificarSiEsAdmin(userId) {
        try {
            const { data, error } = await db
                .from('admin_roles')
                .select('es_admin, activo')
                .eq('id', userId)
                .eq('es_admin', true)
                .eq('activo', true)
                .maybeSingle();
            
            if (error || !data) return false;
            return true;
        } catch (err) {
            console.error('Error verificando admin:', err);
            return false;
        }
    }

    const esAdmin = await verificarSiEsAdmin(session.user.id);
    if (esAdmin && btnAdmin) {
        btnAdmin.style.display = 'flex';
    } else if (btnAdmin) {
        btnAdmin.style.display = 'none';
    }

    // ============================================
    // 🚪 7. FUNCIONES GLOBALES
    // ============================================
    window.cerrarSesion = async function() {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            try {
                await db.auth.signOut({ scope: 'global' });
                localStorage.removeItem('session_token');
                window.location.href = 'index.html';
            } catch (err) {
                console.error('Error al cerrar sesión:', err);
                alert('Hubo un error al cerrar sesión.');
            }
        }
    };

    window.irAPanelAdmin = function() {
        window.location.href = 'admin.html';
    };

    console.log('✅ Hub de Juegos cargado correctamente. Usuario:', session.user.email);
});
