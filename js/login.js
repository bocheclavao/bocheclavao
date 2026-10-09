document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        if (messageDiv) {
            messageDiv.textContent = 'Error: No se pudo conectar con el servidor';
            messageDiv.className = 'message error';
        }
        return;
    }

    // 🔧 Función para construir URLs correctas en GitHub Pages
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

    // 4. Login con email y contraseña
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            showMessage('Iniciando sesión...', 'info');
            
            try {
                const { data, error } = await db.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    if (error.message.includes('Email not confirmed')) {
                        showMessage('Debes confirmar tu correo antes de iniciar sesión.', 'error');
                    } else if (error.message.includes('Invalid login credentials')) {
                        showMessage('Correo o contraseña incorrectos.', 'error');
                    } else {
                        showMessage('Error: ' + error.message, 'error');
                    }
                    return;
                }
                
                if (data.user && !data.user.email_confirmed_at) {
                    await db.auth.signOut();
                    showMessage('Debes confirmar tu correo antes de iniciar sesión.', 'error');
                    return;
                }
                
                showMessage('Inicio de sesión exitoso! Redirigiendo...', 'success');
                
                setTimeout(() => {
                    window.location.href = APP_CONFIG.REDIRECT_AFTER_LOGIN;
                }, 1500);
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // 5. Login con Google - URL CORREGIDA
    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            // Construir la URL correcta automáticamente
            const redirectURL = construirURL('/dashboard.html');
            console.log('URL de redirección Google:', redirectURL);
            
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
                showMessage('Error al iniciar sesión con Google: ' + error.message, 'error');
            }
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // 6. Recuperar contraseña
    window.mostrarRecuperarContrasena = function() {
        window.location.href = 'recuperar-contrasena.html';
    };

    // 7. Verificar sesión activa al cargar la página
    async function checkSession() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            window.location.href = APP_CONFIG.REDIRECT_AFTER_LOGIN;
        }
    }

    checkSession();
});
