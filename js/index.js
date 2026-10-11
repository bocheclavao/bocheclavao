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
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
        }
    }

    // ============================================
    // 👁️ MOSTRAR / OCULTAR CONTRASEÑA
    // ============================================
    window.togglePasswordVisibility = function() {
        const passwordInput = document.getElementById('password');
        const icon = document.querySelector('.toggle-password');
        
        if (!passwordInput || !icon) return;
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    // ============================================
    // 🔐 LOGIN CON EMAIL Y CONTRASEÑA
    // ============================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                showMessage('Por favor, completa todos los campos.', 'error');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando...';
            showMessage('Iniciando sesión...', 'info');
            
            try {
                // Verificar si está bloqueado ANTES de intentar login
                try {
                    const { data: preCheck, error: preError } = await db.rpc('check_login_attempt', {
                        p_email: email,
                        p_success: false
                    });
                    
                    if (!preError && preCheck && preCheck.allowed === false) {
                        const hasta = preCheck.blocked_until 
                            ? new Date(preCheck.blocked_until).toLocaleString('es-ES') 
                            : 'varias horas';
                        showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                        resetButton();
                        return;
                    }
                    
                    // Revertir el "intento" de verificación
                    await db.from('login_attempts')
                        .delete()
                        .eq('email', email.toLowerCase())
                        .eq('success', false);
                } catch (preCheckErr) {
                    console.warn('No se pudo verificar bloqueo previo:', preCheckErr.message);
                }

                // Intentar login
                const { data, error: authError } = await db.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (authError) {
                    console.error('Error de autenticación:', authError);
                    
                    // Traducir mensajes de error al español
                    let mensajeError = authError.message;
                    
                    if (authError.message.includes('Invalid login credentials')) {
                        mensajeError = 'Correo o contraseña incorrectos.';
                    } else if (authError.message.includes('Email not confirmed')) {
                        mensajeError = 'Debes confirmar tu correo antes de iniciar sesión.';
                    } else if (authError.message.includes('For security purposes')) {
                        const match = authError.message.match(/after (\d+) seconds?/);
                        const segundos = match ? match[1] : '60';
                        mensajeError = `⏱️ Por seguridad, espera ${segundos} segundos antes de intentar de nuevo.`;
                    } else if (authError.message.includes('rate limit')) {
                        mensajeError = 'Demasiados intentos. Por favor, espera un momento.';
                    }
                    
                    // Registrar intento fallido
                    try {
                        const { data: attemptData } = await db.rpc('check_login_attempt', {
                            p_email: email,
                            p_success: false
                        });
                        
                        if (attemptData && attemptData.allowed === false) {
                            const hasta = attemptData.blocked_until 
                                ? new Date(attemptData.blocked_until).toLocaleString('es-ES') 
                                : 'varias horas';
                            showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                        } else {
                            const intentos = attemptData ? attemptData.attempts : 1;
                            const restantes = Math.max(0, 5 - intentos);
                            showMessage(`${mensajeError} Te quedan ${restantes} intento(s).`, 'error');
                        }
                    } catch (rpcErr) {
                        console.error('Error al registrar intento:', rpcErr);
                        showMessage(mensajeError, 'error');
                    }
                    
                    resetButton();
                    return;
                }
                
                // Login exitoso → resetear contador
                try {
                    await db.rpc('check_login_attempt', { p_email: email, p_success: true });
                } catch (rpcErr) {
                    console.warn('No se pudo resetear contador de intentos:', rpcErr.message);
                }

                // Verificar email confirmado
                if (data.user && !data.user.email_confirmed_at) {
                    await db.auth.signOut();
                    showMessage('Debes confirmar tu correo antes de iniciar sesión.', 'error');
                    resetButton();
                    return;
                }
                
                // ✅ REGISTRAR SESIÓN ACTIVA (upsert)
                if (data.user) {
                    try {
                        const sessionToken = Date.now().toString(36) + Math.random().toString(36).substr(2);
                        
                        await db.from('active_sessions').upsert({
                            user_id: data.user.id,
                            session_token: sessionToken,
                            last_active: new Date().toISOString(),
                            device_info: navigator.userAgent.substring(0, 200)
                        });
                        
                        localStorage.setItem('session_token', sessionToken);
                        console.log('✅ Sesión activa registrada');
                    } catch (sessionErr) {
                        console.error('Error registrando sesión (continuando):', sessionErr);
                    }
                }

                // Cerrar otras sesiones del usuario
                try {
                    await db.auth.signOut({ scope: 'others' });
                } catch (e) {
                    console.warn('No se pudieron cerrar otras sesiones');
                }
                
                showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                setTimeout(() => {
                    const redirectUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.REDIRECT_AFTER_LOGIN) 
                        ? APP_CONFIG.REDIRECT_AFTER_LOGIN 
                        : 'dashboard.html';
                    window.location.href = redirectUrl;
                }, 1500);
                
            } catch (err) {
                console.error('Error inesperado en login:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
            }
        });
    }

    function resetButton() {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ingresar';
        }
    }

    // ============================================
    // 🔐 LOGIN CON GOOGLE
    // ============================================
    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            const redirectURL = construirURL('/dashboard.html');
            console.log('🔗 Redirect URL:', redirectURL);
            
            const { data, error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectURL,
                    queryParams: { 
                        access_type: 'offline', 
                        prompt: 'consent' 
                    }
                }
            });
            
            if (error) {
                console.error('Error OAuth:', error);
                
                let mensajeError = error.message;
                if (error.message.includes('already registered') || error.message.includes('already exists')) {
                    mensajeError = 'Este correo ya está registrado con otro método.';
                } else if (error.message.includes('For security purposes')) {
                    const match = error.message.match(/after (\d+) seconds?/);
                    const segundos = match ? match[1] : '60';
                    mensajeError = `⏱️ Por seguridad, espera ${segundos} segundos antes de intentar de nuevo.`;
                }
                
                showMessage(mensajeError, 'error');
            }
        } catch (err) {
            console.error('Error inesperado OAuth:', err);
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // ============================================
    // 🔄 FLUJO DE RECUPERACIÓN DENTRO DEL LOGIN
    // ============================================
    
    // Mostrar panel de recuperación (paso 1)
    window.mostrarRecuperacion = function() {
        // Ocultar formulario de login y elementos relacionados
        if (loginForm) loginForm.style.display = 'none';
        const forgotPassword = document.querySelector('.forgot-password');
        const divider = document.querySelector('.divider');
        const googleBtn = document.querySelector('.google-btn');
        const registerLink = document.querySelector('.register-link');
        
        if (forgotPassword) forgotPassword.style.display = 'none';
        if (divider) divider.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        
        // Mostrar panel de recuperación
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
        
        // Limpiar mensajes
        if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }
    };
    
    // Volver al login desde recuperación
    window.volverAlLogin = function() {
        // Mostrar formulario de login y elementos relacionados
        if (loginForm) loginForm.style.display = 'block';
        const forgotPassword = document.querySelector('.forgot-password');
        const divider = document.querySelector('.divider');
        const googleBtn = document.querySelector('.google-btn');
        const registerLink = document.querySelector('.register-link');
        
        if (forgotPassword) forgotPassword.style.display = 'block';
        if (divider) divider.style.display = 'block';
        if (googleBtn) googleBtn.style.display = 'block';
        if (registerLink) registerLink.style.display = 'block';
        
        // Ocultar paneles de recuperación
        document.getElementById('recoveryStep1').style.display = 'none';
        document.getElementById('recoveryStep2').style.display = 'none';
        
        // Limpiar mensajes
        if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }
    };
    
    // Volver al paso 1 de recuperación (cambiar email)
    window.volverAlRecoveryStep1 = function() {
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    // Manejar envío del formulario de recuperación
    const recoveryForm = document.getElementById('recoveryForm');
    if (recoveryForm) {
        recoveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('recoveryEmail').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailRegex.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            
            showMessage('Enviando enlace de recuperación...', 'info');
            
            try {
                const redirectURL = construirURL('/recuperar-contrasena.html');
                
                const { data, error } = await db.auth.resetPasswordForEmail(email, {
                    redirectTo: redirectURL
                });
                
                if (error) {
                    console.error('Error al enviar enlace:', error);
                    
                    let mensajeError = error.message;
                    
                    if (error.message.includes('User not found') || error.message.includes('no user found')) {
                        mensajeError = 'Este correo no está registrado en nuestro sistema.';
                    } else if (error.message.includes('For security purposes') || error.message.includes('rate limit')) {
                        const match = error.message.match(/after (\d+) seconds?/);
                        const segundos = match ? match[1] : '60';
                        mensajeError = `⏱️ Por seguridad, espera ${segundos} segundos antes de solicitar otro enlace.`;
                    }
                    
                    showMessage(mensajeError, 'error');
                    return;
                }
                
                // Mostrar panel de confirmación (paso 2)
                document.getElementById('recoveryStep1').style.display = 'none';
                document.getElementById('recoveryStep2').style.display = 'block';
                document.getElementById('recoveryEmailDisplay').textContent = email;
                
                showMessage('✅ Enlace enviado. Revisa tu correo.', 'success');
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // ============================================
    // 🛡️ VERIFICAR SESIÓN ACTIVA AL CARGAR
    // ============================================
    async function checkSession() {
        try {
            const { data: { session } } = await db.auth.getSession();
            if (session) {
                const redirectUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.REDIRECT_AFTER_LOGIN) 
                    ? APP_CONFIG.REDIRECT_AFTER_LOGIN 
                    : 'dashboard.html';
                window.location.href = redirectUrl;
            }
        } catch (err) {
            console.warn('No se pudo verificar sesión:', err);
        }
    }
    checkSession();

    // ============================================
    // 📩 MOSTRAR MENSAJE DE EXPULSIÓN SI EXISTE
    // ============================================
    const logoutReason = sessionStorage.getItem('auth_message');
    const logoutType = sessionStorage.getItem('auth_type') || 'info';
    
    if (logoutReason) {
        showMessage(logoutReason, logoutType);
        sessionStorage.removeItem('auth_message');
        sessionStorage.removeItem('auth_type');
    }
});
