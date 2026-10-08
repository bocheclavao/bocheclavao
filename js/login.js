const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('message');

// Login con email y contraseña
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    showMessage('Iniciando sesión...', 'info');
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
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
            await supabase.auth.signOut();
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

// Login con Google
async function loginWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
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
}

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
}

async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = APP_CONFIG.REDIRECT_AFTER_LOGIN;
    }
}

checkSession();
