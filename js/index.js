document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const db = window.supabaseClient;
    
    // 1. Variables para el CAPTCHA y el contador
    let countdownInterval = null;
    let captchaTokenLogin = null;

    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        showMessage('Error: No se pudo conectar con el servidor', 'error');
        return;
    }

    // 2. Función global para que Cloudflare guarde el token
    window.onCaptchaResolved = function(token) {
        captchaTokenLogin = token;
        console.log('✅ CAPTCHA de login resuelto');
    };

    function construirURL(base) {
        const path = window.location.pathname;
        const repoPath = path.substring(0, path.lastIndexOf('/'));
        return window.location.origin + repoPath + base;
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.innerHTML = text; // innerHTML permite usar negritas y colores en el contador
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

    // 3. Función para reiniciar el CAPTCHA en caso de error
    function resetCaptcha() {
        captchaTokenLogin = null;
        if (window.turnstile) {
            const captchaEl = document.getElementById('captchaLogin');
            if (captchaEl) window.turnstile.reset(captchaEl);
        }
    }

    // 4. Contador regresivo en tiempo real
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
            
            showMessage(`🚫 Cuenta suspendida. Podrás intentar de nuevo en: <strong style="color: #FFD700; font-size: 1.1rem;">${tiempoRestante}</strong>`, 'error');
        }, 1000);
    }

    function stopCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
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

    function resetButton() {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ingresar';
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            stopCountdown(); // Detener cualquier contador anterior
            
            // 5. VALIDACIÓN DEL CAPTCHA (Faltaba esto)
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
                // CORRECCIÓN 1: Usar p_action: 'check' en lugar de p_success: false
                const { data: preCheck, error: preError } = await db.rpc('check_login_attempt', { 
                    p_email: email, 
                    p_action: 'check' 
                });
                if (preError) console.error('Error pre-check:', preError);
                
                if (preCheck && preCheck.allowed === false) {
                    startCountdown(preCheck.blocked_until); // Inicia el contador en tiempo real
                    resetButton();
                    resetCaptcha();
                    return;
                }
                
                const { data, error: authError } = await db.auth.signInWithPassword({ email: email, password: password });
                
                if (authError) {
                    // CORRECCIÓN 1: Usar p_action: 'fail'
                    const { data: attemptData, error: rpcError } = await db.rpc('check_login_attempt', { 
                        p_email: email, 
                        p_action: 'fail' 
                    });
                    if (rpcError) console.error('Error registrando intento:', rpcError);
                    
                    if (attemptData && attemptData.allowed === false) {
                        startCountdown(attemptData.blocked_until);
                    } else {
                        const intentos = (attemptData && attemptData.attempts) ? attemptData.attempts : 1;
                        const restantes = Math.max(0, 5 - intentos);
                        showMessage(`❌ Contraseña incorrecta. Te quedan ${restantes} intento(s).`, 'error');
                    }
                    resetButton();
                    resetCaptcha(); // Reinicia el CAPTCHA para el siguiente intento
                    return;
                }
                
                // CORRECCIÓN 1: Usar p_action: 'success'
                try {
                    await db.rpc('check_login_attempt', { p_email: email, p_action: 'success' });
                } catch (rpcErr) {
                    console.warn('No se pudo resetear contador:', rpcErr.message || rpcErr);
                }
                
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
                setTimeout(() => {
                    window.location.href = 'hub-juegos.html';
                }, 1500);
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
                resetCaptcha();
            }
        });
    }

    window.loginWithGoogle = async function() {
        stopCountdown();
        showMessage('Conectando con Google...', 'info');
        try {
            const redirectURL = construirURL('/hub-juegos.html');
            const { error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirectURL, queryParams: { access_type: 'offline', prompt: 'consent' } }
            });
            if (error) showMessage('Error: ' + error.message, 'error');
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    async function checkSession() {
        try {
            const { data: { session } } = await db.auth.getSession();
            if (session && session.user) {
                // CORRECCIÓN 1: Usar p_action: 'check'
                const { data: checkData, error: checkError } = await db.rpc('check_login_attempt', { 
                    p_email: session.user.email, 
                    p_action: 'check' 
                });
                if (checkError) console.warn('Error verificando sesión:', checkError);
                
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
