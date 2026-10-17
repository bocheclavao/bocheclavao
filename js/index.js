document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const db = window.supabaseClient;
    let countdownInterval = null;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        showMessage('Error: No se pudo conectar con el servidor', 'error');
        return;
    }

    // ============================================
    // 🕒 CONTADOR REGRESIVO EN TIEMPO REAL
    // ============================================
    function startCountdown(blockedUntil) {
        // Limpiar intervalo anterior si existe
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const targetTime = new Date(blockedUntil).getTime();

        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetTime - now;

            if (distance <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                showMessage('✅ El tiempo de suspensión ha terminado. Ya puedes intentar iniciar sesión.', 'success');
                resetButton();
                return;
            }

            // Calcular horas, minutos y segundos
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

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.innerHTML = text; // innerHTML para permitir el formato del contador
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
            stopCountdown(); // Detener cualquier contador anterior
            
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
                // Verificar si está suspendido
                const { data: preCheck, error: preError } = await db.rpc('check_login_attempt', { 
                    p_email: email, 
                    p_action: 'check' 
                });
                
                if (preError) console.error('Error pre-check:', preError);
                
                if (preCheck && preCheck.allowed === false) {
                    // 🕒 INICIAR CONTADOR REGRESIVO EN TIEMPO REAL
                    startCountdown(preCheck.blocked_until);
                    resetButton();
                    return;
                }
                
                // Intentar login real
                const { data, error: authError } = await db.auth.signInWithPassword({ email: email, password: password });
                
                if (authError) {
                    // Registrar intento fallido
                    const { data: attemptData, error: rpcError } = await db.rpc('check_login_attempt', { 
                        p_email: email, 
                        p_action: 'fail' 
                    });
                    
                    if (rpcError) console.error('Error registrando intento:', rpcError);
                    
                    if (attemptData && attemptData.allowed === false) {
                        //  INICIAR CONTADOR REGRESIVO EN TIEMPO REAL
                        startCountdown(attemptData.blocked_until);
                    } else {
                        const intentos = attemptData?.attempts || 1;
                        const restantes = Math.max(0, 4 - intentos);
                        showMessage(`❌ Contraseña incorrecta. Te quedan ${restantes} intento(s).`, 'error');
                    }
                    resetButton();
                    return;
                }
                
                // Login exitoso -> Resetear contador
                await db.rpc('check_login_attempt', { p_email: email, p_action: 'success' });
                
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
                
                showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                setTimeout(() => { window.location.href = 'hub-juegos.html'; }, 1500);
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
            }
        });
    }

    // ============================================
    //  LOGIN CON GOOGLE (CON VERIFICACIÓN DE BLOQUEO)
    // ============================================
    window.loginWithGoogle = async function() {
        stopCountdown(); // Detener cualquier contador anterior
        
        // 🛡️ PASO 1: Pedir el email ANTES de abrir el popup de Google
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
            // 🛡️ PASO 2: Verificar si el correo está bloqueado/suspendido
            const { data: checkData, error: checkError } = await db.rpc('check_login_attempt', { 
                p_email: emailLimpio, 
                p_action: 'check' 
            });
            
            if (checkError) {
                console.error('Error verificando cuenta:', checkError);
            }
            
            //  Si está suspendido, mostrar contador y NO abrir Google
            if (checkData && checkData.allowed === false) {
                showMessage(`🚫 Esta cuenta está suspendida. No puedes iniciar sesión con Google ni con contraseña.`, 'error');
                startCountdown(checkData.blocked_until);
                return; // DETENER EJECUCIÓN - No abrir popup de Google
            }
            
            // ✅ Si NO está suspendido, continuar con Google
            showMessage('Conectando con Google...', 'info');
            
            const redirectURL = window.location.origin + window.location.pathname.replace('index.html', '') + 'hub-juegos.html';
            const { error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: { 
                    redirectTo: redirectURL, 
                    queryParams: { 
                        access_type: 'offline', 
                        prompt: 'consent',
                        login_hint: emailLimpio // Pre-llenar el email en Google
                    } 
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
    // 🛡️ VERIFICAR SESIÓN ACTIVA AL CARGAR
    // ============================================
    async function checkSession() {
        try {
            const { data: { session } } = await db.auth.getSession();
            if (session && session.user) {
                const { data: checkData, error: checkError } = await db.rpc('check_login_attempt', { 
                    p_email: session.user.email, 
                    p_action: 'check' 
                });
                
                if (checkError) console.warn('Error verificando sesión:', checkError);
                
                if (checkData && checkData.allowed === false) {
                    await db.auth.signOut();
                    // 🕒 Mostrar contador al cargar si hay sesión suspendida
                    startCountdown(checkData.blocked_until);
                    return;
                }
                
                if (!window.location.href.includes('hub-juegos.html')) {
                    window.location.href = 'hub-juegos.html';
                }
            }
        } catch (err) { 
            console.warn('No se pudo verificar sesión:', err); 
        }
    }
    checkSession();

    // ============================================
    //  MOSTRAR MENSAJE DE EXPULSIÓN SI EXISTE
    // ============================================
    const logoutReason = sessionStorage.getItem('auth_message');
    const logoutType = sessionStorage.getItem('auth_type') || 'info';
    if (logoutReason) {
        showMessage(logoutReason, logoutType);
        sessionStorage.removeItem('auth_message');
        sessionStorage.removeItem('auth_type');
    }
});
