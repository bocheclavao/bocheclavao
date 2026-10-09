// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Obtener elementos del DOM PRIMERO
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    
    // 2. Obtener el cliente de Supabase
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('❌ No se pudo obtener el cliente de Supabase');
        if (messageDiv) {
            messageDiv.textContent = 'Error: No se pudo conectar con el servidor';
            messageDiv.className = 'message error';
        }
        return;
    }

    // 3. Función para mostrar mensajes (definida antes de usarse)
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
                
                showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                
                setTimeout(() => {
                    window.location.href = APP_CONFIG.REDIRECT_AFTER_LOGIN;
                }, 1500);
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // 5. Login con Google (función global para el onclick del HTML)
    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            const { data, error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/html/dashboard.html'
                }
            });
            
            if (error) {
                showMessage('Error al iniciar sesión con Google: ' + error.message, 'error');
            }
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // 6. Recuperar contraseña (Redirige a la página de recuperación)
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
