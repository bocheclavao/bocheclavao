document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const db = window.supabaseClient;
    
    let countdownInterval = null;
    let captchaTokenLogin = null;

    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        showMessage('Error: No se pudo conectar con el servidor', 'error');
        return;
    }

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
            messageDiv.innerHTML = text; // Permite HTML para saltos de línea y negritas
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
        }
    }

    function resetCaptcha() {
        captchaTokenLogin = null;
        if (window.turnstile) {
            const captchaEl = document.getElementById('captchaLogin');
            if (captchaEl) window.turnstile.reset(captchaEl);
        }
    }

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
            stopCountdown();
            
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
                // ✅ PASO 1: Verificar si el correo existe (NUEVO)
                const { data: existeData, error: existeError } = await db.rpc('check_email_exists', { p_email: email });
                if (existeError) console.error('Error verificando correo:', existeError);
                
                if (existeData !== true) {
                    showMessage('❌ Este correo no está registrado en nuestra plataforma.', 'error');
                    resetButton();
                    resetCaptcha();
                    return;
                }

                // ✅ PASO 2: Verificar si está suspendido
                const { data: preCheck, error: preError } = await db.rpc('check_login_attempt', { 
                    p_email: email, 
                    p_action: 'check' 
                });
                if (preError) console.error('Error pre-check:', preError);
                
                if (preCheck && preCheck.allowed === false) {
                    startCountdown(preCheck.blocked_until);
                    resetButton();
                    resetCaptcha();
                    return;
                }
                
                // ✅ PASO 3: Intentar login con Supabase
                const { data, error: authError } = await db.auth.signInWithPassword({ email: email, password: password });
                
                if (authError) {
                    // ✅ PASO 4: Registrar intento fallido
                    const { data: attemptData, error: rpcError } = await db.rpc('check_login_attempt', { 
                        p_email: email, 
                        p_action: 'fail' 
                    });
                    if (rpcError) console.error('Error registrando intento:', rpcError);
                    
                    if (attemptData && attemptData.allowed === false) {
                        startCountdown(attemptData.blocked_until);
                    } else {
                        const intentos = (attemptData && attemptData.attempts) ? attemptData.attempts : 1;
                        const restantes = Math.max(0, 4 - intentos);
                        showMessage(`❌ Contraseña incorrecta. Te quedan ${restantes} intento(s).`, 'error');
                    }
                    resetButton();
                    resetCaptcha();
                    return;
                }
                
                // ✅ PASO 5: Verificar bloqueo permanente
                const { data: perfil, error: perfilError } = await db
                    .from('perfiles')
                    .select('bloqueado, motivo_bloqueo')
                    .eq('id', data.user.id)
                    .maybeSingle();

                if (perfil && perfil.bloqueado === true) {
                    await db.auth.signOut();
                    const motivo = perfil.motivo_bloqueo || 'Violación de las políticas, normas y condiciones de la plataforma.';
                    showMessage(`🚫 <strong>TU CUENTA HA SIDO BLOQUEADA PERMANENTEMENTE</strong><br><br>Motivo: ${motivo}<br><br>Contacta a soporte si crees que esto es un error.`, 'error');
                    resetButton();
                    resetCaptcha();
                    return;
                }
                
                // ✅ PASO 6: Login exitoso -> Resetear contador
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
                        // ✅ USAR EL ACCESS_TOKEN REAL DE SUPABASE (no un token inventado)
                        const sessionToken = data.session.access_token;
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
                
                // 🚨 1. VERIFICAR BLOQUEO PERMANENTE AL CARGAR
                const { data: perfil, error: perfilError } = await db
                    .from('perfiles')
                    .select('bloqueado, motivo_bloqueo')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (perfil && perfil.bloqueado === true) {
                    await db.auth.signOut();
                    const motivo = perfil.motivo_bloqueo || 'Violación de las políticas de la plataforma.';
                    sessionStorage.setItem('auth_message', `🚫 <strong>TU CUENTA HA SIDO BLOQUEADA PERMANENTEMENTE</strong><br><br>Motivo: ${motivo}<br><br>Contacta a soporte si crees que esto es un error.`);
                    sessionStorage.setItem('auth_type', 'error');
                    window.location.href = 'index.html';
                    return;
                }

                // 🚨 2. VERIFICAR SUSPENSIÓN TEMPORAL
                const { data: checkData, error: checkError } = await db.rpc('check_login_attempt', { 
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
                
                // 🚨 3. REDIRECCIONAR SI NO ESTÁ EN EL HUB
                if (!window.location.href.includes('hub-juegos.html')) {
                    window.location.href = 'hub-juegos.html';
                }
            }
        } catch (err) { 
            console.warn('No se pudo verificar sesión:', err); 
        }
    }
    checkSession();

    // 🚨 4. MOSTRAR MENSAJE DE EXPULSIÓN / DUPLICADA / BLOQUEO SI EXISTE
  const logoutReason = sessionStorage.getItem('auth_message');
const logoutType = sessionStorage.getItem('auth_type') || 'info';

if (logoutReason) {
    showMessage(logoutReason, logoutType);
    sessionStorage.removeItem('auth_message');
    sessionStorage.removeItem('auth_type');
}
});
