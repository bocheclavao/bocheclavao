document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        showMessage('Error: No se pudo conectar con el servidor', 'error');
        return;
    }

    function construirURL(base) {
        const path = window.location.pathname;
        const repoPath = path.substring(0, path.lastIndexOf('/'));
        return window.location.origin + repoPath + base;
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.innerHTML = text; // Cambiado a innerHTML para permitir formato
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
        }
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
    // 🔐 LOGIN CON EMAIL Y CONTRASEÑA
    // ============================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                showMessage('Por favor, completa todos los campos.', 'error');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando...';
            showMessage('Iniciando sesión...', 'info');
            
            try {
                const { data, error: authError } = await db.auth.signInWithPassword({ email, password });
                
                if (authError) {
                    showMessage('❌ Correo o contraseña incorrectos.', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Ingresar';
                    return;
                }
                
                // 🚨 VERIFICAR SI ESTÁ BLOQUEADO ANTES DE REDIRIGIR
                const { data: perfil } = await db.from('perfiles')
                    .select('bloqueado, motivo_bloqueo')
                    .eq('id', data.user.id)
                    .single();

                if (perfil && perfil.bloqueado === true) {
                    mostrarModalBloqueo(perfil.motivo_bloqueo);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Ingresar';
                    return; // DETENER EJECUCIÓN, NO REDIRIGIR
                }
                
                // ✅ SI NO ESTÁ BLOQUEADO, REDIRIGIR AL HUB DE JUEGOS
                window.location.href = 'hub-juegos.html';
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Ingresar';
            }
        });
    }

    // ============================================
    // 🔐 LOGIN CON GOOGLE (Redirige a hub-juegos.html)
    // ============================================
    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            // Redirigimos directamente a hub-juegos.html. 
            // El auth-guard.js se encargará de verificar si está bloqueado allí.
            const redirectURL = construirURL('/hub-juegos.html');
            const { error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirectURL, queryParams: { access_type: 'offline', prompt: 'consent' } }
            });
            if (error) {
                showMessage('Error: ' + error.message, 'error');
            }
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // ============================================
    // 🔄 FLUJO DE RECUPERACIÓN (Sin cambios mayores)
    // ============================================
    window.mostrarRecuperacion = function(event) {
        if (event) event.preventDefault();
        if (messageDiv) { messageDiv.textContent = ''; messageDiv.style.display = 'none'; }
        if (loginForm) loginForm.style.display = 'none';
        document.querySelectorAll('.forgot-password, .divider, .btn-google, .register-link').forEach(el => { if(el) el.style.display = 'none'; });
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    window.volverAlLogin = function(event) {
        if (event) event.preventDefault();
        if (messageDiv) { messageDiv.textContent = ''; messageDiv.style.display = 'none'; }
        if (loginForm) loginForm.style.display = 'block';
        document.querySelectorAll('.forgot-password, .divider, .btn-google, .register-link').forEach(el => { if(el) el.style.display = 'block'; });
        document.getElementById('recoveryStep1').style.display = 'none';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    window.volverAlRecoveryStep1 = function(event) {
        if (event) event.preventDefault();
        if (messageDiv) { messageDiv.textContent = ''; messageDiv.style.display = 'none'; }
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    const recoveryForm = document.getElementById('recoveryForm');
    if (recoveryForm) {
        recoveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('recoveryEmail').value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            showMessage('Enviando enlace de recuperación...', 'info');
            try {
                const redirectURL = construirURL('/recuperar-contrasena.html');
                const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: redirectURL });
                if (error) {
                    showMessage('Error: ' + error.message, 'error');
                    return;
                }
                document.getElementById('recoveryStep1').style.display = 'none';
                document.getElementById('recoveryStep2').style.display = 'block';
                document.getElementById('recoveryEmailDisplay').textContent = email;
                showMessage('✅ Enlace enviado. Revisa tu correo.', 'success');
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }
});
