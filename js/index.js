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

    // 👁️ MOSTRAR / OCULTAR CONTRASEÑA
    window.togglePasswordVisibility = function() {
        const passwordInput = document.getElementById('password');
        const icon = document.querySelector('.toggle-password');
        
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

    // 🔐 LOGIN CON EMAIL Y CONTRASEÑA
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando...';
            showMessage('Iniciando sesión...', 'info');
            
            try {
                const { data, error: authError } = await db.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (authError) {
                    const { data: attemptData } = await db.rpc('check_login_attempt', {
                        p_email: email,
                        p_success: false
                    });

                    if (attemptData && attemptData.allowed === false) {
                        showMessage('🚫 Cuenta suspendida por 12 horas por múltiples intentos fallidos.', 'error');
                    } else {
                        const intentos = attemptData ? attemptData.attempts : 1;
                        const restantes = 4 - intentos;
                        showMessage(`Correo o contraseña incorrectos. Te quedan ${restantes} intento(s).`, 'error');
                    }
                    resetButton();
                    return;
                }
                
                await db.rpc('check_login_attempt', { p_email: email, p_success: true });
                await db.auth.signOut({ scope: 'others' });

                // 🚨 CLAVE: Emitir evento de Realtime para notificar a otros dispositivos
                if (data.user) {
                    const channel = db.channel(`session_${data.user.id}`);
                    await channel.send({
                        type: 'broadcast',
                        event: 'new_session',
                        payload: { userId: data.user.id, timestamp: Date.now() }
                    });
                    channel.unsubscribe();
                }

                if (data.user && !data.user.email_confirmed_at) {
                    await db.auth.signOut();
                    showMessage('Debes confirmar tu correo antes de iniciar sesión.', 'error');
                    resetButton();
                    return;
                }
                
                showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                setTimeout(() => {
                    window.location.href = APP_CONFIG.REDIRECT_AFTER_LOGIN || 'dashboard.html';
                }, 1500);
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
            }
        });
    }

    function resetButton() {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Ingresar';
    }

    // 🌐 LOGIN CON GOOGLE
    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            const redirectURL = construirURL('/dashboard.html');
            const { data, error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectURL,
                    queryParams: { access_type: 'offline', prompt: 'consent' }
                }
            });
            
            if (error) {
                if (error.message.includes('already registered') || error.message.includes('already exists')) {
                    showMessage('Este correo ya está registrado con otro método. Usa correo y contraseña.', 'error');
                } else {
                    showMessage('Error al iniciar sesión con Google: ' + error.message, 'error');
                }
            }
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // 🔄 RECUPERAR CONTRASEÑA
    window.mostrarRecuperarContrasena = async function() {
        const email = document.getElementById('email').value.trim();
        if (!email) {
            showMessage('Por favor, ingresa tu correo electrónico primero.', 'info');
            document.getElementById('email').focus();
            return;
        }

        showMessage('Enviando enlace de recuperación...', 'info');
        const { error } = await db.auth.resetPasswordForEmail(email, {
            redirectTo: construirURL('/dashboard.html')
        });

        if (error) {
            showMessage('Error: ' + error.message, 'error');
        } else {
            await db.rpc('check_login_attempt', { p_email: email, p_success: true });
            showMessage('✅ Enlace de recuperación enviado. Revisa tu correo (y Spam).', 'success');
        }
    };

    // 🛡️ VERIFICAR SESIÓN ACTIVA AL CARGAR
    async function checkSession() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            window.location.href = APP_CONFIG.REDIRECT_AFTER_LOGIN || 'dashboard.html';
        }
    }
    checkSession();

    // 📩 MOSTRAR MENSAJE DE EXPULSIÓN SI EXISTE
    const logoutReason = sessionStorage.getItem('auth_message');
    const logoutType = sessionStorage.getItem('auth_type') || 'info';
    
    if (logoutReason) {
        showMessage(logoutReason, logoutType);
        sessionStorage.removeItem('auth_message');
        sessionStorage.removeItem('auth_type');
    }
});
