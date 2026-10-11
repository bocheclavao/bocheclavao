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

    // 👁️ 1. MOSTRAR / OCULTAR CONTRASEÑA
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

    // 🔐 2. LOGIN CON EMAIL Y CONTRASEÑA (CON PROTECCIÓN BRUTE-FORCE Y SESIÓN ÚNICA)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando...';
            showMessage('Iniciando sesión...', 'info');
            
            try {
                // Paso A: Intentar iniciar sesión en Supabase
                const { data, error: authError } = await db.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (authError) {
                    // Paso B: Si falla, registramos el intento fallido en la base de datos
                    const { data: attemptData } = await db.rpc('check_login_attempt', {
                        p_email: email,
                        p_success: false
                    });

                    if (attemptData && attemptData.allowed === false) {
                        showMessage('🚫 Cuenta suspendida por 12 horas por múltiples intentos fallidos. Por favor, restablece tu contraseña.', 'error');
                    } else {
                        const intentos = attemptData ? attemptData.attempts : 1;
                        const restantes = 4 - intentos;
                        showMessage(`Correo o contraseña incorrectos. Te quedan ${restantes} intento(s) antes del bloqueo.`, 'error');
                    }
                    resetButton();
                    return;
                }
                
                // Paso C: Si tiene éxito, limpiamos cualquier registro de bloqueo previo
                await db.rpc('check_login_attempt', { p_email: email, p_success: true });

                // ✅ PASO CLAVE: Cerrar sesión en TODOS los demás dispositivos/navegadores (Sesión Única)
                await db.auth.signOut({ scope: 'others' });

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

    // 🌐 3. LOGIN CON GOOGLE
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

    // 🔄 4. RECUPERAR CONTRASEÑA (Limpia el bloqueo si lo hace)
    window.mostrarRecuperarContrasena = async function() {
        const email = document.getElementById('email').value.trim();
        if (!email) {
            showMessage('Por favor, ingresa tu correo electrónico primero para enviarte el enlace de recuperación.', 'info');
            document.getElementById('email').focus();
            return;
        }

        showMessage('Enviando enlace de recuperación...', 'info');
        const { error } = await db.auth.resetPasswordForEmail(email, {
            redirectTo: construirURL('/dashboard.html') // Redirige al dashboard o a una página de reset si la tienes
        });

        if (error) {
            showMessage('Error: ' + error.message, 'error');
        } else {
            // Si se envió el correo, limpiamos los intentos fallidos porque va a cambiar la contraseña
            await db.rpc('check_login_attempt', { p_email: email, p_success: true });
            showMessage('✅ Enlace de recuperación enviado. Revisa tu correo (y Spam).', 'success');
        }
    };

    // 🛡️ 5. VERIFICAR SESIÓN ACTIVA AL CARGAR
    async function checkSession() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            window.location.href = APP_CONFIG.REDIRECT_AFTER_LOGIN || 'dashboard.html';
        }
    }
    checkSession();

    // 📩 6. MOSTRAR MENSAJE DE EXPULSIÓN SI EXISTE (Sesión Única)
    // Si el usuario fue expulsado desde otro dispositivo, el dashboard guardó este mensaje antes de redirigir
    const logoutReason = sessionStorage.getItem('auth_message');
    const logoutType = sessionStorage.getItem('auth_type') || 'info';
    
    if (logoutReason) {
        showMessage(logoutReason, logoutType);
        // Limpiar el mensaje para que no aparezca en recargas futuras
        sessionStorage.removeItem('auth_message');
        sessionStorage.removeItem('auth_type');
    }
});
