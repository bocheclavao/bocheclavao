// Ya no necesita las credenciales, usa el config.js global

const registroForm = document.getElementById('registroForm');
const messageDiv = document.getElementById('message');

registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showMessage('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    showMessage('Creando cuenta...', 'info');
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nombre: nombre
                }
            }
        });
        
        if (error) {
            showMessage('Error: ' + error.message, 'error');
            return;
        }
        
        if (data.user && !data.session) {
            showMessage('¡Cuenta creada! Revisa tu correo para confirmar.', 'success');
        } else {
            showMessage('¡Cuenta creada exitosamente! Redirigiendo...', 'success');
            setTimeout(() => {
                window.location.href = APP_CONFIG.REDIRECT_AFTER_REGISTER;
            }, 2000);
        }
        
    } catch (err) {
        showMessage('Error inesperado: ' + err.message, 'error');
    }
});

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
}
