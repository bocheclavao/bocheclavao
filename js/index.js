document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const db = window.supabaseClient;
    let countdownInterval = null;
    let captchaTokenLogin = null;
    let captchaTokenRecovery = null;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        showMessage('Error: No se pudo conectar con el servidor', 'error');
        return;
    }

    // ============================================
    // 🛡️ CALLBACKS DE CLOUDFLARE TURNSTILE
    // ============================================
    window.onCaptchaResolved = function(token) {
        captchaTokenLogin = token;
        console.log('✅ CAPTCHA de login resuelto');
    };

    // ============================================
    // 🕒 CONTADOR REGRESIVO EN TIEMPO REAL
    // ============================================
    function startCountdown(blockedUntil) {
        if (countdownInterval) clearInterval(countdownInterval);
        
        const targetTime = new Date(blockedUntil).getTime();
        
        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetTime - now;
            
            if (distance <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                showMessage('✅ El tiempo de suspensión ha terminado. Ya puedes intentar iniciar sesión.', 'success');
                resetButton();
                resetCaptcha();
                return;
            }
            
            const hours = Math.floor(distance / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            const tiempoRestante = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            showMessage(` Cuenta suspendida. Podrás intentar de nuevo en: <strong style="color: #FFD700; font-size: 1.1rem;">${tiempoRestante}</strong>`, 'error');
        }, 1000);
    }

    function stopCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    function resetCaptcha() {
        captchaTokenLogin = null;
        captchaTokenRecovery = null;
        if (window.turnstile) {
            if (document.getElementById('captchaLogin')) window.turnstile.reset('captchaLogin');
            if (document.getElementById('captchaRecovery')) window.turnstile.reset('captchaRecovery');
        }
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.innerHTML = text;
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
        }
    }

    function resetButton() {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ingresar';
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
            stopCountdown();
            
            // 🛡️ VALIDAR CAPTCHA
            if (!captchaTokenLogin) {
                showMessage('⚠️ Por favor, completa la verificación de seguridad (CAPTCHA).', 'error');
                return;
            }
            
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
                const { data: preCheck } = await db.rpc('check_login_attempt', { 
                    p_email: email, 
                    p_action: 'check' 
                });
                
                if (preCheck && preCheck.allowed === false) {
                    startCountdown(preCheck.blocked_until);
                    resetButton();
                    resetCaptcha();
                    return;
                }
                
                const { data, error: authError } = await db.auth.signInWithPassword({ email: email, password: password });
                
                if (authError) {
                    const { data: attemptData } = await db.rpc('check_login_attempt', { 
                        p_email: email, 
                        p_action: 'fail' 
                    });
                    
                    if (attemptData && attemptData.allowed === false) {
                        startCountdown(attemptData.blocked_until);
                    } else {
                        const intentos = attemptData?.attempts || 1;
                        const restantes = Math.max(0, 4 - intentos);
                        showMessage(`❌ Contraseña incorrecta. Te quedan ${restantes} intento(s).`, 'error');
                    }
                    resetButton();
                    resetCaptcha();
                    return;
                }
                
                await db.rpc('check_login_attempt', { p_email: email, p_action: 'success' });
                
                if (data.user && !data.user.email_confirmed_at) {
                    await db.auth.signOut();
                    showMessage('Debes confirmar tu correo antes de iniciar sesión.', 'error');
                    resetButton();
                    resetCaptcha();
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
                
                showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                setTimeout(() => { window.location.href = 'hub-juegos.html'; }, 1500);
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
                resetCaptcha();
            }
        });
    }

    // ============================================
    // 🔐 LOGIN CON GOOGLE (CON VERIFICACIÓN DE BLOQUEO)
    // ============================================
    window.loginWithGoogle = async function() {
        stopCountdown();
        
        // 🛡️ Pedir email ANTES de abrir Google
        const email = prompt('Por seguridad, ingresa tu correo electrónico para verificar tu cuenta:');
        
        if (!email) {
            showMessage('Debes ingresar tu correo para continuar con Google.', 'error');
            return;
        }
        
        const emailLimpio = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(emailLimpio)) {
            showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
            return;
        }
        
        showMessage('Verificando cuenta...', 'info');
        
        try {
            const { data: checkData } = await db.rpc('check_login_attempt', { 
                p_email: emailLimpio, 
                p_action: 'check' 
            });
            
            if (checkData && checkData.allowed === false) {
                showMessage('🚫 Esta cuenta está suspendida. No puedes iniciar sesión.', 'error');
                startCountdown(checkData.blocked_until);
                return;
            }
            
            showMessage('Conectando con Google...', 'info');
            
            const redirectURL = window.location.origin + window.location.pathname.replace('index.html', '') + 'hub-juegos.html';
            const { error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: { 
                    redirectTo: redirectURL, 
                    queryParams: { 
                        access_type: 'offline', 
                        prompt: 'consent',
                        login_hint: emailLimpio
                    } 
                }
            });
            
            if (error) showMessage('Error: ' + error.message, 'error');
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // ============================================
    // 🔄 FLUJO DE RECUPERACIÓN
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
            
            // ️ VALIDAR CAPTCHA DE RECUPERACIÓN
            const captchaRecoveryEl = document.getElementById('captchaRecovery');
            const captchaRecoveryToken = captchaRecoveryEl?.querySelector('[name="cf-turnstile-response"]')?.value;
            
            if (!captchaRecoveryToken) {
                showMessage('⚠️ Por favor, completa la verificación de seguridad.', 'error');
                return;
            }
            
            const email = document.getElementById('recoveryEmail').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailRegex.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            
            showMessage('Enviando enlace de recuperación...', 'info');
            
            try {
                const redirectURL = window.location.origin + window.location.pathname.replace('index.html', '') + 'recuperar-contrasena.html';
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
                    if (window.turnstile && captchaRecoveryEl) window.turnstile.reset(captchaRecoveryEl);
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
    // 🛡️ VERIFICAR SESIÓN ACTIVA AL CARGAR
    // ============================================
    async function checkSession() {
        try {
            const { data: { session } } = await db.auth.getSession();
            if (session && session.user) {
                const { data: checkData } = await db.rpc('check_login_attempt', { 
                    p_email: session.user.email, 
                    p_action: 'check' 
                });
                
                if (checkData && checkData.allowed === false) {
                    await db.auth.signOut();
                    startCountdown(checkData.blocked_until);
                    return;
                }
                
                if (!window.location.href.includes('hub-juegos.html')) {
                    window.location.href = 'hub-juegos.html';
                }
            }
        } catch (err) { console.warn('No se pudo verificar sesión:', err); }
    }
    checkSession();

    const logoutReason = sessionStorage.getItem('auth_message');
    const logoutType = sessionStorage.getItem('auth_type') || 'info';
    if (logoutReason) {
        showMessage(logoutReason, logoutType);
        sessionStorage.removeItem('auth_message');
        sessionStorage.removeItem('auth_type');
    }
});
