document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');

    // Verificar si viene de un bloqueo (parámetro URL)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('blocked') === 'true') {
        // Limpiar el parámetro de la URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Mostrar modal de bloqueo
        if (typeof mostrarModalBloqueo === 'function') {
            mostrarModalBloqueo('Violar las políticas, normas y condiciones de la plataforma.');
        }
        return; // No continuar con el resto del código
    }

    // Función para mostrar mensajes
    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
        }
    }

    function clearMessage() {
        if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
            messageDiv.style.display = 'none';
        }
    }

    function resetButton() {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ingresar';
        }
    }

    // ============================================
    //  LOGIN CON EMAIL Y CONTRASEÑA
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
                // Intentar login
                const { data, error: authError } = await db.auth.signInWithPassword({ email, password });
                
                if (authError) {
                    showMessage('❌ Correo o contraseña incorrectos.', 'error');
                    resetButton();
                    return;
                }
                
                // Verificar si está bloqueado
                const { data: perfil } = await db.from('perfiles')
                    .select('bloqueado, motivo_bloqueo')
                    .eq('id', data.user.id)
                    .single();
                
                if (perfil && perfil.bloqueado === true) {
                    // ESTÁ BLOQUEADO - Cerrar sesión y mostrar modal
                    await db.auth.signOut();
                    
                    if (typeof mostrarModalBloqueo === 'function') {
                        mostrarModalBloqueo(perfil.motivo_bloqueo || 'Violar las políticas, normas y condiciones de la plataforma.');
                    }
                    resetButton();
                    return;
                }
                
                // Login exitoso y NO bloqueado - Redirigir al hub
                window.location.href = 'hub-juegos.html';
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
            }
        });
    }

    // ============================================
    // 🔐 LOGIN CON GOOGLE
    // ============================================
    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            const redirectURL = window.location.origin + window.location.pathname.replace('index.html', '') + 'hub-juegos.html';
            const { error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: { 
                    redirectTo: redirectURL,
                    queryParams: { access_type: 'offline', prompt: 'consent' } 
                }
            });
            if (error) {
                showMessage('Error: ' + error.message, 'error');
            }
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // ============================================
    // 🔄 FLUJO DE RECUPERACIÓN
    // ============================================
    window.mostrarRecuperacion = function(event) {
        if (event) event.preventDefault();
        clearMessage();
        if (loginForm) loginForm.style.display = 'none';
        document.querySelectorAll('.forgot-password, .divider, .btn-google, .register-link').forEach(el => { if(el) el.style.display = 'none'; });
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    window.volverAlLogin = function(event) {
        if (event) event.preventDefault();
        clearMessage();
        if (loginForm) loginForm.style.display = 'block';
        document.querySelectorAll('.forgot-password, .divider, .btn-google, .register-link').forEach(el => { if(el) el.style.display = 'block'; });
        document.getElementById('recoveryStep1').style.display = 'none';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    window.volverAlRecoveryStep1 = function(event) {
        if (event) event.preventDefault();
        clearMessage();
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
                const redirectURL = window.location.origin + window.location.pathname.replace('index.html', '') + 'recuperar-contrasena.html';
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
