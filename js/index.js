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

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
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
                const { data: preCheck, error: preError } = await db.rpc('check_login_attempt', { p_email: email, p_action: 'check' });
                if (preCheck && preCheck.allowed === false) {
                    const hasta = preCheck.blocked_until ? new Date(preCheck.blocked_until).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'varias horas';
                    showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                    resetButton();
                    return;
                }
                
                const { data, error: authError } = await db.auth.signInWithPassword({ email: email, password: password });
                
                if (authError) {
                    const { data: attemptData } = await db.rpc('check_login_attempt', { p_email: email, p_action: 'fail' });
                    if (attemptData && attemptData.allowed === false) {
                        const hasta = attemptData.blocked_until ? new Date(attemptData.blocked_until).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'varias horas';
                        showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                    } else {
                        const intentos = attemptData?.attempts || 1;
                        const restantes = Math.max(0, 4 - intentos);
                        showMessage(`❌ Contraseña incorrecta. Te quedan ${restantes} intento(s).`, 'error');
                    }
                    resetButton();
                    return;
                }
                
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
                            user_id: data.user.id, session_token: sessionToken, last_active: new Date().toISOString(), device_info: navigator.userAgent.substring(0, 200)
                        });
                        localStorage.setItem('session_token', sessionToken);
                    } catch (sessionErr) { console.error('Error registrando sesión:', sessionErr); }
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

    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            const redirectURL = window.location.origin + window.location.pathname.replace('index.html', '') + 'hub-juegos.html';
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
                const { data: checkData } = await db.rpc('check_login_attempt', { p_email: session.user.email, p_success: true });
                if (checkData && checkData.allowed === false) {
                    await db.auth.signOut();
                    const hasta = checkData.blocked_until ? new Date(checkData.blocked_until).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'varias horas';
                    sessionStorage.setItem('auth_message', `🚫 Tu cuenta está suspendida hasta: ${hasta}.`);
                    sessionStorage.setItem('auth_type', 'error');
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
