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

    // ============================================
    // 🛡️ DIAGNÓSTICO DEL MENSAJE FANTASMA
    // ============================================
    const existingMessage = sessionStorage.getItem('auth_message');
    if (existingMessage && existingMessage.includes('otro dispositivo')) {
        console.warn('⚠️ ALERTA: El mensaje de "otro dispositivo" YA estaba en sessionStorage al cargar.');
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
                try {
                    const { data: preCheck, error: preError } = await db.rpc('check_login_attempt', { p_email: email, p_success: false });
                    if (!preError && preCheck && preCheck.allowed === false) {
                        const hasta = preCheck.blocked_until ? new Date(preCheck.blocked_until).toLocaleString('es-ES') : 'varias horas';
                        showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                        resetButton();
                        return;
                    }
                    await db.from('login_attempts').delete().eq('email', email.toLowerCase()).eq('success', false);
                } catch (preCheckErr) {
                    console.warn('No se pudo verificar bloqueo previo:', preCheckErr.message);
                }

                const { data, error: authError } = await db.auth.signInWithPassword({ email: email, password: password });
                
                if (authError) {
                    let mensajeError = authError.message;
                    if (authError.message.includes('Invalid login credentials')) mensajeError = 'Correo o contraseña incorrectos.';
                    else if (authError.message.includes('Email not confirmed')) mensajeError = 'Debes confirmar tu correo antes de iniciar sesión.';
                    else if (authError.message.includes('For security purposes')) {
                        const match = authError.message.match(/after (\d+) seconds?/);
                        mensajeError = `⏱️ Por seguridad, espera ${match ? match[1] : '60'} segundos antes de intentar de nuevo.`;
                    } else if (authError.message.includes('rate limit')) {
                        mensajeError = 'Demasiados intentos. Por favor, espera un momento.';
                    }
                    
                    try {
                        const { data: attemptData } = await db.rpc('check_login_attempt', { p_email: email, p_success: false });
                        if (attemptData && attemptData.allowed === false) {
                            const hasta = attemptData.blocked_until ? new Date(attemptData.blocked_until).toLocaleString('es-ES') : 'varias horas';
                            showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                        } else {
                            const intentos = attemptData ? attemptData.attempts : 1;
                            const restantes = Math.max(0, 5 - intentos);
                            showMessage(`${mensajeError} Te quedan ${restantes} intento(s).`, 'error');
                        }
                    } catch (rpcErr) {
                        showMessage(mensajeError, 'error');
                    }
                    resetButton();
                    return;
                }
                
                try { await db.rpc('check_login_attempt', { p_email: email, p_success: true }); } catch (rpcErr) {}

                if (data.user && !data.user.email_confirmed_at) {
                    await db.auth.signOut();
                    showMessage('Debes confirmar tu correo antes de iniciar sesión.', 'error');
                    resetButton();
                    return;
                }
                
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
                    } catch (sessionErr) {
                        console.error('Error registrando sesión:', sessionErr);
                    }
                }

                try { await db.auth.signOut({ scope: 'others' }); } catch (e) {}
                
                showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                setTimeout(() => {
                    const redirectUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.REDIRECT_AFTER_LOGIN) ? APP_CONFIG.REDIRECT_AFTER_LOGIN : 'dashboard.html';
                    window.location.href = redirectUrl;
                }, 1500);
                
            } catch (err) {
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
            const { data, error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirectURL, queryParams: { access_type: 'offline', prompt: 'consent' } }
            });
            if (error) {
                let mensajeError = error.message;
                if (error.message.includes('already registered') || error.message.includes('already exists')) {
                    mensajeError = 'Este correo ya está registrado con otro método.';
                } else if (error.message.includes('For security purposes')) {
                    const match = error.message.match(/after (\d+) seconds?/);
                    mensajeError = `⏱️ Por seguridad, espera ${match ? match[1] : '60'} segundos antes de intentar de nuevo.`;
                }
                showMessage(mensajeError, 'error');
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
        const forgotPassword = document.querySelector('.forgot-password');
        const divider = document.querySelector('.divider');
        const googleBtn = document.querySelector('.btn-google');
        const registerLink = document.querySelector('.register-link');
        
        if (forgotPassword) forgotPassword.style.display = 'none';
        if (divider) divider.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    window.volverAlLogin = function(event) {
        if (event) event.preventDefault();
        clearMessage();
        
        if (loginForm) loginForm.style.display = 'block';
        const forgotPassword = document.querySelector('.forgot-password');
        const divider = document.querySelector('.divider');
        const googleBtn = document.querySelector('.btn-google');
        const registerLink = document.querySelector('.register-link');
        
        if (forgotPassword) forgotPassword.style.display = 'block';
        if (divider) divider.style.display = 'block';
        if (googleBtn) googleBtn.style.display = 'block';
        if (registerLink) registerLink.style.display = 'block';
        
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
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailRegex.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            
            showMessage('Enviando enlace de recuperación...', 'info');
            
            try {
                const redirectURL = construirURL('/recuperar-contrasena.html');
                const { data, error } = await db.auth.resetPasswordForEmail(email, { redirectTo: redirectURL });
                
                if (error) {
                    let mensajeError = error.message;
                    if (error.message.includes('User not found') || error.message.includes('no user found')) {
                        mensajeError = 'Este correo no está registrado en nuestro sistema.';
                    } else if (error.message.includes('For security purposes') || error.message.includes('rate limit')) {
                        const match = error.message.match(/after (\d+) seconds?/);
                        mensajeError = `⏱️ Por seguridad, espera ${match ? match[1] : '60'} segundos antes de solicitar otro enlace.`;
                    }
                    showMessage(mensajeError, 'error');
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

    // ============================================
    // 🛡️ VERIFICAR SESIÓN ACTIVA Y SUSPENSIÓN AL CARGAR
    // ============================================
    async function checkSession() {
        try {
            const { data: { session } } = await db.auth.getSession();
            
            if (session && session.user) {
                const { data: checkData } = await db.rpc('check_login_attempt', {
                    p_email: session.user.email,
                    p_success: true
                });
                
                if (checkData && checkData.allowed === false) {
                    await db.auth.signOut();
                    const hasta = checkData.blocked_until 
                        ? new Date(checkData.blocked_until).toLocaleString('es-ES') 
                        : 'varias horas';
                    
                    sessionStorage.setItem('auth_message', `🚫 Tu cuenta está suspendida hasta: ${hasta}.`);
                    sessionStorage.setItem('auth_type', 'error');
                    return;
                }

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
}); // <--- ¡ESTA LÍNEA ES OBLIGATORIA! CIERRA EL DOMContentLoaded
