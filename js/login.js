// Ya no necesita las credenciales, usa el config.js global

const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('message');

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
            showMessage('Error: ' + error.message, 'error');
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
